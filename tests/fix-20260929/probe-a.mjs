// F3a probe A (1366x768, new game): J2 waiting actions, B10 Esc keeps the tool, B14 map edges Esc, B9 no 조작법 flash,
// B4 help from settings, B5 promotion sound + unlocked facilities, A2-E1 finale, J13 build cards, J15 tile panel,
// J7 demolish with refund, C5 persistent save failure.
import { R, open, toHome, newGameFromHome, sim, browser, save, shot, clickTile, raf } from './_setup.mjs';
import { place, boxes, reachable, toasts, settle } from './_setup.mjs';
const out = { overrides: [] }, page = await open({ width: 1366, height: 768 });
await toHome(page); await newGameFromHome(page);
const mode = () => sim(page, () => window.tgScene.mode);

// B10: placement tool survives a dialog closed with Escape; B14: surroundings card closes with Escape.
await page.locator('.header-actions button[aria-label="게임 설정"]').click(); await page.locator('[role=dialog]').waitFor(); await settle(page, 300);
await page.keyboard.press('Escape'); await settle(page, 400);
out.B10 = { modeAfterDialogEsc: await mode() };
// B4: settings has a 조작법 button that opens the help dialog.
await page.locator('.header-actions button[aria-label="게임 설정"]').click(); await page.locator('[role=dialog]').waitFor();
await page.getByRole('button', { name: '조작법' }).click(); await settle(page, 400);
out.B4 = { helpTitle: await page.locator('[role=dialog] h2').innerText(), keys: (await page.locator('.help-keys').innerText()).slice(0, 60) };
await shot(page, 'a-B4-help-from-settings.png');
// B9: record dialog title every frame while a non-help dialog (신분과 권한) closes.
await page.keyboard.press('Escape'); await settle(page, 400);
await page.locator('.objective-card').click(); await page.locator('[role=dialog]').waitFor(); await settle(page, 300);
out.B9 = await page.evaluate(() => new Promise(res => { const seen = []; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); const f = () => { const d = document.querySelector('[role=dialog]'); seen.push(d ? d.querySelector('h2')?.innerText || '' : null); if (seen.length < 30 && d) requestAnimationFrame(f); else res({ titlesWhileClosing: [...new Set(seen)] }); }; requestAnimationFrame(f); }));
await settle(page, 300);
if (await page.locator('[role=dialog]').count()) { await page.keyboard.press('Escape'); await settle(page, 300); }
out.B10.modeAfterSecondDialog = await mode();

// Tutorial through its five build steps (placed on valid tiles, free) to reach 첫 납품.
out.overrides.push('tutorial buildings placed through sim.build(...,free) on the nearest valid tile');
for (const t of ['warehouse', 'house', 'well', 'field', 'lumber']) out[t] = await place(page, t);
await sim(page, () => { window.tgScene.setMode(null); window.tgScene.sim.revision++; });
await page.keyboard.press('Escape'); await settle(page, 900);
// The first order is ready from the starting stock (F1); send it, then the guide waits on 첫 승급.
out.J2 = { firstContract: await page.locator('.tutorial-card button', { hasText: '납품' }).innerText().catch(() => null) };
await page.locator('.tutorial-card button', { hasText: '납품' }).click().catch(() => {}); await settle(page, 900);
Object.assign(out.J2, { step: await page.locator('.tutorial-card strong').first().innerText(), text: await page.locator('.tutorial-card p').first().innerText(), wait: await boxes(page, '.tutorial-wait button') });
await shot(page, 'a-J2-tutorial-waiting.png', { clip: { x: 1080, y: 150, width: 286, height: 330 } });
await page.locator('.tutorial-wait button', { hasText: '4배' }).click(); await settle(page, 300);
out.J2.speedAfter = await sim(page, () => window.tgScene.sim.speed);

// B14: surroundings card open -> Escape closes it.
await sim(page, () => { window.tgScene.sim.speed = 1; window.tgScene.sim.paused = true; });
await page.locator('.map-edges-toggle').click(); await settle(page, 300);
const edgesOpen = await page.locator('.map-edges-card').count();
await page.keyboard.press('Escape'); await settle(page, 300);
out.B14 = { openBefore: edgesOpen, openAfterEsc: await page.locator('.map-edges-card').count() };

// J13: build cards show inputs -> output, locked cards name the rank.
await page.getByRole('button', { name: '건설 목록 열기' }).click(); await settle(page, 400);
await page.getByRole('tab', { name: '가공' }).click(); await settle(page, 300);
out.J13 = { flows: await page.evaluate(() => [...document.querySelectorAll('.build-item')].slice(0, 6).map(b => ({ name: b.querySelector('strong')?.innerText, flow: b.querySelector('.item-flow')?.getAttribute('title'), price: b.querySelector('.item-price')?.innerText.replace(/\s+/g, ' ') }))) };
await shot(page, 'a-J13-build-cards.png', { clip: { x: 300, y: 540, width: 766, height: 228 } });
await page.getByRole('button', { name: '건설 목록 닫기' }).click(); await settle(page, 300);

// J15: an empty tile shows the numbers usable now; later ones fold behind 더 보기.
const empty = await sim(page, () => { const s = window.tgScene.sim; for (const k of s.owned) { const [x, z] = k.split(',').map(Number); const t = s.tile(x, z); if (t && t.terrain !== 'water' && !s.at(x, z) && !t.nature && !s.roads.has(k)) return [x, z]; } return null; });
await clickTile(page, empty[0], empty[1]); await settle(page, 400);
out.J15 = { rows: await page.evaluate(() => [...document.querySelectorAll('.tile-panel > div')].map(d => d.innerText.replace(/\s+/g, ' '))), more: await page.locator('.tile-more summary').innerText().catch(() => null) };
await shot(page, 'a-J15-tile-panel.png');
await page.keyboard.press('Escape'); await settle(page, 300);

