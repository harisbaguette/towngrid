import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const out='docs/verification/logistics-rework-20261003',errors=[],failed=[],report={};
await mkdir(out,{recursive:true});
const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
context.setDefaultTimeout(30000);
const page=await context.newPage();
await page.routeWebSocket('**/*',()=>{});
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.status()>=400&&r.url().includes('/assets/'))failed.push(r.url());});
const shot=name=>page.screenshot({path:out+'/'+name+'.png'});
try{
 await page.goto(process.env.TOWNGRID_URL||'http://localhost:5173',{waitUntil:'domcontentloaded',timeout:120000});
 await page.locator('canvas[role="application"]').waitFor({state:'attached',timeout:120000});
 await page.getByRole('button',{name:'화면을 눌러 시작',exact:true}).click({timeout:120000});
 await page.getByRole('button',{name:'새 게임',exact:true}).waitFor({timeout:120000});
 await page.evaluate(async()=>{
  const urls=performance.getEntriesByType('resource').map(r=>r.name).filter(u=>/\/app\/game\/scene\.js(?:\?|$)/.test(u));
  for(const url of new Set([...urls,'/src/app/game/scene.js'])){
   const {GameScene}=await import(url),original=GameScene.prototype.setSimulation;
   GameScene.prototype.setSimulation=function(...args){window.starterGame=this;return original.apply(this,args);};
  }
 });
 await page.getByRole('button',{name:'새 게임',exact:true}).click();
 await page.locator('.start-button:not(:disabled)').waitFor({timeout:120000});
 assert.match(await page.locator('.preview-transport').innerText(),/시작 수출 운송/);
 assert.match(await page.locator('.preview-transport').innerText(),/사용 가능 40개/);
 await shot('01-selected-map');
 await page.locator('.start-button').click();
 await page.locator('.game-shell.is-playing:not([inert]) .minimal-hud').waitFor({timeout:120000});
 await page.getByRole('button',{name:'일시정지',exact:true}).click();
 assert.equal(await page.locator('.tutorial-card').count(),0);
 assert.equal(await page.locator('.placement-hint').count(),0);
 report.start=await page.evaluate(()=>{const g=window.starterGame;return {mode:g.mode,buildings:g.sim.buildings.length,workers:g.workerModels.size,parked:g.idleExportCarts.size,connected:g.sim.exportStatus().connected};});
 assert.deepEqual(report.start,{mode:null,buildings:0,workers:0,parked:1,connected:true});
 for(let view=0;view<4;view++){
  await page.evaluate(v=>{window.starterGame.setQuarterView(v);window.starterGame.lastPaint=null;},view);
  await page.waitForFunction(()=>window.starterGame.idleExportCarts.size===1&&[...window.starterGame.idleExportCarts.values()].every(m=>m.userData.cargo.visible===true));
  await shot('02-start-view-'+view);
 }
 await page.getByRole('button',{name:'시장',exact:true}).click();
 assert.match(await page.locator('.export-status').innerText(),/0\/1/);
 const before=await page.evaluate(()=>({money:window.starterGame.sim.money,wood:window.starterGame.sim.stock.wood}));
 await page.getByRole('button',{name:'목재 1개 판매',exact:true}).click();
 await page.waitForFunction(()=>window.starterGame.exportCarts.size===1&&window.starterGame.idleExportCarts.size===0);
 report.depart=await page.evaluate(()=>{const g=window.starterGame,s=g.sim;return {money:s.money,wood:s.stock.wood,loaded:[...g.exportCarts.values()][0].userData.loaded,revenue:s.shipments[0].revenue};});
 assert.equal(report.depart.money,before.money);assert.equal(report.depart.wood,before.wood-1);assert.equal(report.depart.loaded,true);
 await shot('03-export-without-warehouse');
 await page.keyboard.press('Escape');
 await page.evaluate(async()=>{const {tickShipments}=await import('/src/app/game/export-route.js');const g=window.starterGame;for(let i=0;i<600;i++)tickShipments(g.sim,.25);g.lastPaint=null;});
 await page.waitForFunction(()=>window.starterGame.exportCarts.size===0&&window.starterGame.idleExportCarts.size===1);
 assert.equal(await page.evaluate(()=>window.starterGame.sim.money),before.money+report.depart.revenue);

 // Build housing first through the real catalog and placement callback, then a well.
 await page.getByRole('button',{name:'건설 목록 열기',exact:true}).click();
 await page.getByLabel('전체 건설 분류').selectOption('home');
 await page.getByRole('button',{name:'주민 주택 건설',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.starterGame.mode),'house');
 await page.evaluate(()=>window.starterGame.callbacks.onClick(10,14));await page.keyboard.press('Escape');
 await page.waitForFunction(()=>window.starterGame.workerModels.size===1);
 await page.getByRole('button',{name:'건설 목록 열기',exact:true}).click();
 await page.getByRole('tab',{name:'기초',exact:true}).click();
 await page.getByRole('button',{name:'우물 건설',exact:true}).click();
 await page.evaluate(()=>window.starterGame.callbacks.onClick(12,12));await page.keyboard.press('Escape');
 await page.waitForFunction(()=>window.starterGame.sim.buildings.length===2);
 assert.equal(await page.evaluate(()=>window.starterGame.workerModels.size),1);
 assert.equal(await page.evaluate(()=>window.starterGame.world.children.filter(m=>m.userData.facilityStaff).length),0);
 await page.getByRole('button',{name:'게임 메뉴',exact:true}).click();
 await page.getByRole('button',{name:/^주민/}).click();
 assert.match(await page.locator('.resident-summary').innerText(),/1명/);
 assert.equal(await page.locator('.resident-choice').count(),1);
 await shot('04-residents');await page.keyboard.press('Escape');

 // The mini store receives real production; the new fuel facility has four rendered views.
 report.production=await page.evaluate(()=>{const g=window.starterGame,s=g.sim;s.paused=false;s.nextEvent=1e9;s.autoSell={};for(let i=0;i<180;i++)s.tick(.25);s.paused=true;g.lastPaint=null;return {water:s.starterStore.inventory.water,made:s.produced.water};});
 assert.ok(report.production.made>0&&report.production.water>16);
 await page.evaluate(()=>{const g=window.starterGame,s=g.sim;s.stock.grain=25;s.money=3000;s.build('distillery',11,12);s.paused=false;for(let i=0;i<500;i++)s.tick(.25);s.paused=true;g.lastPaint=null;});
 assert.ok(await page.evaluate(()=>window.starterGame.sim.produced.fuel>0));
 assert.equal(await page.evaluate(()=>window.starterGame.workerModels.size),1);
 for(let v=0;v<4;v++){await page.evaluate(v=>{const g=window.starterGame;g.setQuarterView(v);g.lastPaint=null;},v);await page.waitForTimeout(200);await shot('07-distillery-'+v);}
 // The visible relocation control uses the same paid action as the map.
 await page.evaluate(()=>window.starterGame.callbacks.onClick(11,12));
 await page.getByRole('button',{name:'시설 상세 정보',exact:true}).click();
 await page.getByRole('button',{name:/^이전 ·/}).click();
 const destination=await page.evaluate(()=>{const g=window.starterGame,b=g.sim.at(11,12),p=g.sim.tiles.find(t=>!g.sim.canRelocate(b.id,t.x,t.z));return {id:b.id,x:p.x,z:p.z};});
 await page.evaluate(p=>window.starterGame.callbacks.onClick(p.x,p.z),destination);
 assert.equal(await page.evaluate(p=>window.starterGame.sim.at(p.x,p.z)?.id,destination),destination.id);
 await page.keyboard.press('Escape');await shot('08-relocation');
 await page.getByRole('button',{name:'시장',exact:true}).click();
 assert.match(await page.locator('.storage-list').first().innerText(),/미니 창고/);
 await page.locator('.storage-card summary').first().click();await shot('09-stores');
 const beforeDiscard=await page.evaluate(()=>window.starterGame.sim.stock.wood);await page.getByLabel('폐기할 품목').first().selectOption('wood');await page.getByRole('button',{name:'최대 10개 폐기',exact:true}).click();assert.equal(await page.evaluate(()=>window.starterGame.sim.stock.wood),beforeDiscard);await page.getByRole('button',{name:'폐기 확인',exact:true}).click();assert.equal(await page.evaluate(()=>window.starterGame.sim.stock.wood),beforeDiscard-Math.min(10,beforeDiscard));await page.keyboard.press('Escape');

 // A saved town reloads into the same sparse scene, keeping its transport.
 report.saved=await page.evaluate(async()=>{
  const {Simulation}=await import('/src/app/game/simulation.js');const {encodeSave,decodeSave}=await import('/src/app/game/persistence.js');
  const g=window.starterGame,s=new Simulation(g.sim.region,decodeSave(encodeSave(g.sim.save())));s.paused=true;g.setSimulation(s);g.syncPeople();
  return {buildings:s.buildings.map(b=>b.type),workers:g.workerModels.size,parked:g.idleExportCarts.size,staff:g.world.children.filter(m=>m.userData.facilityStaff).length};
 });
 assert.deepEqual(report.saved,{buildings:['house','well','distillery'],workers:1,parked:1,staff:0});
 // The CPU renderer uses the same scene objects and must also show parked vehicles without facility staff.
 await page.evaluate(async()=>{
  const {SoftwareRenderer}=await import('/src/app/game/software-renderer.js');const g=window.starterGame,cpu=new SoftwareRenderer({alpha:false});
  cpu.setSize(1000,700);cpu.setPixelRatio(1);cpu.render(g.scene,g.camera);window.starterCpu=cpu.domElement.toDataURL();cpu.dispose();
 });
 await writeFile(out+'/05-canvas.png',Buffer.from((await page.evaluate(()=>window.starterCpu)).split(',')[1],'base64'));
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(400);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await shot('06-mobile');
 report.errors=errors;report.failed=failed;
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 await writeFile(out+'/results.json',JSON.stringify(report,null,2)+'\n');
 console.log('PASS starter UI, optional building order, visible fleet, export/return, residents, save, four views, Canvas and mobile');
}catch(e){await shot('failure').catch(()=>{});throw e;}finally{await browser.close();}
