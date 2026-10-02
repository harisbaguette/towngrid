import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {characterPose} from '../src/app/game/character-motion-state.js';
import {pixelFrame,pixelDirection} from '../src/app/game/pixel-character-data.js';
import {createPixelCharacter,animatePixelCharacter} from '../src/app/game/pixel-characters.js';
import {pixelMetadata} from '../src/app/game/pixel-character-meta.js';
import {SoftwareRenderer} from '../src/app/game/software-renderer.js';
import * as THREE from 'three';
import {QUARTER_POLAR} from '../src/app/game/quarter-camera.js';
const meta=JSON.parse(readFileSync('public/assets/pixel-characters/garen/frames.json'));
const camera=Math.PI/4,state={},worker={dir:0,hp:75,walking:true};
let pose=characterPose(state,worker,0,camera,meta,.14);
assert.equal(pose.action,'walk');
const before=pose.frame;
pose=characterPose(state,worker,4,camera,meta,.14);
assert.equal(pose.frame,before,'pause and elapsed time cannot advance distance-driven feet');
worker.dir=Math.PI/2;
pose=characterPose(state,worker,4,camera,meta,.15);
assert.equal(pose.action,'walk','moving corners must keep the distance-driven gait');
assert.equal(pose.direction,pixelDirection(worker.dir,camera));
pose=characterPose(state,worker,4.11,camera,meta,.15);
assert.equal(pose.direction,pixelDirection(worker.dir,camera));
pose=characterPose(state,worker,4.21,camera,meta,.15);
assert.equal(pose.action,'walk');
assert.equal(pose.frame,pixelFrame('walk',.15/meta.clips.walk.strideLength*12/meta.clips.walk.fps,1,meta));
pose=characterPose(state,worker,5,camera+Math.PI/2,meta,.15);
assert.equal(pose.action,'walk','camera rotation is not an actor pivot');
worker.attacking=true;worker.walking=false;
pose=characterPose(state,worker,6,camera+Math.PI/2,meta,.15);
assert.equal(pose.action,'attack');
assert.ok(meta.clips.attack.frames.every(frame=>!meta.clips.work.frames.includes(frame)));
worker.hp=60;
pose=characterPose(state,worker,6.05,camera+Math.PI/2,meta,.15);
assert.equal(pose.action,'hurt');
pose=characterPose(state,worker,6.26,camera+Math.PI/2,meta,.15);
assert.equal(pose.action,'attack');
worker.hp=0;
pose=characterPose(state,worker,6.3,camera+Math.PI/2,meta,.15);
assert.equal(pose.action,'defeat');
assert.equal(characterPose(state,worker,20,camera+Math.PI/2,meta,.15).frame,meta.clips.defeat.frames.at(-1));
assert.equal(meta.authoredDefeat,true);

// Exercise every authored rig at all camera angles, not only one guard's clips.
const metadata=readdirSync('public/assets/pixel-characters',{withFileTypes:true})
 .filter(entry=>entry.isDirectory())
 .map(entry=>JSON.parse(readFileSync(`public/assets/pixel-characters/${entry.name}/frames.json`)));
