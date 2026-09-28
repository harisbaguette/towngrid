// Usage: node tests/starter-environment-browser.mjs <playwright/index.mjs> <chrome.exe>
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}), args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage(), errors = [], failedAssets = [];
page.setDefaultTimeout(45000);
page.on('pageerror', e => errors.push(e.message));
page.on('response', r => { if (r.url().includes('/assets/pixel-environment/') && r.status() >= 400) failedAssets.push(r.url()); });
const output = new URL('../docs/verification/starter-environment/', import.meta.url);
await mkdir(output, { recursive: true });
const screenshot = name => page.screenshot({ path: fileURLToPath(new URL(name, output)), fullPage: true });
const origin = process.env.TOWNGRID_URL || 'http://localhost:5173';
try {
 await page.goto(origin);
 await page.locator('canvas[role="application"]').waitFor({state:"attached",timeout:120000});
 await page.getByRole('button', { name: '화면을 눌러 시작', exact: true }).click();
 await page.getByRole('button', { name: '초반 마을 테스트', exact: true }).waitFor({ timeout: 120000 });
 // Only this new, disposable browser context is seeded. User storage is untouched.
 const saved = await page.evaluate(async () => {
  const [{ Campaign }, { encodeSave, SAVE_KEY, RECOVERY_KEY, BACKUP_KEY }] = await Promise.all([import('/src/app/game/campaign.js'), import('/src/app/game/persistence.js')]);
  const campaign = new Campaign();campaign.active.money = 1234;
  const raw = encodeSave(campaign.save()), snapshot = {};
  for (const key of [SAVE_KEY, RECOVERY_KEY, BACKUP_KEY]) { localStorage.setItem(key, raw);snapshot[key] = raw; }
  return snapshot;
 });
 await page.reload();
 await page.locator('canvas[role="application"]').waitFor({state:"attached",timeout:120000});
 await page.getByRole('button', { name: '화면을 눌러 시작', exact: true }).click();
 await page.getByRole('button', { name: '초반 마을 테스트', exact: true }).waitFor({ timeout: 120000 });
 await screenshot('start-screen.png');
 // Capture the real scene through its existing entry point in the test browser.
 await page.evaluate(async () => {
  const urls = performance.getEntriesByType('resource').map(e => e.name).filter(url => /\/app\/game\/scene\.js(?:\?|$)/.test(url));
  for (const url of new Set([...urls, '/src/app/game/scene.js'])) {
   const { GameScene } = await import(url), original = GameScene.prototype.setSimulation;
   GameScene.prototype.setSimulation = function (sim) { window.starterScene = this;return original.call(this, sim); };
  }
 });
 await page.getByRole('button', { name: '초반 마을 테스트', exact: true }).click();
 await page.getByRole('button', { name: '일시정지', exact: true }).waitFor({ timeout: 120000 });
 await page.waitForFunction(() => window.starterScene?.sim.time > 2);
 await page.getByRole('button', { name: '일시정지', exact: true }).click();
 const initial = await page.evaluate(() => {
  const game = window.starterScene;
  return { buildings: game.sim.buildings.length, residents: game.sim.workers.length, types: [...new Set(game.sim.buildings.map(b => b.type))], sprites: [...game.models.values()].every(m => m.userData.pixelEnvironment), time: game.sim.time };
 });
 assert.equal(initial.buildings, 9);assert.equal(initial.residents, 6);assert.equal(initial.sprites, true);
 const views = [];
 for (let view = 0; view < 4; view++) {
  await page.waitForFunction(view => window.starterScene.viewIndex === view, view);
  views.push(await page.evaluate(() => [...window.starterScene.models.values()].map(m => m.userData.direction)));
  assert.ok(views[view].every(row => row === view));
  await screenshot(`village-quarter-${view}.png`);
  await page.getByRole('button', { name: '오른쪽 90도 회전', exact: true }).click();
 }
 // Click the well's visible centre through normal pointer input, then use its UI.
 const wellPoint = await page.evaluate(() => {
  const game = window.starterScene, well = game.sim.buildings.find(b => b.type === 'well');
  game.focusBuilding(well.id);game.scene.updateMatrixWorld(true);game.camera.updateMatrixWorld();
  const model = game.models.get(well.id), u = model.userData, sprite = u.sprite;
  const canvas = document.createElement('canvas');canvas.width = canvas.height = 192;
  const ctx = canvas.getContext('2d');ctx.drawImage(u.image, u.frame * 192, u.direction * 192, 192, 192, 0, 0, 192, 192);
  const pixels = ctx.getImageData(0, 0, 192, 192).data;let pick = null, distance = Infinity;
  for (let y = 15; y < 165; y++) for (let x = 15; x < 177; x++) {
   const d = (x - 96) ** 2 + (y - 100) ** 2;
   if (pixels[(y * 192 + x) * 4 + 3] > 200 && d < distance) { pick = { x: x + .5, y: y + .5 };distance = d; }
  }
  const p = sprite.getWorldPosition(model.position.clone()), scale = sprite.getWorldScale(model.position.clone());
  const right = p.clone().setFromMatrixColumn(game.camera.matrixWorld, 0), up = p.clone().setFromMatrixColumn(game.camera.matrixWorld, 1);
  p.addScaledVector(right, (pick.x / 192 - sprite.center.x) * scale.x).addScaledVector(up, (1 - pick.y / 192 - sprite.center.y) * scale.y).project(game.camera);
  const r = game.renderer.domElement.getBoundingClientRect();
  return { x: r.x + (p.x + 1) * r.width / 2, y: r.y + (1 - p.y) * r.height / 2 };
 });
 await page.mouse.click(wellPoint.x, wellPoint.y);
 const facility = page.getByRole('complementary', { name: '우물 운영', exact: true });
 await facility.waitFor();
 await facility.getByRole('button', { name: '가동 중지', exact: true }).click();
 await page.waitForFunction(() => { const g = window.starterScene, b = g.sim.buildings.find(b => b.type === 'well');return !b.enabled && g.models.get(b.id).userData.frame === 0; });
 await screenshot('well-stopped.png');
 await facility.getByRole('button', { name: '가동', exact: true }).click();
 await page.getByRole('button', { name: '재개', exact: true }).click();
 await page.waitForFunction(() => { const g = window.starterScene, b = g.sim.buildings.find(b => b.type === 'well');return b.working && g.models.get(b.id).userData.production.working; });
 await page.getByRole('button', { name: '일시정지', exact: true }).click();
 await page.keyboard.press('Escape');
 const runtime = await page.evaluate(async () => {
  const game = window.starterScene, rows = [], ghosts = [];
  const types = ['warehouse', 'house', 'well', 'field', 'lumber', 'sawmill'];
  const before = JSON.stringify(game.sim.save());
  for (let view = 0; view < 4; view++) {
   game.setQuarterView(view);
   for (const type of types) { game.setMode(type);ghosts.push({ type, view, row: game.ghost.userData.direction, sprite: game.ghost.children[0].isSprite }); }
  }
  game.setMode(null);game.resetCamera();game.zoom(1.45);
  const renderingPreservesSave = before === JSON.stringify(game.sim.save());
  // Advance the real campaign to demonstrate completed production and deliveries.
  game.sim.paused = false;
  for (let i = 0; i < 1200; i++) game.sim.campaign.tick(.1);
  game.sim.paused = true;game.rebuild();game.setQuarterView(0);
  for (const b of game.sim.buildings) rows.push({ type: b.type, frame: game.models.get(b.id).userData.frame });
  const { SoftwareRenderer } = await import('/src/app/game/software-renderer.js');
  const software = new SoftwareRenderer({ alpha: true });software.setSize(1440, 1000);
  software.render(game.scene, game.camera);const softwarePng = software.domElement.toDataURL();software.dispose();
  return { ghosts, rows, renderingPreservesSave, produced: game.sim.produced, deliveries: game.sim.logisticsStats.delivered, softwarePng };
 });
 assert.ok(runtime.ghosts.every(g => g.row === g.view && g.sprite));assert.equal(runtime.renderingPreservesSave, true);
 for (const resource of ['water', 'grain', 'wood', 'plank']) assert.ok(runtime.produced[resource] > 0);
 assert.ok(runtime.deliveries > 0);
 await page.waitForFunction(() => {
  const badges=[...document.querySelectorAll('.facility-marker.production')];
  return badges.length===5&&badges.every(el=>{
   const b=window.starterScene.sim.buildings.find(b=>String(b.id)===el.dataset.buildingId);
   return Number(el.dataset.output)===b.out&&getComputedStyle(el.querySelector('span')).display!=='none';
  });
 });
 await writeFile(new URL('village-software.png', output), Buffer.from(runtime.softwarePng.split(',')[1], 'base64'));delete runtime.softwarePng;
 await screenshot('village-produced.png');
 await page.getByRole('button', { name: '게임 설정', exact: true }).click();
 assert.equal(await page.getByRole('button', { name: '지금 저장', exact: true }).isDisabled(), true);
 await page.keyboard.press('Escape');
 await page.setViewportSize({ width: 390, height: 844 });
 await page.getByRole('button', { name: '오른쪽 90도 회전', exact: true }).click();
 assert.equal(await page.locator('canvas[role="application"]').getAttribute('data-camera-quarter'), '1');
 await screenshot('village-mobile.png');
 // Allow at least one automatic save interval, then verify all existing keys.
 await page.waitForTimeout(6100);
 const retained = await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(saved));
 assert.deepEqual(retained, saved);
 await page.getByRole('button', { name: '게임 설정', exact: true }).click();
 await page.getByRole('button', { name: '시작 화면으로', exact: true }).click();
 await page.getByRole('button', { name: '초반 마을 테스트', exact: true }).waitFor();
 assert.deepEqual(errors, []);assert.deepEqual(failedAssets, []);
 await writeFile(new URL('browser-results.json', output), JSON.stringify({ passed: true, initial, views, runtime, existingSavePreserved: true, errors, failedAssets }, null, 2));
 console.log('Starter village browser checks passed: real UI, four views, well operation, six sprite ghosts, production, hauling, software render, mobile, existing saves preserved.');
} catch (error) {
 await screenshot('failure.png');
 console.error({ errors, failedAssets, scene: await page.evaluate(() => ({ captured: !!window.starterScene, time: window.starterScene?.sim.time, paused: window.starterScene?.sim.paused, sceneUrls: performance.getEntriesByType('resource').map(e => e.name).filter(url => /\/scene/.test(url)) })) });
 throw error;
} finally { await browser.close(); }
