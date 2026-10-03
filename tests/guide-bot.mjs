// A player who only presses what the screen offers, from a new game to 8단계 지역 공급자 (about the first hour).
// It reads the same rule functions the operations card renders (ui-rules tutorialStep, nextBuild, goalAction,
// productionDiagnosis, contractState, sellableStock, shortfall ...) and never looks at promotion internals to decide.
// Placement is the naive one: the free tile nearest the warehouse that the placement preview accepts.
// The player audit (docs/audit-20260930/audit-P-player.md) had such a player stuck at 2단계 for 30 minutes (K-01..K-04);
// this keeps that from coming back.
//   node tests/guide-bot.mjs            all start sites, asserts
//   TG_GUIDE_SITES=1 node tests/guide-bot.mjs   first site only
import assert from 'node:assert/strict';
import {Campaign} from '../src/app/game/campaign.js';
import {BUILDINGS,RESOURCES,ACTION_PRICES} from '../src/app/game/simulation.js';
import {RANKS} from '../src/app/game/world.js';
import {productionDiagnosis} from '../src/app/game/proximity.js';
import {RESCUE_PRICES} from '../src/app/game/living-economy.js';
import {startingProvinces} from '../src/app/game/starting-sites.js';
import {layoutOf} from '../src/app/game/world-grid.js';
import {blockHint,contractConflict,contractState,crewHouse,exportBlocked,fullStoreSale,goalAction,nextBuild,plannedNeeds,plantSpot,promotionParts,quickSaleLot,recoveryState,repairPlan,sellableStock,shortfall,slowSpot,tutorialStep} from '../src/app/game/ui-rules.js';

const DAY=80;                // game seconds per day (simulation.js get day)
const TARGET=7;              // rank index 7 = 8단계 지역 공급자
const PACE_DAYS=30;          // goal: the reference bot (tests/full-campaign.mjs) reaches it on day 9 and people take 2-3 times as
                             // long (GAME_DESIGN 현재 한계); slower runs are printed as SLOW, not failed
const LIMIT_DAYS=45;         // a dead end: not there by then
const STAGE_DAYS=25;         // a dead end: one rank this long (the audit's player sat at 2단계 for 44 days)
const STUCK_DAYS=1.5;        // the same stall on top of the card may not stay longer
const REPEAT_FAILS=12;       // the same button failing again and again with nothing changing
// The three default starts first, then every other playable nation's default start and one start of each ecology the
// first three do not cover (coast, marsh, snow, basin), so a dead end on one kind of land shows up here.
const pick=(nation,ecology)=>startingProvinces(nation).find(p=>layoutOf(p.id)?.ecology===ecology)?.id;
const STARTS=[{nation:'estern'},{nation:'silvaen'},{nation:'kardum'},{nation:'miel'},{nation:'rivente'},{nation:'arsel'},{nation:'broden'},{nation:'neiren'},
 {nation:'estern',provinceId:pick('estern','coast')},{nation:'estern',provinceId:pick('estern','marsh')},{nation:'arsel',provinceId:pick('arsel','snow')},{nation:'arsel',provinceId:pick('arsel','basin')}]
 .slice(0,+(process.env.TG_GUIDE_SITES||12));

