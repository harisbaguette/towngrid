// The Town Star layer of 2026-10-03 (docs/TOWNSTAR_RULES.md, docs/BALANCE_PATCH_20260928.md 22): every rule through the
// same functions the screens and bots call, with a save round trip for each piece of new state.
import assert from 'node:assert/strict';
import {Campaign,UPKEEP} from '../src/app/game/campaign.js';
import {Simulation,CLEAR_COST,CLEAR_FROM,UNPAID_SPEED} from '../src/app/game/simulation.js';
import {encodeSave,decodeSave} from '../src/app/game/persistence.js';
import {capacity,freeSpace,deposit,STORE_MODES} from '../src/app/game/storage.js';
import {HAUL_GEAR,haulLoad} from '../src/app/game/logistics.js';
import {starsOf,seasonOf,SEASONS,WEEK_DAYS,DAILY,GIFT,standings} from '../src/app/game/league.js';
import {LAND_SALES} from '../src/app/game/land-sale.js';
import {awaySeconds,catchUp,OFFLINE} from '../src/app/game/offline.js';
import {PENALTY_STEP} from '../src/app/game/proximity.js';
import {slowSpot,goalAction} from '../src/app/game/ui-rules.js';
import {WORLD_PLOTS} from '../src/app/game/territory.js';
import {layoutOf} from '../src/app/game/world-grid.js';

const roundTrip=c=>new Campaign({saved:decodeSave(encodeSave(c.save()))});
const freeTile=(s,type,nature)=>{for(const k of s.owned){const [x,z]=k.split(',').map(Number);if(nature!==undefined&&(s.tile(x,z).nature||null)!==nature)continue;if(!s.canBuild(type,x,z,true))return [x,z];}return null;};
const run=(c,seconds)=>{const s=c.active;s.paused=false;for(let t=0;t<seconds;t+=.25)c.tick(.25);};
let n=0;const ok=label=>{n++;console.log('PASS',label);};

// 1. Clearing a tree or rock costs money from 준자유민; a cancelled build gives the fee back.
{const c=new Campaign({nation:'estern'}),s=c.active,[x,z]=freeTile(s,'house','tree');
 assert.equal(s.clearCost(x,z,'house'),0,'a serf clears for free');c.treasury.rank=CLEAR_FROM;assert.equal(s.clearCost(x,z,'house'),CLEAR_COST.tree);
 const m=s.money,r=s.build('house',x,z);assert.ok(r.ok,r.error);assert.equal(m-s.money,s.buildCost('house')+CLEAR_COST.tree);s.demolish(x,z);assert.equal(s.money,m,'full refund includes the fee');ok('clearing fee and refund');}

// 2. A stuck old order (a base good nothing makes while another is made) is drawn again on load.
{const c=new Campaign({nation:'estern'}),s=c.active;c.treasury.rank=5;c.treasury.contracts=4;s.stock.plank+=20;s.stock.stone+=20;s.money+=3000;
 const [x,z]=freeTile(s,'bakery');assert.ok(s.build('bakery',x,z,true).ok);c.treasury.contractOrder={n:4,item:'smokedfish'};assert.ok(s.contractStale());
 const back=roundTrip(c);assert.notEqual(back.active.contract().item,'smokedfish');ok('stale order redrawn');}

// 3. Stock caps stop hauling at the cap and the maker rests at 재고 상한; the cap is saved.
{const c=new Campaign({nation:'estern'}),s=c.active;s.money+=2000;const [hx,hz]=freeTile(s,'house');s.build('house',hx,hz,true);const [x,z]=freeTile(s,'well');s.build('well',x,z,true);
 assert.ok(s.setStockCap('water',s.stock.water).ok);run(c,120);const well=s.buildings.find(b=>b.type==='well');assert.equal(well.status,'재고 상한');
 assert.equal(roundTrip(c).active.stockCap.water,s.stockCap.water);assert.ok(s.setStockCap('water',0).ok);assert.equal(s.stockCap.water,undefined);ok('stock cap');}

