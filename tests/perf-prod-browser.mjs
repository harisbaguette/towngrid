// Frame-time and startup probe that works on the production build (no module hooks, DOM and canvas dataset only).
// Usage: TOWNGRID_URL=http://127.0.0.1:4199 TG_OUT=docs/verification/fix-20260929 TG_LABEL=after [TG_GPU=1] [TG_CPU_THROTTLE=4]
//        node tests/perf-prod-browser.mjs <playwright/index.mjs> <chrome.exe>
import { R, open, toHome, frames, save, browser, log } from './audit-2/_browser.mjs';

const label = (process.env.TG_LABEL || 'run') + (process.env.TG_CPU_THROTTLE ? '-cpu' + process.env.TG_CPU_THROTTLE : '');
const P = { label, url: process.env.TOWNGRID_URL || 'http://localhost:5173', fps: {}, startup: {} };
const page = await open({ width: 1920, height: 1080 });
const cdp = await page.context().newCDPSession(page);
if (process.env.TG_CPU_THROTTLE) await cdp.send('Emulation.setCPUThrottlingRate', { rate: +process.env.TG_CPU_THROTTLE });
const longTasks = () => page.evaluate(() => window.tgLongTasks.slice());
const canvas = '[role=application]';
try {
  P.startup.home = await toHome(page);
  P.startup.longTasksToHome = (await longTasks()).sort((a, b) => b.d - a.d).slice(0, 6);
  // The showcase lives in the folded 체험·점검 group on the home screen (older builds show it directly).
  const fold = page.locator('.home-extras summary');
  if (await fold.count() && !(await page.locator('.home-extras[open]').count())) await fold.click();
  const before = (await longTasks()).length, t0 = Date.now();
  await page.getByRole('button', { name: '산업도시 둘러보기' }).click();
  await page.waitForFunction(sel => { const c = document.querySelector(sel); return c && +c.dataset.models > 30 && !document.querySelector('.screen-loading'); }, canvas, { timeout: 120000, polling: 100 });
  P.startup.demoMs = Date.now() - t0;
  await page.waitForTimeout(2500);
  const lt = (await longTasks()).slice(before);
  P.startup.longTasksDemo = { count: lt.length, totalMs: lt.reduce((a, b) => a + b.d, 0), top: lt.sort((a, b) => b.d - a.d).slice(0, 6) };
  P.scene = await page.evaluate(sel => ({ ...document.querySelector(sel).dataset }), canvas);
  const sample = async (key, prep) => { if (prep) await prep(); await page.waitForTimeout(700); const n0 = (await longTasks()).length; P.fps[key] = await frames(page, 2000); P.fps[key].longTasks = (await longTasks()).length - n0; log(key + ' ' + JSON.stringify(P.fps[key])); };
  await sample('default-1x');
  await sample('4x', () => page.getByRole('button', { name: '4×' }).click());
  await sample('labels-on', async () => { await page.getByRole('button', { name: '건설 목록 열기' }).click(); await page.getByRole('button', { name: '시설 이름 표시' }).click(); await page.getByRole('button', { name: '건설 목록 닫기' }).click(); });
  const drag = (async () => { await page.mouse.move(900, 500); await page.mouse.down(); for (let k = 0; k < 40; k++) { await page.mouse.move(900 + Math.sin(k / 6) * 250, 500 + Math.cos(k / 6) * 120); await page.waitForTimeout(45); } await page.mouse.up(); })();
  P.fps.dragging = await frames(page, 2000); await drag;
  await sample('build-dock-open', () => page.getByRole('button', { name: '건설 목록 열기' }).click());
  await page.getByRole('button', { name: '건설 목록 닫기' }).click();
  // Main-thread profile of 3 s at 1x: which functions cost the most self time.
  await page.getByRole('button', { name: '1×' }).click();
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start');
  await page.waitForTimeout(3000);
  const { profile } = await cdp.send('Profiler.stop');
  const self = new Map(), dt = profile.timeDeltas, byId = new Map(profile.nodes.map(n => [n.id, n]));
  profile.samples.forEach((id, i) => { const n = byId.get(id), k = (n.callFrame.functionName || '(anon)') + ' ' + n.callFrame.url.split('/').pop().split('?')[0] + ':' + n.callFrame.lineNumber; self.set(k, (self.get(k) || 0) + (dt[i] || 0)); });
  const total = [...self.values()].reduce((a, b) => a + b, 0);
  P.profileTop = [...self].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => k + ' ' + (v / total * 100).toFixed(1) + '%');
} catch (e) { P.error = String(e).slice(0, 400); }
P.R = R;
await save('perf-' + label + '.json', P);
console.log(JSON.stringify({ label, startup: { demoMs: P.startup.demoMs, longTasksDemo: P.startup.longTasksDemo && { count: P.startup.longTasksDemo.count, totalMs: P.startup.longTasksDemo.totalMs } }, fps: Object.fromEntries(Object.entries(P.fps).map(([k, v]) => [k, [v.frames, v.p50, v.p95]])), error: P.error, errors: R.errors, consoleErrors: R.consoleErrors }));
await browser.close();
