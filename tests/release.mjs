import assert from 'node:assert/strict';
import {Campaign} from '../src/app/game/campaign.js';
import fs from 'node:fs';
import {BUILDINGS} from '../src/app/game/simulation.js';
import {GameAudio,FILES,SAMPLE_FILES,BACKGROUND_FILES,MUSIC,SOUND_PROFILES,WORLD_LIMITS,soundProfileOf} from '../src/app/game/audio.js';
import {SAVE_KEY,RECOVERY_KEY,BACKUP_KEY,encodeSave,decodeSave,writeSave,backupSave,readRecovery} from '../src/app/game/persistence.js';

const memory=()=>{const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
const c=new Campaign({demo:true});
{
 const storage=memory();writeSave(storage,c.save());const first=storage.getItem(SAVE_KEY);backupSave(storage);
 c.active.money-=60;writeSave(storage,c.save());assert.equal(storage.getItem(RECOVERY_KEY),first);assert.equal(storage.getItem(BACKUP_KEY),first);
 const second=storage.getItem(SAVE_KEY);c.active.money-=90;writeSave(storage,c.save());assert.equal(storage.getItem(RECOVERY_KEY),second);assert.equal(storage.getItem(BACKUP_KEY),first);
 storage.setItem(SAVE_KEY,'corrupt');assert.equal(backupSave(storage),false);assert.equal(readRecovery(storage),second);writeSave(storage,c.save());assert.equal(storage.getItem(RECOVERY_KEY),second);
 const before=storage.getItem(SAVE_KEY);assert.throws(()=>writeSave({...storage,setItem(){throw new Error('quota');}},c.save()));assert.equal(storage.getItem(SAVE_KEY),before);
 console.log('PASS rotating recovery preserves independent new-game backup and rejects corrupt replacement');
}
{
 const state=c.spawnState('estern','시험 공국');const data=c.save();
 for(const mutate of [
  d=>d.sites[0].simulation.buildings[0].type='constructor',d=>d.sites[0].nation='__proto__',d=>d.newStates[0].industry='invalid',d=>d.factions[0].wealth=null,d=>d.history=[{day:1,text:{}}],
  d=>d.sites[0].simulation.nextId=1,d=>d.sites[0].simulation.buildings[0].level=0,
  d=>d.sites[0].simulation.pendingEvent={type:'missing',at:3},d=>d.sites[0].simulation.autoSell={bread:'true'},
  d=>d.sites[0].simulation.attackers=[{race:'orc',x:3,z:3,hp:3,maxHp:5,route:[{x:99,z:3}]}],
  d=>d.routes[0].duration='bad',d=>d.lastWorldDay=1000000000,
  d=>d.sites[0].simulation.workers[0].task={kind:'supply',building:9999,item:'water',amount:1},
 ]){const broken=structuredClone(data);mutate(broken);assert.throws(()=>encodeSave(broken));}
 assert.deepEqual(new Campaign({saved:decodeSave(encodeSave(data))}).save(),data);
 for(let i=0;i<24000;i++){c.tick(.25);if(i%1600===0)decodeSave(encodeSave(c.save()));}
 assert.ok(c.newStates.every(s=>s.name.length<90));
 console.log('PASS nested save validation and 75-day world growth with bounded successor names');
}

// Deterministic Web Audio lifecycle test. Browser sample decoding is checked separately.
const original={window:globalThis.window,localStorage:globalThis.localStorage,fetch:globalThis.fetch};
let activeConnections=0,ctx=null;const nodes=[],requests=[],starts=[],tags=new WeakMap();
const param=()=>({value:0,setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;}});
class Node{
 constructor(context){this.ctx=context;this.connections=0;this.targets=[];nodes.push(this);this.gain=param();this.frequency=param();this.pan=param();this.playbackRate=param();this.threshold=param();this.knee=param();this.ratio=param();}
 connect(target){this.connections++;activeConnections++;this.targets.push(target);}disconnect(){activeConnections-=this.connections;this.connections=0;}
 start(when=this.ctx.currentTime,offset=0){this.startedAt=Math.max(when,this.ctx.currentTime);this.offset=offset;starts.push(this);}stop(when){if(when>this.ctx.currentTime){this.stopAt=when;return;}if(this.stopped)return;this.stopped=true;this.onended?.();}
}
class Context{
 constructor(){this.state='running';this.currentTime=1;this.sampleRate=8000;this.destination={};}
 createGain(){return new Node(this);}createOscillator(){return new Node(this);}createBufferSource(){return new Node(this);}createBiquadFilter(){return new Node(this);}createStereoPanner(){return new Node(this);}createDynamicsCompressor(){return new Node(this);}
 createBuffer(c,length){const data=new Float32Array(length);return {getChannelData:()=>data};}
 decodeAudioData(data){const file=(tags.get(data)||'').split('/').pop().replace(/\.(ogg|mp3)$/,'');return Promise.resolve({file,duration:BACKGROUND_FILES.includes(file)?60:.5});}
 resume(){this.state='running';return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}
}
const settle=async()=>{for(let i=0;i<40;i++)await new Promise(resolve=>setImmediate(resolve));};
// One-shot samples end on their own in a real context; emulate that when the mock clock moves.
const advance=(seconds,step,each)=>{for(let t=0;t<seconds;t+=step){ctx.currentTime+=step;for(const n of starts)if(!n.stopped&&(n.stopAt<=ctx.currentTime||n.buffer&&!n.loop&&ctx.currentTime>n.startedAt+n.buffer.duration-n.offset))n.stop();each?.(ctx.currentTime);}};
const audible=voices=>[...voices].filter(v=>v.channel!=='music');
try{
 globalThis.window={AudioContext:Context};globalThis.localStorage=memory();localStorage.setItem('orvetharn-audio',JSON.stringify({volumes:{master:99,music:'bad',effects:-2,ambience:.4},muted:false}));
 globalThis.fetch=async url=>{requests.push(url);return {ok:!url.endsWith('bookPlace1.ogg'),arrayBuffer:async()=>{const b=new ArrayBuffer(8);tags.set(b,url);return b;}};};
 const a=new GameAudio();assert.equal(a.volumes.master,1);assert.equal(a.volumes.music,.48);assert.equal(a.volumes.effects,0);a.start();ctx=a.context;
 await settle();
 assert.equal(a.status.loaded,SAMPLE_FILES.length);assert.equal(a.status.failed,0);assert.ok(requests.includes('/assets/audio/bookPlace1.mp3'));
 for(let i=0;i<100;i++)a.tone(440);assert.ok(a.voices.size<=48);a.paused=true;assert.equal(audible(a.voices).length,0,'pause stops effects and ambience');a.paused=false;
 const connections=activeConnections;a.tone(400);const source=nodes.findLast(n=>n.onended);source.onended();assert.equal(activeConnections,connections);
 a.setVolume('master',NaN);assert.equal(a.volumes.master,1);a.setVolume('invalid',.5);assert.equal(a.volumes.invalid,undefined);
 // Settings sliders drive the three channel gains directly.
 for(const [name,v] of [['music',.2],['effects',.3],['ambience',.1],['master',.7]]){a.setVolume(name,v);assert.equal((name==='master'?a.gain:a[name+'Gain']).gain.value,v,name+' slider');}
 a.noise(.3,.1);const noise=a.noiseBuffer;a.noise(.4,.1);assert.equal(a.noiseBuffer,noise);

 // Background: a music track, the region bed and daytime birds really start, and the playlist never leaves a gap.
 const sim={paused:false,region:'river',time:0,soundEvents:[],buildings:[],layout:{ecology:'meadow'}};
 a.update(sim,{x:12,z:12});a.tick();await settle();a.tick();
 assert.equal(a.status.music,'calm-theme');assert.deepEqual(a.status.ambience.sort(),['amb-river','forest-ambience']);
 const first=a.musicVoice;advance(57.5,.5,()=>a.tick());await settle();a.tick();
 assert.equal(a.musicVoice.name,'music-town','playlist moves on');assert.ok(a.musicVoice.started<=first.ends-3.9,'next track overlaps the end of the last one');
 assert.ok(starts.filter(n=>MUSIC.includes(n.buffer?.file)).length>=2);
 // Region follows the site; the old bed fades out and is released.
 sim.region='coast';a.update(sim,{x:12,z:12});a.tick();await settle();a.tick();advance(5,.5,()=>a.tick());
 assert.ok(a.status.ambience.includes('amb-coast'));assert.ok(!Object.keys(a.beds).includes('amb-river'),'river bed released');
 sim.time=240;a.update(sim,{x:12,z:12});a.tick();await settle();a.tick();assert.ok(a.status.ambience.includes('amb-crickets'),'evening layer');
 // Game pause keeps the music but silences the world; unpausing brings the beds back.
 sim.paused=true;a.update(sim,{x:12,z:12});advance(5,.5,()=>a.tick());assert.ok(a.voices.has(a.musicVoice));assert.deepEqual(a.status.ambience,[]);
 sim.paused=false;a.update(sim,{x:12,z:12});a.tick();assert.ok(a.status.ambience.includes('amb-coast'));
 // Mute stops everything; unmute resumes the same track where it stopped.
 advance(3,.5);const playing=a.musicVoice.name;a.setMuted(true);assert.equal(a.voices.size,0);a.setMuted(false);await settle();a.tick();
 assert.equal(a.musicVoice.name,playing);assert.ok(a.musicVoice.offset>0,'resumes mid-track');
 a.suspend();a.tone(100);assert.equal([...a.voices].filter(v=>v.channel==='effects').length,0);a.context.state='running';

 // Every facility, including one added later without a FILES entry, resolves to a sound family whose files ship.
 const probe='__audioProbeForge';BUILDINGS[probe]={group:'craft',output:'steel'};assert.equal(soundProfileOf(probe),'furnace');delete BUILDINGS[probe];
 for(const type of Object.keys(BUILDINGS)){assert.ok(SOUND_PROFILES[soundProfileOf(type)],'sound profile '+type);assert.ok(FILES[type],'fallback sample '+type);}
 for(const file of new Set([...SAMPLE_FILES,...BACKGROUND_FILES]))for(const ext of ['ogg','mp3'])assert.ok(fs.statSync('public/assets/audio/'+file+'.'+ext).size>100,file+'.'+ext);

 // 24 running facilities around the camera, each producing every frame for 10 s, stay inside the world budget.
 a.stopVoices(['effects']);const types=Object.keys(BUILDINGS).filter(t=>SOUND_PROFILES[soundProfileOf(t)].cadence).slice(0,24);assert.equal(types.length,24);
 const town={paused:false,region:'river',time:0,soundEvents:[],layout:{ecology:'meadow'},buildings:types.map((type,i)=>({id:i+1,type,x:8+i%6*1.5,z:8+Math.floor(i/6)*1.5,working:true,animationTime:0}))};
 const before=starts.length;let peakVoices=0;
 advance(10,1/60,()=>{town.time+=1/60;for(const b of town.buildings){b.animationTime=town.time;town.soundEvents.push({type:b.type,x:b.x,z:b.z});}a.update(town,{x:12,z:12});peakVoices=Math.max(peakVoices,[...a.voices].filter(v=>v.world).length);});
 const effects=starts.slice(before).filter(n=>n.buffer?.file&&!BACKGROUND_FILES.includes(n.buffer.file));
 const perSecond=Math.max(...effects.map(n=>effects.filter(m=>m.startedAt>=n.startedAt&&m.startedAt<n.startedAt+1).length));
 const maxGain=Math.max(...effects.map(n=>n.targets[0].gain.value)),samples=new Set(effects.map(n=>n.buffer.file));
 assert.ok(effects.length>=10,'facilities are audible: '+effects.length);assert.ok(perSecond<=WORLD_LIMITS.perSecond,'effect starts per second '+perSecond);
 assert.ok(maxGain<=WORLD_LIMITS.gain,'max gain '+maxGain);assert.ok(peakVoices<=WORLD_LIMITS.voices,'concurrent '+peakVoices);assert.ok(samples.size>=4,'varied samples '+samples.size);
 console.log(`PASS audio: ${Object.keys(BUILDINGS).length} facilities mapped; 24 working facilities -> ${effects.length} sounds in 10 s, max ${perSecond}/s, max gain ${maxGain.toFixed(3)}, ${peakVoices} concurrent, ${samples.size} samples`);
 a.dispose();assert.equal(activeConnections,0);assert.equal(a.voices.size,0);
 console.log('PASS audio fallback, volume sanitation, voice cap, background playlist/beds, pause/mute, reusable noise and full node cleanup');
}finally{Object.assign(globalThis,original);}
console.log('RELEASE REGRESSIONS PASS');
