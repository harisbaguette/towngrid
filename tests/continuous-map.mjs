import assert from 'node:assert/strict';
import {WORLD_PLOTS,PROVINCES,PLOT_INDEX,territoryOf,homeProvince,tradeConditions,splitTerritory} from '../src/app/game/territory.js';
import {WORLD_CELLS,layoutOf,SIDES,terrainOfCell,WATER_KINDS} from '../src/app/game/world-grid.js';
import {CELL_PROVINCES} from '../src/app/game/atlas-geometry.js';
import {TRADE_CONNECTIONS} from '../src/app/game/trade-routes.js';
import {Campaign} from '../src/app/game/campaign.js';
import {restrictionOf} from '../src/app/game/settlement-access.js';
import {Simulation} from '../src/app/game/simulation.js';
import {encodeSave,decodeSave} from '../src/app/game/persistence.js';
import {landscapeTile} from '../src/app/game/landscape-surface.js';
import {NATIONS,PROGRESSION_OFFSET} from '../src/app/game/world.js';

assert.equal(new Set(WORLD_PLOTS.map(p=>p.cell.join(','))).size,WORLD_PLOTS.length);
for(const cell of WORLD_CELLS){
 const eligible=!WATER_KINDS.includes(cell.terrain)&&cell.terrain!=='mountain';
 assert.equal(!!cell.site,eligible,'Every buildable square is a plot');
 if(cell.terrain!=='coast')assert.ok(CELL_PROVINCES.has(cell.cx+','+cell.cz),'Every land square has a territory');
 if(!cell.site)continue;
 const p=PLOT_INDEX.get(cell.site),l=layoutOf(p.id);assert.equal(territoryOf(p.id),CELL_PROVINCES.get(p.cell.join(',')).id);
 for(const [side,dx,dz] of SIDES)assert.equal(l.edges[side],terrainOfCell(p.cell[0]+dx,p.cell[1]+dz));
 assert.deepEqual(TRADE_CONNECTIONS[p.id].filter(t=>WATER_KINDS.includes(t.kind)).map(t=>t.kind).sort(),[...new Set(Object.values(l.edges).filter(k=>WATER_KINDS.includes(k)))].sort());
}
// Two squares in one administrative region remain two distinct saved settlements.
const pair=WORLD_PLOTS.filter(p=>p.nation==='estern'&&p.territoryId==='estern-3'&&!restrictionOf(p.id));assert.ok(pair.length>=2);
const c=new Campaign({nation:'estern',provinceId:pair[0].id});c.active.money=1e6;c.active.rank=PROGRESSION_OFFSET+8;
Object.assign(c.active.stock,{wood:100,stone:100,water:100});const offer=c.siteOffer('estern',pair[1].id);
const preview=new Simulation('river',null,{nation:'estern',provinceId:pair[1].id,seed:offer.seed});
assert.ok(c.foundSite('estern',undefined,pair[1].id).ok);assert.deepEqual(c.sites[1].sim.tiles,preview.tiles);
assert.equal(homeProvince(c),'estern-3');
const saved=decodeSave(encodeSave(c.save()));assert.deepEqual(new Campaign({saved}).save(),saved);
const copy=structuredClone(saved);copy.sites[1].provinceId='estern-plot-999-999';assert.throws(()=>encodeSave(copy));
const third=WORLD_PLOTS.find(p=>p.nation==='estern'&&p.territoryId&&p.territoryId!=='estern-3'&&!restrictionOf(p.id)&&!PROVINCES.find(a=>a.id===p.territoryId).capital);
Object.assign(c.active.stock,{wood:100,stone:100,water:100});assert.ok(c.foundSite('estern',undefined,third.id).ok);
c.provinces[third.territoryId].owner='plot-test-state';c.newStates.push({id:'plot-test-state',name:'test',relation:10,pact:false});
assert.equal(tradeConditions(c,c.sites[2].id).closed,true,'New plots follow their administrative region for diplomacy');
const state={id:'new-state'};splitTerritory(c,'estern',state);assert.ok(!state.provinceIds.includes('estern-3'),'Home region stays protected');
// Rendering sources are the simulation tiles, including saved/custom water.
for(const p of WORLD_PLOTS.filter(p=>NATIONS[p.nation]?.playable).filter((_,i)=>i%29===0)){
 const s=new Simulation('river',null,{nation:p.nation,provinceId:p.id}),before=JSON.stringify(s.save());
 for(const t of s.tiles)assert.equal(landscapeTile(s,t.x,t.z).water,t.water);
 assert.equal(JSON.stringify(s.save()),before);
}
console.log(JSON.stringify({passed:true,plots:WORLD_PLOTS.length,checks:['every land square','exact neighbors and ports','multiple plots per region','preview and generation','save roundtrip','invalid plot rejection','political ownership','home protection','rendering reads saved terrain']}));
