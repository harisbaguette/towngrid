// Real Web Audio checks on the title screen, with autoplay both allowed and blocked.
// Usage: node tests/title-audio-browser.mjs <playwright/index.mjs> <chrome.exe>
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { MUSIC } from '../src/app/game/audio.js';

const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const origin = process.env.TOWNGRID_URL || 'http://localhost:5173';
const errors = [], failed = [];
const sessions = new WeakMap();
async function observe(page, fn) {
  if (!sessions.has(page)) sessions.set(page, await page.context().newCDPSession(page));
  // Playwright page.evaluate marks execution as a user gesture, which would invalidate autoplay checks.
  const result = await sessions.get(page).send('Runtime.evaluate', { expression: '(' + fn.toString() + ')()', returnByValue: true, userGesture: false });
  assert.equal(result.exceptionDetails, undefined);
  return result.result.value;
}
async function until(page, fn, label) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) { if (await observe(page, fn)) return;await delay(150); }
  assert.fail('Timed out: ' + label);
}
const launch = policy => chromium.launch({
  headless: true,
  ...(process.argv[3] ? { executablePath: process.argv[3] } : {}),
  args: ['--enable-unsafe-swiftshader', '--autoplay-policy=' + policy],
});
async function open(browser, { muted = false, touch = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', hasTouch: touch });
  await context.addInitScript(({ muted }) => {
    window.WebSocket = class { addEventListener() {} removeEventListener() {} send() {} close() {} };
    localStorage.setItem('title-audio-save-sentinel', 'unchanged');
    if (muted) localStorage.setItem('orvetharn-audio', JSON.stringify({ muted: true, volumes: { music: .37 } }));
    const NativeContext = window.AudioContext;
    window.tgAudioContexts = [];
    window.AudioContext = class extends NativeContext {
      constructor(...args) { super(...args);this.tgMeters = [];window.tgAudioContexts.push(this); }
      createAnalyser() { const meter = super.createAnalyser();this.tgMeters.push(meter);return meter; }
    };
  }, { muted });
  const page = await context.newPage();
  page.audioRequests = [];
  page.on('request', request => { if (request.url().includes('/assets/audio/')) page.audioRequests.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().includes('/assets/audio/') && response.status() >= 400) failed.push(response.url()); });
  await page.goto(origin);
  await until(page, () => Object.keys(document.querySelector('.screen-sound') || {}).some(key => key.startsWith('__reactProps$')), 'title hydration');
  return page;
}
const music = page => until(page, () => {
  const context = window.tgAudioContexts.findLast(item => item.state !== 'closed');
  const meter = context?.tgMeters[1];
  if (context?.state !== 'running' || !meter) return false;
  const data = new Float32Array(meter.fftSize);meter.getFloatTimeDomainData(data);
  return Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length) > .001;
}, 'audible music channel');
const sound = (page, enabled) => page.getByRole('button', { name: enabled ? '소리 끄기' : '소리 켜기', exact: true });
async function locked(page) {
  await until(page, () => window.tgAudioContexts.some(item => item.state === 'suspended') && document.querySelector('.screen-sound')?.getAttribute('aria-label') === '소리 켜기', 'autoplay suspended with sound off');
  assert.equal(await observe(page, () => navigator.userActivation.hasBeenActive), false);
}
async function close(page) {
  assert.ok(!page.audioRequests.some(url => /\/(calm-theme|music-town|music-harp)\.(ogg|mp3)/.test(url)), 'Retired acoustic tracks must not return later in the playlist');
  assert.equal(await page.evaluate(() => localStorage.getItem('title-audio-save-sentinel')), 'unchanged');
  await page.context().close();
}

