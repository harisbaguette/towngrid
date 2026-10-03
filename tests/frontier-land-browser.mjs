import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {WORLD_PLOTS,PLOT_INDEX} from '../src/app/game/territory.js';
import {PLOT_RESTRICTIONS,LAND_RESTRICTIONS} from '../src/app/game/settlement-access.js';
import {BIOMES} from '../src/app/game/biome-data.js';
import {layoutOf} from '../src/app/game/world-grid.js';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],failed=[];
const origin=process.env.TOWNGRID_URL||'http://localhost:5173',out='docs/verification/frontier-land-20261002';await mkdir(out,{recursive:true});
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
for(const [routePath,fixture] of [['starting','starting-map'],['campaign','wilderness-map']])await page.route('**/__test-frontier-'+routePath,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module">import * as RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;</script><script type="module" src="/tests/fixtures/'+fixture+'.tsx"></script></body></html>'}));
const art=()=>page.evaluate(async()=>{await Promise.all([...new Set([...document.querySelectorAll('.atlas-objects image')].map(el=>el.getAttribute('href')))].map(src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=resolve;i.onerror=reject;i.src=src;})));});
const shot=async name=>{await art();await page.screenshot({path:out+'/'+name+'.png'});};
const clickPlot=async p=>{const point=await page.locator('.atlas-ground').evaluate((el,c)=>{const p=new DOMPoint((c[0]+.5)*26,(c[1]+.5)*26).matrixTransform(el.getScreenCTM());return {x:p.x,y:p.y};},p.cell);await page.mouse.click(point.x,point.y);};
try{
 await page.goto(origin+'/__test-frontier-starting');await page.locator('.world-atlas').waitFor();
 assert.equal(await page.locator('[data-restricted-plot]').count(),PLOT_RESTRICTIONS.size);
 for(const kind of Object.keys(LAND_RESTRICTIONS)){
  const id=[...PLOT_RESTRICTIONS].find(([id,k])=>k===kind&&PLOT_INDEX.get(id).nation==='estern')[0];
  await page.getByRole('button',{name:'대륙 전체',exact:true}).click();await clickPlot(PLOT_INDEX.get(id));
  assert.ok(await page.locator('.start-button').isDisabled());assert.ok((await page.locator('.atlas-cell-readout').innerText()).includes(LAND_RESTRICTIONS[kind].reason));
  assert.equal(await page.locator('#start-province option[value="'+id+'"]').count(),0);
  await page.getByRole('button',{name:'주변 확대',exact:true}).click();await shot('restricted-'+kind);
 }
 const biomePlots={};
 for(const ecology of Object.keys(BIOMES)){
  await page.getByLabel('찾을 지형').selectOption(ecology);const id=await page.locator('.local-map-preview').getAttribute('data-province');
  assert.equal(layoutOf(id).ecology,ecology);biomePlots[ecology]=id;
  await page.getByRole('button',{name:'주변 확대',exact:true}).click();await shot('biome-'+ecology);
  if(['desert','volcanic'].includes(ecology))assert.ok((await page.locator('.realm-start').innerText()).includes('성장 후 개척'));
 }
 assert.equal(await page.getByLabel('찾을 지형').locator('option:not([disabled])').count(),8);
 await page.setViewportSize({width:390,height:844});await shot('mobile-biome');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await page.evaluate(()=>localStorage.getItem('first-land-v1')),null);
 await page.setViewportSize({width:1440,height:1000});await page.goto(origin+'/__test-frontier-campaign');await page.locator('.campaign-world-layout').waitFor();
 const reserved=[...PLOT_RESTRICTIONS.keys()].find(id=>PLOT_INDEX.get(id).nation==='estern');await page.getByLabel('진출할 거점 부지').selectOption(reserved);
 assert.equal(await page.locator('.expansion-offer').getAttribute('data-status'),'restricted');assert.ok(await page.getByRole('button',{name:'이 땅에 거점 세우기',exact:true}).isDisabled());
 await page.getByLabel('찾을 지형').selectOption('volcanic');await page.getByRole('button',{name:'주변 확대',exact:true}).click();await shot('volcanic-offer');
 await page.getByRole('button',{name:'이 땅을 내 영지로 확보',exact:true}).click();
 assert.equal(await page.getByLabel('세계 지도 국가').inputValue(),'player');assert.equal(await page.locator('.atlas-cell-readout').getAttribute('data-owner'),'player');
 assert.equal(await page.locator('.atlas-frontier-land').getAttribute('data-cells'),'1');await shot('claimed-volcanic');
 const wild=WORLD_PLOTS.filter(p=>p.nation===null&&p.id!==biomePlots.volcanic),a=wild.find(p=>wild.some(q=>Math.abs(p.cell[0]-q.cell[0])+Math.abs(p.cell[1]-q.cell[1])===1)),b=wild.find(q=>Math.abs(a.cell[0]-q.cell[0])+Math.abs(a.cell[1]-q.cell[1])===1);
 for(const p of [a,b]){await page.getByLabel('세계 지도 국가').selectOption('unclaimed');await page.getByLabel('진출할 거점 부지').selectOption(p.id);await page.getByRole('button',{name:'이 땅을 내 영지로 확보',exact:true}).click();}
 assert.equal(await page.locator('.atlas-frontier-land').getAttribute('data-cells'),'3');
 for(let q=0;q<4;q++){await clickPlot(b);assert.equal(await page.locator('.atlas-cell-readout').getAttribute('data-owner'),'player');await shot('joined-claims-'+q);await page.getByRole('button',{name:'세계 지도 오른쪽으로 90도 회전',exact:true}).click();}
 const before=await page.evaluate(()=>{const saved=JSON.stringify(window.wildernessCampaign.save());sessionStorage.setItem('frontier-preview-save',saved);return saved;});
 await page.reload();await page.locator('.campaign-world-layout').waitFor();assert.equal(await page.evaluate(()=>JSON.stringify(window.wildernessCampaign.save())),before);
 await page.getByLabel('세계 지도 국가').selectOption('player');await page.getByLabel('진출할 거점 부지').selectOption(b.id);assert.equal(await page.locator('.atlas-frontier-land').getAttribute('data-cells'),'3');
 await page.setViewportSize({width:390,height:844});await shot('mobile-claims');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);await writeFile(out+'/results.json',JSON.stringify({passed:true,restrictions:PLOT_RESTRICTIONS.size,biomePlots,claims:[a.id,b.id],errors,failed},null,2));console.log('Frontier land browser PASS');
}catch(e){await shot('failure').catch(()=>{});throw e;}finally{await browser.close();}
