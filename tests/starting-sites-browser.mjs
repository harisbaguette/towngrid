import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {NATIONS} from '../src/app/game/world.js';
import {PROVINCES} from '../src/app/game/territory.js';
import {WORLD_CELLS,layoutOf} from '../src/app/game/world-grid.js';
import {defaultStartingProvince} from '../src/app/game/starting-sites.js';
import {decodeSave} from '../src/app/game/persistence.js';

const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
await context.addInitScript(()=>{window.WebSocket=class {addEventListener(){} removeEventListener(){} send(){} close(){}};});
const mapOnly=process.argv.includes('--map-only');
const page=await context.newPage(),errors=[],consoleErrors=[],out='docs/verification/starting-sites';
await mkdir(out,{recursive:true});page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
const shot=name=>page.screenshot({path:out+'/'+name+'.png'});
const clickCell=async cell=>{
 await page.getByRole('button',{name:'대륙 전체',exact:true}).click();
 const point=await page.locator('.world-atlas').evaluate((el,[cx,cz])=>{
  const p=new DOMPoint((cx+.5)*26,(cz+.5)*26).matrixTransform(el.getScreenCTM());return {x:p.x,y:p.y};
 },cell);
 await page.mouse.click(point.x,point.y);
};
try{
 const origin=process.env.TOWNGRID_URL||'http://localhost:5173';
 if(mapOnly){
  await page.route('**/__test-starting-map',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module">import * as RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;</script><script type="module" src="/tests/fixtures/starting-map.tsx"></script></body></html>`}));
  await page.goto(origin+'/__test-starting-map',{waitUntil:'domcontentloaded',timeout:120000});
 }else{
 await page.goto(origin,{waitUntil:'domcontentloaded',timeout:120000});
 for(let i=0;i<60&&!await page.getByRole('button',{name:'새 게임',exact:true}).count();i++){
  if(await page.getByText('게임 화면을 불러오지 못했습니다. 다시 열기를 눌러주세요.',{exact:true}).count())throw new Error('Game scene initialization failed before the world map opened');
  await page.getByRole('button',{name:'화면을 눌러 시작',exact:true}).click({timeout:2000}).catch(()=>{});await page.waitForTimeout(400);
 }
 await page.getByRole('button',{name:'새 게임',exact:true}).click({timeout:120000});
 }
 await page.locator('.realm-card .start-button:not(:disabled)').waitFor({timeout:mapOnly?20000:120000});
 console.log('World ready');
 for(const [nation,n] of Object.entries(NATIONS)){
  await page.locator('#realm').selectOption(nation);
  if(!n.playable){assert.ok(await page.locator('.start-button').isDisabled());continue;}
  const p=defaultStartingProvince(nation);
  assert.equal(await page.locator('#start-province').inputValue(),p.id);
  assert.equal(await page.locator('#start-province option:not([disabled])').count(),5);
  assert.ok((await page.locator('.realm-start small').innerText()).includes(p.name));
 }
 await page.locator('#realm').selectOption('estern');
 await page.locator('.start-button:not(:disabled)').waitFor({timeout:120000});
 await shot('01-default-outskirts');
 await clickCell(PROVINCES.find(p=>p.id==='estern-0').cell);
 assert.ok(await page.locator('.start-button').isDisabled(),'Capital cannot start');
 assert.ok((await page.locator('.atlas-cell-readout').innerText()).includes('시작 불가'));
 await shot('02-capital-blocked');
 for(const terrain of ['coast','mountain','river','lake','canal','stream']){
  const tile=WORLD_CELLS.find(c=>c.terrain===terrain);
  await clickCell([tile.cx,tile.cz]);
  assert.ok(await page.locator('.start-button').isDisabled(),terrain+' cannot start');
 }
 const chosen=PROVINCES.find(p=>p.id==='estern-2');
 await clickCell(chosen.cell);
 assert.equal(await page.locator('#start-province').inputValue(),chosen.id,'Map click selects the actual starting province');
 await page.locator('.start-button:not(:disabled)').waitFor({timeout:120000});
 await page.getByRole('button',{name:'주변 확대',exact:true}).click();
 await shot('03-chosen-province');
 await page.setViewportSize({width:390,height:844});
 await page.locator('#start-province').selectOption('estern-4');
 assert.ok((await page.locator('.atlas-cell-readout').innerText()).includes(PROVINCES.find(p=>p.id==='estern-4').name));
 await page.locator('#start-province').selectOption(chosen.id);
 await page.locator('.start-button').scrollIntoViewIfNeeded();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await shot('04-mobile-start');
 await page.locator('.start-button').click();
 await page.locator(mapOnly?'output[data-start-province]':'.is-playing').waitFor({timeout:120000});
 await page.waitForFunction(()=>!!localStorage.getItem('first-land-v1'));
 if(!mapOnly)await page.getByRole('button',{name:'일시정지',exact:true}).click();
 const saved=decodeSave(await page.evaluate(()=>localStorage.getItem('first-land-v1')));
 assert.equal(saved.sites[0].provinceId,chosen.id);
 assert.deepEqual(saved.sites[0].simulation.land,layoutOf(chosen.id));
 if(!mapOnly){assert.ok((await page.locator('.world-access').innerText()).includes(chosen.name));await page.keyboard.press('Escape');await page.setViewportSize({width:1440,height:900});await shot('05-actual-village');}
 assert.deepEqual(errors,[]);
 await writeFile(out+(mapOnly?'/map-browser-results.json':'/browser-results.json'),JSON.stringify({passed:true,scope:mapOnly?'isolated WorldMap and Campaign creation; game scene excluded':'full game',default:'estern-5',selected:chosen.id,land:saved.sites[0].simulation.land,checked:['30 country choices','five noncapital regions per playable country','capital and six water/mountain types disabled','map and dropdown sync','mobile start','saved location and terrain'],errors},null,2));
 console.log('PASS ('+(mapOnly?'isolated map':'full game')+'): noncapital selection, blocked terrain, mobile start and saved location');
}catch(e){const scope=mapOnly?'map':'game';await shot(scope+'-failure').catch(()=>{});await writeFile(out+'/'+scope+'-failure.json',JSON.stringify({error:String(e),errors,consoleErrors},null,2));throw e;}
finally{await browser.close();}
