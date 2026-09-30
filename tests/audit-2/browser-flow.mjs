// Audit 2026-09-29 stage B, probe 1 (1920x1080): home -> gallery -> settings -> world map (nation pick) -> new game ->
// first session driven only through on-screen buttons and real canvas clicks (a bot plays like a player: follows the guide,
// delivers contracts, promotes, sells, answers warnings) for TG_MINUTES real minutes at 4x -> every panel and dialog
// opened/closed three ways -> keyboard, wheel and drag -> save, reload, continue and compare.
// Usage: node tests/audit-2/browser-flow.mjs <playwright/index.mjs> <chrome.exe>   (TG_GPU=1 for the real GPU)
import { R, open, toHome, newGameFromHome, shot, sim, waitSim, visible, save, clickTile, tilePoint, closeAll, audit, raf, browser, log } from './_browser.mjs';
const minutes = +(process.env.TG_MINUTES || 5);
const F = { timing: {}, home: {}, world: {}, session: { log: [], shots: [] }, panels: {}, input: {}, saveLoad: {}, feedback: {} };
const page = await open({ width: 1920, height: 1080 });
// Toasts as they appear (sonner), for feedback timing.
await page.addInitScript(() => { window.tgToasts = []; const seen = new WeakSet(); new MutationObserver(() => { for (const el of document.querySelectorAll('[data-sonner-toast]')) if (!seen.has(el)) { seen.add(el); window.tgToasts.push({ t: Math.round(performance.now()), type: el.getAttribute('data-type'), text: el.innerText.replace(/\s+/g, ' ').slice(0, 140), game: window.tgScene?.sim ? Math.round(window.tgScene.sim.time) : null }); } }).observe(document, { childList: true, subtree: true }); });
const snap = () => sim(page, () => { const s = window.tgScene?.sim; if (!s) return null; return { t: Math.round(s.time * 10) / 10, day: s.day, rank: s.rank, money: Math.round(s.money), debt: Math.round(s.debt), contracts: s.contracts, paused: s.paused, speed: s.speed, owned: s.owned.size, workers: s.workers.length, buildings: s.buildings.map(b => `${b.type}@${b.x},${b.z}:L${b.level || 1}:hp${Math.round(b.health)}`).sort(), stock: Object.fromEntries(Object.entries(s.stock).filter(([, v]) => v > 0).map(([k, v]) => [k, Math.floor(v)])) }; });
const ui = () => page.evaluate(() => { const v = s => { const e = document.querySelector(s); return !!e && !!e.getClientRects().length; }; return { tutorial: v('.tutorial-card'), tutorialText: document.querySelector('.tutorial-card strong')?.innerText || null, operations: v('.operations-card'), nextBuild: document.querySelector('.next-build')?.innerText?.replace(/\s+/g, ' ') || null, bottleneck: [...document.querySelectorAll('.operations-card .bottleneck')].map(e => e.innerText.replace(/\s+/g, ' ')), promotionReady: v('.promotion-ready'), facility: v('.facility-card'), dialog: v('[role=dialog]'), weather: document.querySelector('.weather-warning')?.innerText?.replace(/\s+/g, ' ') || null, raid: v('.raid-panel'), health: v('.health-alert'), finance: v('.finance-warning'), pause: v('.pause-label') }; });
const audioState = () => page.evaluate(() => ({ ctx: window.tgAudio?.context?.state || 'no-instance', muted: window.tgAudio?.muted, unlocked: window.tgAudio?.unlocked }));
const audioSince = t => page.evaluate(t => window.tgAudioLog.filter(e => e.t >= t).map(e => e.m + ':' + e.a + (e.ctx !== 'running' ? '(' + e.ctx + ')' : '')), t);
const now = () => page.evaluate(() => Math.round(performance.now()));
const toastsSince = t => page.evaluate(t => window.tgToasts.filter(e => e.t >= t), t);

