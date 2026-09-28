// Balance patch 2026-09-28 browser verification: 26 new facilities on the real map, four quarter views,
// CPU software renderer, processing chains, save/reload, phone layout.
// Headless, isolated browser contexts (the player's own localStorage is never touched).
// The probe sets rank/money/stock/land directly (recorded in result.json as `stateOverrides`).
// Usage: node tests/audit/browser-balance-20260928.mjs <playwright/index.mjs> <chrome.exe> <output dir>
// Needs a running dev server (TOWNGRID_URL, default http://localhost:5173).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const outDir = process.argv[4] || 'docs/verification/balance-20260928';
await mkdir(outDir, { recursive: true });
const origin = process.env.TOWNGRID_URL || 'http://localhost:5173';
const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}), args: ['--enable-unsafe-swiftshader', ...(process.env.TG_SWIFTSHADER ? ['--use-gl=swiftshader'] : [])] });
const NEW = ['cottonfield', 'herbgarden', 'henhouse', 'smokehouse', 'weaver', 'confectionery', 'kiln', 'tailor', 'glassworks', 'coppermine', 'wiremill', 'cementworks', 'cannery', 'lampworks', 'engineworks', 'mithrilforge', 'shipyard', 'blastfurnace', 'assemblyline', 'watermill', 'marketplace', 'wardpost', 'fortress', 'parliament', 'airdock', 'exchange'];
const GROUP_NAMES = { base: '기초', home: '주거', farm: '농축산', craft: '가공', industry: '중공업', energy: '동력·마법', advanced: '첨단', transport: '운송', civic: '도시' };
const R = { stateOverrides: [], errors: [], consoleErrors: [], failedRequests: [], steps: [] };
const log = s => { R.steps.push(s); console.log('[step]', s); };

