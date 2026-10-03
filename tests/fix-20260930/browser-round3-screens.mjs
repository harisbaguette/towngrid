// Round 3 (U, 2026-10-02): the screens changed this round, driven in a real browser at four sizes.
// A finished campaign (audit fixture rank 32) loaded through 파일 불러오기: goals window and objective gauge with the
// continental records (G3-13), the ledger over several sites (G3-06), the campaign window's site flags (item 4) and
// records, the 세계 지도 홈으로 button over scrolled content, and J4 in the CPU renderer (biome preview, ?renderer=canvas).
// Usage: TG_OUT=docs/verification/fix-20260930 node tests/fix-20260930/browser-round3-screens.mjs <playwright/index.mjs> <chrome.exe>
import { readFileSync } from 'node:fs';
import { R, open, toHome, sim, waitSim, shot, save, browser, log, origin } from '../audit-2/_browser.mjs';

const sizes = [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }, { width: 390, height: 844 }, { width: 844, height: 390 }];
const OUT = { sizes: {} }, fails = [];
const check = (id, ok, detail) => { log((ok ? 'PASS ' : 'FAIL ') + id + ' ' + JSON.stringify(detail ?? '')); if (!ok) fails.push(id); };
const closeAll = async page => { for (let i = 0; i < 3 && await page.locator('[role=dialog]').count(); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); } };
// Elements of a scroller that sit under a fixed/absolute control (the control's box intersects their box).
const covered = (page, control) => page.evaluate(sel => {
  const c = document.querySelector(sel); if (!c) return null; const r = c.getBoundingClientRect(), hit = [];
  for (const el of document.querySelectorAll('.world-map-screen button, .world-map-screen select, .world-map-screen h1, .world-map-screen h2, .world-map-screen strong, .world-map-screen label')) {
    if (c.contains(el) || el.contains(c)) continue; const b = el.getBoundingClientRect(); if (!b.width || !b.height) continue;
    // Only the part left visible by its scrolling ancestors counts (content scrolled out under a panel edge is clipped, not covered).
    let top = b.top, bottom = b.bottom; for (let p = el.parentElement; p; p = p.parentElement) { if (/auto|scroll|hidden/.test(getComputedStyle(p).overflowY)) { const q = p.getBoundingClientRect(); top = Math.max(top, q.top); bottom = Math.min(bottom, q.bottom); } }
    if (bottom - top < 3) continue;
    const ix = Math.min(r.right, b.right) - Math.max(r.left, b.left), iy = Math.min(r.bottom, bottom) - Math.max(r.top, top);
    if (ix > 2 && iy > 2) hit.push((el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 30));
  } return hit;
}, control);

