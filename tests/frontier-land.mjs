import assert from 'node:assert/strict';
import {NATIONS,PROGRESSION_OFFSET} from '../src/app/game/world.js';
import {WORLD_PLOTS,PLOT_INDEX,landOwnerOf,territoryOf} from '../src/app/game/territory.js';
import {PLOT_RESTRICTIONS,LAND_RESTRICTIONS,startBlockReason,biomeCandidates} from '../src/app/game/settlement-access.js';
import {startingProvince,startingProvinces} from '../src/app/game/starting-sites.js';
import {frontierShape,wildernessCells,UNCLAIMED_CELLS,terrainBlockReason} from '../src/app/game/atlas-geometry.js';
import {ATLAS_BIOME_COLORS} from '../src/app/game/atlas-terrain.js';
import {BIOMES} from '../src/app/game/biome-data.js';
import {layoutOf,terrainOfCell} from '../src/app/game/world-grid.js';
import {Campaign} from '../src/app/game/campaign.js';
import {Simulation} from '../src/app/game/simulation.js';
import {encodeSave,decodeSave} from '../src/app/game/persistence.js';

assert.deepEqual([...new Set(PLOT_RESTRICTIONS.values())].sort(),Object.keys(LAND_RESTRICTIONS).sort());
const c=new Campaign();c.active.rank=PROGRESSION_OFFSET+13;c.active.money=1e6;Object.assign(c.active.stock,{wood:1000,stone:1000,water:1000});
for(const [id,kind] of PLOT_RESTRICTIONS){
 const p=PLOT_INDEX.get(id);assert.ok(p.nation&&!p.developed);assert.equal(terrainBlockReason(terrainOfCell(...p.cell)),null,'Legal restrictions are not impassable terrain');
 assert.equal(startBlockReason(p.nation,id),NATIONS[p.nation].playable?LAND_RESTRICTIONS[kind].reason:'적대 세력 · 시작 불가');assert.equal(startingProvince(p.nation,id),null);
 if(NATIONS[p.nation].playable){assert.throws(()=>new Campaign({nation:p.nation,provinceId:id}));assert.equal(c.siteOffer(p.nation,id).status,'restricted');const before=c.save();assert.equal(c.foundSite(p.nation,undefined,id).ok,false);assert.deepEqual(c.save(),before);}
}
for(const [id,n] of Object.entries(NATIONS)){assert.ok([...PLOT_RESTRICTIONS.keys()].some(p=>PLOT_INDEX.get(p).nation===id));if(n.playable)assert.ok(startingProvinces(id).length>0);}
assert.deepEqual(Object.keys(ATLAS_BIOME_COLORS).sort(),Object.keys(BIOMES).sort());
for(const ecology of Object.keys(BIOMES)){
 const p=biomeCandidates(ecology,c.home.nation,c.sites,c.provinces)[0];assert.ok(p,ecology+' has an accessible plot');assert.equal(layoutOf(p.id).ecology,ecology);
 const offer=c.siteOffer(p.nation||'unclaimed',p.id);assert.ok(offer.ok,ecology+' can be acquired');
 const preview=new Simulation(NATIONS[offer.nation].region,null,{nation:offer.nation,provinceId:p.id,seed:offer.seed});
 const result=c.foundSite(p.nation||'unclaimed',undefined,p.id);assert.ok(result.ok);const sim=c.sites.find(s=>s.id===result.id).sim;
 assert.deepEqual(sim.tiles,preview.tiles);assert.equal(sim.layout.ecology,ecology);assert.equal(sim.buildings.length,0);
}
const wild=WORLD_PLOTS.filter(p=>p.nation===null&&!c.sites.some(s=>s.provinceId===p.id));
const a=wild.find(p=>wild.some(q=>Math.abs(p.cell[0]-q.cell[0])+Math.abs(p.cell[1]-q.cell[1])===1)),b=wild.find(q=>Math.abs(a.cell[0]-q.cell[0])+Math.abs(a.cell[1]-q.cell[1])===1);
const claimsBefore=frontierShape(c.sites).cells.length;
for(const p of [a,b])assert.ok(c.foundSite('unclaimed',undefined,p.id).ok);
const pair=c.sites.filter(s=>[a.id,b.id].includes(s.provinceId)),shape=frontierShape(pair);
assert.equal(shape.cells.length,2);assert.equal((shape.boundary.match(/M/g)||[]).length,6,'Adjacent claims share a continuous outer border');
assert.equal(frontierShape(c.sites).cells.length,claimsBefore+2);
for(const p of [a,b]){assert.equal(landOwnerOf(p.id,c.provinces,c.sites),'player');assert.equal(c.provinces[territoryOf(p.id)].owner,null);}
const neighbor=wild.find(p=>![a.id,b.id].includes(p.id)&&!c.sites.some(s=>s.provinceId===p.id));assert.equal(landOwnerOf(neighbor.id,c.provinces,c.sites),null);
assert.equal(wildernessCells(c.provinces,c.sites).length,UNCLAIMED_CELLS.length-frontierShape(c.sites).cells.length);
const saved=decodeSave(encodeSave(c.save())),restored=new Campaign({saved});assert.deepEqual(restored.save(),saved);assert.deepEqual(frontierShape(restored.sites),frontierShape(c.sites));
// Previously saved towns in newly restricted plots retain their ground, buildings and access.
const reserved=[...PLOT_RESTRICTIONS.keys()].find(id=>PLOT_INDEX.get(id).nation==='estern'),legacy=new Campaign().save();
const oldSim=new Simulation('river',null,{nation:'estern',provinceId:reserved});oldSim.build('warehouse',10,12,true);legacy.sites[0]={...legacy.sites[0],provinceId:reserved,simulation:oldSim.save()};
const loaded=new Campaign({saved:decodeSave(encodeSave(legacy))});assert.equal(loaded.home.provinceId,reserved);assert.deepEqual(loaded.active.save().buildings,oldSim.save().buildings);assert.equal(loaded.siteOffer('estern',reserved).status,'owned');
console.log(JSON.stringify({passed:true,restricted:PLOT_RESTRICTIONS.size,biomes:Object.keys(BIOMES).length,claimedPlots:frontierShape(c.sites).cells.length,saveCompatible:true}));
