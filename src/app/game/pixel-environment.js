import * as THREE from 'three';
import { ENVIRONMENT_ASSETS, pixelBuildingFrame, oakFrame, waterFrame } from './pixel-environment-data.js';
import { QUARTER_POLAR, quarterAzimuth } from './quarter-camera.js';
import { productionVisualState } from './production-visuals.js';
import { attachIndustryAnimation } from './pixel-industry.js';
import { RESOURCE_FRAMES } from './resource-art.js';
import { VEHICLE_ART } from './vehicle-art.js';
import {attachBuildingCondition} from './pixel-building-condition.js';
import {CRANE_RIGS,vehicleMotion} from './pixel-motion-data.js';
import {logisticsVisualEvents} from './logistics-visual-events.js';
import {attachFarmAnimals} from './pixel-farm-motion.js';
import {groundSprite} from './sprite-grounding.js';

const images = new Map(), pending = new Map(), alphaMasks = new Map(), baseTextures = new Map();
export async function loadPixelEnvironment() {
 await Promise.all(Object.entries(ENVIRONMENT_ASSETS).map(async ([id, spec]) => {
  if (images.has(id)) return;
  if (!pending.has(id)) pending.set(id, new Promise((resolve, reject) => {
   const image = new Image();
   const timeout = setTimeout(() => reject(new Error(`환경 이미지: ${id}`)), 20000);
   image.onload = () => {
    clearTimeout(timeout);
    try {
     if (spec.building || spec.cutout || spec.scenery || id==='networks' || id==='infrastructureGround') {
      const canvas = document.createElement('canvas');canvas.width = image.width;canvas.height = image.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });context.drawImage(image, 0, 0);
      alphaMasks.set(id, context.getImageData(0, 0, image.width, image.height).data);
     }
     images.set(id, image);resolve();
    } catch (error) { reject(error); }
   };
   image.onerror = () => { clearTimeout(timeout); reject(new Error(`환경 이미지: ${id}`)); };
   image.src = spec.sheet;
  }).finally(() => pending.delete(id)));
  await pending.get(id);
 }));
}

function textureFor(id) {
 const spec = ENVIRONMENT_ASSETS[id];
 if (!baseTextures.has(id)) {
  const base = new THREE.Texture(images.get(id));
  base.colorSpace = THREE.SRGBColorSpace;
  base.magFilter = base.minFilter = THREE.NearestFilter;
  base.generateMipmaps = false;
  baseTextures.set(id, base);
 }
 if(images.has(id)&&baseTextures.get(id).image!==images.get(id))baseTextures.get(id).image=images.get(id);
 // Clones have independent frame UVs but share one GPU image source per atlas.
 const texture = baseTextures.get(id).clone();
 texture.repeat.set(1 / spec.frames, 1 / (spec.directions || 1));
 texture.offset.y = 1 - 1 / (spec.directions || 1);
 texture.needsUpdate = images.has(id);
 return texture;
}

// Terrain batches share authored images with the billboard renderer.
export const pixelTexture = id => textureFor(id);
export const pixelImage = id => images.get(id);
export function pixelSurfaceAlpha(id,frame,u,v){
 const image=images.get(id),pixels=alphaMasks.get(id),spec=ENVIRONMENT_ASSETS[id];
 if(!image||!pixels)return undefined;
 // Match the surface shader's repeat, half-texel inset and texture Y axis.
 const wrap=value=>Math.max(.00260417,Math.min(.99739583,value-Math.floor(value)));
 const x=Math.min(image.width-1,Math.floor((frame+wrap(u))*image.width/spec.frames));
 const y=Math.min(image.height-1,Math.floor((1-wrap(v))*image.height));
 return pixels[(y*image.width+x)*4+3]/255;
}

function setFrame(object, frame, direction = 0) {
 const u = object.userData;
 if (!u.image && images.has(u.environmentId)) {
  u.image = images.get(u.environmentId);
  u.texture.image = u.image;
  u.texture.needsUpdate = true;
 }
 u.frame = frame;
 const spec = ENVIRONMENT_ASSETS[u.environmentId], rows = spec.directions || 1;
 u.direction = ((direction % rows) + rows) % rows;
 u.texture.repeat.x = (u.flipX ? -1 : 1) / spec.frames;
 u.texture.offset.set((frame + (u.flipX ? 1 : 0)) / spec.frames, (rows - 1 - u.direction) / rows);
 if (spec.building || spec.structure) {
  groundSprite(u.sprite,{azimuth:quarterAzimuth(direction),scale:object.scale.x});
 }
}

