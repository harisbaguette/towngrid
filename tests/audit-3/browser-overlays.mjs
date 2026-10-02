// Audit 2026-09-30 (G2) probe: things drawn over other things on the world-map screen at phone sizes.
// 1) the fixed/absolute 홈으로 button while the start-site card is scrolled top to bottom: which texts/controls it hides;
// 2) atlas map labels hidden under the map's own overlay controls (zoom, scale badge, compass, minimap) at every zoom step;
// 3) the intro sentence as rendered text (line break removed on small screens).
// Usage: TG_OUT=docs/verification/audit-20260930 node tests/audit-3/browser-overlays.mjs <playwright/index.mjs> <chrome.exe>
import { R, open, toHome, shot, save, browser, raf } from '../audit-2/_browser.mjs';

const OUT = {};
for (const vp of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1366, height: 768 }]) {
  const mobile = vp.width < 900, page = await open(vp, mobile ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}), tag = page.tag, r = OUT[tag] = {};
  try {
    await toHome(page);
    await page.getByRole('button', { name: '새 게임', exact: true }).click();
    await page.locator('.realm-card .start-button:not(:disabled)').waitFor({ timeout: 120000 });
    await page.waitForTimeout(400);
    r.intro = await page.locator('.world-map-intro p').innerText({ timeout: 2000 }).catch(() => null);
    // 1) scroll every scroller on the page in steps and list what sits under the home button.
    r.homeButton = [];
    const scrollers = await page.evaluate(() => [document.scrollingElement, ...document.querySelectorAll('.realm-card, .realm-sheet, .world-map-screen, .world-map-layout')].filter(e => e && e.scrollHeight > e.clientHeight + 4).map(e => e === document.scrollingElement ? 'document' : '.' + [...e.classList].join('.')));
    r.scrollers = scrollers;
    for (const sc of scrollers) {
      const max = await page.evaluate(sc => { const e = sc === 'document' ? document.scrollingElement : document.querySelector(sc); return e.scrollHeight - e.clientHeight; }, sc);
      for (let y = 0; y <= max + 1; y += 120) {
        const hit = await page.evaluate(([sc, y]) => {
          const e = sc === 'document' ? document.scrollingElement : document.querySelector(sc); e.scrollTop = y;
          const b = document.querySelector('.world-home-back'); if (!b) return null; const br = b.getBoundingClientRect(), hidden = [];
          for (const el of document.querySelectorAll('.world-map-screen button, .world-map-screen select, .world-map-screen summary, .world-map-screen h1, .world-map-screen h2, .world-map-screen strong, .world-map-screen span, .world-map-screen small, .world-map-screen p, .world-map-screen label')) {
            if (el === b || b.contains(el) || !el.getClientRects().length) continue; const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
            const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) || ['BUTTON', 'SELECT', 'SUMMARY'].includes(el.tagName); if (!own) continue;
            const w = Math.min(r.right, br.right) - Math.max(r.left, br.left), h = Math.min(r.bottom, br.bottom) - Math.max(r.top, br.top);
            if (w > 4 && h > 4) hidden.push((el.innerText || el.getAttribute('aria-label') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 30) + ` (${Math.round(w)}x${Math.round(h)})`);
          }
          return { position: getComputedStyle(b).position, box: [br.x, br.y, br.width, br.height].map(Math.round), hidden };
        }, [sc, y]);
        if (hit?.hidden.length) { r.homeButton.push({ scroller: sc, scrollTop: y, ...hit }); if (r.homeButton.length <= 2) await shot(page, `${tag}-overlay-home-${r.homeButton.length}.png`); }
      }
      await page.evaluate(sc => { const e = sc === 'document' ? document.scrollingElement : document.querySelector(sc); e.scrollTop = 0; }, sc);
    }
    // 2) atlas labels under the atlas overlays, whole view then each zoom step.
    await page.evaluate(() => document.querySelector('.atlas-viewport')?.scrollIntoView({ block: 'start' }));
    r.labelsUnderOverlays = [];
    const check = step => page.evaluate(step => {
      const overlays = [...document.querySelectorAll('.atlas-zoom, .atlas-scale, .atlas-compass, .atlas-minimap')].filter(o => o.getClientRects().length).map(o => ({ name: o.className.baseVal ?? o.className, r: o.getBoundingClientRect() }));
      const out = [];
      for (const l of document.querySelectorAll('.atlas-screen-label')) { const r = l.getBoundingClientRect(); for (const o of overlays) { const w = Math.min(r.right, o.r.right) - Math.max(r.left, o.r.left), h = Math.min(r.bottom, o.r.bottom) - Math.max(r.top, o.r.top); if (w > 2 && h > 2) out.push({ step, label: l.textContent, under: String(o.name).split(' ')[0], hiddenPct: Math.round(w * h / (r.width * r.height) * 100) }); } }
      return out;
    }, step);
    r.labelsUnderOverlays.push(...await check('whole'));
    await shot(page, `${tag}-overlay-atlas-whole.png`);
    for (let k = 1; k <= 2; k++) { await page.getByRole('button', { name: '세계 지도 확대' }).click(); await raf(page); r.labelsUnderOverlays.push(...await check('zoom' + k)); }
    await shot(page, `${tag}-overlay-atlas-zoom2.png`);
    r.atlasSvg = await page.evaluate(() => { const s = document.querySelector('svg.world-atlas').getBoundingClientRect(), v = document.querySelector('.atlas-viewport').getBoundingClientRect(); return { svg: [s.width, s.height].map(Math.round), viewport: [v.width, v.height].map(Math.round) }; });
  } catch (e) { r.error = String(e.stack || e).slice(0, 500); }
  await page.context().close();
}
OUT.R = R;
await save('overlays.json', OUT);
console.log(JSON.stringify(Object.fromEntries(Object.entries(OUT).filter(([k]) => k !== 'R').map(([k, v]) => [k, { intro: v.intro, home: v.homeButton?.length, labels: v.labelsUnderOverlays?.length, error: v.error }]))));
await browser.close();
