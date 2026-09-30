// Audit 2026-09-29 stage B, probe 6: last checks on the settled tree.
// a) one building type without pixel art stops GameScene.icons() (the startup path) — added in memory only, removed after.
// b) facility markers overlapping each other in the industrial showcase at 1366x768 and 844x390.
// c) phone 390x844: toasts over the placement hint right after a new game.
import { R, open, toHome, newGameFromHome, demo, shot, sim, save, browser, log } from './_browser.mjs';
const Z = {};
{
  const page = await open({ width: 1366, height: 768 }); await toHome(page); await demo(page); await page.waitForTimeout(1200);
  log('fragility');
  Z.fragility = await page.evaluate(async () => { const url = [...new Set(performance.getEntriesByType('resource').map(e => e.name).filter(u => /\/app\/game\/simulation\.js(\?|$)/.test(u)))][0] || '/src/app/game/simulation.js'; const { BUILDINGS } = await import(url); const s = window.tgScene; BUILDINGS.auditNoArt = { ...BUILDINGS.field, name: '감사용 원화 없는 시설' }; s.iconCache.clear(); let error = null; try { s.icons('human'); } catch (e) { error = e.message; } delete BUILDINGS.auditNoArt; s.iconCache.clear(); s.icons('human'); return { sameModule: BUILDINGS === undefined ? null : true, error }; });
  log('markers 1366');
  const markers = () => page.evaluate(() => { const ms = [...document.querySelectorAll('.facility-marker')].map(m => ({ r: m.getBoundingClientRect(), t: m.innerText.replace(/\s+/g, ' ') })); const pairs = []; for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) { const a = ms[i].r, b = ms[j].r, w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (w > 4 && h > 4) pairs.push(ms[i].t + ' / ' + ms[j].t + ` ${Math.round(w)}x${Math.round(h)}`); } return { count: ms.length, overlappingPairs: pairs.length, examples: pairs.slice(0, 6) }; });
  Z.markers1366 = await markers(); await shot(page, 'Z01-showcase-markers-1366.png');
  await page.close();
}
{
  const page = await open({ width: 844, height: 390 }, { hasTouch: true, isMobile: true, deviceScaleFactor: 2 }); await toHome(page); await demo(page); await page.waitForTimeout(1200);
  log('markers 844');
  Z.markers844 = await page.evaluate(() => { const ms = [...document.querySelectorAll('.facility-marker')].map(m => m.getBoundingClientRect()); let n = 0; for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) { const a = ms[i], b = ms[j]; if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 4 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 4) n++; } return { count: ms.length, overlappingPairs: n }; });
  await shot(page, 'Z02-showcase-markers-844.png'); await page.close();
}
{
  const page = await open({ width: 390, height: 844 }, { hasTouch: true, isMobile: true, deviceScaleFactor: 2 }); await toHome(page); await newGameFromHome(page); await page.waitForTimeout(500);
  log('phone toast');
  Z.phoneToast = await page.evaluate(() => { const h = document.querySelector('.placement-hint')?.getBoundingClientRect(), ts = [...document.querySelectorAll('[data-sonner-toast]')].map(t => ({ r: t.getBoundingClientRect(), text: t.innerText.trim() })); return { hint: h && [Math.round(h.left), Math.round(h.top), Math.round(h.width), Math.round(h.height)], toasts: ts.map(t => ({ text: t.text, box: [Math.round(t.r.left), Math.round(t.r.top), Math.round(t.r.width), Math.round(t.r.height)], overHint: !!h && Math.min(t.r.bottom, h.bottom) - Math.max(t.r.top, h.top) > 4 })), hintCovered: !!h && document.elementFromPoint(h.left + h.width / 2, h.top + h.height / 2)?.closest('[data-sonner-toast]') != null }; });
  await shot(page, 'Z03-phone-toast-over-hint.png'); await page.close();
}
Z.R = R; await save('final.json', Z); console.log(JSON.stringify(Z, null, 1)); await browser.close();
