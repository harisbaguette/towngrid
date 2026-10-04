// Actual Web Audio and game UI; isolated browser storage, no player saves touched.
// node tests/soundscape-browser.mjs <playwright/index.mjs> <chrome.exe>
import assert from 'node:assert/strict';
import {browser,open,toHome,waitSim,tilePoint,R} from './audit-2/_browser.mjs';
import {ACTION_SOUNDS} from '../src/app/game/soundscape.js';
const page=await open({width:1440,height:960},{reducedMotion:'reduce'});
const playing=name=>waitSim(page,n=>window.tgAudio?.status.music===n&&window.tgAudio.status.levels.music>.001,name,30000);
try{
 await toHome(page,{previewMenu:false});
 await page.getByRole('button',{name:'새 게임',exact:true}).click();
 await page.locator('.start-world').waitFor();await playing('score-nation-estern');
 await page.evaluate(()=>{window.tgStarted=[];const a=window.tgAudio,track=a.track.bind(a);a.track=(source,nodes,channel,extra)=>{const v=track(source,nodes,channel,extra);if(v)window.tgStarted.push({channel,type:v.type,name:v.name});return v;};});
 await page.getByRole('button',{name:'지역 살펴보기'}).click();
 await page.getByRole('button',{name:'땅 미리보기'}).click();
 await page.getByRole('button',{name:'이 땅에서 시작'}).click();
 await page.locator('.game-shell.is-playing').waitFor();const localTrack=await page.evaluate(()=>'score-biome-'+window.tgScene.sim.layout.ecology);await playing(localTrack);
 assert.ok(await page.evaluate(()=>window.tgStarted.some(v=>v.type==='enter')),'entry cue');
 await page.getByRole('button',{name:'대륙 전체 보기',exact:true}).click();await playing('music-explore');
 await page.getByRole('button',{name:'내 땅으로',exact:true}).click();await playing(localTrack);
 await page.getByRole('button',{name:'월드 오른쪽 회전',exact:true}).click();
 assert.ok(await page.evaluate(()=>window.tgStarted.some(v=>v.type==='rotate')));
 // A real facility construction produces exactly one confirmation, and weather reads real event history.
 await page.getByRole('button',{name:'건설 목록 열기',exact:true}).click();
 await page.locator('.build-item').filter({hasText:'우물'}).first().click();
 const tile=await page.evaluate(()=>{const s=window.tgScene.sim;return s.tiles.find(t=>!s.canBuild('well',t.x,t.z));});assert.ok(tile);
 const point=await tilePoint(page,tile.x,tile.z);await page.mouse.click(point.px,point.py);
 await waitSim(page,()=>window.tgScene.sim.buildings.some(b=>b.type==='well')&&window.tgStarted.some(v=>v.type==='build'));
 assert.equal(await page.evaluate(()=>window.tgStarted.filter(v=>v.type==='build').length),1);
 await page.keyboard.press('Escape');
 // Feed the same transient event queue used by actual attacks, weather and delivery.
 await page.evaluate(()=>{const s=window.tgScene.sim;s.paused=true;s.sound('dispatch');s.events.push({type:'storm',time:s.time});s.paused=false;});
 await waitSim(page,()=>window.tgStarted.some(v=>v.type==='dispatch'));
 await waitSim(page,()=>window.tgAudio.status.ambience.includes('amb-rain')&&window.tgAudio.status.levels.ambience>0);
 await page.evaluate(()=>{window.tgScene.sim.raid={finished:false};window.tgScene.sim.paused=true;window.tgScene.sim.sound('raid');});
 await playing('music-danger');assert.ok(await page.evaluate(()=>window.tgStarted.some(v=>v.type==='raid')));
 await page.evaluate(()=>{window.tgScene.sim.raid.finished=true;});await playing(localTrack);
 // Dialog context comes from the actual UI, not a test-only music setter.
 const market=page.getByRole('button',{name:'시장',exact:true});await market.click();await playing('music-bustling');
 assert.equal(await page.evaluate(()=>window.tgAudio.dialog),'trade');
 assert.ok(await page.evaluate(()=>window.tgAudio.status.ambience.includes('amb-room')));
 await page.keyboard.press('Escape');await playing(localTrack);
 // Every new sound decodes in both formats and has a nonzero, unclipped signal.
 const decoded=await page.evaluate(async names=>{const c=window.tgAudio.context,results=[];for(const name of names)for(const ext of ['ogg','mp3']){const r=await fetch('/assets/audio/'+name+'.'+ext);if(!r.ok)throw Error(name);const b=await c.decodeAudioData(await r.arrayBuffer()),d=b.getChannelData(0);let peak=0,energy=0;for(const x of d){peak=Math.max(peak,Math.abs(x));energy+=x*x;}results.push({name,ext,seconds:b.duration,peak,rms:Math.sqrt(energy/d.length)});}return results;},[...new Set(Object.values(ACTION_SOUNDS)),'amb-rain']);
 for(const r of decoded){assert.ok(r.peak<1&&r.rms>.005&&r.seconds>.1,JSON.stringify(r));}
 await page.evaluate(()=>window.tgAudio.setMuted(true));
 await page.getByRole('button',{name:'대륙 전체 보기',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.tgAudio.voices.size),0);
 await page.evaluate(()=>window.tgAudio.setMuted(false));await playing('music-explore');
 assert.ok(await page.evaluate(()=>[...window.tgAudio.voices].filter(v=>v.channel==='music').length<=2));
 assert.deepEqual(R.errors,[]);assert.deepEqual(R.consoleErrors,[]);
 assert.deepEqual(R.failedRequests.filter(u=>u.includes('/assets/audio/')),[]);
 console.log('PASS soundscape UI: world/start/town/market/raid, build/dispatch/rotate, weather, mute, '+decoded.length+' decoded SFX files');
}finally{await browser.close();}
