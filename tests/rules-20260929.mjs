// Rule fixes of the 2026-09-29 audits (audit-2 A, C and D): each block reproduces the old defect's situation and checks
// the rule that replaced it. Run by tests/simulation.mjs.
import assert from 'node:assert/strict';
import {Simulation,BUILDINGS,RESOURCES,damageFactor,STORM_FLOOR,REFUND_GRACE,MERCHANT_PRICE,HARVEST_BOOST,packTiles,unpackTiles,N} from '../src/app/game/simulation.js';
import {placementEffects} from '../src/app/game/proximity.js';
import {startRaid,ATTACKER_ID_BASE,GUARD_ID_BASE,MELEE} from '../src/app/game/encounters.js';
import {encodeSave,decodeSave,writeSave,SAVE_KEY,RECOVERY_KEY,BACKUP_KEY} from '../src/app/game/persistence.js';
import {fleet,VEHICLES,spareFuel} from '../src/app/game/export-route.js';
const run=(s,secs,step=.25)=>{for(let i=0;i<secs/step;i++)s.tick(step);};
const reload=s=>new Simulation(s.region,decodeSave(encodeSave(s.save())));
const town=(rank=32)=>{const s=new Simulation('river');s.nextEvent=1e12;s.autoSell={};s.money=1e6;s.debt=0;s.rank=rank;
 s.build('warehouse',11,12,true);for(const [x,z] of [[11,14],[9,12],[13,12]])s.build('house',x,z,true);for(const b of s.buildings)if(BUILDINGS[b.type].home)b.level=3;s.syncWorkers();
 for(const r of Object.keys(RESOURCES))s.stock[r]=150;return s;};
const place=(s,type,free=true)=>{const w=s.warehouse;for(const t of s.tiles.filter(t=>s.canBuild(type,t.x,t.z,free)===null).sort((a,b)=>Math.abs(a.x-w.x)+Math.abs(a.z-w.z)-Math.abs(b.x-w.x)-Math.abs(b.z-w.z))){if(!s.routeTo(s.entries(w)[0],{x:t.x,z:t.z,size:1}))continue;const r=s.build(type,t.x,t.z,free);if(r.ok)return s.at(t.x,t.z);}throw new Error('no tile for '+type);};

// C3: a guard answers an attacker in melee reach even when the attacker stands past the barracks range.
{const s=town(22);for(let x=2;x<22;x++)for(let z=2;z<22;z++)s.owned.add(x+','+z);s.revision++;/* land set directly */const base=place(s,'barracks');startRaid(s);const g=s.guards[0],range=s.rank>=23?9:6.5;
 const spot=s.tiles.find(t=>s.walkable(t.x,t.z)&&Math.hypot(t.x-base.x,t.z-base.z)>range+.5&&s.walkable(t.x-1,t.z));assert.ok(spot,'a spot past the range line');
 const [a,...rest]=s.attackers;a.x=spot.x;a.z=spot.z;a.delay=0;a.route=[];for(const w of rest){w.hp=0;w.until=s.time+99;}g.x=spot.x-1;g.z=spot.z;g.route=[];g.attackAt=0;
 const hp=a.hp;s.tick(1/60);assert.ok(Math.hypot(a.x-g.x,a.z-g.z)<MELEE);assert.ok(a.hp<hp,'the guard strikes back past the range line');}
// C10: attacker and guard ids never meet, also after 100 raids and in a save from before the separate range.
{const s=town(22);place(s,'barracks');s.raidCount=100;startRaid(s);const ids=[...s.attackers,...s.guards].map(v=>v.id);assert.equal(new Set(ids).size,ids.length);
 assert.ok(s.attackers.every(w=>w.id>=ATTACKER_ID_BASE)&&s.guards.every(g=>g.id>=GUARD_ID_BASE&&g.id<ATTACKER_ID_BASE));
 const old=s.save();old.attackers.forEach((w,i)=>w.id=GUARD_ID_BASE+i);/* ids as the old rule gave at the 100th raid */const r=new Simulation(s.region,decodeSave(encodeSave(old)));
 const again=[...r.attackers,...r.guards].map(v=>v.id);assert.equal(new Set(again).size,again.length,'loaded attackers leave the guard ids');}
