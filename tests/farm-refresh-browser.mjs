import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const origin=process.env.TOWNGRID_URL||'http://localhost:5174';
const out=new URL('../docs/verification/farm-refresh-20260930/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const errors=[],failed=[],results=[];
try{
 const page=await browser.newPage({viewport:{width:1000,height:1050}});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.url().includes('/assets/pixel-environment/')&&r.status()>=400)failed.push(r.url());});
 const groups=(process.env.FARM_GROUPS||'farmcrops,farmfruits,ranch,farmworks,farmland,farmterrain,farmsupport').split(',');
 for(const renderer of ['webgl','canvas'])for(const group of groups){
  await page.goto(origin+'/production-preview.html?group='+group+(renderer==='canvas'?'&renderer=canvas':''));
  await page.waitForFunction(()=>window.productionPreview);
  await page.locator('#pause').click();
  await page.locator('[data-state="working-ready"]').click();
  for(let view=0;view<4;view++){
   await page.locator('#view').selectOption(String(view));
   await page.evaluate(()=>window.productionPreview.setTime(6.3));
   const rows=await page.evaluate(()=>window.productionPreview.items.map(({type,model})=>({type,view:model.userData.direction,bodyFrame:model.userData.frame,
    layers:model.userData.layers.filter(l=>/^(animal|bee)-/.test(l.name)).map(l=>({visible:l.visible,image:!!l.userData.image,frame:l.userData.frame,action:l.userData.action})),
   })));
   assert.ok(rows.every(r=>r.view===view&&r.bodyFrame===0));
   if(group==='ranch')assert.ok(rows.every(r=>r.layers.length&&r.layers.every(l=>l.image&&l.visible)));
   await page.screenshot({path:fileURLToPath(new URL(`${group}-${renderer}-${view}.png`,out)),fullPage:true});
   results.push({renderer,group,view,rows});
  }
  if(group==='farmcrops'||group==='farmfruits'){
   await page.locator('#view').selectOption('0');
   const pictures=[];
   for(let stage=0;stage<4;stage++){
    await page.evaluate(t=>window.productionPreview.setTime(t),stage*2+.1);
    const crops=await page.evaluate(()=>window.productionPreview.items.map(({type,model})=>({type,crops:model.userData.layers.filter(l=>l.name.startsWith('crop-')&&l.visible).map(l=>({frame:l.userData.frame,image:!!l.userData.image}))})));
    assert.ok(crops.every(r=>r.crops.length===4&&r.crops.every(c=>c.frame===stage&&c.image)),renderer+' growth stage '+stage);
    const picture=await page.screenshot({path:fileURLToPath(new URL(`${group}-${renderer}-stage-${stage}.png`,out)),fullPage:true});
    pictures.push(picture.toString('base64'));
   }
   assert.equal(new Set(pictures).size,4,'four actually rendered growth stages');
  }
  for(const state of ['empty','working','ready','working-ready','blocked','disabled']){
   await page.locator(`[data-state="${state}"]`).click();
   await page.evaluate(()=>window.productionPreview.setTime(6.3));
   const stocks=await page.evaluate(()=>window.productionPreview.items.map(({type,model})=>({type,service:!!model.userData.production?.service,
    stock:model.userData.layers.filter(l=>l.name.startsWith('output-')&&l.visible).length,bodyFrame:model.userData.frame})));
   assert.ok(stocks.every(r=>r.bodyFrame===0),'production must not animate the fixed body');
   if(['empty','working','blocked'].includes(state)||group==='farmterrain')assert.ok(stocks.every(r=>r.stock===0),'no fictitious stock in '+state);
  }
  if(group==='ranch'){
   await page.locator('[data-state="working-ready"]').click();
   await page.locator('#view').selectOption('0');
   const canvas=page.locator('article canvas').first();
   const poses=[];
   for(const t of [.2,.45,3.5,4.2]){
    await page.evaluate(t=>window.productionPreview.setTime(t),t);
    poses.push((await canvas.screenshot()).toString('base64'));
   }
   assert.equal(new Set(poses).size,4,renderer+' actual rendered gait/feeding frames differ');
   const paused=await canvas.screenshot();
   await page.waitForTimeout(300);
   assert.deepEqual(await canvas.screenshot(),paused,renderer+' paused frame remains identical');
   await page.locator('[data-state="disabled"]').click();
   assert.ok(await page.evaluate(()=>window.productionPreview.items.every(({type,model})=>model.userData.layers.filter(l=>/^(animal|bee)-/.test(l.name)).every(l=>type==='apiary'?!l.visible:l.visible&&l.userData.frame===0))));
   await page.screenshot({path:fileURLToPath(new URL('ranch-'+renderer+'-disabled.png',out)),fullPage:true});
  }
 }
 await page.goto(origin+'/art-preview.html');
 await page.waitForFunction(()=>window.artPreview);
 await page.locator('#category').selectOption('resources');
 await page.waitForFunction(()=>[...document.querySelectorAll('main img')].length>=71&&[...document.querySelectorAll('main img')].every(i=>i.complete&&i.naturalWidth===96));
 await page.screenshot({path:fileURLToPath(new URL('resource-icons.png',out)),fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.goto(origin+'/production-preview.html?group=ranch');await page.waitForFunction(()=>window.productionPreview);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.equal(await page.evaluate(()=>localStorage.length),0,'preview does not save a game');
 await page.screenshot({path:fileURLToPath(new URL('ranch-mobile.png',out)),fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 await writeFile(new URL('results.json',out),JSON.stringify({errors,failed,results},null,2));
 console.log('Farm refresh browser: '+groups.join(', ')+', both renderers, four views, growth stages, six states, resource icons, animation, pause, disable, mobile and no save passed.');
}finally{await browser.close();}
