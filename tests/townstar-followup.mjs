import assert from 'node:assert/strict';
import {Simulation,RESOURCES,BUILDINGS} from '../src/app/game/simulation.js';
import {Campaign} from '../src/app/game/campaign.js';
import {capacity,freeSpace,deposit,withdraw} from '../src/app/game/storage.js';
import {purchaseShort} from '../src/app/game/economy.js';
import {tickShipments} from '../src/app/game/export-route.js';
import {freightPlan} from '../src/app/game/freight-storage.js';
import {gridAllocation,powerSupply,powerDemand} from '../src/app/game/power-grid.js';
import {tradeDestinations,chooseTradeDestination} from '../src/app/game/trade-journey.js';
import {describeFacility} from '../src/app/game/production-visuals.js';
import {createIndustryTrial,trialState,recordIndustryTrial,INDUSTRY_TRIALS,TRIAL_RECORDS_KEY} from '../src/app/game/industry-trials.js';
import {encodeSave,decodeSave} from '../src/app/game/persistence.js';
const empty=s=>{for(const k of Object.keys(RESOURCES))s.stock[k]=0;s.autoSell={};s.nextEvent=1e9;};
const fresh=()=>{const s=new Simulation('river');empty(s);s.money=1e5;return s;};
const put=(s,type,x,z)=>{const p=x===undefined?s.tiles.find(p=>!s.canBuild(type,p.x,p.z,true)):{x,z};assert.ok(p,type);const r=s.build(type,p.x,p.z,true);assert.ok(r.ok,r.error);return s.at(p.x,p.z);};
const reload=s=>new Simulation(s.region,decodeSave(encodeSave(s.save())));
const reloadCampaign=c=>new Campaign({saved:decodeSave(encodeSave(c.save()))});
const run=(s,seconds)=>{for(let i=0;i<seconds*4;i++)s.tick(.25);};
const travel=s=>{for(let i=0;i<4000&&s.shipments.length;i++)tickShipments(s,.25);};

// A contract larger than the van starts with only the current load, then pays its exact total after reload.
{let s=fresh();s.contracts=1;s.contractOrder={n:1,item:'grain'};s.stock.grain=10;s.stock.fuel=20;const order=s.contract(),cash=s.money;
 assert.ok(order.amount>10);assert.equal(s.contractStatus().error,undefined);assert.ok(s.fulfill().ok);travel(s);assert.equal(s.contract().amount,order.amount-10);
 s=reload(s);s.stock.grain=s.contract().amount;assert.ok(s.fulfill().ok);travel(s);assert.equal(s.contracts,2);assert.equal(s.money,cash+order.reward);}

// A real carried load waits beside full stores, survives reload, walks home and is credited only once.
for(const demolishHome of [false,true]){let s=fresh();const h=put(s,'house',10,14),m=put(s,'sawmill',12,12);s.stock.wood=10;let w;
 for(let i=0;i<300;i++){s.tick(.25);w=s.workers.find(w=>w.task?.carried&&w.task.targetId===m.id&&Math.hypot(w.x-7,w.z-11)>2);if(w)break;}
 assert.ok(w);const amount=w.task.amount,id=w.id,wood=s.stock.wood;s.stock.stone=s.storageCapacity-s.storageUsed;
 assert.ok(s.setOperation(m.id,false).ok);if(demolishHome)assert.ok(s.demolish(h.x,h.z).ok);
 assert.equal(s.stock.wood,wood);assert.equal(w.task.kind,'return');run(s,8);assert.equal(s.stock.wood,wood);assert.equal(s.storageUsed,160);
 s=reload(s);w=s.workers.find(w=>w.id===id);assert.equal(w.task.amount,amount);s.stock.stone-=amount;run(s,30);
 assert.equal(s.stock.wood,wood+amount);assert.equal(s.storageUsed,160);assert.ok(!s.workers.find(w=>w.id===id)?.task);if(demolishHome)assert.equal(s.workers.length,0);}

// Both the UI reason and actual import use a single reachable store, not the total across stores.
{const s=fresh(),w=put(s,'warehouse',11,12);deposit(s,'fuel',40,s.starterStore);deposit(s,'wood',117,s.starterStore);deposit(s,'wood',476,w);
 assert.ok(purchaseShort(s,'water',5));const cash=s.money;assert.equal(s.buy('water',5).ok,false);assert.equal(s.money,cash);
 withdraw(s,'wood',1,w);assert.equal(purchaseShort(s,'water',5),null);assert.ok(s.buy('water',5).ok);travel(s);assert.equal(s.stock.water,5);assert.equal(w.inventory.water,5);}

