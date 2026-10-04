import * as THREE from 'three';
import {waterAt,groundOf,forestAt,legacyLayout} from './world-grid.js';
import {LAND_COLORS,WATER_COLORS,landscapeNoise,landscapeHash,mixColor} from './landscape-colors.js';

export const LANDSCAPE_MIN=-60,LANDSCAPE_SIZE=144;
const PIXELS=12,WIDTH=LANDSCAPE_SIZE*PIXELS;

// Rendering uses saved logical tiles inside the plot and the same edge generator
// outside it. Ownership does not change the physical colour of the landscape.
export function landscapeTile(sim,x,z){
 const layout=sim.layout,t=sim.tile?.(x,z),water=t?t.water:waterAt(layout,x,z),ground=t?.ground||groundOf(layout,x,z);
 let color=ground==='mountain'?LAND_COLORS.mountain:ground==='ice'?LAND_COLORS.ice:ground==='sand'?LAND_COLORS.sand:LAND_COLORS.plain;
 if(ground==='plain'){
  if(layout.ecology==='volcanic')color=LAND_COLORS.volcanic;
  else if(layout.ecology==='marsh')color=LAND_COLORS.marsh;
  else if(forestAt(layout,x,z))color=LAND_COLORS.forest;
  else if(layout.ecology==='coast')color=mixColor(LAND_COLORS.plain,LAND_COLORS.sand,.34);
 }
 if(t?.oasis)color=LAND_COLORS.plain;
 return {water,color};
}

function surface(image,id,y,layer){
 const texture=new THREE.CanvasTexture(image);texture.colorSpace=THREE.SRGBColorSpace;
 texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;
 const material=new THREE.MeshBasicMaterial({map:texture,alphaTest:.5,toneMapped:false,side:THREE.DoubleSide});
 const mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),material,1),dummy=new THREE.Object3D();
 dummy.position.set(11.5,y,11.5);dummy.rotation.x=-Math.PI/2;dummy.scale.set(LANDSCAPE_SIZE,LANDSCAPE_SIZE,1);dummy.updateMatrix();mesh.setMatrixAt(0,dummy.matrix);
 mesh.name=id;mesh.userData={pixelSurface:true,environmentId:id,image,texture,frame:0,repeat:[1,1],mask:null,network:null,layer,cells:[{x:11.5,z:11.5,w:LANDSCAPE_SIZE,h:LANDSCAPE_SIZE}],animate:()=>{}};
 return mesh;
}

