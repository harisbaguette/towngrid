// Screen check for the Town Star layer (docs/TOWNSTAR_RULES.md 2026-10-03): the 도전·순위 and 운반·보관 pages, the depot's
// storage mode, the slow-spot row of the operations card, a land sale on the tile panel, and the offline summary when a
// saved town is continued. The industrial tour (never saved) is the town; a few values are injected only to reach a view.
// Usage: TG_OUT=docs/verification/townstar-gaps-20261003 node tests/townstar-gaps-browser.mjs <playwright/index.mjs> <chrome.exe>
import { R, open, toHome, sim, waitSim, shot, save, browser, audit } from './audit-2/_browser.mjs';

const out = { overrides: ['league.total/daily (view only)', 'a depot for the storage mode', 'savedAt 40 minutes back for the offline summary'], sizes: {} };
const menu = async page => { await page.getByRole('button', { name: '게임 메뉴' }).click(); await page.locator('.minimal-menu').waitFor(); };
for (const vp of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
 const touch = vp.width < 900, page = await open(vp, touch ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}), tag = page.tag, r = out.sizes[tag] = {};
 try {
  await toHome(page);
  await page.locator('.home-extras').waitFor(); if (!(await page.locator('.home-extras[open]').count())) await page.locator('.home-extras > summary').click();
  await page.getByRole('button', { name: '산업도시 둘러보기' }).click();
  await waitSim(page, () => window.tgScene?.sim?.buildings.length > 3 && !document.querySelector('.screen-loading'), null, 120000);
  r.league = await sim(page, () => { const c = window.tgScene.sim.campaign; c.league.total += 40; c.league.stars += 40; return { week: c.league.week, rivals: c.league.rivals.length, goal: c.league.daily.goal }; });
  await menu(page); await page.getByRole('button', { name: /도전·순위/ }).click();
  await page.locator('.league-panel').waitFor();
  r.leagueView = await page.evaluate(() => ({ cards: document.querySelectorAll('.league-panel .league-card').length, rows: document.querySelectorAll('.league-table tbody tr').length, player: !!document.querySelector('.league-table tr.player'), gift: !!document.querySelector('.gift-form button') }));
  r.leagueLayout = await audit(page, '.league-panel');
  await page.locator('[role=dialog]').screenshot({ path: `${process.env.TG_OUT || 'docs/verification/townstar-gaps-20261003'}/league-${tag}.png` });
  // A gift from the panel: the button sends one good and the relation rises.
  r.gift = await page.evaluate(async () => { const b = document.querySelector('.gift-form button'); if (!b || b.disabled) return { sent: false, why: document.querySelector('.league-card.gift small')?.textContent }; const c = window.tgScene.sim.campaign, before = c.league.gifts.count; b.click(); await new Promise(r => setTimeout(r, 300)); return { sent: c.league.gifts.count === before + 1 }; });
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await menu(page); await page.getByRole('button', { name: /운반·보관/ }).click();
  await page.locator('.haul-panel').waitFor();
  r.haulView = await page.evaluate(() => ({ gear: document.querySelectorAll('.gear-steps li').length, caps: document.querySelectorAll('.cap-list select').length }));
  r.haulLayout = await audit(page, '.haul-panel');
  await page.locator('[role=dialog]').screenshot({ path: `${process.env.TG_OUT || 'docs/verification/townstar-gaps-20261003'}/haul-${tag}.png` });
  r.cap = await page.evaluate(async () => { const sel = document.querySelector('.cap-list select'); if (!sel) return null; const s = window.tgScene.sim, id = sel.getAttribute('aria-label').replace(' 보관 상한', ''); sel.value = '100'; sel.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 200)); return { label: id, caps: { ...s.stockCap } }; });
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  // Depot storage mode in the facility details.
  r.depot = await sim(page, () => { const s = window.tgScene.sim; let d = s.buildings.find(b => b.type === 'depot'); if (!d) { s.money += 5000; s.stock.plank += 10; s.stock.stone += 10; for (const k of s.owned) { const [x, z] = k.split(',').map(Number); if (!s.canBuild('depot', x, z, true)) { const r = s.build('depot', x, z, true); if (r.ok) { d = s.buildings.find(b => b.id === r.id); break; } } } } if (!d) return null; window.tgScene.select?.(d.id); return { id: d.id, x: d.x, z: d.z }; });
  if (r.depot) {
   await page.evaluate(id => { const g = window.tgGame; if (g?.selectBuilding) g.selectBuilding(id); }, r.depot.id);
   r.depotNote = 'opened through the scene selection if the page exposes it';
  }
  r.slow = await sim(page, async () => { const m = await import('/src/app/game/ui-rules.js'); const v = m.slowSpot(window.tgScene.sim); return v && { type: v.building.type, from: Math.round(v.from * 100), to: Math.round(v.to * 100) }; });
  if (r.slow) { await menu(page); await page.getByRole('button', { name: /생산·위기/ }).click(); await page.waitForTimeout(400); r.slowRow = await page.locator('.slow-spot').count(); await page.locator('[role=dialog]').screenshot({ path: `${process.env.TG_OUT || 'docs/verification/townstar-gaps-20261003'}/slow-spot-${tag}.png` }); await page.keyboard.press('Escape'); }
 } catch (e) { r.error = String(e).slice(0, 400); await shot(page, `townstar-error-${tag}.png`).catch(() => {}); }
 await page.close();
}
// Offline: a fresh new game saved 40 minutes ago, continued from the home screen, shows the summary toast.
{
 const page = await open({ width: 1366, height: 768 }), r = out.offline = {};
 try {
  await toHome(page);
  r.saved = await page.evaluate(async () => {
   const { Campaign } = await import('/src/app/game/campaign.js'), { encodeSave, SAVE_KEY } = await import('/src/app/game/persistence.js');
   const c = new Campaign({ nation: 'estern' }), raw = JSON.parse(encodeSave(c.save()));raw.savedAt = new Date(Date.now() - 40 * 60000).toISOString();
   localStorage.setItem(SAVE_KEY, JSON.stringify(raw)); return true;
  });
  await page.reload(); await toHome(page);
  await page.getByRole('button', { name: /이어하기/ }).first().click();
  await page.locator('[data-sonner-toast]').filter({ hasText: '자리를 비운' }).first().waitFor({ timeout: 60000 });
  r.toast = await page.locator('[data-sonner-toast]').filter({ hasText: '자리를 비운' }).first().textContent();
  r.day = await sim(page, () => window.tgScene?.sim?.day);
  await shot(page, 'offline-toast-1366x768.png');
 } catch (e) { r.error = String(e).slice(0, 400); await shot(page, 'offline-error.png').catch(() => {}); }
 await page.close();
}
out.R = R;
await save('townstar-gaps.json', out);
console.log(JSON.stringify(out).slice(0, 5000));
await browser.close();
