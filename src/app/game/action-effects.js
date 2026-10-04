import {EffectBatch,FX} from './effect-batch.js';
import {ActionChanges,hash} from './effect-state.js';

export class ActionBursts{
 constructor(scene,atlas){this.batch=new EffectBatch(scene,atlas,'building-actions',144);this.changes=new ActionChanges();this.events=[];}
 update(f){
  if(this.changes.sim!==f.sim)this.events=[];
  for(const e of this.changes.read(f.sim))if(!f.reduced)this.events.push({...e,start:f.time});
  this.events=this.events.filter(e=>f.time-e.start<1.4).slice(-24);
  const b=this.batch;b.begin();if(f.near&&!f.reduced)for(const e of this.events){
   const p=(f.time-e.start)/1.4,positive=['repair','complete'].includes(e.kind),impact=e.kind==='impact',count=e.kind==='complete'?3:6;
   for(let i=0;i<count;i++){
    const angle=hash(e.id,i)*Math.PI*2,r=.2+p*.5,size=positive?.09:.13+p*.3;
    b.add(positive?FX.spark:FX.mist,e.x+Math.cos(angle)*r,.1+Math.sin(p*Math.PI)*(positive?.65:.35),e.z+Math.sin(angle)*r,size,size,(1-p)*(positive?.55:.35),positive?'#ffe4a3':impact?'#bbaa98':'#ddd0ae');
   }
  }b.end();
 }
 dispose(){this.batch.dispose();this.events=[];this.changes.previous.clear();}
}
export class VehicleTrails{
 constructor(scene,atlas){this.batch=new EffectBatch(scene,atlas,'vehicle-trails',64);this.previous=new Map();this.particles=[];}
 update(f){
  const b=this.batch;b.begin();if(this.sim!==f.sim){this.sim=f.sim;this.previous.clear();this.particles=[];}
  const vehicles=[...(f.owner.exportCarts?.values()||[]),...(f.owner.freight||[]).map(v=>v.m)],seen=new Set();
  for(const m of vehicles){
   if(!m.visible)continue;seen.add(m.uuid);const p=m.position,old=this.previous.get(m.uuid),step=old?Math.hypot(p.x-old.x,p.z-old.z):0;
   if(f.near&&!f.reduced&&!f.sim.paused&&old&&step>.015&&step<2&&f.time-old.emitted>.12){
    const s=f.sample(p.x+f.origin[0],p.z+f.origin[1]);
    if(!s.water){this.particles.push({x:p.x,z:p.z,start:f.time,snow:s.layout.ecology==='snow'});old.emitted=f.time;}
   }
   this.previous.set(m.uuid,{x:p.x,z:p.z,emitted:old?.emitted??f.time});
  }
  for(const key of this.previous.keys())if(!seen.has(key))this.previous.delete(key);
  this.particles=this.particles.filter(p=>f.time-p.start<1.6).slice(-64);
  if(f.near&&!f.reduced)for(const p of this.particles){const age=(f.time-p.start)/1.6,size=.13+age*.45;
   b.add(FX.mist,p.x+age*.12,.07+age*.15,p.z,size,size*.55,(1-age)*.3,p.snow?'#eef6f5':'#cbb892');
  }b.end();
 }
 dispose(){this.batch.dispose();this.previous.clear();this.particles=[];}
}
