// Audit 2026-09-29 stage B, probe 4 (1920x1080 unless noted): page scroll inside the game, dialog exit flash,
// storm warning numbers at 4x, sound controls (mute / volume reach the audio graph), rapid clicking, the empty
// build-list states, hover feedback on the map, and what a player sees and hears at build / sale / contract /
// promotion / storm / raid (sound calls, toasts, marker and HUD changes).
// State overrides are listed in `overrides` (used only to reach a moment quickly, never to judge a rule).
// Usage: node tests/audit-2/browser-misc.mjs <playwright/index.mjs> <chrome.exe>
import { R, open, toHome, newGameFromHome, demo, shot, sim, waitSim, visible, save, clickTile, tilePoint, closeAll, audit, raf, browser, log } from './_browser.mjs';
const M = { overrides: [] };
const page = await open({ width: 1920, height: 1080 });
await page.addInitScript(() => { window.tgToasts = []; const seen = new WeakSet(); new MutationObserver(() => { for (const el of document.querySelectorAll('[data-sonner-toast]')) if (!seen.has(el)) { seen.add(el); window.tgToasts.push({ t: Math.round(performance.now()), type: el.getAttribute('data-type'), text: el.innerText.replace(/\s+/g, ' ').slice(0, 140) }); } }).observe(document, { childList: true, subtree: true }); });
const now = () => page.evaluate(() => Math.round(performance.now()));
const audioSince = t => page.evaluate(t => window.tgAudioLog.filter(e => e.t >= t).map(e => e.m + ':' + e.a), t);
const toastsSince = t => page.evaluate(t => window.tgToasts.filter(e => e.t >= t).map(e => (e.type || 'plain') + ':' + e.text), t);
const override = async (label, fn, arg) => { M.overrides.push(label); await sim(page, fn, arg); };
const step = async (key, fn) => { log(key); try { M[key] = await fn(); } catch (e) { M[key] = { ...(M[key] || {}), error: e.message.split('\n')[0] }; await shot(page, `M-error-${key}.png`).catch(() => {}); await closeAll(page).catch(() => {}); } };
const scrollState = () => page.evaluate(() => { const se = document.scrollingElement; const tall = [...document.querySelectorAll('.game-shell *')].filter(e => { const r = e.getBoundingClientRect(); return r.bottom > innerHeight + 2 && r.height > 0 && getComputedStyle(e).position !== 'fixed' && e.getClientRects().length; }).slice(0, 8).map(e => `${e.tagName.toLowerCase()}.${String(e.className?.baseVal ?? e.className).split(' ').slice(0, 2).join('.')} bottom=${Math.round(e.getBoundingClientRect().bottom)}`); const shell = document.querySelector('.game-shell'); return { winScrollY: Math.round(scrollY), docScrollable: se.scrollHeight - innerHeight, shellScrollTop: shell ? shell.scrollTop : null, shellScrollable: shell ? shell.scrollHeight - shell.clientHeight : null, bodyOverflow: getComputedStyle(document.body).overflow, beyondBottom: tall }; });

await toHome(page);
await newGameFromHome(page);
await clickTile(page, 11, 12);
await waitSim(page, () => window.tgScene.sim.buildings.some(b => b.type === 'warehouse'), null, 10000);

await step('pageScroll', async () => {
  const r = { initial: await scrollState() };
  // Wheel over HUD panels (not the canvas), arrow/page keys with focus on the page, and a focus() of the bottom-most control.
  for (const sel of ['.tutorial-card', '.resource-strip', '.town-actions', '.camera-controls']) { const b = await page.locator(sel).first().boundingBox().catch(() => null); if (!b) continue; await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.wheel(0, 600); await page.waitForTimeout(250); r['wheel ' + sel] = await scrollState(); await page.evaluate(() => { scrollTo(0, 0); const s = document.querySelector('.game-shell'); if (s) s.scrollTop = 0; }); }
  await page.locator('body').click({ position: { x: 5, y: 5 }, force: true }).catch(() => {});
  for (const key of ['ArrowDown', 'PageDown', 'End']) { await page.keyboard.press(key); await page.waitForTimeout(200); r['key ' + key] = await scrollState(); await page.evaluate(() => scrollTo(0, 0)); }
  // Clicking a control near the bottom edge through Playwright scrolls it into view if the page can scroll.
  await page.getByRole('button', { name: '건설 목록 열기' }).click(); await page.waitForTimeout(250); r.afterBuildOpen = await scrollState(); await shot(page, 'M01-scroll-build-open.png');
  await page.keyboard.press('Escape');
  return r;
});