for (const vp of sizes) {
  const tag = vp.width + 'x' + vp.height, r = OUT.sizes[tag] = {};
  const page = await open(vp);
  try {
    log(tag + ' home'); await toHome(page);
    // World map: scroll every scroller top to bottom; the 홈으로 button must not sit over other controls.
    await page.getByRole('button', { name: '새 게임' }).click(); await page.getByRole('button', { name: /이 땅에서 시작/ }).waitFor();
    await page.waitForTimeout(700); r.homeButton = [];
    const scrollers = await page.evaluate(() => [...document.querySelectorAll('.world-map-screen, .world-map-screen *')].filter(e => e.scrollHeight > e.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(e).overflowY)).map(e => e.className.split(' ')[0]));
    for (const sc of scrollers) for (let y = 0; y <= 1200; y += 120) {
      const at = await page.evaluate(([s, y]) => { const e = document.querySelector('.' + s); if (!e) return -1; e.scrollTop = y; return e.scrollTop; }, [sc, y]); await page.waitForTimeout(60);
      const hit = await covered(page, '.world-home-back'); if (hit?.length) r.homeButton.push({ sc, at, hit });
    }
    await page.evaluate(() => document.querySelectorAll('.world-map-screen, .world-map-screen *').forEach(e => { e.scrollTop = 0; }));
    await shot(page, `${tag}-world-start.png`);
    check(tag + ' 홈으로 never covers world-map controls', r.homeButton.length === 0, r.homeButton.slice(0, 3));
    await page.locator('.world-home-back').click(); await page.getByRole('button', { name: '새 게임' }).waitFor();
    // Finished campaign from a file.
    const raw = readFileSync(new URL('../audit-2/fixtures/rank32.json', import.meta.url));
    await page.locator('input[aria-label="저장 파일 불러오기"]').setInputFiles({ name: 'rank32.json', mimeType: 'application/json', buffer: raw });
    await waitSim(page, () => window.tgScene?.sim?.rank === 32 && !document.querySelector('.screen-loading'), null, 120000);
    await page.waitForTimeout(600); await closeAll(page);
    // The load toast sits over the top-right HUD on short screens until it times out.
    await page.locator('[data-sonner-toast]').first().waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
    r.gauge = await page.locator('.objective-card [role=progressbar]').evaluate(e => ({ label: e.getAttribute('aria-label'), value: +e.getAttribute('aria-valuenow') }));
    check(tag + ' objective gauge follows the next record', r.gauge.label === '다음 대륙 기록' && r.gauge.value < 100, r.gauge);
    await page.locator('.objective-card').click(); await page.locator('.legacy-goals').first().waitFor({ timeout: 10000 });
    r.goals = await page.locator('.legacy-goals li').evaluateAll(ls => ls.map(l => l.innerText.replace(/\s+/g, ' ')));
    r.goalsBox = await page.locator('.legacy-goals').first().evaluate(e => { const b = e.getBoundingClientRect(), d = e.closest('[role=dialog]').getBoundingClientRect(); return { inside: b.left >= d.left - 1 && b.right <= d.right + 1, overflowX: e.scrollWidth > e.clientWidth + 1 }; });
    check(tag + ' goals window lists 5 records inside the dialog', r.goals.length === 5 && r.goalsBox.inside && !r.goalsBox.overflowX, { goals: r.goals.length, ...r.goalsBox });
    await page.locator('.legacy-goals').first().scrollIntoViewIfNeeded(); await shot(page, `${tag}-goals-legacy.png`);
    await closeAll(page);
    // Ledger over every site.
    await page.locator('button.money').click(); await page.locator('.ledger').waitFor();
    // Several sites: this site's own books (default) or every site summed.
    r.ledgerScope = await page.locator('.ledger-scope button').evaluateAll(bs => bs.map(b => ({ text: b.textContent, on: b.getAttribute('aria-pressed') })));
    r.siteNet = await page.locator('.ledger-net b').allInnerTexts();
    await page.locator('.ledger-scope button', { hasText: '합계' }).click(); await page.waitForTimeout(200);
    r.allNet = await page.locator('.ledger-net b').allInnerTexts(); r.allOn = await page.locator('.ledger-scope button', { hasText: '합계' }).getAttribute('aria-pressed');
    await shot(page, `${tag}-ledger-all.png`); await page.locator('.ledger-scope button').first().click();
    check(tag + ' ledger switches between this site and all sites', r.ledgerScope.length === 2 && r.ledgerScope[0].on === 'true' && r.allOn === 'true', { scope: r.ledgerScope, site: r.siteNet, all: r.allNet });
    await shot(page, `${tag}-ledger.png`); await closeAll(page);
    // Campaign window: a site with a raid, a broken and a damaged facility shows its flags.
    await sim(page, () => { const c = window.tgScene.sim.campaign, s = c.sites[1].sim; s.buildings[0].health = 0; s.buildings[1].health = 50; s.raid = { faction: 'orc', finished: false, until: s.time + 60 }; s.stock.bread = 0; s.stock.grain = 0; s.stock.fish = 0; });
    await page.getByRole('button', { name: '세계 지도', exact: true }).click(); await page.locator('.site-list').waitFor();
    r.flags = await page.locator('.site-list > div').nth(1).locator('.site-flags li').allInnerTexts();
    check(tag + ' site list shows raid, broken, damaged and the unrest cause', ['습격 중', '멈춘 시설', '손상', '식량 부족'].every(k => r.flags.some(f => f.includes(k))), r.flags);
    await page.locator('.site-list').scrollIntoViewIfNeeded(); await shot(page, `${tag}-campaign-sites.png`);
    r.sitesOverflow = await page.locator('.site-list').evaluate(e => [...e.querySelectorAll('.site-flags li')].filter(li => { const b = li.getBoundingClientRect(), p = e.getBoundingClientRect(); return b.right > p.right + 1; }).length);
    check(tag + ' flags stay inside the list', r.sitesOverflow === 0, r.sitesOverflow);
    await page.getByRole('tab', { name: '운영과 외교' }).click(); await page.locator('[role=tabpanel] .legacy-goals').waitFor({ timeout: 10000 });
    await shot(page, `${tag}-campaign-records.png`);
    await sim(page, () => { const c = window.tgScene.sim.campaign, s = c.sites[1].sim; s.raid = null; });
    await closeAll(page);
  } catch (e) { r.error = String(e.message || e).slice(0, 400); check(tag + ' flow', false, r.error); await shot(page, `${tag}-failure.png`).catch(() => {}); }
  await page.context().close();
}
// J4 in the CPU renderer: unowned trees and rocks drawn from the washed atlas.
{
  const page = await open({ width: 1440, height: 1000 });
  await page.goto(origin + '/biome-preview.html?renderer=canvas'); await page.waitForFunction(() => window.biomePreview, null, { timeout: 90000 });
  await page.locator('#preset').selectOption('forest'); await page.waitForTimeout(800);
  OUT.j4 = await page.evaluate(() => { const g = window.biomePreview.game; /* the preview owns the whole map: keep a 12x12 block so the rest is outside the border */ g.sim.owned = new Set([...g.sim.owned].filter(k => { const [x, z] = k.split(',').map(Number); return x >= 6 && x < 18 && z >= 6 && z < 18; })); g.rebuild(); const props = g.nature.filter(m => m.userData.pixelProp); g.renderer.render(g.scene, g.camera); return { software: !!g.renderer.isSoftware, props: props.length, unowned: props.filter(m => m.userData.unowned).length, washed: !!g.renderer.washedImages }; });
  check('J4 CPU renderer washes unowned trees and rocks', OUT.j4.software && OUT.j4.unowned > 0 && OUT.j4.washed, OUT.j4);
  await shot(page, 'j4-canvas-forest.png');
  await page.goto(origin + '/biome-preview.html?biome=forest'); await page.waitForFunction(() => window.biomePreview, null, { timeout: 90000 }); await page.waitForTimeout(800); await shot(page, 'j4-webgl-forest.png');
  await page.context().close();
}
OUT.R = R; OUT.fails = fails;
check('no page errors, console errors or failed requests', !R.errors.length && !R.consoleErrors.length && !R.failedRequests.length, { e: R.errors.slice(0, 3), c: R.consoleErrors.slice(0, 3), f: R.failedRequests.slice(0, 3) });
await save('round3-screens.json', OUT); await browser.close();
console.log(fails.length ? 'FAIL ' + fails.join(' | ') : 'round3 screens PASS'); process.exit(fails.length ? 1 : 0);
