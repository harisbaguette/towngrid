// Uses an existing Playwright/browser installation; no new project dependency.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WORK_ART, TRANSITION_ART } from '../src/app/game/screen-art.js';
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}), args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
await context.addInitScript(() => { window.WebSocket = class { addEventListener() {} removeEventListener() {} send() {} close() {} }; });
const page = await context.newPage(), errors = [], failed = [], checked = [];
const legacyRequests = [], screenRequests = [];
page.on('request', request => { if (/\.glb(?:\?|$)/.test(request.url())) legacyRequests.push(request.url()); if (request.url().includes('/assets/screens/')) screenRequests.push(request.url()); });
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.url().includes('/assets/screens/') && response.status() >= 400) failed.push(response.url()); });
const output = process.env.TG_OUT ? pathToFileURL(process.env.TG_OUT.replace(/\\/g, '/') + '/') : new URL('../docs/verification/start-screens/', import.meta.url);
await mkdir(output, { recursive: true });
const origin = process.env.TOWNGRID_URL || 'http://localhost:5173';
const screenshot = async name => { await page.waitForFunction(() => [...document.querySelectorAll('.front-screen img:not([loading="lazy"])')].every(image => image.complete && image.naturalWidth > 0)); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); await page.screenshot({ path: fileURLToPath(new URL(name, output)) }); };
// Controlled randomness only in this disposable browser; never a production switch.
const forceHome = async (id, chance = 0) => page.evaluate(async ({ id, chance }) => {
  const { WORK_ART, HOME_ART_KEY } = await import('/src/app/game/screen-art.js');
  const ids = WORK_ART.map(art => art.id);
  localStorage.setItem(HOME_ART_KEY, JSON.stringify({ catalog: ids.join('|'), queue: [id, ...ids.filter(value => value !== id)], last: null }));
  window.originalRandom = Math.random;Math.random = () => chance;
}, { id, chance });
const restoreRandom = () => page.evaluate(() => { Math.random = window.originalRandom; });
const enterHome = async () => { await page.getByRole('button', { name: '화면을 눌러 시작', exact: true }).click(); await page.getByRole('button', { name: '새 게임', exact: true }).waitFor({ timeout: 120000 }); };
try {
  await page.goto(origin);
  await page.locator('canvas[role="application"]').waitFor({ state: 'attached', timeout: 120000 });
  await page.getByRole('button', { name: '화면을 눌러 시작', exact: true }).waitFor();
  await screenshot('01-title-desktop.png');
  assert.ok(screenRequests.filter(url => /daily-v3/.test(url) && !TRANSITION_ART.some(art => url.endsWith(art.src))).length === 0, 'Do not preload all daily scenes at startup');
  await forceHome('dawn-bakery');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '새 게임', exact: true }).waitFor({ timeout: 120000 });
  await page.locator('.home-screen[data-art="dawn-bakery"]').waitFor();
  await restoreRandom();
  assert.equal(await page.getByRole('button', { name: '이어하기', exact: true }).isDisabled(), true);
  assert.equal(await page.locator('.home-extras').getAttribute('open'), null);
  assert.equal(await page.locator('.home-menu button').first().textContent(), '새 게임');
  await screenshot('02-home-desktop.png');
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  assert.equal(await page.getByRole('button', { name: '지금 저장', exact: true }).count(), 0);
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
  assert.equal(await page.locator('.home-screen').getAttribute('data-art'), 'dawn-bakery', 'Rerenders do not randomly replace the home art');
  await page.getByRole('button', { name: '마을의 하루', exact: true }).click();
  const titles = [];
  for (let i = 0; i < WORK_ART.length; i++) {
    titles.push(await page.locator('.gallery-controls strong').innerText());
    await page.waitForFunction(() => { const img = document.querySelector('.gallery-stage img');return img?.complete && img.naturalWidth > 0; });
    if (i === 0 || i === 4) await screenshot(`daily-gallery-${i}.png`);
    await page.getByRole('button', { name: '다음 그림', exact: true }).click();
  }
  assert.equal(new Set(titles).size, WORK_ART.length);
  for (const category of ['생활', '자연', '산업']) {
    await page.getByRole('button', { name: new RegExp('^' + category) }).click();
    assert.equal(await page.locator('.gallery-thumbnails button').count(), WORK_ART.filter(art => art.category === category).length);
  }
  await page.getByRole('button', { name: /^화면 전환/ }).click();
  assert.equal(await page.locator('.gallery-thumbnails button').count(), TRANSITION_ART.length);
  for (const art of TRANSITION_ART) {
    await page.getByRole('button', { name: art.title + ' 보기', exact: true }).click();
    assert.equal(await page.locator('.gallery-controls strong').innerText(), art.title);
    await page.waitForFunction(() => { const img = document.querySelector('.gallery-stage img');return img?.complete && img.naturalWidth > 0; });
  }
  await screenshot('transition-gallery.png');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('.gallery-controls strong').innerText(), TRANSITION_ART[0].title);
  await page.getByRole('button', { name: '홈으로', exact: true }).click();
  await page.getByRole('button', { name: '새 게임', exact: true }).click();
  await page.locator('.world-map-screen').waitFor();
  await page.getByRole('button', { name: '홈으로', exact: true }).click();
  checked.push('title keyboard entry, no-save continue disabled, stable random home, home/settings/world navigation, 24 daily + 4 transition gallery, filters/thumbnails/arrows');

  // Hold a real, previously unloaded elf image only in this disposable test context.
  const raw = await page.evaluate(async () => {
    const [{ Campaign }, { encodeSave }] = await Promise.all([import('/src/app/game/campaign.js'), import('/src/app/game/persistence.js')]);
    return encodeSave(new Campaign({ race: 'elf' }).save());
  });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/assets/pixel-characters/ael/sprites.png', async route => { await gate; await route.continue(); });
  await page.getByLabel('저장 파일 불러오기').setInputFiles({ name: 'elf-test.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
  await page.locator('.screen-loading[data-art]:not([data-art="town"])').waitFor();
  const first = await page.locator('.screen-loading').getAttribute('data-art');
  assert.equal(first, 'records-room');
  await screenshot('03-character-loading.png');
  await page.waitForFunction(id => document.querySelector('.screen-loading')?.dataset.art !== id, first, { timeout: 14000 });
  const second = await page.locator('.screen-loading').getAttribute('data-art');
  assert.notEqual(first, second);
  release();
  await page.locator('.screen-loading').waitFor({ state: 'detached', timeout: 120000 });
  await page.getByRole('button', { name: '게임 메뉴', exact: true }).click();
  await page.getByRole('button', { name: '게임 설정', exact: true }).click();
  await page.getByRole('button', { name: '시작 화면으로', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: '이어하기', exact: true }).isEnabled(), true);
  assert.equal(await page.locator('.home-menu button').first().textContent(), '이어하기');
  const preserved = await page.evaluate(async () => { const { SAVE_KEY } = await import('/src/app/game/persistence.js'); return localStorage.getItem(SAVE_KEY); });
  await screenshot('home-with-save.png');
  await page.getByRole('button', { name: '새 게임', exact: true }).click();
  await page.locator('.start-primary').click();await page.locator('.start-primary').click();
  await page.locator('.starting-land-preview[data-ready=true]').waitFor({ timeout: 120000 });await page.locator('.start-primary').click();
  await page.getByRole('dialog', { name: '새 땅에서 시작할까요?' }).waitFor();
  assert.equal(await page.locator('.confirm-dialog').evaluate(el=>getComputedStyle(el).backgroundImage),'none');
  await screenshot('new-game-confirm.png');await page.setViewportSize({ width:390,height:844 });await screenshot('new-game-confirm-mobile.png');
  assert.equal(await page.locator('.confirm-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  await page.getByRole('button', { name:'취소',exact:true }).click();await page.setViewportSize({ width:1440,height:900 });
  await page.getByRole('button',{name:'부지 선택으로',exact:true}).click();await page.getByRole('button',{name:'국가 선택으로',exact:true}).click();await page.getByRole('button',{name:'홈으로',exact:true}).click();
  assert.equal(await page.evaluate(async()=>{const {SAVE_KEY}=await import('/src/app/game/persistence.js');return localStorage.getItem(SAVE_KEY);}),preserved,'Cancelling a new game keeps the imported save');
  checked.push('Saved home prioritizes continue; new-game confirmation fits desktop/mobile; cancel preserves save');
  await page.locator('.home-extras>summary').click();
  await page.getByRole('button', { name: '초반 마을 테스트', exact: true }).click();
  await page.getByRole('button', { name: '게임 메뉴', exact: true }).click();
  await page.getByRole('button', { name: '시작 화면', exact: true }).click();
  assert.equal(await page.evaluate(async () => { const { SAVE_KEY } = await import('/src/app/game/persistence.js'); return localStorage.getItem(SAVE_KEY); }), preserved);
  const sequence = await page.evaluate(async () => {
    const { createArtworkPicker } = await import('/src/app/game/screen-art.js');
    const pick = createArtworkPicker(localStorage); return [pick().id, pick().id];
  });
  assert.notEqual(sequence[0], sequence[1]);
  checked.push('actual save import, long-load artwork advances, immediate completion, playable demo, saved game preserved');

  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot('04-home-mobile.png');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByRole('button', { name: '마을의 하루', exact: true }).click();
  await page.getByRole('button', { name: '보리크와 오리엘의 유리 공방 보기', exact: true }).click();
  await screenshot('05-art-mobile.png');
  const overflow = await page.locator('.gallery-controls').evaluate(el => el.scrollWidth > el.clientWidth);
  assert.equal(overflow, false, 'Long gallery titles fit narrow screens');
  await page.getByRole('button', { name: '홈으로', exact: true }).click();
  await page.getByRole('button', { name: '대기 화면', exact: true }).click();
  await screenshot('06-title-mobile.png');
  await enterHome();
  await page.setViewportSize({ width: 844, height: 390 });
  await screenshot('07-home-landscape.png');
  assert.equal(await page.getByRole('button', { name: '새 게임', exact: true }).isVisible(), true);
  const bounds = await page.locator('.home-logo, .home-to-title').evaluateAll(elements => elements.map(element => { const r = element.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: innerHeight }; }));
  assert.ok(bounds.every(r => r.top >= 0 && r.bottom <= r.height), 'Logo and final menu action fit short landscape');
  // Returning from a demo must clear its now-irrelevant game notices.
  await page.locator('[data-sonner-toast]').waitFor({ state: 'detached' });
  checked.push('390px mobile, short landscape, reduced motion');
  // Normal motion uses a short, skippable illustration; reduced motion above skips it.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => {
    window.transitionsSeen = [];
    new MutationObserver(() => { const id = document.querySelector('.screen-transition')?.dataset.art;if (id && window.transitionsSeen.at(-1) !== id) window.transitionsSeen.push(id); }).observe(document.body, { subtree: true, childList: true });
  });
  await page.getByRole('button', { name: '대기 화면', exact: true }).click();
  await page.getByRole('button', { name: '화면을 눌러 시작', exact: true }).waitFor();
  await forceHome('dawn-bakery', .99);
  await enterHome();
  await restoreRandom();
  assert.equal(await page.locator('.home-screen').getAttribute('data-art'), 'town', 'Most home entries keep the main town artwork');
  await page.getByRole('button', { name: '새 게임', exact: true }).click();
  await page.locator('.screen-transition').waitFor();
  await page.keyboard.press('Enter');
  await page.locator('.world-map-screen').waitFor();
  await page.locator('.screen-loading').waitFor({ state: 'detached', timeout: 120000 });
  await page.getByRole('button', { name: '홈으로', exact: true }).click();
  await page.getByRole('button', { name: '새 게임', exact: true }).waitFor();
  const transitionsSeen = await page.evaluate(() => window.transitionsSeen);
  assert.ok(transitionsSeen.includes('map-table') && transitionsSeen.includes('village-arrival'));
  checked.push('normal motion context-specific transitions, keyboard skip, default home probability branch');
  assert.deepEqual(errors, []); assert.deepEqual(failed, []); assert.deepEqual(legacyRequests, [], 'No legacy models loaded by title, home, loading or game');
  checked.push('no legacy GLB requests throughout home, save import and playable demo');
  await writeFile(new URL('results.json', output), JSON.stringify({ result: 'PASS', checked, errors, failed, legacyRequests, first, second, transitionsSeen, gallery: titles }, null, 2));
  console.log(JSON.stringify({ result: 'PASS', checked, errors, failed }, null, 2));
} finally { await browser.close(); }
