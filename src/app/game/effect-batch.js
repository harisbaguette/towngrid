import * as THREE from 'three';
import {pixelImage} from './pixel-environment.js';

export const FX={smoke:0,rain:1,snow:2,leaf:3,sand:4,spark:5,ripple:6,foam:7,chip:8,glow:9,ring:10,mist:11,bird:12};
const CELL=32,COUNT=16;
export function createEffectAtlas(){
 const image=document.createElement('canvas');image.width=CELL*COUNT;image.height=CELL;
 const c=image.getContext('2d');
 for(let i=0;i<COUNT;i++){
  c.save();c.translate(i*CELL,0);c.fillStyle='#fff';c.strokeStyle='#fff';
  if([FX.smoke,FX.mist,FX.glow].includes(i)){
   const g=c.createRadialGradient(16,16,2,16,16,15);g.addColorStop(0,'#ffffffdf');g.addColorStop(.48,'#ffffff88');g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.fillRect(0,0,32,32);
  }else if(i===FX.rain){c.fillRect(14,3,3,22);c.globalAlpha=.4;c.fillRect(14,0,3,3);}
  else if(i===FX.snow){c.fillRect(12,8,8,16);c.fillRect(8,12,16,8);}
  else if(i===FX.leaf){for(const [x,y,w,h]of [[18,7,7,6],[11,12,11,7],[7,18,10,5],[5,23,3,3]])c.fillRect(x,y,w,h);}
  else if(i===FX.sand||i===FX.chip){c.fillRect(10,12,12,7);c.globalAlpha=.5;c.fillRect(7,14,3,5);}
  else if(i===FX.spark){c.fillRect(14,4,4,24);c.fillRect(4,14,24,4);c.fillRect(11,11,10,10);}
  else if(i===FX.ripple||i===FX.ring){c.lineWidth=i===FX.ring?2:1.5;c.beginPath();c.ellipse(16,16,12,12,0,0,Math.PI*2);c.stroke();}
  else if(i===FX.foam){for(const [x,y,w,h]of [[3,15,7,2],[9,12,7,2],[15,13,7,2],[21,10,7,2]])c.fillRect(x,y,w,h);}
  else if(i>=FX.bird){const birds=pixelImage('birds');if(birds){const cell=birds.width/4;c.imageSmoothingEnabled=false;c.drawImage(birds,(i-FX.bird)*cell,0,cell,cell,0,0,32,32);}}
  c.restore();
 }
 const texture=new THREE.CanvasTexture(image);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;
 return texture;
}

/** One draw call per component, fixed allocation, shared by WebGL and Canvas. */
export class EffectBatch{
 constructor(scene,texture,name,capacity=128,{ground=false}={}){
  this.capacity=capacity;this.ground=ground;this.items=[];this.colors=new Map();
  const plane=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry();
  geometry.index=plane.index.clone();geometry.setAttribute('position',plane.attributes.position.clone());geometry.setAttribute('uv',plane.attributes.uv.clone());plane.dispose();
  for(const [key,size]of [['fxPosition',3],['fxSize',2],['fxTone',4],['fxPose',2]])geometry.setAttribute(key,new THREE.InstancedBufferAttribute(new Float32Array(capacity*size),size).setUsage(THREE.DynamicDrawUsage));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:ground,side:THREE.DoubleSide,uniforms:{atlas:{value:texture},ground:{value:ground?1:0}},
   vertexShader:`attribute vec3 fxPosition;attribute vec2 fxSize;attribute vec4 fxTone;attribute vec2 fxPose;uniform float ground;varying vec2 vUv;varying vec4 vTone;
    void main(){vec2 p=position.xy*fxSize;float c=cos(fxPose.y),s=sin(fxPose.y);p=mat2(c,s,-s,c)*p;vec4 mv=modelViewMatrix*vec4(fxPosition,1.);
     if(ground>.5)mv=modelViewMatrix*vec4(fxPosition+vec3(p.x,0.,p.y),1.);else mv.xy+=p;
     gl_Position=projectionMatrix*mv;vUv=vec2((uv.x+fxPose.x)/16.,uv.y);vTone=fxTone;}`,
   fragmentShader:`uniform sampler2D atlas;varying vec2 vUv;varying vec4 vTone;void main(){vec4 t=texture2D(atlas,vUv);gl_FragColor=t*vTone;if(gl_FragColor.a<.002)discard;
    #include <colorspace_fragment>
   }`});
  this.mesh=new THREE.Mesh(geometry,material);this.mesh.name=name;this.mesh.frustumCulled=false;this.mesh.renderOrder=ground?4:12;
  this.mesh.userData.effectBatch=this;geometry.instanceCount=0;scene.add(this.mesh);
 }
 begin(){this.items.length=0;}
 add(frame,x,y,z,w,h=w,alpha=1,color='#ffffff',rotation=0){
  if(this.items.length>=this.capacity||alpha<.002)return;
  this.items.push({frame,x,y,z,w,h,alpha,color,rotation});
 }
 end(){
  const g=this.mesh.geometry;
  for(const [i,p]of this.items.entries()){
   if(!this.colors.has(p.color))this.colors.set(p.color,new THREE.Color(p.color));const c=this.colors.get(p.color);
   g.attributes.fxPosition.setXYZ(i,p.x,p.y,p.z);g.attributes.fxSize.setXY(i,p.w,p.h);g.attributes.fxTone.setXYZW(i,c.r,c.g,c.b,p.alpha);g.attributes.fxPose.setXY(i,p.frame,p.rotation);
  }
  for(const a of Object.values(g.attributes))if(a.isInstancedBufferAttribute)a.needsUpdate=true;
  g.instanceCount=this.items.length;this.mesh.visible=this.items.length>0;
 }
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();this.items.length=0;this.colors.clear();}
}