async function makeContext(opts = {}, { software = false } = {}) {
 const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
 // Dead HMR socket: a dev-server reload mid-flow would invalidate the run.
 await context.addInitScript(() => { window.WebSocket = class { constructor() { this.readyState = 0; } addEventListener() {} removeEventListener() {} send() {} close() {} }; });
 if (software) await context.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (kind, ...a) { if (/webgl/i.test(kind)) return null; return g.call(this, kind, ...a); }; });
 return context;
}
function watch(page, tag) {
 page.on('pageerror', e => R.errors.push(tag + ': ' + e.message));
 page.on('console', m => { if (m.type() === 'error') R.consoleErrors.push(tag + ': ' + m.text().slice(0, 400)); });
 page.on('response', r => { if (r.status() >= 400) R.failedRequests.push(tag + ': ' + r.status() + ' ' + r.url()); });
 page.on('crash', () => { R.crashes = (R.crashes || []).concat(tag + ' @ ' + R.steps.slice(-1)[0]); console.log('[crash]', tag); });
 page.on('requestfailed', r => { const u = r.url(); if (!/\/@vite\/client|__vite_ping|hmr/.test(u)) R.failedRequests.push(tag + ': FAILED ' + (r.failure()?.errorText || '') + ' ' + u); });
}
const frames = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
async function hookScene(page) {
 await page.evaluate(async () => {
  const urls = performance.getEntriesByType('resource').map(e => e.name).filter(url => /\/app\/game\/scene\.js(?:\?|$)/.test(url));
  for (const url of new Set([...urls, '/src/app/game/scene.js'])) { try { const { GameScene } = await import(url); if (GameScene.prototype.__tgHooked) continue; const original = GameScene.prototype.setSimulation; GameScene.prototype.setSimulation = function (sim) { window.tgScene = this; return original.call(this, sim); }; GameScene.prototype.__tgHooked = true; } catch {} }
 });
}
async function toHome(page) {
 const t0 = Date.now();
 await page.goto(origin);
 const canvasOrTitle = await page.waitForSelector('button', { timeout: 20000 }).then(() => Date.now() - t0).catch(() => null);
 for (let i = 0; i < 40 && !(await page.getByRole('button', { name: '새 게임' }).count()); i++) { await page.getByRole('button', { name: '화면을 눌러 시작', exact: true }).click().catch(() => {}); await page.waitForTimeout(700); }
 await page.getByRole('button', { name: '새 게임' }).waitFor({ timeout: 60000 });
 await hookScene(page);
 return { firstButtonMs: canvasOrTitle, homeMs: Date.now() - t0 };
}
const visible = async (page, sel) => (await page.locator(sel).count()) > 0 && await page.locator(sel).first().isVisible();
async function closeCards(page) {
 for (let i = 0; i < 3; i++) {
  if (await visible(page, '[role=dialog]')) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); continue; }
  const close = page.getByRole('button', { name: '시설 정보 닫기' });
  if (await close.count() && await close.first().isVisible()) { await close.first().click(); await page.waitForTimeout(120); continue; }
  break;
 }
}
async function focus(page, x, z, zoom) {
 await page.evaluate(([x, z, zoom]) => { const s = window.tgScene; s.controls.target.set(x, 0, z); if (zoom) { s.camera.zoom = zoom; s.camera.updateProjectionMatrix(); } s.setQuarterView(s.viewIndex); }, [x, z, zoom]);
 await frames(page);
}
async function project(page, x, y, z) {
 return page.evaluate(([x, y, z]) => { const s = window.tgScene, v = s.camera.position.clone().set(x, y, z); v.project(s.camera); const r = s.renderer.domElement.getBoundingClientRect(); const px = r.left + (v.x + 1) / 2 * r.width, py = r.top + (1 - v.y) / 2 * r.height; const el = document.elementFromPoint(px, py); return { px, py, onCanvas: el === s.renderer.domElement, top: el ? String(el.className?.baseVal ?? el.className).slice(0, 60) : null }; }, [x, y, z]);
}
async function clickTile(page, x, z) {
 await focus(page, x, z);
 const p = await project(page, x, 0, z);
 await page.mouse.move(p.px, p.py); await page.mouse.down(); await page.mouse.up();
 return p;
}
// Build through the real UI: open the dock, pick the group tab, press the item, click the tile.
async function buildViaUI(page, type, x, z) {
 const def = await page.evaluate(t => window.__defs[t], type);
 await closeCards(page);
 if (!(await visible(page, '.build-dock'))) await page.getByRole('button', { name: '건설 목록 열기' }).click();
 await page.getByRole('tab', { name: GROUP_NAMES[def.group] }).click();
 const item = page.getByRole('button', { name: def.name + ' 건설', exact: true });
 const disabled = await item.isDisabled();
 await item.click({ timeout: 5000 });
 const p = await clickTile(page, x, z);
 await page.waitForFunction(([t, x, z]) => window.tgScene.sim.buildings.some(b => b.type === t && b.x === x && b.z === z) || (t === 'road' && window.tgScene.sim.roads.has(x + ',' + z)), [type, x, z], { timeout: 3000, polling: 100 }).catch(() => {});
 const ok = await page.evaluate(([t, x, z]) => t === 'road' ? window.tgScene.sim.roads.has(x + ',' + z) : window.tgScene.sim.buildings.some(b => b.type === t && b.x === x && b.z === z), [type, x, z]);
 const toast = ok ? null : (await page.locator('[data-sonner-toast]').allInnerTexts()).slice(-1)[0] || null;
 if (await page.locator('.game-shell.placing').count()) await page.keyboard.press('Escape');
 await closeCards(page);
 return { type, x, z, ok, disabledBefore: disabled, clickOnCanvas: p.onCanvas, coveredBy: p.onCanvas ? null : p.top, toast };
}
async function state(page) {
 return page.evaluate(ids => { const s = window.tgScene.sim; const res = new Set(); for (const t of ids) { const d = window.__defs[t]; if (d.output) res.add(d.output); for (const r of Object.keys(d.inputs || {})) res.add(r); } return { rank: s.rank, money: Math.round(s.money), time: Math.round(s.time), buildings: s.buildings.map(b => b.type + '@' + b.x + ',' + b.z), newBuildings: s.buildings.filter(b => ids.includes(b.type)).map(b => b.type).sort(), stock: Object.fromEntries([...res].filter(r => r in s.stock).map(r => [r, Math.floor(s.stock[r])])), produced: Object.fromEntries([...res].filter(r => s.produced?.[r]).map(r => [r, s.produced[r]])) }; }, NEW);
}
async function exposeDefs(page) {
 await page.evaluate(async () => { const urls = [...new Set(performance.getEntriesByType('resource').map(e => e.name).filter(u => /\/app\/game\/simulation\.js(\?|$)/.test(u)))]; const m = await import(urls[0] || '/src/app/game/simulation.js'); window.__defs = m.BUILDINGS; window.__res = m.RESOURCES; const w = await import((urls[0] || '/src/app/game/simulation.js').replace('simulation.js', 'world.js')); window.__ranks = w.RANKS; window.__unlock = w.unlockRank; });
}
async function contactSheet(page, name, cells, cols) {
 const html = `<style>body{margin:0;background:#222;font:12px sans-serif;color:#fff}div.g{display:grid;grid-template-columns:repeat(${cols},200px);gap:4px;padding:4px}figure{margin:0;background:#333}img{width:200px;height:200px;display:block;image-rendering:pixelated}figcaption{padding:2px 4px;height:16px;overflow:hidden}</style><div class=g>${cells.map(c => `<figure><img src="data:image/png;base64,${c.png}"><figcaption>${c.label}</figcaption></figure>`).join('')}</div>`;
 const p = await page.context().newPage();
 await p.setViewportSize({ width: cols * 204 + 8, height: 400 });
 await p.setContent(html);
 await p.screenshot({ path: join(outDir, name), fullPage: true });
 await p.close();
}
async function sheetsForAllViews(page, placed, prefix, zoom) {
 const out = {};
 for (let view = 0; view < 4; view++) {
  await page.evaluate(v => window.tgScene.setQuarterView(v), view);
  const cells = [];
  for (const b of placed) {
   await focus(page, b.x, b.z, zoom);
   const c = await project(page, b.x, 0.35, b.z);
   const buf = await page.screenshot({ clip: { x: c.px - 100, y: c.py - 110, width: 200, height: 200 } });
   cells.push({ label: `${b.type} ${b.name}`, png: buf.toString('base64') });
  }
  const file = `${prefix}-view${view}.png`;
  await contactSheet(page, file, cells, 7);
  out[view] = file;
 }
 return out;
}
async function meshAudit(page) {
 return page.evaluate(ids => {
  const s = window.tgScene, out = [];
  for (const b of s.sim.buildings.filter(b => ids.includes(b.type))) {
   const m = s.models.get(b.id);
   if (!m) { out.push({ type: b.type, model: false }); continue; }
   m.updateMatrixWorld(true);
   let meshes = 0, visibleMeshes = 0, badMaterial = 0;
   m.traverse(o => { if (o.isMesh || o.isSprite) { meshes++; let vis = true; for (let p = o; p; p = p.parent) if (!p.visible) vis = false; if (vis) visibleMeshes++; const mats = [].concat(o.material || []); if (mats.some(x => !x || (x.map && !x.map.image))) badMaterial++; } });
   out.push({ type: b.type, model: true, name: m.name, meshes, visibleMeshes, badMaterial, pos: [+(m.position.x - b.x).toFixed(3), +(m.position.z - b.z).toFixed(3)], scale: +m.scale.x.toFixed(3), pixel: !!m.userData?.pixel || /pixel/i.test(m.name || '') });
  }
  return out;
 }, NEW);
}
async function boundsAudit(page) {
 // World-space bounds of each model, via the THREE module the scene already loaded.
 return page.evaluate(async ids => {
  const urls = [...new Set(performance.getEntriesByType('resource').map(e => e.name).filter(u => /\/three\.js|\/three\/build\/three\.module\.js|node_modules\/\.vite\/deps\/three\.js/.test(u)))];
  let THREE = null; for (const u of urls) { try { const m = await import(u); if (m.Box3) { THREE = m; break; } } catch {} }
  if (!THREE) return { error: 'three module not found', urls };
  const s = window.tgScene, out = [];
  for (const b of s.sim.buildings.filter(b => ids.includes(b.type))) { const m = s.models.get(b.id); if (!m) continue; m.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(m); out.push({ type: b.type, dx: [+(box.min.x - b.x).toFixed(2), +(box.max.x - b.x).toFixed(2)], dz: [+(box.min.z - b.z).toFixed(2), +(box.max.z - b.z).toFixed(2)], h: +(box.max.y).toFixed(2), withinTile: box.min.x - b.x >= -0.56 && box.max.x - b.x <= 0.56 && box.min.z - b.z >= -0.56 && box.max.z - b.z <= 0.56 }); }
  return out;
 }, NEW);
}
async function rafSample(page) {
 return page.evaluate(() => new Promise(res => { const d = []; let last = performance.now(); const end = last + 2000; const f = t => { d.push(t - last); last = t; if (t < end) requestAnimationFrame(f); else { d.sort((a, b) => a - b); res({ frames: d.length, p50: +d[Math.floor(d.length * .5)].toFixed(1), p95: +d[Math.floor(d.length * .95)].toFixed(1), max: +d[d.length - 1].toFixed(1) }); } }; requestAnimationFrame(f); }));
}

