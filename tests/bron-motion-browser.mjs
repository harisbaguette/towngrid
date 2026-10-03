import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const {chromium}=await import(process.argv[2]?pathToFileURL(process.argv[2]).href:'playwright');
const browser=await chromium.launch({headless:true,...(process.argv[3]?{executablePath:process.argv[3]}:{}),args:['--enable-unsafe-swiftshader']});
const origin=process.env.TOWNGRID_URL||'http://localhost:5173';
const out='docs/verification/bron-motion-20261002';
await mkdir(out,{recursive:true});
const errors=[],failed=[],report={};
try{
 const page=await browser.newPage({viewport:{width:1280,height:1080}});
 await page.routeWebSocket('**/*',()=>{});
 page.on('pageerror',error=>errors.push(error.message));
 page.on('response',response=>{if(response.status()>=400&&response.url().includes('pixel-characters'))failed.push(response.url());});
 await page.goto(origin+'/character-preview/bron-motion/');
 await page.waitForFunction(()=>window.bronComparison);
 await page.evaluate(()=>window.bronComparison.state.paused=true);
 for(const action of ['walk','carry','work','attack']){
  await page.locator(`[data-action="${action}"]`).click();
  await page.locator('#size').selectOption('1.65');
  await page.locator('#timeline').fill(action==='attack'?'45':'30');
  await page.screenshot({path:`${out}/compare-${action}.png`,fullPage:true});
  if(action==='attack'){
   for(const phase of [0,30,60,90]){
    await page.locator('#timeline').fill(String(phase));
    await page.locator('#after').screenshot({path:`${out}/attack-${phase}.png`});
   }
  }
 }
 await page.locator('#size').selectOption('.55');
 await page.screenshot({path:`${out}/small-attack.png`,fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:`${out}/mobile.png`,fullPage:true});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.reload();await page.waitForFunction(()=>window.bronComparison);
 assert.equal(await page.evaluate(()=>window.bronComparison.state.paused),true);
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(origin+'/character-preview/?character=bron');
 await page.waitForFunction(()=>window.rosterPreview?.assets.get('bron'));
 await page.locator('[data-action="attack"]').click();
 await page.evaluate(()=>{window.rosterPreview.state.paused=true;window.rosterPreview.state.elapsed=.3;});
 await page.waitForTimeout(70);
 await page.screenshot({path:`${out}/resident-preview.png`,fullPage:true});

 await page.goto(origin);
 await page.locator('canvas[role="application"]').waitFor({state:'attached',timeout:120000});
 await page.getByRole('button',{name:'화면을 눌러 시작',exact:true}).click({timeout:120000});
 await page.getByRole('button',{name:'산업도시 둘러보기',exact:true}).waitFor({timeout:120000});
 await page.evaluate(async()=>{
  const urls=performance.getEntriesByType('resource').map(entry=>entry.name).filter(url=>/\/app\/game\/scene\.js(?:\?|$)/.test(url));
  for(const url of new Set([...urls,'/src/app/game/scene.js'])){
   const {GameScene}=await import(url),original=GameScene.prototype.setSimulation;
   GameScene.prototype.setSimulation=function(sim){window.bronScene=this;return original.call(this,sim);};
  }
 });
 await page.getByRole('button',{name:'산업도시 둘러보기',exact:true}).click();
 await page.waitForFunction(()=>window.bronScene?.workerModels?.size>0,{},{timeout:120000});
 await page.getByRole('button',{name:'일시정지',exact:true}).click();
 report.game=await page.evaluate(()=>{
  const scene=window.bronScene,worker=scene.sim.workers.find(w=>w.appearance==='bron');
  if(!worker)throw Error('No dwarf in showcase');
  // The showcase initially spawns multiple residents at the same doorway.
  // Inspect one actor on clear owned ground in this disposable simulation.
  const clear=scene.sim.tiles.filter(tile=>scene.sim.ownedAt(tile.x,tile.z)&&tile.terrain!=='water'&&!tile.natural&&!scene.sim.at(tile.x,tile.z)&&scene.sim.workers.every(other=>other===worker||Math.hypot(other.x-tile.x,other.z-tile.z)>1.6))
   .sort((a,b)=>Math.hypot(a.x-worker.x,a.z-worker.z)-Math.hypot(b.x-worker.x,b.z-worker.z))[0];
  if(!clear)throw Error('No clear ground for motion inspection');
  worker.x=clear.x;worker.z=clear.z;worker.dir=0;
  window.bronWorker=worker;
  return {id:worker.id,appearance:scene.workerModels.get(worker.id).userData.appearance};
 });
 assert.equal(report.game.appearance,'bron');
 for(let view=0;view<4;view++){
  await page.evaluate(view=>{
   const scene=window.bronScene,worker=window.bronWorker;
   worker.walking=false;worker.working=false;worker.handling=null;worker.task=null;worker.attacking=true;
   scene.workerModels.get(worker.id).userData.motionState={};
   scene.sim.time+=1;scene.controls.target.set(worker.x,0,worker.z);
   scene.camera.zoom=2;scene.camera.updateProjectionMatrix();scene.setQuarterView(view);
  },view);
  await page.waitForTimeout(80);
  await page.evaluate(()=>{window.bronScene.sim.time+=.3;});
  await page.waitForTimeout(80);
  const pose=await page.evaluate(()=>{const u=window.bronScene.workerModels.get(window.bronWorker.id).userData;return {action:u.current,frame:u.frame,row:u.atlas.row,scale:u.atlas.scale,spriteScale:u.sprite.scale.y};});
  assert.equal(pose.action,'attack');assert.equal(pose.frame,50,'the live scene must advance past the ready pose');assert.ok(pose.scale>1);
  report['camera'+view]=pose;
  await page.screenshot({path:`${out}/game-${view}.png`});
  await page.evaluate(()=>{window.bronScene.sim.time+=.15;});
  await page.waitForTimeout(80);
  assert.equal(await page.evaluate(()=>window.bronScene.workerModels.get(window.bronWorker.id).userData.frame),51);
  await page.screenshot({path:`${out}/game-impact-${view}.png`});
 }
 await page.getByRole('button',{name:'주민',exact:true}).click();
 const bronChoice=page.locator('.resident-choice').filter({hasText:'브론'}).first();
 await bronChoice.click();
 await page.locator('.resident-actions button').filter({hasText:'공격'}).click();
 await page.waitForTimeout(270);
 await page.screenshot({path:`${out}/resident-panel.png`});
 assert.ok((await page.locator('.resident-illustration').getAttribute('src')).includes('/bron/'));
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 report.errors=errors;report.assetFailures=failed;
 await writeFile(`${out}/browser-check.json`,JSON.stringify(report,null,2)+'\n');
 console.log('Bron browser: comparison, four facings/cameras, real resident panel, mobile and reduced motion PASS');
}finally{await browser.close();}
