import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
const out='docs/verification/slow-walk-20261008';await mkdir(out,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:960}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173/character-preview/slow-walk/');
 await page.waitForFunction(()=>window.slowWalkReview);
 const meta=await page.evaluate(()=>window.slowWalkReview.after.meta);
 assert.equal(meta.usedDrawings,20);assert.deepEqual(meta.steps,[12,8]);assert.equal(meta.sequence.length,32);
 assert.equal(new Set(meta.sequence.slice(0,16)).size+new Set(meta.sequence.slice(16)).size,20,'two distinct steps');
 const period=await page.evaluate(()=>window.slowWalkReview.period);assert.ok(Math.abs(period-meta.strideLength/.4)<1e-9,String(period));
 const individual=await page.evaluate(()=>window.slowWalkReview.individual.meta);
 assert.equal(individual.status,'review-only');
 assert.equal(individual.continuityVerdict,'rejected');
 assert.equal(individual.runtimeEligible,false);
 assert.equal(individual.newDrawings,9);
 assert.equal(individual.usedDrawings,21);
 assert.notEqual(individual.sequence[0],individual.sequence[16]);
 assert.notEqual(individual.frames[individual.sequence[0]].packedHash,individual.frames[individual.sequence[16]].packedHash);
 assert.equal(individual.frames[individual.sequence[0]].supportLeg,'near');
 assert.equal(individual.frames[individual.sequence[16]].supportLeg,'far');
 for(const direction of ['SW','SE']){
  await page.selectOption('#direction',direction);
  for(let i=0;i<32;i++){
   await page.evaluate(i=>window.slowWalkReview.seek(i),i);
   assert.equal(await page.locator('#frame').textContent(),`${i+1} / 32`);
   assert.match(await page.locator('#individual-pose').textContent(),i<14?/가까운 다리/:/먼 다리/);
  }
 }
 await page.click('#next');assert.equal(await page.locator('#frame').textContent(),'1 / 32');
 await page.selectOption('#direction','SW');await page.evaluate(()=>window.slowWalkReview.seek(12));
 await page.screenshot({path:`${out}/desktop.png`,fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:`${out}/mobile.png`,fullPage:true});
 await page.setViewportSize({width:2600,height:1050});
 await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.id='pose-proof';canvas.width=2560;canvas.height=512;
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#edf1e6';ctx.fillRect(0,0,2560,512);
  const {atlas}=window.slowWalkReview.after;
  for(let i=0;i<20;i++){const x=i%10*256,y=Math.floor(i/10)*256;ctx.drawImage(atlas,i*256,0,256,256,x,y,256,256);ctx.fillStyle='#789073';ctx.fillRect(x,y+232,256,1);ctx.fillStyle='#294134';ctx.font='14px sans-serif';ctx.fillText(String(i+1),x+12,y+16);}
  document.body.append(canvas);canvas.style='position:absolute;top:0;left:0;z-index:10000;margin:0;width:2560px;height:512px';
 });
 await page.locator('#pose-proof').screenshot({path:`${out}/poses.png`});
 await page.evaluate(()=>{
  const canvas=document.querySelector('#pose-proof');canvas.width=1792;canvas.height=768;
  canvas.style.width='1792px';canvas.style.height='768px';
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#edf1e6';ctx.fillRect(0,0,canvas.width,canvas.height);
  const {atlas,meta}=window.slowWalkReview.individual;
  meta.frames.forEach((frame,i)=>{const x=i%7*256,y=Math.floor(i/7)*256;
   ctx.drawImage(atlas,i*256,0,256,256,x,y,256,256);
   ctx.fillStyle='#a5b5a0';ctx.fillRect(x,y+232,256,1);ctx.fillStyle=frame.new?'#a44628':'#294134';ctx.font='14px sans-serif';
   ctx.fillText(`${frame.phase} · ${frame.new?'새 작화':'기존'} · ${frame.supportLeg}`,x+8,y+16);
  });
 });
 await page.locator('#pose-proof').screenshot({path:`${out}/individual-poses.png`});
 assert.deepEqual(errors,[]);
 await writeFile(`${out}/browser.json`,JSON.stringify({drawings:20,steps:[12,8],individualDrawings:individual.usedDrawings,newDrawings:individual.newDrawings,individualStatus:individual.status,cells:32,directions:['SW','SE'],cycleSeconds:period,errors},null,2)+'\n');
 console.log(`Review controls: SW/SE, frame stepping, ${period}s cycle, desktop/mobile PASS. Game walk: two drawn steps (20 drawings). Raw individual cels kept for comparison (their own continuity verdict: rejected).`);
}finally{await browser.close();}
