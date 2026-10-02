// Real pixels + decoded audio; isolated browser storage. Run with Playwright and Chrome paths.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WORK_ART, TRANSITION_ART } from '../src/app/game/screen-art.js';
const { chromium }=await import(process.argv[2]?pathToFileURL(process.argv[2]).href:'playwright');
const browser=await chromium.launch({headless:true,...(process.argv[3]?{executablePath:process.argv[3]}:{}),args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:900}});
await context.addInitScript(()=>{window.WebSocket=class{addEventListener(){}removeEventListener(){}send(){}close(){}};});
const page=await context.newPage(),errors=[],failed=[],result={};
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(/\/assets\/(audio|screens)\//.test(r.url())&&r.status()>=400)failed.push(r.url());});
const out=new URL('../docs/verification/home-motion-audio/',import.meta.url);await mkdir(out,{recursive:true});
const url=process.env.TOWNGRID_URL||'http://localhost:5173';
const decoded=()=>page.waitForFunction(()=>[...document.querySelectorAll('.screen-scenery')].every(i=>i.complete&&i.naturalWidth&&!i.dataset.fallback));
const pixels=()=>page.locator('.screen-motion').first().evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let hash=0,count=0;for(let i=0;i<d.length;i+=4){if(d[i+3])count++;hash=(hash*31+d[i]+d[i+1]*3+d[i+2]*7+d[i+3])|0;}return {hash,count,frame:c.dataset.frame,active:c.dataset.active};});
const instrument=()=>page.evaluate(async()=>{
 const urls=performance.getEntriesByType('resource').map(e=>e.name).filter(u=>/\/app\/game\/audio\.js(?:\?|$)/.test(u));
 for(const u of new Set([...urls,'/src/app/game/audio.js']))try{const {GameAudio}=await import(u);for(const name of ['start','tick','play']){const fn=GameAudio.prototype[name];if(fn.wrapped)continue;const next=function(...args){window.__audio=this;const value=fn.apply(this,args);if(name==='play'&&value)(window.__sounds||=[]).push(args[0]);return value;};next.wrapped=true;GameAudio.prototype[name]=next;}}catch{}
});
const audioReady=()=>page.waitForFunction(()=>window.__audio?.context?.state==='running'&&!window.__audio.loading&&window.__audio.status.rms>0,{},{timeout:60000});
try{
 await page.goto(url+'/screen-preview/');await page.locator('.art-gallery').waitFor();await decoded();console.log('Checking screen motion');
 await page.waitForFunction(()=>document.querySelector('.screen-motion')?.dataset.frame>2);
 const a=await pixels();await page.waitForTimeout(650);const b=await pixels();assert.ok(a.count>0&&b.count>0);assert.notEqual(a.hash,b.hash,'actual animated pixels change');
 result.animation={before:a,after:b};
 await instrument();
 const toolbar=page.getByRole('navigation',{name:'화면 미리보기',exact:true});
 await page.evaluate(()=>{window.savedRandom=Math.random;Math.random=()=>.99;});
 await toolbar.getByRole('button',{name:'홈 화면',exact:true}).click();await page.locator('.home-screen[data-art="town"]').waitFor();
 await page.evaluate(()=>{Math.random=window.savedRandom;});await decoded();
 await page.getByRole('button',{name:'소리 켜기',exact:true}).click();await audioReady();
 await page.waitForFunction(()=>{const s=window.__audio.status;return s.music&&s.levels.music>.001&&s.ambience.includes('amb-river')&&s.levels.ambience>.001;},{},{timeout:60000});
 result.homeAudio=await page.evaluate(()=>window.__audio.status);
 await page.screenshot({path:fileURLToPath(new URL('home-desktop.png',out))});
 await page.getByRole('button',{name:'배경 움직임 멈추기'}).click();assert.equal((await pixels()).active,'false');
 await page.getByRole('button',{name:'배경 움직임 재생'}).click();await page.waitForFunction(()=>document.querySelector('.screen-motion')?.dataset.frame>2);
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('.screen-motion')?.dataset.active==='false');assert.equal((await pixels()).active,'false');assert.ok(await page.getByRole('button',{name:'배경 움직임 재생'}).isDisabled());
 await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>document.querySelector('.screen-motion')?.dataset.active==='true'&&document.querySelector('.screen-motion')?.dataset.frame>2);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForTimeout(150);const hidden=await pixels();await page.waitForTimeout(300);assert.deepEqual(await pixels(),hidden);assert.equal(await page.evaluate(()=>window.__audio.context.state),'suspended');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});await audioReady();
 result.pause={manual:true,reducedMotion:true,hiddenTab:true,resumed:true};
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);await page.screenshot({path:fileURLToPath(new URL('home-mobile.png',out))});
 assert.ok(await page.getByRole('button',{name:'배경 움직임 멈추기'}).isVisible());
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.setViewportSize({width:1440,height:900});await toolbar.getByRole('button',{name:'일상 그림',exact:true}).click();
 const scenes=[];
 for(const art of WORK_ART){await page.getByRole('button',{name:art.title+' 보기',exact:true}).click();await decoded();await page.waitForTimeout(100);const p=await pixels();assert.ok(p.count>0,art.id+' has motion');scenes.push(art.id);}
 await page.getByRole('button',{name:/^화면 전환/}).click();
 for(const art of TRANSITION_ART){await page.getByRole('button',{name:art.title+' 보기',exact:true}).click();await decoded();await page.waitForTimeout(100);assert.ok((await pixels()).count>0,art.id);scenes.push(art.id);}
 await page.waitForFunction(()=>window.__audio.status.ambience.includes('amb-room'));
 result.scenes=scenes;result.roomAudio=await page.evaluate(()=>window.__audio.status);console.log('PASS preview motion, controls, 28 gallery scenes, home/room ambience');
 // Test the actual game, including portal settings and keyboard camera controls.
 await page.goto(url);await page.getByRole('button',{name:'화면을 눌러 시작',exact:true}).waitFor();
 await page.waitForFunction(()=>Object.keys(document.querySelector('.title-enter')||{}).some(key=>key.startsWith('__reactProps$')),{},{timeout:120000});await instrument();
 await page.getByRole('button',{name:'화면을 눌러 시작',exact:true}).click();await page.getByRole('button',{name:'초반 마을 테스트',exact:true}).waitFor({timeout:120000});await audioReady();
 await page.getByRole('button',{name:'초반 마을 테스트',exact:true}).click();await page.getByRole('button',{name:'게임 설정',exact:true}).waitFor({timeout:120000});
 await page.getByRole('button',{name:'게임 설정',exact:true}).click();await page.waitForTimeout(700);
 await page.keyboard.press('Escape');await page.waitForTimeout(350);
 await page.locator('.world-canvas').click({position:{x:700,y:500}});await page.keyboard.press('q');await page.keyboard.press('+');
 await page.getByRole('button',{name:'일시정지',exact:true}).click();await page.waitForTimeout(200);await page.getByRole('button',{name:'재개',exact:true}).click();
 result.actions=await page.evaluate(()=>window.__sounds);for(const sound of ['open','close','rotate','zoom','pause','resume'])assert.ok(result.actions.includes(sound),sound+' action connected');
 result.decoded=await page.evaluate(async()=>{const {SOUND_PROFILES,FILES}=await import('/src/app/game/audio.js');const a=window.__audio,names=[...new Set(['sheep','cow','duck','hen','bee'].flatMap(k=>SOUND_PROFILES[k].files).concat(['save','load','notify','contract','dispatch','delivery'].map(k=>FILES[k])))],out={};for(const name of names){const b=await a.fetchBuffer(name);if(!b)throw Error(name+' decode failed');let energy=0;for(const v of b.getChannelData(0))energy+=v*v;out[name]={duration:b.duration,rms:Math.sqrt(energy/b.length)};}return out;});
 for(const sound of Object.values(result.decoded))assert.ok(sound.rms>.005,'non-silent sound');
 await page.getByRole('button',{name:'게임 설정',exact:true}).click();
 await page.getByLabel('효과음 음량',{exact:true}).fill('0');await page.waitForTimeout(400);
 assert.equal(await page.evaluate(()=>window.__audio.volumes.effects),0);
 await page.getByLabel('효과음 음량',{exact:true}).fill('0.85');
 await page.getByRole('switch',{name:'소리',exact:true}).click();await page.waitForTimeout(600);
 assert.equal(await page.evaluate(()=>window.__audio.muted),true);assert.equal(await page.evaluate(()=>window.__audio.status.rms),0);
 await page.getByRole('switch',{name:'소리',exact:true}).click();await audioReady();
 result.soundControls={effectsSlider:true,mute:true,unmute:true};
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);result.errors=errors;result.failed=failed;
 await writeFile(new URL('results.json',out),JSON.stringify(result,null,2)+'\n');console.log('PASS presentation: 31 scenes, moving pixels, pause/reduced motion/hidden tab, scene ambience, UI/keyboard actions, decoded effects, volume/mute.');
}catch(error){await page.screenshot({path:fileURLToPath(new URL('failure.png',out))});await writeFile(new URL('failure.json',out),JSON.stringify({error:String(error),errors,failed,result},null,2));throw error;}finally{await browser.close();}