const abort = async e => { R.abortedAt = String(e?.message || e).split(String.fromCharCode(10))[0]; await writeFile(join(outDir, 'result.json'), JSON.stringify(R, null, 1)); console.log('ABORT', R.abortedAt); process.exit(2); };
process.on('unhandledRejection', abort); process.on('uncaughtException', abort);
// ---------------- Run 1: WebGL (SwiftShader) main context ----------------
const ctx = await makeContext();
const page = await ctx.newPage();
watch(page, 'main');
R.load = await toHome(page);
await page.screenshot({ path: join(outDir, '01-home.png') });
await page.getByRole('button', { name: '새 게임' }).click();
await page.getByRole('button', { name: /이 땅에서 시작/ }).waitFor();
const tNew = Date.now();
await page.getByRole('button', { name: /이 땅에서 시작/ }).click();
await page.waitForFunction(() => !!window.tgScene?.sim && window.tgScene.mode === 'warehouse', null, { timeout: 60000, polling: 200 });
R.load.newGameToWarehouseModeMs = Date.now() - tNew;
await exposeDefs(page);
R.renderer = await page.evaluate(() => ({ isSoftware: !!window.tgScene.renderer.isSoftware, dataset: { ...window.tgScene.renderer.domElement.dataset } }));
// Warehouse: pick a tile inside the starting land the same way the player does.
const whTile = await page.evaluate(() => { const s = window.tgScene.sim; const land = [...s.owned].map(k => k.split(',').map(Number)); const cx = land.reduce((a, p) => a + p[0], 0) / land.length, cz = land.reduce((a, p) => a + p[1], 0) / land.length; return land.filter(([x, z]) => !s.canBuild('warehouse', x, z)).sort((a, b) => Math.hypot(a[0] - cx, a[1] - cz) - Math.hypot(b[0] - cx, b[1] - cz))[0]; });
const shotA = await page.screenshot();
await clickTile(page, whTile[0], whTile[1]);
await page.waitForFunction(() => window.tgScene.sim.buildings.some(b => b.type === 'warehouse'), null, { timeout: 10000, polling: 100 });
await frames(page);
const shotB = await page.screenshot();
R.inputReaction = { warehouseClickChangedFrame: !shotA.equals(shotB), warehouse: whTile };
R.audioAfterFirstInput = await page.evaluate(() => document.querySelector('.game-shell')?.dataset.audioState || null);
await page.screenshot({ path: join(outDir, '02-new-game-warehouse.png') });
R.criterion1 = { errorsAfterNewGame: R.errors.length, consoleErrorsAfterNewGame: R.consoleErrors.length, failedRequestsAfterNewGame: R.failedRequests.length };
log('new game + warehouse');

