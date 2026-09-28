// node tests/production-visuals-browser.mjs <playwright/index.mjs> <chrome.exe>
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
const {chromium}=await import(process.argv[2]?pathToFileURL(process.argv[2]).href:'playwright');
const browser=await chromium.launch({headless:true,...(process.argv[3]?{executablePath:process.argv[3]}:{}),args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1100,height:1000}}),errors=[],failed=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.url().includes('/assets/pixel-environment/')&&r.status()>=400)failed.push(r.url());});
const origin=process.env.TOWNGRID_URL||'http://localhost:5173',out=new URL('../docs/verification/production-v3/',import.meta.url);
await mkdir(out,{recursive:true});
const shot=name=>page.screenshot({path:fileURLToPath(new URL(name,out)),fullPage:true});
const states=()=>page.evaluate(()=>window.productionPreview.items.map(i=>({type:i.type,base:i.model.userData.frame,production:i.model.userData.production,outputs:i.model.userData.layers.filter(l=>l.name.startsWith('output-')&&l.visible).length})));
try{
 await page.goto(origin+'/production-preview.html');
 await page.waitForFunction(()=>window.productionPreview,{},{timeout:30000});
 await page.getByRole('button',{name:'동작 멈추기',exact:true}).click();
 const cases={};
 for(const state of ['empty','working','ready','working-ready','blocked','disabled']){
  await page.locator(`[data-state="${state}"]`).click();
  await page.evaluate(()=>window.productionPreview.setTime(5));
  cases[state]=await states();
  for(const row of cases[state]){
   assert.equal(row.base,0,'architecture stays fixed');
   if(!row.production)continue;
   assert.equal(row.production.working,state==='working'||state==='working-ready');
   assert.equal(row.production.ready,['ready','working-ready','disabled'].includes(state));
   assert.equal(row.outputs>0,row.production.ready);
  }
  await shot(state+'.png');
 }
 await page.locator('[data-state="working-ready"]').click();
 for(let view=0;view<4;view++){
  await page.locator('#view').selectOption(String(view));
  await shot('quarter-'+view+'.png');
 }
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await shot('mobile.png');
 await page.setViewportSize({width:1100,height:1000});
 await page.goto(origin+'/production-preview.html?renderer=canvas');
 await page.waitForFunction(()=>window.productionPreview);
 await page.getByRole('button',{name:'동작 멈추기',exact:true}).click();
 await page.locator('[data-state="working-ready"]').click();
 await page.evaluate(()=>window.productionPreview.setTime(5));
 await shot('software.png');
 assert.equal((await states()).filter(s=>s.production).every(s=>s.outputs===2),true);
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 await writeFile(new URL('results.json',out),JSON.stringify({passed:true,cases,errors,failed,note:'State and rendering assertions; screenshots are for visual review.'},null,2));
 console.log('Production visuals: six states, independent working/output, four views, mobile, WebGL and CPU passed.');
}catch(e){await shot('failure.png');console.error({errors,failed});throw e;}finally{await browser.close();}
