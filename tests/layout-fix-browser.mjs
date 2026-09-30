// Browser check for the 2026-09-29 layout/input fixes (F3b): touch placement under the placement hint (B1), tile panel
// fit in landscape (B6), map-edges card vs time controls (B14), phone start button (J11), home 체험·점검 fold (J14),
// dimmed resources outside the owned land (J4), blank hover marker (B12), marker overlap (B13) and icon startup (B7).
// Needs the dev server (module hooks). Usage:
//   TG_OUT=docs/verification/fix-20260929 TG_GPU=1 node tests/layout-fix-browser.mjs <playwright/index.mjs> <chrome.exe>
import { R, open, toHome, sim, waitSim, shot, save, browser, log, tilePoint, raf, closeAll } from './audit-2/_browser.mjs';

const label = process.env.TG_LABEL || 'after', out = { label, sizes: {} };
const overlap = (page, a, b) => page.evaluate(([a, b]) => { const A = document.querySelector(a)?.getBoundingClientRect(), B = document.querySelector(b)?.getBoundingClientRect(); if (!A || !B || !A.width || !B.width) return null; const w = Math.min(A.right, B.right) - Math.max(A.left, B.left), h = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top); return w > 0 && h > 0 ? [Math.round(w), Math.round(h)] : 0; }, [a, b]);
const openExtras = async page => { const s = page.locator('.home-extras summary'); if (await s.count() && !(await page.locator('.home-extras[open]').count())) await s.click(); };
const tap = async (page, touch, x, y) => { if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); await page.waitForTimeout(250); };

