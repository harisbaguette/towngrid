// Shared browser helpers for the 2026-09-29 audit (stage B: real browser input, UI/UX, screens, performance).
// Headless only, a fresh isolated browser context per page (the player's own localStorage is never touched).
// Usage of every probe: node tests/audit-2/<probe>.mjs <playwright/index.mjs> <chrome.exe>
// Needs a running dev server (TOWNGRID_URL, default http://localhost:5173).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const origin = process.env.TOWNGRID_URL || 'http://localhost:5173';
export const outDir = process.env.TG_OUT || 'docs/verification/audit-20260929';
await mkdir(outDir, { recursive: true });
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
// TG_GPU=1 asks new headless Chrome for the real GPU (ANGLE D3D11); default is the swiftshader software path.
const gpuArgs = process.env.TG_GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader'];
export const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}), args: gpuArgs });
export const log = s => console.log('[step]', s);

// Every page records page errors, console errors/warnings and failed requests (listeners attached before goto).
export const R = { errors: [], consoleErrors: [], consoleWarnings: [], failedRequests: [] };
export async function open(viewport, extra = {}) {
  const context = await browser.newContext({ viewport, ...extra });
  // Other agents edit the working tree while probes run; a dead HMR socket keeps the dev server from reloading the page mid-flow.
  await context.addInitScript(() => {
    window.WebSocket = class { constructor() { this.readyState = 0; } addEventListener() {} removeEventListener() {} send() {} close() {} };
    // Long tasks from the very first paint.
    window.tgLongTasks = [];
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.tgLongTasks.push({ t: Math.round(e.startTime), d: Math.round(e.duration) }); }).observe({ type: 'longtask', buffered: true }); } catch {}
  });
  const page = await context.newPage(), tag = viewport.width + 'x' + viewport.height;
  page.on('pageerror', e => R.errors.push(tag + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error') R.consoleErrors.push(tag + ': ' + m.text().slice(0, 300)); if (m.type() === 'warning') R.consoleWarnings.push(tag + ': ' + m.text().slice(0, 200)); });
  page.on('response', r => { if (r.status() >= 400) R.failedRequests.push(tag + ': ' + r.status() + ' ' + r.url()); });
  page.on('requestfailed', r => { const u = r.url(); if (!u.includes('/@vite/') && !u.startsWith('ws')) R.failedRequests.push(tag + ': FAILED ' + (r.failure()?.errorText || '') + ' ' + u); });
  page.tag = tag;
  return page;
}
export const shot = (page, name, opts = {}) => page.screenshot({ path: join(outDir, name), ...opts });
export const sim = (page, fn, arg) => page.evaluate(fn, arg);
export const waitSim = (page, fn, arg, timeout = 60000) => page.waitForFunction(fn, arg, { timeout, polling: 200 });
export const visible = async (page, sel) => (await page.locator(sel).count()) > 0 && await page.locator(sel).first().isVisible();
export const save = (name, data) => writeFile(join(outDir, name), JSON.stringify(data, null, 1));

// Title -> home. The title is server-rendered; a click before hydration is lost, so repeat until the home menu shows.
export async function toHome(page) {
  const t0 = Date.now();
  await page.goto(origin);
  const timing = {};
  await page.getByRole('button', { name: '화면을 눌러 시작', exact: true }).waitFor({ timeout: 60000 });
  timing.titleVisibleMs = Date.now() - t0;
  let clicks = 0;
  for (; clicks < 40 && !(await page.getByRole('button', { name: '새 게임' }).count()); clicks++) { await page.getByRole('button', { name: '화면을 눌러 시작', exact: true }).click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(500); }
  await page.getByRole('button', { name: '새 게임' }).waitFor({ timeout: 60000 });
  // Home buttons stay disabled until the scene is ready (busy); wait for 새 게임 to be enabled.
  await page.waitForFunction(() => [...document.querySelectorAll('.home-menu button')].some(b => b.textContent.includes('새 게임') && !b.disabled), null, { timeout: 120000 });
  timing.homeReadyMs = Date.now() - t0; timing.titleClicks = clicks;
  await hook(page);
  return timing;
}
// Hook the scene and the audio engine through their modules (same approach as tests/starter-environment-browser.mjs).
export async function hook(page) {
  await page.evaluate(async () => {
    const find = name => [...new Set([...performance.getEntriesByType('resource').map(e => e.name).filter(u => new RegExp('/app/game/' + name + '(?:\\?|$)').test(u)), '/src/app/game/' + name])];
    for (const url of find('scene.js')) { try { const { GameScene } = await import(url); if (GameScene.prototype.__tgHooked) continue; const original = GameScene.prototype.setSimulation; GameScene.prototype.setSimulation = function (s) { window.tgScene = this; return original.call(this, s); }; GameScene.prototype.__tgHooked = true; } catch {} }
    window.tgAudioLog = [];
    for (const url of find('audio.js')) {
      try {
        const { GameAudio } = await import(url); const P = GameAudio.prototype; if (P.__tgHooked) continue; P.__tgHooked = true;
        for (const m of ['play', 'success', 'interact', 'tone']) { const o = P[m]; P[m] = function (...a) { window.tgAudio = this; window.tgAudioLog.push({ m, a: typeof a[0] === 'string' || typeof a[0] === 'number' ? a[0] : '', t: Math.round(performance.now()), ctx: this.context?.state || 'none', muted: !!this.muted }); return o.apply(this, a); }; }
      } catch {}
    }
  });
}
export async function newGameFromHome(page, nation) {
  await page.getByRole('button', { name: '새 게임' }).click();
  await page.getByRole('button', { name: /이 땅에서 시작/ }).waitFor();
  if (nation) await page.locator('#realm').selectOption(nation);
  const t0 = Date.now();
  await page.getByRole('button', { name: /이 땅에서 시작/ }).click();
  await waitSim(page, () => !!window.tgScene?.sim && window.tgScene.sim.buildings.length === 0 && window.tgScene.mode === 'warehouse', null, 120000);
  return Date.now() - t0;
}
export async function demo(page, label = '산업도시 둘러보기') {
  const t0 = Date.now();
  await page.getByRole('button', { name: label }).click();
  await waitSim(page, () => window.tgScene?.sim?.buildings.length > 3 && !document.querySelector('.screen-loading'), null, 120000);
  return Date.now() - t0;
}
// Screen point of a map tile; moves the camera there first so the tile is on screen.
export async function tilePoint(page, x, z, center = true) {
  if (center) { await page.evaluate(([x, z]) => { const s = window.tgScene; s.controls.target.set(x, 0, z); s.setQuarterView(s.viewIndex); }, [x, z]); await raf(page); }
  return page.evaluate(([x, z]) => { const s = window.tgScene, v = s.camera.position.clone().set(x, 0, z); v.project(s.camera); const r = s.renderer.domElement.getBoundingClientRect(); const px = r.left + (v.x + 1) / 2 * r.width, py = r.top + (1 - v.y) / 2 * r.height, el = document.elementFromPoint(px, py); return { px, py, onCanvas: el === s.renderer.domElement, top: el && el !== s.renderer.domElement ? String(el.className?.baseVal ?? el.className).slice(0, 60) : null }; }, [x, z]);
}
export async function clickTile(page, x, z, center = true) {
  const p = await tilePoint(page, x, z, center);
  await page.mouse.move(p.px, p.py); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(200);
  return p;
}
export const raf = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
export async function closeAll(page) {
  for (let i = 0; i < 4; i++) {
    if (await visible(page, '[role=dialog]')) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); continue; }
    const c = page.getByRole('button', { name: '시설 정보 닫기' }); if (await c.count() && await c.first().isVisible()) { await c.first().click(); await page.waitForTimeout(150); continue; }
    break;
  }
}
// rAF frame-time sample: p50/p95/max delta and frame count over `ms`.
export const frames = (page, ms = 2000) => page.evaluate(ms => new Promise(res => { const d = []; let last = performance.now(); const start = last; const f = now => { d.push(now - last); last = now; if (now - start < ms) requestAnimationFrame(f); else { d.sort((a, b) => a - b); const q = p => +d[Math.min(d.length - 1, Math.floor(d.length * p))].toFixed(1); res({ frames: d.length, p50: q(.5), p95: q(.95), max: +d[d.length - 1].toFixed(1), gameFps: +(document.querySelector('canvas[data-fps]')?.dataset.fps || 0), renderer: document.querySelector('canvas[data-renderer]')?.dataset.renderer }); } }; requestAnimationFrame(f); }), ms);

