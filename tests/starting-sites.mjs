import assert from 'node:assert/strict';
import {Campaign} from '../src/app/game/campaign.js';
import {Simulation} from '../src/app/game/simulation.js';
import {NATIONS} from '../src/app/game/world.js';
import {PROVINCES,WORLD_PLOTS} from '../src/app/game/territory.js';
import {layoutOf,WATER_KINDS} from '../src/app/game/world-grid.js';
import {defaultStartingProvince,startingProvinces} from '../src/app/game/starting-sites.js';
import {restrictionOf} from '../src/app/game/settlement-access.js';
import {encodeSave,decodeSave} from '../src/app/game/persistence.js';

let nations=0,locations=0;
for(const [nation,n] of Object.entries(NATIONS)){
 if(!n.playable){assert.deepEqual(startingProvinces(nation),[]);assert.equal(defaultStartingProvince(nation),null);continue;}
 nations++;
 const initial=new Campaign({nation}),def=defaultStartingProvince(nation);
 assert.equal(initial.active.provinceId,def.id);
 assert.equal(def.capital,false);
 const outer=startingProvinces(nation).find(p=>p.id===nation+'-5');
 assert.equal(def.id,(outer||startingProvinces(nation)[0]).id,'Default uses an available noncapital plot within the current border');
 assert.equal(initial.home.provinceId,def.id,'Atlas and simulation use the same province');
 assert.notEqual(initial.home.provinceId,nation+'-0','A capital district can contain undeveloped plots outside the capital tile');
 assert.equal(startingProvinces(nation).length,WORLD_PLOTS.filter(p=>p.nation===nation&&!p.developed&&!restrictionOf(p.id)).length);
 for(const p of startingProvinces(nation)){
  locations++;
  const c=new Campaign({nation,provinceId:p.id});
  assert.equal(p.capital,false);
  assert.deepEqual(c.active.layout,layoutOf(p.id));
  assert.ok(!WATER_KINDS.includes(c.active.layout.biome)&&c.active.layout.biome!=='mountain');
  assert.equal(c.home.provinceId,c.active.provinceId);
  assert.equal(c.home.name,p.name);
  const saved=decodeSave(encodeSave(c.save()));
  assert.deepEqual(new Campaign({saved}).save(),saved,'Chosen province survives save/load');
 }
 assert.throws(()=>new Campaign({nation,provinceId:nation+'-0'}),/수도권/);
}
for(const provinceId of [null,'estern-99','silvaen-1','nezar-1'])assert.throws(()=>new Campaign({nation:'estern',provinceId}),/수도권/);

// Existing campaigns and old single-town saves must not move out of their capital.
const oldCampaign=new Campaign({starter:true}).save();
assert.equal(oldCampaign.sites[0].provinceId,'estern-0');
assert.deepEqual(new Campaign({saved:decodeSave(encodeSave(oldCampaign))}).save(),oldCampaign);
const oldTown=new Simulation('river',null,{nation:'estern',provinceId:'estern-0'}).save();
delete oldTown.land;
const oldRestored=new Campaign({saved:oldTown});
assert.equal(oldRestored.home.provinceId,'estern-0');
assert.equal(oldRestored.active.layout.legacy,'river');

// A selected start in the old first-branch slot must not get a second map on the same tile.
const c=new Campaign({nation:'estern',provinceId:'estern-1'});
c.active.rank=32;c.active.money=1e6;
for(let i=0;i<5;i++){
 c.active.stock.wood=100;c.active.stock.stone=100;c.active.stock.water=100;
 assert.equal(c.foundSite('estern').ok,true);
}
assert.equal(new Set(c.sites.map(s=>s.provinceId)).size,6);
for(const s of c.sites)assert.equal(s.provinceId,s.sim.provinceId);
const before=c.save();
assert.ok(PROVINCES.some(p=>p.capital&&p.id===c.sites.at(-1).provinceId),'Later expansion can still reach a capital');
for(let i=6;i<24;i++){
 c.active.stock.wood=100;c.active.stock.stone=100;c.active.stock.water=100;
 assert.equal(c.foundSite('estern').ok,true,'Expansion continues into individual plots');
}
assert.equal(new Set(c.sites.map(s=>s.provinceId)).size,24);
const full=c.save();assert.equal(c.foundSite('estern').ok,false);
assert.deepEqual(c.save(),full,'The existing 24-site limit does not charge resources');
console.log(JSON.stringify({result:'PASS',nations,locations,checks:['noncapital defaults','selected location and terrain','invalid starts rejected','new and legacy saves','distinct expansion sites']}));
