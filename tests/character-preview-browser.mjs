import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
const out='docs/verification/character-arms-20261004';
await mkdir(out,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.TOWNGRID_URL||'http://localhost:5173')+'/character-preview/');
 await page.waitForFunction(()=>window.rosterPreview?.assets.has('mira'));
 await page.evaluate(()=>{window.rosterPreview.state.paused=true;window.rosterPreview.state.elapsed=0;});
 assert.equal(await page.locator('[data-character]').count(),51);
 const cases=[];
 for(const id of ['mira','bron','taron','kai','fia','dew','ravik','sora','garen']){
  await page.evaluate(async identity=>{await window.rosterPreview.select(identity);},id);
  for(const surface of ['ground','road','paved','upgraded']){
   await page.selectOption('#surface',surface);
   for(const action of ['walk','carry','pickup','drop','work','attack']){
    await page.click(`[data-action="${action}"]`);
    await page.click('#next');
    const actual=await page.evaluate(()=>({id:window.rosterPreview.state.id,action:window.rosterPreview.state.action,elapsed:window.rosterPreview.state.elapsed,paused:window.rosterPreview.state.paused,frame:document.getElementById('frame').textContent,meta:window.rosterPreview.assets.get(window.rosterPreview.state.id).meta.clips[window.rosterPreview.state.action]}));
    const speed=['ravik','sora','garen'].includes(id)?({ravik:.336,sora:.48,garen:.84}[id])*.5:.8*.5*(id==='kai'?1.15:1)*({ground:1,road:1.25,paved:1.5,upgraded:1.5*1.1*1.1}[surface]);
    const expected=['walk','carry'].includes(action)?actual.meta.strideLength/speed/actual.meta.frames.length:1/(actual.meta.fps*.5);
    assert.ok(Math.abs(actual.elapsed-expected)<1e-10,`${id}/${surface}/${action}: preview hides actual speed`);
    assert.equal(actual.frame,`2 / ${actual.meta.frames.length}`);
    assert.equal(actual.paused,true);
    await page.click('#previous');
    assert.equal(await page.locator('#frame').textContent(),`1 / ${actual.meta.frames.length}`);
    cases.push({id,surface,action});
   }
  }
 }
 await page.evaluate(async()=>{await window.rosterPreview.select('mira');});
 await page.click('[data-action="carry"]');await page.selectOption('#surface','paved');
 for(let i=0;i<8;i++)await page.click('#next');
 await page.screenshot({path:`${out}/preview-desktop.png`});
 const canvasSize=()=>page.locator('#stage').evaluate(canvas=>({width:canvas.width,height:canvas.height,cssWidth:canvas.getBoundingClientRect().width,cssHeight:canvas.getBoundingClientRect().height}));
 let size=await canvasSize();assert.equal(size.cssWidth,size.width,'desktop canvas must not resample the sprite');assert.equal(size.cssHeight,size.height);
 await page.setViewportSize({width:390,height:844});
 await page.waitForFunction(()=>document.getElementById('stage').width===256);
 await page.locator('#stage').scrollIntoViewIfNeeded();
 await page.screenshot({path:`${out}/preview-mobile.png`});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'mobile overflow');
 size=await canvasSize();assert.equal(size.cssWidth,size.width,'mobile canvas must not shrink four directions into one row');assert.equal(size.cssHeight,size.height);
 assert.deepEqual(errors,[]);
 await writeFile(`${out}/preview.json`,JSON.stringify({cases:cases.length,characters:51,errors},null,2)+'\n');
 console.log(`Character preview: 51 entries, ${cases.length} action/surface checks, frame stepping, desktop/mobile PASS`);
}finally{await browser.close();}
