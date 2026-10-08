// Regression checks for the second balance pass (docs/BALANCE_PATCH_20260928.md 12): alternative products,
// contracts and imports carried by export vehicles, the fuel fleet, disease spread and storm damage.
// Headless; only public game APIs and real ticks. Where a check sets state directly it says so.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Simulation,BUILDINGS,RESOURCES,CONTRACT_WAIT,CONTRACT_PREMIUM,stormDamage} from '../src/app/game/simulation.js';
import {Campaign} from '../src/app/game/campaign.js';
import {encodeSave,decodeSave} from '../src/app/game/persistence.js';
import {fleet,waterRoute,VEHICLES,FUEL_FREE,FUEL_PER_TRIP} from '../src/app/game/export-route.js';
import {INFECTION_SPREAD} from '../src/app/game/living-economy.js';
const run=(s,t)=>{for(let i=0;i<t*4;i++)s.tick(.25);};
const until=(s,cond,limit=120)=>{for(let i=0;i<limit*4&&!cond();i++)s.tick(.25);return cond();};
const town=(region='river')=>{const s=new Simulation(region);s.nextEvent=1e9;s.autoSell={};s.build('warehouse',10,12);s.build('house',11,14);return s;};
const reload=s=>new Simulation(s.region,decodeSave(encodeSave(s.save())));

// 1. Products. Every producer lists its products and the first one is the facility's own definition.
for(const [id,d] of Object.entries(BUILDINGS))if(d.period){const r=d.recipes[0];assert.deepEqual([r.output,r.amount,r.period,r.inputs],[d.output,d.amount,d.period,d.inputs||{}],id);}
const multi=Object.keys(BUILDINGS).filter(t=>BUILDINGS[t].recipes?.length>1);assert.ok(multi.length>=10,'at least ten facilities make more than one product: '+multi.length);
{const s=town();s.money=1e5;for(const r of Object.keys(RESOURCES))s.stock[r]=['flour','water','wood','egg'].includes(r)?60:0;/* ingredients set directly, within storage capacity so returned ingredients can be hauled */s.rank=6;s.build('bakery',13,12,true);const b=s.at(13,12);
 assert.equal(s.recipeOf(b).output,'bread','a facility starts on its first product');
 assert.match(s.setRecipe(b.id,'cake').error,/승급이 필요합니다/,'a locked product is refused');assert.equal(s.recipeOf(b).output,'bread');
 assert.equal(s.setRecipe(b.id,'nothing').ok,false);assert.equal(s.setRecipe(s.warehouse.id,'cake').ok,false,'a facility without products cannot switch');
 // Mid-cycle switch: the cycle's consumed inputs, the finished bread on the pad and loaded water/wood return to the warehouse.
 assert.ok(until(s,()=>b.progress>0.3),'the bakery is mid-cycle');assert.ok(b.batch);b.out+=5;/* pad set directly */
 const carried=r=>s.workers.reduce((n,w)=>n+(w.task?.carried&&w.task.item===r?w.task.amount:0),0);
 const before=Object.fromEntries(['flour','water','wood','bread'].map(r=>[r,s.stock[r]+(b.inputs[r]||0)+(b.batch[r]||0)+(r==='bread'?b.out:0)+carried(r)]));
 s.rank=7;assert.ok(s.setRecipe(b.id,'cake').ok);assert.equal(b.progress,0);assert.equal(b.out,0);assert.equal(b.batch,undefined);
 for(const r of ['water','wood','bread','flour'])assert.equal(s.stock[r]+(b.inputs[r]||0)+(b.returnStock?.[r]||0)+carried(r),before[r],r+' is kept at the facility until hauled');
 assert.equal(b.inputs.water,undefined,'inputs the cake does not use leave the bakery');
 const cakes=s.produced.cake||0;run(s,60);assert.ok((s.produced.cake||0)>cakes,'the bakery bakes cakes');assert.ok(s.workers.every(w=>!w.task||w.task.targetId!==b.id||['flour','egg'].includes(w.task.item)),'residents haul only cake ingredients to it');
 // The choice is saved; an unknown product id in a save is refused; a save without a choice uses the first product.
 assert.equal(reload(s).recipeOf(reload(s).at(13,12)).output,'cake');
 const bad=s.save();bad.buildings.find(v=>v.id===b.id).recipe='gold';assert.throws(()=>encodeSave(bad));
 const old=s.save();delete old.buildings.find(v=>v.id===b.id).recipe;assert.equal(new Simulation(s.region,decodeSave(encodeSave(old))).recipeOf({type:'bakery'}).output,'bread');}

// 2. Contracts go out on an export vehicle, are paid once on arrival, and the next order waits CONTRACT_WAIT seconds.
{const s=town();s.stock.grain=100;s.stock.wood=100;/* stock set directly */const c=s.contract(),money=s.money;
 assert.equal(c.reward,Math.round(c.amount*RESOURCES[c.item].price*CONTRACT_PREMIUM[0]));assert.equal(s.contractStatus().ready,true);
 assert.ok(s.fulfill().ok);assert.equal(s.money,money,'no payment before arrival');assert.equal(s.contracts,0);assert.equal(s.stock[c.item],100-c.amount);
 const sh=s.shipments.find(v=>v.kind==='contract');assert.ok(sh&&sh.amount===c.amount&&sh.revenue===c.reward);
 const st=s.contractStatus();assert.equal(st.ready,false);assert.equal(st.inTransit,true);assert.equal(s.fulfill().ok,false,'a second order cannot leave in the same tick');
 // Saved on the road: each timeline pays exactly once.
 const loaded=reload(s);
 for(const t of [s,loaded]){assert.ok(until(t,()=>t.contracts===1),'the order arrives');assert.equal(t.money,money+c.reward);assert.equal(t.sold[c.item],c.amount);run(t,30);assert.equal(t.contracts,1);assert.ok(t.money>=money+c.reward-t.wage&&t.money<=money+c.reward,'no second payment');
  const w=t.contractStatus();assert.equal(w.ready,false);assert.ok(w.wait>0&&w.wait<=CONTRACT_WAIT);assert.ok(until(t,()=>t.contractStatus().ready,CONTRACT_WAIT+2),'the next order opens after the wait');}}
