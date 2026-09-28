import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {BUILDINGS,RESOURCES,Simulation} from '../src/app/game/simulation.js';
import {ENVIRONMENT_ASSETS} from '../src/app/game/pixel-environment-data.js';
import {RESOURCE_ICONS,RESOURCE_FRAMES} from '../src/app/game/resource-art.js';
import {SERVICE_OUTPUTS,productionVisualState} from '../src/app/game/production-visuals.js';
import {VEHICLE_ART,shipmentVehicle,shipmentLoaded} from '../src/app/game/vehicle-art.js';
import {makePixelBuilding,makePixelVehicle} from '../src/app/game/pixel-environment.js';
import {VEHICLES} from '../src/app/game/export-route.js';

for(const id of [...Object.keys(RESOURCES),...Object.keys(SERVICE_OUTPUTS)]){
 assert.ok(RESOURCE_ICONS[id],id+' has an authored icon');
 const png=await readFile(new URL('../public'+RESOURCE_ICONS[id],import.meta.url));assert.equal(png.readUInt32BE(16),96);
}
for(const id of Object.keys(VEHICLES))assert.ok(VEHICLE_ART[id],id+' has its own vehicle art');
for(const [id,spec] of Object.entries(ENVIRONMENT_ASSETS)){
 const png=await readFile(new URL('../public'+spec.sheet,import.meta.url));
 assert.equal(png.readUInt32BE(16),192*spec.frames,id+' columns');assert.equal(png.readUInt32BE(20),192*(spec.directions||1),id+' directions');
}
const land={tile:()=>({terrain:'grass'})},water={tile:()=>({terrain:'water'})},pose={x:2,z:2};
for(const [kind,dry,wet] of [['raft','wagon','raft'],['steamer','truck','steamer'],['truck','truck','truck'],[undefined,'wagon','wagon']]){
 assert.equal(shipmentVehicle({vehicle:kind},land,pose),dry);assert.equal(shipmentVehicle({vehicle:kind},water,pose),wet);
}
assert.equal(shipmentVehicle({vehicle:'truck'},{...land,layout:{ecology:'snow'}},pose),'sled');
for(const kind of ['import','contract',undefined])for(const phase of ['out','back'])assert.equal(shipmentLoaded({kind,phase}),kind==='import'?phase==='back':phase==='out');
for(const id of Object.keys(VEHICLE_ART)){
 const m=makePixelVehicle(id,'copper');
 for(let view=0;view<4;view++)for(let heading=0;heading<4;heading++){
  m.rotation.y=heading*Math.PI/2;m.userData.animate(0,null,false,view);
  assert.equal(m.userData.direction,(view-heading+4)%4);
  assert.ok(m.userData.cargo.position.toArray().every(Number.isFinite));
  if(!['plane','airship'].includes(id))assert.equal(m.userData.cargo.userData.frame,RESOURCE_FRAMES.copper);
  m.userData.loaded=false;m.userData.animate(0,null,false,view);assert.equal(m.userData.cargo.visible,false);m.userData.loaded=true;
 }
}
const sim=new Simulation();let recipes=0;
for(const [type,def] of Object.entries(BUILDINGS).filter(([,d])=>!d.tile)){
 const m=makePixelBuilding(type,'human');assert.ok(m,type);
 const b={type,health:100,enabled:true,working:false,progress:0,out:8,inputs:{},animationTime:0};
 for(const health of [100,65,25,0,100])for(let view=0;view<4;view++){
  b.health=health;m.userData.animate(0,b,{time:0},view);
  const find=name=>m.userData.layers.find(l=>l.name===name);
  assert.equal(find('damage-cracks').visible,health<100,type+' damage');
  assert.equal(find('damage-rubble').visible,health<=0,type+' rubble');
  assert.equal(find('repair-needed').visible,health<=0,type+' repair');
  assert.equal(m.rotation.z,0,type+' architecture must not tilt');
 }
 for(const recipe of def.recipes||[]){
  b.recipe=recipe.id;b.health=100;const context={time:2,recipeOf:()=>recipe,poweredAt:()=>true};
  const state=productionVisualState(type,b,context);assert.equal(state.output,recipe.output);
  m.userData.animate(2,b,context,0);
  if(!state.service&&!['well','lumber','sawmill','field'].includes(type)){
   const piles=m.userData.layers.filter(l=>l.name.startsWith('output-'));
   assert.ok(piles.some(l=>l.visible),type+' '+recipe.id+' stock is visible');
   for(const p of piles)assert.equal(p.userData.frame,RESOURCE_FRAMES[recipe.output],type+' actual output artwork');
  }
  recipes++;
 }
}
assert.deepEqual(new Simulation('river',sim.save()).save().stock,sim.save().stock,'illustrations do not change saved inventory');
console.log(`Art coverage passed: 82 buildings, 10 vehicles × 4 headings × 4 views, 42 UI icons, ${recipes} recipes, damage/repair and shipment loading.`);
