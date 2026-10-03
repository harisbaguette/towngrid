import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {startingProvinces} from '../src/app/game/starting-sites.js';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],failed=[];
const origin=process.env.TOWNGRID_URL||'http://localhost:5173',out='docs/verification/atlas-isometric-20261002';await mkdir(out,{recursive:true});
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().includes('/assets/'))failed.push(r.url());});
await page.route('**/__test-isometric-map',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module">import * as RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;</script><script type="module" src="/tests/fixtures/starting-map.tsx"></script></body></html>'}));
const waitArt=()=>page.evaluate(async()=>{await Promise.all([...new Set([...document.querySelectorAll('.atlas-objects image')].map(el=>el.getAttribute('href')))].map(src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=resolve;img.onerror=()=>reject(new Error(src));img.src=src;})));});
const shot=name=>page.screenshot({path:out+'/'+name+'.png'});
try{
 await page.goto(origin+'/__test-isometric-map');await page.locator('.world-atlas').waitFor();await waitArt();
 const before=await page.evaluate(()=>localStorage.getItem('first-land-v1')),start=await page.locator('#start-province').inputValue();
 for(let q=0;q<4;q++){
  assert.equal(await page.locator('.world-atlas').getAttribute('data-quarter'),String(q));
  assert.equal(await page.locator('.country-borders [data-country]').count(),14);
  assert.equal(await page.locator('[data-blocked-terrain]').count(),523);
  const objects=await page.locator('.atlas-objects>g').evaluateAll(nodes=>nodes.map(n=>({depth:+n.dataset.depth,href:n.querySelector('image').getAttribute('href')})));
  assert.ok(objects.every((p,i)=>!i||p.depth>=objects[i-1].depth),'Sprites draw from back to front');
  assert.ok(objects.every(p=>p.href.endsWith('-'+q+'.png')));
  await shot('world-'+q);await page.getByRole('button',{name:'세계 지도 오른쪽으로 90도 회전',exact:true}).click();await waitArt();
 }
 assert.equal(await page.locator('#start-province').inputValue(),start);
 const target=startingProvinces('estern').find(p=>p.id==='estern-3');
 await page.locator('#start-province').selectOption(target.id);await page.getByRole('button',{name:'주변 확대',exact:true}).click();
 for(let q=0;q<4;q++){
  const point=await page.locator('.atlas-ground').evaluate((el,cell)=>{const p=new DOMPoint((cell[0]+.5)*26,(cell[1]+.5)*26).matrixTransform(el.getScreenCTM());return {x:p.x,y:p.y};},target.cell);
  await page.mouse.click(point.x,point.y);assert.equal(await page.locator('#start-province').inputValue(),target.id,'Rotated click selects exact plot');
  await waitArt();await shot('detail-'+q);await page.locator('.world-atlas').focus();await page.keyboard.press('e');
 }
 assert.equal(await page.locator('.world-atlas').getAttribute('data-quarter'),'0');
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'대륙 전체',exact:true}).click();await waitArt();await shot('mobile-world');
 await page.getByRole('button',{name:'세계 지도 왼쪽으로 90도 회전',exact:true}).click();assert.equal(await page.locator('.world-atlas').getAttribute('data-quarter'),'3');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.equal(await page.evaluate(()=>localStorage.getItem('first-land-v1')),before,'Camera is not saved gameplay state');
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);await writeFile(out+'/results.json',JSON.stringify({passed:true,views:4,errors,failed},null,2));console.log('Isometric atlas browser PASS');
}catch(e){await shot('failure').catch(()=>{});throw e;}finally{await browser.close();}