// 4. Hauling gear: 3 → 4 → 5 goods a trip, bought with money and goods at its rank; shared by the campaign and saved.
{const c=new Campaign({nation:'estern'}),s=c.active;assert.equal(haulLoad(s),3);assert.match(s.haulGearOffer().error,/승급/);
 c.treasury.rank=HAUL_GEAR[1].rank;s.money+=5000;s.stock.plank+=40;s.stock.brick+=20;assert.ok(s.buyHaulGear().ok);assert.equal(haulLoad(s),4);assert.ok(s.buyHaulGear().ok);assert.equal(haulLoad(s),5);assert.equal(s.haulGearOffer(),null);
 assert.equal(haulLoad(roundTrip(c).active),5);ok('hauling gear');}

// 5. A depot set to one kind of goods holds only those, several times as many; it refuses a switch while holding others.
{const c=new Campaign({nation:'estern'}),s=c.active;c.treasury.rank=6;const [x,z]=freeTile(s,'depot');const id=s.build('depot',x,z,true).id,b=s.buildings.find(v=>v.id===id);
 assert.equal(capacity(s,b),240);for(const [mode,m] of Object.entries(STORE_MODES)){assert.ok(s.setStoreMode(id,mode).ok);assert.equal(capacity(s,b),m.capacity);assert.equal(freeSpace(s,b,'bread'),0);assert.ok(freeSpace(s,b,m.items[0])>0);}
 assert.ok(s.setStoreMode(id,'water').ok);deposit(s,'water',5,b);assert.ok(!s.setStoreMode(id,'fuel').ok);assert.equal(roundTrip(c).active.buildings.find(v=>v.id===id).mode,'water');ok('depot storage modes');}

// 6. Facility wages: none before 등록 사업주, 1.5% of build cost a day from there, 3% from 법인 대표, a quarter if switched off.
{const c=new Campaign({nation:'estern'}),s=c.active;const [x,z]=freeTile(s,'sawmill');s.build('sawmill',x,z,true);
 assert.equal(c.upkeep().facilities,0);c.treasury.rank=UPKEEP.earlyFrom;const day=c.upkeep().facilities;assert.ok(day>0);c.treasury.rank=UPKEEP.fromRank;assert.ok(c.upkeep().facilities>day);
 const b=s.buildings.find(v=>v.type==='sawmill');s.setOperation(b.id,false);assert.ok(c.upkeep().facilities<day*2);
 s.setOperation(b.id,true);const fast=s.speedOf(b);s.money=-1;assert.ok(Math.abs(s.speedOf(b)-fast*UNPAID_SPEED)<1e-9,'unpaid wages slow facilities');ok('wages and unpaid speed');}

// 7. Stars, the daily goal and the weekly league with its prize; the festival season lifts its goods' price.
{const c=new Campaign({nation:'estern'}),s=c.active;assert.equal(starsOf('grain',8),8);assert.equal(starsOf('cake',2),40);
 const r=s.sell('grain',8);assert.ok(r.ok,r.error);for(let i=0;i<800&&c.league.total===0;i++)c.tick(.25);assert.equal(c.league.total,8);
 c.league.daily.goal=10;const money=c.treasury.money;let sold=false;for(let i=0;i<800&&!sold;i++){sold=s.sell('wood',10).ok;c.tick(.25);}assert.ok(sold);for(let i=0;i<800&&!c.league.daily.done;i++)c.tick(.25);assert.ok(c.league.daily.done);assert.ok(c.treasury.money>=money+10);
 assert.equal(standings(c).length,8);run(c,80*WEEK_DAYS+5);assert.equal(c.league.week,2);assert.equal(c.league.history[0].week,1);assert.ok(c.league.daily.goal>=DAILY.min);
 assert.equal(seasonOf(1),SEASONS[0]);assert.equal(seasonOf(WEEK_DAYS+1),SEASONS[1]);
 const week=c.lastWorldDay;c.lastWorldDay=1;const fish=s.marketFactor('fish');c.lastWorldDay=WEEK_DAYS+1;assert.ok(Math.abs(s.marketFactor('fish')/fish-SEASONS[1].goods.fish/(SEASONS[0].goods.fish||1))<1e-9,'summer lifts fish');c.lastWorldDay=week;
 assert.equal(roundTrip(c).league.week,c.league.week);ok('stars, daily goal, league, seasons');}

