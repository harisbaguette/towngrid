import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createPixelCharacter,animatePixelCharacter} from '../src/app/game/pixel-characters.js';
import {pixelMetadata} from '../src/app/game/pixel-character-meta.js';
import {pixelAtlasFrame} from '../src/app/game/pixel-character-data.js';
import {SoftwareRenderer} from '../src/app/game/software-renderer.js';
import {advanceCharacterRoute} from '../src/app/game/character-movement.js';
import {terrainHeightAt} from '../src/app/game/pixel-terrain.js';

const meta=JSON.parse(readFileSync('public/assets/pixel-characters/bron/frames.json'));
pixelMetadata.set('bron',meta);
const model=createPixelCharacter(0,'dwarf','bron');
model.userData.image={width:8192,height:meta.atlasRows*128};
const camera=new THREE.OrthographicCamera(-2,2,2,-2,.1,100);
const worker={id:1,x:3,z:4,dir:0,hp:75};
assert.equal(meta.motionRevision,'bron-authored-contact-2');
assert.equal(meta.frameScales.length,meta.columns.length);
assert.ok(meta.frameScales.every(scale=>Number.isFinite(scale)&&scale>=1&&scale<1.5));
assert.equal(meta.clips.walk.strideLength,meta.clips.carry.strideLength,'cargo must preserve foot phase');
const rig=JSON.parse(readFileSync(meta.source)),manifest=JSON.parse(readFileSync(meta.authoredLocomotion));
assert.equal(rig.strideLength,manifest.strideLength);
assert.equal(manifest.strideLength,meta.clips.walk.strideLength,'source and runtime stride cannot drift');
for(const [file,hash] of Object.entries(meta.locomotionSourceHashes))assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),hash,`${file}: repack changed artwork`);
for(let view=0;view<4;view++)for(const action of ['walk','carry']){
 const clip=meta.clips[action],forward=[view<2?-Math.SQRT1_2:Math.SQRT1_2,[0,3].includes(view)?1/Math.sqrt(6):-1/Math.sqrt(6)];
 assert.equal(clip.frames.length,32);
 let planted;
 for(const [index,frame] of clip.frames.entries()){
  const foot=meta.rigAudit[view][frame],anchor=meta.anchors[view][frame];
  const world=foot.sole.map((value,axis)=>value-anchor[axis]*128+index/32*clip.strideLength*128/.84*forward[axis]);
  if(index%16===0)planted=world;
  assert.ok(Math.hypot(...world.map((value,axis)=>value-planted[axis]))<.00001,'visible sole cancels movement throughout its stance');
 }
 const heldDrift=clip.strideLength/clip.frames.length*128/.84*Math.hypot(...forward);
 assert.ok(heldDrift<1.5,'held-frame drift stays below 1.5 atlas pixels (previously 4.15)');
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
 for(const action of ['walk','carry']){
  const mover={id:2,x:3,z:4,dir:0,walking:true,route:[{x:3,z:20}],task:action==='carry'?{carried:true}:null};
  for(let i=0;i<32;i++){
   advanceCharacterRoute(mover,meta.clips[action].strideLength/32*(i?1:.5),1);
   animatePixelCharacter(model,mover,6+i/40,camera,.040);
   const u=model.userData;
   assert.equal(u.frame,meta.clips[action].frames[i]);
   assert.equal(u.atlas.row,view+4);assert.equal(u.atlas.frame,(action==='carry'?32:0)+i);
   assert.equal(u.texture.offset.x,u.atlas.frame/64);assert.equal(u.texture.offset.y,(11-u.atlas.row)/12);
   assert.equal(model.position.y,.042,'the authored contact follows the real surface height');
   const calls=[],ctx=new Proxy({}, {get:(_,name)=>(...args)=>calls.push([name,...args]),set:()=>true});
   SoftwareRenderer.prototype.drawPixelCharacter.call({ctx,pixelsPerWorldUnit:128,project:()=>({x:240,y:250})},model,{x:240,y:250});
   const draw=calls.find(([name])=>name==='drawImage');
   assert.deepEqual(draw.slice(2,6),[u.atlas.frame*128,(view+4)*128,128,128]);
  }
 }
}
for(const [kind,height] of [['roads',.026],['rails',.036],['pipes',.040],['conveyors',.040]])assert.equal(terrainHeightAt({[kind]:new Set(['3,4'])},3.2,4.1),height);
assert.equal(terrainHeightAt({},0,0),.013);
assert.equal(pixelAtlasFrame(0,0).scale,1,'legacy assets keep their original display scale');
console.log('Bron: four camera views, authored extent, WebGL/Canvas anchors, rest transition and planted gait PASS');
