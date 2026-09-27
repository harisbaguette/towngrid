import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Simulation,BUILDINGS} from '../app/game/simulation.js';
import {NATIONS,RACES,RANKS,FACTIONS,factionOf} from '../app/game/world.js';
const run=(s,t)=>{for(let i=0;i<t*4;i++)s.tick(.25);};
// Starting landscape changes waterways; a field's multiplier belongs to its tile.
const inland=new Simulation('river'),coast=new Simulation('coast');
assert.equal(inland.tileMultiplier('field',10,10),coast.tileMultiplier('field',10,10));
assert.notEqual(inland.tileMultiplier('field',10,10),inland.tileMultiplier('field',11,10));
const elf=new Simulation('river',null,{nation:'silvaen',race:'elf'}),human=new Simulation('river');
assert.equal(elf.countryMultiplier('sawmill'),1.12);assert.equal(human.countryMultiplier('sawmill'),1);
const humanSale=human.sell('wood',1),elfSale=elf.sell('wood',1);assert.ok(humanSale.revenue>elfSale.revenue);
const orc=new Simulation('highland',null,{nation:'urkan',race:'orc'});assert.ok(orc.buildCost('warehouse')<human.buildCost('warehouse'));
for(const [nation,n]of Object.entries(NATIONS).filter(([,n])=>n.playable)){const s=new Simulation(n.region,null,{nation,race:n.race});assert.equal(s.build('warehouse',10,12).ok,true);assert.ok(s.workers.every(w=>FACTIONS[factionOf(n.race)].members.includes(w.race)&&w.name));assert.ok(FACTIONS[factionOf(n.race)].members.includes(s.buildings[0].race));const restored=new Simulation(s.region,s.save());assert.equal(restored.nation,nation);assert.equal(restored.race,n.race);}
// A fresh game must earn its first promotions through real production and delivery.
const early=new Simulation();early.nextEvent=99999;assert.equal(early.build('mill',13,10).ok,false);early.build('warehouse',10,12);early.build('house',9,14);early.build('well',10,10);early.build('field',9,10);early.build('field',9,11);early.build('lumber',10,8);run(early,150);assert.equal(early.promotion().ready,true);assert.equal(early.promote().ok,true);assert.equal(early.rank,1);assert.equal(early.promote().ok,false,'the next status needs paid deliveries, not just waiting');assert.equal(early.fulfill().ok,true);assert.equal(early.fulfill().ok,true);assert.equal(early.promote().ok,true);assert.equal(early.rank,2);
const c=early.contract();early.autoSell[c.item]=true;early.stock[c.item]=c.amount;early.paused=false;early.salesTimer=8;early.tick(.01);assert.ok(early.stock[c.item]>=c.amount,'autoselling preserves the current contract');
early.pendingEvent={type:'storm',at:early.time+20};early.money=300;early.stock.wood=10;assert.equal(early.reinforce().ok,true);early.resolveEvent();assert.ok(early.buildings.every(b=>b.health>0));
// Cancelling an uncollected cargo job must leave stock at the producing facility.
const source=early.buildings.find(b=>b.type==='field'),worker=early.workers[0];worker.task={kind:'pickup',building:source.id,item:'grain',amount:2};worker.phase='source';const oldStock=early.stock.grain,oldOut=source.out;early.refundTask(worker);assert.equal(early.stock.grain,oldStock);assert.equal(source.out,oldOut+2);
for(const race of Object.values(RACES))for(const name of race.characters){const b=fs.readFileSync('public/assets/characters/'+name+'.glb');assert.equal(b.toString('utf8',0,4),'glTF');const len=b.readUInt32LE(12),j=JSON.parse(b.toString('utf8',20,20+len));for(const action of ['Idle','Walk','Walk_Carry'])assert.ok(j.animations.some(a=>a.name===action),name+action);}
for(const n of ['bookPlace1','chop','handleCoins','footstep00','metalPot1','creak1'])assert.ok(fs.statSync('public/assets/audio/'+n+'.ogg').size>100);
assert.equal(RANKS.length,33);console.log('PASS: tile yields, country effects, two playable alliances and mixed residents, earned promotions, contract reservations, storm protection, cargo conservation, rigged character assets and audio assets.');
