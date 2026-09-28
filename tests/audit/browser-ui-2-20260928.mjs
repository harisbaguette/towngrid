// UI pass 2 (2026-09-28) browser check: first session -> next-build line after the first promotion, product picker,
// contract shipment button, export fleet line, continue keeps a paused game paused, phone build menu vs camera buttons.
// Headless, isolated browser contexts (the player's own localStorage is never touched).
// Rank/money/stock are set directly after the real first session to reach later stages (listed in stateOverrides).
// Usage: node tests/audit/browser-ui-2-20260928.mjs <playwright/index.mjs> <chrome.exe> [output dir]
// Needs a running dev server (TOWNGRID_URL, default http://localhost:5173).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const outDir = process.argv[4] || 'docs/verification/ui-2-20260928';
await mkdir(outDir, { recursive: true });
const origin = process.env.TOWNGRID_URL || 'http://localhost:5173';
const only = process.env.TG_STAGE ? process.env.TG_STAGE.split(',') : null;
const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}), args: ['--enable-unsafe-swiftshader'] });
const R = { stateOverrides: [], errors: [], consoleErrors: [], failedRequests: [], stages: {} };
const log = s => console.log('[step]', s);

async function open(viewport) {
 const context = await browser.newContext({ viewport });
 // Other agents edit the tree while this runs; a dead HMR socket keeps the dev server from reloading the page mid-flow.
 await context.addInitScript(() => { window.WebSocket = class { constructor() { this.readyState = 0; } addEventListener() {} removeEventListener() {} send() {} close() {} }; });
 const page = await context.newPage(), tag = viewport.width + 'x' + viewport.height;
 page.on('pageerror', e => R.errors.push(tag + ': ' + e.message));
 page.on('console', m => { if (m.type() === 'error') R.consoleErrors.push(tag + ': ' + m.text().slice(0, 300)); });
 page.on('response', r => { if (r.status() >= 400) R.failedRequests.push(tag + ': ' + r.status() + ' ' + r.url()); });
 return page;
}
const shot = (page, name) => page.screenshot({ path: join(outDir, name) });
const sim = (page, fn, arg) => page.evaluate(fn, arg);
const waitSim = (page, fn, arg, timeout = 60000) => page.waitForFunction(fn, arg, { timeout, polling: 200 });
const visible = async (page, sel) => (await page.locator(sel).count()) > 0 && await page.locator(sel).first().isVisible();
async function toHome(page) {
 await page.goto(origin);
 for (let i = 0; i < 40 && !(await page.getByRole('button', { name: '새 게임' }).count()); i++) { await page.getByRole('button', { name: '화면을 눌러 시작', exact: true }).click().catch(() => {}); await page.waitForTimeout(1200); }
 await page.getByRole('button', { name: '새 게임' }).waitFor({ timeout: 120000 });
 await page.evaluate(async () => {
  const urls = performance.getEntriesByType('resource').map(e => e.name).filter(url => /\/app\/game\/scene\.js(?:\?|$)/.test(url));
  for (const url of new Set([...urls, '/src/app/game/scene.js'])) { try { const { GameScene } = await import(url); if (GameScene.prototype.__tgHooked) continue; const original = GameScene.prototype.setSimulation; GameScene.prototype.setSimulation = function (s) { window.tgScene = this; return original.call(this, s); }; GameScene.prototype.__tgHooked = true; } catch {} }
 });
}
async function newGame(page) {
 await page.getByRole('button', { name: '새 게임' }).click();
 await page.getByRole('button', { name: /이 땅에서 시작/ }).click();
 await waitSim(page, () => !!window.tgScene?.sim && window.tgScene.sim.buildings.length === 0 && window.tgScene.mode === 'warehouse', null, 120000);
}
async function clickTile(page, x, z) {
 await page.evaluate(([x, z]) => { const s = window.tgScene; s.controls.target.set(x, 0, z); s.setQuarterView(s.viewIndex); }, [x, z]);
 await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
 const p = await page.evaluate(([x, z]) => { const s = window.tgScene, v = s.camera.position.clone().set(x, 0, z); v.project(s.camera); const r = s.renderer.domElement.getBoundingClientRect(); return { px: r.left + (v.x + 1) / 2 * r.width, py: r.top + (1 - v.y) / 2 * r.height }; }, [x, z]);
 await page.mouse.move(p.px, p.py); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(200);
}
// Set state directly (recorded) and repaint through a harmless speed click.
async function override(page, label, fn, arg) { R.stateOverrides.push(label); await sim(page, fn, arg); await page.getByRole('button', { name: '1×' }).click(); await page.waitForTimeout(150); }
async function closeCards(page) { for (let i = 0; i < 3; i++) { if (await visible(page, '[role=dialog]')) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); continue; } const c = page.getByRole('button', { name: '시설 정보 닫기' }); if (await c.count() && await c.first().isVisible()) { await c.first().click(); await page.waitForTimeout(120); continue; } break; } }
const hit = page => page.evaluate(() => [...document.querySelectorAll('.camera-controls button')].map(b => { const r = b.getBoundingClientRect(), top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2), d = document.querySelector('.build-dock')?.getBoundingClientRect(); return { label: b.getAttribute('aria-label'), rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], reachable: !!top && b.contains(top), dockOverlapPx: d ? Math.max(0, Math.min(r.bottom, d.bottom) - Math.max(r.top, d.top)) * (r.right > d.left && r.left < d.right ? 1 : 0) : 0, coveredBy: top && !b.contains(top) ? String(top.className?.baseVal ?? top.className).slice(0, 50) : null }; }));