export function makeLandscapeSurface(sim,region){
 if(typeof document==='undefined')return null;
 sim=sim||{layout:legacyLayout(region)};
 const group=new THREE.Group();group.name='continuous-landscape';
 const land=document.createElement('canvas'),water=document.createElement('canvas');land.width=land.height=water.width=water.height=WIDTH;
 const lc=land.getContext('2d'),wc=water.getContext('2d'),dry=lc.createImageData(WIDTH,WIDTH),wet=wc.createImageData(WIDTH,WIDTH);
 const grid=[];
 for(let z=-1;z<=LANDSCAPE_SIZE;z++)for(let x=-1;x<=LANDSCAPE_SIZE;x++)grid.push(landscapeTile(sim,x+LANDSCAPE_MIN,z+LANDSCAPE_MIN));
 const at=(x,z)=>grid[(Math.max(-1,Math.min(LANDSCAPE_SIZE,z))+1)*(LANDSCAPE_SIZE+2)+Math.max(-1,Math.min(LANDSCAPE_SIZE,x))+1];
 for(let z=0;z<LANDSCAPE_SIZE;z++)for(let x=0;x<LANDSCAPE_SIZE;x++){const tile=at(x,z);tile.waterKind=tile.water||[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dz])=>at(x+dx,z+dz).water).find(Boolean);}
 // A distance field follows the entire shoreline, including inside corners.
 const distance=new Float32Array(WIDTH*WIDTH),shore=new Uint8Array(WIDTH*WIDTH);
 for(let y=0;y<WIDTH;y++)for(let x=0;x<WIDTH;x++){
  const water=!!at(Math.floor(x/PIXELS),Math.floor(y/PIXELS)).water,i=y*WIDTH+x;shore[i]=water?1:0;distance[i]=1e4;
 }
 // Soften only the corners, less than a quarter tile. Tile centres and the
 // logical water/building rules are unchanged.
 const stride=WIDTH+1,sums=new Uint32Array(stride*stride);
 for(let y=0;y<WIDTH;y++){let row=0;for(let x=0;x<WIDTH;x++){row+=shore[y*WIDTH+x];sums[(y+1)*stride+x+1]=sums[y*stride+x+1]+row;}}
 for(let y=2;y<WIDTH-2;y++)for(let x=2;x<WIDTH-2;x++){
  const a=(y-2)*stride,b=(y+3)*stride,total=sums[b+x+3]-sums[a+x+3]-sums[b+x-2]+sums[a+x-2];shore[y*WIDTH+x]=total>=13?1:0;
 }
 for(let y=0;y<WIDTH;y++)for(let x=0;x<WIDTH;x++){
  const i=y*WIDTH+x,w=shore[i];
  if(x&&shore[i-1]!==w||y&&shore[i-WIDTH]!==w||x+1<WIDTH&&shore[i+1]!==w||y+1<WIDTH&&shore[i+WIDTH]!==w)distance[i]=.5;
 }
 for(let y=0;y<WIDTH;y++)for(let x=0;x<WIDTH;x++){
  const i=y*WIDTH+x;distance[i]=Math.min(distance[i],x?distance[i-1]+1:1e4,y?distance[i-WIDTH]+1:1e4,x&&y?distance[i-WIDTH-1]+1.414:1e4);
 }
 for(let y=WIDTH-1;y>=0;y--)for(let x=WIDTH-1;x>=0;x--){
  const i=y*WIDTH+x;distance[i]=Math.min(distance[i],x+1<WIDTH?distance[i+1]+1:1e4,y+1<WIDTH?distance[i+WIDTH]+1:1e4,x+1<WIDTH&&y+1<WIDTH?distance[i+WIDTH+1]+1.414:1e4);
 }
 for(let y=0;y<WIDTH;y++)for(let x=0;x<WIDTH;x++){
  const gx=x/PIXELS,gz=y/PIXELS,tx=Math.floor(gx),tz=Math.floor(gz),tile=at(tx,tz),i=y*WIDTH+x,k=i*4,d=distance[i]/PIXELS;
  let color;
  const waterKind=tile.waterKind;
  if(shore[i]){
   const original=WATER_COLORS[waterKind]||WATER_COLORS.pond;
   const base=mixColor(original,waterKind==='coast'?[28,137,177]:[40,151,183],.8);
   color=d<.10?[188,222,200]:d<.25?[127,196,184]:d<.48?mixColor(base,[110,185,180],.6):d<.9?mixColor(base,[94,173,174],.3):base;
   // Sparse broken glints in world space, never one repeated wave stamp per tile.
   const ripple=landscapeNoise(Math.floor(gx*5)/2,Math.floor(gz*5)/2);
   color=color.map(c=>c+(ripple-.5)*15);
   if(d>.24&&x%23<6&&y%27===Math.floor(Math.sin(x/43)*2+2)&&landscapeHash(Math.floor(x/11),Math.floor(y/27))>.75)color=mixColor(color,[207,239,224],.55);
  }else{
   const ax=Math.floor(gx-.5),az=Math.floor(gz-.5),u=gx-.5-ax,v=gz-.5-az;
   const sample=(a,b)=>{const t=at(a,b);return t.water?tile.color:t.color;};
   color=mixColor(mixColor(sample(ax,az),sample(ax+1,az),u),mixColor(sample(ax,az+1),sample(ax+1,az+1),u),v);
   const shade=Math.round((landscapeNoise(gx/5,gz/5)-.5)*19+(landscapeNoise(Math.floor(gx*3)/3,Math.floor(gz*3)/3)-.5)*10);
   color=color.map(c=>c+shade);
   if(d<.20)color=mixColor(color,[218,202,145],d<.07?.9:.5);
   const patch=landscapeNoise(Math.floor(gx*8)/4,Math.floor(gz*8)/4);
   if(patch>.66)color=mixColor(color,[195,185,103],.25);
   else if(patch<.32)color=mixColor(color,[103,147,64],.16);
   const detail=landscapeHash(x,y);if(detail>.98&&d>.3)color=color.map(c=>c+16);
   else if(detail<.018&&d>.3)color=color.map(c=>c-12);
  }
  const target=shore[i]?wet.data:dry.data;for(let c=0;c<3;c++)target[k+c]=color[c];target[k+3]=255;
 }
 lc.putImageData(dry,0,0);wc.putImageData(wet,0,0);
 const ground=surface(land,'landscape-ground',.012,0),sea=surface(water,'landscape-water',-.17,1);
 const time={value:0};sea.material.onBeforeCompile=shader=>{
  shader.uniforms.landscapeTime=time;shader.fragmentShader='uniform float landscapeTime;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n diffuseColor.rgb*=1.0+0.012*sin(vMapUv.x*220.0+vMapUv.y*120.0+landscapeTime*.6);');
 };
 sea.material.customProgramCacheKey=()=>'continuous-water-v1';
 group.add(ground,sea);group.userData.animate=t=>{time.value=t;};return group;
}
