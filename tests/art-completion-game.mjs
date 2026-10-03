import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const folder=new URL('../docs/verification/environment-motion-20260929/game/',import.meta.url);await mkdir(folder,{recursive:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],failed=[];
await page.routeWebSocket('**/*',()=>{});
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/pixel-environment/')&&r.status()>=400)failed.push(r.url());});
try{
 await page.goto(process.env.TOWNGRID_URL||'http://localhost:5173');
 await page.locator('canvas[role="application"]').waitFor({state:'attached',timeout:120000});console.log('Game initialized');
 await page.getByRole('button',{name:'화면을 눌러 시작',exact:true}).waitFor({timeout:120000});await page.getByRole('button',{name:'화면을 눌러 시작',exact:true}).click();
 // The 체험·점검 group is open by default; wait for the home menu to render before checking, so a still-mounting group is not toggled shut.
 await page.locator('.home-extras').waitFor({timeout:120000});if(!(await page.locator('.home-extras[open]').count()))await page.locator('.home-extras > summary').click();
 await page.getByRole('button',{name:'초반 마을 테스트',exact:true}).waitFor({timeout:120000});assert.equal(await page.getByRole('link',{name:'일러스트 테스트',exact:true}).count(),1);
 console.log('Home ready');
 await page.evaluate(async()=>{
  const urls=performance.getEntriesByType('resource').map(r=>r.name).filter(u=>/\/app\/game\/scene\.js(?:\?|$)/.test(u));
  for(const url of [...new Set([...urls,location.origin+'/src/app/game/scene.js'])]){
   const {GameScene}=await import(url),original=GameScene.prototype.setSimulation;
   GameScene.prototype.setSimulation=function(...args){window.artGame=this;return original.apply(this,args);};
  }
 });
 await page.getByRole('button',{name:'초반 마을 테스트',exact:true}).click();
 await page.waitForFunction(()=>window.artGame,{},{timeout:120000});await page.getByRole('button',{name:'일시정지',exact:true}).click();await page.keyboard.press('Escape');
 console.log('Starter captured');
 const hud=await page.locator('img[src*="/pixel-environment/resources/"]').count();assert.ok(hud>=4,'real HUD uses resource artwork');
 const setup=await page.evaluate(async()=>{
  const {dispatchShipment,shipmentPose}=await import('/src/app/game/export-route.js');
  const g=window.artGame,s=g.sim;s.paused=true;s.stock.fuel=500;s.stock.wood=500;s.reserves.fuel=0;
  for(const t of s.tiles)s.owned.add(t.x+','+t.z);s.revision++;
  const errors=[];for(let i=0;i<5;i++){const e=dispatchShipment(s,'wood',1,9,false);if(e)errors.push(e);}
  for(const sh of s.shipments){const wet=sh.route.findIndex(p=>s.tile(p.x,p.z).terrain==='water');sh.progress=wet>=0?Math.min(wet+1,sh.route.length-1):1;}
  const well=s.buildings.find(b=>b.type==='well');well.health=0;g.rebuild();g.focusBuilding(well.id);g.camera.zoom=1.4;g.camera.updateProjectionMatrix();g.lastPaint=null;
  return {errors,kinds:s.shipments.map(sh=>sh.vehicle),well:well.id,poses:s.shipments.map(sh=>shipmentPose(sh))};
 });
 assert.deepEqual(setup.errors,[]);assert.ok(setup.kinds.includes('wagon'));assert.ok(setup.kinds.includes('truck'));
 await page.waitForFunction(()=>window.artGame.exportCarts.size===5);
 const actual=await page.evaluate(()=>[...window.artGame.exportCarts.values()].map(m=>({kind:m.userData.vehicleKind,asset:m.userData.environmentId,loaded:m.userData.cargo.visible})));
 assert.ok(actual.some(v=>v.asset==='cargoWagonMotion'));assert.ok(actual.some(v=>v.asset==='cargoTruckEmptyMotion'));
 const frames=await page.evaluate(()=>[...window.artGame.exportCarts.values()].map(m=>m.userData.frame));
 await page.evaluate(async()=>{const {tickShipments}=await import('/src/app/game/export-route.js');const s=window.artGame.sim;s.time+=.2;tickShipments(s,.2);window.artGame.lastPaint=null;});
 await page.waitForFunction(frames=>[...window.artGame.exportCarts.values()].some((m,i)=>m.userData.frame!==frames[i]),frames);
 for(let view=0;view<4;view++){
  await page.evaluate(view=>{window.artGame.setQuarterView(view);window.artGame.lastPaint=null;},view);
  await page.waitForFunction(view=>[...window.artGame.models.values()].every(m=>m.userData.direction===view),view);
  await page.screenshot({path:fileURLToPath(new URL('game-'+view+'.png',folder))});
 }
 const repaired=await page.evaluate(well=>{const g=window.artGame,s=g.sim;s.money+=1000;const result=s.repair(well);g.rebuild();g.lastPaint=null;return result.ok;},setup.well);assert.equal(repaired,true);
 await page.waitForFunction(well=>{const u=window.artGame.models.get(well).userData;return u.conditionHealth===100&&u.repairProgress!==null&&!u.layers.find(l=>l.name==='repair-needed').visible;},setup.well);
 assert.equal(await page.evaluate(well=>window.artGame.models.get(well).userData.damageAmount,setup.well),1,'paused rebuild retains the collapsed silhouette');
 await page.evaluate(()=>{window.artGame.sim.time+=.6;window.artGame.lastPaint=null;});
 await page.waitForFunction(well=>{const a=window.artGame.models.get(well).userData.damageAmount;return a>0&&a<1;},setup.well);
 await page.screenshot({path:fileURLToPath(new URL('game-repair.png',folder))});
 await page.evaluate(()=>{window.artGame.sim.time+=1;window.artGame.lastPaint=null;});
 await page.waitForFunction(well=>window.artGame.models.get(well).userData.damageAmount===0,setup.well);
 await page.evaluate(()=>{for(const sh of window.artGame.sim.shipments)sh.phase='back';window.artGame.lastPaint=null;});
 await page.waitForFunction(()=>[...window.artGame.exportCarts.values()].every(m=>!m.userData.cargo.visible));
 const network=await page.evaluate(async()=>{
  const {Simulation,RESOURCES}=await import('/src/app/game/simulation.js');
  const {legacyLayout}=await import('/src/app/game/world-grid.js');
  const {tickNetworks}=await import('/src/app/game/trade-terminals.js');
  const {PROVINCES}=await import('/src/app/game/territory.js');
  const {zoneOf}=await import('/src/app/game/infrastructure.js');
  const province=PROVINCES.find(p=>zoneOf(p.id).mountain&&!zoneOf(p.id).ice);
  const s=new Simulation('river',null,{land:legacyLayout('river',province.id)});s.paused=true;s.money=1e7;s.rank=32;s.nextEvent=1e9;s.autoSell={};
  for(const id of Object.keys(RESOURCES))s.stock[id]=200;
  const results=[s.build('warehouse',11,12),s.build('well',9,14),s.build('quarry',12,9)];
  for(const [x,z]of[[10,14],[10,13],[10,12]])results.push(s.build('pipe',x,z));
  for(const [x,z]of[[12,10],[12,11],[12,12]])results.push(s.build('conveyor',x,z));
  if(results.some(r=>!r.ok))throw new Error(JSON.stringify(results));
  s.workers=[];s.stock.water=0;s.stock.stone=0;s.at(9,14).out=6;s.at(12,9).out=6;s.time=10;
  window.artGame.setSimulation(s);tickNetworks(s,1);window.artGame.focusBuilding(s.warehouse.id);window.artGame.camera.zoom=1.2;window.artGame.camera.updateProjectionMatrix();
  return {water:s.stock.water,stone:s.stock.stone};
 });
 assert.ok(network.water>0&&network.stone>0,'both networks actually delivered stock');
 await page.waitForFunction(()=>window.artGame.networkCargo.size===2);
 const initial=await page.evaluate(()=>[...window.artGame.networkCargo.values()].map(m=>m.position.toArray()));
 await page.evaluate(()=>{window.artGame.sim.time+=.4;window.artGame.lastPaint=null;});
 await page.waitForFunction(initial=>[...window.artGame.networkCargo.values()].every((m,i)=>m.position.x!==initial[i][0]||m.position.z!==initial[i][2]),initial);
 await page.screenshot({path:fileURLToPath(new URL('game-network.png',folder))});
 const stationary=await page.evaluate(()=>[...window.artGame.networkCargo.values()].map(m=>m.position.toArray()));
 await page.waitForTimeout(200);assert.deepEqual(await page.evaluate(()=>[...window.artGame.networkCargo.values()].map(m=>m.position.toArray())),stationary,'pause freezes network goods');
 await page.evaluate(()=>{window.artGame.sim.demolish(10,13);window.artGame.sim.demolish(12,11);});
 await page.waitForFunction(()=>window.artGame.networkCargo.size===0);
 const handling=await page.evaluate(async()=>{
  const {Simulation,RESOURCES}=await import('/src/app/game/simulation.js');
  const {legacyLayout}=await import('/src/app/game/world-grid.js');
  const {tickShipments}=await import('/src/app/game/export-route.js');
  const {logisticsVisualEvents}=await import('/src/app/game/logistics-visual-events.js');
  const s=new Simulation('river',null,{land:legacyLayout('river')});s.paused=true;s.money=1e7;s.rank=32;s.autoSell={};
  for(const id of Object.keys(RESOURCES))s.stock[id]=200;
  for(const r of [s.build('warehouse',11,12),s.expand(4,3),s.build('riverport',16,13),s.sell('wood',100)])if(!r.ok)throw new Error(JSON.stringify(r));
  window.artGame.setSimulation(s);
  for(let i=0;i<200&&!logisticsVisualEvents(s).some(e=>e.kind==='terminal');i++){s.time+=.1;tickShipments(s,.1);}
  const port=s.at(16,13);window.artGame.focusBuilding(port.id);window.artGame.camera.zoom=1.4;window.artGame.camera.updateProjectionMatrix();
  return port.id;
 });
 await page.waitForFunction(id=>window.artGame.models.get(id).userData.handlingCargo,handling);
 await page.evaluate(()=>{window.artGame.sim.time+=.7;window.artGame.lastPaint=null;});
 await page.screenshot({path:fileURLToPath(new URL('game-port.png',folder))});
 await page.evaluate(()=>{window.artGame.sim.time+=2;window.artGame.lastPaint=null;});
 await page.waitForFunction(id=>!window.artGame.models.get(id).userData.handlingCargo,handling);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:fileURLToPath(new URL('game-mobile.png',folder))});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const save=await page.evaluate(()=>Object.keys(localStorage).filter(k=>/save|backup/i.test(k)));assert.deepEqual(save,[]);
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 await writeFile(new URL('game-results.json',folder),JSON.stringify({hud,setup,actual,repaired,network,handling,errors,failed,noSave:true},null,2));
 console.log('Live game: HUD, 5 dispatched shipments and motion, four cameras, collapse/repair, pipe/conveyor deliveries, port handling, pause, mobile and no autosave PASS.');
}catch(error){await page.screenshot({path:fileURLToPath(new URL('game-failure.png',folder))}).catch(()=>{});console.log({errors,failed});throw error;}finally{await browser.close();}
