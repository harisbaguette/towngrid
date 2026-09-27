import {asset} from './assets.js';
import {RESIDENT_LOOKS} from './resident-roster.js';
import {pixelIdentity} from './pixel-character-data.js';
import {RACES,FACTIONS,factionOf} from './world.js';
import * as THREE from 'three';
import { makeScenery } from './scenery.js';
import { createRenderer } from './software-renderer.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { N, BUILDINGS, noise } from './simulation.js';
import { makeBuilding, makeTree, makeRock, makeWorker, animateWorker, makeFreightVehicle, mat, box } from './models.js';
import { makePixelWater } from './pixel-environment.js';
import { configureQuarterControls, applyQuarterView, settleQuarterControls, QUARTER_VIEWS } from './quarter-camera.js';

function release(root){if(!root)return;root.traverse(n=>{if(n.geometry&&!n.geometry.userData.shared)n.geometry.dispose();if(n.material&&(!n.geometry?.userData.shared||n.userData.ownedMaterial))for(const m of(Array.isArray(n.material)?n.material:[n.material]))if(m&&!m.userData.shared)m.dispose();if(n.userData.pixel||n.userData.pixelEnvironment||n.userData.pixelWater)n.userData.texture.dispose();if(n.isSkinnedMesh)n.skeleton.dispose();if(n.isInstancedMesh)n.dispose();if(n.userData.mixer){n.userData.mixer.stopAllAction();n.userData.mixer.uncacheRoot(n.userData.root);}});}
export class GameScene{
 constructor(container,sim,callbacks={}){
  this.container=container;this.sim=sim;this.callbacks=callbacks;this.models=new Map();this.workerModels=new Map();this.nature=[];this.mode=null;this.selection=null;this.hover=null;this.lastRevision=-1;this.alive=true;
  this.renderer=createRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.75));this.renderer.setClearColor('#6ca345');this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
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
 resize(){const w=this.container.clientWidth,h=this.container.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);const span=w<700?7.1:6.8;this.camera.left=-span*w/h;this.camera.right=span*w/h;this.camera.top=span;this.camera.bottom=-span;this.camera.updateProjectionMatrix();}
 setSimulation(sim){this.sim=sim;this.selection=null;this.callbacks.onMarkers?.([]);this.setMode(null);this.lastRevision=-1;this.rebuild();this.resetCamera();}
 resetCamera(){const land=[...this.sim.owned].map(k=>k.split(',').map(Number));const xs=land.map(p=>p[0]),zs=land.map(p=>p[1]);const x=(Math.min(...xs)+Math.max(...xs))/2,z=(Math.min(...zs)+Math.max(...zs))/2;settleQuarterControls(this.controls);this.controls.target.set(x,0,z);this.camera.zoom=this.sim.buildings.length>20?.82:1;this.camera.updateProjectionMatrix();this.setQuarterView(0);}
 setQuarterView(view){this.viewIndex=applyQuarterView(this.camera,this.controls,view);this.renderer.cache?.clear();this.renderer.poseCache?.clear();this.renderer.domElement.dataset.cameraView=QUARTER_VIEWS[this.viewIndex];this.renderer.domElement.dataset.cameraQuarter=String(this.viewIndex);this.renderer.domElement.dataset.cameraAzimuth=String(this.controls.getAzimuthalAngle());this.renderer.domElement.dataset.cameraPolar=String(this.controls.getPolarAngle());for(const m of this.models.values())m.userData.animate?.(this.sim.time,m.userData.building,this.sim,this.viewIndex);this.hover=null;this.confirmTile=null;this.hoverLine.visible=false;if(this.ghost){this.ghost.visible=false;this.ghost.userData.animate?.(this.sim.time,{working:false,progress:0,inputs:{}},this.sim,this.viewIndex);}this.callbacks.onViewChange?.(QUARTER_VIEWS[this.viewIndex]);}
 rotate(direction){if(Number.isFinite(direction)&&direction!==0)this.setQuarterView(this.viewIndex+Math.sign(direction));}
 setOverlay(value){this.overlay=value;this.rebuild();}
 zoom(by){this.camera.zoom=THREE.MathUtils.clamp(this.camera.zoom*by,.48,3.4);this.camera.updateProjectionMatrix();}
 setMode(mode){
  if(mode)this.callbacks.onMarkers?.([]);
  this.mode=mode;this.confirmTile=null;this.hover=null;if(this.ghost){this.scene.remove(this.ghost);release(this.ghost);this.ghost=null;}
  if(mode&&BUILDINGS[mode]&&!['road','rail'].includes(mode)){
   this.ghost=makeBuilding(mode,this.sim.residentOf(mode)||this.sim.race);this.ghost.name='ghost-'+mode;this.ghost.traverse(n=>{if(n.isMesh||n.isSprite){n.material=(Array.isArray(n.material)?n.material:[n.material]).map(v=>{const m=v.clone();if(n.isSprite&&n.userData.ownedMaterial)v.dispose();m.userData.shared=false;m.transparent=true;m.opacity=.42;m.alphaTest=.01;m.depthWrite=false;return m;});if(n.material.length===1)n.material=n.material[0];n.userData.ownedMaterial=true;n.castShadow=false;}});
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
  if(this.ghost){this.ghost.position.set(x+(size-1)/2,.025,z+(size-1)/2);this.ghost.visible=true;}
  this.callbacks.onHover?.({x,z,error,owned:this.sim.ownedAt(x,z)});
 }
 rebuild(){
  // A cut stump is a short visual effect, never a new save-file terrain type.
  if(this.stumpSimulation!==this.sim){this.stumps=new Map();this.stumpSimulation=this.sim;}
  for(const n of this.nature){const t=n.userData.tile;if(n.userData.wasMature&&t===this.sim.tile(t.x,t.z)&&t.nature===null&&t.remaining<=0&&!this.sim.at(t.x,t.z)&&!this.sim.roads.has(t.x+','+t.z))this.stumps.set(t.x+','+t.z,{x:t.x,z:t.z,scale:n.scale.x,until:this.sim.time+2.4});}
  for(const [key,s]of this.stumps)if(s.until<=this.sim.time||this.sim.tile(s.x,s.z)?.nature||this.sim.at(s.x,s.z)||this.sim.roads.has(key))this.stumps.delete(key);
  this.renderer.cache?.clear();release(this.world);this.scene.remove(this.world);this.world=new THREE.Group();this.scene.add(this.world);this.models.clear();this.workerModels.clear();this.enemyModels=new Map();this.nature=[];this.dockBoats=[];const sceneryKey=this.sim.region+':'+this.sim.race;if(this.sceneryKey!==sceneryKey){if(this.scenery){release(this.scenery.group);this.scene.remove(this.scenery.group);}this.scenery=makeScenery(this.sim.region,this.sim.race);this.scene.add(this.scenery.group);this.sceneryKey=sceneryKey;}
  const sim=this.sim,matrix=new THREE.Matrix4(),dummy=new THREE.Object3D();
  const groundGeo=new RoundedBoxGeometry(1.002,.14,1.002,2,.012);
  const ground=new THREE.InstancedMesh(groundGeo,new THREE.MeshStandardMaterial({roughness:1}),sim.tiles.filter(t=>t.terrain!=='water').length);ground.receiveShadow=true;let n=0;
  const soil=new THREE.InstancedMesh(new RoundedBoxGeometry(.998,.43,.998,2,.016),mat('#b99869'),ground.count);soil.receiveShadow=true;soil.userData.soil=true;soil.userData.land=new Set(sim.tiles.filter(t=>t.terrain!=='water').map(t=>t.x+','+t.z));
  ground.userData.tiles=true;
  const water=makePixelWater(sim.tiles.filter(t=>t.terrain==='water').length);let wn=0;
  const grassPositions=[];
  for(const t of sim.tiles){
   const owned=sim.ownedAt(t.x,t.z),key=t.x+','+t.z;
   if(t.terrain==='water'){dummy.position.set(t.x,-.17,t.z);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();water.setMatrixAt(wn++,dummy.matrix);continue;}
   dummy.position.set(t.x,-.28,t.z);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();soil.setMatrixAt(n,dummy.matrix);dummy.position.y=-.06;dummy.updateMatrix();ground.setMatrixAt(n,dummy.matrix);
   let color=sim.roads.has(key)?'#d1af73':new THREE.Color('#91c848').lerp(new THREE.Color('#87c13f'),noise(t.x,t.z)*.65);
   if(sim.region==='highland')color=sim.roads.has(key)?'#dbcca8':new THREE.Color('#adbf88').lerp(new THREE.Color('#a2b37f'),noise(t.x,t.z)*.65);
   if(this.overlay&&!sim.roads.has(key)){const value=['pollution','shade'].includes(this.overlay)?sim.placementEffects('field',t.x,t.z)[this.overlay]*(this.overlay==='pollution'?100/6:100/3):t[this.overlay]||50;color=new THREE.Color('#90664c').lerp(new THREE.Color(this.overlay==='fertility'?'#a9cf5e':this.overlay==='moisture'?'#72bfd7':this.overlay==='pollution'?'#b36570':this.overlay==='shade'?'#7186b0':'#d7bd71'),value/100);}if(!owned)color=new THREE.Color(color).multiplyScalar(.85);ground.setColorAt(n++,new THREE.Color(color));
   if(sim.rails?.has(key)){const rail=makeBuilding('rail',sim.race);rail.position.set(t.x,0,t.z);const vertical=sim.rails.has(t.x+','+(t.z-1))||sim.rails.has(t.x+','+(t.z+1));if(!vertical)rail.rotation.y=Math.PI/2;this.world.add(rail);}
   if(t.nature&&!sim.at(t.x,t.z)&&!sim.roads.has(key)){const obj=['tree','sapling'].includes(t.nature)?makeTree(Math.floor(noise(t.z,t.x)*6),.73+noise(t.x,t.z)*.20):makeRock(.9+noise(t.x,t.z)*.45);obj.position.set(t.x,.015,t.z);obj.userData.tile=t;obj.userData.wasMature=t.nature==='tree';obj.userData.animate?.(sim.time,t);this.world.add(obj);this.nature.push(obj);}
   else if(!sim.at(t.x,t.z)&&!sim.roads.has(key)&&noise(t.x+5,t.z)>.58)grassPositions.push(t);
  }
  ground.instanceColor.needsUpdate=true;this.world.add(water,soil,ground);this.water=water;
  for(const s of this.stumps.values()){const stump=makeTree(0,s.scale);stump.position.set(s.x,.015,s.z);stump.userData.stumpUntil=s.until;stump.userData.animate(sim.time,{nature:null});this.world.add(stump);this.nature.push(stump);}
  const blades=new THREE.InstancedMesh(new THREE.ConeGeometry(.023,.12,3),mat('#aec575'),grassPositions.length*3);let bi=0;
  for(const p of grassPositions)for(let i=0;i<3;i++){dummy.position.set(p.x+(i-1)*.08+.23,.045,p.z+.24);dummy.rotation.set(0,i,((i-1)*.2));dummy.scale.set(1,1,1);dummy.updateMatrix();blades.setMatrixAt(bi++,dummy.matrix);}this.world.add(blades);
  const bounds=[];for(const key of sim.owned){const[x,z]=key.split(',').map(Number);for(const [dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]])if(!sim.ownedAt(x+dx,z+dz)){if(dx)bounds.push(new THREE.Vector3(x+dx*.5,.04,z-.5),new THREE.Vector3(x+dx*.5,.04,z+.5));else bounds.push(new THREE.Vector3(x-.5,.04,z+dz*.5),new THREE.Vector3(x+.5,.04,z+dz*.5));}}
  const border=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(bounds),new THREE.LineDashedMaterial({color:'#f5e6af',dashSize:.16,gapSize:.09,transparent:true,opacity:.88}));border.computeLineDistances();this.world.add(border);
  for(const b of sim.buildings){const m=makeBuilding(b.type,b.race||sim.race);m.position.set(b.x+(b.size-1)/2,.01,b.z+(b.size-1)/2);m.userData.building=b;this.models.set(b.id,m);this.world.add(m);if(b.health<=0)m.rotation.z=.035;}
  for(const b of sim.buildings.filter(v=>v.type==='dock')){const water=sim.tiles.filter(t=>t.terrain==='water').sort((a,c)=>Math.hypot(a.x-b.x,a.z-b.z)-Math.hypot(c.x-b.x,c.z-b.z))[0];if(water){const boat=asset('erdynth','Tugboat',{width:.9});if(boat){boat.position.set(water.x,-.31,water.z);boat.rotation.y=Math.atan2(b.x-water.x,b.z-water.z);this.world.add(boat);this.dockBoats.push({boat,b,x:water.x,z:water.z});}}}
  for(const w of sim.workers){const m=makeWorker(w.id,w.race||this.sim.race,w.appearance);this.workerModels.set(w.id,m);this.world.add(m);}
  this.freight=[];for(const route of sim.campaign?.routes||[]){if(route.from!==sim.siteId&&route.to!==sim.siteId)continue;const m=makeFreightVehicle(route.mode,route.item);this.world.add(m);this.freight.push({m,route});}this.drawExpansions();const tileSelection=this.tileSelection;this.select(this.selection);if(tileSelection&&!this.selection)this.selectTile(tileSelection.x,tileSelection.z);this.lastRevision=sim.revision;
 }
 loop(now){
  if(!this.alive)return;if(this.contextLost||this.active===false){this.last=now;this.frame=requestAnimationFrame(this.loop);return;}if(now-this.last<1000/this.maxFps-1){this.frame=requestAnimationFrame(this.loop);return;}const dt=Math.min((now-this.last)/1000,.5);this.last=now;let remaining=dt;while(remaining>0){const step=Math.min(.05,remaining);if(this.sim.campaign)this.sim.campaign.tick(step);else this.sim.tick(step);remaining-=step;}
  if(this.lastRevision!==this.sim.revision)this.rebuild();
  this.controls.update();this.camera.updateMatrixWorld();
  for(const [id,m]of this.models){const b=this.sim.buildings.find(v=>v.id===id);if(b){m.userData.animate?.(this.sim.time,b,this.sim,this.viewIndex);m.rotation.z=b.health<=0?.045:0;}}
  for(const w of this.sim.workers){let m=this.workerModels.get(w.id);if(!m){m=makeWorker(w.id,w.race||this.sim.race,w.appearance);this.workerModels.set(w.id,m);this.world.add(m);}animateWorker(m,w,this.sim.time,this.camera);}
  for(const[id,m]of this.workerModels)if(!this.sim.workers.some(w=>w.id===id)){this.world.remove(m);release(m);this.workerModels.delete(id);}
  for(const {boat,b,x,z} of this.dockBoats||[]){boat.position.y=-.31+Math.sin(this.sim.time*.8)*.016;boat.rotation.z=Math.sin(this.sim.time)*.022;boat.position.z=z+(b.working?Math.sin(b.progress*Math.PI)*.25:0);}
  this.scenery?.animate(this.sim.time);this.callbacks.onAudio?.(this.sim,this.controls.target);
  const harvesting=new Set(this.sim.buildings.filter(b=>b.working&&BUILDINGS[b.type]?.natural==='tree').map(b=>this.sim.closestNatural(b,'tree')));
  for(const n of this.nature){if(n.userData.stumpUntil)n.visible=this.sim.time<n.userData.stumpUntil;else n.userData.animate?.(this.sim.time,n.userData.tile,harvesting.has(n.userData.tile));}
  this.water?.userData.animate(this.sim.time);
  for(const enemy of [...(this.sim.attackers||[]),...(this.sim.guards||[])]){let m=this.enemyModels.get(enemy.id);if(!m){m=makeWorker(Number(enemy.id)||0,enemy.race,enemy.appearance);const bar=new THREE.Group();const bg=new THREE.Mesh(new THREE.PlaneGeometry(.5,.065),new THREE.MeshBasicMaterial({color:'#382f35',side:THREE.DoubleSide}));const hp=new THREE.Mesh(new THREE.PlaneGeometry(.46,.035),new THREE.MeshBasicMaterial({color:enemy.guard?'#59baa3':'#eb826c',side:THREE.DoubleSide}));bar.add(bg,hp);bar.position.y=1.45;hp.position.z=.002;bar.userData.fill=hp;m.add(bar);m.userData.hpBar=bar;m.userData.worker=true;if(enemy.guard&&!m.userData.pixel){const shield=new THREE.Mesh(new THREE.SphereGeometry(.16,20,14),mat('#679eac',{metalness:.3,roughness:.4}));shield.scale.set(1,1.12,.24);shield.position.set(-.16,.47,.17);m.add(shield);box(m,.022,.50,.026,'#8f7552',.16,.49,.08,.006);const spear=new THREE.Mesh(new THREE.ConeGeometry(.045,.12,8),mat('#cad5d4',{metalness:.5}));spear.position.set(.16,.79,.08);m.add(spear);}this.enemyModels.set(enemy.id,m);this.world.add(m);}animateWorker(m,enemy,this.sim.time,this.camera);if(m.userData.hpBar){m.userData.hpBar.visible=enemy.hp>0;m.userData.hpBar.quaternion.copy(m.quaternion).invert().multiply(this.camera.quaternion);m.userData.hpBar.userData.fill.scale.x=Math.max(.01,(enemy.hp??1)/(enemy.maxHp??1));}}for(const[id,m]of this.enemyModels){if(![...this.sim.attackers,...(this.sim.guards||[])].some(e=>e.id===id)){this.world.remove(m);release(m);this.enemyModels.delete(id);}}
  this.uiAccum+=dt;this.frameSamples=(this.frameSamples||0)+1;this.frameElapsed=(this.frameElapsed||0)+dt;if(this.uiAccum>.4){this.uiAccum=0;this.renderer.domElement.dataset.fps=String(Math.round(this.frameSamples/this.frameElapsed));this.renderer.domElement.dataset.renderer=this.renderer.isSoftware?'canvas':'webgl';this.renderer.domElement.dataset.geometries=String(this.renderer.info?.memory.geometries||(this.renderer.cache?.size||0)+(this.renderer.poseCache?.size||0));this.renderer.domElement.dataset.textures=String(this.renderer.info?.memory.textures||0);this.renderer.domElement.dataset.models=String(this.models.size+this.workerModels.size+this.enemyModels.size);this.renderer.domElement.dataset.gameTime=String(Math.round(this.sim.time*10)/10);this.renderer.domElement.dataset.characterStyle='pixel';this.renderer.domElement.dataset.characterFrames=[...this.workerModels.values()].map(m=>m.userData.direction+':'+m.userData.frame).join(',');this.frameSamples=0;this.frameElapsed=0;this.callbacks.onUpdate?.(this.sim);const w=this.container.clientWidth,h=this.container.clientHeight;this.callbacks.onMarkers?.(this.sim.buildings.filter(b=>!this.mode).map(b=>{const v=new THREE.Vector3(b.x,1.38,b.z).project(this.camera);return {id:b.id,type:b.type,status:b.status,working:b.working,x:(v.x+1)*w/2,y:(1-v.y)*h/2};}).filter(m=>m.x>60&&m.x<w-60&&m.y>70&&m.y<h-90));}
  for(const {m,route} of this.freight||[]){const station=this.sim.buildings.find(b=>b.type==='station')||this.sim.warehouse;m.visible=!!route.cargo&&!!station;if(station){const p=1-route.remaining/route.duration;m.position.set(station.x-2+p*5,.08,station.z+1);m.rotation.y=Math.PI/2;}}const paintKey=this.sim.time+':'+this.sim.revision+':'+this.camera.matrixWorld.elements.join(',')+':'+this.camera.zoom+':'+this.mode+':'+this.selection+':'+this.hover?.x+','+this.hover?.z+':'+this.container.clientWidth+':'+this.container.clientHeight;if(!this.sim.paused||paintKey!==this.lastPaint){this.renderer.render(this.scene,this.camera);this.lastPaint=paintKey;}this.frame=requestAnimationFrame(this.loop);
 }
 icons(race=this.sim.race){if(this.iconCache?.has(race))return this.iconCache.get(race);if(!this.iconCache)this.iconCache=new Map();
  const r=createRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});r.setSize(150,130);r.setPixelRatio(1);r.outputColorSpace=THREE.SRGBColorSpace;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.37;
  const s=new THREE.Scene();s.add(new THREE.HemisphereLight('#ffffff','#b1be8d',2.6));const l=new THREE.DirectionalLight('#ffe8c9',3);l.position.set(-3,8,5);s.add(l);
  const c=new THREE.OrthographicCamera(-.78,.78,.70,-.70,.1,30);c.position.set(4,4.8,6);c.lookAt(0,.42,0);const result={};
  for(const type of Object.keys(BUILDINGS)){let model;if(type==='road'){model=new THREE.Group();box(model,1.7,.09,1.5,'#ccad79',0,.05,0);for(let i=0;i<4;i++)box(model,.23,.03,.13,'#e2c493',i*.27-.4,.11,(i%2)*.4-.2);}else model=makeBuilding(type,BUILDINGS[type].resident||race);
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
