// Exercises the real GameScene update loop on a saved-game-free preview.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const out='docs/verification/sprite-grounding-20260930';await mkdir(out,{recursive:true});
const results=[],errors=[];
try{
 for(const mode of ['webgl','canvas']){
  const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(e.message));
  await page.routeWebSocket('**/*',()=>{});
  await page.goto((process.env.TOWNGRID_URL||'http://localhost:5173')+'/map-edges-preview.html'+(mode==='canvas'?'?renderer=canvas':''));
  await page.waitForFunction(()=>window.edgePreview?.game,{},{timeout:60000});
  const setup=await page.evaluate(()=>{
   const g=window.edgePreview.game,s=g.sim;
   s.buildings=s.buildings.filter(b=>b.type==='warehouse');s.workers=[];s.roads.clear();s.rails.clear();s.paused=true;s.siteId='grounding';
   for(const t of s.tiles)if(t.x>=10&&t.x<=18&&t.z>=10&&t.z<=18){t.nature=null;t.remaining=0;}
   const built=s.build('station',13,12,true);
   for(const [x,z]of [[13,13],[14,13],[15,13],[15,14],[15,15],[15,16]])s.rails.add(x+','+z);
   s.campaign={routes:[{id:'grounding-route',mode:'rail',item:'steel',from:s.siteId,to:'away',cargo:12,remaining:100,duration:100}]};
   s.revision++;g.rebuild();g.controls.target.set(14,0,14);g.camera.zoom=2.6;g.camera.updateProjectionMatrix();g.setQuarterView(0);
   return {built,points:g.railPath.length};
  });
  assert.ok(setup.built.ok);assert.ok(setup.points>6);
  const samples=await page.evaluate(async()=>{
   const g=window.edgePreview.game,s=g.sim,route=s.campaign.routes[0],observed=[];
   for(let n=0;n<=40;n++){
    route.remaining=100-n*2.5;s.time=n;g.last=0;
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const m=g.freight[0].m;observed.push({x:m.position.x,z:m.position.z,y:m.position.y,visible:m.visible,onRail:s.rails.has(Math.round(m.position.x)+','+Math.round(m.position.z)),frame:m.userData.frame});
   }
   return observed;
  });
  assert.ok(samples.every(p=>p.visible&&p.onRail&&p.y===.04));
  assert.ok(new Set(samples.map(p=>p.frame)).size>1,'real movement advances wheels');
  for(let view=0;view<4;view++){
   await page.evaluate(view=>{const g=window.edgePreview.game;g.sim.campaign.routes[0].remaining=65;g.sim.time+=1;g.setQuarterView(view);},view);
   await page.waitForTimeout(120);await page.screenshot({path:`${out}/rail-${mode}-${view}.png`});
  }
  const hidden=await page.evaluate(async()=>{
   const g=window.edgePreview.game;g.sim.rails.delete('13,13');g.sim.revision++;
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   return !g.freight[0].m.visible;
  });
  assert.ok(hidden,'removing the station connection removes the travelling train');
  results.push({mode,samples:samples.length,views:4,disconnectedHidden:hidden});await page.close();
 }
 assert.deepEqual(errors,[]);await writeFile(out+'/rail-browser.json',JSON.stringify({results,errors},null,2)+'\n');console.log(JSON.stringify(results));
}finally{await browser.close();}