// ② Build dock tabs at the starting rank (locked items show the unlock rank name).
await closeCards(page);
if (!(await visible(page, '.build-dock'))) await page.getByRole('button', { name: '건설 목록 열기' }).click();
async function auditTabs(tag) {
 const tabs = {};
 for (const [gid, gname] of Object.entries(GROUP_NAMES)) {
  await page.getByRole('tab', { name: gname }).click();
  await page.waitForTimeout(120);
  const items = await page.locator('.build-dock .build-item').evaluateAll(els => els.map(e => ({ label: e.getAttribute('aria-label'), price: e.querySelector('.item-price')?.textContent.trim(), disabled: e.disabled, title: e.title.slice(0, 80), imgOk: !!e.querySelector('img')?.naturalWidth })));
  tabs[gid] = items;
  await page.screenshot({ path: join(outDir, `03-${tag}-tab-${gid}.png`) });
  // The dock scrolls horizontally; capture the far end too when it overflows.
  const overflow = await page.locator('.build-items').evaluate(el => { const o = el.scrollWidth > el.clientWidth + 2; if (o) el.scrollLeft = el.scrollWidth; return o; });
  if (overflow) { await page.waitForTimeout(100); await page.screenshot({ path: join(outDir, `03-${tag}-tab-${gid}-end.png`) }); await page.locator('.build-items').evaluate(el => { el.scrollLeft = 0; }); }
 }
 const byName = {}; for (const list of Object.values(tabs)) for (const it of list) byName[it.label] = it;
 const newIn = await page.evaluate(ids => ids.map(t => ({ t, name: window.__defs[t].name, group: window.__defs[t].group, unlock: window.__unlock(t), unlockName: window.__ranks[window.__unlock(t)].name, cost: window.tgScene.sim.buildCost(t) })), NEW);
 return { tabs, newFacilities: newIn.map(n => ({ ...n, shown: !!byName[n.name + ' 건설'], price: byName[n.name + ' 건설']?.price ?? null, disabled: byName[n.name + ' 건설']?.disabled ?? null, iconLoaded: byName[n.name + ' 건설']?.imgOk ?? null })) };
}
R.criterion2 = { atStart: await auditTabs('rank0') };
log('build tabs at rank 0');

