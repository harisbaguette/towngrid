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
 assert.equal(meta.sourceDrawings,32);assert.equal(meta.usedDrawings,12);assert.equal(meta.sequence.length,32);
 const period=await page.evaluate(()=>window.slowWalkReview.period);assert.ok(Math.abs(period-meta.strideLength/.4)<1e-9,String(period));
 for(const direction of ['SW','SE']){
  await page.selectOption('#direction',direction);
  for(let i=0;i<32;i++){
   await page.evaluate(i=>window.slowWalkReview.seek(i),i);
   assert.equal(await page.locator('#frame').textContent(),`${i+1} / 32`);
  }
 }
 await page.click('#next');assert.equal(await page.locator('#frame').textContent(),'1 / 32');
 await page.selectOption('#direction','SW');await page.evaluate(()=>window.slowWalkReview.seek(12));
 await page.screenshot({path:`${out}/desktop.png`,fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:`${out}/mobile.png`,fullPage:true});
 await page.setViewportSize({width:1400,height:1050});
 await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.id='pose-proof';canvas.width=1536;canvas.height=512;
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#edf1e6';ctx.fillRect(0,0,1536,512);
  const {atlas}=window.slowWalkReview.after;
  for(let i=0;i<12;i++){const x=i%6*256,y=Math.floor(i/6)*256;ctx.drawImage(atlas,i*256,0,256,256,x,y,256,256);ctx.fillStyle='#789073';ctx.fillRect(x,y+232,256,1);ctx.fillStyle='#294134';ctx.font='14px sans-serif';ctx.fillText(String(i+1),x+12,y+16);}
  document.body.append(canvas);canvas.style='position:absolute;top:0;left:0;z-index:10000;margin:0;width:1536px;height:512px';
 });
 await page.locator('#pose-proof').screenshot({path:`${out}/poses.png`});
 assert.deepEqual(errors,[]);
 await writeFile(`${out}/browser.json`,JSON.stringify({drawings:12,cells:32,directions:['SW','SE'],cycleSeconds:period,errors},null,2)+'\n');
 console.log(`Slow walk review: 12 drawings in 32 cells, SW/SE, frame stepping, ${period}s cycle, desktop/mobile PASS`);
}finally{await browser.close();}