for (const vp of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 844, height: 390 }].filter(v => !process.env.TG_SIZES || process.env.TG_SIZES.split(',').includes(v.width + 'x' + v.height))) {
  const touch = vp.width < 900, page = await open(vp, touch ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}), tag = page.tag, r = out.sizes[tag] = {};
  try {
    log(tag + ' home');
    await toHome(page);
    // J14: the five trial/check links are one labelled group (open by default), still reachable.
    r.home = await page.evaluate(() => { const g = document.querySelector('.home-extras'), links = g ? [...g.querySelectorAll('a,button:not(summary)')] : []; return { folded: g?.tagName === 'DETAILS' && !g.open, summary: g?.querySelector('summary')?.innerText.trim(), items: links.map(l => l.innerText.trim()), visibleWhileFolded: links.filter(l => l.getClientRects().length && l.getBoundingClientRect().height > 0).length }; });
    await shot(page, `home-${tag}.png`);
    await openExtras(page); await page.waitForTimeout(150);
    r.home.visibleWhenOpen = await page.evaluate(() => [...document.querySelectorAll('.home-extras a,.home-extras button')].filter(l => { const b = l.getBoundingClientRect(); return b.height > 0 && b.bottom <= innerHeight && b.top >= 0; }).length);
    await shot(page, `home-open-${tag}.png`);
    // J11: the start button on the world map is on screen without scrolling.
    log(tag + ' world');
    await page.getByRole('button', { name: '새 게임' }).click();
    const start = page.getByRole('button', { name: /이 땅에서 시작/ }); await start.waitFor();
    await page.waitForTimeout(400);
    r.world = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(v => /이 땅에서 시작/.test(v.innerText)), q = b.getBoundingClientRect(), top = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return { box: [q.left, q.top, q.width, q.height].map(Math.round), inViewport: q.top >= 0 && q.bottom <= innerHeight, hittable: b.contains(top) }; });
    await shot(page, `world-${tag}.png`);
    await page.evaluate(() => document.querySelector('.world-map-screen')?.scrollTo(0, 99999)); await page.waitForTimeout(200);
    r.world.afterScroll = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(v => /이 땅에서 시작/.test(v.innerText)), q = b.getBoundingClientRect(), top = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return { inViewport: q.top >= 0 && q.bottom <= innerHeight, hittable: b.contains(top), coversEnd: [...document.querySelectorAll('.realm-sheet details summary')].slice(-1).map(s => { const t = s.getBoundingClientRect(); return t.bottom > q.top && t.top < q.bottom; })[0] ?? null }; });
    await shot(page, `world-scrolled-${tag}.png`);
    await page.evaluate(() => document.querySelector('.world-map-screen')?.scrollTo(0, 0));
    await start.click();
    await waitSim(page, () => !!window.tgScene?.sim && window.tgScene.sim.buildings.length === 0 && window.tgScene.mode === 'warehouse', null, 120000);
    await page.waitForTimeout(800);
    // B1: tap the warehouse onto a tile that lies under the placement hint box; two taps (touch) must build it.
    log(tag + ' place');
    const hint = await page.evaluate(() => { const b = document.querySelector('.placement-hint')?.getBoundingClientRect(); return b && [b.left, b.top, b.right, b.bottom]; });
    const cand = await sim(page, hint => { const s = window.tgScene, rect = s.renderer.domElement.getBoundingClientRect(), list = []; for (const k of s.sim.owned) { const [x, z] = k.split(',').map(Number); if (s.sim.canBuild('warehouse', x, z)) continue; const v = s.camera.position.clone().set(x, 0, z).project(s.camera), px = rect.left + (v.x + 1) / 2 * rect.width, py = rect.top + (1 - v.y) / 2 * rect.height; list.push({ x, z, px, py, underHint: !!hint && px > hint[0] + 6 && px < hint[2] - 6 && py > hint[1] + 4 && py < hint[3] - 4 }); } return list; }, hint);
    r.place = { candidates: cand.length };
    let target = cand.find(c => c.underHint);
    if (!target && hint) {
      // Pan the camera so an owned buildable tile sits under the hint's centre.
      const c = cand[0], hx = (hint[0] + hint[2]) / 2, hy = (hint[1] + hint[3]) / 2;
      await sim(page, ([x, z, hx, hy]) => { const s = window.tgScene, rect = s.renderer.domElement.getBoundingClientRect(); const ndc = new window.tgScene.pointer.constructor((hx - rect.left) / rect.width * 2 - 1, -(hy - rect.top) / rect.height * 2 + 1); s.raycaster.setFromCamera(ndc, s.camera); const hit = s.camera.position.clone(); s.raycaster.ray.intersectPlane(s.plane, hit); s.controls.target.x += x - hit.x; s.camera.position.x += x - hit.x; s.controls.target.z += z - hit.z; s.camera.position.z += z - hit.z; s.controls.update(); }, [c.x, c.z, hx, hy]);
      await raf(page); const p = await tilePoint(page, c.x, c.z, false); target = { x: c.x, z: c.z, px: p.px, py: p.py, underHint: p.px > hint[0] && p.px < hint[2] && p.py > hint[1] && p.py < hint[3], panned: true };
    }
    if (!target) target = cand[Math.floor(cand.length / 2)];
    Object.assign(r.place, { hint: hint?.map(Math.round), target, elementAtTarget: await page.evaluate(([x, y]) => { const t = document.elementFromPoint(x, y); return t?.tagName === 'CANVAS' ? 'canvas' : String(t?.closest('[class]')?.className).slice(0, 40); }, [target.px, target.py]) });
    await tap(page, touch, target.px, target.py);
    r.place.afterFirst = await page.evaluate(([x, y]) => { const t = document.elementFromPoint(x, y), h = document.querySelector('.placement-hint')?.getBoundingClientRect(); return { top: t?.tagName === 'CANVAS' ? 'canvas' : String(t?.closest('[class]')?.className).slice(0, 40), hint: h && [h.left, h.top, h.width, h.height].map(Math.round) }; }, [target.px, target.py]);
    await shot(page, `place-first-tap-${tag}.png`);
    if (touch) await tap(page, touch, target.px, target.py);
    await page.waitForTimeout(300);
    r.place.built = await sim(page, () => window.tgScene.sim.buildings.map(b => b.type + '@' + b.x + ',' + b.z));
    await shot(page, `place-built-${tag}.png`);
    if (!r.place.built.length) { R.overrides = (R.overrides || []).concat(tag + ': warehouse via sim.build'); await sim(page, () => { const s = window.tgScene; for (const k of s.sim.owned) { const [x, z] = k.split(',').map(Number); if (!s.sim.canBuild('warehouse', x, z)) { s.sim.build('warehouse', x, z); break; } } s.setMode(null); }); }
    await closeAll(page); await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
    // J4: nature outside the owned land is drawn faded.
    r.nature = await sim(page, () => { const s = window.tgScene, n = s.nature.filter(o => o.userData.tile); const out = n.filter(o => !s.sim.ownedAt(o.userData.tile.x, o.userData.tile.z)), inside = n.filter(o => s.sim.ownedAt(o.userData.tile.x, o.userData.tile.z)); const faded = o => o.userData.sprite?.material.customProgramCacheKey?.() === 'pixel-unowned'; return { outside: out.length, outsideFaded: out.filter(faded).length, inside: inside.length, insideFaded: inside.filter(faded).length }; });
    if (tag === '1920x1080') { await sim(page, () => { const s = window.tgScene; s.zoom(.62); }); await raf(page); await page.waitForTimeout(400); await shot(page, `nature-dim-${tag}.png`); await sim(page, () => window.tgScene.resetCamera()); }
    // B6: empty owned tile panel fits the screen and is not under the resource strip.
    const e = await sim(page, () => { const s = window.tgScene.sim; for (const k of s.owned) { const [x, z] = k.split(',').map(Number); if (!s.at(x, z) && s.tile(x, z).terrain !== 'water' && !s.tile(x, z).nature) return [x, z]; } return null; });
    const q = await tilePoint(page, e[0], e[1]); await tap(page, touch, q.px, q.py); await page.waitForTimeout(300);
    r.tilePanel = await page.evaluate(() => { const t = document.querySelector('.tile-panel'); if (!t) return null; const b = t.getBoundingClientRect(); return { box: [b.left, b.top, b.width, b.height].map(Math.round), topCut: b.top < 0, bottomCut: b.bottom > innerHeight + 1, scrollable: t.scrollHeight > t.clientHeight + 2 }; });
    r.tileUnderHeader = await overlap(page, '.resource-strip', '.tile-panel');
    await shot(page, `tile-panel-${tag}.png`);
    await closeAll(page); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    // B14: the map-edges card does not cover the time controls or town actions.
    if (await page.getByRole('button', { name: '주변 지형' }).count()) {
      await page.getByRole('button', { name: '주변 지형' }).first().click(); await page.waitForTimeout(300);
      r.mapEdges = { time: await overlap(page, '.map-edges-card', '.time-controls'), actions: await overlap(page, '.map-edges-card', '.town-actions'), camera: await overlap(page, '.map-edges-card', '.camera-controls'), card: await page.evaluate(() => { const b = document.querySelector('.map-edges-card')?.getBoundingClientRect(); return b && { box: [b.left, b.top, b.width, b.height].map(Math.round), cut: b.top < 0 || b.bottom > innerHeight + 1 }; }) };
      await shot(page, `map-edges-${tag}.png`);
      await page.getByRole('button', { name: '주변 지형 닫기' }).click().catch(() => {});
    }
    // B12: a hovered non-production building marker shows its name (desktop only; touch has no hover).
    if (!touch) {
      const w = await sim(page, () => { const b = window.tgScene.sim.warehouse; return b && [b.x, b.z]; });
      const p = await tilePoint(page, w[0], w[1]); await page.mouse.move(p.px, p.py - 12); await page.waitForTimeout(700);
      r.hoverMarker = await page.evaluate(() => [...document.querySelectorAll('.facility-marker')].map(m => { const s = m.querySelector('span'), b = m.getBoundingClientRect(); return { text: m.innerText.trim(), spanShown: !!s && getComputedStyle(s).display !== 'none', size: [Math.round(b.width), Math.round(b.height)] }; }));
      await shot(page, `hover-marker-${tag}.png`, { clip: { x: Math.max(0, p.px - 150), y: Math.max(0, p.py - 170), width: 300, height: 240 } });
    }
  } catch (err) { r.error = String(err).slice(0, 300); await shot(page, `error-${tag}.png`).catch(() => {}); }
  await page.close();
}
// B13 + B7 on the industrial showcase: marker overlap per size and icon drawing cost at startup.
for (const vp of (process.env.TG_SKIP_SHOWCASE ? [] : [{ width: 1366, height: 768 }, { width: 844, height: 390 }])) {
  const touch = vp.width < 900, page = await open(vp, touch ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}), tag = page.tag;
  try {
    await toHome(page); await openExtras(page);
    const lt0 = await page.evaluate(() => window.tgLongTasks.length);
    await page.getByRole('button', { name: '산업도시 둘러보기' }).click();
    await waitSim(page, () => window.tgScene?.sim?.buildings.length > 3 && !document.querySelector('.screen-loading'), null, 120000);
    await page.waitForTimeout(2500);
    out.showcase = out.showcase || {};
    out.showcase[tag] = await page.evaluate(() => { const m = [...document.querySelectorAll('.facility-marker')].map(e => e.getBoundingClientRect()).filter(b => b.width); let pairs = 0; for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) { const w = Math.min(m[i].right, m[j].right) - Math.max(m[i].left, m[j].left), h = Math.min(m[i].bottom, m[j].bottom) - Math.max(m[i].top, m[j].top); if (w > 2 && h > 2) pairs++; } return { markers: m.length, overlappingPairs: pairs, meanWidth: Math.round(m.reduce((a, b) => a + b.width, 0) / (m.length || 1)) }; });
    out.showcase[tag].icons = await sim(page, () => { const s = window.tgScene; return { drawn: s.buildingIcons?.size, pending: s.iconPending?.size, total: Object.keys(s.iconCache?.values().next().value || {}).length }; });
    out.showcase[tag].longTasksShowcase = (await page.evaluate(() => window.tgLongTasks)).slice(lt0).map(t => t.d).sort((a, b) => b - a).slice(0, 5);
    out.showcase[tag].longTasksAll = (await page.evaluate(() => window.tgLongTasks)).map(t => t.d).sort((a, b) => b - a).slice(0, 6);
    await shot(page, `showcase-markers-${tag}.png`);
    // Build dock shows drawn icons (no empty images for any facility in the open tab).
    await page.getByRole('button', { name: '건설 목록 열기' }).click(); await page.waitForTimeout(600);
    out.showcase[tag].dockImages = await page.evaluate(() => { const imgs = [...document.querySelectorAll('.build-dock img')]; return { count: imgs.length, empty: imgs.filter(i => !i.getAttribute('src')).length, broken: imgs.filter(i => i.complete && i.getAttribute('src') && !i.naturalWidth).length }; });
    await shot(page, `showcase-dock-${tag}.png`);
  } catch (err) { out.showcaseError = String(err).slice(0, 300); }
  await page.close();
}
out.R = R;
await save('layout-' + label + '.json', out);
console.log(JSON.stringify(out, null, 1).slice(0, 12000));
await browser.close();
