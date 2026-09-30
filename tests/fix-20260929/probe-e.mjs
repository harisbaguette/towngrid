// F3a probe E (F1 hand-over): trade-pressure card with 통상 협상, good-event notice styled as good news, and the stack with
// the build list open (phone stays above the list). Rank-8 fixture at 1366x768 and 390x844.
import { R, open, toHome, sim, browser, save, shot } from './_setup.mjs';
import { loadFixture, boxes, settle } from './_setup.mjs';
const out = { overrides: ['fixture rank8; sanctionUntil set 100 game s ahead; a harvest event pending; events otherwise silenced'] };
for (const vp of [{ width: 1366, height: 768 }, { width: 390, height: 844, isMobile: true, hasTouch: true }]) {
  const { width, height, ...extra } = vp, tag = width + 'x' + height, page = await open({ width, height }, extra), r = out[tag] = {};
  await toHome(page); await loadFixture(page, 8);
  await sim(page, () => { const s = window.tgScene.sim; s.nextEvent = 1e12; s.sanctionUntil = s.time + 100; s.pendingEvent = { type: 'harvest', at: s.time + 60 }; s.money = 3000; s.paused = true; });
  await settle(page, 900);
  r.cards = await page.evaluate(() => [...document.querySelector('.hud-stack').children].map(e => ({ cls: e.className.toString(), text: e.innerText.replace(/\s+/g, ' ').slice(0, 70) })).slice(0, 3));
  await shot(page, 'e-sanction-good-news-' + tag + '.png');
  const money0 = await sim(page, () => window.tgScene.sim.money);
  await page.locator('.sanction-warning button', { hasText: '통상 협상' }).click(); await settle(page, 500);
  r.negotiated = { sanctionCardLeft: await page.locator('.sanction-warning').count(), paid: Math.round(money0 - await sim(page, () => window.tgScene.sim.money)) };
  await page.getByRole('button', { name: '건설 목록 열기' }).click(); await settle(page, 500);
  r.catalogOpen = await page.evaluate(() => { const d = document.querySelector('.build-dock')?.getBoundingClientRect(), st = document.querySelector('.hud-stack')?.getBoundingClientRect(); return { dockTop: Math.round(d?.top), stackBottom: st ? Math.round(st.bottom) : null, clear: !st || !d || st.bottom <= d.top || st.right <= d.left || st.left >= d.right }; });
  await shot(page, 'e-catalog-open-' + tag + '.png');
  await page.context().close();
}
out.R = R; await save('probe-e.json', out); console.log(JSON.stringify(out, null, 1)); await browser.close();