// ③ Raise the state directly (recorded): max rank, money, stock of every resource, all land owned.
const overrides = await page.evaluate(() => {
 const s = window.tgScene.sim, before = { rank: s.rank, money: s.money, owned: s.owned.size };
 s.rank = window.__ranks.length - 1; s.money = 5e6;
 for (const r of Object.keys(window.__res)) if (!['power', 'horse', 'health', 'ward', 'transit', 'irrigation'].includes(r)) s.stock[r] = Math.max(s.stock[r] || 0, 400);
 for (const t of s.tiles) s.owned.add(t.x + ',' + t.z);
 s.revision++;
 return { before, after: { rank: s.rank, rankName: window.__ranks[s.rank].name, money: s.money, owned: s.owned.size, stockEach: 400 } };
});
R.stateOverrides.push({ what: 'sim.rank=max, sim.money=5e6, sim.stock[all goods]=400, sim.owned=all tiles, via page.evaluate', ...overrides });
await page.waitForTimeout(300);
await closeCards(page);
if (!(await visible(page, '.build-dock'))) await page.getByRole('button', { name: '건설 목록 열기' }).click();
R.criterion2.atMaxRank = await auditTabs('rankmax');
log('build tabs at max rank');

// Pick tiles: every other tile around the warehouse so models do not hide each other; watermill needs water within 2.
const plan = await page.evaluate(([ids, wh]) => {
 const s = window.tgScene.sim, used = new Set(), plan = [];
 const ring = []; for (let x = 0; x < 24; x++) for (let z = 0; z < 24; z++) ring.push([x, z]);
 ring.sort((a, b) => Math.hypot(a[0] - wh[0], a[1] - wh[1]) - Math.hypot(b[0] - wh[0], b[1] - wh[1]));
 const free = (x, z) => { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (used.has((x + dx) + ',' + (z + dz))) return false; return true; };
 for (const t of ids) {
  const spot = ring.find(([x, z]) => (x + z) % 2 === 0 && free(x, z) && !s.canBuild(t, x, z) && !s.roads.has(x + ',' + z));
  if (spot) { used.add(spot.join(',')); plan.push({ type: t, name: window.__defs[t].name, x: spot[0], z: spot[1] }); } else plan.push({ type: t, name: window.__defs[t].name, x: null, z: null, reason: s.canBuild(t, wh[0] + 2, wh[1] + 2) });
 }
 return plan;
}, [NEW, whTile]);
R.criterion3 = { plan, builds: [] };
for (const p of plan) {
 if (p.x === null) { R.criterion3.builds.push({ ...p, ok: false }); continue; }
 const errBefore = R.errors.length + R.consoleErrors.length, t0 = Date.now();
 const r = await buildViaUI(page, p.type, p.x, p.z);
 r.ms = Date.now() - t0; r.mem = await page.evaluate(() => ({ heapMB: Math.round(performance.memory.usedJSHeapSize / 1e6), geo: window.tgScene.renderer.info?.memory?.geometries, tex: window.tgScene.renderer.info?.memory?.textures, fps: window.tgScene.renderer.domElement.dataset.fps })); console.log('[build]', p.type, r.ok, r.ms + 'ms', JSON.stringify(r.mem));
 r.newErrors = R.errors.length + R.consoleErrors.length - errBefore;
 R.criterion3.builds.push(r);
}
R.criterion3.builtCount = R.criterion3.builds.filter(b => b.ok).length;
log('built ' + R.criterion3.builtCount + '/26 via UI');
await frames(page);
R.criterion3.meshes = await meshAudit(page);
R.criterion3.bounds = await boundsAudit(page);
// Overview in the four views.
const centre = plan.filter(p => p.x !== null).reduce((a, p, _, arr) => [a[0] + p.x / arr.length, a[1] + p.z / arr.length], [0, 0]);
R.criterion3.overview = [];
for (let v = 0; v < 4; v++) {
 await page.evaluate(v => window.tgScene.setQuarterView(v), v);
 await focus(page, centre[0], centre[1], 1.35);
 await page.screenshot({ path: join(outDir, `04-new26-overview-view${v}.png`) });
 R.criterion3.overview.push(`04-new26-overview-view${v}.png`);
}
// Q/E keys really rotate (keyboard path, not the API).
await page.evaluate(() => window.tgScene.setQuarterView(0));
const qe = [];
for (const k of ['e', 'e', 'e', 'e', 'q']) { log('key ' + k + ' mem ' + JSON.stringify(await page.evaluate(() => ({ heapMB: Math.round(performance.memory.usedJSHeapSize / 1e6), fps: window.tgScene.renderer.domElement.dataset.fps })))); await page.locator('canvas').first().hover().catch(() => {}); await page.keyboard.press(k); await frames(page); qe.push(await page.evaluate(() => window.tgScene.renderer.domElement.dataset.cameraQuarter)); }
R.criterion3.qeKeys = qe;
R.criterion3.sheets = await sheetsForAllViews(page, plan.filter(p => p.x !== null), '05-new26-webgl', 3.2);
R.criterion3.errorsAfterBuildAndRotate = { errors: R.errors.length, consoleErrors: R.consoleErrors.length };
await page.evaluate(() => window.tgScene.setQuarterView(0));
await focus(page, centre[0], centre[1], 1);
R.fps = await rafSample(page);
log('26 sheets + fps');