// Stage 1 (desktop): real first session with the guide, then the next-build line after the first promotion.
async function firstSession(page) {
 const S = R.stages.firstSession = {};
 await clickTile(page, 11, 12);
 await waitSim(page, () => window.tgScene.sim.buildings.some(b => b.type === 'warehouse'), null, 10000);
 for (const [name, x, z] of [['주민 주택', 11, 14], ['우물', 13, 12], ['밀밭', 13, 13], ['벌목장', 9, 10]]) {
  await closeCards(page);
  const button = page.locator('.tutorial-card button', { hasText: name + ' 선택' });
  await button.click({ timeout: 8000 });
  await clickTile(page, x, z);
  await page.keyboard.press('Escape');
 }
 S.buildings = await sim(page, () => window.tgScene.sim.buildings.map(b => b.type));
 S.tutorialAtRank0 = await page.locator('.tutorial-card strong').first().innerText().catch(() => null);
 S.nextBuildAtRank0 = await visible(page, '.next-build');
 await shot(page, '01-first-session-guide.png');
 await override(page, 'rank=1 (first promotion)', () => { window.tgScene.sim.rank = 1; });
 S.tutorialAfterPromotion = await visible(page, '.tutorial-card');
 S.nextBuild = await page.locator('.next-build').innerText().catch(() => null);
 await shot(page, '02-next-build-after-promotion.png');
 await page.locator('.next-build').click();
 S.toolAfterClick = await sim(page, () => window.tgScene.mode);
 S.placementHint = await page.locator('.placement-hint strong').innerText().catch(() => null);
 await shot(page, '03-next-build-picks-tool.png');
 await page.keyboard.press('Escape');
}

// Stage 2 (desktop): product picker on a bakery (bread <-> cake), locked before rank 7, switchable after.
async function productPicker(page) {
 const S = R.stages.productPicker = {};
 await override(page, 'rank=6, money 5000, wood/stone/plank 99', () => { const s = window.tgScene.sim; s.rank = 6; s.money = 5000; for (const r of ['wood', 'stone', 'plank']) s.stock[r] = 99; });
 const id = await sim(page, () => { const r = window.tgScene.sim.build('bakery', 12, 10); return r.id; });
 R.stateOverrides.push('bakery built through sim.build at 12,10');
 await page.getByRole('button', { name: '1×' }).click();
 await page.locator(`[data-building-id="${id}"]`).click();
 await page.locator('.recipe-picker').waitFor({ timeout: 5000 });
 S.locked = await page.locator('.recipe-picker button').evaluateAll(bs => bs.map(b => ({ text: b.innerText.replace(/\s+/g, ' '), disabled: b.disabled, pressed: b.getAttribute('aria-pressed') })));
 await shot(page, '04-product-picker-locked.png');
 await override(page, 'rank=7', () => { window.tgScene.sim.rank = 7; });
 S.unlocked = await page.locator('.recipe-picker button').evaluateAll(bs => bs.map(b => ({ text: b.innerText.replace(/\s+/g, ' '), disabled: b.disabled, pressed: b.getAttribute('aria-pressed') })));
 await page.locator('.recipe-picker button').nth(1).click();
 await page.waitForTimeout(200);
 S.afterSwitch = await sim(page, bid => { const s = window.tgScene.sim, b = s.buildings.find(v => v.id === bid); return { recipe: b.recipe, recipeOf: s.recipeOf?.(b)?.id, inputs: s.effectiveInputs(b) }; }, id);
 S.cardRecipe = await page.locator('.facility-card .recipe').innerText().catch(() => null);
 S.pressed = await page.locator('.recipe-picker button[aria-pressed=true]').innerText().catch(() => null);
 await shot(page, '05-product-picker-switched.png');
 await closeCards(page);
}