// Lowering an inbound item's limit while a truck is away holds its cargo until the player makes room.
{let s=fresh();s.stock.fuel=20;assert.ok(s.buy('water',5).ok);s.setStorageRule(0,'water',0);travel(s);assert.equal(s.stock.water,0);assert.equal(s.shipments.length,1);assert.equal(s.shipments[0].waitingForSpace,true);
 s=reload(s);s.setStorageRule(0,'water',5);travel(s);assert.equal(s.stock.water,5);assert.equal(s.shipments.length,0);}

function branch(){const c=new Campaign(),a=c.active,b=new Simulation('river');c.attach({id:'site-2',name:'Branch',nation:a.nation,unrest:0,sim:b});c.treasury.money=10000;for(const s of[a,b])empty(s);const wa=put(a,'warehouse'),wb=put(b,'warehouse');for(const s of[a,b])empty(s);return {c,a,b,wa,wb};}
// Freight cannot consume moving inventory. Incoming loads reserve capacity against simultaneous routes/imports.
{let {c,a,b,wa,wb}=branch();deposit(a,'wood',20,wa);deposit(a,'fuel',10,a.starterStore);assert.ok(c.createRoute('site-1','site-2','wood',12).ok);
 const p=a.tiles.find(t=>!a.canRelocate(wa.id,t.x,t.z));assert.ok(a.relocate(wa.id,p.x,p.z).ok);const woodAtDispatch=a.stock.wood;const r=c.routes[0];c.tickRoute(r,.25);assert.equal(r.cargo,0);assert.equal(wa.inventory.wood,20);
 a.time=wa.movingUntil;a.revision++;b.setStorageRule(0,'wood',0);b.setStorageRule(wb.id,'wood',12);c.tickRoute(r,.25);assert.equal(r.cargo,12);assert.equal(freeSpace(b,wb,'wood'),0);assert.equal(freightPlan(b,'wood',1,'truck',true),null);assert.equal(b.demolish(wb.x,wb.z).ok,false);
 c=reloadCampaign(c);a=c.sites[0].sim;b=c.sites[1].sim;b.setStorageRule(wb.id,'wood',0);c.tickRoute(c.routes[0],100);assert.equal(b.stock.wood,0);assert.equal(c.routes[0].cargo,12);
 b.setStorageRule(wb.id,'wood',12);c.tickRoute(c.routes[0],1);assert.equal(b.stock.wood,12);assert.equal(a.stock.wood,woodAtDispatch-12);assert.equal(c.routes[0].cargo,0);assert.equal(c.deliveries,1);}

// Sending gasoline as cargo must not count the same unit as both cargo and vehicle fuel.
{const {c,a,b,wa}=branch();deposit(a,'fuel',5,a.starterStore);deposit(a,'fuel',20,wa);assert.ok(c.createRoute('site-1','site-2','fuel',12).ok);c.tickRoute(c.routes[0],.25);
 assert.equal(c.routes[0].cargo,12);assert.equal(a.stock.fuel,12);c.tickRoute(c.routes[0],100);assert.equal(b.stock.fuel,12);}

// Policy space is item-specific, includes reservations, persists, and never destroys existing goods.
{let s=fresh();s.stock.wood=100;assert.ok(s.setStorageRule(0,'fuel',40,40).ok);assert.equal(freeSpace(s,s.starterStore,'wood'),20);assert.equal(freeSpace(s,s.starterStore,'fuel'),40);
 s.setStorageRule(0,'wood',0);assert.equal(freeSpace(s,s.starterStore,'wood'),0);assert.equal(s.stock.wood,100);assert.equal(s.setStorageRule(0,'grain',150,150).ok,false);
 s=reload(s);assert.equal(freeSpace(s,s.starterStore,'fuel'),40);assert.equal(s.setStorageRule(0,'fuel',null).ok,true);assert.equal(freeSpace(s,s.starterStore,'grain'),60);
 const bad=s.save();bad.starterStorageRules={fuel:{limit:1,reserve:2}};assert.throws(()=>encodeSave(bad));}
// Workers leave rejected goods on the production pad, then carry them once the policy changes.
{const s=fresh();put(s,'house',10,14);const m=put(s,'sawmill',12,12);m.enabled=false;m.out=3;s.setStorageRule(0,'plank',0);run(s,25);assert.equal(m.out,3);assert.equal(s.stock.plank,0);s.setStorageRule(0,'plank',3);run(s,30);assert.equal(m.out,0);assert.equal(s.stock.plank,3);}

// Capacity descriptions are derived from the same rule as the inventory panel, including upgrades.
{const s=fresh(),b=put(s,'depot');for(const level of[1,2,3]){b.level=level;assert.ok(describeFacility(b.type,s,b).includes(String(capacity(s,b))));}}

