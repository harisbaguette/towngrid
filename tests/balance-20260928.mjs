// Regression checks for the 2026-09-28 balance patch (docs/BALANCE_PATCH_20260928.md) and the
// simulation-side audit fixes (docs/AUDIT_20260928.md). Headless; only public game APIs and real ticks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Simulation,RESOURCES,BUILDINGS,createShowcase} from '../src/app/game/simulation.js';
import {Campaign} from '../src/app/game/campaign.js';
import {RANKS,RACES,unlockRank} from '../src/app/game/world.js';
import {encodeSave,decodeSave} from '../src/app/game/persistence.js';
import {operationHint} from '../src/app/game/proximity.js';
import {startRaid} from '../src/app/game/encounters.js';
import {FILES} from '../src/app/game/audio.js';
// Terminals and networks came after the patch; they join the rank lists without changing the patched ones.
import {INFRA_BUILDINGS} from '../src/app/game/infrastructure.js';
const run=(s,t)=>{for(let i=0;i<t*4;i++)s.tick(.25);};
const town=(region='river')=>{const s=new Simulation(region);s.nextEvent=1e9;s.autoSell={};s.money=1e6;s.debt=0;for(const r of Object.keys(RESOURCES))s.stock[r]=50;s.build('warehouse',11,12);s.build('house',11,14);return s;};
const patch=JSON.parse(fs.readFileSync(new URL('../docs/balance/patch-20260928.json',import.meta.url),'utf8'));

// Data: every patched resource, facility and rank is in the code with the patched values.
for(const [id,d] of Object.entries(patch.resources.add))assert.deepEqual(RESOURCES[id],d,id);
for(const [id,d] of Object.entries(patch.resources.change))for(const [k,v] of Object.entries(d))assert.equal(RESOURCES[id][k],v,id+'.'+k);
for(const [id,d] of Object.entries(patch.buildings.add))for(const [k,v] of Object.entries(d))if(k!=='description')assert.deepEqual(BUILDINGS[id][k],v,id+'.'+k);
for(const [id,d] of Object.entries(patch.buildings.change))for(const [k,v] of Object.entries(d))assert.deepEqual(BUILDINGS[id][k],v,id+'.'+k);
assert.equal(RANKS.length,33);patch.ranks.table.forEach((r,i)=>{assert.equal(RANKS[i].name,r.name);assert.equal(RANKS[i].fee,r.fee);assert.deepEqual(RANKS[i].unlocks.filter(t=>!INFRA_BUILDINGS[t]),r.unlocks);assert.deepEqual(RANKS[i].requirements,r.requirements,'rank '+i);});
assert.equal(unlockRank('quarry'),0,'the quarry is a starting facility');
assert.equal(Object.keys(RESOURCES).length,36);assert.equal(Object.keys(BUILDINGS).filter(t=>!INFRA_BUILDINGS[t]).length,69);

// M1 water mill makes power with no fuel; M2 its water reach is 2 tiles and the message names it.
{const s=town();s.rank=10;const far=s.canBuild('watermill',11,9);assert.equal(far,'강이나 바다에서 2칸 이내에 놓으세요');const t=s.tiles.find(t=>s.ownedAt(t.x,t.z)&&t.x===15&&!s.at(t.x,t.z)&&s.canBuild('watermill',t.x,t.z)===null);assert.ok(t,'a riverside tile takes a water mill');s.build('watermill',t.x,t.z);run(s,40);assert.equal(s.power,true);}
// M3 cotton by the river skips its water input like wheat.
{const s=town();s.rank=3;const t=s.tiles.find(t=>s.ownedAt(t.x,t.z)&&t.x===15&&!s.at(t.x,t.z)&&s.canBuild('cottonfield',t.x,t.z)===null);s.build('cottonfield',t.x,t.z);const b=s.at(t.x,t.z);assert.deepEqual(s.effectiveInputs(b),{});assert.ok(s.tileMultiplier('cottonfield',t.x,t.z)!==1);}
// M4 wards read their radius from data; facilities inside take no raid damage and demons cannot cut power while a ward holds.
{const s=createShowcase();s.nextEvent=1e9;run(s,50);const tower=s.buildings.find(b=>b.type==='magetower');assert.ok(tower.activeUntil>s.time&&s.wardUntil>s.time);
 s.raidCount=0;startRaid(s);const hp=Object.fromEntries(s.buildings.map(b=>[b.id,b.health]));for(let i=0;i<280&&!s.raid.finished;i++)s.tick(.25);
 assert.equal(s.raid.disrupted,false,'no demon power cut under an active ward');assert.ok(s.buildings.filter(b=>Math.hypot(b.x-tower.x,b.z-tower.z)<BUILDINGS.magetower.wardRadius).every(b=>b.health>=hp[b.id]),'no damage inside the ward');}
