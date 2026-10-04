import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {WORLD_CELLS,COLS,ROWS,layoutOf} from '../src/app/game/world-grid.js';
import {terrainConnections,ATLAS_DIRECTIONS,atlasCell,isWater,ATLAS_SPRITES} from '../src/app/game/atlas-terrain.js';
import {placeAtlasLabels} from '../src/app/game/atlas-labels.js';
import {FULL_VIEW,viewAround} from '../src/app/game/atlas-geometry.js';
import {Campaign} from '../src/app/game/campaign.js';
import {Simulation} from '../src/app/game/simulation.js';
import {PROGRESSION_OFFSET} from '../src/app/game/world.js';
import {decodeSave,encodeSave} from '../src/app/game/persistence.js';
import {defaultStartingProvince} from '../src/app/game/starting-sites.js';

const manifest=JSON.parse(readFileSync('public/assets/world-atlas/manifest.json','utf8'));
assert.equal(manifest.worldHash,createHash('sha256').update(JSON.stringify(WORLD_CELLS)).digest('hex'),'Repack when the real world changes');
assert.deepEqual(manifest.grid,[COLS,ROWS]);
for(const [path,hash] of [[manifest.source,manifest.sourceHash],[manifest.markerSource,manifest.markerSourceHash]])assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),hash,'Repack changed source artwork');
for(const name of ATLAS_SPRITES)assert.ok(readFileSync('public/assets/world-atlas/'+name+'.png').length>100);
for(const cell of WORLD_CELLS){
 const links=terrainConnections(cell);
 ATLAS_DIRECTIONS.forEach(([dx,dz],i)=>{
  const next=atlasCell(cell.cx+dx,cell.cz+dz);
  assert.equal(!!(links.water&(1<<i)),!!next&&isWater(next.terrain));
  assert.equal(!!(links.shore&(1<<i)),!!next&&isWater(next.terrain)!==isWater(cell.terrain));
  if(next&&next.terrain===cell.terrain)assert.ok(links.same&(1<<i));
 });
}
const candidates=Array.from({length:30},(_,i)=>({id:i,text:'국가 이름 '+i,point:[640+(i%5)*7,380+Math.floor(i/5)*7],priority:i,font:12}));
for(const view of [FULL_VIEW,viewAround([650,400],500),viewAround([650,400],208)])for(const size of [{width:950,height:590},{width:360,height:340}]){
 const labels=placeAtlasLabels(candidates,view,size),scale=Math.min(size.width/view.width,size.height/view.height);
 assert.ok(labels.length>0&&labels.length<candidates.length,'Crowded labels are culled');
 for(const [i,a] of labels.entries()){
  assert.ok(Math.abs(a.font*scale-12)<.001,'Screen type size stays constant');
  for(const b of labels.slice(i+1))assert.ok(a.box.x+a.box.w<=b.box.x||b.box.x+b.box.w<=a.box.x||a.box.y+a.box.h<=b.box.y||b.box.y+b.box.h<=a.box.y,'No label overlaps');
 }
}
const c=new Campaign({nation:'estern',provinceId:'estern-5'}),target='estern-3',foreign=defaultStartingProvince('silvaen').id;
const initial=c.save();assert.equal(c.siteOffer('estern',target).status,'locked');
assert.equal(c.foundSite('estern',undefined,target).ok,false);assert.deepEqual(c.save(),initial);
c.active.rank=PROGRESSION_OFFSET+8;c.active.money=10000;
c.active.stock.wood=24;c.active.stock.stone=16;c.active.stock.water=8;
assert.equal(c.siteOffer('silvaen',foreign).status,'locked','Foreign promotion gate matches button');
const quote=c.siteOffer('estern',target),before=JSON.stringify(c.save());
const preview=new Simulation('river',null,{nation:'estern',provinceId:target,seed:quote.seed});
assert.equal(JSON.stringify(c.save()),before,'Quote and preview never mutate campaign');
const result=c.foundSite('estern',undefined,target);assert.ok(result.ok);
const created=c.sites.find(s=>s.id===result.id);
assert.equal(created.provinceId,target);assert.deepEqual(created.sim.layout,layoutOf(target));
assert.deepEqual(created.sim.tiles,preview.tiles,'Actual water, nature and resource values equal preview');
assert.deepEqual([...created.sim.roads],[...preview.roads]);assert.deepEqual([...created.sim.owned],[...preview.owned]);
assert.equal(c.active.money,10000-quote.cost);assert.equal(c.active.stock.wood,0);
assert.equal(c.siteOffer('estern',target).status,'owned');
const snapshot=c.save();assert.equal(c.foundSite('estern',undefined,target).ok,false);assert.deepEqual(c.save(),snapshot);
assert.equal(c.siteOffer('estern',foreign).ok,false);
assert.equal(c.siteOffer('estern','not-a-province').ok,false);
c.active.rank=PROGRESSION_OFFSET+13;c.active.money=0;
assert.equal(c.siteOffer('silvaen',foreign).status,'materials');
c.active.money=1e5;Object.assign(c.active.stock,{wood:100,stone:100,water:100});
assert.equal(c.siteOffer('silvaen',foreign).ok,true);
assert.ok(c.foundSite('silvaen',undefined,foreign).ok);
const save=decodeSave(encodeSave(c.save()));assert.deepEqual(new Campaign({saved:save}).save(),save);
console.log(JSON.stringify({result:'PASS',terrainCells:WORLD_CELLS.length,sprites:ATLAS_SPRITES.length,terrainBytes:manifest.terrainBytes,checks:['raster matches world','shoreline and river neighbors','fixed type size and nonoverlapping labels','read-only quotes','promotion/material gates','selected plot transaction','preview equals generated tiles','save compatibility']}));