// ④ Processing chains: power + roads + houses, then run the clock at 4x and watch cycles, hauling and a sale.
const aux = await page.evaluate(([plan, wh]) => {
 const s = window.tgScene.sim, want = [];
 const nb = (x, z) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, c]) => [x + a, z + c]);
 for (const t of ['cannery', 'shipyard']) { const p = plan.find(q => q.type === t); if (!p || p.x === null) continue; const has = nb(p.x, p.z).some(([a, c]) => s.roads.has(a + ',' + c)); if (!has) { const spot = nb(p.x, p.z).find(([a, c]) => !s.canBuild('road', a, c)); if (spot) want.push({ type: 'road', name: '흙길', x: spot[0], z: spot[1], for: t }); } }
 return want;
}, [plan, whTile]);
R.criterion4 = { aux: [] };
for (const a of aux) { const def = await page.evaluate(() => window.__defs.road); if (def) { const r = await buildViaUI(page, 'road', a.x, a.z); R.criterion4.aux.push({ ...r, for: a.for }); } }
// Houses so there are carriers; placed with the same UI helper.
const houseSpots = await page.evaluate(([wh]) => { const s = window.tgScene.sim, out = []; const ring = []; for (let x = 0; x < 24; x++) for (let z = 0; z < 24; z++) ring.push([x, z]); ring.sort((a, b) => Math.hypot(a[0] - wh[0], a[1] - wh[1]) - Math.hypot(b[0] - wh[0], b[1] - wh[1])); for (const [x, z] of ring) { if (out.length >= 6) break; if ((x + z) % 2 === 1 && !s.canBuild('house', x, z) && !out.some(o => Math.abs(o[0] - x) <= 1 && Math.abs(o[1] - z) <= 1)) out.push([x, z]); } return out; }, [whTile]);
for (const [x, z] of houseSpots) R.criterion4.aux.push(await buildViaUI(page, 'house', x, z));
const PROC = ['confectionery', 'weaver', 'kiln', 'cannery', 'shipyard'];
const before4 = await page.evaluate(ids => { const s = window.tgScene.sim; return { money: s.money, delivered: s.logisticsStats?.delivered || 0, power: s.power, workers: s.workers.length, fac: ids.map(t => { const b = s.buildings.find(b => b.type === t); const d = window.__defs[t]; return { t, out: d.output, cycles: b?.cycles || 0, status: b?.status, stockOut: Math.floor(s.stock[d.output] || 0), produced: s.produced?.[d.output] || 0 }; }) }; }, PROC);
R.criterion4.before = before4;
await page.getByRole('button', { name: '4×' }).click();
await page.waitForFunction(ids => { const s = window.tgScene.sim; return ids.every(t => (s.buildings.find(b => b.type === t)?.cycles || 0) >= 1); }, PROC, { timeout: 150000, polling: 500 }).catch(() => {});
const after4 = await page.evaluate(ids => { const s = window.tgScene.sim; return { money: s.money, time: s.time, delivered: s.logisticsStats?.delivered || 0, power: s.power, workers: s.workers.length, busy: s.workers.filter(w => w.task).length, fac: ids.map(t => { const b = s.buildings.find(b => b.type === t); const d = window.__defs[t]; return { t, out: d.output, cycles: b?.cycles || 0, status: b?.status, inputs: b?.inputs, bufferedOut: b?.out, stockOut: Math.floor(s.stock[d.output] || 0), produced: s.produced?.[d.output] || 0 }; }) }; }, PROC);
R.criterion4.after = after4;
// Screens: each processing facility's card while running.
R.criterion4.cards = [];
for (const t of PROC) {
 const p = plan.find(q => q.type === t); if (!p || p.x === null) continue;
 await closeCards(page);
 await page.evaluate(() => window.tgScene.setQuarterView(0));
 await clickTile(page, p.x, p.z);
 await page.waitForTimeout(400);
 const card = await visible(page, '.facility-card') ? (await page.locator('.facility-card').innerText()).replace(/\s+/g, ' ').slice(0, 300) : null;
 await page.screenshot({ path: join(outDir, `06-process-${t}.png`) });
 R.criterion4.cards.push({ t, card, file: `06-process-${t}.png` });
}
await closeCards(page);
// Sale through the market dialog (cake, the new top early food).
await page.getByRole('button', { name: '시장', exact: true }).click();
await page.getByRole('dialog').waitFor();
const money0 = await page.evaluate(() => window.tgScene.sim.money);
const sellBtn = page.getByRole('button', { name: /^케이크 \d+개 판매$/ });
R.criterion4.sale = { buttons: await sellBtn.count() };
if (R.criterion4.sale.buttons) { await sellBtn.first().click(); }
await page.screenshot({ path: join(outDir, '07-market-cake.png') });
await page.keyboard.press('Escape');
await page.waitForFunction(m => window.tgScene.sim.money > m + 1, money0, { timeout: 60000, polling: 250 }).catch(() => {});
R.criterion4.sale.moneyDelta = Math.round(await page.evaluate(() => window.tgScene.sim.money) - money0);
R.criterion4.sale.shipments = await page.evaluate(() => (window.tgScene.sim.shipments || []).map(s => s.item + ':' + s.amount));
R.criterion4.soldCake = await page.evaluate(() => window.tgScene.sim.sold?.cake || window.tgScene.sim.stats?.sold?.cake || null);
await page.getByRole('button', { name: '1×' }).click().catch(() => {});
await page.screenshot({ path: join(outDir, '08-after-processing.png') });
log('processing');

