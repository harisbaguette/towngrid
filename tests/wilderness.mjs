import assert from 'node:assert/strict';
import {PROVINCES,WORLD_PLOTS,sovereignOf,developmentOf,territoryOf,landOwnerOf} from '../src/app/game/territory.js';
import {UNCLAIMED_CELLS,NATION_SHAPES,politicalShapes,wildernessCells,terrainBlockReason} from '../src/app/game/atlas-geometry.js';
import {NATIONS,PROGRESSION_OFFSET} from '../src/app/game/world.js';
import {layoutOf} from '../src/app/game/world-grid.js';
import {startingProvinces} from '../src/app/game/starting-sites.js';
import {Campaign} from '../src/app/game/campaign.js';
import {Simulation} from '../src/app/game/simulation.js';
import {encodeSave,decodeSave} from '../src/app/game/persistence.js';

const wild=WORLD_PLOTS.filter(p=>p.nation===null),land=PROVINCES.flatMap(p=>p.cells),national=WORLD_PLOTS.filter(p=>p.nation);
assert.ok(UNCLAIMED_CELLS.length/land.length>.25&&UNCLAIMED_CELLS.length/land.length<.4);
assert.ok(wild.length>250);assert.equal(NATION_SHAPES.length,14);
assert.equal(UNCLAIMED_CELLS.length+PROVINCES.filter(p=>p.nation).flatMap(p=>p.cells).length,land.length);
for(const p of wild){assert.equal(sovereignOf(p.id),null);assert.equal(developmentOf(p.id),'undeveloped');assert.equal(terrainBlockReason(layoutOf(p.id).biome),null);}
for(const id of Object.keys(NATIONS)){
 const plots=national.filter(p=>p.nation===id);assert.ok(plots.some(p=>p.developed));assert.ok(plots.some(p=>!p.developed));
 for(const p of startingProvinces(id)){assert.equal(p.nation,id);assert.equal(developmentOf(p.id),'undeveloped');}
}
assert.ok(national.filter(p=>!p.developed).length/national.length>.9);
const c=new Campaign(),p=wild[0],before=c.save();
assert.equal(c.siteOffer('unclaimed',p.id).status,'locked');assert.equal(c.foundSite('unclaimed',undefined,p.id).ok,false);assert.deepEqual(c.save(),before);
assert.throws(()=>new Campaign({nation:'estern',provinceId:p.id}));
c.active.rank=PROGRESSION_OFFSET+13;c.active.money=10000;Object.assign(c.active.stock,{wood:24,stone:16,water:8});
const offer=c.siteOffer('unclaimed',p.id),preview=new Simulation(NATIONS[offer.nation].region,null,{nation:offer.nation,seed:offer.seed,provinceId:p.id});
assert.equal(offer.ok,true);assert.equal(c.siteOffer('unclaimed','estern-3').ok,false);
const result=c.foundSite('unclaimed',undefined,p.id);assert.ok(result.ok);const site=c.sites.find(s=>s.id===result.id);
assert.deepEqual(site.sim.tiles,preview.tiles);assert.equal(site.nation,c.home.nation);assert.equal(sovereignOf(p.id,c.provinces),null);
assert.equal(developmentOf(p.id,c.sites),'outpost');assert.equal(c.active.money,10000-offer.cost);assert.equal(c.active.stock.wood,0);
assert.ok(site.sim.build('warehouse',10,12,true).ok);assert.equal(developmentOf(p.id,c.sites),'settlement');
const homeId=c.activeId;c.switchSite(site.id);assert.equal(c.hierarchy()[0],'내 변경 영지');c.switchSite(homeId);
assert.equal(landOwnerOf(p.id,c.provinces,c.sites),'player');assert.equal(c.tradeConditions(site.id).owner,'player');assert.equal(c.siteOffer('unclaimed',p.id).status,'owned');
const occupied=c.save();assert.equal(c.foundSite('unclaimed',undefined,p.id).ok,false);assert.deepEqual(c.save(),occupied);
const saved=decodeSave(encodeSave(c.save()));assert.deepEqual(new Campaign({saved}).save(),saved);
// Both older atlas generations migrate sovereignty, never the physical settlement or citizenship.
for(const oldOwner of [p.legacyNation,p.previousNation]){
 const legacy=new Campaign().save(),sim=new Simulation(NATIONS[oldOwner].region,null,{nation:oldOwner,provinceId:p.id,race:'human'});sim.build('warehouse',10,12,true);
 legacy.sites[0]={...legacy.sites[0],nation:oldOwner,provinceId:p.id,simulation:sim.save()};
 legacy.provinces=Object.fromEntries(PROVINCES.map(r=>[r.id,{owner:oldOwner===p.legacyNation?r.legacyNation:r.previousNation}]));
 const restored=new Campaign({saved:decodeSave(encodeSave(legacy))});
 assert.equal(restored.home.provinceId,p.id);assert.equal(restored.home.nation,oldOwner);assert.equal(sovereignOf(p.id,restored.provinces),null);
 assert.deepEqual(restored.active.save().buildings,sim.save().buildings);assert.deepEqual(restored.active.save().tileState,sim.save().tileState);
 const roundtrip=decodeSave(encodeSave(restored.save()));assert.deepEqual(new Campaign({saved:roundtrip}).save(),roundtrip);
}
const owners={[territoryOf(p.id)]:{owner:'new-wilderness'}};
assert.ok(politicalShapes(owners).some(s=>s.id==='new-wilderness'));assert.ok(wildernessCells(owners).length<UNCLAIMED_CELLS.length);
const tampered=structuredClone(saved);tampered.provinces['estern-0'].owner=null;assert.throws(()=>encodeSave(tampered),'Null ownership is valid only in unclaimed regions');
console.log(JSON.stringify({passed:true,unclaimedCells:UNCLAIMED_CELLS.length,unclaimedPlots:wild.length,nationalPlots:national.length,nationalUndeveloped:national.filter(p=>!p.developed).length,settlements:national.filter(p=>p.developed).length}));
