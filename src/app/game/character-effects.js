import * as THREE from 'three';
import {EffectBatch,FX} from './effect-batch.js';
import {hash} from './effect-state.js';
import {pixelMetadata} from './pixel-character-meta.js';

// Motion accents read from the frame each resident is really showing: dust
// when a foot strikes the ground, chips when a tool lands, a puff when cargo
// is set down, and a burst when a body falls. Nothing here is saved.
const LIFE={step:.5,impact:.55,cargo:.6,hit:.4,fall:.8};
const impactFrames=new WeakMap();

// Where a work swing lands, per facing: the peak tool angle where tool pivots
// exist, else the frame whose lowest wrist is lowest, else mid-clip (authored
// cels without joints, such as Bron's hammer).
const lowestWrist=frame=>frame?.arms?.reduce((low,arm)=>arm?.wrist&&(!low||arm.wrist[1]>low[1])?arm.wrist:low,null);
export function workImpact(metadata,direction){
 let cache=impactFrames.get(metadata);if(!cache)impactFrames.set(metadata,cache=new Map());
 if(!cache.has(direction)){
  const frames=metadata?.clips?.work?.frames||[],audit=metadata?.rigAudit?.[direction]||[];
  let best=null,score=-Infinity,point=null;
  for(const f of frames){const a=audit[f]?.tool?.angle;if(Number.isFinite(a)&&a>score+.5){score=a;best=f;point=audit[f].tool.hand;}}
  if(best===null)for(const f of frames){const w=lowestWrist(audit[f]);if(w&&w[1]>score+.5){score=w[1];best=f;point=w;}}
  if(best===null&&frames.length)best=frames[Math.floor(frames.length/2)];
  cache.set(direction,best===null?null:{frame:best,point:point||[64,72]});
 }
 return cache.get(direction);
}

// Feet that strike the ground between two cels. Jointed rigs list each foot's
// contact; Bron's authored walk names the supporting side and its sole.
export function footStrikes(previous,audit){
 if(audit?.feet?.length)return audit.feet.flatMap((foot,i)=>foot.contact&&!(foot.lift>.001)&&previous?.contacts?.[i]===false&&(foot.supportPoint||foot.sole)?[foot.supportPoint||foot.sole]:[]);
 if(audit?.support!==undefined&&previous?.support!==undefined&&audit.support!==previous.support&&audit.sole)return [audit.sole];
 return [];
}

function groundColor(sample,x,z){
 const s=sample(x,z);if(!s||s.water)return null;
 const ecology=s.layout?.ecology,ground=s.tile?.ground||s.ground;
 if(ecology==='snow'||ground==='snow')return '#eef6f5';
 if(ecology==='desert'||ecology==='beach'||ground==='sand')return '#e6d3a0';
 if(ecology==='volcanic')return '#a99c92';
 if(s.tile?.road||ground==='stone'||ground==='rock')return '#cfc9bd';
 return '#cdb98f';
}

