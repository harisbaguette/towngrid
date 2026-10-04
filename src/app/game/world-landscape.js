import * as THREE from 'three';
import {MAP,COLS,ROWS,WORLD_CELLS,WATER_KINDS} from './world-grid.js';
import {PLOT_INDEX,PROVINCES,sovereignOf} from './territory.js';
import {NATIONS} from './world.js';
import {WorldTerrainData,WORLD_SIZE,worldOrigin,worldCellAt,cellLayout} from './world-space.js';
import {groundMesh,paintWorldGround} from './world-ground.js';
import {biomeTree,biomeDecoration} from './biome-terrain.js';
import {makePixelProp} from './pixel-environment.js';
import {makeBuildingSafe,makeTree,makeRock} from './models.js';
import {makeMapTerrain,makeSurfaceBatch,connectionMask} from './pixel-terrain.js';
import {landscapeHash} from './landscape-colors.js';
import {terrainNoise} from './terrain-tiles.js';
import {makeWorldRelief} from './world-relief.js';
import {landformOf,reliefHeight} from './landform-data.js';
import {treeCluster} from './landform-patterns.js';
import {settlementPlan} from './settlement-scenery.js';

export function disposeWorldObject(root,renderer){
 if(!root)return;
 root.traverse(n=>{renderer?.cache?.delete(n.uuid);if(n.geometry&&!n.geometry.userData.shared)n.geometry.dispose();for(const m of [n.material].flat())if(m&&!m.userData.shared)m.dispose();if(n.userData.texture){renderer?.surfacePatterns?.delete(n.userData.image);n.userData.texture.dispose();}if(n.isInstancedMesh)n.dispose();});
 root.removeFromParent();
}
// Shared low-detail world, built once in small batches. Nearby chunks can render
// immediately while the distant continent is being prepared.
const PAD=240;
let baseCanvas,baseReady=false,basePromise;
function prepareBase(){
 if(basePromise)return basePromise;
 baseCanvas=document.createElement('canvas');baseCanvas.width=WORLD_SIZE.width+PAD*2;baseCanvas.height=WORLD_SIZE.height+PAD*2;
 const ctx=baseCanvas.getContext('2d');ctx.fillStyle='#9db562';ctx.fillRect(0,0,baseCanvas.width,baseCanvas.height);
 basePromise=(async()=>{
  const data=new WorldTerrainData();
  for(let cz=-PAD/MAP;cz<ROWS+PAD/MAP;cz++){
   const strip=paintWorldGround(data,-PAD,cz*MAP,baseCanvas.width,MAP,1);ctx.drawImage(strip,0,cz*MAP+PAD);
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  const w=baseCanvas.width,h=baseCanvas.height;
  for(const [x1,y1,x2,y2,x,y,bw,bh] of [[0,0,PAD,0,0,0,PAD,h],[w,0,w-PAD,0,w-PAD,0,PAD,h],[0,0,0,PAD,0,0,w,PAD],[0,h,0,h-PAD,0,h-PAD,w,PAD]]){const g=ctx.createLinearGradient(x1,y1,x2,y2);g.addColorStop(0,'#c7d6bd');g.addColorStop(.18,'#c7d6bd');g.addColorStop(1,'#c7d6bd00');ctx.fillStyle=g;ctx.fillRect(x,y,bw,bh);}
  baseReady=true;
 })();return basePromise;
}
function segments(points,color,opacity=1){return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity,depthTest:false,depthWrite:false}));}
export class WorldLandscape{
 constructor(scene,sim){
  this.owner=scene;this.group=new THREE.Group();this.group.name='continuous-world';this.data=new WorldTerrainData(sim);this.sim=sim;this.chunks=new Map();this.props=new Map();this.queue=[];this.disposed=false;
  this.fog={center:{value:new THREE.Vector2()},range:{value:new THREE.Vector2(45,90)},color:{value:new THREE.Vector3(.78,.84,.74)}};
  this.group.userData.worldLandscape=true;scene.scene.add(this.group);prepareBase();
  this.base=groundMesh(baseCanvas,-PAD,-PAD,baseCanvas.width,baseCanvas.height);this.group.add(this.base);
  basePromise.then(()=>{if(this.disposed)return;this.base.userData.texture.needsUpdate=true;this.owner.renderer.surfacePatterns?.delete(baseCanvas);this.owner.lastPaint=null;});
  this.selected=new THREE.Group();this.group.add(this.selected);this.rebase(sim);this.makeBorders();this.makeLandmarks();
 }
 rebase(sim){
  this.sim=sim;this.data.setSimulation(sim);const [ox,oz]=worldOrigin(sim);this.group.position.set(-ox,0,-oz);
  this.lastKey=null;for(const chunk of this.chunks.values())disposeWorldObject(chunk,this.owner.renderer);this.chunks.clear();
  for(const p of this.props.values())disposeWorldObject(p,this.owner.renderer);this.props.clear();this.queue=[];
  this.select(sim.provinceId);this.refreshSavedGround();
 }
 refreshSavedGround(){
  if(this.savedGround)disposeWorldObject(this.savedGround,this.owner.renderer);
  this.savedGround=new THREE.Group();this.savedGround.name='saved-world-ground';this.group.add(this.savedGround);
  for(const [id,sim] of this.data.sites){const cell=worldCellAt(...worldOrigin(sim));if(!cell)continue;const image=paintWorldGround(this.data,cell.cx*MAP,cell.cz*MAP,MAP,MAP,1);this.savedGround.add(groundMesh(image,cell.cx*MAP,cell.cz*MAP,MAP,MAP,.5));}
  this.attachFog(this.savedGround);
 }
 makeLandmarks(){
  this.landmarks=new THREE.Group();this.landmarks.name='world-landmarks';this.group.add(this.landmarks);
  this.reliefQueue=WORLD_CELLS.filter(c=>c.terrain==='mountain');
  this.attachFog(this.landmarks);
 }
 makeBorders(){
  if(this.borders)disposeWorldObject(this.borders,this.owner.renderer);
  this.borders=new THREE.Group();this.borders.name='world-country-borders';this.group.add(this.borders);
  const owners=new Map(PROVINCES.flatMap(p=>p.cells.map(c=>[c.join(','),sovereignOf(p.id,this.sim.campaign?.provinces)]))),groups=new Map();
  for(const cell of WORLD_CELLS){const id=owners.get(cell.cx+','+cell.cz);if(!id)continue;if(!groups.has(id))groups.set(id,[]);const a=groups.get(id),x=cell.cx*MAP-.5,z=cell.cz*MAP-.5;
   for(const [dx,dz,edge] of [[0,-1,[x,z,x+MAP,z]],[1,0,[x+MAP,z,x+MAP,z+MAP]],[0,1,[x+MAP,z+MAP,x,z+MAP]],[-1,0,[x,z+MAP,x,z]]])if(owners.get((cell.cx+dx)+','+(cell.cz+dz))!==id)a.push(new THREE.Vector3(edge[0],.08,edge[1]),new THREE.Vector3(edge[2],.08,edge[3]));
  }
  for(const [id,points] of groups)this.borders.add(segments(points,NATIONS[id]?.border||'#f1c975',.7));
 }
 select(id){
  for(const child of [...this.selected.children])disposeWorldObject(child,this.owner.renderer);
  const plot=PLOT_INDEX.get(id);this.selection=id;if(!plot)return;
  const [x,z]=plot.cell.map(v=>v*MAP-.5),points=[[x,z,x+MAP,z],[x+MAP,z,x+MAP,z+MAP],[x+MAP,z+MAP,x,z+MAP],[x,z+MAP,x,z]].flatMap(([a,b,c,d])=>[new THREE.Vector3(a,.1,b),new THREE.Vector3(c,.1,d)]);
  this.selected.add(segments(points,'#ffe493'));this.owner.lastPaint=null;
 }
 fogMaterial(material){
  if(!material||material.userData.worldFog)return;material.userData.worldFog=true;
  const before=material.onBeforeCompile,key=material.customProgramCacheKey?.bind(material),oldKey=key?.()||'';
  material.onBeforeCompile=(shader,renderer)=>{
   before?.call(material,shader,renderer);Object.assign(shader.uniforms,{worldFogCenter:this.fog.center,worldFogRange:this.fog.range,worldFogColor:this.fog.color});
   shader.vertexShader='varying vec2 worldFogPosition;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
    vec4 fogPoint=vec4(position,1.0);
    #ifdef USE_INSTANCING
     fogPoint=instanceMatrix*fogPoint;
    #endif
    worldFogPosition=(modelMatrix*fogPoint).xz;`);
   if(material.isSpriteMaterial)shader.vertexShader=shader.vertexShader.replace('gl_Position = projectionMatrix * mvPosition;','gl_Position = projectionMatrix * mvPosition;\nworldFogPosition=modelMatrix[3].xz;');
   shader.fragmentShader='varying vec2 worldFogPosition;uniform vec2 worldFogCenter;uniform vec2 worldFogRange;uniform vec3 worldFogColor;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <colorspace_fragment>','#include <colorspace_fragment>\n gl_FragColor.rgb=mix(gl_FragColor.rgb,worldFogColor,smoothstep(worldFogRange.x,worldFogRange.y,distance(worldFogPosition,worldFogCenter))*.92);');
  };material.customProgramCacheKey=()=>oldKey+'-world-fog-1';material.needsUpdate=true;
 }
 attachFog(root){root.traverse(n=>{for(const m of [n.material].flat())this.fogMaterial(m);});}
 makeChunk(cell){
  const image=paintWorldGround(this.data,cell.cx*MAP,cell.cz*MAP,MAP,MAP,6,true),group=new THREE.Group();
  group.add(groundMesh(image,cell.cx*MAP,cell.cz*MAP,MAP,MAP,1),groundMesh(image.land,cell.cx*MAP,cell.cz*MAP,MAP,MAP,2));
  group.name='world-cell-'+cell.cx+'-'+cell.cz;group.userData.worldCell=[cell.cx,cell.cz];group.userData.revision=this.data.sites.get(cell.site)?.revision;this.group.add(group);this.attachFog(group);return group;
 }
 makeProps(cell,detail){
  const group=new THREE.Group();group.name='world-props-'+cell.cx+'-'+cell.cz;group.userData.detail=detail;group.position.set(cell.cx*MAP,0,cell.cz*MAP);
  const saved=this.data.sites.get(cell.site),layout=saved?.layout||cellLayout(cell.cx,cell.cz),isActive=saved===this.sim;
  group.userData.sourceSim=saved;group.userData.revision=saved?.revision;group.userData.cell=cell;
  if(isActive)return group;
  const plot=PLOT_INDEX.get(cell.site),npc=!saved&&plot?.developed?settlementPlan(plot,this.data.tiles(cell),!NATIONS[plot.nation]?.playable):null;
  if(cell.terrain==='mountain'){
   const form=landformOf(layout).id;
   for(let z=1;z<24;z+=detail===2?2:4)for(let x=1;x<24;x+=detail===2?2:4){
    const wx=cell.cx*MAP+x,wz=cell.cz*MAP+z,h=landscapeHash(wx,wz),y=reliefHeight(wx,wz);
    const slope=Math.hypot(reliefHeight(wx+1,wz)-reliefHeight(wx-1,wz),reliefHeight(wx,wz+1)-reliefHeight(wx,wz-1));
    if(y<.2||slope>3.5||h>.65||this.data.sample(wx,wz).water)continue;
    const tree=y<(form==='snowMountain'?5.5:8.5)&&form!=='volcano'&&h<.5;
    const id=tree?(form==='snowMountain'?'snowPine':form==='mountain'?'pine':'bush'):h<.23?'cliff':null;if(!id)continue;
    const p=makePixelProp(id,tree?.7+h*.3:.55+h);p.position.set(x,y+.02,z);p.userData.animate?.(0,null,false,this.owner.viewIndex);group.add(p);
   }
  }
  if(WATER_KINDS.includes(cell.terrain)){
   for(let z=1;z<24;z+=2)for(let x=1;x<24;x+=2){
    const wx=cell.cx*MAP+x,wz=cell.cz*MAP+z,s=this.data.sample(wx,wz),h=landscapeHash(wx,wz);if(s.water||h>.38)continue;
    const wet=[[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>this.data.sample(wx+a,wz+b).water);
    const p=makePixelProp(wet?'reeds':h<.08?'willow':'mossrock',wet?.8:.55);p.position.set(x,.014,z);p.userData.animate?.(0,null,false,this.owner.viewIndex);group.add(p);
   }
  }
  if(!WATER_KINDS.includes(cell.terrain)&&cell.terrain!=='mountain'){
   const tiles=this.data.tiles(cell),count=detail===2?1:6;
   for(const t of tiles){
    if(t.water||saved?.at(t.x,t.z)||saved?.roads.has(t.x+','+t.z)||npc?.occupied.has(t.x+','+t.z)||npc?.roads.has(t.x+','+t.z))continue;
    const h=landscapeHash(cell.cx*MAP+t.x,cell.cz*MAP+t.z);if(h>1/count)continue;
    const scale=.67+treeCluster(layout,t.x,t.z)*.28,tree=biomeTree(layout,t),decor=detail===2?biomeDecoration(layout,t):null;
    let p;if(['tree','sapling'].includes(t.nature))p=tree?makePixelProp(tree,scale*(t.nature==='sapling'?.35:1)):makeTree(Math.floor(terrainNoise(t.z,t.x)*6),scale);
    else if(t.nature==='rock')p=makeRock(.9+terrainNoise(t.x,t.z)*.25,t.ore>70?'oreRock':t.moisture>70?'mossrock':'rock');
    else if(decor)p=makePixelProp(decor,decor==='bush'?.5:1);
    if(!p)continue;p.position.set(t.x,.014,t.z);p.userData.animate?.(0,t,false,this.owner.viewIndex);group.add(p);
   }
  }
  if(saved){
   group.add(makeMapTerrain(saved));
   for(const b of saved.buildings){const p=makeBuildingSafe(b.type,saved.residentOf(b.type)||saved.race);p.position.set(b.x+(b.size-1)/2,.025,b.z+(b.size-1)/2);p.userData.building=b;p.userData.animate?.(saved.time,b,saved,this.owner.viewIndex);group.add(p);}
  }else if(npc){
   const race=NATIONS[plot.nation]?.race||'human',batches=new Map();
   for(const key of npc.roads){const [x,z]=key.split(',').map(Number),mask=connectionMask(x,z,(a,b)=>npc.roads.has(a+','+b));if(!batches.has(mask))batches.set(mask,[]);batches.get(mask).push({x,z,y:.026});}
   for(const [mask,cells]of batches)group.add(makeSurfaceBatch('ground',6,cells,{layer:5,mask}));
   for(const b of npc.buildings){const p=makeBuildingSafe(b.type,race);p.position.set(b.x,['coastport','riverport','lakeport'].includes(b.type)?-.15:.025,b.z);p.userData.building=b;p.userData.animate?.(0,b,this.sim,this.owner.viewIndex);group.add(p);}
  }
  this.group.add(group);this.attachFog(group);return group;
 }
 update(){
  const owner=this.owner,camera=owner.camera,target=owner.controls.target,[ox,oz]=worldOrigin(this.sim),x=target.x+ox,z=target.z+oz;
  const span=(camera.right-camera.left)/camera.zoom,height=(camera.top-camera.bottom)/camera.zoom,reach=Math.hypot(span,height*1.74)*.6;
  this.fog.center.value.set(target.x,target.z);this.fog.range.value.set(Math.max(24,reach*.4),Math.max(52,reach*.95));
  for(const g of this.landmarks.children)g.visible=Math.hypot(g.position.x-x,g.position.z-z)<reach*1.3+24;
  if(this.reliefQueue.length){
   this.reliefQueue.sort((a,b)=>Math.hypot(a.cx*MAP+12-x,a.cz*MAP+12-z)-Math.hypot(b.cx*MAP+12-x,b.cz*MAP+12-z));
   const cell=this.reliefQueue[0];if(Math.hypot(cell.cx*MAP+12-x,cell.cz*MAP+12-z)<reach*1.3+24){this.reliefQueue.shift();const relief=makeWorldRelief(this.data,cell,cellLayout(cell.cx,cell.cz));this.landmarks.add(relief);this.attachFog(relief);owner.lastPaint=null;}
  }
  this.borders.visible=span>95;this.selected.visible=span>65||owner.worldPicking;
  const px=owner.container.clientWidth/span,detail=px>=13?2:px>=3?1:0;
  const cx=Math.floor((x+.5)/MAP),cz=Math.floor((z+.5)/MAP),key=[cx,cz,detail,this.sim.campaign?.sites.length,this.sim.campaign?.activeId].join(':');
  if(key!==this.lastKey){
   this.lastKey=key;this.data.setSimulation(this.sim);const radius=detail?Math.min(3,Math.ceil(reach/MAP)):0,wanted=[];
   for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){
    const cell=worldCellAt((cx+dx)*MAP,(cz+dz)*MAP);if(cell&&detail)wanted.push({cell,distance:dx*dx+dz*dz});
   }
   wanted.sort((a,b)=>a.distance-b.distance);const keep=new Set(wanted.slice(0,25).map(v=>v.cell.cx+','+v.cell.cz));
   for(const [k,m] of this.chunks)if(!keep.has(k)){disposeWorldObject(m,owner.renderer);this.chunks.delete(k);}
   for(const [k,m] of this.props)if(!keep.has(k)||m.userData.detail!==detail||m.userData.sourceSim!==this.data.sites.get(m.userData.cell.site)){disposeWorldObject(m,owner.renderer);this.props.delete(k);}
   this.queue=wanted.slice(0,25).map(v=>({...v,detail}));
  }
  for(const [key,g] of this.props){const s=g.userData.sourceSim;if(!s||s===this.sim)continue;if(s.revision!==g.userData.revision){this.queue.push({cell:g.userData.cell,detail:g.userData.detail});disposeWorldObject(g,owner.renderer);this.props.delete(key);}else for(const p of g.children)p.userData.animate?.(s.time,p.userData.building,s,owner.viewIndex);}
  for(const [key,g]of this.chunks){const cell=worldCellAt(...g.userData.worldCell.map(v=>v*MAP)),saved=this.data.sites.get(cell?.site);if(saved&&saved.revision!==g.userData.revision){this.queue.push({cell,detail});disposeWorldObject(g,owner.renderer);this.chunks.delete(key);}}
  // Bound main-thread work and retained GPU resources independently of world size.
  const start=performance.now();let made=0;
  while(this.queue.length&&made<2&&performance.now()-start<7){
   const {cell,detail}=this.queue.shift(),key=cell.cx+','+cell.cz;
   if(!this.chunks.has(key)){this.chunks.set(key,this.makeChunk(cell));made++;}
   if(!this.props.has(key))this.props.set(key,this.makeProps(cell,detail));
   owner.lastPaint=null;
  }
  if(this.lastView!==owner.viewIndex){this.lastView=owner.viewIndex;for(const g of [...this.props.values(),this.landmarks])g.traverse(p=>p.userData.animate?.(this.sim.time,p.userData.building||null,this.sim,owner.viewIndex));}
  this.attachFog(this.group);
  owner.renderer.domElement.dataset.worldChunks=String(this.chunks.size);owner.renderer.domElement.dataset.worldReady=String(baseReady);owner.renderer.domElement.dataset.worldSpan=span.toFixed(1);owner.renderer.domElement.dataset.worldCenter=x.toFixed(2)+','+z.toFixed(2);
  owner.renderer.worldFog={center:target.clone(),start:this.fog.range.value.x,end:this.fog.range.value.y};
 }
 dispose(){this.disposed=true;disposeWorldObject(this.group,this.owner.renderer);this.chunks.clear();this.props.clear();this.data.generated.clear();}
}
