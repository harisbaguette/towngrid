// F3a probe C (1366x768, rank-22 fixture with three settlements): C1 a warning from a settlement off screen pops up with its
// name, C2 visiting a settlement replays no old notices and its new warnings still pop up, C9 no stale sound burst on arrival.
import { R, open, toHome, sim, browser, save, shot } from './_setup.mjs';
import { loadFixture, toasts, settle } from './_setup.mjs';
const out = { overrides: ['fixture rank22 loaded; random events silenced on every site, then one real event scheduled on an off-screen site'] };
const page = await open({ width: 1366, height: 768 });
await toHome(page); await loadFixture(page, 22);
const clear = () => page.evaluate(() => { for (const t of document.querySelectorAll('[data-sonner-toast] button[aria-label="Close toast"]')) t.click(); });
await sim(page, () => { const s = window.tgScene.sim; for (const site of s.campaign.sites) { site.sim.nextEvent = 1e12; site.sim.pendingEvent = null; } s.paused = false; s.speed = 1; });
await settle(page, 1500); await clear(); await settle(page, 500);
// C1: an off-screen settlement gets its next event announced (the simulation writes the 예고 warning itself).
const other = await sim(page, () => { const c = window.tgScene.sim.campaign, site = c.sites.find(v => v.sim !== c.active); site.sim.nextEvent = site.sim.time; return { id: site.id, name: site.name, queued: site.sim.soundEvents.length }; });
await settle(page, 1200);
out.C1 = { site: other.name, toasts: await toasts(page) };
await shot(page, 'c-C1-other-site-warning.png', { clip: { x: 383, y: 0, width: 600, height: 200 } });
// C9: sounds queued on the off-screen settlement are dropped every frame.
out.C9 = { queuedOffScreen: await sim(page, id => window.tgScene.sim.campaign.sites.find(v => v.id === id).sim.soundEvents.length, other.id) };
await sim(page, id => { const site = window.tgScene.sim.campaign.sites.find(v => v.id === id); site.sim.pendingEvent = null; site.sim.nextEvent = 1e12; }, other.id);
await clear(); await settle(page, 500);
// C2: go there through 세계 -> 거점 목록; count toasts right after arrival (old notices must not replay).
await page.getByRole('button', { name: '거점·세계 지도' }).click(); await page.locator('.site-list').waitFor();
await page.evaluate(() => { window.tgAudioLog.length = 0; });
await page.evaluate(name => { for (const row of document.querySelectorAll('.site-list>div')) if (row.querySelector('strong')?.innerText === name) row.querySelector('button')?.click(); }, other.name);
await page.waitForFunction(name => window.tgScene?.sim?.campaign?.active === window.tgScene.sim && !document.querySelector('.screen-loading') && [...document.querySelectorAll('.world-access strong')].some(e => e.innerText === name), other.name, { timeout: 60000 });
await settle(page, 1200);
out.C2 = { arrivedAt: await page.locator('.world-access strong').innerText(), toastsOnArrival: await toasts(page), soundsOnArrival: await page.evaluate(() => (window.tgAudioLog || []).filter(e => e.m === 'play' && !['click', 'tab', 'open', 'close', 'hover'].includes(e.a)).map(e => e.a)) };
await sim(page, () => { const s = window.tgScene.sim; s.paused = false; s.nextEvent = s.time; });
await settle(page, 1200);
out.C2.newWarningHere = await toasts(page);
await shot(page, 'c-C2-after-visit.png');
out.R = R; await save('probe-c.json', out); console.log(JSON.stringify(out, null, 1)); await browser.close();
