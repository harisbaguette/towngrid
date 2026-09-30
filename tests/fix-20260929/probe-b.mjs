// F3a probe B (1366x768): J6 contract warning (new game), then the rank-8 audit fixture for J1 storage full + next build,
// J4 depletion, J3 repair all, J5 money shortage, J12 alert stack, B15 storm seconds, J8 ledger, J9 upkeep not toasted,
// (marker checks B11-B13 live in probe-markers.mjs).
import { R, open, toHome, newGameFromHome, sim, browser, save, shot, clickTile } from './_setup.mjs';
import { place, loadFixture, boxes, reachable, overlaps, toasts, settle } from './_setup.mjs';
const out = { overrides: [] }, page = await open({ width: 1366, height: 768 });
await toHome(page); await newGameFromHome(page);
const card = () => page.evaluate(() => { const c = document.querySelector('.operations-card'); return c ? [...c.children].map(e => e.className.toString().split(' ')[0] + ': ' + e.innerText.replace(/\s+/g, ' ').slice(0, 90)) : null; });
const cardShot = name => shot(page, name, { clip: { x: 1080, y: 140, width: 286, height: 560 } });

// J6: rank 3 goal 빵 판매 while the lord orders 밀가루 (the audit's case), stock just enough for the order.
out.overrides.push('J6: warehouse placed free, rank=3 (guide ends at rank 2), contracts=1, flour stock = order size');
await place(page, 'warehouse'); await sim(page, () => { window.tgScene.setMode(null); }); await page.keyboard.press('Escape');
await sim(page, () => { const s = window.tgScene.sim; s.rank = 3; s.contracts = 1; s.contractReadyAt = 0; const c = s.contract(); s.stock[c.item] = c.amount; s.revision++; });
await settle(page, 900);
out.J6 = { card: await card(), warning: await page.locator('.contract-warning').innerText().catch(() => null) };
await cardShot('b-J6-contract-warning.png');

// Rank-8 fixture (real bot save) through 파일 불러오기.
await loadFixture(page, 8);
await sim(page, () => { const s = window.tgScene.sim; s.paused = false; s.speed = 1; s.nextEvent = 1e12; s.pendingEvent = null; });
out.overrides.push('fixture rank8 loaded; random events silenced (nextEvent far) so each check triggers only its own case');
await settle(page, 800);
out.start = await card();

// J1: a producer's output shelf full and the warehouse at capacity -> 창고 가득 참 with the fix buttons, next build kept.
out.overrides.push('J1: first plain producer out=10 and its product stock = storage capacity');
const full = await sim(page, () => { const s = window.tgScene.sim; const b = s.buildings.find(v => { const d = window.__B?.[v.type]; return v.enabled !== false && v.health >= 100 && s.recipeOf(v)?.output && s.stock[s.recipeOf(v).output] !== undefined && !['power', 'irrigation', 'transit'].includes(s.recipeOf(v).output) && s.recipeOf(v).output !== 'water'; }); const item = s.recipeOf(b).output; b.out = 10; s.stock[item] = s.storageCapacity; return { id: b.id, type: b.type, item }; });
await settle(page, 900);
out.J1 = { target: full, card: await card(), smallHeight: await page.evaluate(() => document.querySelector('.bottleneck small')?.getBoundingClientRect().height ?? null), fix: await boxes(page, '.fix-actions button'), nextBuild: await boxes(page, '.next-build') };
await cardShot('b-J1-storage-full.png');
const before = await sim(page, i => window.tgScene.sim.stock[i], full.item);
await page.locator('.fix-actions button', { hasText: '팔기' }).click(); await settle(page, 400);
out.J1.soldLot = Math.round(before - await sim(page, i => window.tgScene.sim.stock[i], full.item));
await page.locator('.fix-actions button', { hasText: '자동 판매' }).click().catch(() => {}); await settle(page, 300);
out.J1.autoSellOn = await sim(page, i => !!window.tgScene.sim.autoSell[i], full.item);
await sim(page, f => { const s = window.tgScene.sim, b = s.buildings.find(v => v.id === f.id); b.out = 0; s.stock[f.item] = 20; s.autoSell[f.item] = false; }, full);

// J4: the lumber camp's trees used up -> 자원 고갈 with 묘목 심기 / 영토 확장.
out.overrides.push('J4: trees within reach of one lumber camp cut down (nature null, as the simulation does when a tree runs out)');
const lumber = await sim(page, () => { const s = window.tgScene.sim, b = s.buildings.find(v => v.type === 'lumber'); if (!b) return null; for (const t of s.tiles) if (t.nature === 'tree' && Math.max(Math.abs(t.x - b.x), Math.abs(t.z - b.z)) <= 5) { t.nature = null; t.remaining = 0; } s.revision++; return { id: b.id }; });
await settle(page, 1200);
out.J4 = { lumber, card: await card(), fix: await boxes(page, '.fix-actions button') };
await cardShot('b-J4-depleted.png');
const saplings0 = await sim(page, () => window.tgScene.sim.tiles.filter(t => t.nature === 'sapling').length);
await page.locator('.fix-actions button', { hasText: '묘목' }).click().catch(e => { out.J4.plantError = String(e).slice(0, 80); }); await settle(page, 400);
out.J4.saplingsAdded = (await sim(page, () => window.tgScene.sim.tiles.filter(t => t.nature === 'sapling').length)) - saplings0;

