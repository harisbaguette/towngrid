// First-session browser audit: title -> new game -> warehouse -> house/well/field/lumber via the tutorial,
// speed 4x, first contract, first promotion, market sale, land expansion, phone layout, save quota.
// Headless only, isolated browser context (the player's own localStorage is untouched).
// Usage: node tests/audit/browser-first-session.mjs <playwright/index.mjs> <chrome.exe>
// Needs a running dev server (TOWNGRID_URL, default http://localhost:5173).
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}), args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
// Other agents edit the working tree while this runs; a dead HMR socket keeps the dev server from reloading this page mid-flow.
await context.addInitScript(() => { window.WebSocket = class { constructor() { this.readyState = 0; } addEventListener() {} removeEventListener() {} send() {} close() {} }; });
const page = await context.newPage();
const origin = process.env.TOWNGRID_URL || 'http://localhost:5173';
const out = new URL('../../docs/verification/audit-20260928/', import.meta.url);
await mkdir(out, { recursive: true });
const errors = [], consoleErrors = [], failed = [], steps = [], findings = {};
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
let navigations = 0; page.on('framenavigated', f => { if (f === page.mainFrame()) navigations++; });
page.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
const shot = async name => { await page.screenshot({ path: fileURLToPath(new URL(name, out)) }); steps.push('screenshot ' + name); };
const sim = (fn, arg) => page.evaluate(fn, arg);
const state = () => sim(() => { const s = window.tgScene?.sim; if (!s) return null; return { t: Math.round(s.time), rank: s.rank, money: Math.round(s.money), contracts: s.contracts, stock: { wood: Math.floor(s.stock.wood), water: Math.floor(s.stock.water), grain: Math.floor(s.stock.grain), stone: Math.floor(s.stock.stone) }, buildings: s.buildings.map(b => b.type + ':' + b.status), workers: s.workers.length, owned: s.owned.size }; });
const visible = async selector => (await page.locator(selector).count()) > 0 && await page.locator(selector).first().isVisible();
async function clickTile(x, z) {
 const p = await page.evaluate(([x, z]) => { const s = window.tgScene, v = s.camera.position.clone().set(x, 0, z); v.project(s.camera); const r = s.renderer.domElement.getBoundingClientRect(); const px = r.left + (v.x + 1) / 2 * r.width, py = r.top + (1 - v.y) / 2 * r.height; const el = document.elementFromPoint(px, py); return { px, py, onCanvas: el === s.renderer.domElement, top: el ? (el.className?.baseVal ?? el.className) + '' : null }; }, [x, z]);
 if (!p.onCanvas) steps.push(`tile ${x},${z} covered by ${p.top}`);
 await page.mouse.move(p.px, p.py); await page.mouse.down(); await page.mouse.up();
 await page.waitForTimeout(250); return p;
}
const waitSim = (fn, arg, timeout = 90000) => page.waitForFunction(fn, arg, { timeout, polling: 250 });

