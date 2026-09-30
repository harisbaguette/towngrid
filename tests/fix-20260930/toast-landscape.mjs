// Short landscape (844x390): a toast raised while the empty-tile panel is open must not cover the panel.
// Usage: TG_GPU=1 node tests/fix-20260930/toast-landscape.mjs <playwright/index.mjs> <chrome.exe>
import { R, open, toHome, sim, browser, shot, newGameFromHome, clickTile } from '../audit-2/_browser.mjs';
const page = await open({ width: 844, height: 390 }, { hasTouch: false });
await toHome(page); await newGameFromHome(page);
await sim(page, () => { const t = window.tgScene; t.setMode?.(null); t.sim.paused = true; });
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
await clickTile(page, 13, 12); await page.waitForTimeout(400);
await sim(page, () => { window.tgScene.sim.notify?.('시험 알림 · 가로 화면에서 정보창과 겹치면 안 됩니다', 'warning'); });
await page.waitForTimeout(1200);
const box = sel => page.evaluate(sel => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map(Math.round); }, sel);
const panel = await box('.tile-panel'), toast = await box('[data-sonner-toast]');
const overlap = !!(panel && toast && toast[0] < panel[2] && toast[2] > panel[0] && toast[1] < panel[3] && toast[3] > panel[1]);
await shot(page, 'toast-landscape-844x390.png');
console.log(JSON.stringify({ panel, toast, overlap, errors: R.errors, consoleErrors: R.consoleErrors }));
await browser.close();
if (!panel || !toast || overlap || R.errors.length) process.exit(1);
