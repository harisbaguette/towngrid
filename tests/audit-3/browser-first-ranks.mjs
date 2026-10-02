// Audit 2026-09-30 (G2) probe: new game -> rank 3 (계약 농노) with on-screen buttons and real canvas clicks only.
// Home -> 새 게임 -> world map (nation select + start-site select + preview) -> 이 땅에서 시작 -> warehouse by canvas click ->
// the bot follows the guide card, next-build hint, bottleneck chips, quick contracts, goals dialog (납품/승급), market sales,
// and answers warnings, at 4x. Records real seconds to each rank, stalls (no rank change), game-time rate, natural export
// carts and every page/console error. Stops at rank 3 or TG_MINUTES (default 30).
// Usage: TG_OUT=docs/verification/audit-20260930 node tests/audit-3/browser-first-ranks.mjs <playwright/index.mjs> <chrome.exe>
import { R, open, toHome, sim, waitSim, shot, save, browser, log, clickTile, closeAll } from '../audit-2/_browser.mjs';

const minutes = +(process.env.TG_MINUTES || 30), target = +(process.env.TG_RANK || 3);
const vp = { width: 1366, height: 768 };
const page = await open(vp);
const F = { viewport: vp, target, ranks: [], actions: [], stalls: [], samples: [] };
const snap = () => sim(page, () => { const s = window.tgScene?.sim; if (!s) return null; return { t: Math.round(s.time), rank: s.rank, money: Math.round(s.money), debt: Math.round(s.debt || 0), contracts: s.contracts, speed: s.speed, paused: s.paused, buildings: s.buildings.length, workers: s.workers.length, carts: window.tgScene.exportCarts.size, shipments: s.shipments?.length || 0, types: [...new Set(s.buildings.map(b => b.type))].join(','), produced: Object.fromEntries(['water','grain','wood','plank','flour'].map(k => [k, Math.floor(s.produced?.[k] || 0)])), stock: Object.fromEntries(['water','grain','wood','plank','flour','stone'].map(k => [k, Math.floor(s.stock?.[k] || 0)])), promotion: (() => { const p = s.promotion(); return p && { fee: p.fee, ready: p.ready, req: p.requirements.map(r => r.name + ' ' + Math.floor(r.current) + '/' + r.target) }; })(), states: s.buildings.map(b => b.type + ':' + (b.enabled === false ? 'off' : '') + (s.statusOf ? s.statusOf(b) : (b.status || ''))).join(' | '), tutorialBody: document.querySelector('.tutorial-card p')?.innerText || null }; });
const ui = () => page.evaluate(() => { const v = s => { const e = document.querySelector(s); return !!e && !!e.getClientRects().length; }; return { tutorial: v('.tutorial-card'), tutorialText: document.querySelector('.tutorial-card strong')?.innerText || null, nextBuild: document.querySelector('.next-build')?.innerText?.replace(/\s+/g, ' ') || null, bottleneck: [...document.querySelectorAll('.operations-card .bottleneck')].map(e => e.innerText.replace(/\s+/g, ' ')), promotionReady: v('.promotion-ready'), facility: v('.facility-card'), dialog: v('[role=dialog]'), weather: v('.weather-warning'), raid: v('.raid-panel'), objective: document.querySelector('.objective-card')?.innerText?.replace(/s+/g, ' ') || null, operations: document.querySelector('.operations-card')?.innerText?.replace(/s+/g, ' ').slice(0, 160) || null }; });
try {
  F.home = await toHome(page);
  await page.getByRole('button', { name: '새 게임', exact: true }).click();
  await page.locator('.realm-card .start-button:not(:disabled)').waitFor({ timeout: 120000 });
  await page.locator('#realm').selectOption('estern');
  const opts = await page.locator('#start-province option:not([disabled])').evaluateAll(os => os.map(o => o.value));
  await page.locator('#start-province').selectOption(opts[4]); F.start = opts[4];
  const t0 = Date.now();
  await page.getByRole('button', { name: /이 땅에서 시작/ }).click();
  await waitSim(page, () => !!window.tgScene?.sim && window.tgScene.mode === 'warehouse' && !document.querySelector('.screen-loading'), null, 120000);
  F.newGameMs = Date.now() - t0;
  const freeTile = type => sim(page, type => { const s = window.tgScene.sim, w = s.warehouse || { x: 11, z: 12 }; const c = [...s.owned].map(k => k.split(',').map(Number)).sort((a, b) => Math.hypot(a[0] - w.x, a[1] - w.z) - Math.hypot(b[0] - w.x, b[1] - w.z)); for (const [x, z] of c) if (!s.canBuild(type, x, z)) return [x, z]; return null; }, type);
  const placeCurrentTool = async () => { const tool = await sim(page, () => window.tgScene.mode); if (!tool) return null; const tile = await freeTile(tool); if (!tile) { await page.keyboard.press('Escape'); return tool + ':no-tile'; } await clickTile(page, tile[0], tile[1]); await page.waitForTimeout(150); const placed = await sim(page, ([x, z]) => !!window.tgScene.sim.at(x, z), tile); if (await sim(page, () => window.tgScene.mode)) await page.keyboard.press('Escape'); return tool + '@' + tile + (placed ? '' : ':not-placed'); };
  F.warehouse = await placeCurrentTool();
  await shot(page, 'ranks-00-warehouse.png');
  await page.getByRole('button', { name: '4×' }).click();
  const start = Date.now(); let i = 0, lastRank = 0, lastRankAt = start, lastSample = 0;
  const sec = () => Math.round((Date.now() - start) / 1000);
  const game0 = await snap();
  while (Date.now() - start < minutes * 60000) {
    i++;
    const u = await ui();
    try {
      if (u.dialog) { const pr = page.locator('[role=dialog]').getByRole('button', { name: /^승급 · / }); const d = page.locator('[role=dialog]').getByRole('button', { name: /^납품 +/ }); if (await d.count() && await d.first().isEnabled()) { await d.first().click(); F.actions.push({ s: sec(), a: 'dialog:deliver' }); } if (await pr.count() && await pr.isEnabled()) { await pr.click(); await page.waitForTimeout(400); F.actions.push({ s: sec(), a: 'dialog:promote' }); } await page.keyboard.press('Escape'); }
      else if (u.facility) await page.getByRole('button', { name: '시설 정보 닫기' }).click();
      else if (u.weather && await page.locator('.weather-warning button:not([disabled])').count()) { await page.locator('.weather-warning button').click(); F.actions.push({ s: sec(), a: 'reinforce' }); }
      else if (u.raid && await page.locator('.raid-panel button:not([disabled])').count()) { await page.locator('.raid-panel button:not([disabled])').first().click(); F.actions.push({ s: sec(), a: 'mobilize' }); }
      else if (u.promotionReady) { await page.locator('.promotion-ready').click(); await page.locator('[role=dialog]').waitFor({ timeout: 3000 }); const btn = page.getByRole('button', { name: /^승급 · / }); if (await btn.count() && await btn.isEnabled()) { await btn.click(); await page.waitForTimeout(300); F.actions.push({ s: sec(), a: 'promote' }); } await page.keyboard.press('Escape'); }
      else if (await sim(page, () => { const s = window.tgScene.sim, p = s.promotion(); return !!p && p.requirements.some(r => r.key === 'expansions' && !r.done) && s.money >= s.expansionCost() + 40; })) { const target = await sim(page, () => { const s = window.tgScene.sim; for (let cx = 0; cx < 6; cx++) for (let cz = 0; cz < 6; cz++) if (s.canExpand(cx, cz)) return [cx * 4 + 2, cz * 4 + 2]; return null; }); if (target) { F.guidanceAtExpansion = F.guidanceAtExpansion || u; await page.getByRole('button', { name: '영토 확장' }).click(); await page.waitForTimeout(200); await clickTile(page, target[0], target[1]); await page.waitForTimeout(300); const done = await sim(page, () => window.tgScene.sim.expansions); if (await sim(page, () => window.tgScene.mode)) await page.keyboard.press('Escape'); F.actions.push({ s: sec(), a: 'expand@' + target, expansions: done }); } }
      else if (await page.locator('.quick-contract button:not([disabled])').count()) { await page.locator('.quick-contract button').click(); F.actions.push({ s: sec(), a: 'contract' }); }
      else if (u.tutorial && await page.locator('.tutorial-card button:not(.tutorial-dismiss):not([disabled])').count()) { const b = page.locator('.tutorial-card button:not(.tutorial-dismiss):not([disabled])').first(); const label = (await b.innerText()).replace(/\s+/g, ' '); await b.click(); await page.waitForTimeout(200); F.actions.push({ s: sec(), a: 'guide:' + label, placed: await placeCurrentTool() }); }
      else if (u.nextBuild && i % 3 === 0) { await page.locator('.next-build').click(); await page.waitForTimeout(200); F.actions.push({ s: sec(), a: 'next-build:' + u.nextBuild, placed: await placeCurrentTool() }); }
      else if (u.bottleneck.length && i % 4 === 0) { await page.locator('.operations-card .bottleneck').first().click(); await page.waitForTimeout(200); F.actions.push({ s: sec(), a: 'bottleneck:' + u.bottleneck[0], placed: await placeCurrentTool() }); await closeAll(page); }
      else if (i % 5 === 0 && await page.locator('.objective-card').count()) { await page.locator('.objective-card').click(); await page.locator('[role=dialog]').waitFor({ timeout: 3000 }); const d = page.getByRole('button', { name: /^납품 \+/ }); if (await d.count() && await d.isEnabled()) { await d.click(); F.actions.push({ s: sec(), a: 'goals:deliver' }); } const pr = page.getByRole('button', { name: /^승급 · / }); if (await pr.count() && await pr.isEnabled()) { await pr.click(); await page.waitForTimeout(300); F.actions.push({ s: sec(), a: 'goals:promote' }); } await page.keyboard.press('Escape'); }
      else if (i % 10 === 0) { await page.getByRole('button', { name: '시장', exact: true }).click(); await page.locator('[role=dialog]').waitFor({ timeout: 3000 }); const sell = page.locator('[role=dialog] button[aria-label$="개 판매"]:not([disabled])'); if (await sell.count()) { const label = await sell.first().getAttribute('aria-label'); await sell.first().click(); F.actions.push({ s: sec(), a: 'sell:' + label }); } await page.keyboard.press('Escape'); }
    } catch (e) { F.actions.push({ s: sec(), error: e.message.split('\n')[0] }); await closeAll(page).catch(() => {}); }
    const now = await snap();
    if (now.rank !== lastRank) { F.ranks.push({ rank: now.rank, realS: sec(), gameS: now.t, stallS: Math.round((Date.now() - lastRankAt) / 1000) }); await shot(page, `ranks-${String(now.rank).padStart(2, '0')}.png`); lastRank = now.rank; lastRankAt = Date.now(); log('rank ' + now.rank + ' at ' + sec() + 's'); }
    if (Date.now() - lastSample > 30000) { lastSample = Date.now(); F.samples.push({ s: sec(), ...now, ui: await ui(), fps: await page.evaluate(() => document.querySelector('[role=application]')?.dataset.fps || null) }); if (F.samples.length % 4 === 1) await shot(page, 'ranks-sample-' + String(F.samples.length).padStart(2, '0') + '.png'); await save('first-ranks.json', { ...F, R }); }
    if (now.rank >= target) break;
    await page.waitForTimeout(1000);
  }
  const end = await snap();
  F.end = end; F.realSeconds = sec(); F.gameRate = +((end.t - game0.t) / F.realSeconds).toFixed(2);
  F.maxCarts = Math.max(0, ...F.samples.map(s => s.carts));
  await shot(page, 'ranks-end.png');
} catch (e) { F.error = String(e.stack || e).slice(0, 600); await shot(page, 'ranks-failure.png').catch(() => {}); }
F.R = R;
await save('first-ranks.json', F);
console.log(JSON.stringify({ ranks: F.ranks, end: F.end, error: F.error, errors: R.errors.length, consoleErrors: R.consoleErrors.length, failed: R.failedRequests.length }));
await browser.close();