await page.goto(origin);
// The title is server-rendered; a click before hydration is lost, so repeat until the home menu shows.
for (let i = 0; i < 40 && !(await page.getByRole('button', { name: '새 게임' }).count()); i++) { await page.getByRole('button', { name: '화면을 눌러 시작', exact: true }).click().catch(() => {}); await page.waitForTimeout(1500); }
findings.titleClicksUntilHome = steps.length; await page.getByRole('button', { name: '새 게임' }).waitFor({ timeout: 120000 });
// Hook the scene the same way tests/starter-environment-browser.mjs does.
await page.evaluate(async () => {
 const urls = performance.getEntriesByType('resource').map(e => e.name).filter(url => /\/app\/game\/scene\.js(?:\?|$)/.test(url));
 for (const url of new Set([...urls, '/src/app/game/scene.js'])) { try { const { GameScene } = await import(url), original = GameScene.prototype.setSimulation; GameScene.prototype.setSimulation = function (sim) { window.tgScene = this; return original.call(this, sim); }; } catch {} }
});
await shot('01-home.png');
await page.getByRole('button', { name: '새 게임' }).click();
await page.getByRole('button', { name: /이 땅에서 시작/ }).waitFor();
await shot('02-world-map.png');
const t0 = Date.now();
await page.getByRole('button', { name: /이 땅에서 시작/ }).click();
await page.getByRole('button', { name: '일시정지', exact: true }).waitFor({ timeout: 120000 });
await waitSim(() => !!window.tgScene?.sim && window.tgScene.sim.buildings.length === 0 && window.tgScene.mode === 'warehouse');
findings.newGameMs = Date.now() - t0;
findings.initialToast = await page.locator('[data-sonner-toast]').allInnerTexts();
await shot('03-new-game.png');
// Warehouse through the placement mode the game opened for us.
await clickTile(11, 12);
await waitSim(() => window.tgScene.sim.buildings.some(b => b.type === 'warehouse'), null, 10000);
findings.afterWarehouse = { facilityCardOpen: await visible('.facility-card'), tutorialVisible: await visible('.tutorial-card') };
await shot('04-after-warehouse.png');
// Tutorial steps: the card is hidden while the new building's card is open, so close it first when needed.
const tutorialSteps = [['주민 주택', 11, 14], ['우물', 13, 12], ['밀밭', 13, 13], ['벌목장', 9, 10]];
findings.tutorial = [];
for (const [name, x, z] of tutorialSteps) {
 const before = { tutorialVisible: await visible('.tutorial-card'), facilityCardOpen: await visible('.facility-card') };
 if (!before.tutorialVisible && before.facilityCardOpen) { await page.getByRole('button', { name: '시설 정보 닫기' }).click(); }
 const button = page.locator('.tutorial-card button', { hasText: name + ' 선택' });
 const present = await button.count() > 0;
 if (present) await button.click(); else { await page.getByRole('button', { name: '건설 목록 열기' }).click(); }
 await clickTile(x, z);
 const built = await sim(n => window.tgScene.sim.buildings.some(b => b.type === n), { '주민 주택': 'house', '우물': 'well', '밀밭': 'field', '벌목장': 'lumber' }[name]);
 findings.tutorial.push({ step: name, tutorialVisibleBefore: before.tutorialVisible, hadToCloseFacilityCard: !before.tutorialVisible && before.facilityCardOpen, tutorialButtonFound: present, built });
}
if (await visible('.facility-card')) await page.getByRole('button', { name: '시설 정보 닫기' }).click();
await shot('05-five-buildings.png');
findings.afterBuild = await state();
try {
// Speed 4x and play: contract as soon as the tutorial asks for it, then the first promotion.
await page.getByRole('button', { name: '4×' }).click();
await waitSim(() => { const s = window.tgScene.sim, k = s.contract(); return s.availableStock(k.item) >= k.amount; });
findings.contractReadyAt = await state();
const tutorialText = await page.locator('.tutorial-card').allInnerTexts();
findings.contractReadyAt.ui = { tutorialText, tutorialCard: await visible('.tutorial-card'), facilityCard: await visible('.facility-card'), tile: await visible('.tile-panel'), operationsCard: await visible('.operations-card') };
await shot('06a-contract-ready.png');
const goalsButton = page.locator('.tutorial-card button', { hasText: '신분과 권한 열기' });
if (await goalsButton.count()) { await goalsButton.click(); await page.waitForTimeout(500); }
findings.contractReadyAt.tutorialButtonOpenedDialog = await visible('[role=dialog]');
if (!findings.contractReadyAt.tutorialButtonOpenedDialog) await page.getByRole('button', { name: /승급 조건/ }).click();
await page.getByRole('dialog').waitFor();
await shot('06-goals-dialog.png');
await page.getByRole('button', { name: /^납품 \+/ }).click();
findings.contract = { after: await state() };
await page.keyboard.press('Escape');
await waitSim(() => window.tgScene.sim.promotion()?.ready);
await page.getByRole('button', { name: /승급 조건/ }).click();
await page.getByRole('dialog').waitFor();
await page.getByRole('button', { name: /^승급 · / }).click();
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
findings.rank1 = { state: await state(), tutorialCard: await visible('.tutorial-card'), operationsCard: await visible('.operations-card'), promotionReadyChip: await visible('.promotion-ready') };
await shot('07-rank1-hud.png');
// Market: sell wood and watch the cart pay out.
await page.getByRole('button', { name: '시장', exact: true }).click();
await page.getByRole('dialog').waitFor();
findings.market = { exportStatus: await page.locator('.export-status').innerText(), rows: await page.locator('.market-row').count() };
const money0 = await sim(() => window.tgScene.sim.money);
await page.getByRole('button', { name: /^목재 \d+개 판매$/ }).last().click();
await shot('08-market.png');
await page.keyboard.press('Escape');
await waitSim(m => window.tgScene.sim.money > m + 50 || window.tgScene.sim.shipments.length === 0, money0, 30000).catch(() => {});
findings.market.moneyDelta = Math.round(await sim(() => window.tgScene.sim.money) - money0);
// Expansion: click land outside the starting square, then the tile panel's expand button, then the land again.
await clickTile(5, 12);
findings.expand = { tilePanel: await visible('.tile-panel'), expandButton: await page.locator('.tile-panel button', { hasText: '영토 확장' }).count() };
await shot('09-unowned-tile.png');
if (findings.expand.expandButton) { await page.locator('.tile-panel button', { hasText: '영토 확장' }).click(); await clickTile(5, 12); }
findings.expand.ownedAfter = await sim(() => window.tgScene.sim.owned.size);
findings.expand.toasts = await page.locator('[data-sonner-toast]').allInnerTexts();
await page.keyboard.press('Escape');
// Keep playing ~3 game minutes at 4x to reach the first storm and see what the HUD says.
await waitSim(() => window.tgScene.sim.events.length > 0 || window.tgScene.sim.time > 260, null, 120000).catch(() => {});
findings.firstEvent = await sim(() => { const s = window.tgScene.sim; return { t: Math.round(s.time), events: s.events.map(e => e.type), broken: s.buildings.filter(b => b.health <= 0).map(b => b.type), rank: s.rank }; });
findings.firstEvent.bottleneck = await page.locator('.operations-card .bottleneck').allInnerTexts();
findings.firstEvent.healthAlert = await page.locator('.health-alert').allInnerTexts();
await shot('10-after-first-event.png');
// Phone layout.
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(800);
findings.phone = await page.evaluate(() => { const boxes = [...document.querySelectorAll('.panel, .town-actions, .game-header')].filter(e => e.offsetParent).map(e => ({ cls: e.className.split(' ').slice(0, 2).join('.'), r: e.getBoundingClientRect() })); const overlaps = []; for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i].r, b = boxes[j].r; const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (w > 8 && h > 8) overlaps.push(boxes[i].cls + ' x ' + boxes[j].cls + ' ' + Math.round(w) + 'x' + Math.round(h)); } return { overlaps, offscreen: boxes.filter(b => b.r.right > innerWidth + 1 || b.r.left < -1).map(b => b.cls) }; });
await shot('11-phone-hud.png');
await page.setViewportSize({ width: 1440, height: 900 });
// Save quota with a real 24-site campaign written the way persist() writes it (SAVE + RECOVERY + BACKUP).
findings.quota = await page.evaluate(async () => {
 const find = name => [...new Set(performance.getEntriesByType('resource').map(e => e.name).filter(u => u.includes('/app/game/' + name)))][0] || '/src/app/game/' + name;
 const { Campaign } = await import(find('campaign.js')), { createShowcase } = await import(find('simulation.js')), P = await import(find('persistence.js'));
 const c = new Campaign({ demo: true }); while (c.sites.length < 24) { const id = 'site-' + c.nextSite++; c.attach({ id, name: '측정 ' + id, nation: 'estern', territory: false, unrest: 10, sim: createShowcase() }); }
 for (let i = 0; i < 80; i++) c.tick(.25);
 const t = performance.now(); const raw = P.encodeSave(c.save()); const encodeMs = Math.round(performance.now() - t);
 const store = window.localStorage; const keys = [P.SAVE_KEY, P.RECOVERY_KEY, P.BACKUP_KEY]; const result = { chars: raw.length, encodeMs, writes: [] };
 for (const k of keys) store.removeItem(k);
 try { P.writeSave(store, c.save()); result.writes.push('save ok'); c.tick(.25); P.writeSave(store, c.save()); result.writes.push('save+recovery ok'); store.setItem(P.BACKUP_KEY, store.getItem(P.SAVE_KEY)); result.writes.push('backup ok'); } catch (e) { result.writes.push('FAILED: ' + e.name + ' ' + e.message); }
 const t2 = performance.now(); try { P.writeSave(store, c.save()); } catch {} result.persistMs = Math.round(performance.now() - t2);
 for (const k of keys) store.removeItem(k); return result;
});
} catch (e) { findings.abortedAt = e.message.split(String.fromCharCode(10))[0]; await shot('99-aborted.png').catch(() => {}); }
findings.mainFrameNavigations = navigations; findings.errors = errors; findings.consoleErrors = consoleErrors; findings.failedRequests = failed; findings.steps = steps;
await writeFile(new URL('result.json', out), JSON.stringify(findings, null, 1));
console.log(JSON.stringify(findings, null, 1));
await browser.close();
