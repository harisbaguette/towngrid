import * as THREE from 'three';
import {landscapeHash} from './landscape-colors.js';
import {ATMOSPHERE_FOCUS} from './atmosphere-focus.js';

const smooth=(a,b,v)=>THREE.MathUtils.smoothstep(v,a,b);

// World-anchored banks at adjacent scales cross-fade; camera movement never
// drags a cloud along with it. Only the visible sprites occupy the fixed pool.
export class AtmosphereLayer {
 constructor({name,textures,count,spacing,width,aspect,altitude,speed,opacity,order,seed}){
  Object.assign(this,{textures,spacing,width,aspect,altitude,speed,opacity,seed});
  this.group=new THREE.Group();this.group.name=name;this.group.userData.atmosphereLayer=true;
  this.slots=Array.from({length:count},()=>{
   const material=new THREE.SpriteMaterial({map:textures[0],transparent:true,opacity:0,depthTest:false,depthWrite:false,toneMapped:false});
   // A bank's center may be off screen while its wide silhouette covers the
   // resident at the camera focus. Clear each fragment, not only bank centers.
   material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec2 vAtmosphereNdc;\n'+shader.vertexShader.replace('gl_Position = projectionMatrix * mvPosition;','gl_Position = projectionMatrix * mvPosition;\n vAtmosphereNdc=gl_Position.xy/gl_Position.w;');
    shader.fragmentShader='varying vec2 vAtmosphereNdc;\n'+shader.fragmentShader.replace('#include <alphamap_fragment>',`#include <alphamap_fragment>\n diffuseColor.a*=smoothstep(${ATMOSPHERE_FOCUS.clear},${ATMOSPHERE_FOCUS.edge},max(abs(vAtmosphereNdc.x),abs(vAtmosphereNdc.y)));`);
   };
   material.customProgramCacheKey=()=>'atmosphere-focus-1';
   const sprite=new THREE.Sprite(material);sprite.renderOrder=order;sprite.visible=false;
   sprite.raycast=()=>{};this.group.add(sprite);return sprite;
  });
  this.vector=new THREE.Vector3();this.disposed=false;
 }
 update({camera,origin,focus,span,height,time,delta,building,low}){
  if(this.disposed)return;
  this.group.position.set(-origin[0],0,-origin[1]);
  const reach=Math.hypot(span,height*1.74)*.5;
  const level=Math.max(0,Math.log(Math.max(this.spacing,reach*.62)/this.spacing)/Math.log(4));
  const base=Math.floor(level),blend=smooth(0,1,level-base),candidates=[];
  for(const [lod,weight] of [[base,1-blend],[base+1,blend]]){
   if(weight<.005)continue;
   const step=this.spacing*4**lod,driftX=time*this.speed*4**lod,driftZ=driftX*.27;
   const cx=Math.floor((focus[0]-driftX)/step),cz=Math.floor((focus[1]-driftZ)/step),radius=Math.ceil(reach/step)+2;
   for(let z=cz-radius;z<=cz+radius;z++)for(let x=cx-radius;x<=cx+radius;x++){
    const h=landscapeHash(x+this.seed+lod*23,z-this.seed),h2=landscapeHash(z+71,x+this.seed);
    const wx=(x+.16+h*.68)*step+driftX,wz=(z+.16+h2*.68)*step+driftZ;
    const size=step*this.width*(.78+h2*.48),y=step*this.altitude*(.8+h*.4);
    const p=this.vector.set(wx-origin[0],y,wz-origin[1]).project(camera);
    const marginX=size/span,marginY=size*this.aspect/height;
    if(Math.abs(p.x)>1+marginX||Math.abs(p.y)>1+marginY)continue;
    const edge=Math.max(Math.abs(p.x),Math.abs(p.y));
    const fade=(1-smooth(.96,1+Math.max(marginX,marginY),edge));
    // Keep the camera focus readable, including during placement and on phones.
    const clear=smooth(.18,.72,edge),opacity=this.opacity*weight*fade*(.06+.94*clear)*(building?.3:1);
    if(opacity<.003)continue;
    candidates.push({key:lod+':'+x+':'+z,x:wx,y,z:wz,size,opacity,variant:Math.floor(h*this.textures.length),priority:opacity});
   }
  }
  candidates.sort((a,b)=>b.priority-a.priority);
  const selected=candidates.slice(0,low?Math.ceil(this.slots.length*.6):this.slots.length),wanted=new Set(selected.map(c=>c.key));
  const assigned=new Map(this.slots.filter(s=>wanted.has(s.userData.bank)).map(s=>[s.userData.bank,s]));
  const free=this.slots.filter(s=>!wanted.has(s.userData.bank));
  const easing=delta?1-Math.exp(-delta*5):1;
  for(const c of selected){
   let s=assigned.get(c.key);
   if(!s){s=free.shift();s.userData.bank=c.key;s.material.opacity=0;}
   s.material.map=this.textures[c.variant];s.position.set(c.x,c.y,c.z);s.scale.set(c.size,c.size*this.aspect,1);
   s.material.opacity+=(c.opacity-s.material.opacity)*easing;s.visible=true;
  }
  for(const s of free){s.visible=false;s.material.opacity=0;s.userData.bank=null;}
 }
 dispose(){
  if(this.disposed)return;this.disposed=true;this.group.removeFromParent();
  for(const sprite of this.slots)sprite.material.dispose();
  for(const texture of this.textures)texture.dispose();
  this.group.clear();
 }
}
