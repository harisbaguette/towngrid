// Audit 2026-09-30 (G2) probe: the screens added after the 2026-09-29 audit, driven with real input at four sizes.
// Home and 체험·점검, 마을의 하루 gallery (every picture and thumbnail), screen transitions, world atlas v2 (zoom buttons,
// wheel, drag, two-finger pinch, label overlap/clipping), start-site picking (every playable nation x 5 sites + local map
// preview layers), new game start, campaign window (every tab, site offer + preview), founding and visiting a new site
// from a fixture save, and farm/transport motion in the real showcase. Page errors, console errors and HTTP >= 400 are kept.
// Usage: TG_OUT=docs/verification/audit-20260930 node tests/audit-3/browser-new-screens.mjs <playwright/index.mjs> <chrome.exe>
//        (TG_SIZES=1920x1080,390x844 to limit sizes)
import { R, open, toHome, sim, waitSim, shot, save, browser, log, audit, raf, closeAll } from '../audit-2/_browser.mjs';
import { readFileSync } from 'node:fs';

const OUT = { sizes: {} };
const sizes = [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }, { width: 390, height: 844 }, { width: 844, height: 390 }]
  .filter(v => !process.env.TG_SIZES || process.env.TG_SIZES.split(',').includes(v.width + 'x' + v.height));

// Atlas state: viewBox, zoom band, labels (overlap + outside the viewport + text height).
const atlasState = page => page.evaluate(() => {
  const svg = document.querySelector('svg.world-atlas'); if (!svg) return null;
  const vb = svg.viewBox.baseVal, vp = svg.closest('.atlas-viewport').getBoundingClientRect();
  const labels = [...svg.querySelectorAll('.atlas-screen-label')].map(el => { const r = el.getBoundingClientRect(), t = (el.querySelector('text') || el).getBoundingClientRect(), plate = el.querySelector('rect'); return { id: el.dataset.label, text: el.textContent, x: r.x, y: r.y, w: r.width, h: r.height, th: t.height, tw: t.width, rw: plate ? plate.getBoundingClientRect().width : t.width, plate: !!plate, fontPx: parseFloat(getComputedStyle(el.querySelector('text') || el).fontSize) }; });
  const overlaps = [];
  for (const [i, a] of labels.entries()) for (const b of labels.slice(i + 1)) if (!(a.x + a.w <= b.x + .5 || b.x + b.w <= a.x + .5 || a.y + a.h <= b.y + .5 || b.y + b.h <= a.y + .5)) overlaps.push(a.id + '/' + b.id);
  const outside = labels.filter(l => l.x < vp.left - 1 || l.y < vp.top - 1 || l.x + l.w > vp.right + 1 || l.y + l.h > vp.bottom + 1).map(l => l.id);
  const textOverflow = labels.filter(l => l.tw > l.rw + 1).map(l => l.id + ' ' + Math.round(l.tw) + '>' + Math.round(l.rw));
  // Overlays drawn on top of the map (toolbar, zoom, minimap, compass) covering a label's centre.
  const covered = labels.filter(l => { const e = document.elementFromPoint(l.x + l.w / 2, l.y + l.h / 2); return e && !svg.contains(e); }).map(l => l.id + ' <- ' + String(document.elementFromPoint(l.x + l.w / 2, l.y + l.h / 2).closest('[class]')?.className?.baseVal ?? document.elementFromPoint(l.x + l.w / 2, l.y + l.h / 2).closest('[class]')?.className).slice(0, 40));
  return { vb: [vb.x, vb.y, vb.width, vb.height].map(v => Math.round(v)), detail: svg.closest('.atlas-shell').dataset.detail, labels: labels.length, minTextPx: labels.length ? Math.round(Math.min(...labels.map(l => l.th)) * 10) / 10 : null, overlaps, outside, textOverflow, covered, readout: document.querySelector('.atlas-cell-readout')?.innerText.replace(/\s+/g, ' ') };
});
// Two-finger pinch / one-finger drag through CDP touch events (they become pointer events like on a phone).
async function touch(page, cdp, steps) {
  for (const [type, pts] of steps) { await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: i + 1, radiusX: 4, radiusY: 4, force: 1 })) }); await page.waitForTimeout(30); }
  await raf(page);
}
const canvasHash = page => page.evaluate(() => { const c = document.querySelector('.local-map-preview canvas'); if (!c) return null; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0, colors = new Set(); for (let i = 0; i < d.length; i += 16) { h = (h * 31 + d[i] + d[i + 1] * 7 + d[i + 2] * 13) >>> 0; colors.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); } return { hash: h, colors: colors.size }; });

