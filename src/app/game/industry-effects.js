import * as THREE from 'three';
import {EffectBatch,FX} from './effect-batch.js';
import {hash,unit,WORK_DUST,WOOD_CHIPS,MAGIC_BUILDINGS} from './effect-state.js';

const point=new THREE.Vector3();
function socket(model,prefix,fallback=.6){
 const part=model.userData.layers?.find(p=>prefix.some(s=>p.name.startsWith(s))&&p.visible);
 return (part||model).getWorldPosition(point).clone().add(new THREE.Vector3(0,part?0:fallback,0));
}
function producers(f,fn){
 if(!f.near)return;
 for(const model of f.owner.models.values()){
  const b=model.userData.building,state=model.userData.production;
  if(!b||!state||!(state.working||state.active)||!f.visible(b.x+f.origin[0],b.z+f.origin[1],1))continue;
  fn(model,b,state);
 }
}
export class ChimneyPlumes{
 constructor(scene,atlas){this.batch=new EffectBatch(scene,atlas,'chimney-plumes',100);}
 update(f){
  const batch=this.batch;batch.begin();producers(f,(model,b)=>{
   if(!model.userData.layers?.some(p=>p.name.startsWith('steam-')&&p.visible))return;
   const p=socket(model,['steam-']);
   for(let i=0;i<(f.low?2:4);i++){
    const age=unit(f.productionTime*.35+i/4+hash(b.id,17)),size=.18+age*.4;
    batch.add(FX.smoke,p.x+age*.34,p.y+.13+age*.85,p.z+age*.12,size,size,Math.sin(age*Math.PI)*.25,'#dbe0d4');
   }
  });batch.end();
 }
 dispose(){this.batch.dispose();}
}
export class WorkParticles{
 constructor(scene,atlas){this.batch=new EffectBatch(scene,atlas,'work-dust-sparks',96);}
 update(f){
  const batch=this.batch;batch.begin();producers(f,(model,b)=>{
   const wood=WOOD_CHIPS.has(b.type),dust=WORK_DUST.has(b.type),spark=model.userData.layers?.some(p=>(p.name.startsWith('spark-')||p.name.startsWith('fire-'))&&p.visible);
   if(!wood&&!dust&&!spark)return;
   const p=socket(model,wood?['blade','axe','pick-']:dust?['pick-','ram-']:['spark-','fire-']);
   for(let i=0;i<3;i++){
    const age=unit(f.productionTime*(dust?.7:1.2)+i/3+hash(b.id,9)),angle=hash(b.id,i)*6.28;
    const frame=wood?FX.chip:dust?FX.mist:FX.spark,color=wood?'#cda367':dust?'#c4b8a2':'#ffd382',size=dust?.16+age*.18:wood?.06:.075;
    batch.add(frame,p.x+Math.cos(angle)*age*.38,p.y+Math.sin(age*Math.PI)*.24,p.z+Math.sin(angle)*age*.25,size,size,(1-age)*(dust?.25:.65),color,age*2);
   }
  });batch.end();
 }
 dispose(){this.batch.dispose();}
}
export class MagicField{
 constructor(scene,atlas){this.batch=new EffectBatch(scene,atlas,'magic-field',80,{ground:true});}
 update(f){
  const batch=this.batch;batch.begin();if(f.near)for(const model of f.owner.models.values()){
   const b=model.userData.building;if(!b||b.health<=0||b.enabled===false||b.movingUntil>f.sim.time)continue;
   const state=model.userData.production,ward=f.sim.wardUntil>f.sim.time&&b.type==='magetower',outage=f.weather.mana&&['generator','arcanepower','leyrelay','battery'].includes(b.type);
   if(!outage&&!ward&&!(MAGIC_BUILDINGS.has(b.type)&&(state?.active||state?.working)))continue;
   const p=unit(f.productionTime*.18+hash(b.id,9));
   batch.add(FX.ring,b.x,.05,b.z,.8+p*.3,.8+p*.3,outage?.23:.17,outage?'#ce9ef1':'#8cf7df');
  }batch.end();
 }
 dispose(){this.batch.dispose();}
}