function createSprite(id, scale = 1) {
 const spec = ENVIRONMENT_ASSETS[id], texture = textureFor(id);
 const material = new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: .5, depthWrite: true, toneMapped: false });
 const sprite = new THREE.Sprite(material);
 sprite.geometry.userData.shared = true;
 sprite.userData.ownedMaterial = true;
 sprite.center.set(spec.anchor[0], 1 - spec.anchor[1]);
 sprite.scale.set(spec.size, spec.size, 1);
 const group = new THREE.Group();
 group.name = id === 'oak' ? 'tree-pixel-oak' : id;
 group.scale.setScalar(scale);
 group.add(sprite);
 group.userData = { pixelEnvironment: true, environmentId: id, image: images.get(id), texture, sprite, frame: 0, direction: 0 };
 // A transparent corner must select the ground behind it, not the sprite's box.
 const raycast = sprite.raycast;
 sprite.raycast = function (raycaster, intersections) {
  const hits = [];raycast.call(this, raycaster, hits);
  const u = group.userData, image = images.get(id), pixels = alphaMasks.get(id);
  for (const hit of hits) {
   if (pixels && image && hit.uv) {
    if (u.clipLowerHalf && (hit.uv.x - .5) * Math.sin(this.material.rotation) + (hit.uv.y - .5) * Math.cos(this.material.rotation) < 0) continue;
    const cell = image.width / spec.frames;
    const x = u.frame * cell + Math.min(cell - 1, Math.max(0, Math.floor((u.flipX ? 1 - hit.uv.x : hit.uv.x) * cell)));
    const y = u.direction * cell + Math.min(cell - 1, Math.max(0, Math.floor((1 - hit.uv.y) * cell)));
    if (pixels[(y * image.width + x) * 4 + 3] < 128) continue;
   }
   intersections.push(hit);
  }
 };
 return group;
}

export function makePixelSawmill(race) {
 return makePixelBuilding('sawmill', race);
}

