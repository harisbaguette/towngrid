// Usage: node tests/pixel-readability-browser.mjs <playwright/index.mjs> <chrome.exe>
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}), args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
const errors = [], failedAssets = [], output = new URL('../docs/verification/pixel-readability/', import.meta.url);
await mkdir(output, { recursive: true });
page.on('pageerror', e => errors.push(e.message));
page.on('response', r => { if (r.url().includes('/assets/pixel-environment/') && r.status() >= 400) failedAssets.push(r.url()); });
const shot = name => page.screenshot({ path: fileURLToPath(new URL(name, output)), fullPage: true });
const origin = process.env.TOWNGRID_URL || 'http://localhost:5173';
try {
 await page.goto(origin + '/building-readability.html');
 await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth));
 await shot('comparison-80.png');await page.getByRole('button', { name: '48px', exact: true }).click();await shot('comparison-48.png');
 await page.setViewportSize({ width: 390, height: 844 });
 assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);await shot('comparison-mobile.png');
 await page.setViewportSize({ width: 1100, height: 850 });
 const facilities = await page.evaluate(async () => {
  const [{GameScene},{Simulation},{loadAssets}] = await Promise.all([import('/src/app/game/scene.js'),import('/src/app/game/simulation.js'),import('/src/app/game/assets.js')]);
  await loadAssets('human');
  document.body.innerHTML = '<div id="map" style="position:fixed;inset:0"></div><div style="position:fixed;top:18px;left:18px;background:#ffffe9;padding:12px 18px;border-radius:8px;z-index:2;color:#24463c;font:16px system-ui">흰 테두리 = 실제 1×1 타일 · 픽셀 시설 6종</div>';
  const sim = new Simulation();sim.rank = 20;sim.paused = true;
  for (const tile of sim.tiles) { tile.nature = null;tile.remaining = 0; }
  sim.tile(11,15).nature='tree';sim.tile(11,15).remaining=40;
  const types = ['warehouse','house','well','field','lumber','sawmill'];
  for (let i=0;i<types.length;i++) { const r=sim.build(types[i],9+i%3*2,9+Math.floor(i/3)*3,true);if(!r.ok)throw new Error(r.error); }
  sim.workers=[];sim.tile(11,15).nature=null;
  const game = new GameScene(document.querySelector('#map'),sim);game.active=false;
  game.camera.zoom=2.5;game.camera.updateProjectionMatrix();
  const dx=11-game.controls.target.x,dz=10.5-game.controls.target.z;
  game.camera.position.x+=dx;game.camera.position.z+=dz;game.controls.target.set(11,0,10.5);game.controls.update();
  for(const b of sim.buildings){
   if(b.type==='field')b.progress=.85;
   const line=game.outline(1,'#ffffff');line.position.set(b.x,.04,b.z);line.material.depthTest=false;line.renderOrder=999;game.scene.add(line);
  }
  window.readabilityScene=game;
  return sim.buildings.map(b=>({type:b.type,size:b.size,x:b.x,z:b.z}));
 });
 for(const b of facilities)assert.equal(b.size,1,b.type);
 for(let view=0;view<4;view++){
  await page.evaluate(view=>{const g=window.readabilityScene;g.setQuarterView(view);g.renderer.render(g.scene,g.camera);},view);
  await shot(`tile-fit-quarter-${view}.png`);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(failedAssets,[]);
 await writeFile(new URL('results.json',output),JSON.stringify({passed:true,facilities,errors,failedAssets,note:'Screenshots support manual footprint and pixel-style review; no automated subjective art-quality verdict.'},null,2));
 console.log('Pixel readability capture passed: 48/80px comparison, mobile layout, actual square tile outlines in four views, assets and page errors.');
} finally {await browser.close();}