// J7: demolish from the facility card, two presses, refund shown and paid.
const well = out.well; await sim(page, id => { window.tgScene.select(id); }, well.id);
await page.evaluate(id => document.querySelector(`.facility-marker[data-building-id="${id}"]`)?.click(), well.id);
if (!(await page.locator('.facility-card').count())) await clickTile(page, well.x, well.z);
await settle(page, 400);
const money0 = await sim(page, () => window.tgScene.sim.money);
const demolishLabel = await page.locator('.demolish-action').innerText();
await page.locator('.demolish-action').click(); await settle(page, 200);
const armed = await page.locator('.demolish-action').innerText();
await shot(page, 'a-J7-demolish-armed.png');
await page.locator('.demolish-action').click(); await settle(page, 400);
out.J7 = { label: demolishLabel, armed, moneyGained: Math.round((await sim(page, () => window.tgScene.sim.money)) - money0), wellLeft: await sim(page, x => window.tgScene.sim.buildings.some(b => b.id === x), well.id) };

// J7 (F1 rule): a facility paid for moments ago refunds money and materials in full; the button says so and counts down.
const fresh = await sim(page, () => { const s = window.tgScene.sim, tiles = [...s.owned].map(k => k.split(',').map(Number)); for (const [x, z] of tiles) if (!s.canBuild('well', x, z)) { const r = s.build('well', x, z); if (r.ok) return { id: r.id, x, z }; } return null; });
await page.keyboard.press('Escape'); await clickTile(page, fresh.x, fresh.z); await settle(page, 400);
out.J7.fresh = { label: await page.locator('.demolish-action').innerText().catch(() => null) };
await shot(page, 'a-J7-demolish-full-refund.png');
const m1 = await sim(page, () => window.tgScene.sim.money);
await page.locator('.demolish-action').click(); await page.locator('.demolish-action').click(); await settle(page, 400);
out.J7.fresh.moneyBack = Math.round((await sim(page, () => window.tgScene.sim.money)) - m1);
// C5: storage writes fail -> a persistent top-of-stack notice, gone after a successful save.
out.overrides.push('C5: Storage.prototype.setItem throws for the save key during the check');
await page.evaluate(() => { const o = Storage.prototype.setItem; window.__restoreSet = () => { Storage.prototype.setItem = o; }; Storage.prototype.setItem = function (k, v) { if (/^first-land-v1/.test(k)) throw new DOMException('quota', 'QuotaExceededError'); return o.call(this, k, v); }; });
await page.locator('.header-actions button[aria-label="게임 설정"]').click(); await page.getByRole('button', { name: '지금 저장' }).click(); await page.keyboard.press('Escape'); await settle(page, 500);
out.C5 = { shownAfterFailure: await page.locator('.save-failure').count() };
await page.waitForTimeout(6500); out.C5.stillShownAfterAutosave = await page.locator('.save-failure').count();
await shot(page, 'a-C5-save-failure.png', { clip: { x: 1080, y: 150, width: 286, height: 330 } });
await page.evaluate(() => window.__restoreSet()); await page.waitForTimeout(6500); out.C5.afterRecovery = await page.locator('.save-failure').count();

// B5 + A2-E1: promotion readiness injected (requirements met); the fanfare plays once, no extra success jingle.
out.overrides.push('B5/A2-E1: sim.promotion() patched to report ready so the promote button is enabled');
await sim(page, () => { const s = window.tgScene.sim, real = s.promotion.bind(s); s.promotion = () => { const p = real(); return p && { ...p, ready: true, fee: 0, requirements: p.requirements.map(r => ({ ...r, done: true, current: r.target })), trial: p.trial && { ...p.trial, done: true } }; }; s.paused = false; s.speed = 1; window.tgAudioLog.length = 0; });
await page.locator('.objective-card').click(); await page.locator('.promotion-box button', { hasText: '승급' }).click(); await settle(page, 900);
out.B5 = { dialog: await page.locator('[role=dialog] h2').innerText(), unlocked: await page.evaluate(() => [...document.querySelectorAll('.unlocked-grid button span')].map(e => e.innerText)), audio: await page.evaluate(() => window.tgAudioLog.filter(e => e.m !== 'tone' && e.a !== 'click' && e.a !== 'footstep').map(e => e.m + ':' + e.a)), successCalls: await page.evaluate(() => window.tgAudioLog.filter(e => e.m === 'success').length), fanfareTones: await page.evaluate(() => window.tgAudioLog.filter(e => e.m === 'tone').length) };
await shot(page, 'a-B5-promotion.png');
await page.keyboard.press('Escape'); await settle(page, 400);
const ranks = await page.evaluate(async () => (await import('/src/app/game/world.js')).RANKS.length);
out.overrides.push('A2-E1: rank set to the one below the top (' + (ranks - 2) + ')');
await sim(page, n => { window.tgScene.sim.rank = n - 2; }, ranks);
await page.locator('.objective-card').click(); await page.locator('.promotion-box button', { hasText: '승급' }).click(); await settle(page, 900);
out.A2E1 = { dialog: await page.locator('[role=dialog] h2').innerText(), stats: await page.evaluate(() => [...document.querySelectorAll('.finale-stats div')].map(d => d.innerText.replace(/\s+/g, ' '))) };
await shot(page, 'a-A2E1-finale.png');
await page.getByRole('button', { name: '계속 운영' }).click(); await settle(page, 300);
out.A2E1.closed = !(await page.locator('[role=dialog]').count());

out.R = R; await save('probe-a.json', out); console.log(JSON.stringify(out, null, 1)); await browser.close();
