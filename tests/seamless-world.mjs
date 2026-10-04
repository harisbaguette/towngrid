import assert from 'node:assert/strict';
import {Campaign} from '../src/app/game/campaign.js';
import {Simulation} from '../src/app/game/simulation.js';
import {WORLD_PLOTS} from '../src/app/game/territory.js';
import {WORLD_CELLS,MAP,WATER_KINDS,layoutOf} from '../src/app/game/world-grid.js';
import {WorldTerrainData,localToWorld,worldToLocal,worldCellAt,plotCenter} from '../src/app/game/world-space.js';
import {generateTerrainTiles} from '../src/app/game/terrain-tiles.js';
import {encodeSave,decodeSave} from '../src/app/game/persistence.js';
import {NATIONS,PROGRESSION_OFFSET} from '../src/app/game/world.js';
import {isExportTile} from '../src/app/game/export-route.js';

const campaign=new Campaign(),sim=campaign.active,data=new WorldTerrainData(sim),before=JSON.stringify(campaign.save());
for(const c of WORLD_CELLS){
 const center=[c.cx*MAP+11.5,c.cz*MAP+11.5];assert.equal(worldCellAt(...center),c);
 const local=worldToLocal(sim,...center);assert.deepEqual(localToWorld(sim,...local),center);
 for(const [x,z] of [[0,0],[23,0],[0,23],[23,23]])assert.equal(worldCellAt(c.cx*MAP+x,c.cz*MAP+z),c,'All four corners belong to exactly one cell');
 if(WATER_KINDS.includes(c.terrain))assert.equal(data.sample(...center).water,c.terrain);
 if(!c.site)continue;
 const layout=layoutOf(c.site);if(!NATIONS[WORLD_PLOTS.find(p=>p.id===c.site)?.nation]?.playable)continue;
 if((c.cx+c.cz)%11)continue;
 const generated=generateTerrainTiles(layout,0),preview=new Simulation('river',null,{nation:'estern',provinceId:c.site,seed:0});
 preview.seedMap();assert.deepEqual(generated,preview.tiles);
 for(const t of generated)assert.equal(data.sample(c.cx*MAP+t.x,c.cz*MAP+t.z).water,t.water,'Far and close ground read the same water');
}
for(const t of sim.tiles)assert.equal(data.sample(...localToWorld(sim,t.x,t.z)).water,t.water);
assert.equal(JSON.stringify(campaign.save()),before,'Rendering and surveying never edit the save');
sim.rank=PROGRESSION_OFFSET+8;sim.money=100000;Object.assign(sim.stock,{wood:200,stone:200,water:200});
const candidate=WORLD_PLOTS.find(p=>campaign.siteOffer('estern',p.id).ok),offer=campaign.siteOffer('estern',candidate.id),cell=worldCellAt(...plotCenter(candidate.id));
const surveyed=structuredClone(data.tiles(cell));assert.equal(offer.seed,0);assert.ok(campaign.foundSite('estern',undefined,candidate.id).ok);
for(const t of campaign.sites[1].sim.tiles){const expected={...surveyed[t.z*MAP+t.x]};if(isExportTile(t.x,t.z)&&t.terrain!=='water'){expected.nature=null;expected.remaining=0;}assert.deepEqual(t,expected,'Only the new entry road clears nature; acquisition does not reroll a plot');}
data.setSimulation(sim);assert.equal(data.tiles(cell),campaign.sites[1].sim.tiles,'Existing sites supply their live tile data');
const restored=new Campaign({saved:decodeSave(encodeSave(campaign.save()))});assert.deepEqual(restored.save(),campaign.save());
const old=new Simulation('river',null,{nation:'estern',provinceId:candidate.id,seed:81}),oldSaved=old.save();
const loaded=new Simulation(old.region,oldSaved);const oldData=new WorldTerrainData(loaded);
assert.deepEqual(oldData.tiles(cell),old.tiles,'An old nonzero seed retains its original deposits');
assert.deepEqual(loaded.save(),oldSaved);
for(const c of WORLD_CELLS.filter(c=>c.site))data.tiles(c);
assert.ok(data.generated.size<=64,'Unoccupied tile cache remains bounded');
console.log('Seamless world: coordinate roundtrips, all cell corners, exact terrain at every scale, same generation, stable acquisition, old seeds, save roundtrip, bounded cache passed.');