// Stage 3 (desktop): contract goes out on an export cart: button shows 운송 중, then the next order's wait.
async function contractFlow(page) {
 const S = R.stages.contract = {};
 S.api = await sim(page, () => typeof window.tgScene.sim.contractStatus === 'function');
 if (!S.api) { S.skipped = 'sim.contractStatus missing'; return; }
 await override(page, 'contract item stock = amount + 4', () => { const s = window.tgScene.sim, c = s.contract(); s.stock[c.item] = (s.stock[c.item] || 0) + c.amount + 4; });
 const button = page.locator('.quick-contract button');
 S.before = { label: await button.innerText(), disabled: await button.isDisabled(), status: await sim(page, () => window.tgScene.sim.contractStatus()) };
 await button.click();
 await page.waitForTimeout(300);
 S.shipped = { label: await button.innerText(), disabled: await button.isDisabled(), status: await sim(page, () => window.tgScene.sim.contractStatus()) };
 await shot(page, '06-contract-in-transit.png');
 await page.getByRole('button', { name: '4×' }).click();
 await waitSim(page, () => !window.tgScene.sim.contractStatus().inTransit, null, 120000).catch(() => {});
 await page.waitForTimeout(400);
 S.arrived = { label: await button.innerText(), disabled: await button.isDisabled(), status: await sim(page, () => window.tgScene.sim.contractStatus()), contracts: await sim(page, () => window.tgScene.sim.contracts) };
 await shot(page, '07-contract-wait.png');
 await page.locator('.objective-card').click();
 S.dialog = await page.locator('.contract-box').innerText().catch(() => null);
 await shot(page, '08-rank-dialog-contract.png');
 await closeCards(page);
 await page.getByRole('button', { name: '1×' }).click();
}

// Stage 4 (desktop): export fleet in the market and the operations card; fuel shortage note.
async function fleet(page) {
 const S = R.stages.fleet = {};
 S.exportStatus = await sim(page, () => { const e = window.tgScene.sim.exportStatus(); return { vehicles: e.vehicles, fuelFree: e.fuelFree, fuelPerTrip: e.fuelPerTrip, fuelTrucks: e.fuelTrucks }; });
 S.opsLine = await page.locator('.operations-card .fleet-line').innerText().catch(() => null);
 await override(page, 'wood +60, fuel 0, three wood sales through sim.sell (every fuel-free vehicle out)', () => { const s = window.tgScene.sim; s.stock.wood += 60; s.stock.fuel = 0; s.reserves.fuel = 0; for (let i = 0; i < 3; i++) s.sell('wood', 1); });
 S.opsLineOut = await page.locator('.operations-card .fleet-line').innerText().catch(() => null);
 await shot(page, '09a-ops-fleet-fuel-short.png');
 await page.getByRole('button', { name: '시장', exact: true }).click();
 await page.locator('.export-status').waitFor({ timeout: 5000 });
 S.marketLine = await page.locator('.export-status').innerText();
 await page.waitForTimeout(500); // dialog fade-in
 await shot(page, '09-market-fleet.png');
 await closeCards(page);
}