function play(start){
 const c=new Campaign(start),log=[],ranks=[{rank:c.rank,day:0}],stalls=[],fails=new Map(),cool=new Map();
 const s=()=>c.active;
 let top=null,topSince=0,worstFail=null;
 // One press of a button: skipped while that button was pressed less than `wait` game seconds ago (a person waits to see
 // what happened), and a failure counts toward the same button failing again and again.
 const act=(label,run,wait=20)=>{const t=cool.get(label);if(t!=null&&s().time-t<wait)return false;cool.set(label,s().time);
  const r=run(),ok=!!r?.ok,n=ok?0:(fails.get(label)||0)+1;fails.set(label,n);if(n>(worstFail?.n||0))worstFail={label,n,error:r?.error};
  if(log.length<4000)log.push([Math.round(s().time),label,ok?'ok':r?.error||'fail']);
  // The failure sentence names the fix ("연료 부족 · 시장에서 연료를 수입하세요"): a person does that next.
  if(!ok&&/연료를 수입/.test(r?.error||''))act('연료 수입',()=>s().buy('fuel',10),30);
  return ok;};
 const ready=(label,wait=40)=>{const t=cool.get(label);if(t!=null&&s().time-t<wait)return false;cool.set(label,s().time);return true;};
 // The preview accepts the tile (canBuild) and the warehouse door can reach it, nearest the warehouse first.
 const place=type=>{const sim=s();
  if(type==='expand'){const w=sim.warehouse||{x:12,z:12};const opts=[];for(let x=0;x<6;x++)for(let z=0;z<6;z++)if(sim.canExpand(x,z))opts.push([x,z]);opts.sort((a,b)=>Math.hypot(a[0]*4+2-w.x,a[1]*4+2-w.z)-Math.hypot(b[0]*4+2-w.x,b[1]*4+2-w.z));return opts.length?act('영토 확장',()=>sim.expand(...opts[0])):act('영토 확장',()=>({ok:false,error:'확장할 구역 없음'}));}
  const lack=shortfall(sim,{money:sim.buildCost(type),items:BUILDINGS[type].materials||{}});
  if(lack.some(v=>v.id!=='money')){for(const v of lack.filter(v=>v.id!=='money'))act(RESOURCES[v.id].name+' 수입',()=>sim.buy(v.id,v.n));return false;}
  if(lack.length){money();return false;}
  const w=sim.warehouse,door=w&&sim.entries(w)[0],center=w||{x:12,z:12};
  const tiles=[...sim.owned].map(k=>k.split(',').map(Number)).sort((a,b)=>Math.abs(a[0]-center.x)+Math.abs(a[1]-center.z)-Math.abs(b[0]-center.x)-Math.abs(b[1]-center.z));
  for(const [x,z] of tiles){if(sim.canBuild(type,x,z))continue;if(door&&type!=='road'&&!sim.routeTo(door,{x,z,size:1}))continue;return act(BUILDINGS[type].name+' 짓기',()=>sim.build(type,x,z));}
  return act(BUILDINGS[type].name+' 짓기',()=>({ok:false,error:'놓을 자리 없음'}));};
 // Money short: the emergency fund when the card offers it, else 재고 팔기 from the sell hint list.
 const money=()=>{const sim=s(),r=recoveryState(sim);if(r.ready)return act('회생 자금',()=>sim.recover());const sale=sellableStock(sim,plannedNeeds(sim,nextBuild(sim)));for(const v of sale.items.slice(0,3))act(RESOURCES[v.id].name+' 팔기',()=>sim.sell(v.id,Math.min(v.n,quickSaleLot(sim,v.id)||v.n)));};
 const goal=key=>{const sim=s(),a=goalAction(sim,key);if(!a||!ready('goal:'+a.label,a.kind==='tool'?90:30))return;
  // "○○ 하나 더" once per rank: a person adds one more and watches, not one every minute and a half.
  if(a.kind==='tool'){if(a.tool!=='expand'&&sim.buildings.some(b=>b.type===a.tool)&&!ready('more:'+sim.rank+':'+a.tool,1e9))return;return place(a.tool);}
  if(a.kind==='contract')return contractState(sim).ready?act('납품',()=>sim.fulfill()):null;   // a greyed button is not pressed
  if(a.kind==='repay')return act('상환',()=>sim.repay());
  if(a.kind==='sanitize')return sim.sanitizeShort?.()?null:act('방역',()=>sim.sanitize());
  if(a.kind==='market'&&a.item){const lack=a.amount-Math.floor(sim.availableStock(a.item));return lack>0?act(a.label,()=>sim.buy(a.item,lack)):null;}
  if(a.kind==='market'){const item=key.startsWith('sold:')?key.split(':')[1]:null;if(item&&sim.availableStock(item)>=1)return act(RESOURCES[item].name+' 팔기',()=>sim.sell(item,quickSaleLot(sim,item)));return money();}
  if(a.kind==='goals'&&key==='family'){const q=sim.rescueInfo();if(q.ready)return act('구출: '+q.label,()=>sim.rescue());
   // The rescue panel's import button for the goods the step lacks.
   for(const v of shortfall(sim,{items:RESCUE_PRICES[q.step]?.items}))act(RESOURCES[v.id].name+' 수입',()=>sim.buy(v.id,v.n));}
 };
 function operate(){const sim=s();
  const p=sim.promotion();if(p?.ready)return act('승급',()=>sim.promote());
  const tut=tutorialStep(sim);if(tut){if(tut.tool&&ready('tut:'+tut.tool,10))return place(tut.tool);if(tut.action==='contract'&&contractState(sim).ready)return act('첫 납품',()=>sim.fulfill());}
  if(!sim.warehouse)return;
  if(sim.health.infection>0&&sim.health.sanitationUntil<=sim.time&&ready('방역',30)){const why=sim.sanitizeShort?.();if(!why)act('방역',()=>sim.sanitize());else for(const v of shortfall(sim,ACTION_PRICES.sanitize).filter(v=>v.id!=='money'))act(RESOURCES[v.id].name+' 수입',()=>sim.buy(v.id,v.n));}
  const failures=sim.buildings.filter(b=>b.enabled!==false&&(b.health<100||blockHint(b.status,sim)));
  const urgent=failures.find(b=>b.health<=0||/경로|출입구|전력/.test(b.status))||failures[0];
  const key=urgent?urgent.type+':'+urgent.status:null;if(key!==top){top=key;topSince=sim.time;}
  if(key&&(sim.time-topSince)/DAY>STUCK_DAYS&&!stalls.some(v=>v.key===key&&v.since===topSince))stalls.push({key,since:topSince,day:+(topSince/DAY).toFixed(1),rank:sim.rank});
  if(urgent){
   const house=urgent.health>=100?crewHouse(urgent.status)||(urgent.status==='운반 대기'?'house':null):null,diag=house?{tool:house}:productionDiagnosis(sim,urgent,BUILDINGS,RESOURCES);
   if(urgent.status==='출입구 막힘'){const n=sim.doorBlockers(urgent)[0];if(n&&ready('unblock:'+n.id,20))act(BUILDINGS[n.type].name+' 철거',()=>sim.demolish(n.x,n.z));}
   else if(urgent.status==='창고 가득 참'){const sale=fullStoreSale(sim);if(sale){act(RESOURCES[sale.item].name+' 팔기',()=>sim.sell(sale.item,sale.lot));if(sale.discard)act(RESOURCES[sale.item].name+' 버리기',()=>sim.discardStock(sale.store,sale.item,sale.discard),40);if(!sim.autoSell[sale.item])sim.autoSell[sale.item]=true;}}
   else if(urgent.status==='자원 고갈'&&urgent.health>=100){const spot=plantSpot(sim,urgent);if(spot&&!sim.plantShort(spot.x,spot.z))act('묘목 심기',()=>sim.plant(spot.x,spot.z));else if(ready('deplete-expand',120))place('expand');}
   else if(urgent.health<100&&repairPlan(sim).list.length<2&&sim.money>=sim.repairCost(urgent))act('수리',()=>sim.repair(urgent.id));
   else if(diag?.tool&&ready('diag:'+diag.tool,90))place(diag.tool);
  }
  if(repairPlan(sim).list.length>1&&sim.money>=repairPlan(sim).cheapest&&ready('repairAll',20))act('모두 수리',()=>sim.repairAll());
  // The card's slow-spot row (ui-rules slowSpot): move the facility its spot slows most.
 const slow=slowSpot(sim);if(slow&&ready('slow:'+slow.building.id,120)&&sim.money>=slow.cost+60)act(BUILDINGS[slow.building.type].name+' 자리 옮기기',()=>sim.relocate(slow.building.id,slow.x,slow.z));
 const next=nextBuild(sim);if(next&&ready('next:'+next.type,30))place(next.type);
  if(contractState(sim).ready&&!contractConflict(sim))act('납품',()=>sim.fulfill());
  for(const part of promotionParts(sim,sim.promotion()).filter(v=>!v.done))goal(part.key);
  if(sim.money<60)money();
 }
 const days=()=>s().time/DAY;
 for(let i=0;c.rank<TARGET&&days()<LIMIT_DAYS+5;i++){
  if(i%8===0)operate();c.tick(.25);
  if(c.rank!==ranks.at(-1).rank)ranks.push({rank:c.rank,day:+days().toFixed(2)});
 }
 const sim=s();
 return {start,rank:c.rank,day:+days().toFixed(2),ranks,stalls,worstFail,money:Math.round(sim.money),buildings:sim.buildings.map(b=>b.type+':'+b.status),
  open:(sim.promotion()?.requirements||[]).filter(r=>!r.done).map(r=>r.name+' '+Math.floor(r.current)+'/'+r.target),tail:log.slice(-12)};
}