for (const vp of sizes) {
  const mobile = vp.width < 900, page = await open(vp, mobile ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}), tag = page.tag, r = OUT.sizes[tag] = {};
  const cdp = await page.context().newCDPSession(page);
  const errorsBefore = R.errors.length + R.consoleErrors.length + R.failedRequests.length;
  try {
    // ---------- Home ----------
    log(tag + ' home');
    r.home = { timing: await toHome(page) };
    await page.waitForTimeout(500);
    await shot(page, `${tag}-01-home.png`);
    r.home.layout = await audit(page, '.home-screen');
    r.home.extrasOpen = await page.locator('.home-extras[open]').count() > 0;
    r.home.art = await page.locator('.home-screen').getAttribute('data-art');

    // ---------- Gallery ----------
    log(tag + ' gallery');
    if (!r.home.extrasOpen) await page.locator('.home-extras summary').click();
    await page.getByRole('button', { name: '마을의 하루', exact: true }).click();
    await page.locator('.art-gallery').waitFor();
    const g = r.gallery = { filters: await page.locator('.gallery-filters button').evaluateAll(bs => bs.map(b => b.innerText.replace(/\s+/g, ' '))) };
    g.layout = await audit(page, '.art-gallery');
    await shot(page, `${tag}-02-gallery.png`);
    const walk = async (filter, full) => {
      await page.locator('.gallery-filters button', { hasText: filter }).first().click();
      const n = await page.locator('.gallery-thumbnails button').count(), seen = [];
      for (let i = 0; i < (full ? n : 1); i++) {
        await page.waitForFunction(() => { const i = document.querySelector('.gallery-stage img'); return i && i.complete; }, null, { timeout: 15000 });
        seen.push(await page.evaluate(() => { const i = document.querySelector('.gallery-stage img'); return { title: document.querySelector('.gallery-controls strong')?.innerText, count: document.querySelector('.gallery-controls span')?.innerText, w: i.naturalWidth, fallback: !!i.dataset.fallback, src: i.getAttribute('src').split('/').slice(-2).join('/') }; }));
        if (full) await page.getByRole('button', { name: '다음 그림' }).click();
      }
      // Thumbnails are lazy: scroll each into view and check it decoded.
      const thumbs = await page.locator('.gallery-thumbnails img').evaluateAll(async imgs => { const out = []; for (const img of imgs) { img.scrollIntoView({ block: 'nearest', inline: 'nearest' }); await new Promise(r => setTimeout(r, 60)); if (!img.complete) await new Promise(r => { img.onload = img.onerror = r; setTimeout(r, 3000); }); out.push({ src: img.getAttribute('src').split('/').pop(), w: img.naturalWidth }); } return out; });
      return { count: n, pictures: seen, brokenPictures: seen.filter(s => !s.w || s.fallback), brokenThumbs: thumbs.filter(t => !t.w) };
    };
    const full = tag === '1920x1080';
    g.all = await walk('전체', full); g.transitions = await walk('화면 전환', full);
    for (const f of ['생활', '자연', '산업']) g[f] = await walk(f, false);
    await shot(page, `${tag}-03-gallery-transitions.png`);
    await page.keyboard.press('Escape');
    g.escapeBackHome = await page.locator('.home-screen').isVisible().catch(() => false);

    // ---------- Transition home -> world ----------
    log(tag + ' transition');
    const t0 = Date.now();
    await page.getByRole('button', { name: '새 게임', exact: true }).click();
    const tr = r.transition = {};
    tr.shown = await page.locator('.screen-transition').waitFor({ timeout: 1500 }).then(() => true).catch(() => false);
    if (tr.shown) { tr.art = await page.locator('.screen-transition').getAttribute('data-art'); tr.label = await page.locator('.screen-transition [role=status]').innerText(); tr.imageOk = await page.evaluate(() => { const i = document.querySelector('.screen-transition img'); return !!i && (i.complete ? i.naturalWidth > 0 : 'loading'); }); await shot(page, `${tag}-04-transition-world.png`); }
    await page.locator('.world-map-screen').waitFor({ timeout: 10000 });
    tr.msToWorld = Date.now() - t0;
    await page.locator('.realm-card .start-button:not(:disabled)').waitFor({ timeout: 120000 });
    await page.waitForTimeout(400);

    // ---------- World atlas v2 ----------
    log(tag + ' atlas');
    const A = r.atlas = { steps: {} };
    A.steps.whole = await atlasState(page); await shot(page, `${tag}-05-atlas-whole.png`);
    A.layout = await audit(page, '.world-map-screen');
    const zoomIn = page.getByRole('button', { name: '세계 지도 확대' });
    for (let k = 1; k <= 4; k++) { if (await zoomIn.isDisabled()) { A.steps['zoom' + k] = 'max'; break; } await zoomIn.click(); await raf(page); A.steps['zoom' + k] = await atlasState(page); if (k === 2 || k === 4) await shot(page, `${tag}-06-atlas-zoom${k}.png`); }
    await page.getByRole('button', { name: '대륙 전체', exact: false }).first().click(); await raf(page);
    A.steps.reset = await atlasState(page);
    const box = await page.locator('.atlas-viewport').boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    if (!mobile) {
      await page.mouse.move(cx, cy); await page.mouse.wheel(0, -400); await page.waitForTimeout(200); A.steps.wheelIn = await atlasState(page);
      await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx - 150, cy - 60, { steps: 8 }); await page.mouse.up(); await raf(page); A.steps.dragged = await atlasState(page);
      await shot(page, `${tag}-07-atlas-wheel-drag.png`);
    } else {
      const before = await atlasState(page);
      await touch(page, cdp, [['touchStart', [[cx - 30, cy], [cx + 30, cy]]], ...Array.from({ length: 8 }, (_, i) => ['touchMove', [[cx - 30 - i * 12, cy], [cx + 30 + i * 12, cy]]]), ['touchEnd', []]]);
      A.steps.pinchOut = await atlasState(page); A.steps.pinchOut.widthRatio = +(A.steps.pinchOut.vb[2] / before.vb[2]).toFixed(3);
      await shot(page, `${tag}-07-atlas-pinch.png`);
      const b2 = await atlasState(page);
      await touch(page, cdp, [['touchStart', [[cx, cy]]], ...Array.from({ length: 8 }, (_, i) => ['touchMove', [[cx - i * 15, cy - i * 6]]]), ['touchEnd', []]]);
      A.steps.oneFingerPan = await atlasState(page); A.steps.oneFingerPan.moved = A.steps.oneFingerPan.vb[0] !== b2.vb[0] || A.steps.oneFingerPan.vb[1] !== b2.vb[1];
      await touch(page, cdp, [['touchStart', [[cx - 90, cy]]], ['touchStart', [[cx - 90, cy], [cx + 90, cy]]], ...Array.from({ length: 8 }, (_, i) => ['touchMove', [[cx - 90 + i * 10, cy], [cx + 90 - i * 10, cy]]]), ['touchEnd', [[cx + 10, cy]]], ['touchEnd', []]]);
      A.steps.pinchIn = await atlasState(page); A.steps.pinchIn.widthRatio = +(A.steps.pinchIn.vb[2] / A.steps.oneFingerPan.vb[2]).toFixed(3);
      // A tap selects a cell (readout changes).
      const rd = (await atlasState(page)).readout; await page.touchscreen.tap(cx + 40, cy + 30); await page.waitForTimeout(250); A.steps.tapSelect = { before: rd, after: (await atlasState(page)).readout };
    }
    await page.getByRole('button', { name: '대륙 전체', exact: false }).first().click(); await raf(page);

    // ---------- Start sites ----------
    log(tag + ' start sites');
    const S = r.start = { nations: {} };
    const realms = await page.locator('#realm option').evaluateAll(os => os.map(o => ({ id: o.value, name: o.textContent, group: o.parentElement.label })));
    S.realmCount = realms.length;
    const hostile = realms.filter(o => o.group.includes('적대'));
    for (const n of realms.filter(o => !o.group.includes('적대')).slice(0, full ? 99 : 1)) {
      await page.locator('#realm').selectOption(n.id); await raf(page); await page.waitForTimeout(150);
      const opts = await page.locator('#start-province option:not([disabled])').evaluateAll(os => os.map(o => ({ id: o.value, name: o.textContent })));
      const res = S.nations[n.id] = { options: opts.length, availableMarkers: await page.locator('.atlas-site[data-status="available"]').count(), defaultValue: await page.locator('#start-province').inputValue(), sites: [] };
      for (const o of opts) {
        await page.locator('#start-province').selectOption(o.id); await raf(page); await page.waitForTimeout(80);
        const st = await page.evaluate(() => ({ preview: document.querySelector('.realm-card .local-map-preview')?.dataset.province, head: document.querySelector('.realm-place h2')?.innerText, readout: document.querySelector('.atlas-cell-readout')?.innerText.replace(/\s+/g, ' '), start: document.querySelector('.realm-card .start-button')?.innerText.trim(), disabled: document.querySelector('.realm-card .start-button')?.disabled, biome: document.querySelector('.realm-sheet .biome-summary')?.innerText.replace(/\s+/g, ' ').slice(0, 60) }));
        res.sites.push({ id: o.id, name: o.name, ...st, canvas: await canvasHash(page), previewMatches: st.preview === o.id });
      }
    }
    // Layers of the local preview.
    const layers = {};
    for (const l of ['비옥도', '광물', '원유', '지형']) { await page.locator('.realm-card .local-preview-layers button', { hasText: l }).click(); await raf(page); layers[l] = await canvasHash(page); }
    S.layers = layers; S.layersDiffer = new Set(Object.values(layers).map(v => v?.hash)).size;
    await shot(page, `${tag}-08-start-site.png`);
    S.realmLayout = await audit(page, '.realm-card');
    // Hostile nation: start must be refused.
    if (hostile.length) { await page.locator('#realm').selectOption(hostile[0].id); await raf(page); S.hostile = await page.evaluate(() => ({ text: document.querySelector('.realm-card .start-button')?.innerText.trim(), disabled: document.querySelector('.realm-card .start-button')?.disabled, preview: !!document.querySelector('.realm-card .local-map-preview') })); }
    // A capital marker click must not become a start site.
    await page.locator('#realm').selectOption('estern'); await raf(page);
    const cap = await page.locator('.atlas-site[data-status="capital"] image').first().boundingBox().catch(() => null);
    if (cap) { await page.getByRole('button', { name: '세계 지도 확대' }).click(); await raf(page); }
    const cap2 = await page.locator('.atlas-site[data-status="capital"] image').first().boundingBox().catch(() => null);
    if (cap2) { if (mobile) await page.touchscreen.tap(cap2.x + cap2.width / 2, cap2.y + cap2.height * .75); else await page.mouse.click(cap2.x + cap2.width / 2, cap2.y + cap2.height * .75); await page.waitForTimeout(250); S.capitalClick = await page.evaluate(() => ({ readout: document.querySelector('.atlas-cell-readout')?.innerText.replace(/\s+/g, ' '), start: document.querySelector('.realm-card .start-button')?.innerText.trim(), disabled: document.querySelector('.realm-card .start-button')?.disabled, province: document.querySelector('#start-province')?.value })); await shot(page, `${tag}-09-capital-click.png`); }

    // ---------- New game ----------
    log(tag + ' new game');
    const choice = (await page.locator('#start-province option:not([disabled])').evaluateAll(os => os.map(o => o.value)))[2];
    await page.locator('#start-province').selectOption(choice); await raf(page);
    const n0 = Date.now();
    await page.getByRole('button', { name: /이 땅에서 시작/ }).click();
    const load = r.newGame = { choice };
    load.loading = await page.locator('.screen-loading').waitFor({ timeout: 2000 }).then(async () => ({ art: await page.locator('.screen-loading').getAttribute('data-art'), label: await page.locator('.screen-loading h1').innerText() })).catch(() => null);
    if (load.loading) await shot(page, `${tag}-10-loading.png`);
    await waitSim(page, () => !!window.tgScene?.sim && window.tgScene.mode === 'warehouse' && !document.querySelector('.screen-loading'), null, 120000);
    load.msToPlayable = Date.now() - n0;
    load.sim = await sim(page, () => { const s = window.tgScene.sim; return { provinceId: s.provinceId, nation: s.nation, owned: s.owned.size, buildings: s.buildings.length, ecology: s.layout?.ecology }; });
    load.provinceMatches = load.sim.provinceId === choice;
    await page.waitForTimeout(600); await shot(page, `${tag}-11-game-start.png`);
    load.layout = await audit(page, 'body');

    // ---------- Campaign window, fresh game ----------
    log(tag + ' campaign window');
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    const C = r.campaign = { tabs: {} };
    const openWorld = async () => { const b = page.getByRole('button', { name: '거점·세계 지도' }); if (await b.isVisible().catch(() => false)) await b.click(); else await page.getByRole('button', { name: '세계 지도', exact: true }).click(); await page.locator('[role=dialog] .campaign-tabs').waitFor({ timeout: 5000 }); await page.waitForTimeout(300); };
    await openWorld();
    for (const tab of ['세계와 거점', '운송망', '운영과 외교', '신생 국가']) {
      await page.getByRole('tab', { name: tab }).click(); await page.waitForTimeout(250);
      C.tabs[tab] = { layout: await audit(page, '[role=dialog]'), scroll: await page.evaluate(() => { const d = document.querySelector('[role=dialog]'); return { docX: document.documentElement.scrollWidth > innerWidth, dialogW: Math.round(d.getBoundingClientRect().width), overflowX: [...d.querySelectorAll('*')].filter(e => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX === 'visible' && e.getBoundingClientRect().right > innerWidth + 1).slice(0, 5).map(e => e.className?.baseVal ?? e.className) }; }) };
      await shot(page, `${tag}-12-campaign-${tab.replace(/\s/g, '')}.png`);
    }
    await page.getByRole('tab', { name: '세계와 거점' }).click(); await page.waitForTimeout(200);
    const provinces = await page.locator('select[aria-label="진출할 거점 부지"] option:not([disabled])').evaluateAll(os => os.map(o => ({ id: o.value, text: o.textContent })));
    C.siteOptions = provinces.length; C.statusCounts = provinces.reduce((m, o) => { const k = o.text.split(' · ').pop(); m[k] = (m[k] || 0) + 1; return m; }, {});
    const other = provinces.find(o => !o.text.includes('내 거점'));
    if (other) {
      await page.locator('select[aria-label="진출할 거점 부지"]').selectOption(other.id); await raf(page);
      C.offer = await page.evaluate(() => { const o = document.querySelector('.expansion-offer'); return { province: o?.dataset.province, status: o?.dataset.status, text: o?.innerText.replace(/\s+/g, ' ').slice(0, 220), preview: document.querySelector('[role=dialog] .local-map-preview')?.dataset.province, found: [...document.querySelectorAll('[role=dialog] button')].find(b => b.innerText.includes('거점 세우기'))?.disabled }; });
      C.offer.canvas = await page.evaluate(() => { const c = document.querySelector('[role=dialog] .local-map-preview canvas'); if (!c) return null; const d = c.getContext('2d').getImageData(0, 0, 192, 192).data; const s = new Set(); for (let i = 0; i < d.length; i += 16) s.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); return s.size; });
      await shot(page, `${tag}-13-campaign-offer.png`);
    }
    // Atlas inside the dialog: zoom and a cell click reach the site panel.
    const dz = page.locator('[role=dialog]').getByRole('button', { name: '세계 지도 확대' });
    C.dialogAtlasBefore = await atlasState(page); if (await dz.isEnabled()) { await dz.click(); await raf(page); } C.dialogAtlasZoom = await atlasState(page);
    await page.keyboard.press('Escape'); await page.waitForTimeout(250);
    C.closedByEscape = !(await page.locator('[role=dialog]').count());
    await closeAll(page);

    // ---------- Founding and visiting a site from a later save (desktop 1920 and phone 390 only) ----------
    if (tag === '1920x1080' || tag === '390x844') {
      log(tag + ' found site');
      const F = r.found = { fixture: 'rank26' };
      const raw = readFileSync(new URL('../audit-2/fixtures/rank26.json', import.meta.url));
      await page.locator('input[aria-label="저장 파일 불러오기"]').setInputFiles({ name: 'rank26.json', mimeType: 'application/json', buffer: raw });
      F.restoreLoading = await page.locator('.screen-loading').waitFor({ timeout: 3000 }).then(() => page.locator('.screen-loading').getAttribute('data-art')).catch(() => null);
      await waitSim(page, () => window.tgScene?.sim?.rank === 26 && !document.querySelector('.screen-loading'), null, 120000);
      await page.waitForTimeout(500);
      F.before = await sim(page, () => { const c = window.tgScene.sim.campaign; return { sites: c.sites.length, money: Math.round(window.tgScene.sim.money), active: c.activeId }; });
      await closeAll(page); await openWorld();
      const opts = await page.locator('select[aria-label="진출할 거점 부지"] option:not([disabled])').evaluateAll(os => os.map(o => ({ id: o.value, text: o.textContent })));
      F.statusCounts = opts.reduce((m, o) => { const k = o.text.split(' · ').pop(); m[k] = (m[k] || 0) + 1; return m; }, {});
      // Look through every playable nation for a site that is ready now.
      let target = opts.find(o => o.text.endsWith('진출 가능'));
      if (!target) for (const n of await page.locator('select[aria-label="세계 지도 국가"] option').evaluateAll(os => os.filter(o => !o.textContent.includes('적대')).map(o => o.value))) { await page.locator('select[aria-label="세계 지도 국가"]').selectOption(n); await raf(page); const o2 = await page.locator('select[aria-label="진출할 거점 부지"] option:not([disabled])').evaluateAll(os => os.map(o => ({ id: o.value, text: o.textContent }))); target = o2.find(o => o.text.endsWith('진출 가능')); if (target) { F.nation = n; break; } }
      F.target = target || null;
      if (target) {
        await page.locator('select[aria-label="진출할 거점 부지"]').selectOption(target.id); await raf(page);
        F.offerText = await page.locator('.expansion-offer').innerText().then(t => t.replace(/\s+/g, ' ').slice(0, 240));
        await shot(page, `${tag}-14-found-offer.png`);
        await page.getByRole('button', { name: '이 땅에 거점 세우기' }).click(); await page.waitForTimeout(600);
        F.after = await sim(page, () => { const c = window.tgScene.sim.campaign; return { sites: c.sites.length, money: Math.round(window.tgScene.sim.money), active: c.activeId, last: c.sites.at(-1)?.provinceId }; });
        F.toasts = await page.locator('[data-sonner-toast]').allInnerTexts();
        // Saved copy right after the click and 1.2 s later (button saves are merged 0.8 s after the last click).
        const savedSites = () => page.evaluate(async () => { try { const raw = localStorage.getItem('first-land-v1'); if (!raw) return null; const { decodeSave } = await import('/src/app/game/persistence.js'); return decodeSave(raw).sites.length; } catch (e) { return 'error ' + e.message; } });
        F.savedProvinceIdsNow = await savedSites(); await page.waitForTimeout(1200); F.savedProvinceIdsLater = await savedSites();
        F.panelAfter = await page.locator('.expansion-offer').innerText().then(t => t.replace(/\s+/g, ' ').slice(0, 200)).catch(() => null);
        await shot(page, `${tag}-15-found-done.png`);
        // Visit the new site through its button: transition art + the site becomes active.
        const move = page.getByRole('button', { name: '이 거점으로 이동' });
        if (await move.count()) {
          const v0 = Date.now(); await move.click();
          F.visitLoading = await page.locator('.screen-loading').waitFor({ timeout: 3000 }).then(async () => ({ art: await page.locator('.screen-loading').getAttribute('data-art'), label: await page.locator('.screen-loading h1').innerText() })).catch(() => null);
          if (F.visitLoading) await shot(page, `${tag}-16-visit-loading.png`);
          await waitSim(page, id => window.tgScene?.sim?.campaign?.activeId !== id && !document.querySelector('.screen-loading'), F.before.active, 60000);
          F.visitMs = Date.now() - v0;
          F.visited = await sim(page, () => { const s = window.tgScene.sim; return { provinceId: s.provinceId, buildings: s.buildings.length, owned: s.owned.size, paused: s.paused }; });
          await page.waitForTimeout(500); await shot(page, `${tag}-17-new-site.png`);
          F.newSiteLayout = await audit(page, 'body');
        } else F.visitButton = 'missing';
      }
      await closeAll(page);
    }

    // ---------- Motion in the real showcase (1920 only) ----------
    if (tag === '1920x1080') {
      log(tag + ' showcase motion');
      const M = r.motion = {};
      await page.goto(process.env.TOWNGRID_URL || 'http://localhost:5173');
      await toHome(page);
      if (!(await page.locator('.home-extras[open]').count())) await page.locator('.home-extras summary').click();
      const d0 = Date.now(); await page.getByRole('button', { name: '산업도시 둘러보기' }).click();
      await waitSim(page, () => window.tgScene?.sim?.buildings.length > 3 && !document.querySelector('.screen-loading'), null, 120000);
      M.demoMs = Date.now() - d0;
      await page.getByRole('button', { name: '4×' }).click();
      const types = await sim(page, () => { const c = {}; for (const b of window.tgScene.sim.buildings) c[b.type] = (c[b.type] || 0) + 1; return c; });
      M.farmTypesInShowcase = Object.fromEntries(Object.entries(types).filter(([k]) => ['sheeppen', 'milkbarn', 'duckhouse', 'apiary', 'wheatfield', 'field'].includes(k)));
      M.buildingTypes = Object.keys(types).length;
      const sample = () => sim(page, () => { const g = window.tgScene; let animals = 0, animalFrames = []; for (const m of g.models.values()) m.traverse(o => { if (o.userData?.farmAnimal && o.visible) { animals++; animalFrames.push(Math.round(o.position.x * 1000) + ':' + Math.round(o.position.y * 1000)); } }); return { t: Math.round(g.sim.time), carts: g.exportCarts.size, cartFrames: [...g.exportCarts.values()].map(m => m.userData.frame), networkCargo: g.networkCargo.size, shipments: g.sim.shipments?.length || 0, workers: g.workerModels.size, animals, animalPos: animalFrames.slice(0, 6).join('|') }; });
      M.samples = [];
      for (let k = 0; k < 12; k++) { M.samples.push(await sample()); await page.waitForTimeout(2500); }
      M.maxCarts = Math.max(...M.samples.map(s => s.carts)); M.maxCargo = Math.max(...M.samples.map(s => s.networkCargo)); M.maxAnimals = Math.max(...M.samples.map(s => s.animals));
      M.animalsMoved = new Set(M.samples.map(s => s.animalPos)).size > 1;
      await shot(page, `${tag}-18-showcase-motion.png`);
    }
  } catch (e) { r.error = String(e.stack || e).slice(0, 700); await shot(page, `${tag}-99-failure.png`).catch(() => {}); log('ERROR ' + r.error); }
  r.newErrors = { errors: R.errors.slice(), consoleErrors: R.consoleErrors.slice(), failedRequests: R.failedRequests.slice() };
  r.errorDelta = R.errors.length + R.consoleErrors.length + R.failedRequests.length - errorsBefore;
  await save('new-screens.json', OUT);
  await page.context().close();
}
OUT.R = R;
await save('new-screens.json', OUT);
console.log(JSON.stringify(Object.fromEntries(Object.entries(OUT.sizes).map(([k, v]) => [k, { error: v.error, errorDelta: v.errorDelta }]))));
await browser.close();