// ⑤ Save -> reload -> continue.
await page.getByRole('button', { name: '일시정지', exact: true }).click().catch(() => {});
await page.waitForTimeout(6500); // autosave interval is 6 s; the pause click also persists through act()
const beforeSave = await state(page);
const rawSave = await page.evaluate(() => Object.keys(localStorage).map(k => [k, localStorage.getItem(k).length]));
await page.reload();
for (let i = 0; i < 40 && !(await page.getByRole('button', { name: /이어하기/ }).count()); i++) { await page.getByRole('button', { name: '화면을 눌러 시작', exact: true }).click().catch(() => {}); await page.waitForTimeout(700); }
await hookScene(page);
await page.getByRole('button', { name: /이어하기/ }).click();
await page.waitForFunction(() => !!window.tgScene?.sim && window.tgScene.sim.buildings.length > 5, null, { timeout: 60000, polling: 200 });
await exposeDefs(page);
await page.waitForTimeout(800);
const afterLoad = await state(page);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
R.criterion5 = { storageKeys: rawSave, before: { rank: beforeSave.rank, newBuildings: beforeSave.newBuildings.length, stock: beforeSave.stock }, after: { rank: afterLoad.rank, newBuildings: afterLoad.newBuildings.length, stock: afterLoad.stock }, buildingsEqual: same(beforeSave.buildings.slice().sort(), afterLoad.buildings.slice().sort()), newBuildingsEqual: same(beforeSave.newBuildings, afterLoad.newBuildings), stockEqual: same(beforeSave.stock, afterLoad.stock), rankEqual: beforeSave.rank === afterLoad.rank, stockDiff: Object.keys({ ...beforeSave.stock, ...afterLoad.stock }).filter(k => beforeSave.stock[k] !== afterLoad.stock[k]).map(k => [k, beforeSave.stock[k], afterLoad.stock[k]]) };
R.criterion5.meshesAfterLoad = (await meshAudit(page)).filter(m => !m.model || !m.visibleMeshes).map(m => m.type);
await focus(page, centre[0], centre[1], 1.35);
await page.screenshot({ path: join(outDir, '09-after-reload.png') });
log('save/reload');
const storage = await ctx.storageState();

