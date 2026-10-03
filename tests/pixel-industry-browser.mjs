// node tests/pixel-industry-browser.mjs <playwright/index.mjs> <chrome.exe>
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {INDUSTRY_GROUPS} from '../src/app/game/pixel-industry-data.js';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[],failed=[],results=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/pixel-environment/')&&r.status()>=400)failed.push(r.url());});
const origin=process.env.TOWNGRID_URL||'http://localhost:5173',out=new URL('../docs/verification/industry-v4/',import.meta.url);
await mkdir(out,{recursive:true});
const shot=name=>page.screenshot({path:fileURLToPath(new URL(name+'.png',out)),fullPage:true});
try{
 for(const renderer of ['webgl','canvas'])for(const group of Object.keys(INDUSTRY_GROUPS)){
  await page.goto(origin+'/production-preview.html?group='+group+(renderer==='canvas'?'&renderer=canvas':''));
  await page.waitForFunction(()=>window.productionPreview);await page.locator('#pause').click();
  const summary={renderer,group,states:[]};
  for(const state of ['empty','working','ready','working-ready','blocked','disabled']){
   await page.locator('[data-state="'+state+'"]').click();await page.evaluate(()=>window.productionPreview.setTime(5));
   const rows=await page.evaluate(()=>window.productionPreview.items.map(i=>({type:i.type,frame:i.model.userData.frame,state:i.model.userData.production,stock:i.article.querySelector('.stock').textContent,outputs:i.model.userData.layers.filter(l=>l.name.startsWith('output-')&&l.visible).length})));
   for(const row of rows){
    assert.equal(row.frame,0);const p=row.state;if(!p)continue;
    assert.equal(p.working,state==='working'||state==='working-ready',row.type);
    if(p.service){
     assert.equal(p.active,state==='ready'||state==='working-ready');assert.equal(row.outputs,0);assert.match(row.stock,/초$/);
    }else{assert.equal(row.outputs>0,['ready','working-ready','disabled'].includes(state));}
   }
   summary.states.push({state,rows});
  }
  await page.locator('[data-state="working-ready"]').click();
  for(let view=0;view<4;view++){
   await page.locator('#view').selectOption(String(view));
   assert.ok(await page.evaluate(view=>window.productionPreview.items.every(i=>i.model.userData.direction===view),view));
  }
  await page.locator('#view').selectOption('0');
  if(renderer==='canvas')await shot(group+'-software');
  results.push(summary);
 }
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await shot('mobile');
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(origin);
 await page.locator('canvas[role="application"]').waitFor({state:'attached',timeout:120000});
 await page.getByRole('button',{name:'화면을 눌러 시작',exact:true}).click();
 await page.getByRole('button',{name:'산업도시 둘러보기',exact:true}).waitFor({timeout:120000});
 await page.evaluate(async()=>{
  const urls=performance.getEntriesByType('resource').map(e=>e.name).filter(url=>/\/app\/game\/scene\.js(?:\?|$)/.test(url));
  for(const url of new Set([...urls,'/src/app/game/scene.js'])){
   const {GameScene}=await import(url),original=GameScene.prototype.setSimulation;
   GameScene.prototype.setSimulation=function(sim){window.industryScene=this;return original.call(this,sim);};
  }
 });
 await page.getByRole('button',{name:'산업도시 둘러보기',exact:true}).click();
 await page.waitForFunction(()=>window.industryScene?.sim.time>1,{},{timeout:120000});
 await page.getByRole('button',{name:'일시정지',exact:true}).click();
 const live=await page.evaluate(async()=>{
  const {INDUSTRY_BUILDINGS}=await import('/src/app/game/pixel-industry-data.js');
  const game=window.industryScene,before=JSON.stringify(game.sim.save()),ghosts=[];
  for(let view=0;view<4;view++){
   game.setQuarterView(view);
   for(const type of INDUSTRY_BUILDINGS){game.setMode(type);ghosts.push({type,view,actual:game.ghost.userData.direction,pixel:game.ghost.userData.pixelEnvironment});}
  }
  game.setMode(null);game.resetCamera();
  return {ghosts,unchanged:before===JSON.stringify(game.sim.save()),buildings:[...game.models.values()].map(m=>({type:m.userData.building.type,pixel:!!m.userData.pixelEnvironment})),saved:Object.keys(localStorage).filter(k=>/save|backup|recovery/.test(k))};
 });
 assert.ok(live.unchanged);assert.ok(live.ghosts.every(g=>g.pixel&&g.actual===g.view));assert.deepEqual(live.saved,[]);
 assert.ok(live.buildings.filter(b=>Object.values(INDUSTRY_GROUPS).flat().includes(b.type)).every(b=>b.pixel));
 for(let view=0;view<4;view++){
  await page.evaluate(view=>window.industryScene.setQuarterView(view),view);
  await page.waitForFunction(view=>[...window.industryScene.models.values()].every(m=>!m.userData.pixelEnvironment||m.userData.direction===view),view);
  await shot('city-'+view);
 }
 // Marker diet (B13): supply badges of running service buildings show with 시설 이름 표시 on.
 await page.getByRole('button',{name:'건설 목록 열기'}).click();await page.getByRole('button',{name:'시설 이름 표시'}).click();await page.getByRole('button',{name:'건설 목록 닫기'}).click();await page.waitForTimeout(500);
 const service=await page.locator('.facility-marker[data-production="supplying"]').first();
 assert.ok(await service.count());assert.match(await service.locator('.output-count').textContent(),/초$/);
 await service.click();await page.locator('.facility-card').waitFor();assert.match(await page.locator('.facility-card .recipe').textContent(),/초/);
 await shot('supply-panel');
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 await writeFile(new URL('results.json',out),JSON.stringify({passed:true,results,live,errors,failed},null,2));
 console.log('35 buildings: six states, four views, WebGL/CPU/mobile, 140 live ghosts, industrial city and supply UI passed.');
}catch(e){await shot('failure');console.error({errors,failed});throw e;}finally{await browser.close();}