// C11 + C12: counters never fall below ids in use; nested objects keep defaults for fields an older save lacks.
{const s=town();const data=s.save();delete data.nextWorkerId;delete data.nextId;data.health={infection:3,sanitationUntil:0,nextCare:0};data.logisticsStats={delivered:5};
 const r=new Simulation(s.region,decodeSave(encodeSave(data)));assert.equal(r.health.recoveries,0);assert.equal(r.logisticsStats.direct,0);
 const b=place(r,'well');assert.ok(!s.buildings.some(v=>v.id===b.id&&v!==b)&&new Set(r.buildings.map(v=>v.id)).size===r.buildings.length,'building ids stay unique');
 place(r,'house');const ids=r.workers.map(w=>w.id);assert.equal(new Set(ids).size,ids.length,'worker ids stay unique');run(r,120);assert.doesNotThrow(()=>encodeSave(r.save()));
 const same=reload(s);assert.equal(same.nextId,s.nextId);assert.equal(same.nextWorkerId,s.nextWorkerId);}
// C7: a fuel order leaves on a truck when fuel covers the reserve (which already holds the order) plus one trip.
{const s=town(18);s.stock.fuel=0;let n=0;while(s.contract().item!=='fuel'&&n<40)s.contracts=++n;const c=s.contract();assert.equal(c.item,'fuel');s.contractReadyAt=0;
 s.stock.fuel=s.minimumStock('fuel')+1;s.stock.plank=60;
 assert.ok(fleet(s).some(v=>!v.busy&&VEHICLES[v.kind].fuel));assert.equal(spareFuel(s),1);const st=s.contractStatus();assert.equal(st.ready,true,st.error);
 const f=s.stock.fuel;assert.ok(s.fulfill().ok);assert.equal(s.stock.fuel,f-c.amount-1,'the order and one trip of fuel leave');}
// C8: demolishing mid-cycle returns the batch the cycle consumed.
{const s=town();const b=place(s,'sawmill');b.inputs={wood:4};run(s,2);assert.ok(b.progress>0&&b.batch);const batch={...b.batch},wood=s.stock.wood+b.inputs.wood;
 const carried=s.workers.reduce((n,w)=>n+(w.task?.carried&&w.task.item==='wood'?w.task.amount:0),0);s.demolish(b.x,b.z);assert.equal(s.stock.wood,wood+batch.wood+carried);}
// J7: a paid facility demolished within the grace period refunds its price and materials; later, or when free, 40%.
{const s=town(5);const money=s.money,wood=s.stock.wood,stone=s.stock.stone;const b=place(s,'sawmill',false);assert.ok(b.refundUntil>s.time);
 const r=s.demolish(b.x,b.z);assert.ok(r.ok&&r.full);assert.equal(s.money,money);assert.equal(s.stock.wood,wood);assert.equal(s.stock.stone,stone);
 const c=place(s,'sawmill',false);run(s,REFUND_GRACE+1);const m=s.money;assert.equal(s.demolishRefund(c).full,false);s.demolish(c.x,c.z);assert.equal(s.money-m,Math.floor(BUILDINGS.sawmill.cost*.4));
 const f=place(s,'sawmill');assert.equal(f.refundUntil,undefined);assert.equal(s.demolishRefund(f).money,Math.floor(BUILDINGS.sawmill.cost*.4));}
// C5: tiles are saved packed, loaded back exactly, and a save with the older tile objects still loads.
{const s=town();s.tiles[5].nature='sapling';s.tiles[5].remaining=0;s.tiles[5].growAt=123.456;s.tiles[7].nature='tree';s.tiles[7].remaining=-3;
 const data=s.save();assert.equal(typeof data.tileState,'string');assert.equal(data.tiles,undefined);assert.deepEqual(unpackTiles(packTiles(s.tiles)),s.tiles.map(t=>({nature:t.nature,remaining:t.remaining,...(t.growAt!==undefined?{growAt:t.growAt}:{})})));
 const r=reload(s);for(let i=0;i<N*N;i++){assert.equal(r.tiles[i].nature,s.tiles[i].nature);assert.equal(r.tiles[i].remaining,s.tiles[i].remaining);assert.equal(r.tiles[i].growAt,s.tiles[i].growAt);}
 assert.equal(encodeSave(r.save()).split('"game":')[1],encodeSave(s.save()).split('"game":')[1],'save, load, save is stable');
 const old=s.save();old.tiles=unpackTiles(old.tileState);delete old.tileState;const o=new Simulation(s.region,decodeSave(encodeSave(old)));assert.equal(o.tiles[5].growAt,123.456);assert.equal(o.tiles[7].remaining,-3);
 assert.ok(data.tileState.length<JSON.stringify(old.tiles).length/5,'packed tiles are a fraction of the object form');
 const bad=s.save();bad.tileState='x;'+bad.tileState;assert.throws(()=>encodeSave(bad));}
