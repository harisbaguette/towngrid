// Where the startup long tasks come from: time GameScene.icons() (one PNG per building type) and setSimulation().
import { R, open, toHome, demo, sim, save, browser } from './_browser.mjs';
const page = await open({ width: 1920, height: 1080 });
const cdp = await page.context().newCDPSession(page);
if (process.env.TG_CPU_THROTTLE) await cdp.send('Emulation.setCPUThrottlingRate', { rate: +process.env.TG_CPU_THROTTLE });
await toHome(page); await demo(page); await page.waitForTimeout(1500);
const r = await sim(page, () => { const s = window.tgScene, out = {}; out.buildingTypes = Object.keys(s.icons()).filter(k => !k.startsWith('resident-')).length; s.iconCache.clear(); let t = performance.now(); s.icons('human'); out.iconsHumanMs = Math.round(performance.now() - t); s.iconCache.clear(); t = performance.now(); s.icons('elf'); out.iconsElfMs = Math.round(performance.now() - t); t = performance.now(); s.rebuild(); out.rebuildMs = Math.round(performance.now() - t); t = performance.now(); s.setSimulation(s.sim); out.setSimulationMs = Math.round(performance.now() - t); return out; });
r.throttle = +(process.env.TG_CPU_THROTTLE || 1); r.R = R;
await save('startup-cost' + (process.env.TG_CPU_THROTTLE ? '-cpu' + process.env.TG_CPU_THROTTLE : '') + '.json', r);
console.log(JSON.stringify(r));
await browser.close();
