import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const folder=new URL('../docs/verification/art-completion/',import.meta.url);await mkdir(folder,{recursive:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],failed=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/pixel-environment/')&&r.status()>=400)failed.push(r.url());});
try{
 await page.goto(process.env.TOWNGRID_URL||'http://localhost:5173');
 await page.locator('canvas[role="application"]').waitFor({state:'attached',timeout:120000});console.log('Game initialized');
 await page.getByRole('button',{name:'화면을 눌러 시작',exact:true}).waitFor({timeout:120000});await page.getByRole('button',{name:'화면을 눌러 시작',exact:true}).click();
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
 assert.ok(actual.some(v=>v.asset==='cargoWagon'));assert.ok(actual.some(v=>v.asset==='cargoTruckEmpty'));
 for(let view=0;view<4;view++){
  await page.evaluate(view=>{window.artGame.setQuarterView(view);window.artGame.lastPaint=null;},view);
  await page.waitForFunction(view=>[...window.artGame.models.values()].every(m=>m.userData.direction===view),view);
  await page.screenshot({path:fileURLToPath(new URL('game-'+view+'.png',folder))});
 }
 const repaired=await page.evaluate(well=>{const g=window.artGame,s=g.sim;s.money+=1000;const result=s.repair(well);g.rebuild();g.lastPaint=null;return result.ok;},setup.well);assert.equal(repaired,true);
 await page.waitForFunction(well=>!window.artGame.models.get(well).userData.layers.find(l=>l.name==='repair-needed').visible,setup.well);
 await page.evaluate(()=>{for(const sh of window.artGame.sim.shipments)sh.phase='back';window.artGame.lastPaint=null;});
 await page.waitForFunction(()=>[...window.artGame.exportCarts.values()].every(m=>!m.userData.cargo.visible));
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:fileURLToPath(new URL('game-mobile.png',folder))});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const save=await page.evaluate(()=>Object.keys(localStorage).filter(k=>/save|backup/i.test(k)));assert.deepEqual(save,[]);
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 await writeFile(new URL('game-results.json',folder),JSON.stringify({hud,setup,actual,repaired,errors,failed,noSave:true},null,2));
 console.log('Live game: resource HUD, 5 real dispatched shipments, loaded/return cargo, four cameras, damage and repair, mobile and no autosave PASS.');
}catch(error){await page.screenshot({path:fileURLToPath(new URL('game-failure.png',folder))}).catch(()=>{});console.log({errors,failed});throw error;}finally{await browser.close();}
