import assert from 'node:assert/strict';
import {Campaign} from '../app/game/campaign.js';
import {GameAudio,FILES,SAMPLE_FILES} from '../app/game/audio.js';
import {SAVE_KEY,RECOVERY_KEY,BACKUP_KEY,encodeSave,decodeSave,writeSave,backupSave,readRecovery} from '../app/game/persistence.js';

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
let activeConnections=0;const nodes=[];const requests=[];
const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){}});
class Node{
 constructor(){this.connections=0;nodes.push(this);this.gain=param();this.frequency=param();this.pan=param();this.playbackRate=param();this.threshold=param();this.knee=param();this.ratio=param();}
 connect(){this.connections++;activeConnections++;}disconnect(){activeConnections-=this.connections;this.connections=0;}start(){}stop(){this.onended?.();}
}
class Context{
 constructor(){this.state='running';this.currentTime=1;this.sampleRate=8000;this.destination={};}
 createGain(){return new Node();}createOscillator(){return new Node();}createBufferSource(){return new Node();}createBiquadFilter(){return new Node();}createStereoPanner(){return new Node();}createDynamicsCompressor(){return new Node();}
 createBuffer(c,length){const data=new Float32Array(length);return {getChannelData:()=>data};}
 decodeAudioData(){return Promise.resolve({duration:.5});}resume(){this.state='running';return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}
}
try{
 globalThis.window={AudioContext:Context};globalThis.localStorage=memory();localStorage.setItem('orvetharn-audio',JSON.stringify({volumes:{master:99,music:'bad',effects:-2,ambience:.4},muted:false}));
 globalThis.fetch=async url=>{requests.push(url);return {ok:!url.endsWith('bookPlace1.ogg'),arrayBuffer:async()=>new ArrayBuffer(8)};};
 const a=new GameAudio();assert.equal(a.volumes.master,1);assert.equal(a.volumes.music,.48);assert.equal(a.volumes.effects,0);a.start();
 for(let i=0;i<20&&a.loading;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(a.status.loaded,SAMPLE_FILES.length);assert.equal(a.status.failed,0);assert.ok(requests.includes('/assets/audio/bookPlace1.mp3'));
 for(let i=0;i<100;i++)a.tone(440);assert.ok(a.voices.size<=48);a.paused=true;assert.equal(a.voices.size,0);
 const connections=activeConnections;a.tone(400);const source=nodes.findLast(n=>n.onended);source.onended();assert.equal(a.voices.size,0);assert.equal(activeConnections,connections);
 a.setVolume('master',NaN);assert.equal(a.volumes.master,1);a.setVolume('invalid',.5);assert.equal(a.volumes.invalid,undefined);
 a.noise(.3,.1);const noise=a.noiseBuffer;a.noise(.4,.1);assert.equal(a.noiseBuffer,noise);a.setMuted(true);assert.equal(a.voices.size,0);
 a.setMuted(false);a.suspend();a.tone(100);assert.equal(a.voices.size,0);a.dispose();assert.equal(activeConnections,0);assert.equal(a.voices.size,0);
 console.log('PASS audio fallback, volume sanitation, voice cap, pause/mute, reusable noise and full node cleanup');
}finally{Object.assign(globalThis,original);}
console.log('RELEASE REGRESSIONS PASS');
