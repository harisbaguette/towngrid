// F3a marker probe (산업도시 둘러보기, no save): B13 overlapping markers at 1366x768 and 844x390 (labels off / on),
// B11 marker-to-building offset sampled inside the frame while dragging, B12 hovered warehouse marker names itself.
import { R, open, toHome, demo, sim, browser, save, shot, tilePoint } from './_setup.mjs';
import { settle } from './_setup.mjs';
const out = {};
const pairs = page => page.evaluate(() => { const els = [...document.querySelectorAll('.facility-marker')].filter(e => e.style.visibility !== 'hidden' && e.getClientRects().length), rs = els.map(e => e.getBoundingClientRect()); let n = 0; const ex = []; for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const w = Math.min(rs[i].right, rs[j].right) - Math.max(rs[i].left, rs[j].left), h = Math.min(rs[i].bottom, rs[j].bottom) - Math.max(rs[i].top, rs[j].top); if (w > 2 && h > 2) { n++; if (ex.length < 3) ex.push(els[i].innerText.replace(/\s+/g, ' ') + ' / ' + els[j].innerText.replace(/\s+/g, ' ')); } } return { markers: els.length, overlappingPairs: n, examples: ex, grouped: [...document.querySelectorAll('.marker-more')].map(e => e.innerText) }; });
const labels = async page => { await page.getByRole('button', { name: '건설 목록 열기' }).click(); await page.getByRole('button', { name: '시설 이름 표시' }).click(); await page.getByRole('button', { name: '건설 목록 닫기' }).click(); await settle(page, 900); };
// Offset between each marker's anchor and its building's projected point, read in a frame after the scene's own loop ran.
const offset = page => page.evaluate(() => new Promise(res => requestAnimationFrame(() => { const g = window.tgScene, w = g.container.clientWidth, h = g.container.clientHeight, list = []; for (const el of document.querySelectorAll('.facility-marker')) { const b = g.sim.buildings.find(v => v.id === +el.dataset.buildingId); if (!b || getComputedStyle(el).visibility === 'hidden') continue; const p = g.markerPoint(b, w, h), r = el.getBoundingClientRect(); list.push(Math.round(Math.hypot(r.left + r.width / 2 - p.x, r.bottom - p.y))); } res({ n: list.length, max: Math.max(0, ...list) }); })));
for (const vp of [{ width: 1366, height: 768 }, { width: 844, height: 390, isMobile: true, hasTouch: true }]) {
  const { width, height, ...extra } = vp, tag = width + 'x' + height, page = await open({ width, height }, extra);
  await toHome(page); await page.locator('.home-extras').waitFor(); if (!(await page.locator('.home-extras[open]').count())) await page.locator('.home-extras summary').click(); await demo(page); await sim(page, () => { window.tgScene.sim.paused = true; }); await settle(page, 1200);
  out[tag] = { minimal: await pairs(page) }; await shot(page, 'm-B13-markers-' + tag + '.png');
  await labels(page); out[tag].labels = await pairs(page); await shot(page, 'm-B13-markers-labels-' + tag + '.png');
  if (width === 1366) {
    out.B11 = { still: await offset(page) };
    await page.mouse.move(683, 420); await page.mouse.down(); const mid = [];
    for (let i = 1; i <= 14; i++) { await page.mouse.move(683 - i * 18, 420 - i * 6); mid.push((await offset(page)).max); }
    out.B11.midDragMax = mid; await shot(page, 'm-B11-mid-drag.png');
    await page.mouse.up(); await settle(page, 300); out.B11.after = await offset(page);
    await labels(page);
    const wh = await sim(page, () => { const b = window.tgScene.sim.warehouse; return { x: b.x, z: b.z, id: b.id }; });
    const pt = await tilePoint(page, wh.x, wh.z); await page.mouse.move(pt.px - 3, pt.py - 3); await page.mouse.move(pt.px, pt.py - 10); await settle(page, 900);
    out.B12 = { sceneHover: await sim(page, () => window.tgScene.hover), marker: await page.evaluate(id => { const el = document.querySelector(`.facility-marker[data-building-id="${id}"]`); if (!el) return null; const r = el.getBoundingClientRect(), span = el.querySelector('span'); return { text: el.innerText.trim(), spanDisplay: span && getComputedStyle(span).display, size: [Math.round(r.width), Math.round(r.height)] }; }, wh.id) };
    await shot(page, 'm-B12-hover-warehouse.png', { clip: { x: Math.max(0, pt.px - 160), y: Math.max(0, pt.py - 170), width: 320, height: 240 } });
  }
  await page.context().close();
}
out.R = R; await save('probe-markers.json', out); console.log(JSON.stringify(out, null, 1)); await browser.close();
