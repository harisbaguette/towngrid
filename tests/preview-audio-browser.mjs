// node tests/preview-audio-browser.mjs <playwright/index.mjs> <chrome.exe>
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.argv[2]?pathToFileURL(process.argv[2]).href:'playwright');
const browser=await chromium.launch({headless:true,...(process.argv[3]?{executablePath:process.argv[3]}:{}),args:['--enable-unsafe-swiftshader','--autoplay-policy=user-gesture-required']});
const origin=process.env.TOWNGRID_URL||'http://localhost:5173',errors=[];
const context=await browser.newContext({viewport:{width:1280,height:900}});
await context.addInitScript(()=>{window.WebSocket=class{addEventListener(){}removeEventListener(){}close(){}};localStorage.setItem('preview-audio-save-sentinel','untouched');});
const paths=['/biome-preview.html','/map-edges-preview.html','/landforms-preview.html','/world-effects-preview.html','/environment-preview.html','/production-preview.html','/pixel-environment-preview.html','/art-preview.html','/building-readability.html','/character-preview/','/character-preview/mira/','/character-preview/bron-motion/','/character-preview/authored-motion/','/ui-layout-concepts/','/ui-layout-concepts/full-layouts.html','/ui-layout-concepts/start-map.html'];
const selected=paths.filter(p=>!process.env.PREVIEW_PATH||p.includes(process.env.PREVIEW_PATH));
try{
 for(const path of selected){
  const page=await context.newPage();page.on('pageerror',e=>{errors.push(path+': '+e.message);console.error(path,e.message);});
  await page.goto(origin+path+(path.includes('preview.html')?'?renderer=canvas':''),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.previewAudio,{timeout:30000});
  await page.locator('.preview-audio summary').click();
  await page.waitForFunction(()=>window.previewAudio.front!=='loading',{timeout:40000});
  await page.waitForTimeout(1800);
  await page.waitForFunction(()=>window.previewAudio.status.levels.music>.0005&&window.previewAudio.status.music===window.previewAudio.selection.tracks[0],{timeout:40000});
  const info=await page.evaluate(()=>({status:window.previewAudio.status,save:localStorage.getItem('preview-audio-save-sentinel')}));
  assert.equal(info.save,'untouched');assert.equal(info.status.failed,0);assert.ok(info.status.voices<=48);
  console.log('PASS',path,info.status.music,info.status.levels.music);
  if(path==='/character-preview/'){
   await page.evaluate(()=>{const a=window.previewAudio,play=a.play.bind(a);window.previewCues=[];a.play=(type,options)=>{if(options?.world)window.previewCues.push(type);return play(type,options);};});
   await page.locator('.preview-audio summary').click();
   await page.waitForTimeout(1200);assert.ok(await page.evaluate(()=>window.previewCues.includes('footstep')));
   await page.locator('[data-character="fia"]').click();await page.evaluate(()=>window.previewCues=[]);await page.waitForTimeout(1000);
   assert.equal(await page.evaluate(()=>window.previewCues.includes('footstep')),false,'floating fairy has no footsteps');
   await page.locator('[data-character="bron"]').click();await page.locator('[data-action="work"]').click();await page.waitForTimeout(1200);
   assert.ok(await page.evaluate(()=>window.previewCues.includes('quarry')));
   await page.locator('#play').click();await page.evaluate(()=>window.previewCues=[]);await page.waitForTimeout(1000);assert.equal(await page.evaluate(()=>window.previewCues.length),0);
   await page.locator('.preview-audio summary').click();
  }
  if(path==='/production-preview.html'){
   await page.locator('[aria-label="배경음악 음량"]').fill('37');
   assert.equal(await page.evaluate(()=>window.previewAudio.volumes.music),.37);
  }
  await page.getByRole('button',{name:'소리 끄기',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.previewAudio.voices.size),0);
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.previewAudio);await page.waitForTimeout(350);
  assert.equal(await page.evaluate(()=>window.previewAudio.muted),true,'mute survives navigation');
  assert.equal(await page.evaluate(()=>window.previewAudio.voices.size),0);
  await page.locator('.preview-audio summary').click();await page.getByRole('button',{name:'소리 켜기',exact:true}).click();
  await page.waitForFunction(()=>window.previewAudio.status.levels.music>.0005,{timeout:40000});
  if(path==='/character-preview/'){
   await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
   assert.equal(await page.evaluate(()=>window.previewAudio.disposed),false,'cached-page navigation keeps the audio engine');
   await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
   await page.waitForFunction(()=>window.previewAudio.context.state==='running');
  }
  await page.close();
 }
 if(!process.env.PREVIEW_PATH){
  const page=await context.newPage();await page.setViewportSize({width:390,height:844});page.on('pageerror',e=>errors.push('/design-system: '+e.message));
  await page.route('**/app/game/audio.js*',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace(/constructor\s*\(\)\s*\{/,'constructor(){window.tgAudio=this;')});});
  await page.goto(origin+'/design-system');await page.locator('.preview-audio summary').click();await page.waitForFunction(()=>window.tgAudio?.status.levels.music>.001);
  const bounds=await page.getByRole('button',{name:'소리 끄기',exact:true}).boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390&&bounds.y>0&&bounds.y+bounds.height<844,'mobile controls stay in the viewport');
  await page.locator('.preview-audio summary').click();await page.locator('#sample-sound').click();assert.equal(await page.evaluate(()=>window.tgAudio.volumes.effects),0);
  await page.unrouteAll({behavior:'ignoreErrors'});await page.close();console.log('PASS design-system music, effect switch and mobile controls');
 }
 assert.deepEqual(errors,[]);
 console.log(`PASS ${selected.length} standalone previews: music, mute persistence, bounded voices, selected-character cues, paused/floating silence, shared volume, no save writes`);
}finally{await context.close();await browser.close();}
