import {RESIDENT_LOOKS} from './resident-roster.js';
import {pixelIdentity} from './pixel-character-data.js';
import {RACES,FACTIONS,factionOf} from './world.js';
import * as THREE from 'three';
import { makeScenery } from './scenery.js';
import { createRenderer } from './software-renderer.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { N, BUILDINGS, noise } from './simulation.js';
import { makeBuilding, makeTree, makeRock, makeWorker, animateWorker, makeFreightVehicle, makeExportGate, mat, box } from './models.js';
import { EXPORT_GATE, shipmentPose } from './export-route.js';
import { shipmentVehicle, shipmentLoaded, PORT_VEHICLES } from './vehicle-art.js';
import {biomeTree,biomeDecoration} from './biome-terrain.js';
import {biomeOf} from './biome-data.js';
import { makePixelProp } from './pixel-environment.js';
import { makeMapTerrain, CARDINALS } from './pixel-terrain.js';
import { configureQuarterControls, applyQuarterView, settleQuarterControls, QUARTER_VIEWS } from './quarter-camera.js';
import { facilityRoster } from './facility-staff.js';
import { tradeProvince } from './trade-routes.js';
import { edgePoint } from './world-grid.js';

function release(root){if(!root)return;root.traverse(n=>{if(n.geometry&&!n.geometry.userData.shared)n.geometry.dispose();if(n.material&&(!n.geometry?.userData.shared||n.userData.ownedMaterial))for(const m of(Array.isArray(n.material)?n.material:[n.material]))if(m&&!m.userData.shared)m.dispose();if(n.userData.pixel||n.userData.pixelEnvironment||n.userData.pixelWater||n.userData.pixelSurface)n.userData.texture.dispose();if(n.isSkinnedMesh)n.skeleton.dispose();if(n.isInstancedMesh)n.dispose();if(n.userData.mixer){n.userData.mixer.stopAllAction();n.userData.mixer.uncacheRoot(n.userData.root);}});}
export class GameScene{
 constructor(container,sim,callbacks={},renderOptions={}){
  this.container=container;this.sim=sim;this.callbacks=callbacks;this.models=new Map();this.workerModels=new Map();this.nature=[];this.mode=null;this.selection=null;this.hover=null;this.lastRevision=-1;this.alive=true;
  this.renderer=createRenderer({antialias:true,alpha:false,powerPreference:'high-performance',...renderOptions});
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.75));this.renderer.setClearColor('#6ca345');this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;
  this.renderer.domElement.setAttribute('aria-label','타일 지도. 시설을 선택한 뒤 빈 칸을 눌러 건설하세요.');this.renderer.domElement.setAttribute('role','application');this.renderer.domElement.tabIndex=0;
  container.appendChild(this.renderer.domElement);this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#6ca345');
  this.scene.add(new THREE.HemisphereLight('#e7f4ff','#6c765b',1.8));const sun=this.sun=new THREE.DirectionalLight('#fff0d6',2.8);sun.position.set(-11,24,16);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-21;sun.shadow.camera.right=21;sun.shadow.camera.top=21;sun.shadow.camera.bottom=-21;sun.shadow.camera.near=1;sun.shadow.camera.far=70;sun.shadow.normalBias=.025;sun.shadow.bias=-.0001;sun.shadow.radius=3;sun.target.position.set(11,0,11);this.scene.add(sun,sun.target);
  this.camera=new THREE.OrthographicCamera(-10,10,10,-10,.1,120);this.camera.position.set(27,31,34);
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.target.set(11.1,0,11.7);this.controls.enableDamping=true;this.controls.dampingFactor=.15;this.controls.screenSpacePanning=false;this.controls.minZoom=.48;this.controls.maxZoom=3.4;this.controls.zoomSpeed=.65;configureQuarterControls(this.controls);this.viewIndex=applyQuarterView(this.camera,this.controls,0);
  this.world=new THREE.Group();this.scene.add(this.world);this.selectionLine=this.outline(1,'#edcb70');this.hoverLine=this.outline(1,'#fbfbdf');this.scene.add(this.selectionLine,this.hoverLine);this.selectionLine.visible=false;this.hoverLine.visible=false;
  this.expansionLines=new THREE.Group();this.scene.add(this.expansionLines);this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  const canvas=this.renderer.domElement;
  this.onLost=e=>{e.preventDefault();this.contextLost=true;this.sim.paused=true;this.callbacks.onContextLost?.();};this.onRestored=()=>{this.contextLost=false;this.resize();this.callbacks.onContextRestored?.();};canvas.addEventListener('webglcontextlost',this.onLost);canvas.addEventListener('webglcontextrestored',this.onRestored);
  this.activePointers=new Set();this.onDown=e=>{this.activePointers.add(e.pointerId);if(this.activePointers.size>1){this.down=null;return;}if(e.button!==0)return;this.down={x:e.clientX,y:e.clientY,time:performance.now()};};
  this.onMove=e=>this.pointerMove(e);
  this.onUp=e=>{this.activePointers.delete(e.pointerId);if(!this.down||this.activePointers.size)return;const distance=Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y),held=performance.now()-this.down.time;this.down=null;if(distance<7&&held<650){this.pointerMove(e);if(this.hover){if(e.pointerType==='touch'&&this.mode&&this.confirmTile!==this.hover.x+','+this.hover.z){this.confirmTile=this.hover.x+','+this.hover.z;this.callbacks.onHint?.('다시 누르면 건설');return;}this.confirmTile=null;this.callbacks.onClick?.(this.hover.x,this.hover.z);}}};
  this.onCancel=()=>{this.activePointers.clear();this.down=null;this.confirmTile=null;};
  this.onLeave=()=>{this.hoverLine.visible=false;if(this.ghost)this.ghost.visible=false;};
  this.onContext=e=>e.preventDefault();
  canvas.addEventListener('pointerdown',this.onDown);canvas.addEventListener('pointermove',this.onMove);canvas.addEventListener('pointerup',this.onUp);canvas.addEventListener('pointerleave',this.onLeave);canvas.addEventListener('pointercancel',this.onCancel);canvas.addEventListener('contextmenu',this.onContext);
  let quality='auto';try{quality=localStorage.getItem('orvetharn-quality')||'auto';}catch{}this.setQuality(quality);
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.resize();this.rebuild();this.resetCamera();
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
 resize(){this.lastPaint=null;const w=this.container.clientWidth,h=this.container.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);const span=w<700?7.1:6.8;this.camera.left=-span*w/h;this.camera.right=span*w/h;this.camera.top=span;this.camera.bottom=-span;this.camera.updateProjectionMatrix();}
 setSimulation(sim){this.sim=sim;this.selection=null;this.callbacks.onMarkers?.([]);this.setMode(null);this.lastRevision=-1;this.rebuild();this.resetCamera();}
 resetCamera(){const land=[...this.sim.owned].map(k=>k.split(',').map(Number));const xs=land.map(p=>p[0]),zs=land.map(p=>p[1]);const x=(Math.min(...xs)+Math.max(...xs))/2,z=(Math.min(...zs)+Math.max(...zs))/2;settleQuarterControls(this.controls);this.controls.target.set(x,0,z);this.camera.zoom=this.sim.buildings.length>20?.82:1;this.camera.updateProjectionMatrix();this.setQuarterView(0);}
 setQuarterView(view){this.viewIndex=applyQuarterView(this.camera,this.controls,view);this.renderer.cache?.clear();this.renderer.poseCache?.clear();this.renderer.domElement.dataset.cameraView=QUARTER_VIEWS[this.viewIndex];this.renderer.domElement.dataset.cameraQuarter=String(this.viewIndex);this.renderer.domElement.dataset.cameraAzimuth=String(this.controls.getAzimuthalAngle());this.renderer.domElement.dataset.cameraPolar=String(this.controls.getPolarAngle());for(const m of this.models.values())m.userData.animate?.(this.sim.time,m.userData.building,this.sim,this.viewIndex);this.hover=null;this.confirmTile=null;this.hoverLine.visible=false;if(this.ghost){this.ghost.visible=false;this.ghost.userData.animate?.(this.sim.time,{working:false,progress:0,inputs:{}},this.sim,this.viewIndex);}for(const p of [...this.nature,...(this.decorations||[])])p.userData.animate?.(this.sim.time,p.userData.tile,false,this.viewIndex);this.scenery?.animate(this.sim.time,this.viewIndex);this.callbacks.onViewChange?.(QUARTER_VIEWS[this.viewIndex]);}
 focusEdge(side){const [x,z]=edgePoint(side,5,11.5);settleQuarterControls(this.controls);this.controls.target.set(x,0,z);this.camera.zoom=Math.max(.8,this.camera.zoom);this.camera.updateProjectionMatrix();this.setQuarterView(this.viewIndex);}
 rotate(direction){if(Number.isFinite(direction)&&direction!==0)this.setQuarterView(this.viewIndex+Math.sign(direction));}
 setOverlay(value){this.overlay=value;this.rebuild();}
 zoom(by){this.camera.zoom=THREE.MathUtils.clamp(this.camera.zoom*by,.48,3.4);this.camera.updateProjectionMatrix();}
 setMode(mode){
  if(mode)this.callbacks.onMarkers?.([]);
  this.mode=mode;this.confirmTile=null;this.hover=null;if(this.ghost){this.scene.remove(this.ghost);release(this.ghost);this.ghost=null;}
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
  let x=Math.floor(hit.x+.5),z=Math.floor(hit.z+.5);
  if(!this.mode){const models=[...this.models.values()];const hits=this.raycaster.intersectObjects(models,true);if(hits.length){let n=hits[0].object;while(n&&!n.userData.building)n=n.parent;if(n?.userData.building){x=n.userData.building.x;z=n.userData.building.z;}}}
  if(x<0||z<0||x>=N||z>=N){this.hover=null;this.onLeave();return;}
  const size=this.mode==='expand'?4:BUILDINGS[this.mode]?.size||this.sim.at(x,z)?.size||1;
  if(this.mode==='expand'){x=Math.floor(x/4)*4;z=Math.floor(z/4)*4;}
  if(this.hover?.x===x&&this.hover?.z===z&&this.hover?.mode===this.mode)return;
  this.hover={x,z,mode:this.mode};this.scene.remove(this.hoverLine);this.hoverLine.geometry.dispose();this.hoverLine.material.dispose();const error=BUILDINGS[this.mode]?this.sim.canBuild(this.mode,x,z):this.mode==='expand'&&!this.sim.canExpand(x/4,z/4)?'인접한 구역을 선택하세요':null;
  this.hoverLine=this.outline(size,error?'#ed775e':'#f4f7da');this.hoverLine.position.set(x,.06,z);this.scene.add(this.hoverLine);this.hoverLine.visible=true;
  if(this.ghost){this.ghost.position.set(x+(size-1)/2,BUILDINGS[this.mode]?.onWater?-.135:.025,z+(size-1)/2);this.ghost.visible=true;}
  this.callbacks.onHover?.({x,z,error,owned:this.sim.ownedAt(x,z)});
 }
 rebuild(){
  this.lastPaint=null;
  const previousHealth=this.conditionSimulation===this.sim?new Map([...this.models].map(([id,m])=>[id,m.userData.conditionHealth])):new Map();
  this.conditionSimulation=this.sim;
  this.staffModels=new Map();
  // A cut stump is a short visual effect, never a new save-file terrain type.
  if(this.stumpSimulation!==this.sim){this.stumps=new Map();this.stumpSimulation=this.sim;}
  for(const n of this.nature){const t=n.userData.tile;if(n.userData.wasMature&&t===this.sim.tile(t.x,t.z)&&t.nature===null&&t.remaining<=0&&!this.sim.at(t.x,t.z)&&!this.sim.roads.has(t.x+','+t.z))this.stumps.set(t.x+','+t.z,{x:t.x,z:t.z,scale:n.scale.x,until:this.sim.time+2.4});}
  for(const [key,s]of this.stumps)if(s.until<=this.sim.time||this.sim.tile(s.x,s.z)?.nature||this.sim.at(s.x,s.z)||this.sim.roads.has(key))this.stumps.delete(key);
  this.renderer.cache?.clear();release(this.world);this.scene.remove(this.world);this.world=new THREE.Group();this.scene.add(this.world);this.models.clear();this.workerModels.clear();this.enemyModels=new Map();this.nature=[];this.dockBoats=[];const sceneryKey=this.sim.region+':'+this.sim.race+':'+tradeProvince(this.sim)+':'+JSON.stringify(this.sim.layout);if(this.sceneryKey!==sceneryKey){if(this.scenery){release(this.scenery.group);this.scene.remove(this.scenery.group);}this.scenery=makeScenery(this.sim.region,this.sim.race,this.sim);this.scene.add(this.scenery.group);this.sceneryKey=sceneryKey;}
  const sim=this.sim;
  this.terrain=makeMapTerrain(sim,this.overlay);this.world.add(this.terrain);this.water=this.terrain.userData.water;
  this.decorations=[];
  for(const t of sim.tiles){
   const key=t.x+','+t.z;
   if(t.terrain==='water')continue;
   if(t.nature&&!sim.at(t.x,t.z)&&!sim.roads.has(key)){
    const tree=biomeTree(sim.layout,t),scale=.73+noise(t.x,t.z)*.20;
    const obj=['tree','sapling'].includes(t.nature)?(tree?makePixelProp(tree,scale*(t.nature==='sapling'?.35:1)):makeTree(Math.floor(noise(t.z,t.x)*6),scale)):makeRock(.9+noise(t.x,t.z)*.25,t.ore>70?'oreRock':t.moisture>70?'mossrock':'rock');
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
  this.freight=[];for(const route of sim.campaign?.routes||[]){if(route.from!==sim.siteId&&route.to!==sim.siteId)continue;const m=makeFreightVehicle(route.mode,route.item);this.world.add(m);this.freight.push({m,route});}const gate=makeExportGate();gate.position.set(EXPORT_GATE.x,.01,EXPORT_GATE.z);this.world.add(gate);this.decorations.push(gate);this.exportCarts=new Map();this.drawExpansions();const tileSelection=this.tileSelection;this.select(this.selection);if(tileSelection&&!this.selection)this.selectTile(tileSelection.x,tileSelection.z);this.lastRevision=sim.revision;
 }
 loop(now){
  if(!this.alive)return;if(this.contextLost||this.active===false){this.last=now;this.frame=requestAnimationFrame(this.loop);return;}if(now-this.last<1000/this.maxFps-1){this.frame=requestAnimationFrame(this.loop);return;}const dt=Math.min((now-this.last)/1000,.5);this.last=now;let remaining=dt;while(remaining>0){const step=Math.min(.05,remaining);if(this.sim.campaign)this.sim.campaign.tick(step);else this.sim.tick(step);remaining-=step;}
  if(this.lastRevision!==this.sim.revision)this.rebuild();
  this.controls.update();this.camera.updateMatrixWorld();
  for(const [id,m]of this.models){const b=this.sim.buildings.find(v=>v.id===id);if(b){m.userData.animate?.(this.sim.time,b,this.sim,this.viewIndex);m.rotation.z=0;}}
  for(const w of this.sim.workers){let m=this.workerModels.get(w.id);if(!m){m=makeWorker(w.id,w.race||this.sim.race,w.appearance);this.workerModels.set(w.id,m);this.world.add(m);}animateWorker(m,w,this.sim.time,this.camera);}
  for(const[id,m]of this.workerModels)if(!this.sim.workers.some(w=>w.id===id)){this.world.remove(m);release(m);this.workerModels.delete(id);}
  const staff=facilityRoster(this.sim),staffIds=new Set(staff.map(w=>w.id));
  for(const w of staff){let m=this.staffModels.get(w.id);if(!m){m=makeWorker(w.id,w.race,w.appearance);m.userData.facilityStaff=true;this.staffModels.set(w.id,m);this.world.add(m);}animateWorker(m,w,this.sim.time,this.camera);}
  for(const[id,m]of this.staffModels)if(!staffIds.has(id)){this.world.remove(m);release(m);this.staffModels.delete(id);}
  for(const {boat,b,x,z} of this.dockBoats||[]){boat.position.y=-.16+Math.sin(this.sim.time*.8)*.008;boat.position.z=z+(b.type==='dock'&&b.working&&b.health>0&&b.enabled!==false?Math.sin(b.progress*Math.PI)*.25:0);boat.userData.animate(this.sim.time,null,false,this.viewIndex);}
  this.scenery?.animate(this.sim.time,this.viewIndex);this.callbacks.onAudio?.(this.sim,this.controls.target);
  for(const prop of this.decorations||[])prop.userData.animate?.(this.sim.time,null,false,this.viewIndex);
  const harvesting=new Set(this.sim.buildings.filter(b=>b.working&&BUILDINGS[b.type]?.natural==='tree').map(b=>this.sim.closestNatural(b,'tree')));
  for(const n of this.nature){if(n.userData.stumpUntil)n.visible=this.sim.time<n.userData.stumpUntil;else n.userData.animate?.(this.sim.time,n.userData.tile,harvesting.has(n.userData.tile),this.viewIndex);}
  this.terrain?.userData.animate(this.sim.time);
  for(const enemy of [...(this.sim.attackers||[]),...(this.sim.guards||[])]){let m=this.enemyModels.get(enemy.id);if(!m){m=makeWorker(Number(enemy.id)||0,enemy.race,enemy.appearance);const bar=new THREE.Group();const bg=new THREE.Mesh(new THREE.PlaneGeometry(.5,.065),new THREE.MeshBasicMaterial({color:'#382f35',side:THREE.DoubleSide}));const hp=new THREE.Mesh(new THREE.PlaneGeometry(.46,.035),new THREE.MeshBasicMaterial({color:enemy.guard?'#59baa3':'#eb826c',side:THREE.DoubleSide}));bar.add(bg,hp);bar.position.y=1.45;hp.position.z=.002;bar.userData.fill=hp;m.add(bar);m.userData.hpBar=bar;m.userData.worker=true;if(enemy.guard&&!m.userData.pixel){const shield=new THREE.Mesh(new THREE.SphereGeometry(.16,20,14),mat('#679eac',{metalness:.3,roughness:.4}));shield.scale.set(1,1.12,.24);shield.position.set(-.16,.47,.17);m.add(shield);box(m,.022,.50,.026,'#8f7552',.16,.49,.08,.006);const spear=new THREE.Mesh(new THREE.ConeGeometry(.045,.12,8),mat('#cad5d4',{metalness:.5}));spear.position.set(.16,.79,.08);m.add(spear);}this.enemyModels.set(enemy.id,m);this.world.add(m);}animateWorker(m,enemy,this.sim.time,this.camera);if(m.userData.hpBar){m.userData.hpBar.visible=enemy.hp>0;m.userData.hpBar.quaternion.copy(m.quaternion).invert().multiply(this.camera.quaternion);m.userData.hpBar.userData.fill.scale.x=Math.max(.01,(enemy.hp??1)/(enemy.maxHp??1));}}for(const[id,m]of this.enemyModels){if(![...this.sim.attackers,...(this.sim.guards||[])].some(e=>e.id===id)){this.world.remove(m);release(m);this.enemyModels.delete(id);}}
  this.uiAccum+=dt;this.frameSamples=(this.frameSamples||0)+1;this.frameElapsed=(this.frameElapsed||0)+dt;if(this.uiAccum>.4){this.uiAccum=0;this.renderer.domElement.dataset.fps=String(Math.round(this.frameSamples/this.frameElapsed));this.renderer.domElement.dataset.renderer=this.renderer.isSoftware?'canvas':'webgl';this.renderer.domElement.dataset.geometries=String(this.renderer.info?.memory.geometries||(this.renderer.cache?.size||0)+(this.renderer.poseCache?.size||0));this.renderer.domElement.dataset.textures=String(this.renderer.info?.memory.textures||0);this.renderer.domElement.dataset.models=String(this.models.size+this.workerModels.size+this.enemyModels.size);this.renderer.domElement.dataset.gameTime=String(Math.round(this.sim.time*10)/10);this.renderer.domElement.dataset.characterStyle='pixel';this.renderer.domElement.dataset.characterFrames=[...this.workerModels.values()].map(m=>m.userData.direction+':'+m.userData.frame).join(',');this.frameSamples=0;this.frameElapsed=0;this.callbacks.onUpdate?.(this.sim);const w=this.container.clientWidth,h=this.container.clientHeight;this.callbacks.onMarkers?.(this.sim.buildings.filter(b=>!this.mode).map(b=>{const markerHeight=({well:1.02,lumber:.72,sawmill:.72,field:.64})[b.type]||1.38;const v=new THREE.Vector3(b.x,markerHeight,b.z).project(this.camera);return {id:b.id,type:b.type,status:b.status,working:b.working,x:(v.x+1)*w/2,y:(1-v.y)*h/2};}).filter(m=>m.x>60&&m.x<w-60&&m.y>70&&m.y<h-90));}
  for(const sh of this.sim.shipments||[]){
   const p=shipmentPose(sh),kind=shipmentVehicle(sh,this.sim,p);let m=this.exportCarts?.get(sh.id);
   if(m&&m.userData.vehicleKind!==kind){this.world.remove(m);release(m);this.exportCarts.delete(sh.id);m=null;}
   if(!m){m=makeFreightVehicle(kind,sh.item);this.exportCarts.set(sh.id,m);this.world.add(m);}
   m.userData.loaded=shipmentLoaded(sh);m.userData.cargoItem=sh.item;
   m.position.set(p.x,kind==='raft'||kind==='steamer'?-.16:.08,p.z);m.rotation.y=Math.atan2(p.dx,p.dz);m.userData.animate?.(this.sim.time,null,false,this.viewIndex);
  }
  for(const[id,m]of this.exportCarts||[])if(!this.sim.shipments?.some(sh=>sh.id===id)){this.world.remove(m);release(m);this.exportCarts.delete(id);}
  for(const {m,route} of this.freight||[]){const station=this.sim.buildings.find(b=>b.type==='station')||this.sim.warehouse;m.visible=!!route.cargo&&!!station;if(station){const p=1-route.remaining/route.duration;m.position.set(station.x-2+p*5,.08,station.z+1);m.rotation.y=Math.PI/2;m.userData.animate?.(this.sim.time,null,false,this.viewIndex);}}const paintKey=this.sim.time+':'+this.sim.revision+':'+this.camera.matrixWorld.elements.join(',')+':'+this.camera.zoom+':'+this.mode+':'+this.selection+':'+this.hover?.x+','+this.hover?.z+':'+this.container.clientWidth+':'+this.container.clientHeight;if(!this.sim.paused||paintKey!==this.lastPaint){this.renderer.render(this.scene,this.camera);this.lastPaint=paintKey;}this.frame=requestAnimationFrame(this.loop);
 }
 icons(race=this.sim.race){if(this.iconCache?.has(race))return this.iconCache.get(race);if(!this.iconCache)this.iconCache=new Map();
  const r=createRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});r.setSize(150,130);r.setPixelRatio(1);r.outputColorSpace=THREE.SRGBColorSpace;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.37;
  const s=new THREE.Scene();s.add(new THREE.HemisphereLight('#ffffff','#b1be8d',2.6));const l=new THREE.DirectionalLight('#ffe8c9',3);l.position.set(-3,8,5);s.add(l);
  const c=new THREE.OrthographicCamera(-.78,.78,.70,-.70,.1,30);c.position.set(4,4.42,4);c.lookAt(0,.42,0);const result={};
  for(const type of Object.keys(BUILDINGS)){const model=makeBuilding(type,BUILDINGS[type].resident||race);
   model.userData.animate?.(1,{working:true,progress:.8,inputs:{grain:3},animationTime:1},null);s.add(model);r.render(s,c);result[type]=r.domElement.toDataURL('image/png');s.remove(model);release(model);
  }
  for(const id of FACTIONS[factionOf(race)].members)for(const look of RESIDENT_LOOKS[id]||[{id:'default'}]){
   result['resident-'+id+'-'+look.id]=pixelIdentity(id,0,look.id).portrait;
   if(!result['resident-'+id])result['resident-'+id]=result['resident-'+id+'-'+look.id];
  }this.iconCache.set(race,result);r.dispose();r.forceContextLoss?.();return result;
 }
 dispose(){
  this.alive=false;cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();this.controls.dispose();
  const c=this.renderer.domElement;c.removeEventListener('webglcontextlost',this.onLost);c.removeEventListener('webglcontextrestored',this.onRestored);c.removeEventListener('pointerdown',this.onDown);c.removeEventListener('pointermove',this.onMove);c.removeEventListener('pointerup',this.onUp);c.removeEventListener('pointerleave',this.onLeave);c.removeEventListener('pointercancel',this.onCancel);c.removeEventListener('contextmenu',this.onContext);
  release(this.world);release(this.scenery?.group);release(this.ghost);release(this.selectionLine);release(this.hoverLine);release(this.expansionLines);this.renderer.dispose();c.remove();
 }
}
