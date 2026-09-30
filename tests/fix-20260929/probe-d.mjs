// F3a probe D: the four checked viewports. New game (B16: phone toast vs placement bar), then the rank-8 fixture with a raid,
// a storm warning and an infection at once (J12 stack), the build list (J13) and the ledger (J8) at each size.
import { R, open, toHome, newGameFromHome, sim, browser, save, shot } from './_setup.mjs';
import { loadFixture, reachable, overlaps, settle } from './_setup.mjs';
const out = { overrides: ['fixture rank8; raid started, storm pending (80 game s), infection 35 for the stack check'] };
for (const vp of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }, { width: 390, height: 844, isMobile: true, hasTouch: true }, { width: 844, height: 390, isMobile: true, hasTouch: true }]) {
  const { width, height, ...extra } = vp, tag = width + 'x' + height, page = await open({ width, height }, extra), r = out[tag] = {};
  await toHome(page); await newGameFromHome(page); await settle(page, 700);
  r.B16 = await page.evaluate(() => { const hint = document.querySelector('.placement-hint')?.getBoundingClientRect(), ts = [...document.querySelectorAll('[data-sonner-toast]')].map(t => t.getBoundingClientRect()); return { toasts: ts.length, overHint: !!hint && ts.some(t => Math.min(t.bottom, hint.bottom) - Math.max(t.top, hint.top) > 2 && Math.min(t.right, hint.right) - Math.max(t.left, hint.left) > 2) }; });
  await shot(page, 'd-new-game-' + tag + '.png');
  await loadFixture(page, 8);
  await sim(page, () => { const s = window.tgScene.sim; s.paused = false; s.speed = 1; s.nextEvent = 1e12; s.health.infection = 35; s.pendingEvent = { type: 'raid', at: s.time + .3 }; });
  await settle(page, 1500);
  await sim(page, () => { const s = window.tgScene.sim; s.pendingEvent = { type: 'storm', at: s.time + 80 }; s.paused = true; });
  await settle(page, 900);
  r.J12 = { stack: await page.evaluate(() => [...document.querySelector('.hud-stack').children].filter(e => getComputedStyle(e).display !== 'none').map(e => e.className.toString().split(' ')[0])), overlaps: await overlaps(page, ['.hud-stack', '.objective-card', '.world-access', '.time-controls', '.camera-controls', '.town-actions', '.map-edges', '.resource-strip']), sanitizeReachable: await reachable(page, '.health-alert button'), raidReachable: await reachable(page, '.raid-panel button'), stormReachable: await reachable(page, '.weather-warning button') };
  await shot(page, 'd-J12-stack-' + tag + '.png');
  await page.getByRole('button', { name: '건설 목록 열기' }).click(); await settle(page, 500);
  await page.getByRole('tab', { name: '가공' }).click(); await settle(page, 300);
  const dock = await page.locator('.build-dock').boundingBox();
  await shot(page, 'd-J13-build-' + tag + '.png', { clip: { x: Math.max(0, dock.x - 4), y: Math.max(0, dock.y - 4), width: Math.min(width - Math.max(0, dock.x - 4), dock.width + 8), height: Math.min(height - Math.max(0, dock.y - 4), dock.height + 8) } });
  await page.getByRole('button', { name: '건설 목록 닫기' }).click(); await settle(page, 300);
  await page.locator('.resource-strip .money').click(); await settle(page, 500);
  r.J8 = { dialogOpen: await page.locator('.ledger').count(), overflowX: await page.evaluate(() => { const d = document.querySelector('[role=dialog]'); return d ? d.scrollWidth > d.clientWidth + 1 : null; }) };
  await shot(page, 'd-J8-ledger-' + tag + '.png');
  await page.context().close();
}
out.R = R; await save('probe-d.json', out); console.log(JSON.stringify(out, null, 1)); await browser.close();
