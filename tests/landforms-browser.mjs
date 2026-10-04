import assert from 'node:assert/strict';
import {browser,open,origin,shot,R,save} from './audit-2/_browser.mjs';

const page=await open({width:1440,height:1000}),metrics=[];
async function ready(p,suffix=''){
 await p.goto(origin+'/landforms-preview.html'+suffix);
 await p.waitForFunction(()=>window.landformsPreview?.game.renderer.domElement.dataset.worldReady==='true',null,{timeout:120000});
}
try{
 await ready(page);
 const before=await page.evaluate(()=>JSON.stringify(window.landformsPreview.game.sim.save()));
 const options=await page.locator('#landform option').evaluateAll(items=>items.map(o=>o.value));
 for(const id of options){
  await page.locator('#landform').selectOption(id);await page.waitForTimeout(1300);
  const state=await page.evaluate(()=>{const g=window.landformsPreview.game;return {chunks:g.landscape.chunks.size,mountains:g.landscape.landmarks.children.filter(n=>n.visible).length,ms:g.renderer.domElement.dataset.renderMs,triangles:g.renderer.info?.render.triangles};});metrics.push({id,...state});
  assert.ok(state.chunks<=25);await shot(page,id+'.png');console.log(id,state);
 }
 assert.equal(await page.evaluate(()=>JSON.stringify(window.landformsPreview.game.sim.save())),before,'Surveying does not write game state');
 assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(k=>/save|campaign/.test(k)).length),0);
 await page.locator('#landform').selectOption('mountain');await page.waitForTimeout(500);
 const geometry=await page.evaluate(()=>{const g=window.landformsPreview.game,e=window.landformsPreview.examples.mountain,n=g.landscape.landmarks.children.find(n=>n.userData.cell===g.landscape.data.sample(e.x,e.z).cell);return Array.from(n.children[0].geometry.attributes.position.array);});
 for(let q=0;q<4;q++){
  const hit=await page.evaluate(q=>{
   const {game:g,examples}=window.landformsPreview,e=examples.mountain;g.setQuarterView(q);g.scene.updateMatrixWorld(true);g.camera.updateMatrixWorld(true);
   const root=g.landscape.landmarks.children.find(n=>n.userData.cell.cx===e.cell.cx&&n.userData.cell.cz===e.cell.cz),p=root.children[0].geometry.attributes.position;let i=0;for(let j=1;j<p.count;j++)if(p.getY(j)>p.getY(i))i=j;
   const v=g.camera.position.clone().set(p.getX(i),p.getY(i),p.getZ(i));root.localToWorld(v);v.project(g.camera);const r=g.renderer.domElement.getBoundingClientRect();g.pointerMove({clientX:r.left+(v.x+1)/2*r.width,clientY:r.top+(1-v.y)/2*r.height});
   return {terrain:g.worldHover?.terrain,positions:Array.from(p.array)};
  },q);assert.equal(hit.terrain,'mountain','Raised peaks pick their mountain, not the plot behind it');assert.deepEqual(hit.positions,geometry);await shot(page,'rotation-'+q+'.png');
 }
 await page.getByRole('button',{name:'주변까지 보기'}).click();await page.waitForTimeout(500);await shot(page,'mountain-wide.png');
 await page.locator('#landform').selectOption('valley');await page.waitForTimeout(700);assert.ok(await page.evaluate(()=>window.landformsPreview.game.landscape.landmarks.children.some(n=>n.children.some(c=>c.name==='mountain-cascade'))));
 const mobile=await open({width:390,height:844},{isMobile:true,hasTouch:true});await ready(mobile,'?landform=river');await mobile.waitForTimeout(1300);await shot(mobile,'mobile.png');assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.close();
 const cpu=await open({width:1024,height:768});await ready(cpu,'?renderer=canvas&landform=mountain');await cpu.waitForTimeout(1500);assert.equal(await cpu.evaluate(()=>window.landformsPreview.game.renderer.isSoftware),true);
 const changed=await cpu.evaluate(()=>{const g=window.landformsPreview.game;g.renderer.render(g.scene,g.camera);const a=g.renderer.domElement.toDataURL();g.landscape.landmarks.visible=false;g.renderer.render(g.scene,g.camera);const b=g.renderer.domElement.toDataURL();g.landscape.landmarks.visible=true;return a!==b;});assert.ok(changed,'Canvas draws the actual relief geometry');await cpu.waitForTimeout(100);await shot(cpu,'canvas-mountain.png');
 await cpu.locator('#landform').selectOption('river');await cpu.waitForTimeout(1000);await shot(cpu,'canvas-river.png');
 await save('results.json',{metrics,...R});assert.deepEqual(R.errors,[]);assert.deepEqual(R.consoleErrors,[]);assert.deepEqual(R.failedRequests,[]);
}finally{await browser.close();}
