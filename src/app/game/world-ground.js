import * as THREE from 'three';
import {landscapeHash,landscapeNoise,mixColor,WATER_COLORS} from './landscape-colors.js';
import {landformColor,LANDFORMS,clamp} from './landform-data.js';

// Texture coordinates, shoreline and noise are all absolute world coordinates.
// Changing the detail level never moves a river or changes a tile's terrain.
export function paintWorldGround(data,x,z,width,height,pixels=4,split=false){
 const canvas=document.createElement('canvas');canvas.width=width*pixels;canvas.height=height*pixels;
 const ctx=canvas.getContext('2d'),image=ctx.createImageData(canvas.width,canvas.height),dry=split?ctx.createImageData(canvas.width,canvas.height):null,samples=[];
 for(let j=-1;j<=height;j++)for(let i=-1;i<=width;i++)samples.push(data.sample(x+i,z+j));
 const at=(i,j)=>samples[(Math.max(-1,Math.min(height,j))+1)*(width+2)+Math.max(-1,Math.min(width,i))+1];
 for(let py=0;py<canvas.height;py++)for(let px=0;px<canvas.width;px++){
  const u=(px+.5)/pixels-.5,v=(py+.5)/pixels-.5,ix=Math.round(u),iz=Math.round(v),t=at(ix,iz),gx=x+u,gz=z+v;
  let color=t.color;
  if(pixels>1){const fine=landformColor(t.landform,gx,gz,t.height),coarse=landformColor(t.landform,x+ix,z+iz,t.height);color=color.map((c,i)=>c+fine[i]-coarse[i]);}
  const dx=u-ix,dz=v-iz,neighborX=at(ix+Math.sign(dx),iz),neighborZ=at(ix,iz+Math.sign(dz));
  const edge=Math.min(neighborX.water!==t.water?.5-Math.abs(dx):10,neighborZ.water!==t.water?.5-Math.abs(dz):10);
  if(t.water){
   const depth=t.depth??Math.min(...[[1,0],[-1,0],[0,1],[0,-1]].map(([a,b])=>at(ix+a,iz+b).water?1:.15));
   const deep=LANDFORMS[t.water]?.color||WATER_COLORS.pond,shallow=t.water==='pond'?[132,177,134]:t.water==='stream'?[160,196,176]:[104,187,186];
   color=mixColor(shallow,deep,clamp(depth));
   if(edge<.18)color=mixColor(color,[167,216,198],.75);
   const n=landscapeNoise(Math.floor(gx*3)/2,Math.floor(gz*3)/2);color=color.map(c=>c+(n-.5)*13);
   const wave=t.water==='coast'?Math.sin(gx*.75+gz*1.9):t.water==='river'||t.water==='stream'?Math.sin(gx*(t.flow?.[1]||.2)*3+gz*(t.flow?.[0]||1)*3):Math.sin(gx*2.3+gz*1.7);
   if(wave>.97&&landscapeHash(Math.floor(gx),Math.floor(gz))>.55)color=mixColor(color,[213,234,217],t.water==='coast'?.48:.28);
   if(t.water==='pond'&&n>.67)color=mixColor(color,[116,151,78],.36);
  }else{
   if(!neighborX.water)color=mixColor(color,neighborX.color,Math.abs(dx)*.7);
   if(!neighborZ.water)color=mixColor(color,neighborZ.color,Math.abs(dz)*.7);
   const shade=Math.round((landscapeNoise(gx/5,gz/5)-.5)*19+(landscapeNoise(Math.floor(gx*3)/3,Math.floor(gz*3)/3)-.5)*10);
   color=color.map(c=>c+shade);if(edge<.12)color=mixColor(color,[218,202,145],.65);
   if(landscapeHash(Math.floor(gx*4),Math.floor(gz*4))>.98)color=color.map(c=>c+10);
   if(t.height>0){
    const dx=(at(ix+1,iz).height-at(ix-1,iz).height)*.5,dz=(at(ix,iz+1).height-at(ix,iz-1).height)*.5;
    const light=clamp((1+dx*.6-dz*.4)/Math.hypot(dx,1,dz),-.3,1),shade=Math.round((.76+light*.3)*12)/12;
    color=color.map(c=>c*shade);
   }
   if(pixels>1&&t.landform==='flowerMeadow'&&landscapeNoise(gx*.45,gz*.45)>.57&&landscapeHash(Math.floor(gx*6),Math.floor(gz*6))>.963)color=landscapeHash(Math.floor(gx*6)+1,Math.floor(gz*6))>.5?[235,222,164]:[208,175,194];
  }
  const k=(py*canvas.width+px)*4;image.data[k]=color[0];image.data[k+1]=color[1];image.data[k+2]=color[2];image.data[k+3]=255;
  if(dry&&!t.water){dry.data[k]=color[0];dry.data[k+1]=color[1];dry.data[k+2]=color[2];dry.data[k+3]=255;}
 }
 ctx.putImageData(image,0,0);if(dry){canvas.land=document.createElement('canvas');canvas.land.width=canvas.width;canvas.land.height=canvas.height;canvas.land.getContext('2d').putImageData(dry,0,0);}return canvas;
}
export function groundMesh(image,x,z,width,height,layer=0){
 const texture=new THREE.CanvasTexture(image);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
 const material=new THREE.MeshBasicMaterial({map:texture,alphaTest:.5,toneMapped:false,side:THREE.DoubleSide});
 const mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),material,1),dummy=new THREE.Object3D();
 // Keep the layers farther apart than depth precision across the whole world.
 const y=layer===2?.012:layer===1?-.17:layer===.5?-.20:-.22;
 dummy.position.set(x+(width-1)/2,y,z+(height-1)/2);dummy.rotation.x=-Math.PI/2;dummy.scale.set(width,height,1);dummy.updateMatrix();mesh.setMatrixAt(0,dummy.matrix);
 mesh.name='world-ground';mesh.userData={pixelSurface:true,environmentId:'world-ground',image,texture,frame:0,repeat:[1,1],mask:null,network:null,layer:layer-2,cells:[{x:x+(width-1)/2,z:z+(height-1)/2,w:width,h:height}]};return mesh;
}
