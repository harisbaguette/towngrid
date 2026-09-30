// Smoke: renderer type, load timings, fps on home->demo (quick sanity before the long probes).
import { R, open, toHome, demo, frames, heap, browser, save, shot } from './_browser.mjs';
const page = await open({ width: 1920, height: 1080 });
const t = await toHome(page);
t.demoMs = await demo(page);
await page.waitForTimeout(1500);
t.frames = await frames(page, 2000);
t.heap = await heap(page);
t.renderer = await page.evaluate(() => { const c = window.tgScene.renderer; return { software: !!c.isSoftware, quality: window.tgScene.quality, maxFps: window.tgScene.maxFps, gl: c.getContext?.()?.getParameter?.(c.getContext().RENDERER) }; });
await shot(page, 'smoke-demo-' + (process.env.TG_GPU ? 'gpu' : 'sw') + '.png');
console.log(JSON.stringify({ t, R }, null, 1));
await browser.close();
