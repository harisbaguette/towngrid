// Audit 2026-09-29 stage B, probe 5: re-check of every UI finding on the tree as it is when this runs
// (other sessions were editing Game.tsx / WorldAtlas.tsx / CSS during the audit). One JSON entry per finding id,
// each with the measured value and the screenshot that shows it.
// Usage: node tests/audit-2/browser-recheck.mjs <playwright/index.mjs> <chrome.exe>
import { R, open, toHome, newGameFromHome, demo, shot, sim, waitSim, visible, save, clickTile, tilePoint, closeAll, audit, raf, browser, log } from './_browser.mjs';
const C = { at: new Date().toISOString(), overrides: [] };
const step = async (key, page, fn) => { log(key); try { C[key] = await fn(); await save(process.env.TG_DESKTOP_ONLY ? 'recheck-desktop.json' : 'recheck.json', C); } catch (e) { C[key] = { ...(C[key] || {}), error: e.message.split('\n')[0] }; await shot(page, `K-error-${key}.png`).catch(() => {}); await closeAll(page).catch(() => {}); } };
const overlap = (page, a, b) => page.evaluate(([a, b]) => { const A = [...document.querySelectorAll(a)].filter(e => e.getClientRects().length), B = [...document.querySelectorAll(b)].filter(e => e.getClientRects().length); const out = []; for (const x of A) for (const y of B) { const p = x.getBoundingClientRect(), q = y.getBoundingClientRect(); const w = Math.min(p.right, q.right) - Math.max(p.left, q.left), h = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top); if (w > 4 && h > 4) { const cx = Math.max(p.left, q.left) + w / 2, cy = Math.max(p.top, q.top) + h / 2, top = document.elementFromPoint(cx, cy); out.push({ w: Math.round(w), h: Math.round(h), onTop: top ? (x.contains(top) ? a : y.contains(top) ? b : String(top.className).slice(0, 40)) : null, a: [Math.round(p.left), Math.round(p.top), Math.round(p.width), Math.round(p.height)], b: [Math.round(q.left), Math.round(q.top), Math.round(q.width), Math.round(q.height)] }); } } return out; }, [a, b]);

