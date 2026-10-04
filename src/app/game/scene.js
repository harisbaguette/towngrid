import { advanceGame } from './game-time.js';
import {RESIDENT_LOOKS} from './resident-roster.js';
import {pixelIdentity} from './pixel-character-data.js';
import {RACES,FACTIONS,factionOf} from './world.js';
import * as THREE from 'three';
import { makeScenery } from './scenery.js';
import { createRenderer } from './software-renderer.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { N, BUILDINGS, noise } from './simulation.js';
import { makeBuildingSafe as makeBuilding, makeTree, makeRock, makeWorker, animateWorker, makeFreightVehicle, makeExportGate } from './models.js';
import { EXPORT_GATE, shipmentPose, parkedVehicles } from './export-route.js';
import { shipmentVehicle, shipmentLoaded, PORT_VEHICLES } from './vehicle-art.js';
import {biomeTree,biomeDecoration} from './biome-terrain.js';
import {biomeOf} from './biome-data.js';
import {treeCluster} from './landform-patterns.js';
import { makePixelProp,makeNetworkCargo } from './pixel-environment.js';
import {logisticsVisualEvents,transferPose} from './logistics-visual-events.js';
import { makeMapTerrain, CARDINALS, terrainHeightAt } from './pixel-terrain.js';
import { configureQuarterControls, applyQuarterView, settleQuarterControls, QUARTER_VIEWS } from './quarter-camera.js';
import { tradeProvince } from './trade-routes.js';
import { edgePoint } from './world-grid.js';
import { stationRailPath, railPathPose } from './freight-path.js';
import {makePlotBoundaries} from './plot-boundaries.js';
import {WorldLandscape} from './world-landscape.js';
import {WorldAtmosphere} from './world-atmosphere.js';
import {WorldEffects} from './world-effects.js';
import {WORLD_SIZE,worldOrigin,localToWorld,worldToLocal,worldCellAt,plotCenter} from './world-space.js';