await step('dialogExit', async () => {
  await page.locator('.objective-card').click(); await page.locator('[role=dialog]').waitFor(); await page.waitForTimeout(500);
  const before = await page.evaluate(() => document.querySelector('[role=dialog] h2')?.innerText);
  await page.keyboard.press('Escape');
  const frames = [];
  for (let k = 0; k < 12; k++) { frames.push(await page.evaluate(() => { const d = document.querySelector('[role=dialog]'); return d ? { title: d.querySelector('h2')?.innerText.replace(/\s+/g, ' '), bodyChars: d.innerText.length, opacity: +(+getComputedStyle(d).opacity).toFixed(2) } : null; })); if (k === 1) await shot(page, 'M02-dialog-closing.png'); await page.waitForTimeout(25); }
  return { before, frames };
});

await step('hover', async () => {
  // Pointer over a building without clicking: is there a name / status cue?
  const p = await tilePoint(page, 11, 12); await page.mouse.move(p.px + 3, p.py + 3); await page.waitForTimeout(700);
  const r = await page.evaluate(() => ({ markers: [...document.querySelectorAll('.facility-marker')].map(m => m.innerText.replace(/\s+/g, ' ')), cursor: getComputedStyle(document.querySelector('.world-canvas canvas')).cursor, hoverLine: window.tgScene.hoverLine.visible }));
  await shot(page, 'M03-hover-warehouse.png'); return r;
});

await step('sound', async () => {
  const r = {};
  const state = () => page.evaluate(() => { const a = window.tgAudio; if (!a) return 'no-instance'; return { ctx: a.context?.state, muted: a.muted, volumes: { ...a.volumes }, masterGain: a.master?.gain?.value ?? a.gains?.master?.gain?.value ?? null }; });
  r.before = await state();
  const label = await page.locator('.header-actions button[aria-label*="소리"]').first().getAttribute('aria-label');
  await page.locator('.header-actions button[aria-label*="소리"]').first().click(); await page.waitForTimeout(200); r.afterToggle = { label, state: await state() };
  await page.locator('.header-actions button[aria-label*="소리"]').first().click(); await page.waitForTimeout(200); r.afterToggleBack = await state();
  await page.getByRole('button', { name: '게임 설정' }).click(); await page.locator('[role=dialog]').waitFor();
  const slider = page.getByRole('slider', { name: '전체 음량' }); const box = await slider.boundingBox();
  if (box) { await page.mouse.click(box.x + box.width * 0.1, box.y + box.height / 2); await page.waitForTimeout(200); r.afterMasterLow = await state(); }
  r.statusLine = await page.locator('.audio-status').innerText().catch(() => null);
  await page.getByRole('button', { name: '기본 음량 복원' }).click(); await page.waitForTimeout(150); r.afterReset = await state();
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  return r;
});

await step('rapidClicks', async () => {
  const e0 = R.errors.length;
  for (let k = 0; k < 12; k++) await page.locator('.town-actions .build-action').click({ delay: 0 });
  for (let k = 0; k < 6; k++) { await page.getByRole('button', { name: '시장', exact: true }).click(); await page.keyboard.press('Escape'); }
  for (let k = 0; k < 8; k++) { await page.keyboard.press(k % 2 ? 'q' : 'e'); }
  await page.waitForTimeout(400);
  return { newErrors: R.errors.slice(e0), dock: await visible(page, '.build-dock'), dialog: await visible(page, '[role=dialog]'), view: await sim(page, () => window.tgScene.viewIndex) };
});

