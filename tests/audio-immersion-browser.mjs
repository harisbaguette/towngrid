import assert from 'node:assert/strict';
import {browser,open,toHome,waitSim,R} from './audit-2/_browser.mjs';
import {WORLD_PLOTS} from '../src/app/game/territory.js';
import {layoutOf} from '../src/app/game/world-grid.js';
const page=await open({width:1440,height:960},{reducedMotion:'reduce'});
const playing=name=>waitSim(page,n=>window.tgAudio?.status.music===n&&window.tgAudio.status.levels.music>.001,name,30000);
try{
 await page.route('**/app/game/audio.js*',async route=>{
  const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace(/constructor\s*\(\)\s*\{/,'constructor(){window.tgAudio=this;')});
 });
 await toHome(page,{previewMenu:false});
 // Capture music starts, not just the eventual selected track.
 await page.getByRole('button',{name:'설정',exact:true}).hover();
 await page.evaluate(()=>{const a=window.tgAudio;window.tgStarts=[];const track=a.track.bind(a);a.track=(s,n,c,e)=>{if(c==='music')window.tgStarts.push(e.name);return track(s,n,c,e);};});
 await playing('music-morning');
 await page.getByRole('button',{name:'설정',exact:true}).click();await page.keyboard.press('Escape');
 await page.waitForTimeout(1500);
 assert.ok(!await page.evaluate(()=>window.tgStarts.includes('score-settings')),'brief settings peek does not interrupt home music');
 await page.getByRole('button',{name:'설정',exact:true}).click();await playing('score-settings');
 await page.keyboard.press('Escape');await playing('music-morning');
 await page.getByRole('button',{name:'새 게임',exact:true}).click();
 await page.getByRole('button',{name:'지역 살펴보기'}).click();await page.getByRole('button',{name:'땅 미리보기'}).click();
 await page.getByRole('button',{name:'이 땅에서 시작'}).click();await page.locator('.game-shell.is-playing').waitFor();
 await page.evaluate(()=>{window.tgScene.sim.time=4;window.tgScene.sim.paused=false;});
 await waitSim(page,()=>window.tgAudio.beds['forest-ambience']?.target>0&&window.tgAudio.status.levels.ambience>.001);
 await page.evaluate(()=>{window.tgScene.sim.time=44;});
 await waitSim(page,()=>window.tgAudio.beds['amb-crickets']?.target>.2&&(window.tgAudio.beds['forest-ambience']?.target||0)<.02);
 const snow=WORLD_PLOTS.find(p=>layoutOf(p.id).ecology==='snow');
 await page.evaluate(p=>window.tgScene.flyToWorld(p.cell[0]*24+11.5,p.cell[1]*24+11.5,55,{animate:false}),snow);
 await waitSim(page,()=>window.tgAudio.location?.ecology==='snow'&&window.tgAudio.beds['amb-wind']?.target>=.75);
 assert.equal(await page.evaluate(()=>window.tgAudio.ambienceMix()['forest-ambience']),0);
 assert.equal(await page.evaluate(()=>window.tgAudio.ambienceMix()['amb-crickets']),0);
 // The formerly 4.76-second tail must fit comfortably inside the four-second crossfade.
 const tails=await page.evaluate(async()=>{const out=[];for(const ext of ['ogg','mp3']){
  const r=await fetch('/assets/audio/score-biome-marsh.'+ext),b=await window.tgAudio.context.decodeAudioData(await r.arrayBuffer());
  const left=b.getChannelData(0),right=b.getChannelData(1);let i=left.length-1;
  for(;i>=0&&Math.max(Math.abs(left[i]),Math.abs(right[i]))<.003;i--);
  out.push({ext,duration:b.duration,tail:(left.length-1-i)/b.sampleRate});
 }return out;});
 for(const t of tails){assert.ok(t.duration<68&&t.tail<.5,JSON.stringify(t));}
 assert.deepEqual(R.errors,[]);assert.deepEqual(R.consoleErrors,[]);assert.deepEqual(R.failedRequests.filter(u=>u.includes('/assets/audio/')),[]);
 console.log('PASS real short-menu stability, held-menu score, visual day/night wildlife, remote snow ambience and trimmed OGG/MP3 tail',JSON.stringify(tails));
}finally{await page.unrouteAll({behavior:'ignoreErrors'});await browser.close();}