export class CharacterMotion{
 constructor(scene,atlas){this.batch=new EffectBatch(scene,atlas,'character-motion',160);this.state=new WeakMap();this.events=[];this.right=new THREE.Vector3();this.up=new THREE.Vector3();this.anchor=new THREE.Vector3();}
 // Sprite cel coordinates to world, in the sprite's own billboard plane.
 point(u,x,y){
  const meta=pixelMetadata.get(u.identity.id),cell=(Array.isArray(meta?.cell)?meta.cell[0]:meta?.cell)||128,scale=u.pixelHeight*u.atlas.scale;
  u.sprite.getWorldPosition(this.anchor);
  return this.anchor.clone().addScaledVector(this.right,(x/cell-u.atlas.anchor[0])*scale).addScaledVector(this.up,(u.atlas.anchor[1]-y/cell)*scale);
 }
 emit(kind,p,time,extra={}){this.events.push({kind,x:p.x,y:p.y,z:p.z,start:time,id:this.serial=(this.serial||0)+1,...extra});}
 read(model,metadata,f){
  const u=model.userData,prev=this.state.get(model)||{},audit=metadata?.rigAudit?.[u.direction]?.[u.frame];
  const next={action:u.current,frame:u.frame,contacts:audit?.feet?.map(foot=>foot.contact&&!(foot.lift>.001))||[],support:audit?.support,hurtAt:u.motionState?.hurtAt,stage:audit?.handling?.stage};
  this.state.set(model,next);
  if(prev.frame===undefined||!audit||!model.visible)return;
  const time=f.time;
  if(['walk','carry'].includes(u.current)&&prev.action===u.current&&prev.frame!==u.frame){
   for(const sole of footStrikes(prev,audit)){
    const p=this.point(u,sole[0],sole[1]),color=groundColor(f.sample,model.position.x+f.origin[0],model.position.z+f.origin[1]);
    if(color)this.emit('step',p,time,{color,weight:u.current==='carry'?1.35:1,size:u.pixelHeight});
   }
  }
  const impact=u.current==='work'&&prev.frame!==u.frame?workImpact(metadata,u.direction):null;
  if(impact&&u.frame===impact.frame)this.emit('impact',this.point(u,...(audit.tool?.hand||impact.point)),time,{size:u.pixelHeight});
  if(u.current==='drop'&&next.stage==='release'&&prev.stage!=='release'&&audit.cargoCenter){
   const p=this.point(u,audit.cargoCenter[0],audit.cargoCenter[1]+(audit.cargoSize?.[1]||8)*.5);
   this.emit('cargo',p,time,{color:groundColor(f.sample,model.position.x+f.origin[0],model.position.z+f.origin[1])||'#cdb98f',size:u.pixelHeight});
  }
  if(next.hurtAt!==undefined&&next.hurtAt!==prev.hurtAt&&u.current!=='defeat')this.emit('hit',this.point(u,64,62),time,{size:u.pixelHeight});
  if(u.current==='defeat'&&prev.frame!==u.frame){
   const frames=metadata.clips?.defeat?.frames||[],at=frames.indexOf(u.frame),before=frames.indexOf(prev.frame);
   if(at>=Math.floor(frames.length*.6)&&(prev.action!=='defeat'||before<Math.floor(frames.length*.6)))this.emit('fall',this.point(u,64,112),time,{color:groundColor(f.sample,model.position.x+f.origin[0],model.position.z+f.origin[1])||'#cdb98f',size:u.pixelHeight});
  }
 }
 update(f){
  const b=this.batch,camera=f.owner.camera;b.begin();
  if(this.sim!==f.sim){this.sim=f.sim;this.events=[];this.state=new WeakMap();}
  this.right.setFromMatrixColumn(camera.matrixWorld,0);this.up.setFromMatrixColumn(camera.matrixWorld,1);
  if(f.near&&!f.reduced)for(const model of [...(f.owner.workerModels?.values()||[]),...(f.owner.enemyModels?.values()||[])]){
   const u=model.userData;if(!u.pixel||!u.atlas)continue;this.read(model,pixelMetadata.get(u.identity.id),f);
  }
  this.events=this.events.filter(e=>f.time-e.start<LIFE[e.kind]).slice(-48);
  if(f.near&&!f.reduced)for(const e of this.events){
   const p=(f.time-e.start)/LIFE[e.kind],fade=1-p,s=e.size||1;
   if(e.kind==='step'){
    // Two small puffs kicked sideways, settling as they spread.
    // Kept below the ankle: a puff over the shins reads as a faded body.
    for(const side of [-1,1]){const r=(.03+p*.1)*s*e.weight,size=(.04+p*.07)*s*e.weight;
     b.add(FX.mist,e.x+this.right.x*side*r,e.y+.01+p*.02*s,e.z+this.right.z*side*r,size,size*.55,fade*fade*.38,e.color);}
   }else if(e.kind==='impact'){
    for(let i=0;i<5;i++){const a=hash(e.id,i)*Math.PI-Math.PI,v=(.12+hash(e.id,i+9)*.22)*s,dx=Math.cos(a)*v*p,dy=Math.abs(Math.sin(a))*v*p*1.6-p*p*.25*s;
     b.add(i<2?FX.spark:FX.chip,e.x+this.right.x*dx,e.y+dy,e.z+this.right.z*dx,(i<2?.08:.07)*s,(i<2?.08:.05)*s,fade*(i<2?.9:.75),i<2?'#ffe9b0':'#c9a978',a+p*6);}
    b.add(FX.ring,e.x,e.y,e.z,(.06+p*.22)*s,(.04+p*.12)*s,fade*.45,'#fff4d6');
   }else if(e.kind==='cargo'){
    for(let i=0;i<4;i++){const side=i<2?-1:1,r=(.08+p*.2)*s*(1+(i%2)*.4),size=(.09+p*.12)*s;
     b.add(FX.mist,e.x+this.right.x*side*r,e.y+.02+p*.04*s,e.z+this.right.z*side*r,size,size*.6,fade*fade*.4,e.color);}
   }else if(e.kind==='hit'){
    for(let i=0;i<6;i++){const a=hash(e.id,i)*Math.PI*2,r=(.06+p*.22)*s;
     b.add(FX.spark,e.x+this.right.x*Math.cos(a)*r,e.y+Math.sin(a)*r,e.z+this.right.z*Math.cos(a)*r,.07*s*fade+.02,.07*s*fade+.02,fade,i%2?'#ffffff':'#ffb38f',a);}
    b.add(FX.ring,e.x,e.y,e.z,(.1+p*.3)*s,(.1+p*.3)*s,fade*.6,'#fff2e6');
   }else if(e.kind==='fall'){
    for(let i=0;i<7;i++){const side=i/3-1,r=(.1+p*.3)*s,size=(.12+p*.2)*s;
     b.add(FX.mist,e.x+this.right.x*side*r,e.y+.03+p*.08*s,e.z+this.right.z*side*r,size,size*.6,fade*fade*.45,e.color);}
   }
  }
  b.end();
 }
 dispose(){this.batch.dispose();this.events=[];this.state=new WeakMap();}
}