// 8. A gift to a neighbour: one unit, relation up, a wait, a thank-you payment at 60.
{const c=new Campaign({nation:'estern'}),s=c.active;c.relations.silvaen=58;const m=c.treasury.money;const r=c.giftNeighbor('silvaen','wood');assert.ok(r.ok,r.error);
 assert.ok(c.relations.silvaen>=59);assert.match(c.giftNeighbor('silvaen','wood').error,/초/);run(c,GIFT.wait+1);assert.ok(c.giftNeighbor('silvaen','wood').ok);assert.ok(c.relations.silvaen>=60);assert.ok(c.treasury.money>m);
 assert.ok(!c.giftNeighbor('nezar','wood').ok,'not to a hostile nation');ok('neighbour gifts');}

// 9. Selling a desert oil seep or a marsh reed bed once; the sale is saved and the tile keeps it.
{let done=false;for(const p of WORLD_PLOTS){const l=layoutOf(p.id);if(!p.nation||!['desert','marsh'].includes(l?.ecology))continue;let c;try{c=new Campaign({nation:p.nation,provinceId:p.id});}catch{continue;}const s=c.active;
  for(const k of s.owned){const [x,z]=k.split(',').map(Number),o=s.landSaleOffer(x,z);if(!o)continue;const m=s.money;assert.ok(s.sellLand(x,z).ok);assert.equal(s.money,m+LAND_SALES[o.kind].money);assert.equal(s.landSaleOffer(x,z),null);assert.equal(roundTrip(c).active.landSaleOffer(x,z),null);done=true;break;}
  if(done)break;}
 assert.ok(done,'a start with a sellable feature');ok('land sale');}

// 10. Offline: up to half an hour of real time runs with no event starting, then the clock speed and pause come back.
{const c=new Campaign({nation:'estern'}),s=c.active;s.paused=true;const raw=encodeSave(c.save());assert.ok(Math.abs(awaySeconds(raw,Date.now()+120000)-120)<3);
 const t=s.time,ev=s.nextEvent,r=catchUp(c,OFFLINE.maxReal*3);assert.ok(r.capped);assert.ok(Math.abs(s.time-t-r.game)<1);assert.ok(s.nextEvent>=ev+r.game);assert.equal(s.paused,true);assert.equal(s.speed,1);assert.equal(catchUp(c,10),null);ok('offline catch-up');}

// 11. Placement: each point of shade, wind shelter or pollution multiplies the time by PENALTY_STEP on a current map, never
//     milder than the old cut; the operations card names the slowest spot and a faster place to move it to.
{const c=new Campaign({nation:'estern'}),s=c.active;assert.ok(s.layout.ecology);s.money+=3000;const [x,z]=freeTile(s,'field');s.build('field',x,z,true);
 const near=[[x+1,z],[x-1,z],[x,z+1],[x,z-1]].find(([a,b])=>!s.canBuild('warehouse',a,b,true));assert.ok(near);s.build('warehouse',...near,true);
 const e=s.placementEffects('field',x,z);assert.ok(e.shade>=2);assert.ok(e.speed<=Math.min(1/PENALTY_STEP**e.shade,1-e.shade*.1)+1e-9);
 const slow=slowSpot(s);assert.ok(slow,'a shaded field is offered a better spot');assert.ok(slow.to>=slow.from+.15);assert.ok(s.relocate(slow.building.id,slow.x,slow.z).ok);ok('placement penalty and slow spot');}

// 12. A lord's order made here but eaten by the chain: with money to spare the card offers to import the rest.
{const c=new Campaign({nation:'estern'}),s=c.active;c.treasury.contracts=3;c.treasury.contractReadyAt=0;s.money=20000;const [x,z]=freeTile(s,'field');s.build('field',x,z,true);
 const order=s.contract();s.stock[order.item]=0;assert.equal(order.item,'grain','the only base good made here');const a=goalAction(s,'contracts');assert.equal(a.kind,'market');assert.equal(a.item,'grain');ok('contract import offer');}

console.log('\n[townstar-gaps] '+n+' checks pass');
