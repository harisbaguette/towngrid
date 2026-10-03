import assert from 'node:assert/strict';
import {Campaign} from '../src/app/game/campaign.js';
import {Simulation,BUILDINGS,RESOURCES,createShowcase} from '../src/app/game/simulation.js';
import {RACES,FACTIONS,NATIONS,RANKS,playableRace} from '../src/app/game/world.js';
const run=(c,t)=>{for(let i=0;i<t*4;i++)c.tick(.25);};
assert.equal(Object.keys(NATIONS).length,14);assert.equal(RANKS.length,33);assert.equal(RANKS[0].name,'농노');assert.ok(Object.values(BUILDINGS).every(b=>b.size===1));
for(const race of ['human','dwarf','titan','elf','spirit','centaur','fae']){assert.ok(playableRace(race));const s=createShowcase('estern',race);run(s,85);assert.ok(s.produced.car>0,race+' can manufacture cars');assert.ok(s.produced.circuit>0,race+' can manufacture circuits');assert.ok(s.produced.medicine>0,race+' can manufacture medicine');}
for(const race of ['demon','orc','goblin','beast','dragon','aquatic']){assert.ok(!playableRace(race));assert.throws(()=>new Campaign({race}));}
const c=new Campaign({demo:true}),from=c.sites[1].sim,to=c.home.sim,r=c.routes[0];
// Stop production so the only stock change is the actual in-flight shipment.
for(const site of c.sites){site.sim.nextEvent=999999;site.sim.autoSell={};for(const b of site.sim.buildings)if(!['warehouse','station','generator'].includes(b.type))b.health=0;for(const w of site.sim.workers)site.sim.refundTask(w);site.sim.stock.fuel=10;site.sim.stock.wood=100;site.sim.stock.water=100;site.sim.revision++;}
const sourceBefore=from.stock.steel,destBefore=to.stock.steel;c.tick(.25);assert.equal(from.stock.steel,sourceBefore-r.amount);assert.equal(to.stock.steel,destBefore);assert.equal(r.cargo,r.amount);r.enabled=false;run(c,10);assert.equal(to.stock.steel,destBefore,'stock is not shared instantly');
const snapshot=JSON.parse(JSON.stringify(c.save())),resumed=new Campaign({saved:snapshot});assert.deepEqual(resumed.save(),snapshot);run(resumed,20);assert.equal(resumed.home.sim.stock.steel,destBefore+r.amount);assert.equal(resumed.deliveries,1);assert.equal(resumed.routes[0].cargo,0,'paused route completes in-flight cargo once');
const current=resumed.active;const nation=current.nation;const oldMoney=current.money,oldWood=current.stock.wood;const result=resumed.foundSite(nation);assert.ok(result.ok);const branch=resumed.sites.find(s=>s.id===result.id);assert.equal(branch.sim.stock.wood,24);assert.equal(current.stock.wood,oldWood-24);assert.equal(current.money,oldMoney-950);assert.equal(branch.sim.buildings.length,0);assert.equal(branch.sim.money,current.money);assert.notEqual(branch.sim.stock,current.stock);
assert.equal(resumed.foundSite('nezar').ok,false,'hostile country is not a playable starting realm');
// A blocked station is a recoverable error, never a pathfinding exception.
const isolated=new Simulation();isolated.rank=32;isolated.build('warehouse',10,10,true);isolated.build('station',14,14,true);for(const[x,z]of [[9,10],[11,10],[10,9],[10,11]])isolated.build('house',x,z,true);assert.equal(resumed.stationReady(isolated),false);
// No manual hiring: population follows actual production facilities.
const fresh=new Campaign();fresh.active.build('warehouse',10,12);const initial=fresh.active.workerCount;fresh.active.build('well',10,10);fresh.active.build('field',9,10);fresh.active.build('field',9,11);assert.equal(fresh.active.workerCount,initial,'production buildings bring no residents');fresh.active.build('house',9,14);assert.ok(fresh.active.workerCount>initial,'a house brings residents');
const factory=fresh.active.buildings.find(b=>b.type==='field');fresh.active.money=500;fresh.active.stock.plank=4;assert.equal(fresh.active.specialize(factory.id,'titan').ok,true);assert.equal(fresh.active.specialtyMultiplier(factory),1.12);assert.equal(fresh.active.specialize(factory.id,'demon').ok,false);
// Independent factions arise from simulated instability and survive persistence.
const world=new Campaign({demo:true});world.factions[0].unrest=90;world.factions[0].wealth=5000;world.worldDay();assert.ok(world.newStates.length>0);const recovered=new Campaign({saved:world.save()});assert.equal(recovered.newStates[0].name,world.newStates[0].name);
// Role changes are gated by achieved conditions; money alone cannot buy sovereignty.
const blocked=new Campaign();blocked.active.money=100000;assert.equal(blocked.active.promote().ok,false);
console.log('PASS: 1-tile facilities; seven playable subtypes share modern industries; enemies locked; delayed freight and in-flight save/load; regional inventory conservation; automatic residents; specialties; emerging states; earned status.');
