// Shared setup for the 2026-09-29 HUD fix probes (F3a). Builds on tests/audit-2/_browser.mjs (headless, isolated storage).
// Every state override is listed in the probe's `overrides` so screenshots are never mistaken for natural play.
import { readFileSync } from 'node:fs';
export * from '../audit-2/_browser.mjs';
import { sim, raf, waitSim } from '../audit-2/_browser.mjs';

/** Place `type` on the first owned tile where the rules accept it (free = no cost), like a player picking a valid spot. */
export const place = (page, type, near = [11, 12]) => sim(page, ([type, near]) => {
  const s = window.tgScene.sim, tiles = [...s.owned].map(k => k.split(',').map(Number)).sort((a, b) => Math.hypot(a[0] - near[0], a[1] - near[1]) - Math.hypot(b[0] - near[0], b[1] - near[1]));
  for (const [x, z] of tiles) if (!s.canBuild(type, x, z, true)) { const r = s.build(type, x, z, true); if (r.ok) return { x, z, id: r.id }; }
  return null;
}, [type, near]);

/** Load an audit fixture save through the real 파일 불러오기 input (installSave path), then resume play. */
export async function loadFixture(page, rank) {
  const raw = readFileSync(new URL('../audit-2/fixtures/rank' + rank + '.json', import.meta.url));
  await page.locator('input[aria-label="저장 파일 불러오기"]').setInputFiles({ name: 'rank' + rank + '.json', mimeType: 'application/json', buffer: raw });
  await waitSim(page, r => window.tgScene?.sim?.rank === r && !document.querySelector('.screen-loading'), rank, 120000);
  await page.waitForTimeout(600);
}
/** Boxes of elements matching a selector. */
export const boxes = (page, sel) => page.evaluate(sel => [...document.querySelectorAll(sel)].map(e => { const r = e.getBoundingClientRect(); return { text: e.innerText.replace(/\s+/g, ' ').slice(0, 80), box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] }; }), sel);
/** Is the element's center the element itself (not covered)? */
export const reachable = (page, sel) => page.evaluate(sel => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!top && (e === top || e.contains(top)); }, sel);
/** Pairs of overlapping boxes among direct children of the HUD stack and other fixed HUD pieces. */
export const overlaps = (page, sels) => page.evaluate(sels => { const els = sels.flatMap(s => [...document.querySelectorAll(s)]).filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden'); const out = []; for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) { if (els[i].contains(els[j]) || els[j].contains(els[i])) continue; const a = els[i].getBoundingClientRect(), b = els[j].getBoundingClientRect(), w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (w > 2 && h > 2) out.push(els[i].className.toString().split(' ')[0] + ' x ' + els[j].className.toString().split(' ')[0] + ' ' + Math.round(w) + 'x' + Math.round(h)); } return out; }, sels);
export const toasts = page => page.evaluate(() => [...document.querySelectorAll('[data-sonner-toast]')].map(t => t.innerText.replace(/\s+/g, ' ').trim()));
export const settle = async (page, ms = 600) => { await page.waitForTimeout(ms); await raf(page); };
