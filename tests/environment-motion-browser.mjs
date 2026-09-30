import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {BUILDINGS} from '../src/app/game/simulation.js';
const buildingCount=Object.values(BUILDINGS).filter(b=>!b.tile).length;
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const folder='docs/verification/environment-motion-20260929';await mkdir(folder,{recursive:true});
const report={errors:[],failed:[],modes:[]},origin=process.env.TOWNGRID_URL||'http://localhost:5173';
try{
 for(const mode of ['webgl','canvas']){
  const page=await browser.newPage({viewport:{width:1280,height:980}});
  await page.routeWebSocket('**/*',()=>{});
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',e=>{if(e.type()==='error')report.errors.push(e.text());});
  page.on('response',r=>{if(r.status()>=400&&r.url().includes('/assets/'))report.failed.push(r.url());});
  await page.goto(origin+'/art-preview.html'+(mode==='canvas'?'?renderer=canvas':''));
  await page.waitForFunction(()=>window.artPreview);
  await page.locator('#motion').check();
  for(let view=0;view<4;view++){
   const frames=[];
   for(const time of [0,.375,.75]){
    await page.evaluate(t=>window.artPreview.setTime(t),time);
    frames.push(await page.evaluate(()=>window.artPreview.entries.map(e=>({id:e.id,frame:e.model.userData.frame,direction:e.model.userData.direction}))));
    await page.screenshot({path:`${folder}/vehicles-${mode}-${view}-${time}.png`,fullPage:true});
   }
   assert.ok(frames[0].every(e=>e.direction===view));assert.notEqual(frames[0][0].frame,frames[1][0].frame);
   await page.locator('#right').click();
  }
  await page.locator('#motion').uncheck();
  await page.locator('#category').selectOption('handling');
  for(let view=0;view<4;view++){
   for(const time of [0,.5,1]){await page.evaluate(t=>window.artPreview.setTime(t),time);await page.screenshot({path:`${folder}/cranes-${mode}-${view}-${time}.png`,fullPage:true});}
   await page.locator('#right').click();
  }
  await page.locator('#category').selectOption('damage');
  for(const health of ['100','25','0']){
   await page.locator('#health').selectOption(health);
   await page.evaluate(()=>window.artPreview.setTime(4));
   await page.screenshot({path:`${folder}/damage-${mode}-${health}.png`,fullPage:true});
  }
  await page.locator('#repair').click();await page.evaluate(()=>window.artPreview.setTime(4.6));
  assert.ok(await page.evaluate(()=>window.artPreview.entries.every(e=>e.model.userData.damageAmount>0&&e.model.userData.damageAmount<1)));
  await page.screenshot({path:`${folder}/repair-${mode}.png`,fullPage:true});
  await page.evaluate(()=>window.artPreview.setTime(6));
  assert.ok(await page.evaluate(()=>window.artPreview.entries.every(e=>e.model.userData.sprite.visible)));
  await page.locator('#category').selectOption('buildings');assert.equal(await page.locator('.card').count(),buildingCount);
  await page.locator('#health').selectOption('0');await page.screenshot({path:`${folder}/all-damaged-${mode}.png`,fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`${folder}/mobile-${mode}.png`});
  report.modes.push({mode,facilities:buildingCount,vehicles:10,views:4,cranes:3,mobile:true});await page.close();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.failed,[]);
 await writeFile(folder+'/browser.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}finally{await browser.close();}
