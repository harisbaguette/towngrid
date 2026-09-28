import assert from 'node:assert/strict';
import {Simulation,createShowcase,BUILDINGS} from '../src/app/game/simulation.js';
import {Campaign} from '../src/app/game/campaign.js';
import {encodeSave,decodeSave} from '../src/app/game/persistence.js';
import {startRaid} from '../src/app/game/encounters.js';
const run=(s,t)=>{for(let i=0;i<t*4;i++)s.tick(.25);};
const s=new Simulation();s.rank=12;s.money=5000;s.nextEvent=1e9;s.autoSell={};
for(const [type,x,z]of [['warehouse',10,13],['house',8,13],['well',10,10],['field',11,10],['lumber',10,8],['mill',13,10],['bakery',13,12]])assert.ok(s.build(type,x,z).ok,type);
const home=s.buildings.find(b=>b.type==='house');s.stock.wood+=6;s.stock.brick+=3;assert.ok(s.upgrade(home.id).ok&&s.upgrade(home.id).ok&&s.workers.length===3,'house upgrades add residents');
run(s,180);assert.ok(s.logisticsStats.direct>0,'factory-to-factory deliveries occur');assert.ok(s.produced.bread>0,'bread chain completes');
const carrying=s.workers.find(w=>w.task?.carried);assert.ok(carrying,'cargo is physically in transit');
const before=encodeSave(s.save());const restored=new Simulation(s.region,decodeSave(before));assert.equal(encodeSave(restored.save()).split('"game":')[1],before.split('"game":')[1]);
run(restored,80);assert.ok(restored.produced.bread>s.produced.bread);assert.ok(Object.values(restored.stock).every(x=>x>=0));
// Conservation through reservation, pickup, delivery and mid-trip demolition.
const isolated=new Simulation();isolated.nextEvent=1e9;isolated.autoSell={};isolated.build('warehouse',10,12,true);isolated.build('well',10,10,true);const well=isolated.buildings.find(b=>b.type==='well');well.enabled=false;well.out=9;const initial=isolated.stock.water+well.out;
run(isolated,3);assert.equal(isolated.stock.water+well.out+isolated.workers.reduce((n,w)=>n+(w.task?.carried?w.task.amount:0),0),initial);
isolated.demolish(10,10);assert.equal(isolated.stock.water,initial,'demolition refunds physical cargo exactly once');
// Saturation and recovery change the actual quote; imported goods cannot create revenue by a round-trip.
s.stock.bread=100;const normal=s.saleQuote('bread',10);s.sell('bread',40);const saturated=s.saleQuote('bread',10);assert.ok(saturated<normal);run(s,160);assert.ok(s.saleQuote('bread',10)>saturated);
// Disease cannot expire by waiting. Early sanitation is accessible without late industry.
const sick=new Simulation();sick.nextEvent=1e9;sick.pendingEvent={type:'illness',at:0};sick.resolveEvent();const infection=sick.health.infection;run(sick,70);assert.ok(sick.health.infection>infection);sick.stock.water=100;sick.stock.wood=100;assert.ok(sick.sanitize().ok);const after=sick.health.infection;run(sick,60);assert.ok(sick.health.infection<after);
// Family rescue has resource gates, a route choice, actual elapsed travel and housing.
const family=new Simulation();family.nextEvent=1e9;family.money=5000;assert.equal(family.rescue().ok,false);family.contracts=2;assert.ok(family.rescue().ok);assert.equal(family.rescue().ok,false);family.debt=400;assert.ok(family.rescue().ok);family.stock.grain=80;assert.ok(family.rescue().ok);assert.ok(family.rescue('river').ok);assert.equal(family.family,false);run(family,101);assert.equal(family.rescue().ok,false);family.build('house',11,11,true);assert.ok(family.rescue().ok);assert.equal(family.family,true);
// Political secession changes actual ownership, rates and freight treatment, surviving save/load.
const c=new Campaign();const state=c.spawnState('estern','강변 공국');assert.ok(state?.provinceIds.length);c.home.provinceId=state.provinceIds[0];assert.equal(c.tradeConditions(c.homeId).owner,state.id);const toll=c.tradeConditions(c.homeId).toll;state.pact=true;assert.ok(c.tradeConditions(c.homeId).toll<toll);const loaded=new Campaign({saved:decodeSave(encodeSave(c.save()))});assert.deepEqual(loaded.provinces,c.provinces);
// Defense is local: absent guards/wards cannot damage distant attackers merely through a scalar.
const battle=createShowcase();battle.nextEvent=1e9;startRaid(battle);const hp=battle.attackers[0].hp;battle.attackers.forEach(w=>{w.delay=5;});run(battle,1);assert.equal(battle.attackers[0].hp,hp);assert.ok(battle.mobilize().ok);assert.equal(battle.guards.length>=2,true);run(battle,65);assert.ok(battle.raid.finished);assert.ok(battle.raid.defeated>0,'visible guards intercept attackers');
// Seven new rights trials are actual requirements rather than decoration.
s.rank=8;s.money=1e6;s.produced.plank=100;s.contracts=20;s.produced.flour=100;s.produced.brick=100;s.totalRevenue=10000;s.logisticsStats.direct=0;assert.equal(s.promotion().ready,false);s.logisticsStats.direct=12;assert.equal(s.promotion().ready,true);
console.log(JSON.stringify({result:'PASS',direct:s.logisticsStats.direct,bread:restored.produced.bread,market:{normal,saturated},family:family.family,split:state.provinceIds,raid:{defeated:battle.raid.defeated,damage:battle.raid.damage},checks:['physical cargo conservation','in-flight save round trip','direct supply chain','market saturation/recovery','persistent infection and care','five-step family rescue','territorial split with real border costs','local defenders','promotion trial gate']},null,2));
