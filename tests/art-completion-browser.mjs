import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {BUILDINGS} from '../src/app/game/simulation.js';
import {RESOURCE_ICONS} from '../src/app/game/resource-art.js';
const buildingCount=Object.values(BUILDINGS).filter(b=>!b.tile).length,iconCount=Object.keys(RESOURCE_ICONS).length;
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const folder=new URL('../docs/verification/environment-motion-20260929/coverage/',import.meta.url);await mkdir(folder,{recursive:true});
const origin=process.env.TOWNGRID_URL||'http://localhost:5173',results=[],errors=[],failed=[];
try{
 for(const mode of ['webgl','canvas']){
  const page=await browser.newPage({viewport:{width:1280,height:960}});
  await page.routeWebSocket('**/*',()=>{});
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/pixel-environment/')&&r.status()>=400)failed.push(r.url());});
  await page.goto(origin+'/art-preview.html'+(mode==='canvas'?'?renderer=canvas':''));await page.waitForFunction(()=>window.artPreview,{},{timeout:60000});
  assert.equal(await page.locator('.card').count(),10);assert.equal(await page.evaluate(()=>!!window.artPreview.renderer.isSoftware),mode==='canvas');
  for(let view=0;view<4;view++){
   const rows=await page.evaluate(()=>window.artPreview.entries.map(e=>({id:e.id,direction:e.model.userData.direction,cargo:e.model.userData.cargo.visible,frame:e.model.userData.cargo.userData.frame,image:!!e.model.userData.image})));
   for(const row of rows){assert.equal(row.direction,view);assert.equal(row.image,true);assert.equal(row.cargo,!['plane','airship'].includes(row.id));}
   await page.screenshot({path:fileURLToPath(new URL(`fleet-${mode}-${view}.png`,folder)),fullPage:true});
   await page.locator('#right').click();
  }
  await page.locator('#loaded').uncheck();assert.ok(await page.evaluate(()=>window.artPreview.entries.every(e=>!e.model.userData.cargo.visible)));
  await page.screenshot({path:fileURLToPath(new URL(`empty-${mode}.png`,folder)),fullPage:true});
  await page.locator('#category').selectOption('damage');
  for(const health of ['100','65','25','0']){
   await page.locator('#health').selectOption(health);
   assert.ok(await page.evaluate(health=>window.artPreview.entries.every(e=>e.model.userData.layers.find(l=>l.name==='damage-rubble').visible===(health==='0')),health));
   await page.screenshot({path:fileURLToPath(new URL(`damage-${mode}-${health}.png`,folder)),fullPage:true});
  }
  await page.locator('#repair').click();assert.ok(await page.evaluate(()=>window.artPreview.entries.every(e=>!e.model.userData.layers.find(l=>l.name==='repair-needed').visible)));
  await page.locator('#category').selectOption('buildings');assert.equal(await page.locator('.card').count(),buildingCount);
  await page.screenshot({path:fileURLToPath(new URL(`buildings-${mode}.png`,folder)),fullPage:true});
  await page.locator('#category').selectOption('resources');assert.equal(await page.locator('.card img').count(),iconCount);
  await page.waitForFunction(()=>[...document.querySelectorAll('.card img')].every(i=>i.complete&&i.naturalWidth>0));
  await page.screenshot({path:fileURLToPath(new URL(`resources-${mode}.png`,folder)),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.locator('#category').selectOption('vehicles');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:fileURLToPath(new URL(`mobile-${mode}.png`,folder)),fullPage:true});
  assert.equal(await page.evaluate(()=>localStorage.length),0,'preview must not save');
  results.push({mode,vehicles:10,views:4,buildings:buildingCount,icons:iconCount,mobile:true,noSave:true});await page.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 await writeFile(new URL('results.json',folder),JSON.stringify({results,errors,failed},null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}