await step('buildFeedback', async () => {
  await closeAll(page);
  const r = {};
  // Build a house from the build list onto a chosen tile (real clicks), watch 1.5 s of feedback.
  await page.getByRole('button', { name: '건설 목록 열기' }).click(); await page.getByRole('tab', { name: '주거' }).click(); await page.getByRole('button', { name: '주민 주택 건설' }).click();
  const tile = await sim(page, () => { const s = window.tgScene.sim; for (const k of s.owned) { const [x, z] = k.split(',').map(Number); if (!s.canBuild('house', x, z)) return [x, z]; } return null; });
  const t0 = await now(); const money0 = await sim(page, () => window.tgScene.sim.money);
  await clickTile(page, tile[0], tile[1]); await page.waitForTimeout(150); await shot(page, 'M04-build-moment.png'); await page.waitForTimeout(1300);
  r.house = { audio: await audioSince(t0), toasts: await toastsSince(t0), moneyDelta: Math.round(await sim(page, () => window.tgScene.sim.money) - money0), cardOpened: await visible(page, '.facility-card'), status: await sim(page, ([x, z]) => window.tgScene.sim.at(x, z)?.status, tile) };
  // Invalid placement: on water / unowned.
  await closeAll(page); await page.getByRole('button', { name: '건설 목록 열기' }).click(); await page.getByRole('tab', { name: '기초' }).click(); await page.getByRole('button', { name: '우물 건설' }).click();
  const bad = await sim(page, () => { const s = window.tgScene.sim; for (let x = 0; x < 24; x++) for (let z = 0; z < 24; z++) if (!s.ownedAt(x, z) && s.tile(x, z).terrain !== 'water') return [x, z]; return null; });
  const t1 = await now(); await clickTile(page, bad[0], bad[1]); await page.waitForTimeout(500);
  r.invalid = { audio: await audioSince(t1), toasts: await toastsSince(t1), hint: await page.locator('.placement-hint').innerText().catch(() => null) }; await shot(page, 'M05-invalid-placement.png');
  await page.keyboard.press('Escape');
  // Not enough money: set money 10 (override) and try a building.
  await override('money=10 to try an unaffordable build', () => { window.tgScene.sim.money = 10; });
  await page.getByRole('button', { name: '건설 목록 열기' }).click(); await page.getByRole('tab', { name: '기초' }).click();
  r.unaffordable = await page.locator('.build-item').evaluateAll(bs => bs.map(b => ({ name: b.querySelector('strong')?.innerText, disabled: b.disabled, cls: b.className })));
  await shot(page, 'M06-unaffordable-dock.png');
  const t2 = await now(); await page.getByRole('button', { name: '우물 건설' }).click(); const tile2 = await sim(page, () => { const s = window.tgScene.sim; for (const k of s.owned) { const [x, z] = k.split(',').map(Number); if (!s.at(x, z) && s.tile(x, z).terrain !== 'water' && !s.tile(x, z).nature) return [x, z]; } return null; });
  await page.waitForTimeout(100); r.unaffordableHint = await page.locator('.placement-hint').innerText().catch(() => null);
  await clickTile(page, tile2[0], tile2[1]); await page.waitForTimeout(400); r.unaffordableClick = { audio: await audioSince(t2), toasts: await toastsSince(t2) };
  await page.keyboard.press('Escape');
  await override('money=1200 restored', () => { window.tgScene.sim.money = 1200; });
  return r;
});

await step('saleContractPromotion', async () => {
  await closeAll(page); const r = {};
  await override('stock wood/grain/water +60 to sell, deliver and promote at once', () => { const s = window.tgScene.sim; s.stock.wood += 60; s.stock.grain += 60; s.stock.water += 60; s.produced.water = Math.max(s.produced.water || 0, 40); s.produced.grain = Math.max(s.produced.grain || 0, 40); });
  // Sale.
  await page.getByRole('button', { name: '시장', exact: true }).click(); await page.locator('[role=dialog]').waitFor(); await page.waitForTimeout(300);
  const sell = page.locator('[role=dialog] button[aria-label^="목재"][aria-label$="판매"]').last();
  const t0 = await now(); const m0 = await sim(page, () => window.tgScene.sim.money); await sell.click(); await page.waitForTimeout(300);
  r.sale = { button: await sell.getAttribute('aria-label'), audio: await audioSince(t0), toasts: await toastsSince(t0), moneyImmediate: Math.round(await sim(page, () => window.tgScene.sim.money) - m0), dialogStillOpen: await visible(page, '[role=dialog]') };
  await shot(page, 'M07-sale-moment.png'); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '4×' }).click(); await waitSim(page, m => window.tgScene.sim.money > m + 1 || !window.tgScene.sim.shipments.length, m0, 30000).catch(() => {});
  r.sale.arrival = { toasts: await toastsSince(t0), audio: (await audioSince(t0)).filter(a => !/footstep|pickup|drop|well|lumber|field/.test(a)), moneyDelta: Math.round(await sim(page, () => window.tgScene.sim.money) - m0) };
  await page.getByRole('button', { name: '1×' }).click();
  // Contract then promotion from the rank dialog.
  await page.locator('.objective-card').click(); await page.locator('[role=dialog]').waitFor(); await page.waitForTimeout(300);
  const d = page.getByRole('button', { name: /^납품 \+/ });
  if (await d.count() && await d.isEnabled()) { const t1 = await now(); await d.click(); await page.waitForTimeout(400); r.contract = { audio: await audioSince(t1), toasts: await toastsSince(t1), label: await page.locator('.contract-box button').innerText().catch(() => null) }; await shot(page, 'M08-contract-moment.png'); }
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '4×' }).click(); await waitSim(page, () => window.tgScene.sim.promotion()?.ready, null, 60000).catch(() => {});
  await page.getByRole('button', { name: '1×' }).click();
  r.promotionReadyUi = { chip: await visible(page, '.promotion-ready'), tutorial: await page.locator('.tutorial-card').innerText().catch(() => null), gauge: await page.locator('.rank-gauge').getAttribute('aria-valuenow').catch(() => null) };
  await page.locator('.objective-card').click(); await page.locator('[role=dialog]').waitFor(); await page.waitForTimeout(300);
  const p = page.getByRole('button', { name: /^승급 · / });
  r.promoteEnabled = await p.isEnabled().catch(() => null);
  if (r.promoteEnabled) { const t2 = await now(); const rank0 = await sim(page, () => window.tgScene.sim.rank); await p.click(); await page.waitForTimeout(120); await shot(page, 'M09-promotion-moment.png'); await page.waitForTimeout(900); r.promotion = { rankFrom: rank0, rankTo: await sim(page, () => window.tgScene.sim.rank), audio: await audioSince(t2), toasts: await toastsSince(t2), dialogAfter: (await page.locator('[role=dialog]').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200) }; await page.keyboard.press('Escape'); await page.waitForTimeout(500); await shot(page, 'M10-after-promotion-hud.png'); r.promotion.hud = { tutorial: await page.locator('.tutorial-card').innerText().catch(() => null), operations: await page.locator('.operations-card').innerText().catch(() => null) }; }
  return r;
});