// A campaign shares the contract count and timer across sites: an order on the road from one site blocks the others.
{const c=new Campaign({demo:true});const [a,b]=c.sites.map(v=>v.sim);for(const s of [a,b]){s.stock.car=10;s.stock.circuit=50;s.stock.medicine=50;s.stock.canned=50;}/* stock set directly */
 const k=a.contract();if(a.availableStock(k.item)<k.amount)a.stock[k.item]=k.amount;assert.ok(a.fulfill().ok,a.contractStatus().error);assert.equal(b.contractStatus().inTransit,true);assert.equal(b.fulfill().ok,false);}

// 3. Imports are paid when ordered and stocked when the vehicle is back at the warehouse, exactly once across a save.
{const s=town();const money=s.money,stone=s.stock.stone,r=s.buy('stone',5);assert.ok(r.ok&&r.incoming);assert.equal(s.money,money-r.cost);assert.equal(s.stock.stone,stone,'nothing arrives at once');
 assert.equal(s.shipments.at(-1).kind,'import');const loaded=reload(s);
 for(const t of [s,loaded]){assert.ok(until(t,()=>!t.shipments.length),'the import comes back');assert.equal(t.stock.stone,stone+5);run(t,10);assert.equal(t.stock.stone,stone+5);}
 const bare=new Simulation('river');assert.ok(bare.buy('stone',5).ok,'the mini store receives imports without a warehouse');assert.ok(until(bare,()=>!bare.shipments.length));assert.equal(bare.starterStore.inventory.stone,35);}

// 4. Every map starts with one fueled truck; later vehicles carry more and run faster.
{const river=town('river'),high=town('highland');for(const s of [river,high])assert.deepEqual(fleet(s).map(v=>v.kind),['van']);
 const w=waterRoute(river),end=w.at(-1);assert.equal(river.tile(end.x,end.z).terrain,'water');assert.ok(end.x===0||end.z===0||end.x===23||end.z===23);
 const st=river.exportStatus();assert.equal(st.fuelFree,0);assert.ok(st.fuelPerTrip>=1);assert.ok(st.fuelReady);}
{const s=town('highland');s.stock.wood=300;s.stock.fuel=0;s.reserves.fuel=0;assert.match(s.sell('wood',5).error,/연료/);
 s.stock.fuel=10;assert.ok(s.sell('wood',1).ok);s.rank=14;const lot=s.tradeConnection().capacity,r=s.sell('wood',200);assert.ok(r.ok);
 const truck=s.shipments.at(-1);assert.equal(truck.vehicle,'truck');assert.equal(truck.amount,lot*VEHICLES.truck.load);assert.equal(s.stock.fuel,10-2*s.exportStatus().fuelPerTrip);
 s.stock.fuel=5;s.reserves.fuel=5;assert.equal(s.sell('wood',5).ok,false,'reserved fuel is not burned');
 const race=town('highland');race.stock.wood=100;race.stock.fuel=10;race.reserves.fuel=0;race.sell('wood',1);race.rank=14;race.sell('wood',1);
 const legs={};for(let i=0;i<400&&Object.keys(legs).length<2;i++){race.tick(.25);for(const v of race.shipments)if(v.phase==='back'&&!legs[v.vehicle])legs[v.vehicle]=race.time;}assert.ok(legs.truck<legs.van);
 assert.equal(decodeSave(encodeSave(s.save())).shipments.filter(v=>v.vehicle==='truck').length,1);}

// 5. State trade leaves on a vehicle too and is paid on arrival.
{const c=new Campaign({demo:true}),s=c.active;const state=c.spawnState('estern','시험 공국');assert.ok(state,'a new state to trade with');{state.relation=80;state.wealth=1e6;const o=c.stateOrder(state);s.stock[o.item]=Math.max(s.stock[o.item],o.amount);/* stock set directly */const money=s.money;
 assert.ok(c.stateAction('trade',state.id).ok);assert.equal(s.money,money,'no payment before arrival');assert.equal(s.shipments.at(-1).kind,'state');assert.ok(until(s,()=>s.money>=money+o.reward-5));}}

// 6. Disease spreads with the infected share; 7. storms grow with the town.
{const s=town();s.health.infection=32;/* set directly */run(s,80);assert.ok(Math.abs(s.health.infection-48)<3,'32 → about 48 after a day: '+s.health.infection);
 const t=town();t.health.infection=2;run(t,80);assert.ok(t.health.infection<4,'a trace barely grows: '+t.health.infection);assert.ok(INFECTION_SPREAD>0);}
assert.deepEqual([stormDamage(1),stormDamage(4),stormDamage(5),stormDamage(12),stormDamage(13)],[30,30,60,60,80]);

// Saves written before the second pass still load and run.
{const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/save-before-20260928.json',import.meta.url),'utf8'));for(const key of ['demo','early']){const c=new Campaign({saved:decodeSave(fixture[key])});for(let i=0;i<4*60;i++)c.tick(.25);const again=decodeSave(encodeSave(c.save()));assert.ok(again.sites.length>=1);assert.ok(c.home.sim.contractStatus().wait>=0);}}
console.log('PASS second pass 2026-09-28: products, contract and import transport, vehicles and fuel, state trade, disease, storm, old saves');