for(const rig of metadata)for(let view=0;view<4;view++){
 const azimuth=camera+view*Math.PI/2,s={},w={dir:0,walking:true,task:{carried:true}};
 characterPose(s,w,0,azimuth,rig,.1);
 for(let corner=1;corner<=4;corner++){
  w.dir=corner*Math.PI/2;
  const d=.1+corner*.04,p=characterPose(s,w,corner*.03,azimuth,rig,d);
  assert.equal(p.action,'carry',`${rig.id}: cargo survives consecutive corners`);
  assert.equal(p.direction,pixelDirection(w.dir,azimuth));
  assert.equal(p.frame,pixelFrame('carry',d/rig.clips.carry.strideLength*rig.clips.carry.frames.length/rig.clips.carry.fps,1,rig));
 }
 w.walking=false;
 const holding=characterPose(s,w,.2,azimuth,rig,.26);
 assert.equal(holding.action,'carry');
 assert.equal(holding.frame,rig.clips.pickup.frames.at(-1),'waiting carrier keeps a box and planted feet');
 assert.equal(characterPose(s,w,5,azimuth,rig,.26).frame,holding.frame);
 for(const action of ['pickup','drop']){
  w.handling=action;w.dir+=Math.PI/2;
  for(const elapsed of [0,.09,.18,.36,.5]){
   w.handlingTime=elapsed;
   const p=characterPose(s,w,6+elapsed,azimuth,rig,.26);
   assert.equal(p.action,action,`${rig.id}: facing a building must not hide ${action}`);
   assert.equal(p.frame,pixelFrame(action,elapsed,1,rig));
  }
 }
 w.handling=null;w.task=null;w.working=true;w.dir+=Math.PI/2;
 assert.equal(characterPose(s,w,7,azimuth,rig,.26).action,'work','turn must not hide tools');
 w.working=false;
 characterPose(s,w,8,azimuth,rig,.26);
 const previous=pixelDirection(w.dir,azimuth);w.dir+=Math.PI/2;
 assert.equal(characterPose(s,w,9,azimuth,rig,.26).action,'turn','stationary foot pivot is retained');
 assert.equal(characterPose(s,w,9.01,azimuth,rig,.26).direction,previous);
 assert.equal(characterPose(s,w,9.11,azimuth,rig,.26).direction,pixelDirection(w.dir,azimuth));
 // Movement interrupts an in-place turn immediately, without restarting gait.
 w.walking=true;
 assert.equal(characterPose(s,w,9.12,azimuth,rig,.27).action,'walk');
 assert.equal(characterPose(s,w,9.13,azimuth+Math.PI/2,rig,.27).action,'walk');
}
assert.equal(metadata.length,51);

const injury={},damaged={dir:0,hp:75,attacking:true};
characterPose(injury,damaged,0,camera,meta);
damaged.hp=74;characterPose(injury,damaged,.01,camera,meta);
damaged.hp=73;
assert.equal(characterPose(injury,damaged,.13,camera,meta).frame,meta.clips.hurt.frames[1],
 'continuous damage must not reset the flinch to its first frame every tick');

// Canvas must draw the same fallen frame and anchor as WebGL, not rotate an
// already prone body again. Both the body and its shadow must finish fading.
pixelMetadata.set('garen',meta);
const model=createPixelCharacter(0,'human','garen'),fallen={x:0,z:0,dir:0,hp:0};
animatePixelCharacter(model,fallen,0);
animatePixelCharacter(model,fallen,.7);
model.userData.image={width:8192,height:512};
const calls=[],ctx=new Proxy({}, {get:(_,key)=>(...args)=>calls.push([key,...args]),set:()=>true});
const testCamera=new THREE.OrthographicCamera(-2,2,2,-2,.1,100);
testCamera.position.setFromSphericalCoords(20,QUARTER_POLAR,Math.PI/4);testCamera.lookAt(0,0,0);testCamera.updateMatrixWorld();
const project=(x,y,z)=>{const p=new THREE.Vector3(x,y,z).project(testCamera);return {x:256+p.x*256,y:256-p.y*256};};
const center=project(model.position.x,model.position.y,model.position.z);
SoftwareRenderer.prototype.drawPixelCharacter.call({ctx,pixelsPerWorldUnit:128,project},model,center);
assert.equal(calls.some(([name])=>name==='rotate'),false,'authored defeat stays upright in atlas coordinates');
const draw=calls.find(([name])=>name==='drawImage');
assert.equal(draw[2],meta.clips.defeat.frames.at(-1)*128);
const size=Math.round(model.userData.pixelHeight*128);
const world=model.userData.sprite.getWorldPosition(new THREE.Vector3()),anchor=project(world.x,world.y,world.z);
assert.equal(draw[6],Math.round(anchor.x-size*model.userData.sprite.center.x));
assert.equal(draw[7],Math.round(anchor.y-size*(1-model.userData.sprite.center.y)));
animatePixelCharacter(model,fallen,1.4);
assert.ok(model.userData.shadow.material.opacity>0&&model.userData.shadow.material.opacity<.16);
animatePixelCharacter(model,fallen,2.1);
assert.equal(model.userData.sprite.material.opacity,0);assert.equal(model.userData.shadow.material.opacity,0);
fallen.hp=75;animatePixelCharacter(model,fallen,2.2);
assert.equal(model.userData.shadow.material.opacity,.16);
model.traverse(object=>{if(object.isMesh&&!object.geometry.userData.shared)object.geometry.dispose();});
model.userData.texture.dispose();model.userData.sprite.material.dispose();model.userData.shadow.material.dispose();
pixelMetadata.delete('garen');
console.log('Character motion: 51 rigs × 4 views, moving cargo, handling, planted pivots, damage, CPU defeat and fading shadows PASS');
