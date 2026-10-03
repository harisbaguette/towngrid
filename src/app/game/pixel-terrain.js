import * as THREE from 'three';
import {pixelTexture,pixelImage} from './pixel-environment.js';
import {ENVIRONMENT_ASSETS} from './pixel-environment-data.js';
import {groundAt} from './infrastructure.js';
import {waterAt,groundOf,legacyLayout} from './world-grid.js';
import {biomeSurface} from './biome-terrain.js';
import {biomeOf} from './biome-data.js';
import {networkShader} from './pixel-network.js';
import {makeLandscapeSurface} from './landscape-surface.js';

export const CARDINALS=[[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]];
export function connectionMask(x,z,has){return CARDINALS.reduce((mask,[dx,dz,bit])=>mask|(has(x+dx,z+dz)?bit:0),0);}
export function railShape(mask){
 if(mask===15)return {frame:3,turn:0};
 const tees=[11,7,14,13],corners=[3,6,12,9];
 if(tees.includes(mask))return {frame:2,turn:tees.indexOf(mask)};
 if(corners.includes(mask))return {frame:1,turn:corners.indexOf(mask)};
 return {frame:0,turn:(mask&10)?1:0};
}
// Water kinds of world-grid.js drawn with the four water textures.
const WATER_TEXTURES={coast:'sea',river:'river',canal:'river',stream:'creek',lake:'lake',pond:'lake'};
export const waterTexture=kind=>WATER_TEXTURES[kind]||'river';
const LEGACY={};const legacy=region=>LEGACY[region]??=legacyLayout(region);
/** The water texture and the landscape water of an old region template (previews and tests). */
export const waterKind=(region,x,z)=>waterTexture(waterAt(legacy(region),x,z)||legacy(region).edges.e);
export const landscapeWater=(region,x,z)=>{const w=waterAt(legacy(region),x,z);return !!w&&w!=='pond';};

// The original raster art is sampled inside one atlas cell. Repetition happens
// inside that cell, never across neighbouring textures in the atlas.
export function makeSurfaceBatch(id,frame,cells,{layer=2,repeat=[1,1],mask=null,network=null,animated=false}={}){
 const texture=pixelTexture(id),frames=ENVIRONMENT_ASSETS[id].frames;
 texture.repeat.set(1,1);texture.offset.set(0,0);
 const uniform={value:frame};
 // Cutout terrain writes depth before translucent contact shadows. Sorting a
 // whole terrain batch with the shadows can otherwise erase them on rotation.
 const material=new THREE.MeshBasicMaterial({map:texture,alphaTest:.5,toneMapped:false,side:THREE.DoubleSide});
 const n=mask===null?null:CARDINALS.map(([, ,bit])=>mask&bit?1:0);
 const roadMask=n?`bool onRoad(vec2 p){return (abs(p.x-.5)<.29&&abs(p.y-.5)<.29)||(${n[0]}>0&&p.y>.5&&abs(p.x-.5)<.29)||(${n[1]}>0&&p.x>.5&&abs(p.y-.5)<.29)||(${n[2]}>0&&p.y<.5&&abs(p.x-.5)<.29)||(${n[3]}>0&&p.x<.5&&abs(p.y-.5)<.29);}`:'';
 material.onBeforeCompile=shader=>{
  shader.uniforms.surfaceFrame=uniform;
  shader.fragmentShader='uniform float surfaceFrame;\n'+roadMask+'\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_pars_fragment>',`#include <map_pars_fragment>
   vec4 surfaceSample(vec2 uv){uv=clamp(fract(uv),vec2(.00260417),vec2(.99739583));return texture2D(map,vec2((uv.x+surfaceFrame)/${frames.toFixed(1)},uv.y));}
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
   ${n?'if(!onRoad(vMapUv))discard;':''}
   vec2 tileUV=fract(vMapUv*vec2(${Number(repeat[0]).toFixed(4)},${Number(repeat[1]).toFixed(4)}));
   tileUV=clamp(tileUV,vec2(.00260417),vec2(.99739583));
   ${network!==null?networkShader(network):'vec4 sampledDiffuseColor=surfaceSample(tileUV);'}
   diffuseColor*=sampledDiffuseColor;
  `);
 };
 material.customProgramCacheKey=()=>`pixel-surface-${frames}-${repeat}-${mask}-${network}`;
 const mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),material,cells.length),dummy=new THREE.Object3D();
 mesh.name='surface-'+id+'-'+frame;
 for(const [i,c] of cells.entries()){
  dummy.position.set(c.x,c.y??.014,c.z);dummy.scale.set(c.w??1.002,c.h??1.002,1);
  dummy.rotation.set(c.vertical?0:-Math.PI/2,c.vertical?(c.turn||0)*Math.PI/2:0,c.vertical?0:-(c.turn||0)*Math.PI/2);
  dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new THREE.Color(c.tint||'#ffffff'));
 }
 mesh.userData={pixelSurface:true,environmentId:id,texture,image:pixelImage(id),frame,repeat,mask,network,layer,cells,
  animate:time=>{mesh.userData.frame=animated?Math.floor(Math.max(0,time)*3)%4:frame;uniform.value=mesh.userData.frame;}};
 mesh.userData.animate(0);return mesh;
}