const allowed = await launch('no-user-gesture-required');
try {
  const page = await open(allowed);
  await music(page);
  assert.equal(await observe(page, () => navigator.userActivation.hasBeenActive), false);
  assert.ok(page.audioRequests.some(url => url.endsWith('/score-title.ogg')), 'The title has its own score');
  await sound(page, true).waitFor();
  assert.equal(await page.locator('.title-screen').count(), 1);
  await sound(page, true).click();await sound(page, false).waitFor();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('orvetharn-audio')).muted), true);
  await sound(page, false).press('Enter');await music(page);await sound(page, true).waitFor();
  await page.getByRole('button', { name: '화면을 눌러 시작', exact: true }).press('Enter');
  await page.locator('.home-screen').waitFor({ timeout: 120000 });await music(page);
  await page.getByRole('button', { name: '대기 화면', exact: true }).click();
  await page.locator('.title-screen').waitFor();await music(page);
  const decoded = await page.evaluate(async tracks => {
    const context = window.tgAudioContexts.findLast(item => item.state !== 'closed'), result = [];
    for (const name of tracks) for (const extension of ['ogg', 'mp3']) {
      const response = await fetch('/assets/audio/' + name + '.' + extension);
      if (!response.ok) throw new Error('Missing music: ' + name + '.' + extension);
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      const channel = buffer.getChannelData(0);let peak = 0, squares = 0;
      for (const value of channel) { peak = Math.max(peak, Math.abs(value));squares += value * value; }
      result.push({ name, extension, seconds: buffer.duration, peak, rms: Math.sqrt(squares / channel.length) });
    }
    return result;
  }, MUSIC);
  for (const track of decoded) { assert.ok(track.seconds > 15);assert.ok(track.peak < 1);assert.ok(track.rms > .035 && track.rms < .15); }
  console.log('PASS playlist OGG/MP3 decode, audible level and no clipping:', JSON.stringify(decoded));
  await close(page);
  console.log('PASS permitted autoplay before any input, mute/unmute, title/home/title music');

  const saved = await open(allowed, { muted: true });
  await sound(saved, false).waitFor();
  assert.equal(await observe(saved, () => window.tgAudioContexts.filter(item => item.state !== 'closed').length), 0);
  await saved.getByRole('button', { name: '화면을 눌러 시작', exact: true }).press('Enter');
  await saved.locator('.home-screen').waitFor({ timeout: 120000 });await sound(saved, false).waitFor();
  assert.deepEqual(await saved.evaluate(() => JSON.parse(localStorage.getItem('orvetharn-audio'))), { muted: true, volumes: { music: .37 } });
  await sound(saved, false).click();await music(saved);
  assert.equal(await saved.evaluate(() => JSON.parse(localStorage.getItem('orvetharn-audio')).volumes.music), .37);
  await close(saved);
  console.log('PASS saved mute and music volume survive entry and unmute');
} finally { await allowed.close(); }

const blocked = await launch('document-user-activation-required');
try {
  const page = await open(blocked);
  await locked(page);
  // Hold past the UI's status poll; pointer-down must not change the toggle into a mute action.
  await sound(page, false).hover();await page.mouse.down();await page.waitForTimeout(800);await page.mouse.up();
  await music(page);await sound(page, true).waitFor();
  assert.equal(await page.locator('.title-screen').count(), 1);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('orvetharn-audio')).muted), false);
  await close(page);
  console.log('PASS blocked autoplay shows sound off; one held click enables title music');

  const keyboard = await open(blocked);
  await locked(keyboard);
  await keyboard.keyboard.press('a');await music(keyboard);
  assert.equal(await keyboard.locator('.title-screen').count(), 1);
  await close(keyboard);
  console.log('PASS keyboard input unlocks title music without entering home');

  const touch = await open(blocked, { touch: true });
  await locked(touch);
  await sound(touch, false).tap();await music(touch);await sound(touch, true).waitFor();
  assert.equal(await touch.locator('.title-screen').count(), 1);
  await close(touch);
  console.log('PASS one touch enables title music');
} finally { await blocked.close(); }

assert.deepEqual(errors, []);assert.deepEqual(failed, []);
console.log('TITLE AUDIO BROWSER PASS');