// Timed effects restart one period early, so a supplied ward never lapses.
{const s=createShowcase();s.nextEvent=1e9;const tower=s.buildings.find(b=>b.type==='magetower');let gaps=0,started=false;for(let i=0;i<4*200;i++){s.tick(.25);if(tower.activeUntil>s.time)started=true;else if(started&&(tower.inputs.mana||0)>=2)gaps++;}assert.equal(gaps,0);}
// M5 transit factor: both ends need a running transit facility; the slower factor applies.
{const c=new Campaign({demo:true}),[a,b]=c.sites.map(v=>v.sim);for(const [sim,type] of [[a,'airdock'],[b,'leyrelay']]){sim.rank=30;const t=sim.tiles.find(t=>sim.canBuild(type,t.x,t.z,true)===null);sim.build(type,t.x,t.z,true);const f=sim.buildings.at(-1);f.activeUntil=sim.time+60;}
 const r=c.routes[0],from=c.sites.find(v=>v.id===r.from).sim;from.stock[r.item]=100;c.treasury.money=1e5;c.tickRoute(r,.1);assert.equal(r.cargo,r.amount,r.status);assert.ok(Math.abs(r.duration-(r.mode==='rail'?24:48)*.8)<1e-9,'the slower of the two factors applies: '+r.duration);}
// M6 marketplace speeds price recovery; M8 the exchange adds two export carts and saves still validate.
{const s=town();s.market.pressure.wood=50;run(s,10);const plain=s.market.pressure.wood;const m=town();m.rank=6;m.build('marketplace',13,12);m.market.pressure.wood=50;run(m,10);assert.ok(m.market.pressure.wood<plain);
 const e=town();e.rank=31;e.stock.wood=300;const t=e.tiles.find(t=>e.canBuild('exchange',t.x,t.z,true)===null);e.build('exchange',t.x,t.z,true);// Second pass: the exchange's two extra vehicles are fuel vehicles (docs/BALANCE_PATCH_20260928.md 12-4), so they run only on spare fuel.
 const fuel=e.stock.fuel;e.stock.fuel=0;assert.equal(e.exportStatus().carts,3,'without fuel only the free three run');e.stock.fuel=fuel;
 assert.equal(e.exportStatus().carts,7);for(let i=0;i<7;i++)assert.ok(e.sell('wood',1).ok);assert.equal(e.sell('wood',1).ok,false);assert.equal(e.stock.fuel,fuel-4,'each fuel vehicle burns one fuel');assert.equal(decodeSave(encodeSave(e.save())).shipments.length,7);}
// M7 a parliament in any site lowers every site's unrest by 2 a day.
{const c=new Campaign({demo:true});const [a]=c.sites.map(v=>v.sim);for(const site of c.sites){site.unrest=50;}c.worldDay();const base=c.sites.map(v=>v.unrest);for(const site of c.sites)site.unrest=50;a.build('parliament',6,18,true);c.worldDay();c.sites.forEach((v,i)=>assert.equal(v.unrest,base[i]-2));}
// M10 crews and M11 sounds.
assert.ok(RACES.dwarf.crafts.includes('mithrilforge')&&RACES.dwarf.crafts.includes('blastfurnace')&&RACES.spirit.crafts.includes('lampworks')&&BUILDINGS.engineworks.skilled);
assert.deepEqual(Object.keys(BUILDINGS).filter(t=>!FILES[t]),[],'every facility has a sound');

