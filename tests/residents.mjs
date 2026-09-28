import assert from 'node:assert/strict';
import {Simulation,BUILDINGS} from '../src/app/game/simulation.js';
import {assignJob,canEnter} from '../src/app/game/logistics.js';
const run=(s,secs)=>{for(let i=0;i<secs*4;i++)s.tick(.25);};
const town=(race='human')=>{const s=new Simulation('river',null,{race});s.nextEvent=1e9;s.autoSell={};s.money=1e5;s.debt=0;return s;};

// The warehouse stores goods only; every house brings its own race.
const s=town();s.build('warehouse',10,12);assert.equal(s.workers.length,0);
assert.equal(s.build('house',9,14).ok,true);assert.deepEqual(s.workers.map(w=>w.race),['human'],'a new house holds one resident');
const home=s.at(9,14);s.stock.wood=0;assert.equal(s.upgrade(home.id).ok,false,'a house upgrade costs wood');s.stock.wood=20;
const paid=s.money;assert.equal(s.upgrade(home.id).ok,true);assert.equal(s.money,paid-60);assert.equal(s.workers.length,2);assert.equal(s.upgrade(home.id).ok,true);assert.equal(s.workers.length,3);assert.equal(s.upgrade(home.id).ok,false,'three residents is the most a house holds');
assert.ok(s.workers.every(w=>w.homeId===home.id)&&s.workers.some(w=>w.gender==='female')&&s.workers.some(w=>w.gender==='male'),'a full house mixes women and men');
assert.match(s.canBuild('dwarfhouse',11,14),/승급/,'dwarf houses unlock through rank');
s.rank=13;for(const r of ['plank','stone','gear'])s.stock[r]=100;
assert.equal(s.build('dwarfhouse',11,14).ok,true);assert.equal(s.build('titanhouse',12,14).ok,true);
assert.equal(s.workers.filter(w=>w.race==='dwarf').length,1);assert.equal(s.workers.filter(w=>w.race==='titan').length,1);
for(const w of s.workers){const h=s.buildings.find(b=>b.id===w.homeId);assert.ok(h&&Math.abs(h.x-w.x)+Math.abs(h.z-w.z)<=3,'residents step out of their own house');}
assert.equal(s.at(11,14).race,'dwarf','a dwarf house is built in dwarf style');
assert.equal(s.canBuild('spirithouse',13,14,true),'이 진영에는 정령 주민이 없습니다');assert.equal(BUILDINGS.faehouse,undefined,'spirits and fae share one house');

// Dwarves alone work the special workshops; titans stay out of high-intelligence sites but carry double.
const human=s.workers.find(w=>w.race==='human'),dwarf=s.workers.find(w=>w.race==='dwarf'),titan=s.workers.find(w=>w.race==='titan');
s.build('workshop',14,10,true);s.build('electronics',14,12,true);const shop=s.at(14,10),lab=s.at(14,12);
assert.equal(canEnter(s,'human',shop),false);assert.equal(canEnter(s,'dwarf',shop),true);
assert.equal(canEnter(s,'titan',lab),false);assert.equal(canEnter(s,'human',lab),true);assert.equal(canEnter(s,'titan',s.warehouse),true);
s.stock.plank=0;s.stock.stone=0;s.stock.steel=0;s.stock.mana=0;s.stock.wood=0;s.stock.water=0;s.stock.grain=0;s.stock.gear=0;
for(const w of s.workers)s.refundTask(w);
s.stock.plank=50;human.task=null;assignJob(s,human);assert.ok(!human.task||human.task.targetId!==shop.id,'humans do not supply the dwarf workshop');
dwarf.task=null;assignJob(s,dwarf);assert.equal(dwarf.task?.targetId,shop.id,'a dwarf supplies the dwarf workshop');
s.refundTask(dwarf);s.stock.plank=0;s.stock.steel=50;titan.task=null;assignJob(s,titan);assert.ok(!titan.task||titan.task.targetId!==lab.id,'titans skip high-intelligence work');
s.buildings=s.buildings.filter(b=>b.type!=='electronics');s.revision++;s.stock.steel=0;s.build('sawmill',12,10,true);s.at(12,10).out=20;
titan.task=null;human.task=null;assignJob(s,titan);assignJob(s,human);
assert.equal(titan.task?.amount,6,'titans carry twice as much');assert.equal(human.task?.amount,3);

