import {EffectBatch,FX} from './effect-batch.js';
import {hash,unit} from './effect-state.js';
import {mountainCourse,reliefHeight} from './landform-data.js';

function airCells(f,spacing,fn){
 const radius=Math.min(7,Math.ceil(f.reach/spacing)),cx=Math.floor(f.focus[0]/spacing),cz=Math.floor(f.focus[1]/spacing);
 for(let z=cz-radius;z<=cz+radius;z++)for(let x=cx-radius;x<=cx+radius;x++){
  const h=hash(x,z),h2=hash(z+19,x+51),wx=(x+h)*spacing,wz=(z+h2)*spacing;
  const surface=f.sample(wx,wz);if(!f.visible(wx,wz,(surface.height||0)+5))continue;fn(wx,wz,h,h2,surface);
 }
}
class Precipitation{
 constructor(scene,atlas,name){this.batch=new EffectBatch(scene,atlas,name,128);}
 dispose(){this.batch.dispose();}
}
export class RainLayer extends Precipitation{
 constructor(scene,atlas){super(scene,atlas,'rain');}
 update(f){
  const b=this.batch;b.begin();
  if(f.near&&f.weather.rain>.01)airCells(f,f.low?5:3.8,(x,z,h,h2,surface)=>{
   if(h>f.weather.rain||surface.layout.ecology==='snow'||surface.landform==='snowMountain')return;
   const p=unit(f.time*1.8+h2),y=(surface.height||0)+(1-p)*7,dx=p*1.3;
   b.add(FX.rain,x-f.origin[0]+dx,y,z-f.origin[1],.32,.95,.4*f.weather.rain,'#d8edf1',-.23);
   if(p>.86&&f.sample(x+dx,z).water)b.add(FX.ripple,x-f.origin[0]+dx,-.12,z-f.origin[1],.38,.15,(1-p)*2,'#d8f3ef');
  });b.end();
 }
}
export class SnowLayer extends Precipitation{
 constructor(scene,atlas){super(scene,atlas,'snowfall');}
 update(f){
  const b=this.batch;b.begin();if(f.near)airCells(f,f.low?7:5,(x,z,h,h2,surface)=>{
   if(surface.layout.ecology!=='snow'&&surface.landform!=='snowMountain')return;
   const p=unit(f.time*.14+h),s=.10+h2*.07;
   b.add(FX.snow,x-f.origin[0]+Math.sin(p*6.28+h2)*.6,(surface.height||0)+(1-p)*6,z-f.origin[1],s,s,.62,'#f5fcff',p*2);
  });b.end();
 }
}
export class WindParticles{
 constructor(scene,atlas){this.batch=new EffectBatch(scene,atlas,'wind-leaves-sand',60);}
 update(f){
  const b=this.batch;b.begin();if(f.near)airCells(f,f.low?11:8,(x,z,h,h2,s)=>{
   const eco=s.layout.ecology;if(s.water||eco==='snow'||s.landform==='snowMountain'||h>.62)return;
   const sand=['desert','basin','volcanic'].includes(eco),p=unit(f.time*(sand?.075:.045)+h2);
   const frame=sand?FX.sand:eco==='forest'||eco==='marsh'?FX.leaf:FX.glow;
   const size=sand?.28:frame===FX.leaf?.16:.09,alpha=Math.sin(p*Math.PI)*(sand?.22:.42);
   b.add(frame,x-f.origin[0]+p*4,(s.height||0)+.35+Math.sin(p*3.14)*(sand?.4:1.7),z-f.origin[1]+p,size,size*.65,alpha,sand?'#d4ba8b':frame===FX.leaf?'#c6ce75':'#fff2c8',p*6.28);
  });b.end();
 }
 dispose(){this.batch.dispose();}
}
export class TerrainVapor{
 constructor(scene,atlas){this.batch=new EffectBatch(scene,atlas,'geothermal-vapor',36);}
 update(f){const b=this.batch;b.begin();if(f.near)airCells(f,f.low?7:5,(x,z,h,h2,s)=>{
  if(s.water||!['volcano','volcanic'].includes(s.landform)||h>.45)return;
  const p=unit(f.time*.15+h2),alpha=Math.sin(p*Math.PI)*.24;
  b.add(FX.smoke,x-f.origin[0]+p*.8,(s.height||0)+.2+p*2.5,z-f.origin[1],.4+p*1.2,.4+p*1.2,alpha,'#e1dbca');
 });
 if(f.near)for(const g of f.owner.landscape?.landmarks.children||[]){
  if(!g.visible)continue;const course=mountainCourse(g.userData.cell);if(!course)continue;
  for(let i=0;i<4;i++){const p=unit(f.time*.17+i/4),x=course.a[0]+(course.b[0]-course.a[0])*p,z=course.a[1]+(course.b[1]-course.a[1])*p,y=reliefHeight(x,z)+.14;if(f.visible(x,z,y))b.add(FX.foam,x-f.origin[0],y,z-f.origin[1],.55,.22,.52,'#e2f4ed');}
 }
 b.end();}
 dispose(){this.batch.dispose();}
}