function release(root){if(!root)return;root.traverse(n=>{if(n.geometry&&!n.geometry.userData.shared)n.geometry.dispose();if(n.material&&(!n.geometry?.userData.shared||n.userData.ownedMaterial))for(const m of(Array.isArray(n.material)?n.material:[n.material]))if(m&&!m.userData.shared)m.dispose();if(n.userData.pixel||n.userData.pixelEnvironment||n.userData.pixelWater||n.userData.pixelSurface)n.userData.texture.dispose();if(n.isSkinnedMesh)n.skeleton.dispose();if(n.isInstancedMesh)n.dispose();if(n.userData.mixer){n.userData.mixer.stopAllAction();n.userData.mixer.uncacheRoot(n.userData.root);}});}
// Unclaimed resources receive a light fade; the landscape keeps its natural colour.
function fadeUnowned(obj){
 const m=obj.userData.sprite?.material;if(!m)return;obj.userData.unowned=true;
 m.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <colorspace_fragment>','#include <colorspace_fragment>\n gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(dot(gl_FragColor.rgb,vec3(.299,.587,.114)))*.8+.22,.22);');};
 m.customProgramCacheKey=()=>'pixel-unowned';m.needsUpdate=true;
}
export class GameScene{
 constructor(container,sim,callbacks={},renderOptions={}){
  this.container=container;this.sim=sim;this.callbacks=callbacks;this.models=new Map();this.workerModels=new Map();this.nature=[];this.mode=null;this.selection=null;this.hover=null;this.lastRevision=-1;this.alive=true;
  this.characterSurface=(x,z)=>terrainHeightAt(this.sim,x,z);
  this.renderer=createRenderer({antialias:true,alpha:false,powerPreference:'high-performance',...renderOptions});
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.75));this.renderer.setClearColor('#6ca345');this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;
  this.renderer.domElement.setAttribute('aria-label','타일 지도. 시설을 선택한 뒤 빈 칸을 눌러 건설하세요.');this.renderer.domElement.setAttribute('role','application');this.renderer.domElement.tabIndex=0;
  container.appendChild(this.renderer.domElement);this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#c7d6bd');this.renderer.setClearColor('#c7d6bd');
  this.scene.add(new THREE.HemisphereLight('#e7f4ff','#6c765b',1.8));const sun=this.sun=new THREE.DirectionalLight('#fff0d6',2.8);sun.position.set(-11,24,16);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-21;sun.shadow.camera.right=21;sun.shadow.camera.top=21;sun.shadow.camera.bottom=-21;sun.shadow.camera.near=1;sun.shadow.camera.far=70;sun.shadow.normalBias=.025;sun.shadow.bias=-.0001;sun.shadow.radius=3;sun.target.position.set(11,0,11);this.scene.add(sun,sun.target);
  this.camera=new THREE.OrthographicCamera(-10,10,10,-10,-4000,8000);this.camera.position.set(27,31,34);
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.target.set(11.1,0,11.7);this.controls.enableDamping=true;this.controls.dampingFactor=.15;this.controls.screenSpacePanning=false;this.controls.minZoom=.48;this.controls.maxZoom=3.4;this.controls.zoomSpeed=.65;configureQuarterControls(this.controls);this.viewIndex=applyQuarterView(this.camera,this.controls,0);
  this.controls.addEventListener('start',()=>{this.flight=null;});
  this.world=new THREE.Group();this.scene.add(this.world);this.selectionLine=this.outline(1,'#edcb70');this.hoverLine=this.outline(1,'#fbfbdf');this.scene.add(this.selectionLine,this.hoverLine);this.selectionLine.visible=false;this.hoverLine.visible=false;
  this.expansionLines=new THREE.Group();this.scene.add(this.expansionLines);this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  const canvas=this.renderer.domElement;
  this.onLost=e=>{e.preventDefault();this.contextLost=true;this.sim.paused=true;this.callbacks.onContextLost?.();};this.onRestored=()=>{this.contextLost=false;this.resize();this.callbacks.onContextRestored?.();};canvas.addEventListener('webglcontextlost',this.onLost);canvas.addEventListener('webglcontextrestored',this.onRestored);
  this.activePointers=new Set();this.onDown=e=>{this.activePointers.add(e.pointerId);if(this.activePointers.size>1){this.down=null;return;}if(e.button!==0)return;this.down={x:e.clientX,y:e.clientY,time:performance.now()};};
  this.onMove=e=>this.pointerMove(e);
  this.onUp=e=>{this.activePointers.delete(e.pointerId);if(!this.down||this.activePointers.size)return;const distance=Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y),held=performance.now()-this.down.time;this.down=null;if(distance<7&&held<650){this.pointerMove(e);if(this.worldHover&&!this.mode&&(this.worldPicking||!this.hover||this.worldSpan()>95)){this.callbacks.onWorldPick?.(this.worldHover);return;}if(this.hover){if(e.pointerType==='touch'&&this.mode&&this.confirmTile!==this.hover.x+','+this.hover.z){this.confirmTile=this.hover.x+','+this.hover.z;this.callbacks.onHint?.('다시 누르면 건설');return;}this.confirmTile=null;this.callbacks.onClick?.(this.hover.x,this.hover.z);}}};
  this.onCancel=()=>{this.activePointers.clear();this.down=null;this.confirmTile=null;};
  this.onLeave=()=>{this.hoverLine.visible=false;if(this.ghost)this.ghost.visible=false;};
  this.onContext=e=>e.preventDefault();
  this.onMapKey=e=>{
   if(e.ctrlKey||e.metaKey||e.altKey||(!this.worldPicking&&this.worldSpan()<95))return;
   if(e.key==='Home'){e.preventDefault();this.showWorld();return;}
   if(e.key==='Enter'){e.preventDefault();const cell=worldCellAt(...localToWorld(this.sim,this.controls.target.x,this.controls.target.z));if(cell)this.callbacks.onWorldPick?.(cell);return;}
   const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]},v=directions[e.key];if(!v)return;
   e.preventDefault();const right=new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,1),[x,z]=localToWorld(this.sim,this.controls.target.x,this.controls.target.z);
   this.flyToWorld(x+Math.sign(right.x*v[0]+up.x*v[1])*24,z+Math.sign(right.z*v[0]+up.z*v[1])*24,this.worldSpan(),{animate:false});
  };canvas.addEventListener('keydown',this.onMapKey);
  canvas.addEventListener('pointerdown',this.onDown);canvas.addEventListener('pointermove',this.onMove);canvas.addEventListener('pointerup',this.onUp);canvas.addEventListener('pointerleave',this.onLeave);canvas.addEventListener('pointercancel',this.onCancel);canvas.addEventListener('contextmenu',this.onContext);
  let quality='auto';try{quality=localStorage.getItem('orvetharn-quality')||'auto';}catch{}this.setQuality(quality);
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.resize();this.rebuild();this.resetCamera();this.atmosphere=new WorldAtmosphere(this);this.effects=new WorldEffects(this);
  this.last=performance.now();this.uiAccum=0;this.loop=this.loop.bind(this);this.frame=requestAnimationFrame(this.loop);
 }
 outline(size,color){
  const p=[new THREE.Vector3(-.5,.11,-.5),new THREE.Vector3(size-.5,.11,-.5),new THREE.Vector3(size-.5,.11,size-.5),new THREE.Vector3(-.5,.11,size-.5)];
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(p),new THREE.LineBasicMaterial({color,depthTest:false,transparent:true,opacity:.95}));
 }
 focusBuilding(id){const b=this.sim.buildings.find(v=>v.id===id);if(!b)return;settleQuarterControls(this.controls);const dx=b.x-this.controls.target.x,dz=b.z-this.controls.target.z;this.camera.position.x+=dx;this.camera.position.z+=dz;this.controls.target.x=b.x;this.controls.target.z=b.z;this.controls.update();}
 setQuality(value){
  this.quality=['auto','high','balanced','low'].includes(value)?value:'auto';
  const effective=this.quality==='auto'?(this.renderer.isSoftware?'low':this.container.clientWidth<700?'balanced':'high'):this.quality;
  this.maxFps=effective==='high'?60:30;this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,effective==='high'?1.75:effective==='balanced'?1.25:1));
  this.renderer.shadowMap.enabled=effective!=='low';this.sun.shadow.mapSize.set(effective==='high'?2048:1024,effective==='high'?2048:1024);if(this.sun.shadow.map){this.sun.shadow.map.dispose();this.sun.shadow.map=null;}this.renderer.shadowMap.needsUpdate=true;this.resize();
  try{localStorage.setItem('orvetharn-quality',this.quality);}catch{}
 }
 resize(){this.lastPaint=null;const w=this.container.clientWidth,h=this.container.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);const span=w<700?7.1:6.8;this.camera.left=-span*w/h;this.camera.right=span*w/h;this.camera.top=span;this.camera.bottom=-span;this.controls.minZoom=(this.camera.right-this.camera.left)/((WORLD_SIZE.width+WORLD_SIZE.height)*.9);this.camera.zoom=Math.max(this.controls.minZoom,this.camera.zoom);this.camera.updateProjectionMatrix();}
 // Facility markers: React (onMarkers, 0.4 s) decides which exist and what they say; their screen position follows the
 // camera every frame here (B11), so a drag, zoom or 90-degree turn never leaves them behind.
 markerPoint(b,w,h){const v=this.markerVector||(this.markerVector=new THREE.Vector3());v.set(b.x,({well:1.02,lumber:.72,sawmill:.72,field:.64})[b.type]||1.38,b.z).project(this.camera);return {x:(v.x+1)*w/2,y:(1-v.y)*h/2};}
 placeMarkers(){
  const w=this.container.clientWidth,h=this.container.clientHeight,byId=new Map(this.sim.buildings.map(b=>[b.id,b]));
  for(const el of this.markerLayer.children){const b=byId.get(Number(el.dataset.buildingId));if(!b){el.style.visibility='hidden';continue;}
   const p=this.markerPoint(b,w,h),t='translate('+p.x.toFixed(1)+'px,'+p.y.toFixed(1)+'px) translate(-50%,-100%)',hide=p.x<=60||p.x>=w-60||p.y<=70||p.y>=h-90?'hidden':'';
   if(el.tgTransform!==t){el.tgTransform=t;el.style.transform=t;}if(el.tgHidden!==hide){el.tgHidden=hide;el.style.visibility=hide;}if(!el.dataset.placed)el.dataset.placed='1';}
 }
 // Before a new town is shown (Game.tsx begin, visitSite, installSave): compile its shaders without blocking
 // (compileAsync uses KHR_parallel_shader_compile) and upload its textures a few per task, so the first frame does not
 // stall for 0.5-1 s (round-3 profile: texSubImage2D and getProgramInfoLog in one long task). The loop skips frames
 // meanwhile; the transition picture stays up until it resolves. CPU renderer: nothing to warm.
 async warmUp(budget=2500){
  const r=this.renderer;if(r.isSoftware||!r.compileAsync)return;this.warming=true;const t0=performance.now(),pause=()=>new Promise(res=>setTimeout(res,0));
  try{
   this.controls.update();this.camera.updateMatrixWorld();this.syncPeople();this.scene.updateMatrixWorld(true);
   await Promise.race([r.compileAsync(this.scene,this.camera),new Promise(res=>setTimeout(res,budget))]);
   const textures=new Set();this.scene.traverse(o=>{for(const m of [o.material].flat())if(m)for(const v of Object.values(m))if(v?.isTexture&&v.image)textures.add(v);});
   let slice=performance.now();
   for(const tex of textures){if(performance.now()-t0>budget)break;r.initTexture(tex);if(performance.now()-slice>12){await pause();slice=performance.now();}}
  }catch(e){console.warn('warmUp skipped',e);}finally{this.warming=false;}
 }
 setSimulation(sim,{preserveCamera=false}={}){const at=localToWorld(this.sim,this.controls.target.x,this.controls.target.z),zoom=this.camera.zoom;this.sim=sim;this.selection=null;this.callbacks.onMarkers?.([]);this.setMode(null);this.lastRevision=-1;this.rebuild();if(preserveCamera){const [x,z]=worldToLocal(sim,...at);this.controls.target.set(x,0,z);this.camera.zoom=zoom;this.setQuarterView(this.viewIndex);}else this.resetCamera();}
 worldSpan(){return (this.camera.right-this.camera.left)/this.camera.zoom;}
 worldScreenPoint(x,z){const [lx,lz]=worldToLocal(this.sim,x,z),p=new THREE.Vector3(lx,0,lz).project(this.camera);return {x:(p.x+1)*this.container.clientWidth/2,y:(1-p.y)*this.container.clientHeight/2};}
 flyToWorld(x,z,span,{animate=true}={}){
  settleQuarterControls(this.controls);const [lx,lz]=worldToLocal(this.sim,x,z),zoom=Math.max(this.controls.minZoom,Math.min(3.4,(this.camera.right-this.camera.left)/span));
  const reduced=typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(animate&&!reduced)this.flight={start:performance.now(),from:this.controls.target.clone(),to:new THREE.Vector3(lx,0,lz),zoom:this.camera.zoom,toZoom:zoom};
  else{this.flight=null;this.controls.target.set(lx,0,lz);this.camera.zoom=zoom;this.camera.updateProjectionMatrix();this.setQuarterView(this.viewIndex);this.lastPaint=null;}
 }
 focusProvince(id,span=60){const point=plotCenter(id);if(point){this.landscape?.select(id);this.flyToWorld(...point,span);}}
 showWorld(){this.setMode(null);this.select(null);this.flyToWorld(WORLD_SIZE.width/2,WORLD_SIZE.height/2,(WORLD_SIZE.width+WORLD_SIZE.height)*.76);}
 resetCamera(){this.flight=null;settleQuarterControls(this.controls);this.controls.target.set(11.5,0,11.5);this.camera.zoom=Math.min((this.camera.right-this.camera.left)/52,(this.camera.top-this.camera.bottom)/34);this.controls.minZoom=(this.camera.right-this.camera.left)/((WORLD_SIZE.width+WORLD_SIZE.height)*.9);this.camera.updateProjectionMatrix();this.setQuarterView(0);}
 setQuarterView(view){this.viewIndex=applyQuarterView(this.camera,this.controls,view);this.renderer.cache?.clear();this.renderer.poseCache?.clear();this.renderer.domElement.dataset.cameraView=QUARTER_VIEWS[this.viewIndex];this.renderer.domElement.dataset.cameraQuarter=String(this.viewIndex);this.renderer.domElement.dataset.cameraAzimuth=String(this.controls.getAzimuthalAngle());this.renderer.domElement.dataset.cameraPolar=String(this.controls.getPolarAngle());for(const m of this.models.values())m.userData.animate?.(this.sim.time,m.userData.building,this.sim,this.viewIndex);this.hover=null;this.confirmTile=null;this.hoverLine.visible=false;if(this.ghost){this.ghost.visible=false;this.ghost.userData.animate?.(this.sim.time,{working:false,progress:0,inputs:{}},this.sim,this.viewIndex);}for(const p of [...this.nature,...(this.decorations||[])])p.userData.animate?.(this.sim.time,p.userData.tile,false,this.viewIndex);this.scenery?.animate(this.sim.time,this.viewIndex);this.callbacks.onViewChange?.(QUARTER_VIEWS[this.viewIndex]);}
 focusEdge(side){const [x,z]=edgePoint(side,5,11.5);settleQuarterControls(this.controls);this.controls.target.set(x,0,z);this.camera.zoom=Math.max(.8,this.camera.zoom);this.camera.updateProjectionMatrix();this.setQuarterView(this.viewIndex);}
 rotate(direction){if(Number.isFinite(direction)&&direction!==0)this.setQuarterView(this.viewIndex+Math.sign(direction));}
 setOverlay(value){this.overlay=value;this.rebuild();}
 zoom(by){this.flight=null;this.camera.zoom=THREE.MathUtils.clamp(this.camera.zoom*by,this.controls.minZoom,3.4);this.camera.updateProjectionMatrix();}
 setMode(mode){
  if(mode&&(this.worldSpan()>95||this.controls.target.x<0||this.controls.target.x>24||this.controls.target.z<0||this.controls.target.z>24))this.focusProvince(this.sim.provinceId,55);
  if(mode)this.callbacks.onMarkers?.([]);
  this.mode=mode;this.relocatingId=null;if(this.buildGrid)this.buildGrid.visible=!!BUILDINGS[mode];this.confirmTile=null;this.hover=null;if(this.ghost){this.scene.remove(this.ghost);release(this.ghost);this.ghost=null;}
  if(mode&&BUILDINGS[mode]&&!BUILDINGS[mode].tile){
   this.ghost=makeBuilding(mode,this.sim.residentOf(mode)||this.sim.race);this.ghost.name='ghost-'+mode;this.ghost.traverse(n=>{if(n.isMesh||n.isSprite){n.material=(Array.isArray(n.material)?n.material:[n.material]).map(v=>{const m=v.clone();m.onBeforeCompile=v.onBeforeCompile;m.customProgramCacheKey=v.customProgramCacheKey;if(n.isSprite&&n.userData.ownedMaterial)v.dispose();m.userData.shared=false;m.transparent=true;m.opacity=.42;m.alphaTest=.01;m.depthWrite=false;return m;});if(n.material.length===1)n.material=n.material[0];n.userData.ownedMaterial=true;n.castShadow=false;}});
   this.ghost.userData.animate?.(this.sim.time,{working:false,progress:0,inputs:{}},this.sim,this.viewIndex);this.ghost.visible=false;this.scene.add(this.ghost);
  }
  this.drawExpansions();this.hoverLine.visible=false;
 }
 selectTile(x,z){this.select(null);this.tileSelection={x,z};this.selectionLine.visible=true;this.selectionLine.position.set(x,.02,z);}
 select(id){this.tileSelection=null;this.selection=id;const b=this.sim.buildings.find(a=>a.id===id);this.scene.remove(this.selectionLine);this.selectionLine.geometry.dispose();this.selectionLine.material.dispose();this.selectionLine=this.outline(b?.size||1,'#f9da70');this.scene.add(this.selectionLine);this.selectionLine.visible=!!b;if(b)this.selectionLine.position.set(b.x,.012,b.z);}
 drawExpansions(){
  release(this.expansionLines);this.expansionLines.clear();if(this.mode!=='expand')return;
  for(let cx=0;cx<6;cx++)for(let cz=0;cz<6;cz++)if(this.sim.canExpand(cx,cz)){const line=this.outline(4,'#f5d889');line.position.set(cx*4,.07,cz*4);this.expansionLines.add(line);}
 }
 pointerMove(e){
  const rect=this.renderer.domElement.getBoundingClientRect();this.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);
  const hit=new THREE.Vector3();if(!this.raycaster.ray.intersectPlane(this.plane,hit))return;
  if(this.landscape){const ridge=this.raycaster.intersectObjects(this.landscape.landmarks.children.filter(n=>n.visible),true)[0];if(ridge&&ridge.distance<this.raycaster.ray.origin.distanceTo(hit))hit.copy(ridge.point);}
  this.worldHover=worldCellAt(...localToWorld(this.sim,hit.x,hit.z));
  if(this.worldHover?.terrain==='mountain'){this.hover=null;this.onLeave();return;}
  if(this.worldPicking||this.worldSpan()>95){this.hover=null;this.onLeave();return;}
  let x=Math.floor(hit.x+.5),z=Math.floor(hit.z+.5);
  if(!this.mode){const models=[...this.models.values()];const hits=this.raycaster.intersectObjects(models,true);if(hits.length){let n=hits[0].object;while(n&&!n.userData.building)n=n.parent;if(n?.userData.building){x=n.userData.building.x;z=n.userData.building.z;}}}
  if(x<0||z<0||x>=N||z>=N){this.hover=null;this.onLeave();return;}
  const size=this.mode==='expand'?4:BUILDINGS[this.mode]?.size||this.sim.at(x,z)?.size||1;
  if(this.mode==='expand'){x=Math.floor(x/4)*4;z=Math.floor(z/4)*4;}
  if(this.hover?.x===x&&this.hover?.z===z&&this.hover?.mode===this.mode)return;
  this.hover={x,z,mode:this.mode};this.scene.remove(this.hoverLine);this.hoverLine.geometry.dispose();this.hoverLine.material.dispose();const error=BUILDINGS[this.mode]?(this.relocatingId?this.sim.canRelocate(this.relocatingId,x,z):this.sim.canBuild(this.mode,x,z)):this.mode==='expand'&&!this.sim.canExpand(x/4,z/4)?'인접한 구역을 선택하세요':null;
  this.hoverLine=this.outline(size,error?'#ed775e':'#f4f7da');this.hoverLine.position.set(x,.06,z);this.scene.add(this.hoverLine);this.hoverLine.visible=true;
  if(this.ghost){this.ghost.position.set(x+(size-1)/2,BUILDINGS[this.mode]?.onWater?-.135:.025,z+(size-1)/2);this.ghost.visible=true;}
  this.callbacks.onHover?.({x,z,error,owned:this.sim.ownedAt(x,z)});
 }
 rebuild(){
  this.lastPaint=null;
  const previousHealth=this.conditionSimulation===this.sim?new Map([...this.models].map(([id,m])=>[id,m.userData.conditionHealth])):new Map();
  this.conditionSimulation=this.sim;
  this.idleExportCarts=new Map();
  // A cut stump is a short visual effect, never a new save-file terrain type.
  if(this.stumpSimulation!==this.sim){this.stumps=new Map();this.stumpSimulation=this.sim;}
  for(const n of this.nature){const t=n.userData.tile;if(n.userData.wasMature&&t===this.sim.tile(t.x,t.z)&&t.nature===null&&t.remaining<=0&&!this.sim.at(t.x,t.z)&&!this.sim.roads.has(t.x+','+t.z))this.stumps.set(t.x+','+t.z,{x:t.x,z:t.z,scale:n.scale.x,until:this.sim.time+2.4});}
  for(const [key,s]of this.stumps)if(s.until<=this.sim.time||this.sim.tile(s.x,s.z)?.nature||this.sim.at(s.x,s.z)||this.sim.roads.has(key))this.stumps.delete(key);
  this.renderer.cache?.clear();release(this.world);this.scene.remove(this.world);this.world=new THREE.Group();this.scene.add(this.world);this.models.clear();this.workerModels.clear();this.enemyModels=new Map();this.nature=[];this.dockBoats=[];
  if(this.sim.layout.cell){
   if(this.scenery){release(this.scenery.group);this.scene.remove(this.scenery.group);this.scenery=null;}
   if(!this.landscape)this.landscape=new WorldLandscape(this,this.sim);else if(this.landscape.sim!==this.sim)this.landscape.rebase(this.sim);
  }else{if(this.landscape){this.landscape.dispose();this.landscape=null;this.renderer.worldFog=null;}const sceneryKey=this.sim.region+':'+this.sim.race+':'+tradeProvince(this.sim)+':'+JSON.stringify(this.sim.layout);if(this.sceneryKey!==sceneryKey){this.renderer.surfacePatterns?.clear();if(this.scenery){release(this.scenery.group);this.scene.remove(this.scenery.group);}this.scenery=makeScenery(this.sim.region,this.sim.race,this.sim);this.scene.add(this.scenery.group);this.sceneryKey=sceneryKey;}}
  const sim=this.sim;
  this.networkCargo=new Map();this.starterCargo=new Map();
  this.terrain=makeMapTerrain(sim,this.overlay);this.world.add(this.terrain);this.water=this.terrain.userData.water;
  const grid=[];for(let i=0;i<=N;i++){const v=i-.5;grid.push(new THREE.Vector3(v,.035,-.5),new THREE.Vector3(v,.035,N-.5),new THREE.Vector3(-.5,.035,v),new THREE.Vector3(N-.5,.035,v));}
  this.buildGrid=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(grid),new THREE.LineBasicMaterial({color:'#f5ebc5',transparent:true,opacity:.18}));this.buildGrid.visible=!!BUILDINGS[this.mode];this.world.add(this.buildGrid);
  this.world.add(makePlotBoundaries());
  this.decorations=[];
  for(const t of sim.tiles){
   const key=t.x+','+t.z;
   if(t.terrain==='water')continue;
   if(t.nature&&!sim.at(t.x,t.z)&&!sim.roads.has(key)){
    const tree=biomeTree(sim.layout,t),scale=.67+treeCluster(sim.layout,t.x,t.z)*.28;
    const obj=['tree','sapling'].includes(t.nature)?(tree?makePixelProp(tree,scale*(t.nature==='sapling'?.35:1)):makeTree(Math.floor(noise(t.z,t.x)*6),scale)):makeRock(.9+noise(t.x,t.z)*.25,t.ore>70?'oreRock':t.moisture>70?'mossrock':'rock');
    if(!sim.ownedAt(t.x,t.z))fadeUnowned(obj);
    obj.position.set(t.x,.015,t.z);obj.userData.tile=t;obj.userData.wasMature=t.nature==='tree';obj.userData.animate?.(sim.time,t,false,this.viewIndex);this.world.add(obj);this.nature.push(obj);
   }else if(!sim.at(t.x,t.z)&&!sim.roads.has(key)&&!sim.pipes?.has(key)&&!sim.conveyors?.has(key)&&!sim.rails?.has(key)){
    const waterEdge=CARDINALS.find(([dx,dz])=>sim.tile(t.x+dx,t.z+dz)?.terrain==='water');
    const decor=biomeOf(sim.layout)?biomeDecoration(sim.layout,t):noise(t.x+5,t.z)>.91?(waterEdge?'reeds':'bush'):null;
    if(!decor)continue;
    const prop=makePixelProp(decor,decor==='bush'?.50:1);
    prop.position.set(t.x+(waterEdge?.[0]||1)*.32,.014,t.z+(waterEdge?.[1]||1)*.32);
    this.world.add(prop);this.decorations.push(prop);
   }
  }
  for(const s of this.stumps.values()){const stump=makeTree(0,s.scale);stump.position.set(s.x,.015,s.z);stump.userData.stumpUntil=s.until;stump.userData.animate(sim.time,{nature:null});this.world.add(stump);this.nature.push(stump);}
  const bounds=[];for(const key of sim.owned){const[x,z]=key.split(',').map(Number);for(const [dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]])if(!sim.ownedAt(x+dx,z+dz)){if(dx)bounds.push(new THREE.Vector3(x+dx*.5,.04,z-.5),new THREE.Vector3(x+dx*.5,.04,z+.5));else bounds.push(new THREE.Vector3(x-.5,.04,z+dz*.5),new THREE.Vector3(x+.5,.04,z+dz*.5));}}
  const border=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(bounds),new THREE.LineDashedMaterial({color:'#f5e6af',dashSize:.16,gapSize:.09,transparent:true,opacity:.88}));border.computeLineDistances();this.world.add(border);
  for(const b of sim.buildings){const m=makeBuilding(b.type,b.race||sim.race);m.position.set(b.x+(b.size-1)/2,BUILDINGS[b.type].onWater?-.15:.01,b.z+(b.size-1)/2);m.userData.building=b;this.models.set(b.id,m);this.world.add(m);m.userData.conditionHealth=previousHealth.get(b.id)??b.health;}
  const moorings=new Set();
  for(const b of sim.buildings.filter(v=>PORT_VEHICLES[v.type])){
   const water=sim.tiles.filter(t=>t.terrain==='water'&&!sim.at(t.x,t.z)&&!moorings.has(t.x+','+t.z)&&Math.hypot(t.x-b.x,t.z-b.z)<=3)
    .sort((a,c)=>Math.hypot(a.x-b.x,a.z-b.z)-Math.hypot(c.x-b.x,c.z-b.z))[0];
   if(water){const boat=makePixelProp(PORT_VEHICLES[b.type],.65);boat.userData.vehicle=true;boat.position.set(water.x,-.16,water.z);boat.rotation.y=Math.atan2(b.x-water.x,b.z-water.z);this.world.add(boat);moorings.add(water.x+','+water.z);this.dockBoats.push({boat,b,x:water.x,z:water.z});}
  }
  for(const w of sim.workers){const m=makeWorker(w.id,w.race||this.sim.race,w.appearance);this.workerModels.set(w.id,m);this.world.add(m);}
  this.railPath=stationRailPath(sim);
  this.freight=[];for(const route of sim.campaign?.routes||[]){if(route.from!==sim.siteId&&route.to!==sim.siteId)continue;const m=makeFreightVehicle(route.mode,route.item);this.world.add(m);this.freight.push({m,route});}const gate=makeExportGate();gate.position.set(EXPORT_GATE.x,.01,EXPORT_GATE.z);this.world.add(gate);this.decorations.push(gate);this.exportCarts=new Map();this.drawExpansions();const tileSelection=this.tileSelection;this.select(this.selection);if(tileSelection&&!this.selection)this.selectTile(tileSelection.x,tileSelection.z);this.lastRevision=sim.revision;
 }
 // Residents follow the simulation every frame; warmUp calls it too, so their character atlases are
 // uploaded behind the transition picture instead of in the first visible frame.
 syncPeople(){
   for(const w of this.sim.workers){let m=this.workerModels.get(w.id);if(!m){m=makeWorker(w.id,w.race||this.sim.race,w.appearance);this.workerModels.set(w.id,m);this.world.add(m);}animateWorker(m,w,this.sim.time,this.camera,this.characterSurface);m.visible=!w.atHome;}
   for(const[id,m]of this.workerModels)if(!this.sim.workers.some(w=>w.id===id)){this.world.remove(m);release(m);this.workerModels.delete(id);}
   this.syncExportVehicles();
 }
 syncExportVehicles(){
  const items=Object.entries(this.sim.starterStore?.inventory||{}).filter(([,n])=>n>0).slice(0,3),ids=new Set(items.map(([id])=>id));
  for(const [i,[item]]of items.entries()){let m=this.starterCargo.get(item);if(!m){m=makeNetworkCargo(item,'storage');this.starterCargo.set(item,m);this.world.add(m);}m.position.set(7+(i-1)*.22,.18,11.32);m.userData.animate(this.sim.time,null,false,this.viewIndex);}
  for(const[id,m]of this.starterCargo)if(!ids.has(id)){this.world.remove(m);release(m);this.starterCargo.delete(id);}
  const idle=parkedVehicles(this.sim),idleIds=new Set(idle.map(v=>v.id));
  for(const v of idle){
   const kind=shipmentVehicle({vehicle:v.kind},this.sim,v);let m=this.idleExportCarts.get(v.id);
   if(m&&m.userData.vehicleKind!==kind){this.world.remove(m);release(m);this.idleExportCarts.delete(v.id);m=null;}
   if(!m){m=makeFreightVehicle(kind);this.idleExportCarts.set(v.id,m);this.world.add(m);}
   const stock=Object.entries(this.sim.starterStore?.inventory||{}).find(([,n])=>n>0);m.userData.loaded=!!stock;m.userData.cargoItem=stock?.[0];m.position.set(v.x,v.afloat?-.16:.08,v.z);m.rotation.y=-Math.PI/2;m.userData.animate?.(this.sim.time,null,false,this.viewIndex);
  }
  for(const[id,m]of this.idleExportCarts)if(!idleIds.has(id)){this.world.remove(m);release(m);this.idleExportCarts.delete(id);}
  for(const sh of this.sim.shipments||[]){
   const p=shipmentPose(sh),kind=shipmentVehicle(sh,this.sim,p);let m=this.exportCarts.get(sh.id);
   if(m&&m.userData.vehicleKind!==kind){this.world.remove(m);release(m);this.exportCarts.delete(sh.id);m=null;}
   if(!m){m=makeFreightVehicle(kind,sh.item);this.exportCarts.set(sh.id,m);this.world.add(m);}
   m.visible=!sh.away;m.userData.loaded=shipmentLoaded(sh);m.userData.cargoItem=sh.item;
   m.position.set(p.x,kind==='raft'||kind==='steamer'?-.16:.08,p.z);m.rotation.y=Math.atan2(p.dx,p.dz);m.userData.animate?.(this.sim.time,null,false,this.viewIndex);
  }
  for(const[id,m]of this.exportCarts)if(!this.sim.shipments.some(sh=>sh.id===id)){this.world.remove(m);release(m);this.exportCarts.delete(id);}
 }
 loop(now){
  if(!this.alive)return;if(this.contextLost||this.active===false||this.warming){this.last=now;this.frame=requestAnimationFrame(this.loop);return;}if(now-this.last<1000/this.maxFps-1){this.frame=requestAnimationFrame(this.loop);return;}const dt=Math.min((now-this.last)/1000,.5);this.last=now;advanceGame(this.sim,dt);
  if(this.lastRevision!==this.sim.revision)this.rebuild();
  if(this.overlay==='power'){const grid=this.sim.gridStatus(),key=grid.groups.map(g=>g.nodes.map(b=>b.id).join(',')+':'+g.supply.toFixed(1)+':'+g.used.toFixed(1)).join('|')+';'+[...grid.powered].join(',');if(this.lastPowerOverlay!==key){this.lastPowerOverlay=key;this.rebuild();}}
  if(this.flight){const f=this.flight,t=Math.min(1,(now-f.start)/850),k=t*t*(3-2*t),delta=this.controls.target.clone();this.controls.target.lerpVectors(f.from,f.to,k);delta.sub(this.controls.target);this.camera.position.sub(delta);this.camera.zoom=Math.exp(Math.log(f.zoom)*(1-k)+Math.log(f.toZoom)*k);this.camera.updateProjectionMatrix();if(t===1)this.flight=null;}
  this.controls.update();
  if(this.landscape){const [ox,oz]=worldOrigin(this.sim),x=THREE.MathUtils.clamp(this.controls.target.x,-ox,WORLD_SIZE.width-ox),z=THREE.MathUtils.clamp(this.controls.target.z,-oz,WORLD_SIZE.height-oz);this.camera.position.x+=x-this.controls.target.x;this.camera.position.z+=z-this.controls.target.z;this.controls.target.x=x;this.controls.target.z=z;this.landscape.update();this.world.visible=this.worldSpan()<450;this.landscape.attachFog(this.world);}
  this.camera.updateMatrixWorld();
  this.atmosphere.update(dt);
  for(const [id,m]of this.models){const b=this.sim.buildings.find(v=>v.id===id);if(b){m.userData.animate?.(this.sim.time,b,this.sim,this.viewIndex);m.rotation.z=0;}}
  this.syncPeople();
  for(const {boat,b,x,z} of this.dockBoats||[]){boat.position.y=-.16+Math.sin(this.sim.time*.8)*.008;boat.position.z=z+(b.type==='dock'&&b.working&&b.health>0&&b.enabled!==false?Math.sin(b.progress*Math.PI)*.25:0);boat.userData.animate(this.sim.time,null,false,this.viewIndex);}
  this.scenery?.animate(this.sim.time,this.viewIndex);this.callbacks.onAudio?.(this.sim,this.controls.target,{span:this.worldSpan(),viewIndex:this.viewIndex});
  for(const prop of this.decorations||[])prop.userData.animate?.(this.sim.time,null,false,this.viewIndex);
  const harvesting=new Set(this.sim.buildings.filter(b=>b.working&&BUILDINGS[b.type]?.natural==='tree').map(b=>this.sim.closestNatural(b,'tree')));
  for(const n of this.nature){if(n.userData.stumpUntil)n.visible=this.sim.time<n.userData.stumpUntil;else n.userData.animate?.(this.sim.time,n.userData.tile,harvesting.has(n.userData.tile),this.viewIndex);}
  this.terrain?.userData.animate(this.sim.time);
  const transfers=logisticsVisualEvents(this.sim).filter(e=>e.path),visibleTransfers=new Set(transfers.map(e=>e.id));
  for(const event of transfers){let m=this.networkCargo.get(event.id);if(!m){m=makeNetworkCargo(event.item,event.kind);this.networkCargo.set(event.id,m);this.world.add(m);}const pose=transferPose(event,this.sim.time);m.position.set(pose.x,event.kind==='pipe'?.09:.15,pose.z);m.userData.animate(this.sim.time,null,false,this.viewIndex);}
  for(const [id,m]of this.networkCargo)if(!visibleTransfers.has(id)){this.world.remove(m);release(m);this.networkCargo.delete(id);}
  for(const enemy of [...(this.sim.attackers||[]),...(this.sim.guards||[])]){let m=this.enemyModels.get(enemy.id);if(!m){m=makeWorker(Number(enemy.id)||0,enemy.race,enemy.appearance);const bar=new THREE.Group();const bg=new THREE.Mesh(new THREE.PlaneGeometry(.5,.065),new THREE.MeshBasicMaterial({color:'#382f35',side:THREE.DoubleSide}));const hp=new THREE.Mesh(new THREE.PlaneGeometry(.46,.035),new THREE.MeshBasicMaterial({color:enemy.guard?'#59baa3':'#eb826c',side:THREE.DoubleSide}));bar.add(bg,hp);bar.position.y=1.45;hp.position.z=.002;bar.userData.fill=hp;m.add(bar);m.userData.hpBar=bar;m.userData.worker=true;this.enemyModels.set(enemy.id,m);this.world.add(m);}animateWorker(m,enemy,this.sim.time,this.camera,this.characterSurface);if(m.userData.hpBar){m.userData.hpBar.visible=enemy.hp>0;m.userData.hpBar.quaternion.copy(m.quaternion).invert().multiply(this.camera.quaternion);m.userData.hpBar.userData.fill.scale.x=Math.max(.01,(enemy.hp??1)/(enemy.maxHp??1));}}for(const[id,m]of this.enemyModels){if(![...this.sim.attackers,...(this.sim.guards||[])].some(e=>e.id===id)){this.world.remove(m);release(m);this.enemyModels.delete(id);}}
  this.uiAccum+=dt;this.frameSamples=(this.frameSamples||0)+1;this.frameElapsed=(this.frameElapsed||0)+dt;if(this.uiAccum>.4){this.uiAccum=0;this.renderer.domElement.dataset.fps=String(Math.round(this.frameSamples/this.frameElapsed));this.renderer.domElement.dataset.renderer=this.renderer.isSoftware?'canvas':'webgl';this.renderer.domElement.dataset.geometries=String(this.renderer.info?.memory.geometries||(this.renderer.cache?.size||0)+(this.renderer.poseCache?.size||0));this.renderer.domElement.dataset.textures=String(this.renderer.info?.memory.textures||0);this.renderer.domElement.dataset.models=String(this.models.size+this.workerModels.size+this.enemyModels.size);this.renderer.domElement.dataset.gameTime=String(Math.round(this.sim.time*10)/10);this.renderer.domElement.dataset.characterStyle='pixel';this.renderer.domElement.dataset.characterFrames=[...this.workerModels.values()].map(m=>m.userData.direction+':'+m.userData.frame).join(',');this.frameSamples=0;this.frameElapsed=0;this.callbacks.onUpdate?.(this.sim);const w=this.container.clientWidth,h=this.container.clientHeight;this.callbacks.onMarkers?.(this.sim.buildings.filter(b=>!this.mode).map(b=>{const p=this.markerPoint(b,w,h);return {id:b.id,type:b.type,status:b.status,working:b.working,x:p.x,y:p.y};}).filter(m=>m.x>-200&&m.x<w+200&&m.y>-200&&m.y<h+200));}
  if(this.markerLayer)this.placeMarkers();
  for(const {m,route} of this.freight||[]){
   const p=1-route.remaining/route.duration;
   const station=this.sim.buildings.find(b=>b.type==='station')||this.sim.warehouse;
   const pose=route.mode==='rail'?railPathPose(this.railPath,p,route.to===this.sim.siteId):station?{x:station.x-2+p*5,z:station.z+1,dir:Math.PI/2}:null;
   m.visible=!!route.cargo&&!!pose;
   if(m.visible){m.position.set(pose.x,route.mode==='rail'?.04:.08,pose.z);m.rotation.y=pose.dir;m.userData.animate?.(this.sim.time,null,false,this.viewIndex);}
  }
  this.effects.update();
  const paintKey=this.sim.time+':'+this.sim.revision+':'+this.camera.matrixWorld.elements.join(',')+':'+this.camera.zoom+':'+this.mode+':'+this.selection+':'+this.hover?.x+','+this.hover?.z+':'+this.container.clientWidth+':'+this.container.clientHeight+':'+this.atmosphere.time;if(!this.sim.paused||paintKey!==this.lastPaint){this.renderer.render(this.scene,this.camera);this.lastPaint=paintKey;}this.frame=requestAnimationFrame(this.loop);
 }
 // Building art does not depend on the race (only resident portraits do), so each building icon is drawn once per
 // scene and shared by every race's icon object. Icons are drawn a few per idle period (placed types first) and
 // encoded off the main path with toBlob, so the catalog never freezes startup; the returned object fills in place
 // and the next UI update shows the new icons (callbacks.onIcons fires once the catalog is complete).
 icons(race=this.sim.race){
  if(!this.iconCache){const cache=new Map();cache.clear=()=>{Map.prototype.clear.call(cache);this.iconGeneration=(this.iconGeneration||0)+1;this.buildingIcons=new Map();this.iconPending=new Set();};this.iconCache=cache;}
  if(!this.buildingIcons){this.buildingIcons=new Map();this.iconPending=new Set();this.iconGeneration=0;}
  let result=this.iconCache.get(race);
  if(!result){
   result={};
   for(const id of FACTIONS[factionOf(race)].members)for(const look of RESIDENT_LOOKS[id]||[{id:'default'}]){
    result['resident-'+id+'-'+look.id]=pixelIdentity(id,0,look.id).portrait;
    if(!result['resident-'+id])result['resident-'+id]=result['resident-'+id+'-'+look.id];
   }
   this.iconCache.set(race,result);
  }
  for(const [type,url] of this.buildingIcons)result[type]=url;
  this.drawIcons();return result;
 }
 iconQueue(){const placed=new Set(this.sim.buildings.map(b=>b.type)),left=Object.keys(BUILDINGS).filter(t=>!this.buildingIcons.has(t)&&!this.iconPending.has(t));return [...left.filter(t=>placed.has(t)),...left.filter(t=>!placed.has(t))];}
 drawIcons(){
  if(this.iconTask||!this.alive)return;
  const queue=this.iconQueue();if(!queue.length)return;
  // While the town is on screen, a 6 ms slice (at least one icon, ~20 ms on a slow CPU) every 80 ms: bounded cost and the
  // catalog still completes in seconds. On the title/home/world screens the scene is inactive, so idle periods do it.
  const playing=this.active!==false,generation=this.iconGeneration,run=deadline=>{
   this.iconTask=null;if(!this.alive)return;const start=performance.now();
   for(const type of queue){if(generation!==this.iconGeneration)break;if(this.buildingIcons.has(type)||this.iconPending.has(type))continue;this.drawIcon(type,generation);if(performance.now()-start>6||deadline.timeRemaining()<4)break;}
   this.drawIcons();
  };
  this.iconTask=!playing&&typeof requestIdleCallback==='function'?{idle:requestIdleCallback(run,{timeout:300})}:{timer:setTimeout(()=>run({timeRemaining:()=>8}),playing?80:16)};
 }
 drawIcon(type,generation){
  if(!this.iconRenderer){const renderer=createRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(150,130);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.37;
   const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#ffffff','#b1be8d',2.6));const light=new THREE.DirectionalLight('#ffe8c9',3);light.position.set(-3,8,5);scene.add(light);
   const camera=new THREE.OrthographicCamera(-.78,.78,.70,-.70,.1,30);camera.position.set(4,4.42,4);camera.lookAt(0,.42,0);this.iconRenderer={renderer,scene,camera};}
  const {renderer,scene,camera}=this.iconRenderer,model=makeBuilding(type,BUILDINGS[type].resident||this.sim.race);
  model.userData.animate?.(1,{working:true,progress:.8,inputs:{grain:3},animationTime:1},null);scene.add(model);renderer.render(scene,camera);scene.remove(model);release(model);
  this.iconPending.add(type);
  const done=url=>{
   this.iconPending.delete(type);if(generation!==this.iconGeneration||!this.alive)return;
   if(url){this.buildingIcons.set(type,url);for(const result of this.iconCache.values())result[type]=url;}
   if(!this.iconPending.size&&!this.iconQueue().length){this.disposeIconRenderer();this.callbacks.onIcons?.();}
  };
  // toBlob copies the pixels now and encodes the PNG asynchronously; the next icon may reuse the canvas at once.
  const canvas=renderer.domElement;if(canvas.toBlob)canvas.toBlob(blob=>done(blob&&URL.createObjectURL(blob)),'image/png');else done(canvas.toDataURL('image/png'));
 }
 disposeIconRenderer(){const r=this.iconRenderer;if(!r)return;this.iconRenderer=null;r.renderer.dispose();r.renderer.forceContextLoss?.();}
 dispose(){
  this.alive=false;cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();this.controls.dispose();
  if(this.iconTask?.idle)cancelIdleCallback(this.iconTask.idle);if(this.iconTask?.timer)clearTimeout(this.iconTask.timer);this.iconTask=null;this.disposeIconRenderer();
  const c=this.renderer.domElement;c.removeEventListener('webglcontextlost',this.onLost);c.removeEventListener('webglcontextrestored',this.onRestored);c.removeEventListener('pointerdown',this.onDown);c.removeEventListener('pointermove',this.onMove);c.removeEventListener('pointerup',this.onUp);c.removeEventListener('pointerleave',this.onLeave);c.removeEventListener('pointercancel',this.onCancel);c.removeEventListener('contextmenu',this.onContext);
  c.removeEventListener('keydown',this.onMapKey);this.effects.dispose();this.atmosphere.dispose();this.landscape?.dispose();release(this.world);release(this.scenery?.group);release(this.ghost);release(this.selectionLine);release(this.hoverLine);release(this.expansionLines);this.renderer.dispose();c.remove();
 }
}
