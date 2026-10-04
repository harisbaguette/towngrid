import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
const out='docs/verification/character-authored-v11-20261004';
await mkdir(out,{recursive:true});
const runtimePaths=['sprites.png','frames.json','portrait.png'].map(name=>'public/assets/pixel-characters/mira/'+name);
const hashes=()=>Promise.all(runtimePaths.map(async path=>createHash('sha256').update(await readFile(path)).digest('hex')));
const before=await hashes();
try{
 const page=await browser.newPage({viewport:{width:1200,height:1100}}),errors=[],requests=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',request=>requests.push(request.url()));
 await page.goto((process.env.TOWNGRID_URL||'http://localhost:5173')+'/character-preview/authored-motion/');
 await page.waitForFunction(()=>window.authoredMotionReview);
 await page.waitForFunction(()=>document.querySelector('.reference img').naturalWidth>0);
 const result=await page.evaluate(()=>{
  const r=window.authoredMotionReview,count=r.after.meta.clips.walk.frames.length;
  r.state.travel=false;const views=[];
  for(const action of Object.keys(r.after.meta.clips))for(const direction of r.after.meta.directions){
   r.state.action=action;r.state.direction=direction;const frames=[];
   const expected=r.after.meta.clips[action].frames.length;
   for(let i=0;i<expected;i++){r.seek(i);frames.push(document.getElementById('after').toDataURL());}
   views.push({action,direction,distinct:new Set(frames).size,expected});
  }
  return {count,views,method:r.after.meta.method,runtimeSource:r.before.meta.source,notice:document.querySelector('.notice').textContent};
 });
 assert.equal(result.method,'whole-authored-cels-uniform-registration');
 assert.match(result.runtimeSource,/prototypes\/mira-v3\/runtime-pack\.json$/);
 assert.match(result.notice,/미완성/);
 for(const view of result.views)assert.equal(view.distinct,view.expected);
 await page.selectOption('#action','carry');assert.equal(await page.evaluate(()=>window.authoredMotionReview.state.action),'carry');
 await page.selectOption('#action','walk');
 await page.selectOption('#direction','SW');await page.evaluate(()=>window.authoredMotionReview.seek(0));
 await page.screenshot({path:`${out}/restored.png`,fullPage:true});
 await page.click('#previous');assert.match(await page.locator('#phase').textContent(),new RegExp(`^${result.count} / ${result.count}`));
 await page.click('#next');assert.match(await page.locator('#phase').textContent(),/^1 \//);
 await page.selectOption('#direction','SE');await page.selectOption('#speed','.25');await page.click('#play');
 const initial=await page.evaluate(()=>window.authoredMotionReview.state.time);
 await page.waitForTimeout(200);
 assert.ok(await page.evaluate(()=>window.authoredMotionReview.state.time)>initial);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.waitForFunction(()=>window.authoredMotionReview.state.paused);
 const stopped=await page.evaluate(()=>window.authoredMotionReview.state.time);
 await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.authoredMotionReview.state.time),stopped);
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:`${out}/mobile.png`,fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const retiredRequests=requests.filter(url=>/mira-volume|volume-motion-v10/.test(url));
 assert.deepEqual(retiredRequests,[]);assert.deepEqual(errors,[]);assert.deepEqual(await hashes(),before);
 await writeFile(`${out}/browser.json`,JSON.stringify({...result,retiredRequests,errors,runtimeHashes:Object.fromEntries(runtimePaths.map((path,i)=>[path,before[i]])),runtimePreserved:true,mobile:'passed',reducedMotion:'passed'},null,2)+'\n');
 console.log('AUTHORED_REVIEW_OK: walk/carry x four views, whole 2D cels, controls/mobile, runtime hashes preserved; visual approval pending');
}finally{await browser.close();}