// Stage 5 (desktop): pause, save, back to the start screen, continue: the game must stay paused.
async function continuePaused(page) {
 const S = R.stages.continuePaused = {};
 await page.getByRole('button', { name: '일시정지', exact: true }).click();
 await page.getByRole('button', { name: '게임 설정' }).click();
 await page.getByRole('button', { name: '지금 저장' }).click();
 const t = await sim(page, () => window.tgScene.sim.time);
 await page.getByRole('button', { name: '시작 화면으로' }).click();
 await page.getByRole('button', { name: '이어하기' }).first().click();
 await page.getByRole('button', { name: /재개|일시정지/ }).first().waitFor({ timeout: 60000 });
 await page.waitForTimeout(3000);
 S.after3s = await sim(page, before => { const s = window.tgScene.sim; return { paused: s.paused, advanced: +(s.time - before).toFixed(2) }; }, t);
 S.pauseLabel = await visible(page, '.pause-label');
 await shot(page, '10-continue-stays-paused.png');
}

// Stage 6 (phone 390x844): build menu open, the rotate buttons stay visible and tappable.
async function phone() {
 const page = await open({ width: 390, height: 844 });
 const S = R.stages.phone = {};
 await toHome(page); await newGame(page);
 await clickTile(page, 11, 12);
 await waitSim(page, () => window.tgScene.sim.buildings.some(b => b.type === 'warehouse'), null, 10000);
 await closeCards(page);
 S.closed = await hit(page);
 await page.getByRole('button', { name: '건설 목록 열기' }).click();
 await page.locator('.build-dock').waitFor();
 S.open = await hit(page);
 const view = await sim(page, () => window.tgScene.viewIndex);
 await page.getByRole('button', { name: '오른쪽 90도 회전' }).click({ timeout: 3000 }).catch(e => { S.rotateError = e.message.split('\n')[0]; });
 await page.waitForTimeout(300);
 S.rotated = (await sim(page, () => window.tgScene.viewIndex)) !== view;
 S.dockStillOpen = await visible(page, '.build-dock');
 await shot(page, '11-phone-build-menu-camera.png');
 await page.close();
}