await step('storm', async () => {
  await closeAll(page);
  await page.getByRole('button', { name: '4×' }).click();
  await override('nextEvent = now + 2 (storm or other event comes at once, chosen by the game)', () => { const s = window.tgScene.sim; s.nextEvent = s.time + 2; });
  await waitSim(page, () => !!window.tgScene.sim.pendingEvent, null, 30000);
  await page.waitForTimeout(300);
  const r = { type: await sim(page, () => window.tgScene.sim.pendingEvent.type), speed: await sim(page, () => window.tgScene.sim.speed), toast: (await page.evaluate(() => window.tgToasts.slice(-3).map(t => t.text))), hud: await page.locator('.weather-warning').innerText().catch(() => null) };
  await shot(page, 'M11-event-warning-4x.png');
  const t0 = await now();
  await waitSim(page, () => !window.tgScene.sim.pendingEvent, null, 60000).catch(() => {});
  r.realSecondsUntilEvent = Math.round(((await now()) - t0) / 100) / 10;
  await page.waitForTimeout(600);
  r.after = { audio: (await audioSince(t0)).filter(a => !/footstep|pickup|drop|well|lumber|field/.test(a)), toasts: await toastsSince(t0), broken: await sim(page, () => window.tgScene.sim.buildings.filter(b => b.health < 100).map(b => b.type + ':' + Math.round(b.health))), shake: null };
  await shot(page, 'M12-event-after.png');
  await page.getByRole('button', { name: '1×' }).click();
  return r;
});

await step('raid', async () => {
  // Showcase has a 습격 체험 button: a real raid on screen.
  await page.getByRole('button', { name: '게임 설정' }).click(); await page.getByRole('button', { name: '시작 화면으로' }).click(); await page.waitForTimeout(400);
  await demo(page); await page.waitForTimeout(800);
  const t0 = await now();
  await page.getByRole('button', { name: '습격 체험' }).click();
  await waitSim(page, () => (window.tgScene.sim.attackers || []).length > 0, null, 30000).catch(() => {});
  await page.waitForTimeout(1500);
  const r = { attackers: await sim(page, () => (window.tgScene.sim.attackers || []).length), raidPanel: await page.locator('.raid-panel').innerText().catch(() => null), toasts: await toastsSince(t0), audio: (await audioSince(t0)).filter(a => !/footstep|pickup|drop|well|lumber|field/.test(a)).slice(0, 30) };
  await shot(page, 'M13-raid.png');
  // Where are the attackers on screen vs the viewport?
  r.attackersOnScreen = await sim(page, () => { const s = window.tgScene; const r = s.renderer.domElement.getBoundingClientRect(); return (s.sim.attackers || []).map(a => { const v = s.camera.position.clone().set(a.x, 0, a.z); v.project(s.camera); return { x: Math.round((v.x + 1) / 2 * r.width), y: Math.round((1 - v.y) / 2 * r.height), inView: Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 }; }); });
  return r;
});

M.R = R;
await save('misc.json', M);
console.log(JSON.stringify(M, null, 1).slice(0, 12000));
await browser.close();
