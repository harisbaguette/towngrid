// Screenshot check for the campaign window blocks added on 2026-09-29: site status, battle record (운영과 외교 tab) and
// the open new-state orders table (신생 국가 tab). State is injected (spawnState, battles) only to reach these views.
// Usage: TG_OUT=docs/verification/fix-20260929 TG_GPU=1 node tests/campaign-panels-browser.mjs <playwright/index.mjs> <chrome.exe>
import { R, open, toHome, sim, waitSim, shot, save, browser, audit } from './audit-2/_browser.mjs';

const out = { overrides: ['campaign.spawnState x3', 'campaign.battles +2'], sizes: {} };
for (const vp of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
  const touch = vp.width < 900, page = await open(vp, touch ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}), tag = page.tag, r = out.sizes[tag] = {};
  try {
    await toHome(page);
    if(!(await page.locator('.home-extras[open]').count()))await page.locator('.home-extras > summary').click();
    await page.getByRole('button', { name: '산업도시 둘러보기' }).click();
    await waitSim(page, () => window.tgScene?.sim?.buildings.length > 3 && !document.querySelector('.screen-loading'), null, 120000);
    r.injected = await sim(page, () => { const c = window.tgScene.sim.campaign, nation = c.sites[0].nation; for (let i = 0; i < 3; i++) c.spawnState(nation, '북부 자유령'); c.battles.unshift({ day: c.active.day, site: c.sites[0].id, faction: 'orc', damage: 1840, defeated: 3 }, { day: Math.max(1, c.active.day - 2), site: c.sites[0].id, faction: 'demon', damage: 0, defeated: 5 }); return { states: c.newStates.filter(s => !s.dissolved).length, orders: c.stateOrders().length }; });
    await page.getByRole('button', { name: /^세계/ }).first().click();
    await page.locator('.campaign-dialog').waitFor();
    await page.getByRole('tab', { name: '운영과 외교' }).click(); await page.waitForTimeout(300);
    await page.locator('.site-status').scrollIntoViewIfNeeded();
    r.world = await page.evaluate(() => ({ siteStatus: document.querySelectorAll('.site-status>p').length, battles: document.querySelectorAll('.battle-log>p').length }));
    await page.locator('.campaign-dialog').screenshot({ path: `${process.env.TG_OUT || 'docs/verification/fix-20260929'}/campaign-site-status-${tag}.png` });
    await page.getByRole('tab', { name: '신생 국가' }).click(); await page.waitForTimeout(300);
    r.orders = await page.evaluate(() => { const t = document.querySelector('.state-orders'), b = t?.getBoundingClientRect(); return t && { rows: t.querySelectorAll('tbody tr').length, width: Math.round(b.width), scrollX: t.scrollWidth > t.clientWidth + 1, headSticky: getComputedStyle(t.querySelector('thead th')).position }; });
    r.layout = await audit(page, '.campaign-dialog');
    r.councilCards = await page.evaluate(() => [...document.querySelectorAll('.state-diplomacy .council-actions button')].map(b => { const q = b.getBoundingClientRect(), d = b.closest('[role=dialog]').getBoundingClientRect(); return { inside: q.left >= d.left - 1 && q.right <= d.right + 1, overflow: b.scrollWidth > b.clientWidth + 1 }; }));
    await page.locator('.state-diplomacy .council-actions').scrollIntoViewIfNeeded(); await page.locator('.campaign-dialog').screenshot({ path: `${process.env.TG_OUT || 'docs/verification/fix-20260929'}/campaign-council-cards-${tag}.png` }); await page.locator('.state-orders').scrollIntoViewIfNeeded();
    await page.locator('.campaign-dialog').screenshot({ path: `${process.env.TG_OUT || 'docs/verification/fix-20260929'}/campaign-state-orders-${tag}.png` });
  } catch (e) { r.error = String(e).slice(0, 300); await shot(page, `campaign-error-${tag}.png`).catch(() => {}); }
  await page.close();
}
out.R = R;
await save('campaign-panels.json', out);
console.log(JSON.stringify(out).slice(0, 4000));
await browser.close();
