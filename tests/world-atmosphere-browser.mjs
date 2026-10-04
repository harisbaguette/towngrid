import assert from 'node:assert/strict';
import {browser,open,toHome,shot,waitSim,R,save,tilePoint} from './audit-2/_browser.mjs';

const page=await open({width:1440,height:960});
const snapshot=p=>p.evaluate(()=>{
 const s=window.tgScene,a=s.atmosphere;
 const layer=l=>l.slots.filter(n=>n.visible).map(n=>({key:n.userData.bank,position:n.position.toArray(),opacity:n.material.opacity}));
 return {time:a.time,gameTime:s.sim.time,fog:layer(a.fog),clouds:layer(a.clouds),counts:[a.fog.slots.length,a.clouds.slots.length]};
});
async function preview(p){
 await toHome(p,{previewMenu:false});await p.getByRole('button',{name:'새 게임',exact:true}).click();
 await p.getByRole('button',{name:'지역 살펴보기'}).click();await p.getByRole('button',{name:'땅 미리보기'}).click();
 await waitSim(p,()=>window.tgScene?.atmosphere?.clouds.slots.some(s=>s.visible&&s.material.map.image)&&window.tgScene.renderer.domElement.dataset.worldReady==='true');
 await p.waitForTimeout(1600);
}
try{
 await preview(page);await shot(page,'01-start-mist-clouds.png');
 const before=await snapshot(page);await page.waitForTimeout(1300);const after=await snapshot(page);
 assert.equal(after.gameTime,before.gameTime,'weather in the preview must not advance the paused simulation');
 assert.ok(after.time>before.time);assert.ok(before.fog.length>0&&before.clouds.length>0);
 for(const name of ['fog','clouds']){
  const a=before[name].find(n=>after[name].some(p=>p.key===n.key));assert.ok(a);
  const b=after[name].find(n=>n.key===a.key);assert.ok(b.position[0]>a.position[0],'world-space drift: '+name);
 }
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(200);
 const frozen=await snapshot(page);await page.waitForTimeout(350);assert.deepEqual(await snapshot(page),frozen);
 await page.evaluate(()=>{window.startAtmosphere=window.tgScene.atmosphere;});
 await page.getByRole('button',{name:'이 땅에서 시작'}).click();await page.locator('.game-shell.is-playing').waitFor();
 assert.ok(await page.evaluate(()=>window.tgScene.atmosphere===window.startAtmosphere));
 await page.evaluate(()=>{window.tgScene.sim.paused=true;});await page.waitForTimeout(500);await shot(page,'02-playing.png');
 // The original layer must survive scene rebuilds; decorative banks cannot capture tile input.
 await page.getByRole('button',{name:'건설 목록 열기',exact:true}).click();
 await page.locator('.build-item').filter({hasText:'우물'}).first().click();
 const tile=await page.evaluate(()=>window.tgScene.sim.tiles.find(t=>!window.tgScene.sim.canBuild('well',t.x,t.z)));
 const point=await tilePoint(page,tile.x,tile.z);await page.mouse.click(point.px,point.py);
 await waitSim(page,()=>window.tgScene.sim.buildings.some(b=>b.type==='well'));
 assert.ok(await page.evaluate(()=>window.tgScene.atmosphere===window.startAtmosphere));
 await shot(page,'03-building.png');await page.keyboard.press('Escape');
 for(let q=0;q<4;q++){
  await page.evaluate(q=>window.tgScene.setQuarterView(q),q);await page.waitForTimeout(250);
  const state=await snapshot(page);assert.ok(state.fog.length&&state.clouds.length);await shot(page,'04-rotation-'+q+'.png');
 }
 await page.getByRole('button',{name:'대륙 전체 보기'}).click();await page.waitForTimeout(700);await shot(page,'05-continent.png');
 for(const span of [30,70,150,350,700,1400]){
  await page.evaluate(span=>{const s=window.tgScene;s.flyToWorld(600,360,span,{animate:false});},span);await page.waitForTimeout(160);
  const a=await snapshot(page);assert.deepEqual(a.counts,[22,14]);assert.ok(a.fog.length<=22&&a.clouds.length<=14);
 }
 // Rebasing to another site changes local renderer coordinates, not cloud geography.
 const continuity=await page.evaluate(async()=>{
  const s=window.tgScene,{Campaign}=await import('/src/app/game/campaign.js'),{startingProvinces}=await import('/src/app/game/starting-sites.js');
  const a=s.atmosphere;s.flyToWorld(480,360,150,{animate:false});a.update(0);
  const positions=()=>a.clouds.slots.filter(n=>n.visible).map(n=>[n.userData.bank,...n.position.toArray()]).sort();
  const before=positions(),oldOrigin=s.sim.layout.cell,other=startingProvinces('estern').find(p=>p.id!==s.sim.provinceId),c=new Campaign({nation:'estern',provinceId:other.id});
  s.setSimulation(c.active,{preserveCamera:true});s.camera.updateMatrixWorld();a.update(0);
  return {same:s.atmosphere===a,before,after:positions(),oldOrigin,newOrigin:s.sim.layout.cell};
 });
 assert.ok(continuity.same);assert.notDeepEqual(continuity.oldOrigin,continuity.newOrigin);assert.deepEqual(continuity.before,continuity.after);
 const mobile=await open({width:390,height:844},{isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 await preview(mobile);await shot(mobile,'06-mobile-start.png');
 await mobile.getByRole('button',{name:'이 땅에서 시작'}).tap();await mobile.locator('.minimal-hud').waitFor();await shot(mobile,'07-mobile-playing.png');
 assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const cpu=await open({width:1024,height:768},{reducedMotion:'reduce'});
 await cpu.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return ['webgl','webgl2'].includes(type)?null:get.call(this,type,...args);};});
 await preview(cpu);assert.ok(await cpu.evaluate(()=>window.tgScene.renderer.isSoftware));await shot(cpu,'08-canvas.png');
 const cpuState=await snapshot(cpu);assert.ok(cpuState.fog.length&&cpuState.clouds.length);
 assert.ok(cpuState.fog.length<=14&&cpuState.clouds.length<=9);
 const pixels=await cpu.evaluate(()=>{
  const s=window.tgScene,a=s.atmosphere,draw=()=>{s.renderer.render(s.scene,s.camera);return s.renderer.domElement.toDataURL();};
  const both=draw();a.fog.group.visible=false;const clouds=draw();a.clouds.group.visible=false;const bare=draw();
  a.fog.group.visible=a.clouds.group.visible=true;return {fog:both!==clouds,clouds:clouds!==bare};
 });assert.deepEqual(pixels,{fog:true,clouds:true});
 // Disposal releases each owned texture/material and detaches both layers.
 const disposed=await cpu.evaluate(()=>{
  const a=window.tgScene.atmosphere;let materials=0,textures=0;
  for(const layer of [a.fog,a.clouds]){for(const s of layer.slots)s.material.addEventListener('dispose',()=>materials++);for(const t of layer.textures)t.addEventListener('dispose',()=>textures++);}
  a.dispose();a.dispose();return {materials,textures,parents:[a.fog.group.parent,a.clouds.group.parent]};
 });
 assert.deepEqual(disposed,{materials:36,textures:7,parents:[null,null]});
 assert.deepEqual(R.errors,[]);assert.deepEqual(R.consoleErrors,[]);assert.deepEqual(R.failedRequests,[]);
 await save('results.json',{passed:true,checks:['visible fog and clouds','independent drift in paused preview','reduced motion freezes drift','same layers from start to game','build through atmosphere','four camera directions','bounded pool at every zoom','world positions survive rebase','mobile','Canvas fallback','idempotent GPU disposal'],before,after,cpuState,...R});
 console.log('WORLD_ATMOSPHERE_OK');
}catch(e){console.log('BROWSER_ERRORS',JSON.stringify(R));await shot(page,'failure.png').catch(()=>{});throw e;}
finally{await browser.close();}