// C5: when storage is full the rolling recovery copy gives way to the save; the new-game backup is kept.
{const limit=2*encodeSave(town().save()).length+500;const store=new Map(),storage={getItem:k=>store.has(k)?store.get(k):null,removeItem:k=>store.delete(k),
  setItem(k,v){const used=[...store].reduce((n,[key,val])=>n+(key===k?0:val.length),0);if(used+v.length>limit){const e=new Error('quota');e.name='QuotaExceededError';throw e;}store.set(k,String(v));}};
 const s=town();writeSave(storage,s.save());const backup='b'.repeat(limit/4|0);store.set(BACKUP_KEY,backup);run(s,2);assert.doesNotThrow(()=>writeSave(storage,s.save()),'the save is written although save + recovery + backup do not fit');
 assert.equal(store.has(RECOVERY_KEY),false,'the recovery copy made room');assert.equal(store.get(BACKUP_KEY),backup,'the other game backup stays');assert.equal(decodeSave(store.get(SAVE_KEY)).time,s.time);}
// C4: the cached placement effects always equal a fresh computation, through building, toggling and a reservoir lapsing.
{const s=town(22);const res=place(s,'reservoir');const field=place(s,'field');const gen=place(s,'generator');const check=()=>{for(const b of s.buildings)assert.deepEqual(s.placementEffects(b.type,b.x,b.z),placementEffects(s,b.type,b.x,b.z),b.type);};
 res.activeUntil=s.time+3;check();run(s,4);check();s.setOperation(gen.id,false);check();s.setOperation(gen.id,true);check();place(s,'smelter');check();s.demolish(field.x,field.z);check();s.roads.add('12,10');check();
 assert.equal(s.warehouse.type,'warehouse');const cap=s.storageCapacity;const d=place(s,'depot');assert.equal(s.storageCapacity,cap+240);d.health=0;assert.equal(s.storageCapacity,cap);}
// A2-G2: a timed support facility slowed below full speed keeps its effect without gaps once running.
{const s=town(22);const g=place(s,'generator');g.inputs={wood:80,water:40};s.health.infection=60;let first=null,off=0;for(let i=0;i<2400;i++){s.health.infection=60;s.tick(.25);if(s.power&&first===null)first=i;else if(first!==null&&!s.power)off++;}
 assert.ok(first!==null);assert.equal(off,0);}
// C4/C-T1: coarse steps (a site ticked less often) make as much as fine ones: a finished cycle's remainder carries.
{const count=step=>{const s=town();const b=place(s,'well');run(s,240,step);return b.cycles;};const fine=count(1/60),coarse=count(.25);assert.ok(coarse>=fine-1&&coarse<=fine+1,fine+' vs '+coarse);}
// A2-C1: damage below half health slows production; a strike slows it too; an early storm never stops a facility.
{assert.equal(damageFactor(100),1);assert.equal(damageFactor(50),1);assert.ok(damageFactor(20)<.6&&damageFactor(20)>.25);
 const s=town();const b=place(s,'sawmill');const full=s.speedOf(b);b.health=20;assert.ok(Math.abs(s.speedOf(b)/full-damageFactor(20))<1e-9);b.health=100;s.strikeUntil=s.time+10;assert.ok(s.speedOf(b)<full);
 const e=new Simulation('river');e.nextEvent=1e12;e.build('warehouse',11,12);e.build('house',11,14);e.build('well',13,12);e.build('field',13,13);e.build('lumber',9,10);
 for(let i=0;i<12;i++){e.pendingEvent={type:'storm',at:e.time};e.eventCount++;e.time+=80;e.resolveEvent();}assert.ok(e.stage<8&&e.buildings.every(b=>b.health>=STORM_FLOOR),'twelve early storms leave every facility running');}