export function makePixelBuilding(type, race) {
 if (!ENVIRONMENT_ASSETS[type]?.building) return null;
 const bodyAtlas=CRANE_RIGS[type]?type+'Body':type;
 const group = createSprite(bodyAtlas);
 group.name=type;group.userData.buildingType=type;
 group.userData.race = race;
 const u = group.userData;
 u.layers = [];
 const part = (name, frame, size, id = 'productionParts') => {
  const layer = createSprite(id);layer.name = name;layer.userData.sprite.scale.set(size, size, 1);
  layer.userData.sprite.material.depthWrite = false;
  layer.userData.sprite.renderOrder = 1;
  if (name === 'blade') {
   // The saw turns inside its fixed slot, with its lower half inside the bench.
   layer.userData.clipLowerHalf = true;
   const material = layer.userData.sprite.material;
   material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying float bladeScreenY;\n' + shader.vertexShader.replace('mvPosition.xy += rotatedPosition;', 'bladeScreenY = rotatedPosition.y;\n mvPosition.xy += rotatedPosition;');
    shader.fragmentShader = 'varying float bladeScreenY;\n' + shader.fragmentShader.replace('void main() {', 'void main() {\n if (bladeScreenY < 0.0) discard;');
   };
   material.customProgramCacheKey = () => 'pixel-saw-slot';
  }
  setFrame(layer, frame);group.add(layer);u.layers.push(layer);return layer;
 };
 const stateType = ['well','lumber','sawmill','field'].includes(type);
 const tools = {};
 if (type === 'well') {
  tools.bucket = part('bucket', 4, .23);
  const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Array(6).fill(0), 3));
  u.rope = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#705137', toneMapped: false }));
  group.add(u.rope);
 }
 if (type === 'lumber') { tools.log = part('cut-log', 1, .18);tools.axe = part('axe', 5, .34);tools.axe.userData.sprite.center.set(.23, .10); }
 if (type === 'sawmill') { tools.blade = part('blade', 6, .39);tools.feed = part('feed', 1, .32); }
 const crops = type === 'field' ? Array.from({length: 4}, (_, i) => part('crop-' + i, 0, .39, 'wheatGrowth')) : [];
 const stock = stateType ? Array.from({length: 3}, (_, i) => part('output-' + i,
  {well:0,lumber:1,sawmill:2,field:3}[type], {well:.24,lumber:.53,sawmill:.34,field:.29}[type])) : [];
 const right = new THREE.Vector3(), up = new THREE.Vector3(), normal = new THREE.Vector3();
 const screenPoint = (x, y, depth = .004) => u.sprite.position.clone()
  .addScaledVector(right, (x / 192 - ENVIRONMENT_ASSETS[type].anchor[0]) * 1.4)
  .addScaledVector(up, (ENVIRONMENT_ASSETS[type].anchor[1] - y / 192) * 1.4)
  .addScaledVector(normal, depth);
 const position = (layer, x, y, angle = 0) => {
  layer.position.copy(screenPoint(x, y, layer.userData.behind ? -.006 : .006));
  layer.userData.sprite.material.rotation = angle;
 };
 const rope = () => {
  const line = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Array(6).fill(0),3)), new THREE.LineBasicMaterial({color:'#705137',toneMapped:false}));
  group.add(line);(u.ropes ||= []).push(line);return line;
 };
 const industryAnimation = attachIndustryAnimation(type, {part, position, setFrame, rope, screenPoint});
 const farmAnimation = attachFarmAnimals(type, {part, position, setFrame});
 const hoist=CRANE_RIGS[type]?part('crane-hoist',0,1.4,type+'Hoist'):null;
 const hoistRope=hoist?rope():null;
 const hoistGoods=hoist?part('crane-cargo',0,.14,'resourceGoods'):null;
 const cracks=part('damage-cracks',6,.38,'supportArt');
 const rubble=part('damage-rubble',8,.49,'supportArt');
 const repair=part('repair-needed',9,.26,'supportArt');
 const impact=part('condition-effect',10,.35,'supportArt');
 const condition=attachBuildingCondition(type,group,{part,position,setFrame,atlas:bodyAtlas});
 u.animate = (time, building = {}, sim, view = 0) => {
  setFrame(group, pixelBuildingFrame(), view);
  const azimuth = quarterAzimuth(u.direction);
  normal.setFromSphericalCoords(1, QUARTER_POLAR, azimuth);
  right.set(Math.cos(azimuth), 0, -Math.sin(azimuth));up.crossVectors(normal, right);
  const health=building.health??100,clockTime=sim?.time??time;
  if(u.conditionHealth!==undefined&&health!==u.conditionHealth){
   u.conditionEffectUntil=clockTime+.8;u.conditionRepair=health>u.conditionHealth;
  }
  u.previousConditionHealth=u.conditionHealth;u.conditionHealth=health;
  cracks.visible=health<100;setFrame(cracks,health<=50?7:6);position(cracks,96,115);
  rubble.visible=health<=0;position(rubble,94,156);
  repair.visible=health<=0;position(repair,136,135);
  impact.visible=clockTime<(u.conditionEffectUntil??0);setFrame(impact,u.conditionRepair?11:10);position(impact,92,95);
  if(hoist){
   const event=building.previewTransfer||logisticsVisualEvents(sim).find(e=>e.kind==='terminal'&&e.terminal===building.id);
   const p=event?Math.max(0,Math.min(1,(clockTime-event.start)/(event.until-event.start))):0;
   const active=!!event&&health>0&&building.enabled!==false;
   const [,top,,,ax,ay,cx,cy]=CRANE_RIGS[type][u.direction];
   const occluded=type==='polarport'&&u.direction===2;
   const lift=active&&!occluded?Math.sin(p*Math.PI)*Math.min(16,Math.max(0,top-ay-2)):0,dx=active&&!occluded?Math.sin(p*Math.PI*2)*3:0;
   setFrame(hoist,0,u.direction);hoist.visible=health>0;
   position(hoist,96+dx,192*.69-lift);
   hoistGoods.visible=active&&!occluded&&RESOURCE_FRAMES[event.item]!==undefined;
   if(hoistGoods.visible){setFrame(hoistGoods,RESOURCE_FRAMES[event.item]);position(hoistGoods,cx+dx,cy-lift);}
   hoistRope.visible=health>0&&!occluded;
   const points=hoistRope.geometry.attributes.position;
   for(const [i,p] of [screenPoint(ax,ay),screenPoint(ax+dx,top-lift+3)].entries())points.setXYZ(i,p.x,p.y,p.z);
   points.needsUpdate=true;hoistRope.geometry.computeBoundingSphere();u.handlingCargo=active;
  }
  if (!stateType && !industryAnimation) {condition(clockTime,building,u.direction);return;}
  const state = productionVisualState(type, building, sim);u.production = state;
  if (industryAnimation) industryAnimation(time, building, sim, u.direction, state);
  if (!stateType) {
   condition(clockTime,building,u.direction);
   if (farmAnimation) farmAnimation(time, building, sim, u.direction, state);
   return;
  }
  const clock = building.animationTime ?? time;
  // Discrete pixel poses, only on the tool, driven by simulation time. Pausing
  // the game therefore freezes exactly the displayed pose.
  const beat = Math.floor(Math.max(0, clock) * 8) % 16;
  if (tools.bucket) {
   const y = state.working ? 79 + Math.round((1 - Math.cos(beat / 16 * Math.PI * 2)) * 13) : 108;
   position(tools.bucket, 96, y);setFrame(tools.bucket, state.working && beat >= 8 ? 0 : 4);
   const points = u.rope.geometry.attributes.position;
   for (const [i, p] of [screenPoint(96, 58, .003), screenPoint(96, y - 10, .003)].entries()) points.setXYZ(i, p.x, p.y, p.z);
   points.needsUpdate = true;u.rope.geometry.computeBoundingSphere();
  }
  if (tools.axe) {
   const stump = [[142,128],[131,128],[64,130],[50,129]][u.direction];
   tools.log.visible = state.working;position(tools.log, stump[0], stump[1] - 6);
   const swing = [.4,.4,.15,-.25,-.7,-1.15,-1.15,-.55][beat % 8];
   if (state.working) position(tools.axe, stump[0] - 30, stump[1] - 12, swing);
   else position(tools.axe, stump[0] + 11, stump[1] - 31, Math.PI);
  }
  if (tools.blade) {
   position(tools.blade, 96, 93, state.working ? beat * Math.PI / 8 : 0);
   tools.feed.visible = state.workpiece;
   position(tools.feed, u.direction < 2 ? 72 : 120, 103 + (state.working ? beat % 4 : 0));
  }
  for (const [i, crop] of crops.entries()) {
   const xy = [[96,106],[72,122],[120,122],[96,138]][i];position(crop, ...xy);
   setFrame(crop, Math.min(3, Math.floor(state.progress * 4)));
   crop.visible = state.progress > 0 || state.working;
  }
  for (const [i, pile] of stock.entries()) {
   pile.visible = state.count > i * 4;
   const xy = type === 'well' ? [[74,145],[98,157],[122,145]][i]
    : type === 'lumber' ? [u.direction < 2 ? 84 : 109, 119 - i * 12]
    : type === 'sawmill' ? [95 + i * 16, 154 - i * 6]
    : [68 + i * 24, 151];
   position(pile, ...xy);
  }
  condition(clockTime,building,u.direction);
 };
 u.animate(0, {});
 return group;
}