// Constants: upgrades need bricks at 2→3, repairs scale with cost, land cost grows, new-game auto-sale, clinic herbs.
{const s=town();s.rank=8;const b=s.buildings.find(b=>b.type==='house');s.stock.wood=10;assert.ok(s.upgrade(b.id).ok);s.stock.brick=0;assert.equal(s.upgrade(b.id).ok,false);s.stock.brick=3;assert.ok(s.upgrade(b.id).ok);
 const yard={type:'shipyard',health:0};assert.equal(s.repairCost(yard),900);assert.equal(s.repairCost({type:'well',health:50}),25);
 s.expansions=10;s.rank=0;assert.equal(s.expansionCost(),2580);
 assert.deepEqual(new Simulation().autoSell,{bread:true,cake:true,smokedfish:true,fish:false,gear:false});}
{const s=town();s.rank=4;s.build('clinic',13,12);s.health.infection=50;s.health.nextCare=0;s.stock.herb=5;s.stock.water=5;run(s,1);assert.equal(s.stock.herb,4,'the clinic treats with herbs');}
// Contracts ask only for items with an unlocked producer.
for(let rank=0;rank<33;rank++){const s=new Simulation();s.rank=rank;for(let n=0;n<4;n++){s.contracts=n;const it=s.contract().item;assert.ok(Object.keys(BUILDINGS).some(t=>BUILDINGS[t].output===it&&unlockRank(t)<=rank),rank+':'+it);}}

// Audit fixes. E1 storms: partial damage early, not always the first or sole building.
{const hits=new Set();for(let seed=0;seed<8;seed++){const s=town();s.seed=seed;s.build('well',13,12);s.build('field',13,13);s.build('lumber',9,10);s.build('quarry',14,9);s.pendingEvent={type:'storm',at:s.time};s.resolveEvent();const hit=s.buildings.filter(b=>b.health<100);assert.equal(hit.length,1);assert.ok(hit[0].health>0,'an early storm never stops a facility');hits.add(hit[0].type);}assert.ok(hits.size>1,'the storm target varies');}
// T1: while the raid trial is pending the home site's next event is a raid.
{const s=town();s.rank=22;assert.equal(s.chooseEvent(),'raid');const c=new Campaign({demo:true});c.battles=[{defeated:0,damage:0}];c.home.sim.rank=22;assert.equal(c.home.sim.promotion().trial.done,true,'a raid that ends without damage counts as repelled');}
// H1/V1/H2: advice names only what can be built now.
{const s=town();assert.ok(!/물류센터/.test(operationHint('운반 대기',s))&&!/자재 보관소/.test(operationHint('창고 가득 참',s)));s.rank=12;assert.match(operationHint('운반 대기',s),/물류센터/);assert.match(operationHint('드워프 주민 필요'),/드워프 주택/);}
// Y1: a sapling grows exactly when its timer ends.
{const s=town();const t=s.tiles.find(t=>s.ownedAt(t.x,t.z)&&!t.nature&&!s.at(t.x,t.z)&&!s.roads.has(t.x+','+t.z));s.plant(t.x,t.z);const due=t.growAt;while(t.nature==='sapling')s.tick(.25);assert.ok(s.time-due<=.25);}
// M3 audit: emergency loans are gone.
assert.equal(typeof new Simulation().emergency,'undefined');

// Saves written before the patch still load, run and re-save (version 8, RANKS length 33).
{const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/save-before-20260928.json',import.meta.url),'utf8'));
 for(const key of ['demo','early']){const c=new Campaign({saved:decodeSave(fixture[key])});for(let i=0;i<4*120;i++)c.tick(.25);const again=decodeSave(encodeSave(c.save()));assert.ok(again.sites.every(v=>v.simulation.version===8));
  const s=c.home.sim;assert.ok(Object.keys(RESOURCES).every(r=>Number.isFinite(s.stock[r])),'new resources start at zero');
  if(key==='early'){assert.equal(s.exportStatus().connected,false,'an old building on the choke tile stays');assert.equal(s.autoSell.fish,true,'old auto-sale settings are kept');s.stock.fish=100;const n0=s.notices.length;for(let i=0;i<40;i++)c.tick(.25);assert.equal(s.notices.slice(n0).filter(n=>n.text.startsWith('자동 판매 멈춤')).length,1,'a blocked auto-sale warns once');}}}
console.log('PASS balance patch 2026-09-28: data, M1~M11, constants, contracts, storm, raid trial, advice, sapling, old saves');