// J3: good events: a harvest speeds farms, a merchant pays more, migrants settle in a house.
{const s=town(5);const f=place(s,'field');const farm=s.speedOf(f);s.pendingEvent={type:'harvest',at:s.time};s.resolveEvent();assert.ok(Math.abs(s.speedOf(f)/farm-HARVEST_BOOST)<1e-9);
 const q=s.saleQuote('bread',1);s.pendingEvent={type:'merchant',at:s.time};s.resolveEvent();assert.ok(Math.abs(s.saleQuote('bread',1)/q-MERCHANT_PRICE)<.02);
 const h=s.buildings.find(b=>BUILDINGS[b.type].home);h.level=1;s.syncWorkers();const n=s.workers.length;s.pendingEvent={type:'migrants',at:s.time};s.resolveEvent();assert.equal(s.workers.length,n+1);
 assert.ok(s.notices.slice(-3).every(v=>v.type==='success'));assert.doesNotThrow(()=>encodeSave(s.save()));
 const types=new Set();const e=town(2);place(e,'field');for(let i=0;i<200;i++){e.eventCount=i;types.add(e.chooseEvent());}assert.ok(['harvest','merchant','migrants'].every(t=>types.has(t)),'good events are drawn');}
// A2-C2: the sanction notice names its counter, and the negotiation ends it for less than it costs.
{const s=town(22);s.budget.lastIncome=50000;s.pendingEvent={type:'sanction',at:s.time};s.resolveEvent();assert.match(s.notices.at(-1).text,/통상 협상|영주 납품/);
 const q=s.saleQuote('bread',10),m=s.money;assert.ok(s.negotiateSanction().ok);assert.equal(s.money,m-2000);assert.ok(s.saleQuote('bread',10)>q);assert.equal(s.negotiateSanction().ok,false);}
// A2-B1: upgrade and specialisation costs follow the facility's price; a house upgrade stays per resident.
{const s=town();const y=place(s,'shipyard'),w=place(s,'sawmill'),h=s.buildings.find(b=>BUILDINGS[b.type].home);y.level=w.level=1;
 assert.equal(s.upgradeCost(y),Math.round(s.buildCost('shipyard')*.25));y.level=2;assert.equal(s.upgradeCost(y),Math.round(s.buildCost('shipyard')*.4));
 assert.ok(s.upgradeCost(w)<90);h.level=2;assert.equal(s.upgradeCost(h),120);assert.equal(s.specializeCost(w),100);assert.ok(s.specializeCost(y)>1000);}
// J2: the first lord's order fits the starting stock, so it can leave as soon as the warehouse stands.
{const s=new Simulation('river');s.nextEvent=1e12;const c=s.contract();assert.ok(s.stock[c.item]>=c.amount,c.item+' '+c.amount);s.build('warehouse',11,12);assert.equal(s.contractStatus().ready,true,s.contractStatus().error);
 s.contracts=1;assert.ok(s.contract().amount>c.amount,'later orders are full size');}
// J5: paid actions without the money say how much is missing and what to do.
{const s=town();const b=place(s,'sawmill');b.health=40;s.money=-500;const r=s.repair(b.id);assert.equal(r.ok,false);assert.match(r.error,/부족/);assert.match(r.error,/회생 자금/);
 s.money=10;assert.match(s.canBuild('sawmill',...[s.tiles.find(t=>s.canBuild('sawmill',t.x,t.z,true)===null)].map(t=>[t.x,t.z]).flat()),/부족/);assert.match(s.upgrade(b.id).error,/부족/);
 s.money=1e6;b.health=40;const d=place(s,'well');d.health=50;const all=s.repairAll();assert.ok(all.ok&&all.fixed===2&&s.buildings.every(v=>v.health===100));}
console.log('PASS rules 2026-09-29: raid melee and ids, id counters and nested defaults, fuel contract, demolish batch and grace refund, packed tiles and full storage, effect cache, timed effects, coarse steps, damage and strike, good events, sanction counter, upgrade costs, first order, money errors');