// An overloaded local grid chooses priority, scales both upgrades, and cannot borrow disconnected power.
{const s=fresh(),make=(id,type,x,z)=>({id,type,x,z,health:100,enabled:true,level:1,priority:1});const wind=make(1,'windturbine',5,5),a=make(2,'refinery',6,5),b=make(3,'refinery',5,6),c=make(4,'refinery',6,6),remote=make(5,'generator',20,20);s.buildings=[wind,a,b,c,remote];
 let g=gridAllocation(s,[wind,remote]);assert.equal(g.groups.length,2);assert.ok(g.powered.has(a.id));assert.ok(!g.powered.has(c.id));assert.equal(g.groups[0].demand,9);
 s.setOperation(c.id,true,2);g=gridAllocation(s,[wind,remote]);assert.ok(g.powered.has(c.id));assert.ok(!g.powered.has(b.id));
 wind.level=2;s.revision++;g=gridAllocation(s,[wind,remote]);assert.equal(g.powered.size,3);assert.equal(powerSupply(wind),9);
 c.level=2;s.revision++;assert.equal(powerDemand(c),3.9);g=gridAllocation(s,[wind,remote]);assert.equal(g.powered.size,2);}

// Refining consumes oil at distillation, waits without losing the batch, and consumes cooling water only once.
{let s=fresh();s.rank=8;const gen=put(s,'windturbine',10,12),b=put(s,'refinery',12,12);for(let x=8;x<=12;x++)put(s,'road',x,11);put(s,'dwarfhouse');gen.activeUntil=1e6;b.inputs={oil:3};run(s,35);assert.equal(b.status,'물 대기');assert.equal(b.out,0);assert.equal(b.inputs.oil,0);assert.equal(b.progress,8/14);assert.deepEqual(b.batch,{oil:3});
 s=reload(s);const r=s.buildings.find(v=>v.id===b.id);r.inputs.water=2;run(s,20);assert.equal(s.produced.fuel,3);assert.equal(r.inputs.water,0);assert.equal(r.batch,undefined);assert.equal(r.out+s.stock.fuel+s.workers.reduce((n,w)=>n+(w.task?.carried&&w.task.item==='fuel'?w.task.amount:0),0),3);}

// Actual quotes change by destination and day; an already dispatched shipment retains its price.
{const s=fresh();s.stock.bread=10;s.stock.fuel=40;const cities=tradeDestinations(s,s.tradeConnection());chooseTradeDestination(s,cities[0].destinationId);const near=s.saleQuote('bread',10);chooseTradeDestination(s,cities.at(-1).destinationId);const far=s.saleQuote('bread',10);assert.ok(far>near);const cash=s.money;assert.ok(s.sell('bread',10).ok);const promised=s.shipments[0].revenue;
 chooseTradeDestination(s,cities[0].destinationId);s.time+=800;travel(s);assert.equal(s.money,cash+promised);assert.equal(s.sold.bread,10);}

// Fixed scenarios restart on identical land and inventory, save separately, pause, expire, and keep best records.
{const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 for(const rule of INDUSTRY_TRIALS){let c=createIndustryTrial(rule.id),again=createIndustryTrial(rule.id);assert.deepEqual(c.active.save().tileState,again.active.save().tileState);assert.deepEqual({...c.active.stock},{...again.active.stock});assert.ok(purchaseShort(c.active,rule.item,1));
  c.active.paused=true;c.tick(.25);assert.equal(trialState(c).elapsed,0);c.active.paused=false;c=reloadCampaign(c);assert.equal(c.trial.id,rule.id);
  c.active.time=rule.duration-.05;c.active.speed=4;c.tick(.25);assert.equal(c.active.time,rule.duration);assert.equal(c.trial.status,'expired');assert.equal(c.active.paused,true);c.tick(.25);assert.equal(c.active.time,rule.duration);
  c=createIndustryTrial(rule.id);c.treasury.produced[rule.item]=rule.target;c.treasury.sold[rule.item]=rule.target;c.tick(.25);assert.equal(c.trial.status,'won');recordIndustryTrial(storage,c);const score=c.trial.score;c.trial.score=1;recordIndustryTrial(storage,c);assert.equal(JSON.parse(data.get(TRIAL_RECORDS_KEY))[rule.id].score,score);
  assert.equal(createIndustryTrial(rule.id).trial.delivered,0);
 }}
