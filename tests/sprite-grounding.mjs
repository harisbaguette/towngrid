import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import * as THREE from 'three';
import {groundSprite} from '../src/app/game/sprite-grounding.js';
import {QUARTER_POLAR,quarterAzimuth} from '../src/app/game/quarter-camera.js';
import {PIXEL_HEIGHT} from '../src/app/game/pixel-character-data.js';
import {stationRailPath,railPathPose} from '../src/app/game/freight-path.js';
import {makePixelVehicle} from '../src/app/game/pixel-environment.js';
import {VEHICLE_ANCHORS} from '../src/app/game/vehicle-art.js';

let samples=0;
const sprite=new THREE.Sprite(new THREE.SpriteMaterial());
for(const id of readdirSync('public/assets/pixel-characters')){
 const file=`public/assets/pixel-characters/${id}/frames.json`;
 let meta;try{meta=JSON.parse(readFileSync(file));}catch{continue;}
 for(let view=0;view<4;view++){
  const azimuth=quarterAzimuth(view),camera=new THREE.OrthographicCamera(-2,2,2,-2,.1,100);
  camera.position.setFromSphericalCoords(20,QUARTER_POLAR,azimuth);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
  // The largest supported body also bounds all smaller residents and enemies.
  sprite.scale.set(PIXEL_HEIGHT.titan,PIXEL_HEIGHT.titan,1);
  for(const anchor of meta.anchors[view])for(const height of [.035,.16]){
   sprite.center.set(anchor[0],1-anchor[1]);groundSprite(sprite,{azimuth,height});
   const expected=new THREE.Vector3(0,height,0).project(camera),actual=sprite.position.clone().project(camera);
   assert.ok(Math.abs(actual.x-expected.x)<1e-10&&Math.abs(actual.y-expected.y)<1e-10,'depth correction cannot move the foot on screen');
   for(const x of [0,1]){
    const bottom=sprite.position.clone().addScaledVector(right,(x-sprite.center.x)*sprite.scale.x).addScaledVector(up,-sprite.center.y*sprite.scale.y);
    assert.ok(bottom.y>=.009999,'every frame, including extended shoes, clears the ground');
   }
   samples++;
  }
 }
}
for(let view=0;view<4;view++)for(let heading=0;heading<4;heading++){
 const train=makePixelVehicle('rail');train.rotation.y=heading*Math.PI/2;train.userData.animate(0,null,false,view);
 const camera=new THREE.OrthographicCamera(-2,2,2,-2,.1,100);camera.position.setFromSphericalCoords(20,QUARTER_POLAR,quarterAzimuth(view));camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const body=train.userData.sprite.getWorldPosition(new THREE.Vector3()).project(camera),origin=new THREE.Vector3().project(camera);
 assert.ok(Math.abs(body.x-origin.x)<1e-10&&Math.abs(body.y-origin.y)<1e-10,'train footprint stays centred on its rail in all headings');
 assert.equal(train.userData.sprite.center.y,1-VEHICLE_ANCHORS.cargoTrainEmpty[1]);
 assert.equal(train.userData.sprite.material.depthTest,true,'foreground buildings still occlude the train');
}
const station={type:'station',x:0,z:0,health:100},sim={buildings:[station],rails:new Set(['1,0','2,0','2,1','2,2','10,10']),tile:()=>({terrain:'grass'}),at:()=>null};
const before=JSON.stringify([...sim.rails]),path=stationRailPath(sim);
assert.deepEqual(path[0],{x:.5,z:0});assert.deepEqual(path.at(-1),{x:2,z:2});
for(let step=0;step<=100;step++){
 const pose=railPathPose(path,step/100);
 assert.ok(sim.rails.has(Math.round(pose.x)+','+Math.round(pose.z)),'train only travels on connected rails');
 const back=railPathPose(path,1-step/100,true);
 assert.ok(Math.hypot(pose.x-back.x,pose.z-back.z)<1e-8);
}
const curve=path.filter(p=>p.x>1.5&&p.z<.5);
assert.ok(curve.length>3);
for(const p of curve)assert.ok(Math.abs(Math.hypot(p.x-1.5,p.z-.5)-.5)<1e-8,'corner follows the rendered curved rail');
assert.equal(JSON.stringify([...sim.rails]),before,'visual paths never mutate the save');
sim.rails.delete('1,0');assert.deepEqual(stationRailPath(sim),[]);assert.equal(railPathPose([],0),null);
sim.rails=new Set(['1,0']);assert.deepEqual(railPathPose(stationRailPath(sim),.5),{x:1,z:0,dir:Math.PI/2});
station.health=0;assert.deepEqual(stationRailPath(sim),[]);
for(const file of ['art-source/pixel-environment/pack-manifest.json','public/assets/pixel-environment/frames.json']){
 const manifest=JSON.parse(readFileSync(file));
 for(const id of ['cargoTrainEmpty','cargoTrainEmptyMotion'])assert.deepEqual(manifest.assets[id].anchor,VEHICLE_ANCHORS.cargoTrainEmpty);
}
console.log(`Sprite grounding PASS: ${samples} character poses, 16 rail views/headings, connected/curved/disconnected/single rails, inbound travel and save isolation.`);
