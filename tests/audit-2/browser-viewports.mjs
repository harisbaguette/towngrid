// Audit 2026-09-29 stage B, probe 2: the same screens at 1920x1080, 1366x768, 390x844 (touch) and 844x390 (touch).
// Home, world map, new game HUD with the guide, build dock, facility card, tile panel, every dialog, and the
// industrial showcase HUD. For each: screenshot, covered/off-screen/clipped controls, overlap between HUD blocks,
// how much of the map is still visible, and on touch sizes a real tap-tap placement.
// Usage: node tests/audit-2/browser-viewports.mjs <playwright/index.mjs> <chrome.exe>
import { R, open, toHome, shot, sim, waitSim, visible, save, tilePoint, clickTile, closeAll, audit, raf, browser, log } from './_browser.mjs';
const sizes = (process.env.TG_SIZES || '1920x1080,1366x768,390x844,844x390').split(',').map(v => { const [width, height] = v.split('x').map(Number); return { width, height }; });
const V = {};
const hud = page => page.evaluate(() => {
  const sel = ['.game-header', '.resource-strip', '.header-actions', '.tutorial-card', '.operations-card', '.raid-panel', '.time-controls', '.objective-card', '.world-access', '.map-edges', '.camera-controls', '.town-actions', '.build-dock', '.facility-card', '.tile-panel', '.side-tools', '.placement-hint', '.weather-warning', '.demo-badge', '.soil-legend', '.finance-warning', '.pause-label', '[data-sonner-toaster] [data-sonner-toast]'];
  const boxes = []; for (const s of sel) for (const e of document.querySelectorAll(s)) { if (!e.getClientRects().length) continue; const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue; boxes.push({ s, r }); }
  const overlaps = []; for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i], b = boxes[j]; if (a.s === '.game-header' || b.s === '.game-header') continue; if ((a.s === '.resource-strip' || a.s === '.header-actions') && b.s === '.game-header') continue; const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top); if (w > 6 && h > 6) overlaps.push(`${a.s} x ${b.s} ${Math.round(w)}x${Math.round(h)}`); }
  const offscreen = boxes.filter(b => b.r.right > innerWidth + 1 || b.r.left < -1 || b.r.bottom > innerHeight + 1 || b.r.top < -1).map(b => `${b.s} [${Math.round(b.r.left)},${Math.round(b.r.top)},${Math.round(b.r.right)},${Math.round(b.r.bottom)}]`);
  // Share of the viewport where a tap reaches the map canvas.
  const canvas = document.querySelector('.world-canvas canvas'); let hit = 0, n = 0; for (let x = 5; x < innerWidth; x += innerWidth / 24) for (let y = 5; y < innerHeight; y += innerHeight / 24) { n++; if (document.elementFromPoint(x, y) === canvas) hit++; }
  return { mapVisiblePct: Math.round(hit / n * 100), overlaps, offscreen, blocks: boxes.map(b => `${b.s} ${Math.round(b.r.left)},${Math.round(b.r.top)} ${Math.round(b.r.width)}x${Math.round(b.r.height)}`) };
});
const dialogFit = page => page.evaluate(() => { const d = document.querySelector('[role=dialog]'); if (!d) return null; const r = d.getBoundingClientRect(); return { box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], fits: r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1, scrollable: d.scrollHeight > d.clientHeight + 2, overflowY: getComputedStyle(d).overflowY }; });

