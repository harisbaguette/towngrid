// Headless check that background music + ambience really play in the game and building sounds stay inside the budget.
// Usage: node tests/audio-browser.mjs <playwright/index.mjs> <chrome.exe> [new|starter]
// Needs a running dev server (TOWNGRID_URL, default http://localhost:5173). Isolated browser context; no user save is touched.
import { pathToFileURL, fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { BACKGROUND_FILES } from '../src/app/game/audio.js';
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}), args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => { window.WebSocket = class { constructor() { this.readyState = 0; } addEventListener() {} removeEventListener() {} send() {} close() {} }; });
const page = await context.newPage();
const errors = [], audioFail = [];
page.on('pageerror', e => errors.push(e.message));
page.on('response', r => { if (r.url().includes('/assets/audio/') && r.status() >= 400) audioFail.push(r.status() + ' ' + r.url()); });
const origin = process.env.TOWNGRID_URL || 'http://localhost:5173', mode = process.argv[4] || 'new', outDir = new URL('../docs/verification/audio/', import.meta.url);
await page.goto(origin);
for (let i = 0; i < 40 && !(await page.getByRole('button', { name: '새 게임' }).count()); i++) { await page.getByRole('button', { name: '화면을 눌러 시작', exact: true }).click().catch(() => {}); await page.waitForTimeout(1500); }
await page.evaluate(async () => {
 const urls = performance.getEntriesByType('resource').map(e => e.name).filter(url => /\/app\/game\/audio\.js(?:\?|$)/.test(url));
 for (const url of new Set([...urls, '/src/app/game/audio.js'])) { try { const { GameAudio } = await import(url); for (const k of ['start', 'update', 'tick', 'play']) { const o = GameAudio.prototype[k]; if (o.__w) continue; const w = function (...a) { window.tgAudio = this; if (k === 'play') { const ok = o.apply(this, a); if (ok && a[1]?.world) (window.tgWorld ||= []).push({ t: performance.now(), type: a[0], v: +(a[1].volume || 0).toFixed(4) }); return ok; } return o.apply(this, a); }; w.__w = 1; GameAudio.prototype[k] = w; } } catch { /* other module instance */ } }
});
const db = v => v > 0 ? +(20 * Math.log10(v)).toFixed(1) : -Infinity;
const sample = async (label, seconds = 6) => {
 const rows = [];
 for (let i = 0; i < seconds * 4; i++) { rows.push(await page.evaluate(() => { const a = window.tgAudio; if (!a) return null; const s = a.status; return { state: s.state, music: s.music, ambience: s.ambience, levels: s.levels, rms: s.rms, voices: s.voices, world: [...a.voices].filter(v => v.world).length, paused: a.paused, volumes: a.volumes, musicGain: a.musicGain?.gain.value, ambienceGain: a.ambienceGain?.gain.value }; })); await page.waitForTimeout(250); }
 const ok = rows.filter(Boolean), avg = k => ok.reduce((s, r) => s + r.levels[k], 0) / Math.max(1, ok.length), peak = k => Math.max(0, ...ok.map(r => r.levels[k]));
 const last = ok.at(-1) || {};
 return { label, state: last.state, paused: last.paused, music: [...new Set(ok.map(r => r.music))], ambience: [...new Set(ok.flatMap(r => r.ambience))], musicDb: db(avg('music')), musicPeakDb: db(peak('music')), ambienceDb: db(avg('ambience')), effectsDb: db(avg('effects')), effectsPeakDb: db(peak('effects')), outDb: db(ok.reduce((s, r) => s + r.rms, 0) / Math.max(1, ok.length)), maxWorldVoices: Math.max(0, ...ok.map(r => r.world)), gains: { music: last.musicGain, ambience: last.ambienceGain } };
};
const result = { mode, steps: [] };
result.steps.push(await sample('home', 4));
if (mode === 'starter') await page.getByRole('button', { name: /초반 마을 테스트/ }).click();
else { await page.getByRole('button', { name: '새 게임' }).click(); await page.getByRole('button', { name: /이 땅에서 시작/ }).click(); }
await page.getByRole('button', { name: /일시정지|재개/ }).first().waitFor({ timeout: 120000 });
await page.waitForTimeout(3000);
result.steps.push(await sample('in-game', 10));
if (mode === 'starter') {
 for (const speed of ['4×']) await page.getByRole('button', { name: speed, exact: true }).click().catch(() => {});
 await page.evaluate(() => { window.tgWorld = []; });
 const s = await sample('starter 4x production', 12);
 const world = await page.evaluate(() => window.tgWorld || []);
 const perSecond = Math.max(0, ...world.map(w => world.filter(x => x.t >= w.t && x.t < w.t + 1000).length));
 s.worldPlays = world.length; s.worldMaxPerSecond = perSecond; s.worldMaxVolume = Math.max(0, ...world.map(w => w.v)); s.worldTypes = [...new Set(world.map(w => w.type))];
 result.steps.push(s);
}
// Settings dialog: sliders must move the channel gains (dialog pauses the game -> ambience fades, music continues).
await page.getByRole('button', { name: '게임 설정' }).click();
await page.waitForTimeout(1500);
result.steps.push(await sample('settings open (game paused)', 4));
const slider = async (label, value) => { const el = page.getByLabel(label + ' 음량'); await el.evaluate((node, v) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(node, String(v)); node.dispatchEvent(new Event('input', { bubbles: true })); node.dispatchEvent(new Event('change', { bubbles: true })); }, value); };
await slider('음악', 0); await page.waitForTimeout(1200);
result.steps.push(await sample('music slider 0', 3));
await slider('음악', 0.48); await page.waitForTimeout(1500);
result.steps.push(await sample('music slider back 0.48', 3));
await page.getByRole('button', { name: '환경음 듣기' }).click(); await page.waitForTimeout(800);
result.steps.push(await sample('ambience preview in settings', 2));
await slider('환경음', 0.2);
result.steps.push(await sample('ambience slider 0.2', 1));
await slider('환경음', 0.45);
await page.keyboard.press('Escape'); await page.waitForTimeout(6000);
result.steps.push(await sample('settings closed (game resumes)', 6));
// Tab hidden -> game pauses & context suspends; visible again -> audio resumes by itself.
await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
await page.waitForTimeout(1000);
result.steps.push(await sample('tab hidden', 2));
await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
await page.waitForTimeout(1500);
result.steps.push(await sample('tab visible again', 3));
// Every background file decodes in the real browser (only the current ones are loaded during play).
result.backgroundDecode = await page.evaluate(async names => { const a = window.tgAudio; const out = {}; for (const n of names) { const b = await a.fetchBuffer(n); out[n] = b ? +b.duration.toFixed(1) : null; } return out; }, BACKGROUND_FILES);
result.audioFail = audioFail; result.errors = errors.slice(0, 10);
console.log(JSON.stringify(result, null, 1));
mkdirSync(outDir, { recursive: true });writeFileSync(fileURLToPath(new URL(mode + '.json', outDir)), JSON.stringify(result, null, 1));
await browser.close();
