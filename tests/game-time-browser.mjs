// node tests/game-time-browser.mjs <playwright/index.mjs> <chrome.exe>
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.setDefaultTimeout(60000);
try{
 await page.goto(process.env.TOWNGRID_URL||'http://localhost:5173');
 await page.locator('canvas[role="application"]').waitFor({state:'attached',timeout:120000});
 await page.getByRole('button',{name:'화면을 눌러 시작',exact:true}).click();
 await page.getByRole('button',{name:'초반 마을 테스트',exact:true}).waitFor();
 await page.evaluate(async()=>{
  const urls=performance.getEntriesByType('resource').map(e=>e.name).filter(url=>/\/app\/game\/scene\.js(?:\?|$)/.test(url));
  for(const url of new Set([...urls,'/src/app/game/scene.js'])){
   const {GameScene}=await import(url);
   if(GameScene.prototype.paceAudit)continue;
   GameScene.prototype.paceAudit=true;
   const original=GameScene.prototype.setSimulation;
   GameScene.prototype.setSimulation=function(sim){
    const result=original.call(this,sim);window.paceScene=this;
    if(!this.paceLoopAudit){
     this.paceLoopAudit=true;this.acceptedRealSeconds=0;
     const loop=this.loop;
     this.loop=now=>{
      const before=this.last;loop(now);
      if(this.last!==before)this.acceptedRealSeconds+=Math.min((this.last-before)/1000,.5);
     };
     cancelAnimationFrame(this.frame);this.frame=requestAnimationFrame(this.loop);
    }
    return result;
   };
  }
 });
 await page.getByRole('button',{name:'초반 마을 테스트',exact:true}).click();
 await page.waitForFunction(()=>window.paceScene?.sim.time>1,{},{timeout:120000});
 const samples=[];
 for(const speed of [1,2,4]){
  await page.locator('.time-controls').getByRole('button',{name:speed+'×',exact:true}).click();
  const sample=await page.evaluate(async()=>{
   const scene=window.paceScene,s=scene.sim,start=s.time,accepted=scene.acceptedRealSeconds,now=performance.now();
   await new Promise(resolve=>setTimeout(resolve,4000));
   return {speed:s.speed,real:(performance.now()-now)/1000,acceptedReal:scene.acceptedRealSeconds-accepted,game:s.time-start};
  });
  samples.push(sample);
  // Large dev-server/render stalls are capped by the scene, not caught up.
  // Check every accepted frame, independently of the machine's render speed.
  assert.ok(sample.acceptedReal>1,JSON.stringify(sample));
  assert.ok(Math.abs(sample.game/sample.acceptedReal-speed*.5)<.001,JSON.stringify(sample));
 }
 await page.getByRole('button',{name:'일시정지',exact:true}).click();
 const before=await page.evaluate(()=>window.paceScene.sim.time);
 await page.waitForTimeout(500);
 assert.equal(await page.evaluate(()=>window.paceScene.sim.time),before,'pause freezes time');
 // Camera input remains available while the simulation clock is stopped.
 const view=await page.evaluate(()=>window.paceScene.viewIndex);
 await page.keyboard.press('e');
 await page.waitForFunction(v=>window.paceScene.viewIndex!==v,view);
 assert.equal(await page.evaluate(()=>window.paceScene.sim.time),before);
 await page.locator('.time-controls').getByRole('button',{name:'1×',exact:true}).click();
 await page.waitForFunction(t=>window.paceScene.sim.time>t,before);
 assert.equal(await page.getByRole('button',{name:'4배 빠르게',exact:true}).count(),0);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({result:'PASS',samples,pause:true,camera:true,resume:true,pageErrors:errors}));
}finally{await context.close();await browser.close();}
