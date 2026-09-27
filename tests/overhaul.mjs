import assert from 'node:assert/strict';
import {Simulation,BUILDINGS,createShowcase} from '../app/game/simulation.js';
import {CONTINENTS,NATIONS,FACTIONS,factionOf} from '../app/game/world.js';
import {Campaign} from '../app/game/campaign.js';
import {encodeSave,decodeSave} from '../app/game/persistence.js';
const run=(s,t)=>{for(let i=0;i<t*4;i++)s.tick(.25);};
assert.equal(CONTINENTS.length,1);assert.equal(new Set(Object.values(NATIONS).map(n=>n.continent)).size,1);assert.equal(Object.keys(NATIONS).length,30);
for(const alliance of ['human','elf']){const s=new Simulation('river',null,{race:alliance});for(const [i,type]of ['warehouse','well','field','house','lumber','quarry'].entries())s.build(type,9+i,12,true);assert.ok(s.buildings.every(b=>FACTIONS[alliance].members.includes(b.race)));assert.ok(s.workers.length===1&&s.workers.every(w=>w.race===FACTIONS[alliance].members[0]),'the starter house holds the base race; other members arrive through their own houses');}
console.log('PASS single continent and two mixed playable alliances');
{
 const s=new Simulation();s.nextEvent=999999;s.build('warehouse',14,12,true);s.build('field',16,10,true);s.owned.add('16,10');s.build('field',16,10,true);
 const b=s.at(16,10);assert.ok(b);const water=s.tiles.find(t=>t.terrain==='water'&&Math.max(Math.abs(t.x-b.x),Math.abs(t.z-b.z))<=2);assert.ok(water);
 assert.equal(s.placementEffects('field',b.x,b.z).water,1);assert.deepEqual(s.effectiveInputs(b),{});s.stock.water=0;run(s,70);assert.ok(s.produced.grain>0,'passive irrigation produces without water stock');
 const coast=new Simulation('coast');assert.equal(coast.placementEffects('field',16,10).water,0,'seawater does not irrigate wheat');
 const clean=new Simulation();const before=clean.placementEffects('field',12,12);clean.build('smelter',13,12,true);const after=clean.placementEffects('field',12,12);assert.ok(after.pollution>before.pollution&&after.speed<before.speed);assert.ok(clean.placementEffects('mill',12,12).windBlock>0);clean.buildings[0].enabled=false;assert.equal(clean.placementEffects('field',12,12).pollution,0);assert.ok(clean.placementEffects('field',12,12).shade>0,'a stopped building still casts shade');
 console.log('PASS fresh-water irrigation, seawater exclusion, pollution, shade and wind block');
}
{
 const s=new Simulation();s.build('warehouse',10,12,true);s.build('generator',10,10,true);s.warehouse.enabled=true;s.buildings[1].activeUntil=200;s.build('refinery',12,12,true);const b=s.at(12,12);b.inputs={oil:9,water:3};run(s,1);assert.equal(b.status,'도로 연결 필요');s.build('road',12,11,true);run(s,2);assert.equal(b.working,true);assert.ok(b.progress>0);
 s.stock.oil=240;s.rank=32;assert.equal(s.buy('oil',1).ok,false);s.build('depot',14,12,true);assert.equal(s.storageCapacity,360);assert.equal(s.buy('oil',1).ok,true);
 const field=s.build('field',11,14,true);s.at(11,14).out=10;s.stock.grain=360;for(const w of s.workers)s.refundTask(w);run(s,1);assert.equal(s.at(11,14).out,10,'full warehouse does not reserve unstoreable cargo');
 console.log('PASS road-gated industry and storage limits preserve production cargo');
}
{
 const c=new Campaign({demo:true}),r=c.routes[0],to=c.home.sim;r.cargo=12;r.remaining=.1;r.duration=24;to.stock[r.item]=to.storageCapacity;c.tick(.25);assert.equal(r.cargo,12);assert.equal(r.status,'도착지 창고 가득 참');to.stock[r.item]-=12;c.tick(.25);assert.equal(r.cargo,0);assert.ok(to.stock[r.item]<=to.storageCapacity);
 const raw=encodeSave(c.save()),legacy=JSON.parse(raw);legacy.format='orvetharn';assert.deepEqual(decodeSave(JSON.stringify(legacy)),decodeSave(raw));assert.equal(JSON.parse(raw).format,'erdynth');
 console.log('PASS freight waits for capacity and old-branded saves remain loadable');
}
assert.ok(Object.values(BUILDINGS).every(d=>d.size===1));console.log('OVERHAUL PASS');