// J3: three facilities damaged -> one 모두 수리 button with the summed cost.
out.overrides.push('J3: three facilities set to health 40');
await sim(page, () => { const s = window.tgScene.sim; s.buildings.filter(b => b.type !== 'warehouse' && b.type !== 'house').slice(0, 3).forEach(b => { b.health = 40; }); s.money = 3000; });
await settle(page, 900);
out.J3 = { card: await card(), button: await page.locator('.repair-all button').innerText().catch(() => null) };
await cardShot('b-J3-repair-all.png');
await page.locator('.repair-all button').click(); await settle(page, 400);
out.J3.damagedAfter = await sim(page, () => window.tgScene.sim.buildings.filter(b => b.health < 100).length);

// J5: repair too expensive -> locked button, shortfall and 회생 자금 on the spot; negative money -> finance card + stock hint.
out.overrides.push('J5: one facility health 30, money 20 (then -300), game paused during the check');
const hurt = await sim(page, () => { const s = window.tgScene.sim, b = s.buildings.find(v => v.type !== 'warehouse' && v.type !== 'house'); b.health = 30; s.money = 20; s.paused = true; /* paused: an export arriving would refill the purse mid-check */ return { id: b.id, x: b.x, z: b.z, cost: s.repairCost(b) }; });
// Open its card the way the operations card offers: the stalled facility's row focuses it.
await settle(page, 600); await page.locator('.operations-card .bottleneck').click();
await page.locator('.facility-card').waitFor({ timeout: 5000 }).catch(async () => { await clickTile(page, hurt.x, hurt.z); });
await settle(page, 500);
out.J5 = { card: await page.locator('.facility-card h2').innerText().catch(() => null) };
Object.assign(out.J5, { repairDisabled: await page.locator('.facility-quick-actions button', { hasText: '수리' }).first().isDisabled(), shortFunds: await page.locator('.facility-card .short-funds').first().innerText().catch(() => null) });
await shot(page, 'b-J5-repair-locked.png');
await page.locator('.facility-card .short-funds button').first().click(); await settle(page, 400);
out.J5.moneyAfterFund = Math.round(await sim(page, () => window.tgScene.sim.money));
await page.getByRole('button', { name: '시설 정보 닫기' }).click(); await settle(page, 300);
await sim(page, () => { window.tgScene.sim.money = -300; }); await settle(page, 900);
out.J5.financeCard = await page.locator('.hud-stack .finance-warning').innerText().catch(() => null);
out.J1.sellHint = await page.locator('.sell-hint').innerText().catch(() => null);
await cardShot('b-J1-J5-money-falling.png');
await sim(page, () => { window.tgScene.sim.money = 2500; window.tgScene.sim.paused = false; });

// J12/B2 + B15: infection, a storm warned at 4x and a raid all at once; every card in one column, 방역 reachable.
out.overrides.push('J12: infection 35, storm pending in 80 game s at 4x, raid started');
await sim(page, () => { const s = window.tgScene.sim; s.health.infection = 35; s.pendingEvent = { type: 'raid', at: s.time + .5 }; });
await settle(page, 1500);
await sim(page, () => { const s = window.tgScene.sim; s.speed = 4; s.pendingEvent = { type: 'storm', at: s.time + 80 }; });
await settle(page, 900);
out.J12 = { stack: await page.evaluate(() => [...document.querySelector('.hud-stack').children].map(e => e.className.toString().split(' ')[0])), overlaps: await overlaps(page, ['.hud-stack>*', '.objective-card', '.camera-controls', '.town-actions']), sanitizeReachable: await reachable(page, '.health-alert button'), raidReachable: await reachable(page, '.raid-panel button') };
out.B15 = { hud: await page.locator('.weather-warning').innerText().catch(() => null), gameSecondsLeft: await sim(page, () => { const s = window.tgScene.sim; return Math.round(s.pendingEvent ? s.pendingEvent.at - s.time : -1); }) };
await shot(page, 'b-J12-alert-stack.png');
await sim(page, () => { const s = window.tgScene.sim; s.pendingEvent = null; s.health.infection = 0; s.speed = 1; if (s.raid) s.raid.ends = s.time; });

// J8/J9: one game day passes; the upkeep notice goes to the ledger, not a toast; the ledger shows the day.
await settle(page, 1500);
await page.evaluate(() => { for (const t of document.querySelectorAll('[data-sonner-toast] button[aria-label="Close toast"]')) t.click(); });
await sim(page, () => { const s = window.tgScene.sim; s.paused = false; const c = s.campaign, end = (Math.floor(s.time / 80) + 1) * 80 + 2; while (s.time < end) c.tick(.25); });
await settle(page, 1200);
out.J9 = { toasts: await toasts(page) };
await page.locator('.resource-strip .money').click(); await settle(page, 500);
out.J8 = { title: await page.locator('[role=dialog] h2').innerText(), days: await page.evaluate(() => [...document.querySelectorAll('.ledger-day')].map(d => d.innerText.replace(/\s+/g, ' '))), rows: await page.evaluate(() => [...document.querySelectorAll('.ledger-table [role=row]')].slice(0, 5).map(d => d.innerText.replace(/\s+/g, ' '))) };
await page.locator('.ledger-news summary').click().catch(() => {}); await settle(page, 200);
out.J9.news = await page.evaluate(() => [...document.querySelectorAll('.ledger-news li')].slice(0, 4).map(d => d.innerText.replace(/\s+/g, ' ')));
await shot(page, 'b-J8-ledger.png');
await page.keyboard.press('Escape'); await settle(page, 300);

out.R = R; await save('probe-b.json', out); console.log(JSON.stringify(out, null, 1)); await browser.close();
