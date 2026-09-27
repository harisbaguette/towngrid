import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RESIDENT_LOOKS} from '../app/game/resident-roster.js';
import {Simulation,createShowcase} from '../app/game/simulation.js';
globalThis.self=globalThis;
globalThis.ProgressEvent=class {constructor(type,values){Object.assign(this,values);}};
const loader=new GLTFLoader();let clips=0;
for(const [race,looks]of Object.entries(RESIDENT_LOOKS))for(const look of looks){
 const bytes=await fs.readFile('public/assets/erdynth/'+look.model+'.glb');
 const data=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const root=data.scene,mixer=new THREE.AnimationMixer(root),arm=root.getObjectByName('ArmL'),foot=root.getObjectByName(race==='centaur'?'Hoof0':'LegL');
 assert.ok(arm&&foot,look.id+' has separately articulated limbs');
 const samples={};
 for(const name of ['Idle','Walk','Walk_Carry','Work','Pickup','Drop','Attack']){
  const clip=data.animations.find(c=>c.name===name);assert.ok(clip,look.id+' '+name);
  for(const track of clip.tracks)assert.ok(root.getObjectByName(track.name.split('.')[0]),track.name+' has a target');
  mixer.stopAllAction();mixer.clipAction(clip).reset().play();mixer.update(clip.duration*.25);root.updateMatrixWorld(true);
  const size=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  assert.ok([size.x,size.y,size.z].every(v=>Number.isFinite(v)&&v>0&&v<4),look.id+' finite animated bounds');
  samples[name]={arm:arm.quaternion.clone(),foot:foot.quaternion.clone()};clips++;
 }
 assert.ok(samples.Idle.foot.angleTo(samples.Walk.foot)>.25,look.id+' walks with its legs');
 assert.ok(samples.Walk.arm.angleTo(samples.Walk_Carry.arm)>.5,look.id+' holds parcels with distinct arm pose');
 assert.ok(samples.Walk_Carry.foot.angleTo(samples.Idle.foot)>.25,look.id+' carries without freezing legs');
 mixer.stopAllAction();mixer.uncacheRoot(root);
}
for(const nation of ['estern','silvaen']){
 const sim=createShowcase(nation),old=sim.save();
 assert.ok(sim.workers.some(w=>w.gender==='female')&&sim.workers.some(w=>w.gender==='male'));
 const before=sim.workers.map(w=>[w.id,w.race,w.appearance,w.gender,w.name]);
 const restored=new Simulation(sim.region,old);assert.deepEqual(restored.workers.map(w=>[w.id,w.race,w.appearance,w.gender,w.name]),before,'identity survives save restore');
 for(const w of old.workers){delete w.appearance;delete w.gender;}
 const migrated=new Simulation(sim.region,old);assert.ok(migrated.workers.every(w=>w.appearance&&w.gender));
 assert.deepEqual(migrated.workers.map(w=>w.name),old.workers.map(w=>w.name),'migration retains existing names');
}
const manifest=JSON.parse(await fs.readFile('public/assets/erdynth/manifest.json','utf8'));
for(const name of ['Tugboat','PatrolBoat','Lighthouse','Pickaxe','Axe','Hammer','Lantern','Bucket']){
 assert.ok(manifest.assets.some(a=>a.name===name));const bytes=await fs.readFile('public/assets/erdynth/'+name+'.glb');
 const data=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const size=new THREE.Box3().setFromObject(data.scene).getSize(new THREE.Vector3());assert.ok(size.x>0&&size.y>0&&size.z>0);
 if(name==='Lighthouse')assert.ok(data.scene.getObjectByName('Beacon'),'rotating light exists');
}
console.log(`PASS: 18 original residents, ${clips} clips, 8 props; both alliances retain identity and migrate legacy saves.`);
