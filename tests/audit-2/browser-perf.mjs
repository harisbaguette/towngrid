// Audit 2026-09-29 stage B, probe 3: performance on the industrial showcase (산업도시 둘러보기) at 1920x1080.
// Cold load timings, rAF frame times in several camera states, long tasks, how often and how long the scene
// rebuilds everything (scene.rebuild), and JS heap / DOM nodes / GPU objects over TG_PERF_MINUTES real minutes at 4x.
// Usage: TG_GPU=1 node tests/audit-2/browser-perf.mjs <playwright/index.mjs> <chrome.exe>
import { R, open, toHome, demo, frames, heap, shot, sim, save, raf, browser, log } from './_browser.mjs';
const minutes = +(process.env.TG_PERF_MINUTES || 10), tag = (process.env.TG_GPU ? 'gpu' : 'sw') + (process.env.TG_CPU_THROTTLE ? '-cpu' + process.env.TG_CPU_THROTTLE : '');
const P = { mode: tag, load: {}, fps: {}, rebuild: {}, memory: [], longTasks: {} };
const page = await open({ width: 1920, height: 1080 });
const cdp = await page.context().newCDPSession(page);
// TG_CPU_THROTTLE=4 approximates a mid-range phone CPU (Chrome DevTools CPU throttling).
if (process.env.TG_CPU_THROTTLE) { await cdp.send('Emulation.setCPUThrottlingRate', { rate: +process.env.TG_CPU_THROTTLE }); P.cpuThrottle = +process.env.TG_CPU_THROTTLE; }
try {
  log('load');
  const t0 = Date.now();
  P.load.home = await toHome(page);
  P.load.slowestRequests = await page.evaluate(() => performance.getEntriesByType('resource').map(e => ({ u: e.name.replace(location.origin, '').split('?')[0], start: Math.round(e.startTime), ms: Math.round(e.duration), wait: Math.round(e.responseStart - e.requestStart) })).sort((a, b) => b.ms - a.ms).slice(0, 12));
  P.load.requestCount = await page.evaluate(() => performance.getEntriesByType('resource').length);
  P.load.gpu = await page.evaluate(() => { const c = document.createElement('canvas').getContext('webgl2'); const e = c?.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'n/a'; });
  P.load.demoMs = await demo(page);
  P.load.totalToPlayableMs = Date.now() - t0;
  // Count and time every full scene rebuild from here on.
  await page.evaluate(() => { const s = window.tgScene, o = s.rebuild.bind(s); window.tgRebuilds = []; s.rebuild = function () { const t = performance.now(); const r = o(); window.tgRebuilds.push({ at: Math.round(t), ms: +(performance.now() - t).toFixed(1), game: Math.round(this.sim.time) }); return r; }; });
  await page.waitForTimeout(2000);
  P.scene = await sim(page, () => { const s = window.tgScene, c = s.renderer.domElement.dataset; return { buildings: s.sim.buildings.length, workers: s.sim.workers.length, models: +c.models, geometries: +c.geometries, textures: +c.textures, quality: s.quality, maxFps: s.maxFps, pixelRatio: s.renderer.getPixelRatio(), shadows: s.renderer.shadowMap.enabled }; });
  const lt = () => page.evaluate(() => window.tgLongTasks.length);
  const sample = async (key, prep) => { if (prep) await prep(); await page.waitForTimeout(600); const n0 = await lt(); const r0 = await page.evaluate(() => window.tgRebuilds.length); P.fps[key] = await frames(page, 2000); P.fps[key].longTasks = (await lt()) - n0; P.fps[key].rebuilds = (await page.evaluate(() => window.tgRebuilds.length)) - r0; };
  log('fps');
  await sample('default-1x');
  await shot(page, `G01-perf-default-${tag}.png`);
  await sample('4x', () => page.getByRole('button', { name: '4×' }).click());
  await sample('zoomed-out', () => sim(page, () => window.tgScene.zoom(.1)));
  await shot(page, `G02-perf-zoomed-out-${tag}.png`);
  await sample('zoomed-in', () => sim(page, () => window.tgScene.zoom(20)));
  await sim(page, () => window.tgScene.resetCamera());
  await sample('labels-on', async () => { await page.getByRole('button', { name: '건설 목록 열기' }).click(); await page.getByRole('button', { name: '시설 이름 표시' }).click(); await page.getByRole('button', { name: '건설 목록 닫기' }).click(); });
  await shot(page, `G03-perf-labels-${tag}.png`);
  // Rotation: the first frames after a quarter turn (caches are cleared on every turn).
  P.fps.rotate = await page.evaluate(() => new Promise(res => { const d = []; let last = performance.now(); window.tgScene.rotate(1); const f = now => { d.push(+(now - last).toFixed(1)); last = now; if (d.length < 30) requestAnimationFrame(f); else res({ first10: d.slice(0, 10), max: Math.max(...d) }); }; requestAnimationFrame(f); }));
  // Drag pan for 2 s with a real mouse while sampling frames.
  const drag = (async () => { await page.mouse.move(900, 500); await page.mouse.down(); for (let k = 0; k < 40; k++) { await page.mouse.move(900 + Math.sin(k / 6) * 250, 500 + Math.cos(k / 6) * 120); await page.waitForTimeout(45); } await page.mouse.up(); })();
  P.fps.dragging = await frames(page, 2000); await drag;
  // Build dock open (many icon images + markers).
  await sample('build-dock-open', () => page.getByRole('button', { name: '건설 목록 열기' }).click());
  await page.getByRole('button', { name: '건설 목록 닫기' }).click();
  // Phone-sized viewport on the same page.
  await page.setViewportSize({ width: 390, height: 844 });
  await sample('phone-390');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await sim(page, () => window.tgScene.resetCamera());

  log('memory ' + minutes + ' min at 4x');
  await page.getByRole('button', { name: '4×' }).click();
  await cdp.send('HeapProfiler.collectGarbage');
  const start = Date.now();
  for (let m = 0; m <= minutes; m++) {
    await cdp.send('HeapProfiler.collectGarbage');
    const h = await heap(page), d = await sim(page, () => { const s = window.tgScene, c = s.renderer.domElement.dataset, info = s.renderer.info?.memory || {}; return { game: Math.round(s.sim.time), buildings: s.sim.buildings.length, workers: s.sim.workers.length, shipments: s.sim.shipments?.length || 0, notices: s.sim.notices?.length || 0, geometries: info.geometries, textures: info.textures, programs: s.renderer.info?.programs?.length, sceneChildren: s.scene.children.length, worldChildren: s.world.children.length, toasts: document.querySelectorAll('[data-sonner-toast]').length, rebuilds: window.tgRebuilds.length, rebuildMsP95: (() => { const a = window.tgRebuilds.map(v => v.ms).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length * .95)] : 0; })(), fps: +c.fps }; });
    const f = await frames(page, 2000);
    P.memory.push({ minute: m, realS: Math.round((Date.now() - start) / 1000), ...h, ...d, p95: f.p95, frames: f.frames });
    log(JSON.stringify(P.memory.at(-1)));
    if (m < minutes) await page.waitForTimeout(Math.max(0, 60000 - 2000 - 1500));
  }
  await shot(page, `G04-perf-after-${minutes}min-${tag}.png`);
  P.rebuild = await page.evaluate(() => { const a = window.tgRebuilds, ms = a.map(v => v.ms).sort((x, y) => x - y); return { count: a.length, perMinute: +(a.length / ((a.at(-1)?.at - a[0]?.at) / 60000 || 1)).toFixed(1), p50: ms[Math.floor(ms.length / 2)], p95: ms[Math.floor(ms.length * .95)], max: ms.at(-1) }; });
  P.longTasks = await page.evaluate(() => { const a = window.tgLongTasks; return { count: a.length, over50: a.filter(v => v.d > 50).length, over100: a.filter(v => v.d > 100).length, over200: a.filter(v => v.d > 200).length, max: Math.max(0, ...a.map(v => v.d)), top: [...a].sort((x, y) => y.d - x.d).slice(0, 10) }; });
  // What a long task is: profile 5 s at 4x and list the heaviest functions.
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
  await page.waitForTimeout(5000);
  const { profile } = await cdp.send('Profiler.stop');
  const self = new Map(), byId = new Map(profile.nodes.map(n => [n.id, n])); const dt = profile.timeDeltas; const counts = new Map();
  profile.samples.forEach((id, k) => counts.set(id, (counts.get(id) || 0) + (dt[k] || 0)));
  for (const [id, us] of counts) { const n = byId.get(id), cf = n.callFrame; const key = `${cf.functionName || '(anon)'} ${cf.url.split('/').slice(-1)[0].split('?')[0]}:${cf.lineNumber + 1}`; self.set(key, (self.get(key) || 0) + us); }
  const total = [...self.values()].reduce((a, b) => a + b, 0);
  P.profileTop = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, us]) => `${(us / 1000).toFixed(0)}ms ${(us / total * 100).toFixed(1)}% ${k}`);
} catch (e) { P.aborted = e.message.split('\n').slice(0, 3).join(' | '); await shot(page, `Z-perf-aborted-${tag}.png`).catch(() => {}); }
P.R = R;
await save(`perf-${tag}.json`, P);
console.log(JSON.stringify({ aborted: P.aborted, load: P.load, scene: P.scene, fps: P.fps, rebuild: P.rebuild, longTasks: { ...P.longTasks, top: undefined }, first: P.memory[0], last: P.memory.at(-1), profileTop: P.profileTop?.slice(0, 12) }, null, 1));
await browser.close();
