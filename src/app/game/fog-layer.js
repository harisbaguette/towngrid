import * as THREE from 'three';
import {AtmosphereLayer} from './atmosphere-layer.js';
import {landscapeHash} from './landscape-colors.js';

function noise(x,y,seed){
 const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
 const a=landscapeHash(ix+seed,iy),b=landscapeHash(ix+1+seed,iy),c=landscapeHash(ix+seed,iy+1),d=landscapeHash(ix+1+seed,iy+1);
 return (a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v;
}
function fogTexture(seed){
 const canvas=document.createElement('canvas');canvas.width=192;canvas.height=64;
 const ctx=canvas.getContext('2d'),data=ctx.createImageData(canvas.width,canvas.height);
 for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
  const u=x/(canvas.width-1)*2-1,v=y/(canvas.height-1)*2-1;
  const warp=noise(x/43,y/26,seed)*.65-.325;
  const edge=Math.max(0,1-u*u)*Math.max(0,1-(v+warp)*(v+warp));
  const wisps=noise(x/29,y/13,seed+19)*.7+noise(x/12,y/7,seed+41)*.3;
  const alpha=Math.pow(edge,2)*Math.max(0,wisps-.18)*1.25,i=(y*canvas.width+x)*4;
  data.data[i]=228;data.data[i+1]=237;data.data[i+2]=224;data.data[i+3]=Math.round(alpha*255);
 }
 ctx.putImageData(data,0,0);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.LinearFilter;texture.generateMipmaps=false;return texture;
}

/** Low, translucent drifting mist. Density and drift are presentation only. */
export class FogLayer extends AtmosphereLayer {
 constructor({count=22,opacity=.82,speed=.095}={}){
  super({name:'ground-mist',textures:[fogTexture(7),fogTexture(37),fogTexture(91)],count,spacing:32,width:.98,aspect:1/3,altitude:.016,speed,opacity,order:30,seed:113});
 }
}
