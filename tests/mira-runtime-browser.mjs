// node tests/mira-runtime-browser.mjs <playwright/index.mjs> <chrome.exe>
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
const out = new URL('../docs/verification/mira-runtime/', import.meta.url);
await mkdir(out, { recursive: true });
try {
 const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = [], failedAssets = [];
 page.on('pageerror', e => errors.push(e.message));
 page.on('response', r => { if (r.status() >= 400 && r.url().includes('/pixel-characters/')) failedAssets.push(r.url()); });
 await page.goto(process.env.TOWNGRID_URL || 'http://localhost:5173');
 // The scene canvas exists after the client and its game assets initialize.
 await page.locator('canvas[role="application"]').waitFor({ state: 'attached', timeout: 120000 });
 await page.getByRole('button', { name: '화면을 눌러 시작', exact: true }).click({ timeout: 120000 });
 await page.getByRole('button', { name: '초반 마을 테스트', exact: true }).waitFor({ timeout: 120000 });
 await page.evaluate(async () => {
  const urls = performance.getEntriesByType('resource').map(e => e.name).filter(url => /\/app\/game\/scene\.js(?:\?|$)/.test(url));
  for (const url of new Set([...urls, '/app/game/scene.js'])) {
   const { GameScene } = await import(url), original = GameScene.prototype.setSimulation;
   GameScene.prototype.setSimulation = function(sim) { window.miraScene = this; return original.call(this, sim); };
  }
 });
 await page.getByRole('button', { name: '초반 마을 테스트', exact: true }).click();
 await page.waitForFunction(() => window.miraScene?.sim.workers.some(w => w.appearance === 'mira'));
 await page.getByRole('button', { name: '일시정지', exact: true }).click();
 const assets = await page.evaluate(async () => {
  const data = await fetch('/assets/pixel-characters/mira/frames.json').then(r => r.json());
  const image = await new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = '/assets/pixel-characters/mira/sprites.png'; });
  const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0); const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
  const alpha = (x, y) => pixels[(y * image.width + x) * 4 + 3];
  const cells = [];
  for (let row = 0; row < 4; row++) for (let column = 0; column < 13; column++) {
   let opaque = 0, border = 0, minY = 128, maxY = 0;
   for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) if (alpha(column * 128 + x, row * 128 + y)) {
    opaque++; minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    if (x === 0 || x === 127 || y === 0 || y === 127) border++;
   }
   cells.push({ row, column, opaque, border, minY, maxY });
  }
  const s = window.miraScene;
  return { width: image.width, height: image.height, revision: data.revision, clips: data.clips, cells, residents: s.sim.workers.map(w => ({ id: w.id, appearance: w.appearance, columns: s.workerModels.get(w.id)?.userData.atlas.columns })) };
 });
 assert.equal(assets.width, 1664); assert.equal(assets.height, 512);
 assert.ok(assets.cells.every(c => c.opaque > 600 && c.opaque < 10000 && c.border === 0));
 assert.ok(assets.cells.filter(c => c.column < 9).every(c => c.maxY >= 111 && c.maxY <= 117), 'new poses share foot baseline');
 assert.ok(assets.residents.filter(w => w.appearance === 'mira').every(w => w.columns === 13));
 assert.ok(assets.residents.filter(w => w.appearance !== 'mira').every(w => w.columns === 8));
 const views = [];
 for (let view = 0; view < 4; view++) {
  await page.waitForTimeout(60);
  views.push(await page.evaluate(() => {
   const s = window.miraScene; return { view: s.viewIndex, models: [...s.workerModels.values()].filter(m => m.userData.appearance === 'mira').map(m => ({ row: m.userData.atlas.row, columns: m.userData.atlas.columns, frame: m.userData.frame, center: m.userData.sprite.center.toArray() })) };
  }));
  await page.screenshot({ path: fileURLToPath(new URL(`game-quarter-${view}.png`, out)) });
  await page.getByRole('button', { name: '오른쪽 90도 회전', exact: true }).click();
 }
 assert.equal(new Set(views.flatMap(v => v.models.map(m => m.row))).size, 4);
 // Actual, unforced logistics: observe empty walking and loaded cargo in the village.
 const activity = await page.evaluate(async () => {
  const scene = window.miraScene, sim = scene.sim, start = sim.time, frames = new Set(), actions = new Set();
  const delivered = sim.logisticsStats.delivered;
  sim.paused = false; sim.speed = 1;
  while (sim.time - start < 16) {
   await new Promise(requestAnimationFrame);
   for (const w of sim.workers.filter(w => w.appearance === 'mira')) {
    const m = scene.workerModels.get(w.id); actions.add(m.userData.current);
    if (m.userData.current === 'walk') frames.add(m.userData.frame);
   }
  }
  sim.paused = true;
  return { frames: [...frames].sort((a,b) => a-b), actions: [...actions], delivered: sim.logisticsStats.delivered - delivered };
 });
 assert.deepEqual(activity.frames, [1,2,3,4,5,6,7,8]);
 assert.ok(activity.actions.includes('carry')); assert.ok(activity.delivered > 0);
 await page.getByRole('button', { name: '주민', exact: true }).click();
 await page.locator('.resident-choice').filter({ hasText: /^미라/ }).first().click();
 const sprite = page.locator('.resident-preview');
 assert.equal(await sprite.getAttribute('data-character'), 'mira');
 assert.equal(await sprite.evaluate(e => e.style.backgroundSize), '1300% 400%');
 const portrait = await page.locator('.resident-illustration').evaluate(e => ({ width: e.naturalWidth, height: e.naturalHeight }));
 assert.deepEqual(portrait, { width: 384, height: 612 });
 const uiClips = [];
 for (const [action, name] of [['idle','대기'],['walk','걷기'],['carry','운반'],['work','작업'],['attack','공격']]) {
  await page.locator('.resident-actions').getByRole('button', { name, exact: true }).click();
  const keyframes = await sprite.evaluate(e => e.getAnimations()[0]?.effect.getKeyframes().map(k => k.backgroundPosition));
  assert.ok(keyframes?.length > 1, `${action}: metadata animation exists`);
  uiClips.push({ action, keyframes });
 }
 await page.locator('.resident-actions').getByRole('button', { name: '걷기', exact: true }).click();
 for (const name of ['왼쪽 앞','왼쪽 뒤','오른쪽 뒤','오른쪽 앞']) {
  await page.locator('.resident-directions').getByRole('button', { name, exact: true }).click();
  assert.equal(await sprite.evaluate(e => e.getAnimations()[0].effect.getKeyframes().length), 9);
 }
 await page.screenshot({ path: fileURLToPath(new URL('resident-mira.png', out)) });
 await page.locator('.resident-choice').filter({ hasText: /^로웬/ }).first().click();
 assert.equal(await sprite.evaluate(e => e.style.backgroundSize), '800% 400%');
 await page.locator('.resident-choice').filter({ hasText: /^미라/ }).first().click();
 await page.setViewportSize({ width: 390, height: 844 });
 await page.screenshot({ path: fileURLToPath(new URL('mobile-mira.png', out)), fullPage: true });
 assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
 assert.deepEqual(errors, []); assert.deepEqual(failedAssets, []);
 await writeFile(new URL('browser-check.json', out), JSON.stringify({ assets, views, activity, portrait, uiClips, mobileOverflow: false, errors, failedAssets }, null, 2));
 console.log(JSON.stringify({ atlas: '1664x512 RGBA', newFrames: 36, legacyActionFrames: 16, views: 4, activity, portrait, uiClips: uiClips.length, errors, failedAssets }));
} finally { await browser.close(); }