// ---------- Desktop 1920x1080 ----------
{
  const page = await open({ width: 1920, height: 1080 });
  await toHome(page);
  await step('K01-galleryEsc', page, async () => { await page.getByRole('button', { name: '마을의 하루' }).click(); await page.keyboard.press('Escape'); await page.waitForTimeout(300); const r = { stillInGallery: await visible(page, '.art-gallery') }; await shot(page, 'K01-gallery-after-esc.png'); if (r.stillInGallery) await page.getByRole('button', { name: /홈으로/ }).click(); return r; });
  await step('K02-worldAtlas', page, async () => { await page.getByRole('button', { name: '새 게임' }).click(); await page.getByRole('button', { name: /이 땅에서 시작/ }).waitFor(); await page.waitForTimeout(800); await shot(page, 'K02-world-map-1920.png'); const r = await page.evaluate(() => { const a = document.querySelector('.world-atlas'), b = a?.getBoundingClientRect(); const big = [...document.querySelectorAll('.world-map-screen svg')].filter(s => !s.classList.contains('world-atlas') && !s.closest('.world-atlas')).map(s => s.getBoundingClientRect()).filter(r => r.width > 80 || r.height > 80).length; return { atlas: b && [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)], atlasInView: !!b && b.top < innerHeight && b.bottom > 0 && b.width > 200, oversizedIcons: big }; }); const before = await page.locator('#realm').inputValue(); const lab = page.locator('.world-atlas .atlas-label:not(.selected)').nth(3); if (await lab.count()) { await lab.click({ force: true }); await page.waitForTimeout(300); } r.clickOnMapChangesNation = before !== await page.locator('#realm').inputValue(); return r; });
  await step('K03-newGame', page, async () => { await page.locator('#realm').selectOption('estern'); const t0 = Date.now(); await page.getByRole('button', { name: /이 땅에서 시작/ }).click(); await waitSim(page, () => !!window.tgScene?.sim && window.tgScene.mode === 'warehouse', null, 120000); const ms = Date.now() - t0; await page.locator('.header-actions button[aria-label="게임 설정"]').click(); await page.locator('[role=dialog]').waitFor(); await page.keyboard.press('Escape'); await page.waitForTimeout(300); const modeAfterDialogEsc = await sim(page, () => window.tgScene.mode); if (!modeAfterDialogEsc) { await page.locator('.tutorial-card button', { hasText: '창고' }).click().catch(() => {}); } await clickTile(page, 11, 12); await waitSim(page, () => window.tgScene.sim.buildings.some(b => b.type === 'warehouse'), null, 10000); return { ms, modeAfterDialogEsc }; });
  await step('K04-blankMarker', page, async () => {
    await closeAll(page); const p = await tilePoint(page, 11, 12); await page.mouse.move(p.px + 2, p.py + 2); await page.waitForTimeout(700);
    const r = await page.evaluate(() => [...document.querySelectorAll('.facility-marker')].map(m => { const s = m.querySelector('span'), r = m.getBoundingClientRect(); return { text: m.innerText.trim(), span: s?.textContent, spanDisplay: s ? getComputedStyle(s).display : null, icon: !!m.querySelector('img,svg,canvas,i[style*=background]'), size: [Math.round(r.width), Math.round(r.height)], cls: m.className }; }));
    const b = await page.locator('.facility-marker').first().boundingBox(); if (b) await shot(page, 'K04-blank-marker.png', { clip: { x: b.x - 120, y: b.y - 60, width: 300, height: 220 } });
    return r;
  });
  await step('K05-dialogExit', page, async () => { await closeAll(page); await page.locator('.objective-card').click(); await page.locator('[role=dialog]').waitFor(); await page.waitForTimeout(500); await page.keyboard.press('Escape'); const f = []; for (let k = 0; k < 6; k++) { f.push(await page.evaluate(() => { const d = document.querySelector('[role=dialog]'); return d ? { title: d.querySelector('h2')?.innerText.replace(/\s+/g, ' '), chars: d.innerText.length, opacity: +(+getComputedStyle(d).opacity).toFixed(2) } : null; })); if (k === 0) await shot(page, 'K05-dialog-exit-frame.png'); await page.waitForTimeout(30); } return f; });
  await step('K06-mapEdgesEsc', page, async () => { await closeAll(page); await page.getByRole('button', { name: '주변 지형' }).click(); await page.waitForTimeout(250); await page.keyboard.press('Escape'); await page.waitForTimeout(250); const r = { openAfterEsc: await visible(page, '.map-edges-card') }; await shot(page, 'K06-map-edges-after-esc.png'); await page.getByRole('button', { name: '주변 지형 닫기' }).click().catch(() => {}); return r; });
  await step('K07-markerLag', page, async () => {
    await closeAll(page); await page.getByRole('button', { name: '건설 목록 열기' }).click(); await page.getByRole('button', { name: '시설 이름 표시' }).click(); await page.getByRole('button', { name: '건설 목록 닫기' }).click(); await page.waitForTimeout(600);
    // Pan the camera with a real drag and screenshot mid-drag: markers vs their building.
    const probe = () => page.evaluate(() => { const s = window.tgScene, r = s.renderer.domElement.getBoundingClientRect(); return [...document.querySelectorAll('.facility-marker')].map(m => { const b = s.sim.buildings.find(v => v.id === +m.dataset.buildingId); if (!b) return null; const v = s.camera.position.clone().set(b.x, 1.2, b.z); v.project(s.camera); const mr = m.getBoundingClientRect(); return Math.round(Math.hypot(mr.x + mr.width / 2 - ((v.x + 1) / 2 * r.width + r.left), mr.bottom - ((1 - v.y) / 2 * r.height + r.top))); }).filter(v => v != null); });
    const still = await probe();
    await page.mouse.move(960, 540); await page.mouse.down(); await page.mouse.move(1160, 640, { steps: 6 }); const mid = await probe(); await shot(page, 'K07-marker-lag-mid-drag.png'); await page.mouse.up(); await page.waitForTimeout(600); const after = await probe();
    return { offsetPxStill: still, offsetPxMidDrag: mid, offsetPxAfter: after };
  });
  await step('K08-healthOverlap', page, async () => {
    await closeAll(page);
    C.overrides.push('health.infection=35, rank=1 (operations card shown with the infection alert)');
    await sim(page, () => { const s = window.tgScene.sim; s.rank = Math.max(1, s.rank); s.health.infection = 35; });
    await page.getByRole('button', { name: '1×' }).click(); await page.waitForTimeout(900);
    const r = { overlap: await overlap(page, '.operations-card', '.health-alert'), healthText: await page.locator('.health-alert').innerText().catch(() => null) };
    const btn = page.locator('.health-alert button').first(); if (await btn.count()) { const b = await btn.boundingBox(); r.sanitizeButtonReachable = await page.evaluate(([x, y]) => { const t = document.elementFromPoint(x, y); return !!t?.closest('.health-alert'); }, [b.x + b.width / 2, b.y + b.height / 2]); }
    await shot(page, 'K08-health-alert-overlap.png'); return r;
  });
  await step('K09-stormNumbers', page, async () => {
    await page.getByRole('button', { name: '4×' }).click(); C.overrides.push('nextEvent = now + 1');
    await sim(page, () => { const s = window.tgScene.sim; s.nextEvent = s.time + 1; }); await waitSim(page, () => !!window.tgScene.sim.pendingEvent, null, 20000); await page.waitForTimeout(400);
    const r = { event: await sim(page, () => window.tgScene.sim.pendingEvent.type), toast: await page.locator('[data-sonner-toast]').allInnerTexts(), hud: await page.locator('.weather-warning').innerText().catch(() => null) };
    await page.waitForTimeout(2000); r.hudAfter2s = await page.locator('.weather-warning').innerText().catch(() => null); await shot(page, 'K09-storm-4x.png'); await page.getByRole('button', { name: '1×' }).click(); return r;
  });
  await page.close();
}
// ---------- Help reachability and touch placement at the other sizes ----------
for (const vp of (process.env.TG_DESKTOP_ONLY ? [] : [{ width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 844, height: 390 }])) {
  const touch = vp.width < 900, page = await open(vp, touch ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}), tag = page.tag;
  await toHome(page);
  await step(`K11-place-${tag}`, page, async () => { await newGameFromHome(page);
    const p = await tilePoint(page, 11, 12); const r = { point: [Math.round(p.px), Math.round(p.py)], onCanvasBefore: p.onCanvas };
    if (touch) { await page.touchscreen.tap(p.px, p.py); await page.waitForTimeout(300); r.afterFirstTapTop = await page.evaluate(([x, y]) => { const t = document.elementFromPoint(x, y); return t?.tagName === 'CANVAS' ? 'canvas' : String(t?.closest('[class]')?.className).slice(0, 50); }, [p.px, p.py]); await shot(page, `K11-after-first-tap-${tag}.png`); await page.touchscreen.tap(p.px, p.py); await page.waitForTimeout(400); }
    else { await page.mouse.click(p.px, p.py); await page.waitForTimeout(300); }
    r.built = await sim(page, () => window.tgScene.sim.buildings.map(b => b.type)); await shot(page, `K11-after-second-tap-${tag}.png`);
    if (!r.built.length) { await page.keyboard.press('Escape'); }
    return r;
  });
  await step(`K10-help-${tag}`, page, async () => { const r = await page.evaluate(() => { const h = document.querySelector('[aria-label="도움말"]'); return { helpButtonVisible: !!h && !!h.getClientRects().length && getComputedStyle(h).display !== 'none', anyHelpRoute: [...document.querySelectorAll('button')].filter(b => /도움말|조작법/.test((b.getAttribute('aria-label') || '') + b.innerText) && b.getClientRects().length).map(b => b.getAttribute('aria-label') || b.innerText) }; }); if (!r.helpButtonVisible) { await page.locator('.header-actions button[aria-label="게임 설정"]').click(); await page.locator('[role=dialog]').waitFor(); r.settingsHasHelp = await page.locator('[role=dialog] button', { hasText: /조작|도움/ }).count(); await page.keyboard.press('Escape'); } await shot(page, `K10-help-${tag}.png`); return r; });
  await step(`K12-layout-${tag}`, page, async () => {
    if (!(await sim(page, () => window.tgScene.sim.buildings.length))) { C.overrides.push(tag + ': warehouse placed through sim.build (tap placement failed)'); await sim(page, () => { const s = window.tgScene.sim; s.build('warehouse', 11, 12); window.tgScene.setMode(null); }); await page.keyboard.press('Escape'); }
    const r = {};
    await closeAll(page); await page.getByRole('button', { name: '건설 목록 열기' }).click(); await page.locator('.build-dock').waitFor(); await page.waitForTimeout(300);
    r.dockCoveredByGuide = await overlap(page, '.tutorial-card', '.build-dock'); r.dockLayout = await audit(page, '.build-dock'); await shot(page, `K12-dock-${tag}.png`);
    await page.getByRole('button', { name: '건설 목록 닫기' }).click();
    const e = await sim(page, () => { const s = window.tgScene.sim; for (const k of s.owned) { const [x, z] = k.split(',').map(Number); if (!s.at(x, z) && s.tile(x, z).terrain !== 'water' && !s.tile(x, z).nature) return [x, z]; } return null; });
    const q = await tilePoint(page, e[0], e[1]); if (touch) await page.touchscreen.tap(q.px, q.py); else await page.mouse.click(q.px, q.py); await page.waitForTimeout(400);
    r.tilePanel = await page.evaluate(() => { const t = document.querySelector('.tile-panel'); if (!t) return null; const b = t.getBoundingClientRect(); return { box: [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)], topCut: b.top < 0, bottomCut: b.bottom > innerHeight, scrollable: t.scrollHeight > t.clientHeight + 2 }; });
    r.tileUnderHeader = await overlap(page, '.resource-strip', '.tile-panel'); await shot(page, `K12-tile-${tag}.png`); await closeAll(page); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '주변 지형' }).click(); await page.waitForTimeout(300);
    r.mapEdgesOver = { camera: await overlap(page, '.map-edges-card', '.camera-controls'), time: await overlap(page, '.map-edges-card', '.time-controls'), actions: await overlap(page, '.map-edges-card', '.town-actions') }; await shot(page, `K12-map-edges-${tag}.png`); await page.getByRole('button', { name: '주변 지형 닫기' }).click().catch(() => {});
    r.tinyTargets = (await audit(page)).tinyTargets;
    return r;
  });
  await page.close();
}
C.R = R;
await save(process.env.TG_DESKTOP_ONLY ? 'recheck-desktop.json' : 'recheck.json', C);
console.log(JSON.stringify(C, null, 1).slice(0, 15000));
await browser.close();
