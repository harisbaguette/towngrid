// Checks the real screen components without loading the settlement renderer.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WORK_ART, TRANSITION_ART, HOME_ART_KEY } from '../src/app/game/screen-art.js';
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}), args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const output = process.env.TG_OUT ? pathToFileURL(process.env.TG_OUT.replace(/\\/g, '/') + '/') : new URL('../docs/verification/daily-screens/', import.meta.url);
await page.addInitScript(() => { window.WebSocket = class { addEventListener() {} removeEventListener() {} send() {} close() {} }; });
await mkdir(output, { recursive: true });
const errors = [], failed = [], requests = [], checked = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (request.url().includes('/assets/screens/')) requests.push(request.url()); });
page.on('response', response => { if (response.url().includes('/assets/screens/') && response.status() >= 400) failed.push(response.url()); });
const decoded = () => page.waitForFunction(() => [...document.querySelectorAll('.front-screen img:not([loading="lazy"])')].every(img => img.complete && img.naturalWidth > 0 && !img.dataset.fallback));
const shot = async name => { await decoded();await page.screenshot({ path: fileURLToPath(new URL(name, output)) }); };
const toolbar = () => page.getByRole('navigation', { name: '화면 미리보기', exact: true });
const forceHome = async (id, chance = 0) => {
  await page.evaluate(({ id, chance, ids, key }) => {
    localStorage.setItem(key, JSON.stringify({ catalog: ids.join('|'), queue: [id, ...ids.filter(value => value !== id)], last: null }));
    window.originalRandom = Math.random;Math.random = () => chance;
  }, { id, chance, ids: WORK_ART.map(art => art.id), key: HOME_ART_KEY });
  await toolbar().getByRole('button', { name: '홈 화면', exact: true }).click();
  await page.locator('.home-screen').waitFor();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
};
const restoreRandom = () => page.evaluate(() => { Math.random = window.originalRandom; });
try {
  await page.goto((process.env.TOWNGRID_URL || 'http://localhost:5173') + '/screen-preview/');
  await page.locator('.art-gallery').waitFor();
  await page.waitForFunction(() => Object.keys(document.querySelector('.gallery-controls button') || {}).some(key => key.startsWith('__reactProps$')));
  await decoded();
  assert.ok(requests.filter(url => /(?:pixel-v2|daily-v3)\/.+\.webp/.test(url) && !url.includes('-thumb')).length < 10, 'Do not fetch every full illustration');
  await page.evaluate(() => localStorage.setItem('existing-game-save', 'untouched'));
  const titles = [];
  for (let i = 0; i < WORK_ART.length; i++) {
    await decoded();titles.push(await page.locator('.gallery-controls strong').innerText());
    await page.getByRole('button', { name: '다음 그림', exact: true }).click();
    await page.waitForFunction(title => document.querySelector('.gallery-controls strong')?.textContent !== title, titles.at(-1));
  }
  assert.equal(new Set(titles).size, WORK_ART.length);
  for (const category of ['생활', '자연', '산업']) {
    await page.getByRole('button', { name: new RegExp('^' + category) }).click();
    assert.equal(await page.locator('.gallery-thumbnails button').count(), WORK_ART.filter(art => art.category === category).length);
  }
  await page.getByRole('button', { name: /^화면 전환/ }).click();
  for (const art of TRANSITION_ART) {
    await page.getByRole('button', { name: art.title + ' 보기', exact: true }).click();await decoded();
    assert.equal(await page.locator('.gallery-controls strong').innerText(), art.title);
  }
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('.gallery-controls strong').innerText(), TRANSITION_ART[0].title);
  await shot('transitions-desktop.png');
  checked.push('24 daily and 4 transition images decoded; category filters, thumbnails and keyboard navigation');

  await forceHome('dawn-bakery');
  await page.locator('.home-screen[data-art="dawn-bakery"]').waitFor();await restoreRandom();
  await shot('home-daily-desktop.png');
  await page.getByRole('button', { name: '소리 켜기', exact: true }).click();
  assert.equal(await page.locator('.home-screen').getAttribute('data-art'), 'dawn-bakery');
  await page.locator('.home-art-caption').click();
  assert.equal(await page.locator('.gallery-controls strong').innerText(), WORK_ART.find(art => art.id === 'dawn-bakery').title);
  await forceHome('dawn-bakery', .99);await restoreRandom();
  assert.equal(await page.locator('.home-screen').getAttribute('data-art'), 'town');
  checked.push('random home shown, stable across rerenders, caption opens matching artwork, default-home probability branch');

  await toolbar().getByRole('button', { name: '로딩 화면', exact: true }).click();
  assert.equal(await page.locator('.screen-loading').getAttribute('data-art'), 'records-room');
  await shot('loading-records.png');
  await page.waitForFunction(() => document.querySelector('.screen-loading')?.dataset.art !== 'records-room', null, { timeout: 14000 });
  const nextId = await page.locator('.screen-loading').getAttribute('data-art');
  assert.ok(WORK_ART.some(art => art.id === nextId));
  await decoded();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await toolbar().getByRole('button', { name: '전환 그림', exact: true }).click();
  await page.locator('.screen-transition').waitFor();
  assert.equal(await page.locator('.screen-transition').getAttribute('data-art'), 'map-table');
  await page.keyboard.press('Enter');await page.locator('.art-gallery').waitFor();
  await toolbar().getByRole('button', { name: '전환 그림', exact: true }).click();
  await page.locator('.art-gallery').waitFor({ timeout: 3000 });
  checked.push('actual loading component rotates after 8 seconds; transition automatically finishes and supports keyboard skip');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '보리크와 오리엘의 유리 공방 보기', exact: true }).click();
  await shot('gallery-mobile.png');
  assert.equal(await page.locator('.gallery-controls').evaluate(el => el.scrollWidth <= el.clientWidth), true);
  await page.setViewportSize({ width: 844, height: 390 });await shot('gallery-landscape.png');
  assert.ok(await page.locator('.gallery-stage').evaluate(el => el.clientHeight > 80));
  await page.setViewportSize({ width: 390, height: 844 });
  await forceHome('dawn-bakery');await page.locator('.home-screen[data-art="dawn-bakery"]').waitFor();await restoreRandom();
  await shot('home-daily-mobile.png');
  checked.push('390px portrait and 844x390 landscape, full-image gallery, long titles without overflow');

  await toolbar().getByRole('button', { name: '일상 그림', exact: true }).click();
  await page.route('**/daily-v3/oasis-market.webp', route => route.abort());
  await forceHome('oasis-market');await restoreRandom();
  await page.waitForTimeout(1700);
  assert.equal(await page.locator('.home-screen').getAttribute('data-art'), 'town');
  await decoded();
  assert.equal(await page.evaluate(() => localStorage.getItem('existing-game-save')), 'untouched');
  checked.push('failed random artwork keeps the default home; existing save untouched');
  assert.deepEqual(errors, []);assert.deepEqual(failed, []);
  const result = { result: 'PASS', scope: 'Screen components; no settlement renderer or production simulation', checked, titles, errors, failed };
  await writeFile(new URL('results.json', output), JSON.stringify(result, null, 2));console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
