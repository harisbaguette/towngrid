import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const output='docs/verification/ui-20260929';
await mkdir(output,{recursive:true});
const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
await context.addInitScript(()=>{
 // Isolated inspection must not reset to the title when another editor triggers HMR.
 window.WebSocket=class {addEventListener(){} removeEventListener(){} send(){} close(){}};
});
const page=await context.newPage(),errors=[],results={};
page.on('pageerror',e=>errors.push(e.message));
const shot=async name=>{await page.waitForTimeout(250);await page.screenshot({path:output+'/'+name+'.png'});};
const hit=async selector=>page.locator(selector).evaluateAll(elements=>elements.map(el=>{
 const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,top=document.elementFromPoint(x,y);
 return {label:el.getAttribute('aria-label')||el.textContent,visible:r.width>0&&r.height>0,reachable:!!top&&(el===top||el.contains(top)),rect:[r.x,r.y,r.width,r.height]};
}));
try{
 await page.goto(process.env.TOWNGRID_URL||'http://localhost:5173',{waitUntil:'domcontentloaded',timeout:120000});
 console.log('page loaded');
 await page.getByRole('button',{name:'화면을 눌러 시작',exact:true}).waitFor();
 for(let i=0;i<50&&!await page.getByRole('button',{name:'새 게임',exact:true}).count();i++){
  await page.getByRole('button',{name:'화면을 눌러 시작',exact:true}).click().catch(()=>{});await page.waitForTimeout(400);
 }
 await page.getByRole('button',{name:'새 게임',exact:true}).click({timeout:120000});
 console.log('world opened');
 await page.locator('.world-atlas').waitFor();
 await page.locator('.realm-card .start-button:not(:disabled)').waitFor({timeout:120000});
 console.log('world ready');
 await shot('01-world-desktop');
 results.atlas=await page.evaluate(()=>({nodes:document.querySelectorAll('.world-atlas *').length,terrainNodes:document.querySelectorAll('.world-terrain *').length,view:document.querySelector('.world-atlas').getAttribute('viewBox')}));
 await page.getByRole('button',{name:'선택 국가로 이동',exact:true}).click();
 await shot('02-world-region');
 await page.getByRole('button',{name:'주변 확대',exact:true}).click();
 await shot('03-world-site');
 assert.equal(await page.locator('.atlas-shell').getAttribute('data-detail'),'site');
 await page.getByRole('button',{name:'무역로 표시',exact:true}).click();
 assert.ok(await page.locator('.trade-network').count()>0);
 await page.getByRole('button',{name:'무역로 표시',exact:true}).click();
 assert.equal(await page.locator('.trade-network').count(),0);
 const mapBox=await page.locator('.world-atlas').boundingBox();
 await page.mouse.move(mapBox.x+mapBox.width/2,mapBox.y+mapBox.height/2);
 const beforeWheel=await page.locator('.world-atlas').getAttribute('viewBox');
 await page.mouse.wheel(0,100);
 await page.waitForTimeout(150);
 assert.notEqual(await page.locator('.world-atlas').getAttribute('viewBox'),beforeWheel,'Wheel zooms map');
 const beforeDrag=await page.locator('.world-atlas').getAttribute('viewBox');
 await page.mouse.down();await page.mouse.move(mapBox.x+mapBox.width/2+65,mapBox.y+mapBox.height/2+30,{steps:6});await page.mouse.up();
 assert.notEqual(await page.locator('.world-atlas').getAttribute('viewBox'),beforeDrag,'Drag moves map');
 await page.locator('.world-atlas').focus();
 const old=await page.locator('.atlas-cell-readout').innerText();
 await page.keyboard.press('ArrowRight');
 assert.notEqual(await page.locator('.atlas-cell-readout').innerText(),old);
 await page.keyboard.press('Home');
 await page.locator('#realm').selectOption('nezar');
 assert.equal(await page.locator('.realm-card .start-button').isDisabled(),true);
 await page.locator('#realm').selectOption('estern');
 assert.ok((await page.locator('.alliance-residents img').nth(1).getAttribute('src')).includes('/bron/'));
 await page.setViewportSize({width:390,height:844});
 await shot('04-world-phone');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.setViewportSize({width:1440,height:900});
 await page.locator('.world-test-options summary').click();
 await page.getByRole('button',{name:'초반 마을 테스트',exact:true}).click();
 await page.locator('.is-playing').waitFor({timeout:120000});
 await page.waitForTimeout(6500);
 await page.getByRole('button',{name:'일시정지',exact:true}).click();
 await shot('05-game-desktop');
 await page.getByRole('button',{name:'건설 목록 열기',exact:true}).click();
 await shot('06-build-desktop');
 await page.getByRole('button',{name:'건설 목록 닫기',exact:true}).click();
 await page.getByRole('button',{name:'영토 확장',exact:true}).click();
 assert.ok((await page.locator('.placement-hint').innerText()).includes('16칸'));
 await shot('07-expand-desktop');
 await page.getByRole('button',{name:'배치 취소',exact:true}).click();
 await page.getByRole('button',{name:'시장',exact:true}).click();
 await shot('08-market');
 await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click();
 await page.getByRole('button',{name:'세계 지도',exact:true}).click();
 await page.locator('.campaign-tabs .world-atlas').waitFor();
 await shot('10-campaign');
 await page.getByRole('button',{name:'선택 국가로 이동',exact:true}).click();
 await page.getByRole('button',{name:'무역로 표시',exact:true}).click();
 await shot('11-campaign-routes');
 await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click();
 await page.getByRole('button',{name:'주민',exact:true}).click();
 await shot('09-residents');
 await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click();
 for(const viewport of [{width:1440,height:900},{width:1024,height:768},{width:390,height:844},{width:360,height:740},{width:844,height:390}]){
  await page.setViewportSize(viewport);
  await page.waitForTimeout(250);
  const key=viewport.width+'x'+viewport.height;
  results[key]=await hit('.town-actions button,.camera-controls button,.world-access,.time-controls button,.header-actions button,.objective-card,.map-edges-toggle');
  await shot('game-'+key);
  await page.getByRole('button',{name:'건설 목록 열기',exact:true}).click();
  results[key+'-build']=await hit('.town-actions button,.camera-controls button');
  for(const tab of await page.locator('.dock-header [role=tab]').all()){
   await tab.scrollIntoViewIfNeeded();
   const reachable=await tab.evaluate(el=>{const r=el.getBoundingClientRect();const top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return top===el||el.contains(top);});
   assert.ok(reachable,key+' category '+await tab.innerText());
  }
  await page.locator('.dock-header [role=tab]').first().scrollIntoViewIfNeeded();
  await shot('build-'+key);
  await page.getByRole('button',{name:'건설 목록 닫기',exact:true}).click();
 }
 results.errors=errors;
 await writeFile(output+'/browser-results.json',JSON.stringify(results,null,2));
 assert.deepEqual(errors,[]);
 assert.deepEqual(Object.entries(results).filter(([,r])=>Array.isArray(r)).flatMap(([size,r])=>r.filter(x=>x.visible&&!x.reachable).map(x=>({size,label:x.label}))),[],'Visible HUD controls can be clicked');
 console.log(JSON.stringify({atlas:results.atlas,blocked:Object.entries(results).filter(([,r])=>Array.isArray(r)).flatMap(([size,r])=>r.filter(x=>x.visible&&!x.reachable).map(x=>({size,label:x.label}))),errors},null,2));
}catch(e){await shot('failure');await writeFile(output+'/failure.json',JSON.stringify({error:String(e),errors,body:(await page.locator('body').innerText()).slice(0,5000)},null,2));throw e;}
finally{await browser.close();}
