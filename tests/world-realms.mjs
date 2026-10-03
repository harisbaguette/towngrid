import assert from 'node:assert/strict';
import {NATIONS,LEGACY_NATION_IDS} from '../src/app/game/world.js';
import {PROVINCES,WORLD_PLOTS,PLOT_INDEX,plotBelongsTo} from '../src/app/game/territory.js';
import {NATION_SHAPES,UNSETTLEABLE_CELLS,terrainBlockReason,politicalShapes} from '../src/app/game/atlas-geometry.js';
import {WORLD_CELLS,WATER_KINDS,layoutOf} from '../src/app/game/world-grid.js';
import {Campaign} from '../src/app/game/campaign.js';
import {Simulation} from '../src/app/game/simulation.js';
import {encodeSave,decodeSave} from '../src/app/game/persistence.js';
import {makePlotBoundaries} from '../src/app/game/plot-boundaries.js';

const realms=Object.entries(NATIONS),major=realms.filter(([,n])=>n.tier==='major'),minor=realms.filter(([,n])=>n.tier==='minor');
assert.equal(realms.length,14);assert.equal(major.length,4);assert.equal(minor.length,10);
assert.equal(NATION_SHAPES.length,14);assert.equal(PROVINCES.filter(p=>p.capital).length,14);
const secession=politicalShapes({'estern-3':{owner:'new-test'}});
assert.equal(secession.length,15);assert.ok(secession.find(s=>s.id==='new-test').boundary);
assert.notEqual(secession.find(s=>s.id==='estern').boundary,NATION_SHAPES.find(s=>s.id==='estern').boundary);
const area=id=>PROVINCES.filter(p=>p.nation===id).flatMap(p=>p.cells).length;
assert.ok(Math.max(...minor.map(([id])=>area(id)))<Math.min(...major.map(([id])=>area(id))),'Every small country is smaller than every major country');
for(const [id,n] of realms){assert.ok(WORLD_PLOTS.some(p=>p.nation===id&&!p.capital));assert.ok(PLOT_INDEX.get(id+'-0').capital);if(!n.playable)assert.throws(()=>new Campaign({nation:id}));}
const blocked=new Set(UNSETTLEABLE_CELLS.map(c=>c.cx+','+c.cz));
for(const c of WORLD_CELLS){
 const geographic=c.terrain==='mountain'||WATER_KINDS.includes(c.terrain);
 assert.equal(blocked.has(c.cx+','+c.cz),geographic);
 assert.equal(!!terrainBlockReason(c.terrain),geographic);
 if(c.site&&NATIONS[PLOT_INDEX.get(c.site).nation]?.playable===false)assert.ok(!geographic,'Hostile dry land must not get a terrain prohibition mark');
}
// Exercise every historical country, including removed IDs and changed borders.
let relocatedPolitics=0;
for(const id of LEGACY_NATION_IDS){
 for(let i=0;i<6;i++)assert.ok(PLOT_INDEX.has(id+'-'+i),'Original region IDs remain available');
 const provinceId=id+'-5',plot=PLOT_INDEX.get(provinceId);
 const sim=new Simulation(NATIONS[id].region,null,{nation:id,provinceId,race:'human'});
 sim.build('warehouse',10,12,true);const simulation=sim.save();
 const old=new Campaign({nation:'estern'}).save();
 old.sites[0]={...old.sites[0],nation:id,provinceId,simulation};
 old.provinces=Object.fromEntries(PROVINCES.map(p=>[p.id,{owner:p.legacyNation}]));
 const loaded=new Campaign({saved:decodeSave(encodeSave(old))}),town=loaded.home;
 assert.equal(town.provinceId,provinceId);assert.equal(town.sim.provinceId,provinceId);
 assert.deepEqual(town.sim.layout,layoutOf(provinceId));
 assert.deepEqual(town.sim.save().tileState,simulation.tileState);
 assert.deepEqual(town.sim.save().buildings,simulation.buildings);
 assert.equal(town.sim.race,simulation.race);assert.ok(plotBelongsTo(provinceId,town.nation));
 assert.equal(loaded.provinces[provinceId].owner,plot.nation);
 const saved=decodeSave(encodeSave(loaded.save()));assert.deepEqual(new Campaign({saved}).save(),saved,'Migration is idempotent');
 relocatedPolitics+=town.nation!==id;
}
const boundaries=makePlotBoundaries();assert.equal(boundaries.userData.plotSize,24);
assert.ok(boundaries.getObjectByName('neighbor-plot-borders').geometry.attributes.position.count>0);
console.log(JSON.stringify({passed:true,countries:14,major:4,minor:10,terrainMarks:blocked.size,historicalCountries:LEGACY_NATION_IDS.length,relocatedPolitics}));
