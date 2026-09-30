import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {makePixelBuilding} from '../src/app/game/pixel-environment.js';
import {FARM_MOTION_ASSETS} from '../src/app/game/pixel-farm-motion.js';

const sharp=createRequire(createRequire(import.meta.resolve('wrangler')).resolve('miniflare'))('sharp');
const manifest=JSON.parse(await readFile(new URL('../art-source/pixel-environment/pack-manifest.json',import.meta.url),'utf8'));
for(const [id,spec] of Object.entries(FARM_MOTION_ASSETS)){
 const file=fileURLToPath(new URL('../public'+spec.sheet,import.meta.url));
 const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.deepEqual([info.width,info.height],[192*spec.frames,192*spec.directions]);
 assert.equal(manifest.assets[id].source,'farm-v11/'+id+'.png');
 for(let row=0;row<spec.directions;row++){
  const poses=new Set();
  for(let frame=0;frame<spec.frames;frame++){
   const pixels=await sharp(file).extract({left:frame*192,top:row*192,width:192,height:192}).raw().toBuffer();
   poses.add(pixels.toString('base64'));
  }
  assert.equal(poses.size,spec.frames,id+' distinct authored poses per view');
 }
 for(let i=3;i<data.length;i+=4)assert.ok(data[i]===0||data[i]===255,id+' binary alpha');
}
function snapshot(model){return model.userData.layers.filter(l=>/^(animal|bee)-/.test(l.name)).map(l=>({
 frame:l.userData.frame,direction:l.userData.direction,visible:l.visible,position:l.position.toArray(),action:l.userData.action,uv:l.userData.texture.offset.toArray(),flip:l.userData.flipX,
}));}
for(const type of ['sheeppen','milkbarn','duckhouse','apiary']){
 const model=makePixelBuilding(type,'human');
 const building={type,working:true,enabled:true,health:100,animationTime:0,progress:.5,out:4,inputs:{}};
 const sim={time:0};
 const frames=new Set(),positions=new Set(),actions=new Set();
 for(let tick=0;tick<120;tick++){
  building.animationTime=sim.time=tick/10;
  const before=JSON.stringify({building,sim});
  model.userData.animate(sim.time,building,sim,0);
  assert.equal(JSON.stringify({building,sim}),before,'rendering must not mutate saved state');
  const [pose]=snapshot(model);frames.add(pose.frame);positions.add(JSON.stringify(pose.position));actions.add(pose.action);
  assert.equal(model.userData.frame,0,'building body remains fixed');
 }
 assert.ok(frames.size>=4,type+' articulated poses');
 assert.ok(positions.size>10,type+' travels instead of only wobbling');
 if(type!=='apiary')assert.deepEqual([...actions].sort(),['feed','walk']);
 const paused=snapshot(model);
 model.userData.animate(99999,building,sim,0);
 assert.deepEqual(snapshot(model),paused,type+' simulation pause ignores wall time');
 model.userData.animate(99999,building,sim,1);
 model.userData.animate(99999,building,sim,0);
 assert.deepEqual(snapshot(model),paused,type+' camera rotation never advances motion');
 building.enabled=false;
 model.userData.animate(sim.time,building,sim,0);
 const disabled=snapshot(model);
 sim.time+=20;building.animationTime+=20;model.userData.animate(sim.time,building,sim,0);
 assert.deepEqual(snapshot(model),disabled,type+' disabled motion stays still');
 assert.ok(disabled.every(p=>type==='apiary'?!p.visible:p.frame===0&&p.visible));
 building.health=0;model.userData.animate(sim.time,building,sim,0);
 assert.ok(snapshot(model).every(p=>!p.visible),type+' no animals painted over rubble');
 building.health=100;building.enabled=true;model.userData.animate(sim.time,building,sim,0);
 assert.ok(snapshot(model).every(p=>p.visible),type+' repair restores live layers');
}
console.log('Farm motion: authored poses, fixed bodies, walking/feeding, pause, rotation, disable, damage/repair and save-state isolation passed.');
