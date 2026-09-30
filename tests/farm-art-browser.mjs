// Browser capture of the 24 expansion facilities (docs/EXPANSION_20260929.md,
// sections 2 and 6) and their 44 goods. Usage:
//   node tests/farm-art-browser.mjs <playwright/index.mjs> <chrome.exe>
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {FARM_GROUPS,FARM_BUILDINGS} from '../src/app/game/pixel-farm-data.js';
import {FARM_GOODS_ORDER,FARM_GOODS2_ORDER} from '../src/app/game/pixel-farm-sockets.js';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const origin=process.env.TOWNGRID_URL||'http://localhost:5173',out=new URL('../docs/verification/expansion-art-20260930/',import.meta.url);
await mkdir(out,{recursive:true});
const errors=[],failed=[],results=[];
const shot=(page,name,options={})=>page.screenshot({path:fileURLToPath(new URL(name+'.png',out)),...options});
try{
 const page=await browser.newPage({viewport:{width:1100,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('response',r=>{if(r.url().includes('/assets/pixel-environment/')&&r.status()>=400)failed.push(r.url());});
 for(const renderer of ['webgl','canvas'])for(const [group,types] of Object.entries(FARM_GROUPS)){
  await page.goto(origin+'/production-preview.html?group='+group+(renderer==='canvas'?'&renderer=canvas':''));
  await page.waitForFunction(()=>window.productionPreview);await page.locator('#pause').click();
  await page.locator('[data-state="working-ready"]').click();
  for(let view=0;view<4;view++){
   await page.locator('#view').selectOption(String(view));await page.evaluate(()=>window.productionPreview.setTime(7.4));
   const rows=await page.evaluate(()=>window.productionPreview.items.map(i=>({type:i.type,direction:i.model.userData.direction,image:!!i.model.userData.image,
    crops:i.model.userData.layers.filter(l=>l.name.startsWith('crop-')&&l.visible).map(l=>l.userData.frame),
    outputs:i.model.userData.layers.filter(l=>l.name.startsWith('output-')&&l.visible).length,phase:i.model.userData.production?.phase??null})));
   assert.deepEqual(rows.map(r=>r.type),types);
   for(const row of rows){assert.equal(row.direction,view,row.type);assert.ok(row.image,row.type);}
   results.push({renderer,group,view,rows});
   if(renderer==='webgl'||view===0)await shot(page,`${group}-${renderer}-${['se','ne','nw','sw'][view]}`,{fullPage:true});
  }
  // Early growth stage for the fields: the empty plot and small seedlings.
  if(group.startsWith('farm')&&renderer==='webgl'){
   await page.locator('#view').selectOption('0');await page.locator('[data-state="working"]').click();await page.evaluate(()=>window.productionPreview.setTime(1.2));
   await shot(page,`${group}-webgl-early`,{fullPage:true});
  }
 }
 // UI icons: the 44 expansion goods next to existing ones, as the game shows them.
 await page.goto(origin+'/art-preview.html');await page.waitForFunction(()=>window.artPreview,{},{timeout:60000});
 await page.locator('#category').selectOption('resources');await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
 const icons=await page.evaluate(()=>[...document.querySelectorAll('#cards img')].map(i=>i.getAttribute('src')));
 for(const id of [...FARM_GOODS_ORDER,...FARM_GOODS2_ORDER])assert.ok(icons.includes('/assets/pixel-environment/resources/'+id+'.png'),id);
 await shot(page,'resources-ui',{fullPage:true});
 // Every facility in the game list, including damage layers at 25% health.
 await page.locator('#category').selectOption('buildings');
 const count=await page.evaluate(()=>window.artPreview.entries.length);
 await page.evaluate(()=>{const h=document.getElementById('health');h.value='25';h.dispatchEvent(new Event('change'));});
const damaged=await page.evaluate(ids=>window.artPreview.entries.filter(e=>ids.includes(e.id)).filter(e=>e.model.userData.layers.some(l=>/damage|crack/.test(l.name)&&l.visible)).map(e=>e.id),FARM_BUILDINGS);
 await page.evaluate(ids=>{const cards=[...document.querySelectorAll('#cards .card')];window.artPreview.entries.forEach((e,i)=>{cards[i].hidden=!ids.includes(e.id);});},FARM_BUILDINGS);
 await shot(page,'damage-25-new-facilities',{fullPage:true});
 results.push({buildings:count,damaged:damaged.length});
 assert.equal(damaged.length,FARM_BUILDINGS.length,'damage layer on every new facility');assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 await writeFile(new URL('browser-results.json',out),JSON.stringify({passed:true,buildings:count,damaged:damaged.length,results,errors,failed},null,2)+'\n');
 console.log(`Expansion art: ${FARM_BUILDINGS.length} facilities × 4 views (WebGL/CPU), ${FARM_GOODS_ORDER.length+FARM_GOODS2_ORDER.length} UI icons, ${count} buildings in the art list, ${damaged.length}/${FARM_BUILDINGS.length} new facilities with damage layers.`);
}finally{await browser.close();}
