import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import * as THREE from 'three';
import {characterSupportPoints,characterGroundHeight} from '../src/app/game/character-ground-contact.js';
import {pixelAtlasFrame,PIXEL_HEIGHT} from '../src/app/game/pixel-character-data.js';
import {QUARTER_POLAR,quarterAzimuth} from '../src/app/game/quarter-camera.js';
import {terrainHeightAt} from '../src/app/game/pixel-terrain.js';

const worker={x:4,z:6},atlas={anchor:[.5,.875],scale:1};
const fixture={cell:[128,128],rigAudit:[[{feet:[
 {contact:true,lift:0,sole:[64,112],supportPoint:[96,112]},
 {contact:false,lift:4,sole:[0,112]},
]}]]};
const surface=(x)=>x>4.1?.04:.013;
assert.equal(characterGroundHeight(worker,fixture,0,0,atlas,1,0,surface),.04,'sample the planted heel, not the body or swinging foot');
assert.equal(characterGroundHeight(worker,{...fixture,locomotionMode:'hover'},0,0,atlas,1,0,surface),.013,'hovering characters use the ground beneath their body');
assert.equal(characterGroundHeight(worker,{},0,0,atlas,1,0,surface),.013,'legacy metadata falls back to body location');
assert.equal(characterGroundHeight(worker,fixture,0,0,atlas,1,0,.036),.036,'numeric height callers remain compatible');

let checked=0,edgeDifferences=0;
const identities=readdirSync('public/assets/pixel-characters',{withFileTypes:true}).filter(entry=>entry.isDirectory());
for(const {name} of identities){
 const meta=JSON.parse(readFileSync(`public/assets/pixel-characters/${name}/frames.json`));
 const height=PIXEL_HEIGHT[meta.race]||1.05;
 for(let view=0;view<4;view++){
  const azimuth=quarterAzimuth(view),camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,30);
  camera.position.setFromSphericalCoords(10,QUARTER_POLAR,azimuth);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const base=new THREE.Vector3(worker.x,0,worker.z).project(camera);
  const frames=new Set(Object.values(meta.clips).flatMap(clip=>clip.frames));
  for(const frame of frames){
   const tile=pixelAtlasFrame(view,frame,meta),audit=meta.rigAudit[view][frame];
   const points=characterSupportPoints(worker,meta,view,frame,tile,height,azimuth);
   const soles=(audit.feet||[]).filter(foot=>foot.contact&&(foot.lift||0)<.001).map(foot=>foot.supportPoint||foot.sole).filter(Boolean);
   if(!soles.length&&audit.sole)soles.push(audit.sole);
   assert.equal(points.length,soles.length,`${name}/${view}/${frame}: preserve each supporting foot`);
   for(let i=0;i<points.length;i++){
    const point=new THREE.Vector3(points[i].x,0,points[i].z).project(camera);
    const expectedX=(soles[i][0]/128-tile.anchor[0])*height*tile.scale;
    const expectedY=(soles[i][1]/128-tile.anchor[1])*height*tile.scale;
    assert.ok(Math.abs(point.x-base.x-expectedX)<1e-9,`${name}: contact X projection`);
    assert.ok(Math.abs(base.y-point.y-expectedY)<1e-9,`${name}: contact Y projection`);
    checked++;
   }
   const roads=new Set(['4,6']),ground=(x,z)=>terrainHeightAt({roads},x,z);
   const offsetWorker={x:4.27,z:6.27};
   const sampled=characterGroundHeight(offsetWorker,meta,view,frame,tile,height,azimuth,ground);
   assert.ok([.013,.026].includes(sampled));
   if(sampled!==ground(offsetWorker.x,offsetWorker.z))edgeDifferences++;
  }
 }
}
assert.equal(identities.length,51);
assert.ok(checked>30000&&edgeDifferences>100);
console.log(`CHARACTER_GROUND_CONTACT_OK: 51 characters, ${checked} planted feet projected through four actual cameras, ${edgeDifferences} road-edge corrections`);
