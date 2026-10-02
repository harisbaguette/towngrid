// Audit 2026-09-30 (G2) probe: what the main thread does in the long task when the showcase (산업도시 둘러보기) opens.
// CPU profile from the click until the showcase is ready + 2.5 s; self time and total (inclusive) time per function.
// Usage: TOWNGRID_URL=<dev or prod origin> TG_OUT=docs/verification/audit-20260930/perf TG_LABEL=name
//        node tests/audit-3/browser-demo-profile.mjs <playwright/index.mjs> <chrome.exe>
import { R, open, toHome, save, browser } from '../audit-2/_browser.mjs';

const label = process.env.TG_LABEL || 'dev', P = { label, url: process.env.TOWNGRID_URL || 'http://localhost:5173' };
const page = await open({ width: 1920, height: 1080 });
const cdp = await page.context().newCDPSession(page);
try {
  await toHome(page);
  const fold = page.locator('.home-extras summary');
  if (await fold.count() && !(await page.locator('.home-extras[open]').count())) await fold.click();
  await page.waitForTimeout(1500);
  const before = await page.evaluate(() => window.tgLongTasks.length);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
  const t0 = Date.now();
  await page.getByRole('button', { name: '산업도시 둘러보기' }).click();
  await page.waitForFunction(() => { const c = document.querySelector('[role=application]'); return c && +c.dataset.models > 30 && !document.querySelector('.screen-loading'); }, null, { timeout: 120000, polling: 100 });
  P.demoMs = Date.now() - t0;
  await page.waitForTimeout(2500);
  const { profile } = await cdp.send('Profiler.stop');
  P.longTasks = (await page.evaluate(() => window.tgLongTasks.slice())).slice(before).sort((a, b) => b.d - a.d).slice(0, 5);
  const byId = new Map(profile.nodes.map(n => [n.id, n])), parent = new Map();
  for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const key = n => (n.callFrame.functionName || '(anon)') + ' ' + n.callFrame.url.split('/').pop().split('?')[0] + ':' + (n.callFrame.lineNumber + 1);
  const self = new Map(), total = new Map();
  // Only samples inside the biggest long task window.
  const lt = P.longTasks[0]; let time = profile.startTime, navStart = await page.evaluate(() => performance.timeOrigin);
  const inWindow = []; profile.samples.forEach((id, i) => { time += profile.timeDeltas[i]; const ms = time / 1000 - navStart; inWindow.push(true); });
  let busy = 0;
  profile.samples.forEach((id, i) => {
    if (!inWindow[i]) return; const dt = profile.timeDeltas[i + 1] || profile.timeDeltas[i] || 0; busy += dt;
    const n = byId.get(id); self.set(key(n), (self.get(key(n)) || 0) + dt);
    const seen = new Set(); for (let c = id; c !== undefined; c = parent.get(c)) { const k = key(byId.get(c)); if (seen.has(k)) continue; seen.add(k); total.set(k, (total.get(k) || 0) + dt); }
  });
  const ms = v => Math.round(v / 1000);
  P.windowMs = ms(busy);
  P.selfTop = [...self].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => k + ' ' + ms(v) + 'ms');
  P.totalTop = [...total].filter(([k]) => !/^\((root|program|idle)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => k + ' ' + ms(v) + 'ms');
} catch (e) { P.error = String(e.stack || e).slice(0, 500); }
P.R = R;
await save('demo-profile-' + label + '.json', P);
console.log(JSON.stringify({ label, demoMs: P.demoMs, longTasks: P.longTasks, windowMs: P.windowMs, error: P.error }));
await browser.close();