const results=STARTS.map(play);
for(const r of results)console.log(JSON.stringify({start:r.start,reached:RANKS[r.rank]?.name,day:r.day,ranks:r.ranks.map(v=>(v.rank+1)+'단계@'+v.day+'일'),stalls:r.stalls,worstFail:r.worstFail,money:r.money,open:r.open}));
let bad=0;
for(const r of results){const name=r.start.nation+(r.start.provinceId?'/'+r.start.provinceId:'');
 const gaps=r.ranks.slice(1).map((v,i)=>({rank:v.rank+1,days:+(v.day-r.ranks[i].day).toFixed(2)}));
 const checks=[
  ['reaches 8단계 within '+LIMIT_DAYS+' days',r.rank>=TARGET&&r.day<=LIMIT_DAYS,{rank:r.rank+1,day:r.day,open:r.open,buildings:r.buildings,tail:r.tail}],
  ['no rank takes over '+STAGE_DAYS+' days',gaps.every(g=>g.days<=STAGE_DAYS)&&(r.rank>=TARGET||r.day-r.ranks.at(-1).day<=STAGE_DAYS),gaps],
  ['no stall stays on the card over '+STUCK_DAYS+' days',r.stalls.length===0,r.stalls],
  ['no button fails '+REPEAT_FAILS+' times in a row',(r.worstFail?.n||0)<REPEAT_FAILS,r.worstFail],
 ];
 if(r.rank>=TARGET&&r.day>PACE_DAYS)console.log('SLOW '+name+' · 8단계 on day '+r.day+' (goal '+PACE_DAYS+') :: '+JSON.stringify(gaps));
 for(const [label,ok,detail] of checks){console.log((ok?'PASS ':'FAIL ')+name+' · '+label+(ok?'':' :: '+JSON.stringify(detail).slice(0,1500)));if(!ok)bad++;}
}
assert.equal(bad,0,bad+' guide-bot checks failed');
console.log('\n[guide-bot] a screen-only player reaches 8단계 from every start without a dead end');