// Layout audit inside `scope`: controls covered by another element, off-screen controls, clipped text.
export const layoutAudit = ({ scope }) => {
  const vw = innerWidth, vh = innerHeight, out = { covered: [], offscreen: [], clipped: [], tinyTargets: [], smallText: [] }, root = scope ? document.querySelector(scope) : document;
  if (!root) return { missing: scope };
  const name = el => (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 36);
  const clip = el => { const r = el.getBoundingClientRect(); let box = { l: r.left, t: r.top, r: r.right, b: r.bottom }; for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p); if (o.overflowX !== 'visible' || o.overflowY !== 'visible') { const q = p.getBoundingClientRect(); box = { l: Math.max(box.l, q.left), t: Math.max(box.t, q.top), r: Math.min(box.r, q.right), b: Math.min(box.b, q.bottom) }; } } return box; };
  for (const el of root.querySelectorAll('button,a[href],[role=tab],select,input:not([type=file]):not(.sr-only),summary')) {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el); if (!r.width || !r.height || cs.visibility === 'hidden' || +cs.opacity === 0 || el.closest('[aria-hidden=true],[inert]')) continue;
    const v = clip(el); if (v.r - v.l < 4 || v.b - v.t < 4) continue;
    if (v.l < -1 || v.t < -1 || v.r > vw + 1 || v.b > vh + 1) out.offscreen.push(name(el) + ` [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}x${Math.round(r.height)}]`);
    const cx = Math.min(vw - 1, Math.max(0, (v.l + v.r) / 2)), cy = Math.min(vh - 1, Math.max(0, (v.t + v.b) / 2)), top = document.elementFromPoint(cx, cy);
    if (top && !el.contains(top) && !top.contains(el) && !top.closest('[data-sonner-toaster]')) out.covered.push(name(el) + ' <- ' + String(top.closest('[class]')?.className?.baseVal ?? top.closest('[class]')?.className ?? top.tagName).slice(0, 48));
    if (r.width < 24 || r.height < 24) out.tinyTargets.push(name(el) + ` ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  for (const el of root.querySelectorAll('strong,span,small,p,b,h1,h2,h3,label,button,a,li')) {
    const cs = getComputedStyle(el); if (!el.getClientRects().length || el.closest('[aria-hidden=true],.sr-only')) continue;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (/hidden|clip/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 2 && el.innerText.trim()) out.clipped.push(name(el) + (cs.textOverflow === 'ellipsis' ? ' (ellipsis)' : ''));
    if (own && parseFloat(cs.fontSize) < 11) out.smallText.push(name(el) + ' ' + cs.fontSize);
  }
  for (const k of Object.keys(out)) out[k] = [...new Set(out[k])];
  return out;
};
export const audit = (page, scope) => page.evaluate(layoutAudit, { scope });
export async function heap(page) {
  const c = await page.context().newCDPSession(page); await c.send('Performance.enable');
  const m = Object.fromEntries((await c.send('Performance.getMetrics')).metrics.map(v => [v.name, v.value]));
  return { heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), nodes: m.Nodes, listeners: m.JSEventListeners, documents: m.Documents };
}