export function makeMapTerrain(sim,overlay=''){
 const group=new THREE.Group();group.name='pixel-map-terrain';
 const batches=new Map();
 const add=(id,frame,cell,options={})=>{
  const key=JSON.stringify([id,frame,options]);
  if(!batches.has(key))batches.set(key,{id,frame,cells:[],options});batches.get(key).cells.push(cell);
 };
 for(const t of sim.tiles){
  const key=t.x+','+t.z,cell={x:t.x,z:t.z};
  if(t.terrain==='water'){
   if(typeof document==='undefined')add(waterTexture(t.water),0,{...cell,y:-.17},{layer:1,animated:true});continue;
  }
  const coast=CARDINALS.some(([dx,dz])=>sim.tile(t.x+dx,t.z+dz)?.water==='coast');
  const ground=groundAt(sim,t.x,t.z),special=ground==='ice'?0:ground==='mountain'?1:ground==='sand'?2:null;
  const frame=coast?3:sim.region==='highland'?2:0;
  let tint='#ffffff';
  if(overlay&&!sim.roads.has(key)){
   const value=['pollution','shade'].includes(overlay)?sim.placementEffects('field',t.x,t.z)[overlay]*(overlay==='pollution'?100/6:100/3):overlay==='oil'?(t.oil??t.ore):t[overlay]??50;
   tint=new THREE.Color('#90664c').lerp(new THREE.Color(overlay==='fertility'?'#a9cf5e':overlay==='moisture'?'#72bfd7':overlay==='pollution'?'#b36570':overlay==='shade'?'#7186b0':'#d7bd71'),value/100).getStyle();
  }
  const biome=biomeSurface(sim.layout,t.x,t.z,ground);
  if(overlay||typeof document==='undefined')add(biome===null?(special===null?'ground':'infrastructureGround'):'biomeGround',biome??special??frame,{...cell,y:.013,tint},{layer:3});
  for(const [index,[dx,dz]] of (typeof document==='undefined'?CARDINALS:[]).entries()){
   const adjacent=sim.tile(t.x+dx,t.z+dz),outsideWater=!adjacent&&waterAt(sim.layout,t.x+dx,t.z+dz);
   if(adjacent?.terrain!=='water'&&!outsideWater)continue;
   // Authored earth strata replace the smooth side of the map slab.
   add('networks',7,{x:t.x+dx*.501,z:t.z+dz*.501,y:-.205,w:1.005,h:.43,vertical:true,turn:index},{layer:2});
   const kind=adjacent?.water||outsideWater;
   add('networks',kind==='coast'?5:kind==='stream'?6:4,{x:t.x+dx*.47,z:t.z+dz*.47,y:.020,w:1.005,h:.42,turn:index},{layer:4});
  }
  if(sim.roads.has(key)){
   const mask=connectionMask(t.x,t.z,(x,z)=>sim.roads.has(x+','+z)||!!sim.at(x,z));
   add(sim.paved?.has(key)?'infrastructureGround':'ground',sim.paved?.has(key)?3:6,{...cell,y:.026,tint},{layer:5,mask});
  }
  if(sim.rails?.has(key)){
   const mask=connectionMask(t.x,t.z,(x,z)=>sim.rails.has(x+','+z)||sim.at(x,z)?.type==='station');
   add('networks',0,{...cell,y:.036},{layer:6,network:mask});
  }
  for(const [set,frame] of [[sim.pipes,4],[sim.conveyors,6]])if(set?.has(key)){
   const mask=connectionMask(t.x,t.z,(x,z)=>set.has(x+','+z)||!!sim.at(x,z));add('infrastructureGround',frame,{...cell,y:.040},{layer:6,network:mask});
  }
 }
 for(const {id,frame,cells,options} of batches.values())group.add(makeSurfaceBatch(id,frame,cells,options));
 group.userData.animate=time=>{for(const m of group.children)m.userData.animate(time);};
 group.userData.water=group.children.find(m=>['river','creek','sea','lake'].includes(m.userData.environmentId));
 return group;
}

export function makeBackgroundTerrain(region,sim){
 const continuous=makeLandscapeSurface(sim,region);if(continuous)return continuous;
 const group=new THREE.Group();group.name='pixel-background-terrain';
 // Beyond the map the land goes on as the squares beside it: sea, river, mountain, ice or desert.
 const layout=sim?.layout||legacy(region),FRAMES={ice:0,mountain:1,sand:2},base=FRAMES[layout.biome==='desert'?'sand':layout.biome],profile=biomeOf(layout);
 group.add(makeSurfaceBatch(profile?'biomeGround':base===undefined?'ground':'infrastructureGround',profile?.frame??base??0,[{x:11.5,z:11.5,y:-.33,w:90,h:90,tint:'#e1e7d9'}],{layer:0,repeat:[90,90]}));
 const water={},ground={};
 for(let z=-24;z<48;z++)for(let x=-24;x<48;x++){
  if(x>=0&&x<24&&z>=0&&z<24)continue;
  const w=waterAt(layout,x,z);if(w&&w!=='pond'){(water[waterTexture(w)]??=[]).push({x,z,y:-.17});continue;}
  const g=profile?biomeSurface(layout,x,z):groundOf(layout,x,z);(ground[g]??=[]).push({x,z,y:.010,tint:'#e1e7d9'});
 }
 for(const [g,cells] of Object.entries(ground))group.add(makeSurfaceBatch(profile?'biomeGround':FRAMES[g]===undefined?'ground':'infrastructureGround',profile?Number(g):FRAMES[g]??0,cells,{layer:0}));
 for(const [id,cells] of Object.entries(water))group.add(makeSurfaceBatch(id,0,cells,{layer:1,animated:true}));
 group.userData.animate=t=>group.children.forEach(m=>m.userData.animate(t));return group;
}

export function makePixelNetwork(type,mask=5){
 const group=new THREE.Group();group.name=type;
 const id=type==='rail'?'networks':type==='road'?'ground':'infrastructureGround',frame=type==='rail'?0:type==='road'?6:type==='pavedroad'?3:type==='pipe'?4:6;
 group.add(makeSurfaceBatch(id,frame,[{x:0,z:0,y:.026}],['road','pavedroad'].includes(type)?{layer:5,mask}:{layer:6,network:mask}));
 return group;
}
