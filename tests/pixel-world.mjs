import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {BUILDINGS,Simulation} from '../src/app/game/simulation.js';
import {ENVIRONMENT_ASSETS,PIXEL_BUILDINGS} from '../src/app/game/pixel-environment-data.js';
import {EXPANSION_BUILDINGS} from '../src/app/game/pixel-expansion-data.js';
import {makePixelBuilding,makePixelProp} from '../src/app/game/pixel-environment.js';
import {SERVICE_OUTPUTS} from '../src/app/game/production-visuals.js';
import {makeMapTerrain,connectionMask,waterKind,landscapeWater} from '../src/app/game/pixel-terrain.js';
import {networkSamples} from '../src/app/game/pixel-network.js';
import {makeBuilding} from '../src/app/game/models.js';

assert.deepEqual(Object.keys(BUILDINGS).filter(id=>!BUILDINGS[id].tile).sort(),[...PIXEL_BUILDINGS].sort(),'Every current facility must have authored art');
// The game entry point must use the same pixel art as previews, with no 3D fallback.
for(const [id,def] of Object.entries(BUILDINGS)){
 const model=makeBuilding(id,'human');
 if(def.tile)assert.ok(model.children.every(m=>ENVIRONMENT_ASSETS[m.userData.environmentId]),id+' authored network texture');
 else {assert.equal(model.userData.buildingType,id,id+' runtime identity');assert.ok(ENVIRONMENT_ASSETS[model.userData.environmentId],id+' runtime sprite');}
}
assert.throws(()=>makeBuilding('missing-art'),/Missing pixel building/);
for(const [id,spec] of Object.entries(ENVIRONMENT_ASSETS)){
 const png=await readFile(new URL('../public'+spec.sheet,import.meta.url));
 assert.equal(png.readUInt32BE(16),192*spec.frames,id+' atlas columns');
 assert.equal(png.readUInt32BE(20),192*(spec.directions||1),id+' atlas rows');
}
const pose=m=>m.userData.layers.map(l=>[l.visible,l.userData.frame,...l.position.toArray(),...l.userData.sprite.scale.toArray(),l.userData.sprite.material.rotation]);
for(const type of EXPANSION_BUILDINGS){
 const model=makePixelBuilding(type,'human'),def=BUILDINGS[type];
 const b={type,x:12,z:12,enabled:true,health:100,working:true,progress:.4,out:0,animationTime:2,activeUntil:0,inputs:Object.fromEntries(Object.entries(def.inputs||{}).map(([id,n])=>[id,n*3]))};
 const sim={time:5,power:true,poweredAt:()=>true};
 for(let view=0;view<4;view++){
  const before=JSON.stringify(b);model.userData.animate(5,b,sim,view);
  assert.equal(model.userData.frame,0);assert.equal(model.userData.direction,view);
  assert.equal(model.userData.layers.some(l=>l.name.startsWith('output-')&&l.visible),false);
  const frozen=pose(model);model.userData.animate(200,b,sim,view);assert.deepEqual(pose(model),frozen,type+' pause');assert.equal(JSON.stringify(b),before);
  if([1,2].includes(view))for(const layer of model.userData.layers.filter(l=>/^(fire|shuttle|needle|workpiece|ram|hen|reel)-/.test(l.name)))assert.equal(layer.visible,false,type+' rear occlusion');
 }
 for(const count of [1,5,10,0]){
  model.userData.animate(5,{...b,out:count},sim,0);
  if(def.output&&!SERVICE_OUTPUTS[def.output])assert.equal(model.userData.layers.some(l=>l.name.startsWith('output-')&&l.visible),count>0,type+' actual inventory');
 }
 if(SERVICE_OUTPUTS[def.output]){
  model.userData.animate(5,{...b,activeUntil:10},sim,0);assert.equal(model.userData.production.active,true);
  model.userData.animate(11,{...b,activeUntil:10},{...sim,time:11},0);assert.equal(model.userData.production.active,false);
  model.userData.animate(5,{...b,activeUntil:10,enabled:false},sim,0);assert.equal(model.userData.production.active,false);
 }
 assert.doesNotThrow(()=>model.userData.animate(0,{working:false,inputs:{}},new Simulation(),3),type+' ghost');
}
for(const region of ['river','coast','highland']){
 const sim=new Simulation(region);sim.roads.add('10,10');sim.paved.add('10,10');sim.roads.add('11,10');sim.pipes.add('12,10');sim.conveyors.add('13,10');
 const before=JSON.stringify(sim.save()),terrain=makeMapTerrain(sim);
 const surface=(x,z,layer)=>terrain.children.find(m=>m.userData.layer===layer&&m.userData.cells.some(c=>c.x===x&&c.z===z));
 assert.equal(surface(10,10,5).userData.environmentId,'infrastructureGround');assert.equal(surface(10,10,5).userData.frame,3);
 assert.equal(surface(11,10,5).userData.environmentId,'ground');assert.equal(surface(11,10,5).userData.frame,6);
 assert.equal(surface(12,10,6).userData.frame,4);assert.equal(surface(13,10,6).userData.frame,6);
 for(const t of sim.tiles.filter(t=>t.terrain==='water'))assert.equal(surface(t.x,t.z,1).userData.environmentId,waterKind(region,t.x,t.z));
 terrain.userData.animate(.4);assert.equal(terrain.userData.water.userData.frame,1);
 assert.equal(JSON.stringify(sim.save()),before,'Art must not change a save');
 for(const z of [0,23])for(let x=0;x<24;x++)assert.equal(landscapeWater(region,x,z),sim.tile(x,z).terrain==='water','river/sea continues across map edges');
}
for(let mask=0;mask<16;mask++){
 assert.equal(connectionMask(0,0,(x,z)=>!!(mask&({'0,-1':1,'1,0':2,'0,1':4,'-1,0':8}[x+','+z]))),mask);
 for(const [bit,u,v] of [[1,.38,.999],[2,.999,.38],[4,.38,.001],[8,.001,.38]]){
  const samples=networkSamples(mask,u,v);assert.equal(samples.some(([s])=>s>.25&&s<.75),!!(mask&bit),'network edge '+mask+'/'+bit);
  for(const uv of samples)assert.ok(uv.every(Number.isFinite));
 }
}
for(const id of ['rock','mossrock','oreRock','cliff','pine','willow','palm','reeds','ruin','lighthouse','cargoTruck','cargoTrain','fishingBoat']){
 const p=makePixelProp(id);for(let view=0;view<4;view++){p.userData.animate(20,null,false,view);assert.equal(p.userData.direction,view);}
}
console.log('World art: '+PIXEL_BUILDINGS.length+' facilities, '+EXPANSION_BUILDINGS.length+' new profiles; atlas coverage, stock/pause/services, terrain/save/roads, and 16 network topologies passed.');
