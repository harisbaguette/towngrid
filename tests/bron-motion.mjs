import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createPixelCharacter,animatePixelCharacter} from '../src/app/game/pixel-characters.js';
import {pixelMetadata} from '../src/app/game/pixel-character-meta.js';
import {pixelAtlasFrame} from '../src/app/game/pixel-character-data.js';
import {SoftwareRenderer} from '../src/app/game/software-renderer.js';

const meta=JSON.parse(readFileSync('public/assets/pixel-characters/bron/frames.json'));
pixelMetadata.set('bron',meta);
const model=createPixelCharacter(0,'dwarf','bron');
model.userData.image={width:8192,height:512};
const camera=new THREE.OrthographicCamera(-2,2,2,-2,.1,100);
const worker={id:1,x:3,z:4,dir:0,hp:75};
assert.equal(meta.motionRevision,'bron-weight-and-hammer-1');
assert.equal(meta.frameScales.length,64);
assert.ok(meta.frameScales.every(scale=>Number.isFinite(scale)&&scale>=1&&scale<1.5));
assert.equal(meta.clips.walk.strideLength,meta.clips.carry.strideLength,'cargo must preserve foot phase');
const walk=meta.rigAudit[0].filter(frame=>frame.action==='walk');
assert.ok(Math.max(...walk.map(frame=>frame.chestTurn))-Math.min(...walk.map(frame=>frame.chestTurn))>5,'chest counter-rotation');
for(let frame=0;frame<6;frame++){
 const foot=walk[frame].feet[0],first=walk[0].feet[0];
 for(const [axis,forward] of [-Math.SQRT1_2,1/Math.sqrt(6)].entries()){
  assert.ok(Math.abs(foot.ankle[axis]+frame/12*meta.clips.walk.strideLength*128/.84*forward-first.ankle[axis])<.002,'planted boot must cancel real movement');
 }
}
for(let view=0;view<4;view++){
 camera.position.setFromSphericalCoords(20,Math.acos(1/Math.sqrt(3)),Math.PI/4+view*Math.PI/2);
 camera.lookAt(0,0,0);camera.updateMatrixWorld();
 model.userData.motionState={};worker.attacking=true;
 animatePixelCharacter(model,worker,0,camera);
 for(let index=0;index<meta.clips.attack.frames.length;index++){
  animatePixelCharacter(model,worker,(index+.01)/meta.clips.attack.fps,camera);
  const u=model.userData,pose=pixelAtlasFrame(view,u.frame,meta);
  assert.equal(u.atlas.row,view);
  assert.equal(u.sprite.scale.y,.84*pose.scale,'authored canvas margin cannot shrink the body');
  assert.equal(u.sprite.center.x,pose.anchor[0]);
  assert.equal(u.sprite.center.y,1-pose.anchor[1]);
  const calls=[];
  const ctx=new Proxy({}, {get:(_,name)=>(...args)=>calls.push([name,...args]),set:()=>true});
  SoftwareRenderer.prototype.drawPixelCharacter.call({ctx,pixelsPerWorldUnit:128,project:()=>({x:240,y:250})},model,{x:240,y:250});
  const draw=calls.find(([name])=>name==='drawImage');
  const size=Math.round(u.sprite.scale.y*128);
  assert.equal(draw[2],u.frame*128);assert.equal(draw[3],view*128);
  assert.equal(draw[6],Math.round(240-size*pose.anchor[0]));
  assert.equal(draw[7],Math.round(250-size*pose.anchor[1]));
  assert.equal(draw[8],size);assert.equal(draw[9],size);
 }
 worker.attacking=false;animatePixelCharacter(model,worker,5,camera);
 assert.equal(model.userData.sprite.scale.y,.84,'returning to rest must reset the enlarged canvas');
}
assert.equal(pixelAtlasFrame(0,0).scale,1,'legacy assets keep their original display scale');
console.log('Bron: four camera views, authored extent, WebGL/Canvas anchors, rest transition and planted gait PASS');