// Stage 7 (both sizes): small-defect sweep over the mid-game showcase: covered or off-screen controls and clipped text
// on the HUD, every build tab, a facility card and every dialog. Findings are reviewed by eye with the screenshots.
const audit = scope => ({ scope }) => {
 const vw = innerWidth, vh = innerHeight, out = { covered: [], offscreen: [], clipped: [] }, root = scope ? document.querySelector(scope) : document;
 if (!root) return out;
 const name = el => (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 32);
 // Visible part of an element after every clipping ancestor (scroll lists clip their items on purpose).
 const clip = el => { let r = el.getBoundingClientRect(), box = { l: r.left, t: r.top, r: r.right, b: r.bottom }; for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p); if (o.overflowX !== 'visible' || o.overflowY !== 'visible') { const q = p.getBoundingClientRect(); box = { l: Math.max(box.l, q.left), t: Math.max(box.t, q.top), r: Math.min(box.r, q.right), b: Math.min(box.b, q.bottom) }; } } return box; };
 for (const el of root.querySelectorAll('button,a[href],[role=tab],select,input:not([type=file])')) {
  const r = el.getBoundingClientRect(), cs = getComputedStyle(el); if (!r.width || !r.height || cs.visibility === 'hidden' || +cs.opacity === 0 || el.closest('[aria-hidden=true],[inert]')) continue;
  const v = clip(el); if (v.r - v.l < 4 || v.b - v.t < 4) continue;
  if (v.l < -1 || v.t < -1 || v.r > vw + 1 || v.b > vh + 1) out.offscreen.push(name(el));
  const cx = Math.min(vw - 1, Math.max(0, (v.l + v.r) / 2)), cy = Math.min(vh - 1, Math.max(0, (v.t + v.b) / 2)), top = document.elementFromPoint(cx, cy);
  if (top && !el.contains(top) && !top.contains(el) && !top.closest('[data-sonner-toaster]')) out.covered.push(name(el) + ' <- ' + (top.closest('[class]')?.className?.baseVal ?? top.closest('[class]')?.className ?? top.tagName).toString().slice(0, 40));
 }
 for (const el of root.querySelectorAll('strong,span,small,p,b,h2,h3,label,button')) { const cs = getComputedStyle(el); if (!el.getClientRects().length || cs.textOverflow === 'ellipsis' || el.closest('[aria-hidden=true],.sr-only')) continue; if (/hidden|clip/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 2 && el.innerText.trim()) out.clipped.push(name(el)); }
 return out;
};
async function sweepAt(viewport) {
 const page = await open(viewport), tag = viewport.width + 'x' + viewport.height, S = R.stages['sweep' + tag] = {};
 await toHome(page);
 await page.getByRole('button', { name: '산업도시 둘러보기' }).click();
 await waitSim(page, () => window.tgScene?.sim?.buildings.length > 10, null, 120000);
 await page.waitForTimeout(800);
 const check = async (key, scope) => { S[key] = await page.evaluate(audit(scope), { scope }); await shot(page, `sweep-${tag}-${key}.png`); };
 await check('hud');
 await page.getByRole('button', { name: '건설 목록 열기' }).click();
 for (const tab of ['기초', '주거', '농축산', '가공', '중공업', '동력·마법', '첨단', '운송', '도시']) { await page.getByRole('tab', { name: tab }).click(); await page.waitForTimeout(150); S['build-' + tab] = await page.evaluate(audit('.build-dock'), { scope: '.build-dock' }); }
 await shot(page, `sweep-${tag}-build.png`);
 await page.getByRole('button', { name: '건설 목록 닫기' }).click();
 // A marker whose centre is not under the HUD (markers follow the map, so some sit behind the stock column).
 const spot = await page.evaluate(() => { for (const m of document.querySelectorAll('.facility-marker.production')) { const r = m.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2, top = document.elementFromPoint(x, y); if (top && m.contains(top)) return { x, y }; } return null; });
 if (spot) { await page.mouse.click(spot.x, spot.y); await page.locator('.facility-card').waitFor({ timeout: 5000 }).catch(() => {}); await check('facility', '.facility-card'); await closeCards(page); }
 for (const [key, open] of [['market', () => page.getByRole('button', { name: '시장', exact: true }).click()], ['rank', () => page.locator('.objective-card').click()], ['residents', () => page.getByRole('button', { name: '주민', exact: true }).click()], ['settings', () => page.getByRole('button', { name: '게임 설정' }).click()], ['world', () => page.getByRole('button', { name: '세계 지도' }).click()]]) {
  try { await open(); await page.locator('[role=dialog]').waitFor({ timeout: 5000 }); await page.waitForTimeout(300); await check(key, '[role=dialog]'); } catch (e) { S[key] = { error: e.message.split('\n')[0] }; }
  await closeCards(page);
 }
 await page.close();
}

const stages = { firstSession, productPicker, contractFlow, fleet, continuePaused };
const wanted = name => !only || only.includes(name);
// Later desktop stages build on the first session, so it always runs when any desktop stage is asked for.
if (Object.keys(stages).some(wanted)) {
const page = await open({ width: 1440, height: 900 });
await toHome(page); await newGame(page);
for (const [name, fn] of Object.entries(stages)) {
 if (!wanted(name) && name !== 'firstSession') continue;
 log(name);
 try { await fn(page); } catch (e) { R.stages[name] = { ...(R.stages[name] || {}), error: e.message.split('\n')[0] }; await shot(page, 'error-' + name + '.png').catch(() => {}); }
}
await page.close();
}
if (wanted('phone')) { log('phone'); try { await phone(); } catch (e) { R.stages.phone = { ...(R.stages.phone || {}), error: e.message.split('\n')[0] }; } }
for (const v of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) if (wanted('sweep')) { log('sweep ' + v.width); try { await sweepAt(v); } catch (e) { R.stages['sweep' + v.width + 'x' + v.height] = { ...(R.stages['sweep' + v.width + 'x' + v.height] || {}), error: e.message.split(String.fromCharCode(10))[0] }; } }
await browser.close();
await writeFile(join(outDir, 'result.json'), JSON.stringify(R, null, 1));
console.log(JSON.stringify(R, null, 1).slice(0, 6000));
