import {EffectBatch,FX} from './effect-batch.js';
import {hash,unit} from './effect-state.js';

export class WaterRipples{
 constructor(scene,atlas){this.batch=new EffectBatch(scene,atlas,'water-ripples',96,{ground:true});this.points=[];this.key=null;}
 update(f){
  const b=this.batch;b.begin();if(!f.near){b.end();return;}
  const step=Math.max(2,Math.ceil(f.reach/10)),cx=Math.floor(f.focus[0]/step),cz=Math.floor(f.focus[1]/step),key=[cx,cz,step,f.sim.provinceId,f.sim.revision].join(':');
  if(this.key!==key){this.key=key;this.points=[];
   for(let z=cz-10;z<=cz+10;z++)for(let x=cx-10;x<=cx+10;x++){
    const wx=x*step,wz=z*step,h=hash(x,z),s=f.sample(wx,wz);if(s.water)this.points.push({x:wx,z:wz,h,y:s.height||0});
   }
  }
  for(const p of this.points){if(!f.visible(p.x,p.z,p.y))continue;
   const phase=unit(f.time*.19+p.h),alpha=Math.sin(phase*Math.PI)*.28;
   b.add(FX.ripple,p.x-f.origin[0],p.y?p.y+.05:-.11,p.z-f.origin[1],.25+phase*.85,.25+phase*.85,alpha,'#d9f4ee');
   if(p.h<.2)b.add(FX.spark,p.x-f.origin[0]+.3,p.y?p.y+.06:-.105,p.z-f.origin[1]+.18,.2,.2,alpha*.75,'#f4ffff');
   if(b.items.length>=(f.low?38:90))break;
  }b.end();
 }
 dispose(){this.batch.dispose();}
}
export class ShoreFoam{
 constructor(scene,atlas){this.batch=new EffectBatch(scene,atlas,'shore-foam',80,{ground:true});this.edges=[];this.key=null;}
 update(f){
  const b=this.batch;b.begin();if(!f.near){b.end();return;}
  const step=Math.max(1,Math.ceil(f.reach/15)),cx=Math.floor(f.focus[0]/step),cz=Math.floor(f.focus[1]/step),key=[cx,cz,step,f.sim.provinceId,f.sim.revision].join(':');
  if(key!==this.key){this.key=key;this.edges=[];
   for(let z=cz-15;z<=cz+15;z++)for(let x=cx-15;x<=cx+15;x++){
    const wx=x*step,wz=z*step,s=f.sample(wx,wz);if(!s.water)continue;
    for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]])if(!f.sample(wx+dx,wz+dz).water)this.edges.push({x:wx+dx*.36,z:wz+dz*.36,rotation:dx?Math.PI/2:0,h:hash(wx,wz),sea:s.water==='coast'});
   }
  }
  for(const e of this.edges){if(!f.visible(e.x,e.z,0))continue;const p=unit(f.time*.23+e.h);
   b.add(FX.foam,e.x-f.origin[0],-.10,e.z-f.origin[1],.85,.22+p*.16,(.18+Math.sin(p*Math.PI)*.3)*(e.sea?1:.6),'#e2f5e6',e.rotation);
   if(b.items.length>=(f.low?28:76))break;
  }b.end();
 }
 dispose(){this.batch.dispose();}
}
export class BirdFlock{
 constructor(scene,atlas){this.batch=new EffectBatch(scene,atlas,'bird-flocks',12);}
 update(f){
  const b=this.batch;b.begin();this.flocks=[];if(f.near&&f.weather.rain<.35){
   const cx=Math.floor(f.focus[0]/38),cz=Math.floor(f.focus[1]/38);
   for(let z=cz-1;z<=cz+1;z++)for(let x=cx-1;x<=cx+1;x++){
   const h=hash(x+18,z-41),eco=f.sample(x*38+19,z*38+19).layout.ecology;
    if(['snow','desert','volcanic'].includes(eco)||h>.6)continue;
    const a=f.time*.055+h*6.28,wx=x*38+19+Math.cos(a)*12,wz=z*38+19+Math.sin(a)*7;
    const y=(f.sample(wx,wz).height||0)+3.5;this.flocks.push([wx,wz]);if(!f.visible(wx,wz,y))continue;
    for(let i=0;i<3;i++)b.add(FX.bird+Math.floor(f.time*5+i)%4,wx-f.origin[0]+i*.6,y+i*.12,wz-f.origin[1]+i*.3,.48,.48,.72);
    if(b.items.length>=(f.low?6:12))break;
   }
  }b.end();
 }
 dispose(){this.batch.dispose();}
}
