import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {PIXEL_HEIGHT,pixelRoster} from '../src/app/game/pixel-character-data.js';
import {pixelMetadata} from '../src/app/game/pixel-character-meta.js';
import {createPixelCharacter,animatePixelCharacter} from '../src/app/game/pixel-characters.js';
import {advanceCharacterRoute} from '../src/app/game/character-movement.js';
import {SoftwareRenderer} from '../src/app/game/software-renderer.js';

const people=Object.keys(PIXEL_HEIGHT).flatMap(pixelRoster).filter(person=>person.id!=='bron');
assert.equal(people.length,50);
const camera=new THREE.OrthographicCamera(-2,2,2,-2,.1,100);
let samples=0;
for(const person of people){
 const meta=JSON.parse(readFileSync(`public/assets/pixel-characters/${person.id}/frames.json`));
 const source=JSON.parse(readFileSync(meta.source));
 assert.equal(meta.locomotionRevision,'cast-heel-toe-4');
 assert.deepEqual(meta.contactMotion,source.contactMotion);
 for(const [path,hash] of Object.entries(meta.locomotionSourceHashes))assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),hash,`${person.id}: stale packed source`);
 assert.equal(meta.clips.walk.strideLength,meta.clips.carry.strideLength);
 assert.equal(meta.clips.walk.strideLength,source.strideLength);
 const expected=['fae','spirit'].includes(person.race)?'hover':person.race==='centaur'?'centaur':'biped';
 assert.equal(meta.locomotionMode,expected);
 pixelMetadata.set(person.id,meta);
 const model=createPixelCharacter(0,person.race,person.id);model.userData.image={width:8192,height:meta.atlasRows*128};
 for(let view=0;view<4;view++){
  camera.position.setFromSphericalCoords(20,Math.acos(1/Math.sqrt(3)),Math.PI/4+view*Math.PI/2);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  for(const action of ['walk','carry']){
   const clip=meta.clips[action];assert.equal(clip.frames.length,32);
   const worker={id:0,x:0,z:0,dir:0,route:[{x:0,z:20}],task:action==='carry'?{carried:true}:null};
   model.userData.motionState={};
   for(let step=0;step<32;step++){
    advanceCharacterRoute(worker,clip.strideLength/32*(step?1:.5),1);
    const ground=[.013,.026,.036,.040][view];animatePixelCharacter(model,worker,step/40,camera,ground);
    const u=model.userData;
    assert.equal(u.frame,clip.frames[step],`${person.id}: distance frame`);
    assert.equal(u.atlas.row,view+4);assert.equal(u.atlas.rows,12);assert.equal(u.atlas.columns,64);
    assert.equal(u.texture.offset.x,u.atlas.frame/64);assert.equal(u.texture.offset.y,(11-u.atlas.row)/12);
    assert.equal(model.position.y,ground+.002);
    const contacts=meta.rigAudit[view][u.frame].feet.filter(foot=>foot.contact).length;
    assert.ok(expected==='hover'?contacts===0:contacts>=(expected==='centaur'?2:1));
    if(expected==='biped')for(const foot of meta.rigAudit[view][u.frame].feet){
     for(const [start,end,length] of [[foot.hip,foot.knee,foot.lengths[0]],[foot.knee,foot.ankle,foot.lengths[1]]]){
      assert.ok(Math.hypot(end[0]-start[0],end[1]-start[1])/length>.40,`${person.id}: projected leg collapses despite valid 3D lengths`);
     }
    }
    const calls=[],ctx=new Proxy({}, {get:(_,name)=>(...args)=>calls.push([name,...args]),set:()=>true});
    SoftwareRenderer.prototype.drawPixelCharacter.call({ctx,pixelsPerWorldUnit:128,project:()=>({x:240,y:250})},model,{x:240,y:250});
    const draw=calls.find(([name])=>name==='drawImage'),size=Math.round(u.sprite.scale.y*128);
    assert.deepEqual(draw.slice(2,6),[u.atlas.frame*128,(view+4)*128,128,128]);
    assert.equal(draw[6],Math.round(240-size*u.atlas.anchor[0]));assert.equal(draw[7],Math.round(250-size*u.atlas.anchor[1]));
    samples++;
   }
   worker.walking=false;animatePixelCharacter(model,worker,2,camera);
   assert.equal(model.userData.current,action==='carry'?'carry':'idle');
   if(action==='carry')assert.equal(model.userData.frame,meta.clips.pickup.frames.at(-1));
  }
 }
}
console.log(`50 cast identities: ${samples} distance-driven frames, four surfaces/cameras, CPU/WebGL, body-specific contacts and stopping PASS`);