try {
  // ---------- Home ----------
  log('home');
  F.timing.home = await toHome(page);
  F.home.audioAfterTitleClick = await audioState();
  await page.waitForTimeout(600);
  await shot(page, 'A01-home-1920.png');
  F.home.layout = await audit(page, '.home-screen');
  F.home.buttons = await page.locator('.home-screen button, .home-screen a').evaluateAll(bs => bs.map(b => ({ text: b.innerText.trim().replace(/\s+/g, ' '), disabled: !!b.disabled })));
  // Gallery: next x6 must cycle all six pictures; Escape should leave it.
  await page.getByRole('button', { name: '마을의 하루' }).click();
  const titles = [];
  for (let i = 0; i < 6; i++) { titles.push(await page.locator('.gallery-controls strong').innerText()); await page.getByRole('button', { name: '다음 그림' }).click(); await page.waitForTimeout(120); }
  F.home.gallery = { titles, distinct: new Set(titles).size };
  await shot(page, 'A02-gallery.png');
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  F.home.gallery.escapeLeaves = !(await visible(page, '.art-gallery'));
  if (!F.home.gallery.escapeLeaves) await page.getByRole('button', { name: '홈으로' }).click();
  // Settings from home.
  await page.locator('.home-menu').getByRole('button', { name: '설정' }).click();
  await page.locator('[role=dialog]').waitFor({ timeout: 5000 });
  await page.waitForTimeout(400);
  F.home.settings = { layout: await audit(page, '[role=dialog]'), text: (await page.locator('[role=dialog]').innerText()).replace(/\s+/g, ' ').slice(0, 400) };
  await shot(page, 'A03-home-settings.png');
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  F.home.settings.escCloses = !(await visible(page, '[role=dialog]'));
  // Back to the title and in again.
  await page.getByRole('button', { name: '대기 화면' }).click();
  F.home.titleBack = await visible(page, '.title-screen');
  await page.getByRole('button', { name: '화면을 눌러 시작', exact: true }).click();
  await page.getByRole('button', { name: '새 게임' }).waitFor();

  // ---------- World map ----------
  log('world map');
  await page.getByRole('button', { name: '새 게임' }).click();
  await page.getByRole('button', { name: /이 땅에서 시작/ }).waitFor();
  await page.waitForTimeout(500);
  await shot(page, 'B01-world-map-1920.png');
  F.world.layout = await audit(page, '.world-map-screen');
  F.world.options = await page.locator('#realm option').evaluateAll(o => o.map(v => ({ id: v.value, text: v.textContent, group: v.parentElement.label })));
  // Hostile nation: start must be disabled with a reason.
  const hostile = F.world.options.find(o => /적대/.test(o.group));
  if (hostile) { await page.locator('#realm').selectOption(hostile.id); await page.waitForTimeout(300); F.world.hostile = { id: hostile.id, start: await page.locator('.start-button').innerText(), disabled: await page.locator('.start-button').isDisabled(), secondary: await page.locator('.world-secondary button').evaluateAll(bs => bs.map(b => b.innerText.trim() + (b.disabled ? '(off)' : ''))) }; await shot(page, 'B02-world-hostile.png'); }
  // Clicking a nation on the atlas map itself (not the select) must change the choice.
  const beforeAtlas = await page.locator('#realm').inputValue();
  const atlasTargets = await page.locator('.world-atlas [role=button], .world-atlas .atlas-label').count();
  F.world.atlasClickTargets = atlasTargets;
  const cell = page.locator('.world-atlas rect.site-cell').nth(40);
  if (await cell.count()) { await cell.click({ force: true }).catch(e => F.world.atlasClickError = e.message.split('\n')[0]); await page.waitForTimeout(300); }
  F.world.atlasChangedNation = beforeAtlas !== await page.locator('#realm').inputValue();
  // Pick the first playable nation and a faction.
  const playable = F.world.options.find(o => !/적대/.test(o.group));
  await page.locator('#realm').selectOption(playable.id);
  F.world.startLabel = await page.locator('.start-button').innerText();
  await page.getByRole('button', { name: /엘프족/ }).first().click().catch(() => {});
  await page.getByRole('button', { name: /인족/ }).first().click().catch(() => {});
  F.world.scroll = await page.evaluate(() => { const c = document.querySelector('.realm-card'); const sheet = document.querySelector('.realm-sheet'); const st = document.querySelector('.start-button').getBoundingClientRect(); return { startButtonBottom: Math.round(st.bottom), viewport: innerHeight, startInView: st.bottom <= innerHeight && st.top >= 0, cardScroll: c ? c.scrollHeight - c.clientHeight : null, sheetScroll: sheet ? sheet.scrollHeight - sheet.clientHeight : null }; });
  await shot(page, 'B03-world-playable.png');

  // ---------- New game ----------
  log('new game');
  let t = await now();
  { const t0 = Date.now(); await page.getByRole('button', { name: /이 땅에서 시작/ }).click(); await waitSim(page, () => !!window.tgScene?.sim && window.tgScene.sim.buildings.length === 0 && window.tgScene.mode === 'warehouse', null, 120000); F.timing.newGameMs = Date.now() - t0; }
  F.feedback.newGame = { toasts: await toastsSince(t), audio: await audioSince(t), audioState: await audioState() };
  await page.waitForTimeout(400);
  await shot(page, 'C01-new-game.png');
  F.session.startUi = await ui();
  // Place the warehouse with a real click; then check build feedback (sound, toast, card).
  t = await now();
  const wp = await clickTile(page, 11, 12);
  await waitSim(page, () => window.tgScene.sim.buildings.some(b => b.type === 'warehouse'), null, 10000);
  await page.waitForTimeout(400);
  F.feedback.warehouse = { point: wp, audio: await audioSince(t), toasts: await toastsSince(t), ui: await ui() };
  await shot(page, 'C02-warehouse.png');

  // ---------- Bot session ----------
  log('session ' + minutes + ' min');
  await page.getByRole('button', { name: '4×' }).click();
  const freeTile = type => sim(page, type => { const s = window.tgScene.sim, w = s.warehouse || { x: 11, z: 12 }; const c = [...s.owned].map(k => k.split(',').map(Number)).sort((a, b) => Math.hypot(a[0] - w.x, a[1] - w.z) - Math.hypot(b[0] - w.x, b[1] - w.z)); for (const [x, z] of c) if (!s.canBuild(type, x, z)) return [x, z]; return null; }, type);
  const placeCurrentTool = async () => { const tool = await sim(page, () => window.tgScene.mode); if (!tool) return null; const tile = await freeTile(tool); if (!tile) { await page.keyboard.press('Escape'); return tool + ':no-tile'; } const t0 = await now(); await clickTile(page, tile[0], tile[1]); await page.waitForTimeout(150); const placed = await sim(page, ([x, z]) => !!window.tgScene.sim.at(x, z), tile); const a = await audioSince(t0); if (await sim(page, () => window.tgScene.mode)) await page.keyboard.press('Escape'); return tool + '@' + tile + (placed ? '' : ':not-placed') + ' audio=' + a.join(','); };
  const start = Date.now(); let lastShot = 0, i = 0; const actions = [], noGuide = [];
  while (Date.now() - start < minutes * 60000) {
    i++;
    const u = await ui();
    if (!u.tutorial && !u.operations && !u.dialog && !u.promotionReady) noGuide.push(Math.round((Date.now() - start) / 1000));
    try {
      if (u.dialog) { await page.keyboard.press('Escape'); }
      else if (u.facility) { await page.getByRole('button', { name: '시설 정보 닫기' }).click(); }
      else if (u.weather && await page.locator('.weather-warning button:not([disabled])').count()) { const t0 = await now(); await page.locator('.weather-warning button').click(); actions.push({ s: Math.round((Date.now() - start) / 1000), a: 'reinforce', audio: await audioSince(t0) }); }
      else if (u.raid && await page.locator('.raid-panel button:not([disabled])').count()) { await page.locator('.raid-panel button:not([disabled])').first().click(); actions.push({ s: Math.round((Date.now() - start) / 1000), a: 'mobilize' }); }
      else if (u.promotionReady) { const t0 = await now(); await page.locator('.promotion-ready').click(); await page.locator('[role=dialog]').waitFor({ timeout: 3000 }); const btn = page.getByRole('button', { name: /^승급 · / }); if (await btn.isEnabled()) { await btn.click(); await page.waitForTimeout(300); actions.push({ s: Math.round((Date.now() - start) / 1000), a: 'promote', audio: await audioSince(t0), toasts: (await toastsSince(t0)).map(x => x.text), rank: await sim(page, () => window.tgScene.sim.rank) }); if (!F.session.firstPromotionShot) { F.session.firstPromotionShot = true; await shot(page, 'C04-promote-moment.png'); } } await page.keyboard.press('Escape'); }
      else if (await page.locator('.quick-contract button:not([disabled])').count()) { const t0 = await now(); await page.locator('.quick-contract button').click(); await page.waitForTimeout(200); actions.push({ s: Math.round((Date.now() - start) / 1000), a: 'contract', audio: await audioSince(t0), toasts: (await toastsSince(t0)).map(x => x.text) }); }
      else if (u.tutorial && await page.locator('.tutorial-card button:not(.tutorial-dismiss):not([disabled])').count()) { const b = page.locator('.tutorial-card button:not(.tutorial-dismiss):not([disabled])').first(); const label = (await b.innerText()).replace(/\s+/g, ' '); await b.click(); await page.waitForTimeout(200); const placed = await placeCurrentTool(); actions.push({ s: Math.round((Date.now() - start) / 1000), a: 'guide:' + label, placed }); }
      else if (u.nextBuild && i % 3 === 0) { const label = u.nextBuild; await page.locator('.next-build').click(); await page.waitForTimeout(200); const placed = await placeCurrentTool(); actions.push({ s: Math.round((Date.now() - start) / 1000), a: 'next-build:' + label, placed }); }
      else if (u.bottleneck.length && i % 4 === 0) { const label = u.bottleneck[0]; await page.locator('.operations-card .bottleneck').first().click(); await page.waitForTimeout(200); const placed = await placeCurrentTool(); actions.push({ s: Math.round((Date.now() - start) / 1000), a: 'bottleneck:' + label, placed, after: await ui() }); await closeAll(page); }
      else if (i % 5 === 0 && (await page.locator('.objective-card').count())) { const t0 = await now(); await page.locator('.objective-card').click(); await page.locator('[role=dialog]').waitFor({ timeout: 3000 }); const d = page.getByRole('button', { name: /^납품 \+/ }); if (await d.count() && await d.isEnabled()) { await d.click(); await page.waitForTimeout(200); actions.push({ s: Math.round((Date.now() - start) / 1000), a: 'goals:deliver', audio: await audioSince(t0), toasts: (await toastsSince(t0)).map(x => x.text) }); } const pr = page.getByRole('button', { name: /^승급 · / }); if (await pr.count() && await pr.isEnabled()) { const t1 = await now(); await pr.click(); await page.waitForTimeout(400); actions.push({ s: Math.round((Date.now() - start) / 1000), a: 'goals:promote', audio: await audioSince(t1), toasts: (await toastsSince(t1)).map(x => x.text), rank: await sim(page, () => window.tgScene.sim.rank) }); if (!F.session.firstPromotionShot) { F.session.firstPromotionShot = true; await shot(page, 'C04-promote-moment.png'); } } await page.keyboard.press('Escape'); }
      else if (i % 10 === 0) { const t0 = await now(); await page.getByRole('button', { name: '시장', exact: true }).click(); await page.locator('[role=dialog]').waitFor({ timeout: 3000 }); const sell = page.locator('[role=dialog] button[aria-label$="개 판매"]:not([disabled])'); if (await sell.count()) { const label = await sell.first().getAttribute('aria-label'); await sell.first().click(); await page.waitForTimeout(200); actions.push({ s: Math.round((Date.now() - start) / 1000), a: 'sell:' + label, audio: await audioSince(t0), toasts: (await toastsSince(t0)).map(x => x.text) }); } await page.keyboard.press('Escape'); }
    } catch (e) { actions.push({ s: Math.round((Date.now() - start) / 1000), error: e.message.split('\n')[0] }); await closeAll(page).catch(() => {}); }
    if (Date.now() - lastShot > 60000) { lastShot = Date.now(); const n = F.session.shots.length + 1; const name = `C10-session-${String(n).padStart(2, '0')}.png`; await shot(page, name); F.session.shots.push({ name, snap: await snap(), ui: await ui() }); }
    await page.waitForTimeout(1200);
  }
  F.session.actions = actions; F.session.noGuideSeconds = noGuide.length ? { count: noGuide.length, first: noGuide.slice(0, 10), last: noGuide.slice(-5) } : null;
  F.session.end = await snap(); F.session.endUi = await ui();
  F.session.toasts = await page.evaluate(() => window.tgToasts);
  F.session.audioCounts = await page.evaluate(() => { const c = {}; for (const e of window.tgAudioLog) { const k = e.m + ':' + e.a; c[k] = (c[k] || 0) + 1; } return c; });
  F.session.audioState = await audioState();
  await shot(page, 'C20-session-end.png');
  await closeAll(page);
  await page.getByRole('button', { name: '1×' }).click();
  // Closing a dialog: what is on screen during the exit animation (every 40 ms for 400 ms).
  await page.locator('.objective-card').click(); await page.locator('[role=dialog]').waitFor(); await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  F.feedback.dialogExit = [];
  for (let k = 0; k < 10; k++) { F.feedback.dialogExit.push(await page.evaluate(() => { const d = document.querySelector('[role=dialog]'); return d ? { title: d.querySelector('h2')?.innerText, bodyChars: d.innerText.length, opacity: getComputedStyle(d).opacity } : null; })); if (k === 1) await shot(page, 'C21-dialog-closing.png'); await page.waitForTimeout(40); }

  // ---------- Panels ----------
  log('panels');
  await closeAll(page);
  const dialogCheck = async (key, openFn) => {
    const P = F.panels[key] = {};
    try {
      await openFn(); await page.locator('[role=dialog]').waitFor({ timeout: 5000 }); await page.waitForTimeout(450);
      P.title = await page.locator('[role=dialog] h2').first().innerText().catch(() => null);
      P.layout = await audit(page, '[role=dialog]');
      P.scroll = await page.evaluate(() => { const d = document.querySelector('[role=dialog]'); const r = d.getBoundingClientRect(); return { h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, scrollable: d.scrollHeight > d.clientHeight + 2, scrollH: d.scrollHeight }; });
      P.closeButton = await page.locator('[role=dialog] button').evaluateAll(bs => bs.filter(b => /close|닫기/i.test((b.getAttribute('aria-label') || '') + b.innerText)).map(b => (b.getAttribute('aria-label') || b.innerText).trim()));
      await shot(page, `D-${key}.png`);
      // Close with the X button.
      const x = page.locator('[role=dialog] [data-slot=dialog-close], [role=dialog] button[aria-label*="lose"], [role=dialog] button:has(.sr-only)').first();
      P.xButton = await x.count() > 0;
      if (P.xButton) { await x.click(); await page.waitForTimeout(300); P.xCloses = !(await visible(page, '[role=dialog]')); }
      // Close by clicking outside.
      await openFn(); await page.locator('[role=dialog]').waitFor({ timeout: 5000 }); await page.waitForTimeout(300);
      await page.mouse.click(8, 540); await page.waitForTimeout(300); P.outsideCloses = !(await visible(page, '[role=dialog]'));
      if (!P.outsideCloses) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
      // Close with Escape.
      await openFn(); await page.locator('[role=dialog]').waitFor({ timeout: 5000 }); await page.waitForTimeout(300);
      await page.keyboard.press('Escape'); await page.waitForTimeout(300); P.escCloses = !(await visible(page, '[role=dialog]'));
      P.pausedWhileOpen = await sim(page, () => window.tgScene.sim.paused);
    } catch (e) { P.error = e.message.split('\n')[0]; await closeAll(page); }
  };
  await dialogCheck('market', () => page.getByRole('button', { name: '시장', exact: true }).click());
  await dialogCheck('goals', () => page.locator('.objective-card').click());
  await dialogCheck('residents', () => page.getByRole('button', { name: '주민', exact: true }).click());
  await dialogCheck('world', () => page.getByRole('button', { name: '세계 지도' }).click());
  await dialogCheck('settings', () => page.getByRole('button', { name: '게임 설정' }).click());
  await dialogCheck('help', () => page.getByRole('button', { name: '도움말' }).click());
  await dialogCheck('money', () => page.locator('.resource-strip .money').click());
  // Campaign tabs inside the world dialog.
  try {
    await page.getByRole('button', { name: '세계 지도' }).click(); await page.locator('[role=dialog]').waitFor(); await page.waitForTimeout(400);
    const tabs = await page.locator('[role=dialog] .campaign-tabs button').allInnerTexts(); F.panels.worldTabNames = tabs;
    F.panels.worldTabs = [];
    for (let k = 0; k < tabs.length; k++) { await page.locator('[role=dialog] .campaign-tabs button').nth(k).click(); await page.waitForTimeout(300); F.panels.worldTabs.push({ tab: tabs[k].trim(), layout: await audit(page, '[role=dialog]'), text: (await page.locator('[role=dialog]').innerText()).replace(/\s+/g, ' ').slice(0, 500) }); await shot(page, `D-world-tab${k + 1}.png`); }
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  } catch (e) { F.panels.worldTabsError = e.message.split('\n')[0]; await closeAll(page); }
  // Credits (inside settings).
  try { await page.getByRole('button', { name: '게임 설정' }).click(); await page.getByRole('button', { name: '에셋 출처' }).click(); await page.waitForTimeout(300); F.panels.credits = { text: (await page.locator('[role=dialog]').innerText()).slice(0, 600) }; await shot(page, 'D-credits.png'); await page.keyboard.press('Escape'); await page.waitForTimeout(300); } catch (e) { F.panels.creditsError = e.message.split('\n')[0]; await closeAll(page); }
  // Build dock: every tab.
  try {
    await page.getByRole('button', { name: '건설 목록 열기' }).click(); await page.locator('.build-dock').waitFor();
    F.panels.build = {};
    for (const tab of await page.locator('.build-dock [role=tab]').allInnerTexts()) { await page.getByRole('tab', { name: tab.trim() }).click(); await page.waitForTimeout(200); F.panels.build[tab.trim()] = { layout: await audit(page, '.build-dock'), items: await page.locator('.build-item').evaluateAll(bs => bs.map(b => ({ name: b.querySelector('strong')?.innerText, disabled: b.disabled, price: b.querySelector('.item-price')?.innerText.trim(), cls: b.className.replace('build-item', '').trim() }))) }; }
    await shot(page, 'D-build-dock.png');
    await page.keyboard.press('Escape'); await page.waitForTimeout(200); F.panels.buildEscCloses = !(await visible(page, '.build-dock'));
  } catch (e) { F.panels.buildError = e.message.split('\n')[0]; }
  // Map edges card.
  try { await page.getByRole('button', { name: '주변 지형' }).click(); await page.waitForTimeout(300); F.panels.mapEdges = { layout: await audit(page, '.map-edges-card'), text: (await page.locator('.map-edges-card').innerText()).replace(/\s+/g, ' ').slice(0, 300) }; await shot(page, 'D-map-edges.png'); await page.keyboard.press('Escape'); await page.waitForTimeout(200); F.panels.mapEdges.escCloses = !(await visible(page, '.map-edges-card')); if (!F.panels.mapEdges.escCloses) await page.getByRole('button', { name: '주변 지형 닫기' }).click(); const tgt0 = await sim(page, () => window.tgScene.controls.target.toArray()); await page.getByRole('button', { name: '주변 지형' }).click(); await page.locator('.map-edge-list button').first().click(); await page.waitForTimeout(300); F.panels.mapEdges.focusMoved = JSON.stringify(tgt0) !== JSON.stringify(await sim(page, () => window.tgScene.controls.target.toArray())); F.panels.mapEdges.overlay = await sim(page, () => window.tgScene.overlay); await shot(page, 'D-map-edges-focus.png'); } catch (e) { F.panels.mapEdgesError = e.message.split('\n')[0]; }
  // Facility card of the warehouse and of a production building; tile panel of an empty tile.
  try {
    await closeAll(page);
    const wid = await sim(page, () => window.tgScene.sim.warehouse.id);
    const m = page.locator(`[data-building-id="${wid}"]`);
    F.panels.warehouseMarker = await m.count();
    const prod = await sim(page, () => { const b = window.tgScene.sim.buildings.find(b => b.type === 'field' || b.type === 'lumber'); return b ? [b.x, b.z] : null; });
    if (prod) { await clickTile(page, prod[0], prod[1]); await page.waitForTimeout(300); F.panels.facility = { open: await visible(page, '.facility-card'), layout: await audit(page, '.facility-card') }; await shot(page, 'D-facility.png'); await page.locator('.facility-details summary').click().catch(() => {}); await page.waitForTimeout(200); F.panels.facilityDetails = await audit(page, '.facility-card'); await shot(page, 'D-facility-details.png'); await page.keyboard.press('Escape'); await page.waitForTimeout(200); F.panels.facilityEscCloses = !(await visible(page, '.facility-card')); }
    const empty = await sim(page, () => { const s = window.tgScene.sim; for (const k of s.owned) { const [x, z] = k.split(',').map(Number); if (!s.at(x, z) && s.tile(x, z).terrain !== 'water' && !s.tile(x, z).nature) return [x, z]; } return null; });
    if (empty) { await clickTile(page, empty[0], empty[1]); await page.waitForTimeout(300); F.panels.tile = { open: await visible(page, '.tile-panel'), layout: await audit(page, '.tile-panel'), text: (await page.locator('.tile-panel').innerText().catch(() => '')).replace(/\s+/g, ' ') }; await shot(page, 'D-tile-panel.png'); await page.keyboard.press('Escape'); }
  } catch (e) { F.panels.facilityError = e.message.split('\n')[0]; }

  // ---------- Keyboard, wheel, drag ----------
  log('input');
  await closeAll(page);
  const cam = () => sim(page, () => { const s = window.tgScene; return { view: s.viewIndex, zoom: +s.camera.zoom.toFixed(3), target: s.controls.target.toArray().map(v => +v.toFixed(2)), paused: s.sim.paused, speed: s.sim.speed, mode: s.mode, dock: !!document.querySelector('.build-dock') }; });
  await page.locator('canvas').first().focus();
  const I = F.input;
  I.start = await cam();
  await page.keyboard.press('e'); await raf(page); I.afterE = await cam();
  await page.keyboard.press('q'); await raf(page); I.afterQ = await cam();
  await page.keyboard.press('b'); await page.waitForTimeout(150); I.afterB = await cam();
  await page.keyboard.press('Escape'); await page.waitForTimeout(150); I.afterEsc = await cam();
  await page.keyboard.press('Space'); await page.waitForTimeout(150); I.afterSpace = await cam();
  await page.keyboard.press('Space'); await page.waitForTimeout(150); I.afterSpace2 = await cam();
  await page.keyboard.press('3'); I.after3 = await cam(); await page.keyboard.press('1'); I.after1 = await cam();
  await page.keyboard.press('Equal'); await raf(page); I.afterPlus = await cam();
  await page.keyboard.press('Minus'); await raf(page); I.afterMinus = await cam();
  // Keys while a dialog is open must not act on the map.
  await page.getByRole('button', { name: '시장', exact: true }).click(); await page.locator('[role=dialog]').waitFor();
  await page.keyboard.press('e'); await page.keyboard.press('b'); I.keysInDialog = await cam(); await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  // Wheel zoom over the map centre.
  await page.mouse.move(960, 540); const z0 = (await cam()).zoom;
  await page.mouse.wheel(0, -400); await page.waitForTimeout(500); I.wheelIn = { before: z0, after: (await cam()).zoom };
  await page.mouse.wheel(0, 800); await page.waitForTimeout(500); I.wheelOut = (await cam()).zoom;
  // Left drag pans; right drag pans (help says both); a short drag must not select.
  const tg0 = (await cam()).target; await page.mouse.move(900, 500); await page.mouse.down(); await page.mouse.move(1100, 600, { steps: 12 }); await page.mouse.up(); await page.waitForTimeout(400);
  I.leftDrag = { before: tg0, after: (await cam()).target, selectedAfter: await visible(page, '.facility-card, .tile-panel') };
  const tg1 = (await cam()).target; await page.mouse.move(900, 500); await page.mouse.down({ button: 'right' }); await page.mouse.move(700, 400, { steps: 12 }); await page.mouse.up({ button: 'right' }); await page.waitForTimeout(400);
  I.rightDrag = { before: tg1, after: (await cam()).target };
  // Markers must follow the camera during a drag (they are recomputed every 0.4 s).
  const markerLag = await page.evaluate(async () => { const m = document.querySelector('.facility-marker'); if (!m) return null; const s = window.tgScene; const before = m.getBoundingClientRect().x; s.controls.target.x += 3; s.camera.position.x += 3; s.controls.update(); const t0 = performance.now(); let moved = null; while (performance.now() - t0 < 1500) { await new Promise(r => requestAnimationFrame(r)); if (Math.abs(m.getBoundingClientRect().x - before) > 5) { moved = Math.round(performance.now() - t0); break; } } return { lagMs: moved }; });
  I.markerLag = markerLag;
  await shot(page, 'E01-after-input.png');
  // Hover over a building must show its name (title / marker).
  // ---------- Save, reload, continue ----------
  log('save/load');
  await closeAll(page);
  if (!(await sim(page, () => window.tgScene.sim.paused))) await page.getByRole('button', { name: '일시정지', exact: true }).click();
  await page.getByRole('button', { name: '게임 설정' }).click();
  await page.getByRole('button', { name: '지금 저장' }).click(); await page.waitForTimeout(300);
  F.saveLoad.saveToast = (await page.evaluate(() => window.tgToasts.slice(-2))).map(x => x.text);
  F.saveLoad.saveStatus = await page.locator('.save-status').innerText();
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  const before = await snap();
  await page.reload();
  F.timing.reload = await toHome(page);
  F.saveLoad.continueEnabled = await page.getByRole('button', { name: /이어하기/ }).first().isEnabled();
  const tc = Date.now();
  await page.getByRole('button', { name: /이어하기/ }).first().click();
  await waitSim(page, () => !!window.tgScene?.sim && window.tgScene.sim.buildings.length > 0 && !document.querySelector('.screen-loading'), null, 60000);
  F.timing.continueMs = Date.now() - tc;
  await page.waitForTimeout(1500);
  const after = await snap();
  const diff = {}; for (const k of Object.keys(before)) if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) diff[k] = { before: before[k], after: after[k] };
  F.saveLoad.diff = diff; F.saveLoad.before = before;
  F.saveLoad.pausedLabel = await visible(page, '.pause-label');
  await shot(page, 'F01-after-continue.png');
  // Start screen -> new game must ask before replacing the save.
  await page.getByRole('button', { name: '게임 설정' }).click(); await page.getByRole('button', { name: '시작 화면으로' }).click(); await page.waitForTimeout(400);
  await page.getByRole('button', { name: '새 게임' }).click(); await page.getByRole('button', { name: /이 땅에서 시작/ }).click(); await page.waitForTimeout(400);
  F.saveLoad.confirmNew = { shown: await visible(page, '[role=dialog]'), text: (await page.locator('[role=dialog]').innerText().catch(() => '')).replace(/\s+/g, ' ') };
  await shot(page, 'F02-confirm-new.png');
  await page.getByRole('button', { name: '취소' }).click().catch(() => {});
} catch (e) { F.aborted = e.message.split('\n').slice(0, 3).join(' | '); await shot(page, 'Z-flow-aborted.png').catch(() => {}); }
F.longTasks = await page.evaluate(() => ({ count: window.tgLongTasks.length, over100: window.tgLongTasks.filter(v => v.d > 100).length, max: Math.max(0, ...window.tgLongTasks.map(v => v.d)), top: [...window.tgLongTasks].sort((a, b) => b.d - a.d).slice(0, 8) })).catch(() => null);
F.R = R;
await save('flow.json', F);
console.log(JSON.stringify({ aborted: F.aborted, timing: F.timing, errors: R.errors.length, consoleErrors: R.consoleErrors.length, failed: R.failedRequests.length }, null, 1));
await browser.close();
