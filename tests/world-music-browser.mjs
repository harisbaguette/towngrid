// Real UI routes and camera geography, with actual Web Audio output in isolated storage.
// node tests/world-music-browser.mjs <playwright/index.mjs> <chrome.exe>
import assert from 'node:assert/strict';
import {browser,open,toHome,waitSim,origin,R} from './audit-2/_browser.mjs';
import {WORLD_REALMS} from '../src/app/game/world-politics.js';
import {BIOMES} from '../src/app/game/biome-data.js';
import {WORLD_PLOTS} from '../src/app/game/territory.js';
import {layoutOf} from '../src/app/game/world-grid.js';
const page=await open({width:1440,height:960},{reducedMotion:'reduce'});
const heard=[];
const playing=async name=>{
 try{await waitSim(page,n=>window.tgAudio?.status.music===n&&window.tgAudio.status.levels.music>.001,name,30000);}
 catch(error){console.error(await page.evaluate(()=>({audio:window.tgAudio?.status,muted:window.tgAudio?.muted,log:window.tgAudioLog?.slice(-5)})),R.errors);throw error;}
 assert.ok(await page.evaluate(()=>[...window.tgAudio.voices].filter(v=>v.channel==='music').length<=2));
 heard.push(name);
};
const close=()=>page.keyboard.press('Escape');
try{
 if(!process.argv.includes('--presentation-only')){
 await toHome(page,{previewMenu:false});
 await page.getByRole('button',{name:'마을의 하루',exact:true}).click();await playing('score-gallery');
 await page.getByRole('button',{name:'홈으로',exact:true}).click();await playing('music-morning');
 await page.getByRole('button',{name:'설정',exact:true}).click();await playing('score-settings');
 await page.getByRole('button',{name:'에셋 출처',exact:true}).click();await playing('score-credits');
 assert.equal(await page.locator('.ui-view-credits a[href*="opengameart.org/content/"]').count()>20,true);
 await close();await playing('music-morning');
 assert.ok(await page.evaluate(()=>window.tgAudio.musicVoice.offset>0),'home resumes its playback position');
 await page.getByRole('button',{name:'설정',exact:true}).click();
 await page.getByRole('button',{name:'조작법',exact:true}).click();await playing('score-help');await close();
 await page.getByRole('button',{name:'산업 도전',exact:true}).click();await playing('score-trials');await close();
 console.log('PASS home/gallery/settings/credits/help/trials and resume');

 await page.getByRole('button',{name:'새 게임',exact:true}).click();
 await page.getByRole('button',{name:'지형으로 찾기',exact:true}).click();
 for(const id of Object.keys(WORLD_REALMS)){
  await page.getByLabel('시작 국가',{exact:true}).selectOption(id);await playing('score-nation-'+id);
 }
 await page.getByLabel('시작 국가',{exact:true}).selectOption('estern');await close();
 await page.getByRole('button',{name:'지역 살펴보기'}).click();
 await page.getByRole('button',{name:'땅 미리보기'}).click();
 await page.getByRole('button',{name:'이 땅에서 시작'}).click();
 await page.locator('.game-shell.is-playing').waitFor();
 await page.evaluate(()=>{window.tgScene.sim.paused=true;});
 const localTrack=await page.evaluate(()=>'score-biome-'+window.tgScene.sim.layout.ecology);
 await playing(localTrack);
 console.log('PASS 14 country selections and local entry');

 // Move the real continuous camera, leaving music selection to the normal game update.
 const plots=Object.keys(BIOMES).map(id=>WORLD_PLOTS.find(p=>p.nation&&layoutOf(p.id).ecology===id));
 for(const p of plots){
  await page.evaluate(p=>window.tgScene.flyToWorld(p.cell[0]*24+11.5,p.cell[1]*24+11.5,55,{animate:false}),p);
  await playing('score-biome-'+layoutOf(p.id).ecology);
 }
 const meadow=WORLD_PLOTS.filter(p=>p.nation&&layoutOf(p.id).ecology==='meadow');
 const a=meadow.find(p=>p.nation==='estern'),b=meadow.find(p=>p.nation!==a.nation);
 for(const p of [a,b]){
  await page.evaluate(p=>window.tgScene.flyToWorld(p.cell[0]*24+11.5,p.cell[1]*24+11.5,55,{animate:false}),p);
  await playing(p===a?'score-biome-meadow':'score-nation-'+p.nation);
 }
 await page.evaluate(p=>window.tgScene.flyToWorld(p.cell[0]*24+11.5,p.cell[1]*24+11.5,620,{animate:false}),b);
 await playing('score-nation-'+b.nation);
 await page.getByRole('button',{name:'대륙 전체 보기',exact:true}).click();await playing('music-explore');
 await page.getByRole('button',{name:'내 땅으로',exact:true}).click();
 await waitSim(page,()=>window.tgAudio.status.scene.startsWith('place:'));
 console.log('PASS 8 biomes, same-biome border crossing, country zoom and continent');

 for(const [label,track] of [['목표·납품','goals'],['생산·위기','operations'],['주민','residents'],['장부','ledger'],['도전·순위','league'],['운반·보관','haul'],['주변 지형','terrain'],['지도 도구','map-tools'],['게임 설정','settings'],['조작법','help']]){
  await page.getByRole('button',{name:'게임 메뉴',exact:true}).click();await playing('score-menu');
  await page.locator('.ui-view-menu').getByRole('button',{name:new RegExp('^'+label)}).click();await playing('score-'+track);
  await close();
 }
 await page.getByRole('button',{name:'거점·외교',exact:true}).click();await playing('score-diplomacy');await close();
 await page.waitForTimeout(1500);
 assert.ok(await page.evaluate(()=>Object.keys(window.tgAudio.buffers).filter(n=>n.startsWith('music-')||n.startsWith('score-')).length<=3),'decoded music cache stays bounded');
 console.log('PASS game menu and 11 management screens');
 }

 // Reuse the real presentation components to keep long loading/error screens observable.
 await page.goto(origin+'/screen-preview');
 await page.waitForFunction(()=>Object.keys(document.querySelector('nav button')||{}).some(k=>k.startsWith('__reactProps$')));
 const {hook}=await import('./audit-2/_browser.mjs');await hook(page);
 await page.getByRole('button',{name:'대기 화면',exact:true}).click();
 await page.getByRole('button',{name:'소리 켜기',exact:true}).click();await playing('score-title');
 for(const [label,track] of [['홈 화면','music-morning'],['로딩 화면','score-loading'],['복구 화면','score-error'],['일상 그림','score-gallery']]){
  await page.getByRole('button',{name:label,exact:true}).click();await playing(track);
 }
 // Keep the actual first scene download pending: title -> loading -> home must each have its own score.
 let releaseScene;const sceneGate=new Promise(resolve=>{releaseScene=resolve;});
 await page.route('**/app/game/scene.js*',async route=>{await sceneGate;await route.fallback();});
 await page.route('**/app/game/audio.js*',async route=>{
  const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace(/constructor\s*\(\)\s*\{/,'constructor(){window.tgAudio=this;')});
 });
 try{
  await page.goto(origin,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>Object.keys(document.querySelector('.title-enter')||{}).some(k=>k.startsWith('__reactProps$')));
  await page.getByRole('button',{name:'화면을 눌러 시작',exact:true}).click();
  await page.locator('.screen-loading').waitFor();await playing('score-loading');
 }finally{releaseScene();}
 await page.locator('.home-screen').waitFor({timeout:120000});await playing('music-morning');
 console.log('PASS real first-load screen while game scene download is delayed');
 assert.deepEqual(R.errors,[]);assert.deepEqual(R.consoleErrors,[]);
 assert.deepEqual(R.failedRequests.filter(u=>u.includes('/assets/audio/')),[]);
 console.log('PASS presentation components; '+new Set(heard).size+' distinct scores produced real audio');
}finally{await page.unrouteAll({behavior:'ignoreErrors'});await browser.close();}
