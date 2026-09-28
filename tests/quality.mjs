import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Campaign} from '../src/app/game/campaign.js';
import {Simulation,BUILDINGS,RESOURCES,N} from '../src/app/game/simulation.js';
import {RANKS,RACES,unlockRank} from '../src/app/game/world.js';
import {startRaid,tickRaid} from '../src/app/game/encounters.js';
import {encodeSave,decodeSave,writeSave,SAVE_KEY} from '../src/app/game/persistence.js';
import {FILES} from '../src/app/game/audio.js';
const run=(s,seconds)=>{for(let i=0;i<seconds*4;i++)s.tick(.25);};
const fresh=()=>{const s=new Simulation();s.nextEvent=1e9;return s;};
let checks=0;const passed=name=>{checks++;console.log('PASS',name);};

// Prerequisite graph: no status requires producing a resource it has not unlocked.
for(const rank of RANKS)for(const[key]of rank.requirements){
 const[kind,item]=key.split(':');if(['produced','sold'].includes(kind))
 assert.ok(Object.entries(BUILDINGS).some(([id,d])=>d.output===item&&unlockRank(id)<rank.id),rank.name+' '+item);
}
passed('33-rank prerequisite graph has no future-industry deadlock');

{
 const c=new Campaign(),s=c.active;s.build('warehouse',10,12);s.build('house',9,14);s.build('field',12,12);
 s.rank=32;s.money=2000;s.stock.water=30;s.autoSell={water:true};s.reserves.water=7;
 c.routes.push({from:s.siteId,item:'water',enabled:true,amount:6});
 assert.equal(s.minimumStock('water'),13);s.salesTimer=8;s.tick(.01);assert.equal(s.shipments[0]?.amount,10,'auto-sale loads ten units onto an export cart');assert.ok(s.stock.water>=13,'remaining stock stays above its reserve after workers collect supplies');for(let i=0;i<60&&!s.sold.water;i++)s.tick(.25);assert.equal(s.sold.water,10,'payment arrives when the cart reaches the export gate');
 s.stock.water=13;s.salesTimer=8;s.tick(.01);assert.equal(s.stock.water,13);
 const b=s.buildings.find(v=>v.type==='field');b.health=63;s.money=1000;const cost=s.repairCost(b);assert.ok(s.repair(b.id).ok);assert.equal(b.health,100);assert.equal(s.money,1000-cost);
 s.setOperation(b.id,false,2);run(s,2);assert.equal(b.working,false);assert.equal(b.status,'가동 중지');assert.equal(b.priority,2);
 s.setOperation(b.id,true,1);run(s,40);assert.ok(s.produced.grain>0);
 passed('automatic sales preserve supply/freight; facility pause, resume and partial repair');
}
{
 const s=fresh(),cash=s.money;assert.equal(s.buy('car',1).ok,false);assert.equal(s.money,cash);
 assert.equal(s.buy('wood',5).ok,true);assert.equal(s.money,cash-5*Math.ceil(RESOURCES.wood.price*1.85));assert.equal(s.stock.wood,55);assert.equal(s.produced.wood,undefined);
 assert.equal(s.buy('wood',-1).ok,false);assert.equal(s.buy('wood',101).ok,false);assert.equal(s.buy('missing',1).ok,false);
 s.money=100;const debt=s.debt;assert.ok(s.recover().ok);assert.equal(s.money,500);assert.equal(s.debt,debt+520);s.money=-100;assert.equal(s.recover().ok,false);
 s.time+=400;assert.ok(s.recover().ok);assert.equal(s.money,500);
 passed('paid imports respect unlocks; rescue financing charges debt and enforces cooldown');
}
{
 let s=fresh();assert.ok(s.plant(10,10).ok);assert.equal(s.tile(10,10).nature,'sapling');assert.equal(s.plant(10,10).ok,false);
 s=new Simulation(s.region,decodeSave(encodeSave(s.save())));run(s,160);assert.equal(s.tile(10,10).nature,'tree');assert.equal(s.tile(10,10).remaining,90);
 s.money=500;s.stock.water=5;assert.ok(s.plant(11,10).ok);const stone=s.stock.stone;s.build('field',11,10);assert.equal(s.stock.stone,stone,'clearing a sapling cannot manufacture stone');assert.equal(s.tile(11,10).growAt,undefined);
 passed('seedlings survive save/load, mature and do not create demolition resources');
}
{
 const c=new Campaign({demo:true}),s=c.active,battery=s.buildings.find(b=>b.type==='battery'),station=s.buildings.find(b=>b.type==='station');
 s.outageUntil=100;s.batteryCharge=40;assert.equal(s.power,true);s.setOperation(battery.id,false);assert.equal(s.power,false);s.setOperation(battery.id,true);assert.equal(s.power,true);
 assert.equal(c.stationReady(s),true);s.setOperation(station.id,false);assert.equal(c.stationReady(s),false);s.setOperation(station.id,true);assert.equal(c.stationReady(s),true);
 const clinic=fresh();clinic.rank=9;clinic.build('clinic',10,10,true);assert.ok(clinic.medicalProtection);clinic.rank=20;assert.equal(clinic.medicalProtection,false,'late illnesses require modern treatment');clinic.healthUntil=20;assert.ok(clinic.medicalProtection);
 s.strikeUntil=100;c.council('welfare');assert.equal(s.strikeUntil,0);
 passed('disabled backup power/stations stop working; modern illness needs hospital medicine; welfare ends strikes');
}
{
 function encounter(sequence,ward=false){
  const s=fresh();s.build('warehouse',11,12);s.build('well',10,12);s.build('house',9,8,true);s.money=2000;s.raidCount=sequence;
  const c={defense:0,routes:[{from:'test',to:'else',ambush:0}],recordBattle(){}};s.campaign=c;s.siteId='test';if(ward){s.build('magetower',10,10,true);const tower=s.buildings.find(b=>b.type==='magetower');tower.activeUntil=100;s.wardUntil=100;}
  const original=s.money;startRaid(s);assert.equal(s.money,original,'approaching enemies do not inflict instant damage');
  for(let i=0;i<265;i++){s.time+=.25;tickRaid(s,.25);for(const w of s.attackers.filter(w=>w.hp>0))assert.ok(s.walkable(Math.round(w.x),Math.round(w.z)),'enemy remains on walkable tiles');}
  return s;
 }
 const demon=encounter(0),orc=encounter(1),beast=encounter(2),ward=encounter(0,true);
 assert.equal(demon.raid.faction,'demon');assert.ok(demon.outageUntil>0);assert.ok(demon.raid.damage>0);
 assert.equal(orc.raid.faction,'orc');assert.ok(orc.raid.damage>0);
 assert.equal(beast.raid.faction,'beast');assert.equal(beast.campaign.routes[0].ambush,25);
 assert.equal(ward.raid.damage,0);assert.equal(ward.raid.defeated,3);assert.ok(ward.raid.finished);
 const s=fresh();s.build('warehouse',11,12);s.money=1000;s.stock.grain=10;startRaid(s);assert.ok(s.mobilize().ok);assert.equal(s.mobilize().ok,false);assert.equal(s.stock.grain,4);
 const restored=new Simulation(s.region,decodeSave(encodeSave(s.save())));assert.deepEqual(restored.raid,s.raid);assert.deepEqual(restored.attackers,s.attackers);
 passed('three raid factions use paths, delayed damage, wards, paid defense and persistent encounters');
}
{
 const c=new Campaign({demo:true}),r=c.routes[0],source=c.sites.find(v=>v.id===r.from).sim,destination=c.sites.find(v=>v.id===r.to).sim;
 const sourceStock=source.stock.steel,destStock=destination.stock.steel;c.tickRoute(r,.25);assert.equal(source.stock.steel,sourceStock-r.amount);assert.equal(destination.stock.steel,destStock);
 assert.ok(c.closeRoute(r.id).ok);assert.equal(c.routes.length,1);assert.ok(r.closing);
 const resumed=new Campaign({saved:decodeSave(encodeSave(c.save()))}),route=resumed.routes[0];resumed.tickRoute(route,route.remaining+1);
 assert.equal(resumed.home.sim.stock.steel,destStock+r.amount);assert.equal(resumed.routes.length,0);assert.equal(resumed.deliveries,1);
 for(let i=0;i<4;i++)for(const active of resumed.routes)resumed.tickRoute(active,60);assert.equal(resumed.deliveries,1);
 const paused=resumed.active.time;resumed.active.paused=true;run(resumed,10);assert.equal(resumed.active.time,paused);
 passed('closing an in-flight route preserves cargo through save/load and delivers exactly once; pause stops all sites');
}
{
 const c=new Campaign({demo:true});c.treasury.rank=25;const state=c.spawnState('estern','시험 자유공국');
 const order=c.stateOrder(state),s=c.active;const before=s.stock[order.item],money=s.money;assert.ok(c.stateAction('trade',state.id).ok);assert.equal(s.stock[order.item],before-order.amount);assert.equal(s.money,money+order.reward);assert.equal(c.stateAction('trade',state.id).ok,false);
 assert.ok(c.stateAction('aid',state.id).ok);assert.ok(c.stateAction('aid',state.id).ok);assert.ok(c.stateAction('pact',state.id).ok);assert.ok(c.stateAction('recognition',state.id).ok);assert.equal(c.stateAction('pact',state.id).ok,false);
 const unstable=c.spawnState('silvaen','시험 연방');unstable.age=13;unstable.wealth=5000;unstable.unrest=100;c.worldDay();const child=c.newStates.find(v=>v.parent===unstable.id);assert.ok(child);assert.equal(child.rootNation,'silvaen');assert.equal(c.stateOrigin(child),unstable.name);
 const save=c.save();assert.deepEqual(new Campaign({saved:decodeSave(encodeSave(save))}).save(),save);
 passed('emerging nations trade real stocks, gate pacts/recognition, grow and produce persistent successor states');
}
{
 const data=new Campaign({demo:true}).save(),raw=encodeSave(data);assert.deepEqual(decodeSave(raw),data);assert.deepEqual(decodeSave(JSON.stringify(data)),data);
 const envelope=JSON.parse(raw);envelope.game.treasury.money++;assert.throws(()=>decodeSave(JSON.stringify(envelope)));
 for(const mutate of [d=>d.treasury.money=NaN,d=>d.treasury.produced=null,d=>d.sites[0].simulation.buildings[0].type='unknown',d=>d.routes[0].from='missing',d=>d.sites[0].simulation.stock.wood=-3,d=>d.sites[0].simulation.workers[0].route=[{x:N+8,z:12}],d=>d.sites[0].simulation.rails=['-1,2']]){const broken=structuredClone(data);mutate(broken);assert.throws(()=>encodeSave(broken));}
 assert.throws(()=>decodeSave('{"__proto__": {"polluted": true}}'));assert.throws(()=>decodeSave('broken'));
 let current=raw;const storage={setItem(k,v){if(k===SAVE_KEY)current=v;},getItem(){return current;}};writeSave(storage,data);assert.deepEqual(decodeSave(current),data);
 const previous=current;assert.throws(()=>writeSave({setItem(){throw new Error('QuotaExceededError');},getItem(){return previous;}},data));assert.equal(current,previous);
 assert.throws(()=>writeSave({setItem(){},getItem(){return 'silently discarded';}},data));
 const legacy=new Simulation().save();legacy.version=4;assert.equal(new Campaign({saved:decodeSave(JSON.stringify(legacy))}).rank,0);
 passed('current/legacy saves round-trip; corrupt files, invalid paths and storage failures are rejected');
}
{
 for(const[type]of Object.entries(BUILDINGS))assert.ok(FILES[type],'sound mapping '+type);
 for(const filename of new Set(Object.values(FILES)))assert.ok(fs.statSync('public/assets/audio/'+filename+'.ogg').size>100);
 for(const name of new Set(Object.values(RACES).flatMap(r=>r.characters))){const buffer=fs.readFileSync('public/assets/characters/'+name+'.glb');assert.equal(buffer.toString('utf8',0,4),'glTF');const json=JSON.parse(buffer.toString('utf8',20,20+buffer.readUInt32LE(12)));assert.ok(json.skins?.length);for(const action of ['Idle','Walk','Walk_Carry'])assert.ok(json.animations.some(a=>a.name===action),name+' '+action);for(const mesh of json.meshes)for(const primitive of mesh.primitives)assert.ok(primitive.attributes.POSITION!==undefined);}
 passed('every facility has a sound; every referenced character has valid rigged GLB and movement clips');
}
console.log('QUALITY PASS',checks,'scenario groups');
