import assert from 'node:assert/strict';
import {makePixelBuilding} from '../src/app/game/pixel-environment.js';
import {INDUSTRY_BUILDINGS,INDUSTRIAL_GOODS} from '../src/app/game/pixel-industry-data.js';
import {productionVisualState,SERVICE_OUTPUTS} from '../src/app/game/production-visuals.js';
import {BUILDINGS,Simulation} from '../src/app/game/simulation.js';

assert.equal(INDUSTRY_BUILDINGS.length,35);
const sim=new Simulation();
const pose=m=>m.userData.layers.map(l=>[l.visible,...l.position.toArray(),...l.userData.sprite.scale.toArray(),l.userData.sprite.material.rotation]);
for(const type of INDUSTRY_BUILDINGS){
 const def=BUILDINGS[type],model=makePixelBuilding(type,'human');
 const inputs=Object.fromEntries(Object.entries(def.inputs||{}).map(([id,n])=>[id,n*2]));
 const b={type,health:100,enabled:true,working:true,progress:.4,out:0,inputs,animationTime:.5,activeUntil:0};
 const supply=!!SERVICE_OUTPUTS[def.output],material=INDUSTRIAL_GOODS[def.output]!==undefined;
 const context={time:20,power:true,batteryCharge:65,stage:1,health:{nextCare:30}};
 const before=JSON.stringify({b,context});
 for(let view=0;view<4;view++){
  model.userData.animate(20,b,context,view);
  assert.equal(model.userData.frame,0,type);assert.equal(model.userData.direction,view);
  assert.equal(model.userData.layers.filter(l=>l.name.startsWith('output-')&&l.visible).length,0);
  const frozen=pose(model);model.userData.animate(100,b,context,view);assert.deepEqual(pose(model),frozen,type+' simulation pause');
  for(const l of model.userData.layers)assert.ok(l.position.toArray().every(Number.isFinite),type+' finite layer coordinates');
 }
 assert.equal(JSON.stringify({b,context}),before,type+' render must not modify state');
 for(const out of [1,6,10,0]){
  model.userData.animate(20,{...b,out},context,0);
  assert.equal(model.userData.layers.some(l=>l.name.startsWith('output-')&&l.visible),material&&out>0,type+' exact stock source');
 }
 if(supply){
  const live={...b,activeUntil:65,progress:0,working:false};
  const state=productionVisualState(type,live,context);
  assert.equal(state.phase,'supplying');assert.equal(state.count,0);assert.equal(state.displayValue,'90초');
  assert.equal(productionVisualState(type,live,{...context,time:66}).active,false);
  assert.equal(productionVisualState(type,{...live,enabled:false},context).active,false);
  assert.equal(productionVisualState(type,{...live,health:0},context).active,false);
  if(def.power)assert.equal(productionVisualState(type,live,{...context,power:false}).active,false);
  if(def.output==='power')assert.equal(productionVisualState(type,live,{...context,outageUntil:50}).active,false);
 }
 if(def.power){
  const state=productionVisualState(type,b,{...context,power:false});
  if(state){assert.equal(state.working,false);assert.equal(state.label,'전력 부족');}
 }
 // Building placement passes a deliberately sparse ghost, without a type/coords.
 assert.doesNotThrow(()=>model.userData.animate(0,{working:false,inputs:{}},sim,3));
}
const battery=makePixelBuilding('battery','human');
for(const [charge,lamps] of [[0,0],[1,1],[30,1],[31,2],[60,2],[61,3]]){
 battery.userData.animate(0,{health:100},{batteryCharge:charge},0);
 assert.equal(battery.userData.layers.filter(l=>l.visible).length,lamps);
}
console.log('35 industry buildings: four views, fixed architecture, inventory, service expiry/power/disable, paused tools, battery and sparse ghosts passed.');