export function makePixelTree(kind = 0, scale = 1) {
 const group = createSprite('oak', scale);
 group.userData.phase = kind * .47;
 group.userData.animate = (time, tile, harvesting = false, view = 0) => {
  setFrame(group, oakFrame(tile, time, harvesting, group.userData.phase));
  groundSprite(group.userData.sprite,{azimuth:quarterAzimuth(view),scale:group.scale.x});
 };
 return group;
}

export function makePixelProp(id, scale = 1, variant = 0) {
 const group=createSprite(id,scale),u=group.userData;
 u.pixelProp=true;u.variant=variant;
 u.animate=(time,_tile,_working,view=0)=>{
  const frame=id==='birds'?Math.floor(time*6)%4:id==='clouds'?variant%4:0;
  // Vehicles turn in world space, so select the corresponding authored face.
  const facing=u.vehicle||u.oriented?view-Math.round(group.rotation.y/(Math.PI/2)):view;
  setFrame(group,frame,facing);
  groundSprite(u.sprite,{azimuth:quarterAzimuth(view),heading:group.rotation.y,scale:group.scale.x});
 };
 u.animate(0,null,false,0);return group;
}

// Vehicle bodies stay fixed. The load follows the shipment rather than being
// painted into every return trip. Local offsets cancel world heading so the
// same screen-space anchor works in the WebGL and CPU renderers.
export function makePixelVehicle(mode='truck',item='steel') {
 const id=VEHICLE_ART[mode]||VEHICLE_ART.wagon,group=makePixelProp(id+'Motion'),u=group.userData;
 u.vehicle=true;u.vehicleKind=mode;u.cargoItem=item;u.loaded=true;
 const cargo=createSprite('resourceGoods');cargo.name='vehicle-cargo';
 cargo.userData.sprite.scale.set(.24,.24,1);cargo.userData.sprite.material.depthWrite=false;cargo.userData.sprite.renderOrder=1;
 group.add(cargo);u.layers=[cargo];u.cargo=cargo;
 const animate=u.animate,normal=new THREE.Vector3(),right=new THREE.Vector3(),up=new THREE.Vector3(),axis=new THREE.Vector3(0,1,0);
 const waterVehicle=['raft','steamer','ship','ferry'].includes(mode);
 const wakes=waterVehicle?Array.from({length:2},(_,i)=>{
  const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.2,0,.08),new THREE.Vector3(0,0,.18),new THREE.Vector3(.2,0,.08)]);
  const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:'#b6e8df',transparent:true,opacity:.65}));
  line.userData.wake=i;group.add(line);return line;
 }):[];
 u.wakes=wakes;
 const pads={
  cargoWagon:[[124,105],[121,133],[71,133],[68,105]],
  cargoTruckEmpty:[[120,98],[111,135],[81,135],[72,98]],
  cargoTrainEmpty:[[135,99],[130,137],[62,137],[57,99]],
  cargoSled:[[125,107],[115,132],[77,132],[67,107]],
  cargoRaft:[[96,128],[96,128],[96,128],[96,128]],
  cargoSteamer:[[130,96],[116,118],[76,118],[62,96]],
  cargoShip:[[91,124],[110,113],[82,113],[101,124]],
  cargoFerry:[[85,132],[109,126],[83,126],[107,132]],
 };
 u.animate=(time,tile,working,view=0)=>{
  animate(time,tile,working,view);
  const frame=u.previewMotion?Math.floor(time*8)%8:vehicleMotion(u,time,group.position);
  setFrame(group,frame,u.direction);
  for(const [i,wake]of wakes.entries()){
   wake.visible=!!(u.motionMoving||u.previewMotion);const phase=(time*1.7+i*.5)%1;
   wake.position.set(0,-.018,-.30-phase*.22);wake.scale.setScalar(.75+phase*.55);wake.material.opacity=(1-phase)*.62;
  }
  cargo.visible=!!u.loaded&&RESOURCE_FRAMES[u.cargoItem]!==undefined&&!!pads[id];
  if(!cargo.visible)return;
  setFrame(cargo,RESOURCE_FRAMES[u.cargoItem]);
  const [x,y]=pads[id][u.direction],spec=ENVIRONMENT_ASSETS[id],angle=quarterAzimuth(view);
  normal.setFromSphericalCoords(1,QUARTER_POLAR,angle);right.set(Math.cos(angle),0,-Math.sin(angle));up.crossVectors(normal,right);
  cargo.position.copy(right).multiplyScalar((x/192-spec.anchor[0])*spec.size)
   .addScaledVector(up,(spec.anchor[1]-y/192)*spec.size).addScaledVector(normal,.012).applyAxisAngle(axis,-group.rotation.y).add(u.sprite.position);
 };
 u.animate(0,null,false,0);return group;
}

export function makeNetworkCargo(item,kind){
 const group=createSprite('resourceGoods'),u=group.userData;
 u.sprite.scale.setScalar(kind==='pipe'?.12:.22);u.sprite.material.depthWrite=false;
 setFrame(group,RESOURCE_FRAMES[item]??0);u.networkCargo=true;u.item=item;
 u.animate=(_time,_tile,_working,view=0)=>groundSprite(u.sprite,{azimuth:quarterAzimuth(view)});
 return group;
}

export function makePixelWater(count, width = 1.005, height = 1.005) {
 const texture = textureFor('water');
 const water = new THREE.InstancedMesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }), count);
 water.userData = { pixelWater: true, environmentId: 'water', texture, image: images.get('water'), frame: 0 };
 water.userData.animate = time => setFrame(water, waterFrame(time));
 return water;
}