for (const vp of sizes) {
  const touch = vp.width < 900;
  const page = await open(vp, touch ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {});
  const tag = page.tag, S = V[tag] = { touch };
  const step = async (key, fn) => { log(tag + ' ' + key); try { S[key] = await fn(); } catch (e) { S[key] = { ...(S[key] || {}), error: e.message.split('\n')[0] }; await shot(page, `V-${tag}-error-${key}.png`).catch(() => {}); await closeAll(page).catch(() => {}); } };
  await step('home', async () => { const t = await toHome(page); await page.waitForTimeout(500); await shot(page, `V-${tag}-01-home.png`); return { timing: t, layout: await audit(page, '.home-screen') }; });
  await step('world', async () => { await page.getByRole('button', { name: '새 게임' }).click(); await page.getByRole('button', { name: /이 땅에서 시작/ }).waitFor(); await page.waitForTimeout(800); await shot(page, `V-${tag}-02-world.png`); const r = { layout: await audit(page, '.world-map-screen'), startButton: await page.locator('.start-button').evaluate(b => { const r = b.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), inView: r.bottom <= innerHeight && r.top >= 0, pageScroll: document.scrollingElement.scrollHeight - innerHeight }; }) }; await page.locator('.start-button').scrollIntoViewIfNeeded(); await shot(page, `V-${tag}-02b-world-start.png`); return r; });
  await step('newGame', async () => {
    await page.getByRole('button', { name: /이 땅에서 시작/ }).click();
    await waitSim(page, () => !!window.tgScene?.sim && window.tgScene.sim.buildings.length === 0 && window.tgScene.mode === 'warehouse', null, 120000);
    await page.waitForTimeout(600); await shot(page, `V-${tag}-03-new-game.png`);
    const r = { hud: await hud(page), layout: await audit(page) };
    // Warehouse: touch needs a tap to aim and a second tap to confirm; count what it takes.
    const p = await tilePoint(page, 11, 12); r.warehousePoint = p;
    if (touch) { await page.touchscreen.tap(p.px, p.py); await page.waitForTimeout(250); r.afterFirstTap = { built: await sim(page, () => window.tgScene.sim.buildings.length), toasts: await page.locator('[data-sonner-toast]').allInnerTexts() }; await page.touchscreen.tap(p.px, p.py); await page.waitForTimeout(300); }
    else { await page.mouse.click(p.px, p.py); await page.waitForTimeout(300); }
    r.built = await sim(page, () => window.tgScene.sim.buildings.map(b => b.type));
    await page.waitForTimeout(400); await shot(page, `V-${tag}-04-warehouse.png`);
    r.hudAfter = await hud(page); r.layoutAfter = await audit(page);
    return r;
  });
  await step('guideHouse', async () => {
    const b = page.locator('.tutorial-card button', { hasText: '주민 주택 선택' });
    if (!(await b.count())) return { guideButton: false, tutorial: await visible(page, '.tutorial-card') };
    await b.click(); await page.waitForTimeout(300);
    await shot(page, `V-${tag}-05-placing.png`);
    const r = { hud: await hud(page), placementHint: await page.locator('.placement-hint').innerText().catch(() => null) };
    const p = await tilePoint(page, 10, 12, false); r.point = p;
    if (touch) { await page.touchscreen.tap(p.px, p.py); await page.waitForTimeout(250); await page.touchscreen.tap(p.px, p.py); } else await page.mouse.click(p.px, p.py);
    await page.waitForTimeout(400); r.built = await sim(page, () => window.tgScene.sim.buildings.map(b => b.type));
    await shot(page, `V-${tag}-06-after-house.png`); r.hudAfter = await hud(page);
    return r;
  });
  await step('buildDock', async () => {
    await closeAll(page); await page.getByRole('button', { name: '건설 목록 열기' }).click(); await page.locator('.build-dock').waitFor(); await page.waitForTimeout(300);
    const r = { hud: await hud(page), layout: await audit(page, '.build-dock'), tabs: await page.locator('.build-dock [role=tab]').evaluateAll(ts => ts.map(t => { const r = t.getBoundingClientRect(), p = t.closest('[role=tablist]').getBoundingClientRect(); return { t: t.innerText.trim(), visible: r.left >= p.left - 1 && r.right <= p.right + 1 }; })), items: await page.locator('.build-item').evaluateAll(bs => { const p = document.querySelector('.build-items').getBoundingClientRect(); return { total: bs.length, fullyVisible: bs.filter(b => { const r = b.getBoundingClientRect(); return r.left >= p.left - 1 && r.right <= p.right + 1; }).length, itemW: Math.round(bs[0]?.getBoundingClientRect().width || 0), itemH: Math.round(bs[0]?.getBoundingClientRect().height || 0) }; }) };
    await shot(page, `V-${tag}-07-build-dock.png`);
    // The dock must scroll to its last item with the input this device has.
    const el = page.locator('.build-items'); const box = await el.boundingBox();
    if (touch) { await page.evaluate(() => { document.querySelector('.build-items').scrollLeft = 0; }); await page.mouse.move(0, 0); const c = await page.context().newCDPSession(page); await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width - 20, y: box.y + box.height / 2 }] }); for (let k = 1; k <= 10; k++) await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width - 20 - k * 25, y: box.y + box.height / 2 }] }); await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(300); r.swipeScrolled = await page.evaluate(() => document.querySelector('.build-items').scrollLeft); }
    else { await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.wheel(0, 400); await page.waitForTimeout(300); r.wheelScrolled = await page.evaluate(() => document.querySelector('.build-items').scrollLeft); }
    await page.getByRole('button', { name: '건설 목록 닫기' }).click();
    return r;
  });
  await step('facility', async () => {
    await closeAll(page); const w = await sim(page, () => { const b = window.tgScene.sim.warehouse; return [b.x, b.z]; });
    const p = await tilePoint(page, w[0], w[1]); if (touch) await page.touchscreen.tap(p.px, p.py); else await page.mouse.click(p.px, p.py);
    await page.waitForTimeout(400); const r = { open: await visible(page, '.facility-card'), hud: await hud(page), layout: await audit(page, '.facility-card') };
    await shot(page, `V-${tag}-08-facility.png`); await closeAll(page); return r;
  });
  await step('tile', async () => {
    const e = await sim(page, () => { const s = window.tgScene.sim; for (const k of s.owned) { const [x, z] = k.split(',').map(Number); if (!s.at(x, z) && s.tile(x, z).terrain !== 'water' && !s.tile(x, z).nature) return [x, z]; } return null; });
    const p = await tilePoint(page, e[0], e[1]); if (touch) await page.touchscreen.tap(p.px, p.py); else await page.mouse.click(p.px, p.py);
    await page.waitForTimeout(400); const r = { open: await visible(page, '.tile-panel'), hud: await hud(page), layout: await audit(page, '.tile-panel') };
    await shot(page, `V-${tag}-09-tile.png`); await page.keyboard.press('Escape'); await closeAll(page); return r;
  });
  await step('dialogs', async () => {
    const r = {};
    for (const [key, opener] of [['market', () => page.getByRole('button', { name: '시장', exact: true }).click()], ['goals', () => page.locator('.objective-card').click()], ['residents', () => page.locator('.resident-access').click()], ['world', () => page.getByRole('button', { name: '세계 지도' }).click()], ['settings', () => page.getByRole('button', { name: '게임 설정' }).click()], ['help', () => page.getByRole('button', { name: '도움말' }).click()]]) {
      try { await opener(); await page.locator('[role=dialog]').waitFor({ timeout: 5000 }); await page.waitForTimeout(450); r[key] = { fit: await dialogFit(page), layout: await audit(page, '[role=dialog]') }; await shot(page, `V-${tag}-10-${key}.png`); const x = page.locator('[role=dialog] [data-slot=dialog-close]').first(); if (await x.count()) { const b = await x.boundingBox(); r[key].closeButton = b && { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), inView: b.y >= 0 && b.x + b.width <= vp.width }; } } catch (e) { r[key] = { error: e.message.split('\n')[0] }; }
      await closeAll(page);
    }
    return r;
  });
  await step('mapEdges', async () => { await page.getByRole('button', { name: '주변 지형' }).click(); await page.waitForTimeout(300); const r = { hud: await hud(page), layout: await audit(page, '.map-edges-card') }; await shot(page, `V-${tag}-11-map-edges.png`); await page.getByRole('button', { name: '주변 지형 닫기' }).click().catch(() => {}); return r; });
  if (touch) await step('touchCamera', async () => {
    // One-finger drag pans, two-finger pinch zooms (help text promises both).
    const c = await page.context().newCDPSession(page), cx = vp.width / 2, cy = vp.height / 2;
    const cam = () => sim(page, () => ({ zoom: +window.tgScene.camera.zoom.toFixed(3), target: window.tgScene.controls.target.toArray().map(v => +v.toFixed(2)) }));
    const before = await cam();
    await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 1 }] });
    for (let k = 1; k <= 10; k++) await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + k * 8, y: cy + k * 5, id: 1 }] });
    await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(400);
    const afterPan = await cam();
    await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx - 30, y: cy, id: 1 }, { x: cx + 30, y: cy, id: 2 }] });
    for (let k = 1; k <= 10; k++) await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx - 30 - k * 10, y: cy, id: 1 }, { x: cx + 30 + k * 10, y: cy, id: 2 }] });
    await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(400);
    const afterPinch = await cam();
    return { before, afterPan, afterPinch, panned: JSON.stringify(before.target) !== JSON.stringify(afterPan.target), pinchZoomed: afterPinch.zoom !== afterPan.zoom, selectedAfterGestures: await visible(page, '.facility-card, .tile-panel') };
  });
  await step('showcase', async () => {
    await page.getByRole('button', { name: '게임 설정' }).click(); await page.getByRole('button', { name: '시작 화면으로' }).click(); await page.waitForTimeout(500);
    await page.getByRole('button', { name: '산업도시 둘러보기' }).click();
    await waitSim(page, () => window.tgScene?.sim?.buildings.length > 10 && !document.querySelector('.screen-loading'), null, 120000); await page.waitForTimeout(1200);
    await shot(page, `V-${tag}-12-showcase.png`);
    const r = { hud: await hud(page), layout: await audit(page), markers: await page.evaluate(() => { const ms = [...document.querySelectorAll('.facility-marker')].map(m => m.getBoundingClientRect()); let over = 0; for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) { const a = ms[i], b = ms[j]; if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 4 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 4) over++; } const hudSel = '.operations-card,.objective-card,.time-controls,.resource-strip,.world-access,.camera-controls,.town-actions,.map-edges,.demo-badge'; const huds = [...document.querySelectorAll(hudSel)].filter(e => e.getClientRects().length).map(e => e.getBoundingClientRect()); const underHud = ms.filter(a => huds.some(b => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 4 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 4)).length; return { count: ms.length, overlappingPairs: over, underHud }; }) };
    return r;
  });
  await page.close();
}
V.R = R;
await save('viewports.json', V);
console.log(JSON.stringify(V, (k, v) => (k === 'blocks' ? undefined : v), 1).slice(0, 20000));
await browser.close();
