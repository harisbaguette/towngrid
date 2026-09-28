import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {EXPANSION_GROUPS} from '../src/app/game/pixel-expansion-data.js';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=new Set(),failed=[],results=[];
page.on('pageerror',e=>errors.add(e.message));page.on('console',m=>{if(m.type()==='error'||m.type()==='warning'&&/Texture|Shader|WebGL/.test(m.text()))errors.add(m.text());});page.on('response',r=>{if(r.url().includes('/assets/pixel-environment/')&&r.status()>=400)failed.push(r.url());});
const origin=process.env.TOWNGRID_URL||'http://localhost:5173',out=new URL('../docs/verification/world-v5/',import.meta.url);await mkdir(out,{recursive:true});
const shot=name=>page.screenshot({path:fileURLToPath(new URL(name+'.png',out))});
try{
 for(const renderer of ['webgl','canvas'])for(const group of Object.keys(EXPANSION_GROUPS)){
  await page.goto(origin+'/production-preview.html?group='+group+(renderer==='canvas'?'&renderer=canvas':''));await page.waitForFunction(()=>window.productionPreview);await page.locator('#pause').click();
  for(const state of ['empty','working','ready','working-ready','blocked','disabled']){
   await page.locator('[data-state="'+state+'"]').click();await page.evaluate(()=>window.productionPreview.setTime(5));
   const rows=await page.evaluate(()=>window.productionPreview.items.map(i=>({type:i.type,image:!!i.model.userData.image,frame:i.model.userData.frame,state:i.model.userData.production,outputs:i.model.userData.layers.filter(l=>l.name.startsWith('output-')&&l.visible).length})));
   for(const row of rows){assert.equal(row.image,true);assert.equal(row.frame,0);const p=row.state;if(!p)continue;assert.equal(p.working,['working','working-ready'].includes(state),row.type);if(p.service){assert.equal(p.active,['ready','working-ready'].includes(state));assert.equal(row.outputs,0);}else assert.equal(row.outputs>0,['ready','working-ready','disabled'].includes(state),row.type);}
  }
  await page.locator('[data-state="working-ready"]').click();
  for(let view=0;view<4;view++){await page.locator('#view').selectOption(String(view));assert.ok(await page.evaluate(view=>window.productionPreview.items.every(i=>i.model.userData.direction===view),view));}
  if(group==='newfarm'||group==='largeports')await shot(group+'-'+renderer);results.push({renderer,group,states:6,views:4});
 }
 for(const renderer of ['webgl','canvas']){
  await page.goto(origin+'/environment-preview.html'+(renderer==='canvas'?'?renderer=canvas':''));await page.waitForFunction(()=>window.environmentPreview,{},{timeout:120000});await page.evaluate(()=>window.environmentPreview.pause());
  for(const region of ['river','coast','highland','ice','desert']){
   await page.locator('#region').selectOption(region);
   for(let view=0;view<4;view++){
    const result=await page.evaluate(view=>{const p=window.environmentPreview,g=p.game;g.setQuarterView(view);g.scene.updateMatrixWorld(true);g.camera.updateMatrixWorld();g.renderer.render(g.scene,g.camera);return {view:g.viewIndex,loaded:[...g.models.values()].every(m=>!!m.userData.image),surfaces:g.terrain.children.every(m=>!!m.userData.image),renderer:g.renderer.isSoftware?'canvas':'webgl'};},view);
    assert.equal(result.renderer,renderer);assert.equal(result.view,view);assert.ok(result.loaded&&result.surfaces);
    if(view===0||renderer==='webgl')await shot(region+'-'+view+'-'+renderer);
   }
  }
  await page.locator('#layout').selectOption('transport');await page.locator('#region').selectOption('coast');
  assert.ok(await page.evaluate(()=>{const g=window.environmentPreview.game;g.scene.updateMatrixWorld(true);g.camera.updateMatrixWorld();g.renderer.render(g.scene,g.camera);return g.sim.region==='coast'&&[...g.models.values()].some(m=>m.userData.building.type==='coastport');}));
  await shot('ports-'+renderer);
  const preserved=await page.evaluate(()=>{const g=window.environmentPreview.game,before=JSON.stringify(g.sim.save());for(let v=0;v<4;v++)g.setQuarterView(v);g.setOverlay('moisture');g.setOverlay('');g.terrain.userData.animate(7);return before===JSON.stringify(g.sim.save());});assert.ok(preserved);
  await page.setViewportSize({width:390,height:844});await shot('environment-mobile-'+renderer);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewportSize({width:1440,height:1000});
 }
 assert.deepEqual([...errors],[]);assert.deepEqual(failed,[]);await writeFile(new URL('browser-results.json',out),JSON.stringify({passed:true,results,errors:[...errors],failed},null,2));
 console.log('41 new facilities: six states, four views, WebGL/CPU; five regions, ports, overlays, save invariance and mobile passed.');
}catch(e){await shot('failure');console.error({errors:[...errors],failed});throw e;}finally{await browser.close();}
