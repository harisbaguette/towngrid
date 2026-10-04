import assert from 'node:assert/strict';
import {browser,open,origin,shot,R,save} from './audit-2/_browser.mjs';

const page=await open({width:1440,height:960});
const counts=p=>p.evaluate(()=>Object.fromEntries(Object.entries(window.effectsPreview.game.effects.components).map(([id,c])=>[id,c.batch.items.length])));
const metrics=[];
async function ready(p,url='/world-effects-preview.html'){
 await p.goto(origin+url);await p.waitForFunction(()=>window.effectsPreview?.game.renderer.domElement.dataset.worldReady==='true',null,{timeout:120000});await p.waitForTimeout(1000);
}
try{
 await ready(page);await shot(page,'01-all.png');
 for(const id of ['rain','snow','wind','geology','ripples','shore','birds','chimneys','work','magic','lighting']){
  await page.locator('#effect').selectOption(id);await page.waitForTimeout(800);
  const n=await counts(page);metrics.push({id,counts:n});console.log(id,n[id]);assert.ok(n[id]>0,id+' must be visible in its display fixture');
  const painted=await page.evaluate(id=>{
   const g=window.effectsPreview.game,c=g.effects.components[id],draw=()=>{g.renderer.render(g.scene,g.camera);return g.renderer.domElement.toDataURL();};
   const before=draw();c.batch.mesh.visible=false;if(c.mesh)c.mesh.visible=false;const after=draw();c.batch.mesh.visible=true;if(c.mesh)c.mesh.visible=true;
   return before!==after;
  },id);assert.ok(painted,id+' must change actual rendered pixels');
  await shot(page,id+'.png');
 }
 await page.locator('#effect').selectOption('actions');await page.waitForTimeout(250);
 for(const name of ['건설','피해','수리','생산 완료','철거']){
  await page.getByRole('button',{name,exact:true}).click();await page.waitForTimeout(120);assert.ok((await counts(page)).actions>0,name);await shot(page,'action-'+name+'.png');await page.waitForTimeout(1450);
 }
 await page.locator('#effect').selectOption('vehicles');await page.getByRole('button',{name:'화물 출발',exact:true}).click();
 await page.waitForFunction(()=>window.effectsPreview.game.effects.components.vehicles.batch.items.length>0,null,{timeout:45000});await shot(page,'vehicles.png');
 // Stopped and broken factories cannot emit active-production effects.
 await page.locator('#effect').selectOption('chimneys');await page.waitForTimeout(500);assert.ok((await counts(page)).chimneys>0);
 await page.evaluate(()=>{for(const b of window.effectsPreview.game.sim.buildings)b.enabled=false;});await page.waitForTimeout(150);assert.equal((await counts(page)).chimneys,0);
 await page.evaluate(()=>{for(const b of window.effectsPreview.game.sim.buildings){b.enabled=true;b.health=0;}});await page.waitForTimeout(150);assert.equal((await counts(page)).chimneys,0);
 // Render-only exploration never writes a save or changes gameplay data.
 await page.locator('#effect').selectOption('all');await page.getByRole('button',{name:'동작 멈추기'}).click();
 const before=await page.evaluate(()=>JSON.stringify(window.effectsPreview.game.sim.save()));
 for(let q=0;q<4;q++){await page.getByRole('button',{name:'↻ 90°',exact:true}).click();await page.waitForTimeout(100);}
 assert.equal(await page.evaluate(()=>JSON.stringify(window.effectsPreview.game.sim.save())),before);
 assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(k=>/save|campaign/.test(k)).length),0);
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#effect').selectOption('snow');await page.waitForTimeout(150);
 const frozen=await page.evaluate(()=>JSON.stringify(window.effectsPreview.game.effects.components.snow.batch.items));await page.waitForTimeout(250);
 assert.equal(await page.evaluate(()=>JSON.stringify(window.effectsPreview.game.effects.components.snow.batch.items)),frozen);
 const legacy=await page.evaluate(async()=>{
  const {Simulation}=await import('/src/app/game/simulation.js'),{worldOrigin}=await import('/src/app/game/world-space.js'),{waterAt}=await import('/src/app/game/world-grid.js');
  const g=window.effectsPreview.game,s=new Simulation('river');s.paused=true;g.setSimulation(s);g.camera.updateMatrixWorld();g.effects.only='ripples';g.effects.update();
  const [ox,oz]=worldOrigin(s),points=g.effects.components.ripples.points;
  return {legacy:!s.layout.cell,count:points.length,waterOnly:points.every(p=>{const x=p.x-ox,z=p.z-oz,t=s.tile(x,z);return t?!!t.water:!!waterAt(s.layout,x,z);})};
 });assert.ok(legacy.legacy&&legacy.count&&legacy.waterOnly);
 await page.emulateMedia({reducedMotion:'no-preference'});
 const mobile=await open({width:390,height:844},{isMobile:true,hasTouch:true});await ready(mobile,'/world-effects-preview.html?effect=rain');await shot(mobile,'mobile.png');assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const cpu=await open({width:1024,height:768});await ready(cpu,'/world-effects-preview.html?renderer=canvas&effect=all');
 assert.ok(await cpu.evaluate(()=>window.effectsPreview.game.renderer.isSoftware));await shot(cpu,'canvas.png');
 for(const id of ['rain','snow','chimneys','lighting']){await cpu.locator('#effect').selectOption(id);await cpu.waitForTimeout(600);assert.ok((await counts(cpu))[id]>0);await shot(cpu,'canvas-'+id+'.png');}
 const cpuPainted=await cpu.evaluate(()=>{const g=window.effectsPreview.game,c=g.effects.components.lighting;g.renderer.render(g.scene,g.camera);const before=g.renderer.domElement.toDataURL();c.batch.mesh.visible=false;g.renderer.worldTint=null;g.renderer.render(g.scene,g.camera);return before!==g.renderer.domElement.toDataURL();});assert.ok(cpuPainted);
 const disposed=await cpu.evaluate(()=>{const e=window.effectsPreview.game.effects;let textures=0,geometry=0,material=0;e.atlas.addEventListener('dispose',()=>textures++);for(const c of Object.values(e.components)){c.batch.mesh.geometry.addEventListener('dispose',()=>geometry++);c.batch.mesh.material.addEventListener('dispose',()=>material++);}e.dispose();e.dispose();return {textures,geometry,material};});
 assert.deepEqual(disposed,{textures:1,geometry:13,material:13});
 assert.deepEqual(R.errors,[]);assert.deepEqual(R.consoleErrors,[]);assert.deepEqual(R.failedRequests,[]);
 await save('results.json',{passed:true,metrics,checks:['all twelve live components','real facility gates','five action triggers','real export vehicle movement','four-view exploration is read-only','reduced motion','mobile','Canvas','bounded GPU batches and disposal'],...R});console.log('WORLD_EFFECTS_OK');
}catch(error){console.log('EFFECTS_ERROR',JSON.stringify(R),JSON.stringify(metrics));await shot(page,'failure.png').catch(()=>{});throw error;}
finally{await browser.close();}
