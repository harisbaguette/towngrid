import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {layoutOf} from '../src/app/game/world-grid.js';
import {startingProvinces} from '../src/app/game/starting-sites.js';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const out='docs/verification/continuous-map-20261002',origin=process.env.TOWNGRID_URL||'http://localhost:5173';
await mkdir(out,{recursive:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],failed=[];
page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
page.on('response',r=>{if(r.status()>=400&&r.url().includes('/assets/'))failed.push(r.url());});
const shot=name=>page.screenshot({path:out+'/'+name+'.png'});
try{
 for(const renderer of ['webgl','canvas']){
  await page.goto(origin+'/map-edges-preview.html'+(renderer==='canvas'?'?renderer=canvas':''));
  await page.waitForFunction(()=>window.edgePreview,{},{timeout:90000});
  const before=await page.evaluate(()=>JSON.stringify(window.edgePreview.game.sim.save()));
  for(let view=0;view<4;view++){
   await page.evaluate(view=>{const g=window.edgePreview.game;g.setQuarterView(view);g.scene.updateMatrixWorld(true);g.camera.updateMatrixWorld();g.renderer.render(g.scene,g.camera);},view);
   await shot('local-'+renderer+'-'+view);
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(window.edgePreview.game.sim.save())),before);
  assert.equal(await page.evaluate(()=>window.edgePreview.game.scenery.group.getObjectByName('continuous-landscape')?.children.length),2);
  assert.equal(await page.evaluate(()=>window.edgePreview.game.world.getObjectByName('plot-boundaries')?.userData.plotSize),24);
  assert.ok(await page.evaluate(()=>window.edgePreview.game.world.getObjectByName('active-plot-border')?.userData.image.width===1024));
  assert.ok(await page.evaluate(()=>window.edgePreview.game.world.getObjectByName('neighbor-plot-borders')?.geometry.attributes.position.count>0));
  if(renderer==='canvas'){
   const cachedBorders=await page.evaluate(()=>{const g=window.edgePreview.game,canvas=g.world.getObjectByName('active-plot-border').userData.image;g.rebuild();return canvas===g.world.getObjectByName('active-plot-border').userData.image;});
   assert.ok(cachedBorders,'Rebuilding does not grow the boundary canvas cache');
  }
  if(renderer==='canvas'){
   await page.locator('#preset').selectOption('rivente-0');
   const cached=await page.evaluate(()=>{const g=window.edgePreview.game;g.scene.updateMatrixWorld(true);g.camera.updateMatrixWorld();g.renderer.render(g.scene,g.camera);const image=g.scenery.group.getObjectByName('landscape-water').userData.image;return g.renderer.surfacePatterns.has(image);});
   assert.ok(cached,'Switching sites caches the new landscape, not the old water map');
  }
  console.log(renderer+' local views saved');
 }
 await page.goto(origin,{waitUntil:'domcontentloaded'});
 await page.locator('canvas[role="application"]').waitFor({state:'attached',timeout:120000});
 await page.getByRole('button',{name:'화면을 눌러 시작',exact:true}).click({timeout:120000});
 await page.getByRole('button',{name:'새 게임',exact:true}).click();
 await page.locator('.world-atlas').waitFor();
 await page.locator('#realm').selectOption('estern');
 await page.waitForFunction(()=>[...document.querySelectorAll('.atlas-legend img')].every(i=>i.complete&&i.naturalWidth));
 await shot('world-continent');
 const starts=startingProvinces('estern'),target=starts.find(p=>p.territoryId&&Object.values(layoutOf(p.id).edges).includes('river'))||starts.find(p=>p.territoryId);
 await page.locator('#start-province').selectOption(target.id);
 await page.getByRole('button',{name:'주변 확대',exact:true}).click();
 await shot('world-parcels');
 assert.equal(await page.locator('.local-map-preview').getAttribute('data-province'),target.id);
 const adjacent=starts.find(p=>p.territoryId&&p.id!==target.id&&Math.hypot(p.cell[0]-target.cell[0],p.cell[1]-target.cell[1])<3);
 assert.ok(adjacent);
 const point=await page.locator('.atlas-ground').evaluate((el,cell)=>{const p=new DOMPoint((cell[0]+.5)*26,(cell[1]+.5)*26).matrixTransform(el.getScreenCTM());return {x:p.x,y:p.y};},adjacent.cell);
 await page.mouse.click(point.x,point.y);
 assert.equal(await page.locator('#start-province').inputValue(),adjacent.id,'Click selects the exact square');
 await page.setViewportSize({width:390,height:844});await shot('world-mobile');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('button',{name:'이 땅에서 시작',exact:true}).click();
 await page.locator('.is-playing').waitFor({timeout:120000});
 await shot('new-town');
 await page.waitForFunction(()=>!!localStorage.getItem('first-land-v1'),{},{timeout:15000});
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('first-land-v1')));
 assert.equal(saved.game.sites[0].provinceId,adjacent.id);
 assert.deepEqual(saved.game.sites[0].simulation.land.cell,adjacent.cell);
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'지도 중앙',exact:true}).click().catch(()=>{});
 await shot('new-town-mobile');
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 await writeFile(out+'/browser-results.json',JSON.stringify({passed:true,plot:adjacent.id,checks:['four quarter views','WebGL and Canvas','rendering preserves save','exact plot click','real new town','mobile fit'],errors,failed},null,2));
 console.log('Continuous world and local map browser PASS');
}catch(e){await shot('failure').catch(()=>{});throw e;}finally{await browser.close();}