// A special workshop without its crew says so instead of silently waiting.
const lone=town();lone.rank=14;lone.build('warehouse',10,12);lone.build('house',9,14);lone.build('steamworks',12,12,true);run(lone,1);
assert.equal(lone.at(12,12).status,'드워프 주민 필요');

// Elves follow the same pattern with their own houses.
const elf=town('elf');elf.build('warehouse',10,12);elf.build('house',9,14);assert.ok(elf.workers.length===1&&elf.workers.every(w=>w.race==='elf'));
elf.rank=10;assert.match(elf.canBuild('spirithouse',10,14),/승급/);elf.rank=13;for(const r of ['plank','stone','gear','steel','wood'])elf.stock[r]=100;
for(const [t,x] of [['spirithouse',10],['centaurhouse',11]])assert.equal(elf.build(t,x,14).ok,true,t);assert.equal(elf.upgrade(elf.at(10,14).id).ok,true);
assert.deepEqual([...new Set(elf.workers.map(w=>w.race))].sort(),['centaur','elf','fae','spirit'],'the spirit-fae house holds both kinds');
assert.deepEqual(BUILDINGS.spirithouse.cost,BUILDINGS.dwarfhouse.cost);assert.deepEqual(BUILDINGS.centaurhouse.materials,BUILDINGS.titanhouse.materials);
elf.build('manaextractor',13,10,true);elf.build('electronics',13,12,true);
for(const r of ['spirit','fae'])for(const t of [[13,10],[13,12]])assert.equal(canEnter(elf,r,elf.at(...t)),true,r);
assert.equal(canEnter(elf,'elf',elf.at(13,10)),false);assert.equal(canEnter(elf,'centaur',elf.at(13,12)),false);
const bare=town('elf');bare.rank=16;bare.build('warehouse',10,12);bare.build('house',9,14);bare.build('manaextractor',12,12,true);run(bare,1);assert.equal(bare.at(12,12).status,'정령 주민 필요');
assert.equal(elf.canBuild('dwarfhouse',13,14,true),'이 진영에는 드워프 주민이 없습니다');

// Demolishing a house sends its residents away and returns their cargo.
const before=s.workers.length;s.demolish(12,14);run(s,.25);assert.equal(s.workers.length,before-1);assert.ok(!s.workers.some(w=>w.race==='titan'));

// Saves keep residents and their homes; old saves get houses for the people they already had.
const saved=JSON.parse(JSON.stringify(s.save()));const back=new Simulation('river',saved);
assert.deepEqual(back.workers.map(w=>[w.id,w.race,w.homeId,w.name]),s.workers.map(w=>[w.id,w.race,w.homeId,w.name]));
const legacy=town();legacy.build('warehouse',10,12);legacy.build('house',9,14);const old=JSON.parse(JSON.stringify(legacy.save()));old.version=6;delete old.nextWorkerId;
old.buildings=old.buildings.filter(b=>b.type!=='house');for(let i=0;i<7;i++)old.workers.push({...old.workers[0],id:10+i,homeId:undefined,race:['human','dwarf','titan'][i%3],name:undefined});
old.workers.forEach(w=>delete w.homeId);const migrated=new Simulation('river',old);run(migrated,.25);
assert.ok(migrated.workers.length>=8,'the migrated town keeps its workforce');assert.ok(migrated.workers.every(w=>w.homeId&&w.race==='human'));
assert.ok(migrated.buildings.filter(b=>BUILDINGS[b.type].home).every(b=>b.level===3));
// v7 houses held several people at level 1; they are raised to the level that keeps everyone.
const v7=town();v7.build('warehouse',10,12);v7.build('house',9,14);const seven=JSON.parse(JSON.stringify(v7.save()));seven.version=7;const h7=seven.buildings.find(b=>b.type==='house');
for(let i=1;i<3;i++)seven.workers.push({...seven.workers[0],id:40+i});const kept=new Simulation('river',seven);run(kept,.25);
assert.equal(kept.buildings.find(b=>b.id===h7.id).level,3);assert.equal(kept.workers.length,3);
console.log('RESIDENTS PASS');