// ⑥ Phone width 390x844: build dock and resource strip.
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(600);
await closeCards(page);
if (!(await visible(page, '.build-dock'))) await page.getByRole('button', { name: '건설 목록 열기' }).click();
await page.getByRole('tab', { name: '가공' }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: join(outDir, '10-phone-390x844-build.png') });
R.criterion6 = await page.evaluate(() => {
 const vis = e => e && e.offsetParent !== null;
 const rect = e => { const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) }; };
 const boxes = [...document.querySelectorAll('.panel, .town-actions, .game-header, .build-dock, .resource-strip, .resources, [class*=resource]')].filter(vis).map(e => ({ cls: String(e.className).split(' ').slice(0, 2).join('.'), r: rect(e) }));
 const off = boxes.filter(b => b.r.r > innerWidth + 1 || b.r.l < -1).map(b => b.cls + JSON.stringify(b.r));
 const tabs = [...document.querySelectorAll('.build-dock [role=tab]')].map(t => ({ text: t.textContent.trim(), r: rect(t) }));
 const tablist = document.querySelector('.build-dock [role=tablist]');
 return { viewport: [innerWidth, innerHeight], docScrollWidth: document.documentElement.scrollWidth, offscreen: off, tabs, tablistScrollable: tablist ? tablist.scrollWidth > tablist.clientWidth : null, items: [...document.querySelectorAll('.build-dock .build-item')].map(e => ({ l: e.getAttribute('aria-label'), r: rect(e) })) };
});
await page.getByRole('button', { name: '건설 목록 닫기' }).click().catch(() => {});
await page.waitForTimeout(300);
await page.screenshot({ path: join(outDir, '11-phone-390x844-hud.png') });
R.criterion6.stripText = await page.evaluate(() => { const e = document.querySelector('.game-header') || document.querySelector('header'); return e ? e.innerText.replace(/\s+/g, ' ').slice(0, 300) : null; });
await page.setViewportSize({ width: 1440, height: 900 });
log('phone');
await ctx.close();

// ③-1 CPU software renderer: new isolated context with WebGL refused, same save.
const sctx = await makeContext({ storageState: storage }, { software: true });
const sp = await sctx.newPage();
watch(sp, 'software');
await sp.goto(origin);
for (let i = 0; i < 40 && !(await sp.getByRole('button', { name: /이어하기/ }).count()); i++) { await sp.getByRole('button', { name: '화면을 눌러 시작', exact: true }).click().catch(() => {}); await sp.waitForTimeout(700); }
await hookScene(sp);
await sp.getByRole('button', { name: /이어하기/ }).click();
await sp.waitForFunction(() => !!window.tgScene?.sim && window.tgScene.sim.buildings.length > 5, null, { timeout: 60000, polling: 200 });
await exposeDefs(sp);
await frames(sp);
R.criterion3_1 = { renderer: await sp.evaluate(() => ({ isSoftware: !!window.tgScene.renderer.isSoftware, quality: window.tgScene.quality, dataset: { ...window.tgScene.renderer.domElement.dataset } })) };
for (let v = 0; v < 4; v++) { await sp.evaluate(v => window.tgScene.setQuarterView(v), v); await focus(sp, centre[0], centre[1], 1.35); await sp.screenshot({ path: join(outDir, `12-software-overview-view${v}.png`) }); }
R.criterion3_1.sheets = await sheetsForAllViews(sp, plan.filter(p => p.x !== null), '13-new26-software', 3.2);
R.criterion3_1.fps = await rafSample(sp);
await sctx.close();
log('software');

await browser.close();
R.summary = {
 errors: R.errors.length, consoleErrors: R.consoleErrors.length, failedRequests: R.failedRequests.length,
 built: R.criterion3.builtCount, shownInDockAtMax: R.criterion2.atMaxRank.newFacilities.filter(n => n.shown).length,
 processingCycles: R.criterion4.after.fac.map(f => f.t + ':' + f.cycles), saleMoneyDelta: R.criterion4.sale.moneyDelta,
 saveOk: R.criterion5.newBuildingsEqual && R.criterion5.rankEqual, software: R.criterion3_1.renderer.isSoftware,
};
await writeFile(join(outDir, 'result.json'), JSON.stringify(R, null, 1));
console.log(JSON.stringify(R.summary, null, 1));