// Code review 2026-10-04: an emerging-state order is ready only when one vehicle can carry it; a split contract delivery on
// the road keeps its order through a reload that redraws stale orders; an import whose reserved room was taken drives on to a
// store with room; auto-sale keeps one of the active terminal's own vehicles; the slow-spot card quotes the move it charges.
{const {fleet}=await import('../src/app/game/export-route.js'),{slowSpot}=await import('../src/app/game/ui-rules.js');
 const tick=(c,seconds)=>{c.active.paused=false;for(let i=0;i<seconds*4;i++)c.tick(.25);};
 {const c=new Campaign({nation:'estern'}),s=c.active;let state=null;for(const id of ['silvaen','kardum','estern'])if(!state)state=c.spawnState(id,'시험국');assert.ok(state,'an emerging state');const order=c.stateOrder(state);s.stock[order.item]+=order.amount;s.stock.fuel+=40;
  const row=c.stateOrders().find(v=>v.state===state),sent=c.stateAction('trade',state.id);assert.equal(row.ready,sent.ok,row.reason+' / '+sent.error);if(!sent.ok)assert.equal(row.reason,sent.error);}
 {const c=new Campaign({nation:'estern'}),s=c.active;c.treasury.rank=2;c.treasury.contracts=3;c.treasury.contractOrder={n:3,item:'grain'};s.stock.grain+=100;s.stock.fuel+=100;s.contractReadyAt=0;
  const p=s.tiles.find(t=>!s.canBuild('lumber',t.x,t.z,true));assert.ok(s.build('lumber',p.x,p.z,true).ok);const sent=s.fulfill();assert.ok(sent.ok,sent.error);assert.equal(s.shipments[0].contractFinal,false,'a split delivery');
  const back=reloadCampaign(c);assert.equal(back.treasury.contractOrder?.item,'grain','the order on the road is kept');back.active.paused=false;for(let i=0;i<6000&&back.active.shipments.some(sh=>sh.phase==='out');i++)back.tick(.25);
  assert.equal(back.treasury.contractOrder.delivered,sent.amount);assert.equal(back.treasury.contractOrder.rewardPaid,sent.reward);}
 {const c=new Campaign({nation:'estern'}),s=c.active;s.money+=5000;const p=s.tiles.find(t=>!s.canBuild('warehouse',t.x,t.z,true));assert.ok(s.build('warehouse',p.x,p.z,true).ok);assert.ok(s.buy('wood',8).ok);
  const target=s.shipments[0].storeId===0?s.starterStore:s.warehouse,other=target===s.starterStore?s.warehouse:s.starterStore,before=other.inventory.wood||0;
  deposit(s,'stone',capacity(s,target)-Object.values(target.inventory).reduce((n,v)=>n+v,0),target);tick(c,200);
  assert.equal(s.shipments.length,0,'the vehicle unloads elsewhere and comes free');assert.equal((other.inventory.wood||0)-before,8);}
 {const c=new Campaign({nation:'estern',provinceId:'estern-2'}),s=c.active;c.treasury.rank=12;s.money+=50000;for(let x=0;x<24;x++)for(let z=0;z<24;z++)s.owned.add(x+','+z);s.revision++;
  for(const type of ['coastport','riverport','lakeport','canaldock','streamdock','ferrydock'])if(s.tiles.some(t=>t.terrain==='water'&&s.build(type,t.x,t.z,true).ok))break;
  s.tiles.some(t=>s.build('roadhub',t.x,t.z,true).ok);assert.ok(s.chooseTradeRoute('gate').ok);const slots=fleet(s);assert.ok(slots.filter(v=>v.selected).length===2&&slots.some(v=>!v.selected),slots.map(v=>v.kind).join());
  s.autoSell={bread:true,cake:true};s.stock.bread+=60;s.stock.cake+=60;s.stock.fuel+=40;s.salesTimer=7.9;tick(c,.5);
  assert.equal(s.shipments.filter(sh=>sh.auto).length,1,'auto-sale leaves one road vehicle');assert.ok(s.sell('bread',5).ok);}
 {const c=new Campaign({nation:'estern'}),s=c.active;c.treasury.rank=6;s.money+=20000;const f=s.tiles.find(t=>s.ownedAt(t.x,t.z)&&!s.canBuild('field',t.x,t.z,true));assert.ok(s.build('field',f.x,f.z,true).ok);
  assert.ok([[1,0],[0,1],[-1,0],[0,-1]].some(([dx,dz])=>s.build('generator',f.x+dx,f.z+dz,true).ok));
  for(const k of s.owned){const [x,z]=k.split(',').map(Number),t=s.tile(x,z);if(!s.at(x,z)&&!s.roads.has(k)&&!t.nature&&t.terrain!=='water'){t.nature='tree';t.remaining=90;}}s.revision++;
  const v=slowSpot(s);assert.ok(v,'a cleaner spot is offered');const m=s.money;assert.ok(s.relocate(v.building.id,v.x,v.z).ok);assert.equal(m-s.money,v.cost,'the card quotes what the move charges');}
}
console.log('PASS Town Star follow-up: partial orders, physical return and freight, import policies, grid load, staged fuel, destination prices, saved scenarios');
