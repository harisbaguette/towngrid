// Uses an existing Playwright/browser installation; no new project dependency.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}), args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const page = await context.newPage(), errors = [], failed = [], checked = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.url().includes('/assets/screens/') && response.status() >= 400) failed.push(response.url()); });
const output = new URL('../docs/verification/start-screens/', import.meta.url);
await mkdir(output, { recursive: true });
const origin = process.env.TOWNGRID_URL || 'http://localhost:5173';
const screenshot = async name => { await page.waitForFunction(() => [...document.querySelectorAll('.front-screen img')].every(image => image.complete && image.naturalWidth > 0)); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); await page.screenshot({ path: fileURLToPath(new URL(name, output)) }); };
const enterHome = async () => { await page.getByRole('button', { name: '화면을 눌러 시작', exact: true }).click(); await page.getByRole('button', { name: '새 게임', exact: true }).waitFor({ timeout: 120000 }); };
try {
  await page.goto(origin);
  await page.getByRole('button', { name: '화면을 눌러 시작', exact: true }).waitFor();
  await screenshot('01-title-desktop.png');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '새 게임', exact: true }).waitFor({ timeout: 120000 });
  assert.equal(await page.getByRole('button', { name: '이어하기', exact: true }).isDisabled(), true);
  await screenshot('02-home-desktop.png');
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  assert.equal(await page.getByRole('button', { name: '지금 저장', exact: true }).count(), 0);
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '마을의 하루', exact: true }).click();
  const titles = [];
  for (let i = 0; i < 6; i++) { titles.push(await page.locator('.gallery-controls strong').innerText()); await screenshot(`art-${i + 1}.png`); await page.getByRole('button', { name: '다음 그림', exact: true }).click(); }
  assert.equal(new Set(titles).size, 6);
  await page.getByRole('button', { name: '홈으로', exact: true }).click();
  await page.getByRole('button', { name: '새 게임', exact: true }).click();
  await page.locator('.world-map-screen').waitFor();
  await page.getByRole('button', { name: '홈으로', exact: true }).click();
  checked.push('title keyboard entry, no-save continue disabled, home/settings/world navigation, six illustration gallery');

  // Hold a real, previously unloaded elf image only in this disposable test context.
  const raw = await page.evaluate(async () => {
    const [{ Campaign }, { encodeSave }] = await Promise.all([import('/app/game/campaign.js'), import('/app/game/persistence.js')]);
    return encodeSave(new Campaign({ race: 'elf' }).save());
  });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/assets/pixel-characters/ael/sprites.png', async route => { await gate; await route.continue(); });
  await page.getByLabel('저장 파일 불러오기').setInputFiles({ name: 'elf-test.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
  await page.locator('.screen-loading[data-art]:not([data-art="town"])').waitFor();
  const first = await page.locator('.screen-loading').getAttribute('data-art');
  await screenshot('03-character-loading.png');
  await page.waitForFunction(id => document.querySelector('.screen-loading')?.dataset.art !== id, first, { timeout: 14000 });
  const second = await page.locator('.screen-loading').getAttribute('data-art');
  assert.notEqual(first, second);
  release();
  await page.locator('.screen-loading').waitFor({ state: 'detached', timeout: 120000 });
  await page.getByRole('button', { name: '게임 설정', exact: true }).click();
  await page.getByRole('button', { name: '시작 화면으로', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: '이어하기', exact: true }).isEnabled(), true);
  const preserved = await page.evaluate(async () => { const { SAVE_KEY } = await import('/app/game/persistence.js'); return localStorage.getItem(SAVE_KEY); });
  await page.getByRole('button', { name: '초반 마을 테스트', exact: true }).click();
  await page.getByRole('button', { name: '오른쪽 90도 회전', exact: true }).waitFor();
  await page.getByRole('button', { name: '시작 화면', exact: true }).click();
  assert.equal(await page.evaluate(async () => { const { SAVE_KEY } = await import('/app/game/persistence.js'); return localStorage.getItem(SAVE_KEY); }), preserved);
  const sequence = await page.evaluate(async () => {
    const { createArtworkPicker } = await import('/app/game/screen-art.js');
    const pick = createArtworkPicker(localStorage); return [pick().id, pick().id];
  });
  assert.notEqual(sequence[0], sequence[1]);
  checked.push('actual save import, long-load artwork advances, immediate completion, playable demo, saved game preserved');

  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot('04-home-mobile.png');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByRole('button', { name: '마을의 하루', exact: true }).click();
  await screenshot('05-art-mobile.png');
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
  assert.deepEqual(errors, []); assert.deepEqual(failed, []);
  await writeFile(new URL('results.json', output), JSON.stringify({ result: 'PASS', checked, errors, failed, first, second, gallery: titles }, null, 2));
  console.log(JSON.stringify({ result: 'PASS', checked, errors, failed }, null, 2));
} finally { await browser.close(); }
