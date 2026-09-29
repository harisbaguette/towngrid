// Art for the 2026-09-29 expansion: 22 facilities, 9 crop strips, 35 goods.
// Checks the packed pixels (size, binary transparency, footprint, four views)
// and that the runtime models read the real facility state.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {BUILDINGS,RESOURCES} from '../src/app/game/simulation.js';
import {ENVIRONMENT_ASSETS,PIXEL_BUILDINGS} from '../src/app/game/pixel-environment-data.js';
import {FARM_BUILDINGS,FARM_PROFILES} from '../src/app/game/pixel-farm-data.js';
import {FARM_GOODS_ORDER,FARM_CROP_ATLASES,FARM_SOCKETS} from '../src/app/game/pixel-farm-sockets.js';
import {RESOURCE_SOURCES,RESOURCE_FRAMES,RESOURCE_ICONS} from '../src/app/game/resource-art.js';
import {makePixelBuilding} from '../src/app/game/pixel-environment.js';
import {productionVisualState} from '../src/app/game/production-visuals.js';

const sharp=createRequire(createRequire(import.meta.resolve('wrangler')).resolve('miniflare'))('sharp');
const file=path=>fileURLToPath(new URL('../public'+path,import.meta.url));
async function pixels(path){const {data,info}=await sharp(file(path)).ensureAlpha().raw().toBuffer({resolveWithObject:true});return {data,w:info.width,h:info.height,channels:info.channels};}
// Opaque bounds and alpha census of one 192px cell.
function cell({data,w},cx,cy){
 let minX=192,minY=192,maxX=-1,maxY=-1,partial=0,count=0,bottom=[];
 for(let y=0;y<192;y++)for(let x=0;x<192;x++){
  const a=data[((cy*192+y)*w+cx*192+x)*4+3];
  if(a>0&&a<255)partial++;
  if(a===255){count++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
 }
 for(let x=0;x<192;x++)if(data[((cy*192+maxY)*w+cx*192+x)*4+3]===255)bottom.push(x);
 return {minX,minY,maxX,maxY,partial,count,base:bottom.reduce((s,x)=>s+x,0)/Math.max(1,bottom.length)};
}

// Every facility in the rules has art, and every new one is among them.
const facilities=Object.keys(BUILDINGS).filter(id=>!BUILDINGS[id].tile);
assert.equal(FARM_BUILDINGS.length,22);
assert.deepEqual([...PIXEL_BUILDINGS].sort(),[...facilities].sort(),'no facility without a picture');
for(const id of FARM_BUILDINGS)assert.ok(BUILDINGS[id]&&ENVIRONMENT_ASSETS[id]?.building&&FARM_PROFILES[id],id);

// Bodies: 192x768, binary alpha, one tile footprint centred on the same
// baseline in every view, and four distinct views (SE, NE, NW, SW).
for(const id of FARM_BUILDINGS){
 const png=await pixels(ENVIRONMENT_ASSETS[id].sheet);assert.deepEqual([png.w,png.h],[192,768],id);
 const views=[0,1,2,3].map(v=>cell(png,0,v)),hashes=new Set();
 for(const [v,c] of views.entries()){
  assert.equal(c.partial,0,id+' binary transparency');assert.ok(c.count>4000,id+' view '+v+' drawn');
  assert.ok(c.minX>=4&&c.maxX<=187,id+' stays inside the tile width');
  assert.ok(c.maxY>=178&&c.maxY<=184,id+' baseline '+c.maxY);
  assert.ok(Math.abs(c.base-96)<=3,id+' footprint centre '+c.base);
  const off=v*192*192*4;hashes.add(png.data.subarray(off,off+192*192*4).toString('base64'));
 }
 assert.equal(hashes.size,4,id+' has four different views');
 // The footprint (lowest point of the slab) matches in every view.
 assert.ok(Math.max(...views.map(c=>c.maxY))-Math.min(...views.map(c=>c.maxY))<=2,id+' same footprint in four views');
 const icon=await sharp(file('/assets/pixel-environment/'+id+'-icon.png')).metadata();assert.deepEqual([icon.width,icon.height],[192,192]);
}

// Crops: four growth frames on the plant root line; the last is the largest.
for(const id of FARM_CROP_ATLASES){
 const png=await pixels(ENVIRONMENT_ASSETS[id].sheet);assert.deepEqual([png.w,png.h],[768,192],id);
 const frames=[0,1,2,3].map(f=>cell(png,f,0));
 for(const f of frames){assert.equal(f.partial,0);assert.ok(f.count>60,id);assert.ok(f.maxY>=176&&f.maxY<=184,id+' root line '+f.maxY);}
 for(let f=1;f<4;f++)assert.ok(frames[f].count>=frames[f-1].count,id+' grows stage '+f);assert.ok(frames[3].count>frames[0].count*1.3,id+' grows');
}

// Goods: appended after the 36 existing goods; nothing earlier moves.
const EXISTING=['wood','stone','water','grain','plank','flour','bread','fish','gear','iron','coal','steel','oil','fuel','polymer','mana','circuit','car','medicine','cotton','herb','egg','smokedfish','cloth','cake','brick','workwear','glass','copper','wire','concrete','canned','lamp','engine','mithril','airship'];
assert.deepEqual(Object.keys(RESOURCE_SOURCES).slice(0,36),EXISTING);
assert.equal(FARM_GOODS_ORDER.length,35);
for(const [i,id] of FARM_GOODS_ORDER.entries()){
 assert.ok(RESOURCES[id],id+' is a game resource');assert.equal(RESOURCE_FRAMES[id],36+i);
 assert.deepEqual(RESOURCE_SOURCES[id],['farmGoods',i]);
}
for(const id of Object.keys(RESOURCES))assert.ok(RESOURCE_ICONS[id],id+' icon');
const goods=await pixels(ENVIRONMENT_ASSETS.farmGoods.sheet),atlas=await pixels(ENVIRONMENT_ASSETS.resourceGoods.sheet);
assert.deepEqual([goods.w,atlas.w],[35*192,71*192]);
for(const [i,id] of FARM_GOODS_ORDER.entries()){
 const c=cell(goods,i,0);assert.equal(c.partial,0,id);assert.ok(c.count>2500,id+' drawn');
 assert.ok(c.minX>0&&c.minY>0&&c.maxX<191&&c.maxY<191,id+' transparent border');
 assert.ok(Math.abs((c.minX+c.maxX)/2-96)<=14&&Math.abs((c.minY+c.maxY)/2-96)<=14,id+' centred');
 // The world stockpile atlas carries the same picture at the appended frame.
 for(let y=0;y<192;y+=7)for(let x=0;x<192;x+=5){
  const a=((y*goods.w)+i*192+x)*4,b=((y*atlas.w)+(36+i)*192+x)*4;
  assert.deepEqual([...goods.data.subarray(a,a+4)],[...atlas.data.subarray(b,b+4)],id+' stockpile frame');
 }
 const ui=await sharp(file(RESOURCE_ICONS[id])).metadata();assert.deepEqual([ui.width,ui.height],[96,96],id);
}

// Runtime: fields grow the recipe's crop, output piles show the real product,
// hidden sockets stay hidden, damage layers apply, rendering never mutates state.
for(const id of FARM_BUILDINGS){
 const def=BUILDINGS[id],model=makePixelBuilding(id,'human'),profile=FARM_PROFILES[id];
 for(const recipe of def.recipes||(def.output?[def]:[])){
  const b={type:id,recipe:recipe.id,health:100,enabled:true,working:true,progress:.8,out:6,inputs:{},animationTime:3,activeUntil:40};
  const context={time:3,power:true,poweredAt:()=>true,recipeOf:()=>recipe},before=JSON.stringify(b);
  for(let view=0;view<4;view++){
   model.userData.animate(3,b,context,view);assert.equal(model.userData.direction,view);
   const state=productionVisualState(id,b,context);
   const piles=model.userData.layers.filter(l=>l.name.startsWith('output-')&&l.visible);
   if(!state.service){assert.ok(piles.length>0,id+' stock');for(const p of piles)assert.equal(p.userData.frame,RESOURCE_FRAMES[recipe.output]);}
   const crops=model.userData.layers.filter(l=>l.name.startsWith('crop-')&&l.visible);
   if(profile.crop){
    const atlas=typeof profile.crop==='string'?profile.crop:profile.crop[recipe.output];
    assert.equal(crops.length,4,id+' crops');for(const c of crops){assert.equal(c.userData.cropAtlas,atlas);assert.equal(c.userData.frame,3);}
   }else assert.equal(crops.length,0);
   for(const [n,spec] of profile.parts.entries()){
    const layer=model.userData.layers.find(l=>l.name===spec.name+'-'+n);
    if(spec.pos[view]===null)assert.equal(layer.visible,false,id+' '+spec.name+' hidden behind the building in view '+view);
   }
  }
  assert.equal(JSON.stringify(b),before,'art must not change the building');
 }
 for(const [socket,points] of Object.entries(FARM_SOCKETS[id]))assert.ok(points.some(Boolean),id+' '+socket+' visible in some view');
 model.userData.animate(4,{type:id,health:30,enabled:true,inputs:{}},{time:4},0);
 assert.ok(model.userData.layers.some(l=>l.name==='damage-cracks'&&l.visible),id+' damage');
 model.userData.animate(5,{type:id,health:100,enabled:true,inputs:{}},{time:5},0);
 assert.ok(!model.userData.layers.some(l=>l.name==='damage-cracks'&&l.visible),id+' repaired');
 for(const [n,spec] of profile.parts.entries())assert.ok(model.userData.layers.some(l=>l.name===spec.name+'-'+n),id+' '+spec.name);
}
console.log(`Expansion art: ${FARM_BUILDINGS.length}/22 facilities × 4 views, ${FARM_CROP_ATLASES.length} crop strips, ${FARM_GOODS_ORDER.length}/35 goods appended after 36, ${PIXEL_BUILDINGS.length} facilities with art.`);
