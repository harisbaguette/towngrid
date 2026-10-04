import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const {chromium}=await import(process.argv[2]?pathToFileURL(process.argv[2]).href:'playwright');
const browser=await chromium.launch({headless:true,...(process.argv[3]?{executablePath:process.argv[3]}:{}),args:['--enable-unsafe-swiftshader']});
const origin=process.env.TOWNGRID_URL||'http://localhost:5173';
const out='docs/verification/bron-locomotion-20261003';
await mkdir(out,{recursive:true});
const errors=[],failed=[],report={};
try{
 const page=await browser.newPage({viewport:{width:1280,height:1080}});
 await page.routeWebSocket('**/*',()=>{});
 // Capture the instance from the module actually loaded by the app. Importing
 // another Vite timestamp can patch an unused class after a local edit.
 await page.route(/\/src\/app\/game\/scene\.js(?:\?|$)/,async route=>{
  const response=await route.fetch(),source=await response.text();
  const body=source.replace(/\bthis\.container\s*=\s*container\s*;/,'window.bronScene=this;$&');
  assert.notEqual(body,source,'capture the live scene from its constructor');
  await route.fulfill({response,body});
 });
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
 await page.locator('.home-extras summary').click();
 await page.getByRole('button',{name:'산업도시 둘러보기',exact:true}).waitFor({timeout:120000});
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
 report.locomotion=await page.evaluate(async()=>{
  const scene=window.bronScene,worker=window.bronWorker;
  const urls=performance.getEntriesByType('resource').map(entry=>entry.name);
  const pixelURL=urls.find(url=>/\/app\/game\/pixel-characters\.js(?:\?|$)/.test(url))||'/src/app/game/pixel-characters.js';
  const source=await (await fetch(pixelURL)).text();
  const movementURL=source.match(/from\s+["']([^"']*character-movement\.js[^"']*)["']/)[1];
  const {advanceCharacterRoute,characterDistance}=await import(movementURL);
  const meta=await (await fetch('/assets/pixel-characters/bron/frames.json')).json();
  const start={x:worker.x,z:worker.z},cases=[];
  const model=scene.workerModels.get(worker.id);
  const proof=document.createElement('canvas');proof.width=1000;proof.height=1600;
  const ctx=proof.getContext('2d');ctx.fillStyle='#e8ede3';ctx.fillRect(0,0,proof.width,proof.height);
  const capture=(view,action,column,label)=>{
   scene.scene.updateMatrixWorld(true);scene.renderer.render(scene.scene,scene.camera);
   const point=model.position.clone().project(scene.camera),canvas=scene.renderer.domElement;
   const x=(point.x*.5+.5)*canvas.width,y=(-point.y*.5+.5)*canvas.height;
   const top=(view*2+(action==='carry'?1:0))*200;
   ctx.drawImage(canvas,x-100,y-175,200,200,column*200,top,200,200);
   ctx.fillStyle='#142b28';ctx.font='13px sans-serif';ctx.fillText(`${view} ${action} ${label}`,column*200+8,top+18);
  };
  for(let view=0;view<4;view++)for(const action of ['walk','carry']){
   worker.x=start.x;worker.z=start.z;worker.dir=0;worker.atHome=false;
   worker.working=false;worker.attacking=false;worker.handling=null;worker.phase=null;
   worker.task=action==='carry'?{carried:true}:null;
   worker.route=[{x:worker.x,z:worker.z+2}];
   scene.controls.target.set(worker.x,0,worker.z);scene.camera.zoom=2;scene.camera.updateProjectionMatrix();
   scene.setQuarterView(view);model.userData.motionState={};
   const frames=[];
   const strideStep=meta.clips[action].strideLength/meta.clips[action].frames.length;
   const distance=characterDistance(worker);
   let firstStep=(Math.floor(distance/strideStep)+.5)*strideStep-distance;
   if(firstStep<=0)firstStep+=strideStep;
   // Sample the middle of each exposure, away from floating-point boundaries.
   for(let step=0;step<meta.clips[action].frames.length;step++){
    advanceCharacterRoute(worker,(step?strideStep:firstStep)/.4,.4);
    scene.sim.time+=.08;scene.syncPeople();scene.scene.updateMatrixWorld(true);
    const u=model.userData;
    if(u.current!==action||u.atlas.row!==view+4||!model.visible)throw Error(`${action}: wrong live pose in camera ${view}`);
    frames.push(u.frame);
    if(step%8===0)capture(view,action,step/8,`frame ${u.frame}`);
   }
   if(new Set(frames).size!==meta.clips[action].frames.length)throw Error(`${action}: live gait missed a frame (${frames.join(',')})`);
   worker.walking=false;scene.syncPeople();
   const stopFrame=model.userData.frame;
   capture(view,action,4,'stop');
   if(action==='carry'&&stopFrame!==meta.clips.pickup.frames.at(-1))throw Error('Waiting carrier lost the holding pose');
   if(action==='walk'&&model.userData.current!=='idle')throw Error('Stopped walker did not return to idle');
   scene.sim.time+=2;scene.syncPeople();
   if(action==='carry'&&model.userData.frame!==stopFrame)throw Error('Waiting carrier resumed walking');
   worker.task=null;scene.syncPeople();worker.dir=Math.PI/2;scene.sim.time+=.1;scene.syncPeople();
   if(model.userData.current!=='turn')throw Error('Stationary direction change did not pivot');
   scene.sim.time+=.3;scene.syncPeople();
   if(model.userData.current!=='idle')throw Error('Foot pivot did not finish');
   cases.push({view,action,frames,stopFrame,turnFinished:true});
  }
  worker.x=start.x;worker.z=start.z;worker.dir=0;worker.task=null;worker.route=[];
  window.bronGaitProof=proof.toDataURL();
  return {runtimeRevision:meta.motionRevision,cases};
 });
 await writeFile(`${out}/walk-carry-stop.png`,Buffer.from((await page.evaluate(()=>window.bronGaitProof)).split(',')[1],'base64'));
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
 await page.getByRole('button',{name:'게임 메뉴',exact:true}).click();
 await page.getByRole('button',{name:'주민',exact:true}).click();
 const bronChoice=page.locator('.resident-choice').filter({hasText:'브론'}).first();
 await bronChoice.click();
 await page.locator('.resident-motion summary').click();
 await page.locator('.resident-actions button').filter({hasText:'공격'}).click();
 await page.waitForTimeout(270);
 await page.screenshot({path:`${out}/resident-panel.png`});
 assert.ok((await page.locator('.resident-illustration').getAttribute('src')).includes('/bron/'));
 report.residentGait=[];
 const residentMeta=await page.evaluate(async()=>{
  const {atlasColumns,atlasRows,clips}=await (await fetch('/assets/pixel-characters/bron/frames.json')).json();
  return {atlasColumns,atlasRows,clips};
 });
 for(const [action,label] of [['walk','걷기'],['carry','운반']]){
  await page.locator('.resident-actions button').getByText(label,{exact:true}).click();
  for(const [view,label] of [[0,'왼쪽 앞'],[1,'왼쪽 뒤'],[2,'오른쪽 뒤'],[3,'오른쪽 앞']]){
   await page.getByRole('button',{name:label,exact:true}).click();
   const pose=await page.locator('.resident-preview[data-character="bron"]').evaluate(element=>{
    const animation=element.getAnimations()[0];
    if(!animation)throw Error('Resident gait did not animate');
    animation.pause();animation.currentTime=200;
    const style=getComputedStyle(element);
    return {size:style.backgroundSize,x:parseFloat(style.backgroundPositionX),y:parseFloat(style.backgroundPositionY)};
   });
   const {atlasColumns:columns,atlasRows:rows,clips}=residentMeta;
   const frame=clips[action].frames[Math.floor(.2*clips[action].fps)%clips[action].frames.length];
   assert.equal(pose.size,`${columns*100}% ${rows*100}%`);
   assert.ok(Math.abs(pose.y-(view+Math.floor(frame/columns)*4)/(rows-1)*100)<.01,'resident preview must use the gait page of the atlas');
   assert.ok(Math.abs(pose.x-(frame%columns)/(columns-1)*100)<.01,'resident preview must advance to the correct gait pose');
   report.residentGait.push({view,action,...pose});
   await page.locator('.resident-preview[data-character="bron"]').screenshot({path:`${out}/resident-${action}-${view}.png`});
  }
 }
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 report.errors=errors;report.assetFailures=failed;
 await writeFile(`${out}/browser-check.json`,JSON.stringify(report,null,2)+'\n');
 console.log('Bron browser: comparison, four facings/cameras, real resident panel, mobile and reduced motion PASS');
}finally{await browser.close();}
