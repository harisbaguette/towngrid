import {remainingSeconds} from './game-time.js';
// What the HUD shows, derived from the same simulation data the rules use.
// Plain JS so node probes (tests/audit) can check the screen logic without a browser.
import {BUILDINGS,RESOURCES} from './simulation.js';
import {RACES,RANKS,unlockRank} from './world.js';
import {operationHint} from './proximity.js';
import {provinceZone} from './infrastructure.js';
import {SERVICE_OUTPUTS} from './production-visuals.js';
import {recoveryReady,RECOVERY_LIMIT} from './economy.js';
import {EXPANSION_BUILDINGS,EXPANSION2_BUILDINGS} from './industry.js';
import {accepts} from './storage.js';

const particle=(w,withFinal,without)=>{const c=w.charCodeAt(w.length-1)-0xac00;return w+(c>=0&&c<11172&&c%28?withFinal:without);};
export const objectOf=w=>particle(w,'을','를');
export const topicOf=w=>particle(w,'은','는');
export const subjectOf=w=>particle(w,'이','가');

/** House type that brings the crew race a stalled facility waits for ("드워프 주민 필요"), or null. */
export function crewHouse(status){
 const race=Object.keys(RACES).find(r=>status===RACES[r].name+' 주민 필요');
 return (race&&Object.keys(BUILDINGS).find(k=>BUILDINGS[k].home&&(BUILDINGS[k].resident||'human')===race))||null;
}
/** Haulers are the bottleneck: more facilities hold full output (운반 대기, three at least) than there are residents, all busy. A full output
 *  stops the facility, and without this the card said 생산망 연결됨 (tests/guide-bot.mjs: 2 houses for 16 facilities). */
export function haulersShort(s){const full=s.buildings.filter(b=>b.status==='운반 대기'&&b.enabled!==false).length;return full>=Math.max(3,s.workers.length)&&s.workers.length>0&&s.workers.every(w=>w.task);}
/** Advice for a blocked status, including the crew stall that operationHint has no text for. Empty when running. */
// Pass the simulation for advice that quotes a time (real seconds at its speed) or names facilities already unlocked.
export function blockHint(status,sim){if(status==='운반 대기')return sim&&haulersShort(sim)?'운반할 주민이 모자랍니다 · 주민 주택을 더 지으세요.':'';const hint=operationHint(status,sim);if(hint)return hint;const house=crewHouse(status);return house?BUILDINGS[house].name+' 건설 필요':'';}

/** The export road to the west gate is cut, so every sale stops; auto tells whether an auto sale is waiting on it. */
export function exportBlocked(s){
 if(!s.warehouse||typeof s.exportStatus!=='function')return null;const e=s.exportStatus();if(e.connected)return null;
 return {error:e.error,auto:Object.entries(s.autoSell||{}).some(([r,on])=>on&&RESOURCES[r]&&Math.floor(s.stock[r]||0)>s.minimumStock(r))};
}

/** Every promotion condition: listed requirements, the operating trial and the fee. */
export function promotionParts(s,p){
 if(!p)return [];
 const parts=p.requirements.map(r=>({key:r.key,label:r.name,current:Math.min(r.current,r.target),target:r.target}));
 if(p.trial)parts.push({key:'trial:'+p.trial.key,label:p.trial.name,current:Math.min(p.trial.displayCurrent,p.trial.displayTarget),target:p.trial.displayTarget,done:p.trial.done});
 if(p.fee>0)parts.push({key:'fee',label:'승급비',current:Math.min(Math.floor(s.money),p.fee),target:p.fee,unit:'G'});
 return parts.map(v=>({...v,done:v.done??v.current>=v.target}));
}
/**
 * K-01: the one thing to press for an unmet promotion condition, so every condition has its button on the operations
 * card and in the rank dialog. kind: tool (open the placement tool `tool`), market, contract (s.fulfill), repay,
 * sanitize, world (campaign window), goals (rank dialog section), speed (run at 4x). Every requirement key of RANKS,
 * every trial key and the fee map to one (tests/fix-20260930/goal-actions.mjs counts them).
 */
const CAMPAIGN_GOALS=['deliveries','railRoutes','sites','defense','investment','support','recognition','territories'];
export function goalAction(s,key){
 const [kind,item]=key.split(':'),build=(type,label)=>type&&unlockRank(type)<=s.rank&&offered(s,type)?{kind:'tool',tool:type,label:label||BUILDINGS[type].name+(s.buildings.some(b=>b.type===type)?' 하나 더':' 짓기')}:null;
 const maker=it=>{const list=makersOf(s,it);return list.find(k=>!s.buildings.some(b=>b.type===k))||list[0]||null;};
 // A maker that already stands but waits for a material nothing here makes gets its supplier, not "하나 더"
 // (tests/guide-bot.mjs: 방직소 sat at 목화 대기 for 18 days while the goal row offered 방직소 하나 더).
 const starved=it=>{for(const b of s.buildings){if(b.health<=0||outputOf(s,b)!==it)continue;const r=Object.keys(RESOURCES).find(k=>b.status===RESOURCES[k].name+' 대기');
  if(!r||s.buildings.some(o=>o.health>0&&outputOf(s,o)===r))continue;const t=maker(r),a=t&&build(t,BUILDINGS[t].name+' 짓기 · '+RESOURCES[r].name);if(a)return a;}return null;};
 if(kind==='produced')return starved(item)||build(maker(item))||{kind:'market',label:(RESOURCES[item]?.name||'')+' 공급 확인'};
 if(kind==='sold')return s.availableStock?.(item)>=1?{kind:'market',label:RESOURCES[item].name+' 팔기'}:starved(item)||build(maker(item))||{kind:'market',label:'시장 열기'};
 if(kind==='building')return build(item)||{kind:'goals',label:'승급 조건 보기'};
 if(kind==='trial'){
  if(item==='delivery')return build('house','주민 주택 짓기 · 운반 주민');
  if(item==='reserves'||item==='diversity')return {kind:'market',label:item==='reserves'?'모자란 재고 수입':'다른 품목 팔기'};
  if(item==='direct'){const n=nextBuild(s,{any:true});return n?{kind:'tool',tool:n.type,label:n.name+' 짓기 · 가공 사슬'}:{kind:'speed',label:'4배속으로 운반'};}
  if(item==='healthy')return s.health?.infection>0?{kind:'sanitize',label:'방역'}:{kind:'speed',label:'4배속으로 버티기'};
  if(item==='defended')return build('wardpost','경비 초소 짓기')||{kind:'speed',label:'4배속으로 습격 기다리기'};
  if(item==='uptime')return {kind:'speed',label:'4배속으로 가동'};
  return {kind:'world',label:'세계 지도 열기'};
 }
 if(key==='fee'||key==='revenue')return {kind:'market',label:'재고 팔기'};
 if(key==='contracts'){
  // The open order's good: deliver it, or build what makes it, or import it when this land cannot make it
  // (tests/guide-bot.mjs: 훈제 생선 20 ordered, nothing here made it, and the only button was a greyed 납품 for five days).
  const c=typeof s.contract==='function'?s.contract():null,ready=typeof s.contractStatus!=='function'||contractState(s).ready;
  // A maker that stands but waits for a material nothing here makes (a smokehouse with no fishery) gets its supplier.
  const fix=!ready&&c?.item&&Math.floor(s.availableStock?.(c.item)||0)<c.amount?starved(c.item):null;if(fix)return fix;
  // Made here but eaten by the chain faster than the order fills (guide-bot 2026-10-03: 밀 16 open for eleven days with
  // 7,000G in hand): with money to spare the card offers to import the rest of the order.
  const have=Math.floor(s.availableStock?.(c?.item)||0),lack=c?.item?c.amount-have:0;
  if(!ready&&lack>0&&s.buildings.some(b=>b.health>0&&outputOf(s,b)===c.item)&&s.money>=Math.ceil(RESOURCES[c.item].price*1.85)*lack*3+300&&!s.shipments?.some(sh=>sh.kind==='import'&&sh.item===c.item))
   return {kind:'market',label:RESOURCES[c.item].name+' '+lack+'개 수입 · 납품용',item:c.item,amount:c.amount};
  if(ready||!c?.item||s.buildings.some(b=>b.health>0&&outputOf(s,b)===c.item)||have>=c.amount)return {kind:'contract',label:'납품'};
  return build(maker(c.item),BUILDINGS[maker(c.item)]?.name+' 짓기 · 납품 '+RESOURCES[c.item].name)||{kind:'market',label:RESOURCES[c.item].name+' 수입',item:c.item,amount:c.amount};
 }
 if(key==='expansions')return {kind:'tool',tool:'expand',label:'영토 확장 · '+(typeof s.expansionCost==='function'?s.expansionCost():'')+'G'};
 if(key==='debtFree')return {kind:'repay',label:Math.min(s.debt||0,200)+'G 상환'};
 if(key==='family')return {kind:'goals',label:'구출 단계 진행'};
 if(key==='workers')return build('house','주민 주택 짓기');
 if(key==='power')return build(['generator','windturbine','watermill','arcanepower','solarpanel'].find(t=>unlockRank(t)<=s.rank&&placeSpot(s,t)))||{kind:'goals',label:'승급 조건 보기'};
 if(key==='automatic')return build('logistics','자동 물류센터 짓기')||{kind:'goals',label:'승급 조건 보기'};
 if(CAMPAIGN_GOALS.includes(key))return {kind:'world',label:'세계 지도 열기'};
 return null;
}
/** Gauge percent; reaches 100 only when promote() would succeed. */
export function promotionProgress(s,p){
 const parts=promotionParts(s,p);if(!parts.length)return 100;
 const v=Math.round(parts.reduce((n,x)=>n+(x.done?1:Math.min(1,x.current/Math.max(1,x.target))),0)/parts.length*100);
 return p.ready?100:Math.min(99,v);
}

/** Open first-session guide step, or null once the first promotion is done. */
export function tutorialStep(s){
 // The first promotion needs no contract, so a 첫 납품 step still open would keep the guide (and hide the operations card) past it.
 if(s.rank>0)return null;
 const p=s.promotion(),need=p?[...p.requirements.filter(r=>!r.done).map(r=>r.name+' '+r.target),...(p.trial&&!p.trial.done?[p.trial.name]:[]),...(s.money<p.fee?['승급비 '+p.fee+'G']:[])].join(' · '):'';
 const steps=[
 {done:!!s.warehouse,title:'첫 창고',text:'밝은 경계 안에 창고를 놓으세요.',tool:'warehouse'},
 {done:s.workerCount>0,title:'주민을 맞이하세요',text:'주거 탭에서 주민 주택을 지으세요. 주민이 짐을 나릅니다.',tool:'house'},
 {done:s.buildings.some(b=>b.type==='well'),title:'물을 공급하세요',text:'창고 주변에 우물을 지으세요.',tool:'well'},
 {done:s.buildings.some(b=>b.type==='field'),title:'밀을 생산하세요',text:'우물 근처에 밀밭을 놓고 통로를 남기세요.',tool:'field'},
 {done:s.buildings.some(b=>b.type==='lumber'),title:'목재를 확보하세요',text:'나무에서 네 칸 이내에 벌목장을 지으세요.',tool:'lumber'},
 {done:s.contracts>0,title:'첫 납품',text:s.contractStatus?.().inTransit?'납품 물건이 관문으로 가는 중입니다. 도착하면 값을 받습니다.':'창고에 모인 재고로 영주에게 납품하세요.',tool:null,action:'contract'},
 {done:s.rank>0,title:'첫 승급',text:need?need+' 달성 후 승급':'지금 승급할 수 있습니다.',tool:null,waiting:!!need}
 ];
 const index=steps.findIndex(v=>!v.done);return index<0?null:{...steps[index],index,total:steps.length};
}

/** First rank at which some facility may make the item, alternative products included (Infinity when none does). */
const firstMakerRank=item=>Math.min(Infinity,...Object.keys(BUILDINGS).flatMap(k=>productsOf(BUILDINGS[k]).filter(r=>r.output===item).map(r=>Math.max(unlockRank(k),r.unlock||0))));
/** Import and production are both possible once any product line of the item is unlocked (economy.js purchase). */
export const permitted=(s,item)=>item==='fuel'||firstMakerRank(item)<=s.rank;
/** Why an item cannot be gathered at this rank ("지역 공급자 승급 후"), or '' when it is in stock or obtainable. */
export function itemGate(s,item,need){
 if(!RESOURCES[item]||s.stock[item]>=need)return '';
 const rank=firstMakerRank(item);
 return rank===Infinity||rank<=s.rank?'':RANKS[rank]?.name+' 승급 후';
}

// Top resource strip per rank band (balance patch 8-1). Undefined items are skipped and the band is topped up from earlier bands.
const HUD_TIERS=[[8,['wood','stone','water','grain','bread']],[14,['plank','brick','cloth','cake','glass']],[23,['steel','fuel','wire','circuit','car']],[Infinity,['concrete','lamp','engine','mithril','airship']]];
export function hudResources(rank){
 const tier=HUD_TIERS.findIndex(([limit])=>rank<limit),list=HUD_TIERS[tier][1].filter(r=>RESOURCES[r]);
 for(let i=tier-1;i>=0&&list.length<5;i--)for(const r of HUD_TIERS[i][1])if(list.length<5&&RESOURCES[r]&&!list.includes(r))list.push(r);
 return list;
}

/** Race rules of the faction, read from the data logistics.js enforces (RACES crafts / hauler, BUILDINGS skilled). */
export function crewRules(s){
 const races=s.availableRaces.map(r=>RACES[r]).filter(Boolean),names=list=>list.filter(k=>BUILDINGS[k]).map(k=>BUILDINGS[k].name).join('·');
 const rules=races.filter(r=>r.crafts?.length).map(r=>r.name+' 전담: '+names(r.crafts));
 const haulers=races.filter(r=>r.hauler).map(r=>r.name),skilled=names(Object.keys(BUILDINGS).filter(k=>BUILDINGS[k].skilled));
 if(haulers.length&&skilled)rules.push(topicOf(haulers.join('·'))+' '+skilled+'에 들어가지 못합니다');
 return rules;
}

/** Shown in the build dock for this settlement: race housing of the faction and ice/mountain-only facilities of the province. Rank is not checked. */
export function offered(s,type){
 const d=BUILDINGS[type];if(!d||(d.resident&&!s.availableRaces.includes(d.resident)))return false;
 if(!d.ice&&!d.mountain)return true;const zone=provinceZone(s);return (!d.ice||zone.ice)&&(!d.mountain||zone.mountain);
}
/** Products of a facility: its recipes, or the single output it always makes. */
export const productsOf=d=>d?.recipes?.length?d.recipes:d?.output?[{id:null,output:d.output,inputs:d.inputs||{},amount:d.amount,period:d.period}]:[];
// Services (power, irrigation...) are not stock items; they carry their own names.
const itemName=k=>RESOURCES[k]?.name||SERVICE_OUTPUTS[k]?.name;
const chainOf=r=>[Object.keys(r.inputs||{}).map(itemName).filter(Boolean).join('·'),itemName(r.output)].filter(Boolean).join(' → ');

/**
 * What to build next once the first-session guide is over (rank 1+): an unbuilt producer whose output the next promotion
 * still needs and nothing built makes, preferring what this rank just opened; otherwise the newest producer of this rank.
 * null when nothing fits. {type,name,output,chain,text}.
 */
// Placement and supply checks for the guide (K-04). canBuild walks the export road and the doors, so the answers are kept
// per simulation revision.
const placeMemo=new WeakMap();
const memo=(s,key,fn)=>{let m=placeMemo.get(s);if(!m||m.rev!==s.revision){m={rev:s.revision,v:new Map()};placeMemo.set(s,m);}if(!m.v.has(key))m.v.set(key,fn());return m.v.get(key);};
/** A free owned tile where `type` can stand now (cost aside), or null. */
export function placeSpot(s,type){
 return memo(s,'spot:'+type,()=>{if(typeof s.canBuild!=='function')return null;for(const k of s.owned||[]){const [x,z]=k.split(',').map(Number);if(!s.canBuild(type,x,z,true))return {x,z};}return null;});
}
const unlocked=(s,type)=>unlockRank(type)<=s.rank&&offered(s,type);
/** Facility types that can make `item` here and now: unlocked, offered and with a free tile (or already standing). */
export function makersOf(s,item){
 return Object.keys(BUILDINGS).filter(k=>productsOf(BUILDINGS[k]).some(r=>r.output===item&&!(r.unlock>s.rank))&&unlocked(s,k)&&(s.buildings.some(b=>b.type===k&&b.health>0)||placeSpot(s,k)));
}
/** Whether this site can get `item`: a standing maker, stock on hand, or a maker it can build now (one step deep). */
function obtainable(s,item,made){
 return made.has(item)||(typeof s.availableStock==='function'?s.availableStock(item):s.stock?.[item]||0)>=1||makersOf(s,item).length>0;
}
/**
 * One more maker of a raw good that more than twice as many facilities use and the store has nearly run out of
 * (tests/guide-bot.mjs: one wheat field fed a mill, a distillery, a henhouse and the lord's grain orders for ten days,
 * and the card had nothing to say because each user showed 운반 대기 or 생산 중 in turn). null when supply keeps up.
 */
function scaleUp(s){
 const live=s.buildings.filter(b=>b.health>0&&b.enabled!==false),use={},make={};
 for(const b of live){const out=outputOf(s,b);if(out)(make[out]||=[]).push(b);const r=typeof s.recipeOf==='function'?s.recipeOf(b):null;for(const i of Object.keys((typeof s.effectiveInputs==='function'?s.effectiveInputs(b):r?.inputs)||{}))use[i]=(use[i]||0)+1;}
 const short=Object.keys(use).filter(r=>make[r]?.length&&use[r]>=2*make[r].length+1&&(typeof s.availableStock==='function'?s.availableStock(r):s.stock?.[r]||0)<10)
  .sort((a,c)=>use[c]/make[c].length-use[a]/make[a].length);
 for(const r of short){const type=make[r][0].type;if(!offered(s,type)||!placeSpot(s,type))continue;
  return {type,name:BUILDINGS[type].name,output:r,chain:RESOURCES[r].name+' 쓰는 곳 '+use[r]+' · 만드는 곳 '+make[r].length,text:BUILDINGS[type].name+' 하나 더'};}
 return null;
}
/**
 * "다음 건물" card: a facility whose recipe makes a good an open promotion condition asks for. A facility merely unlocked at this
 * rank is not suggested (player audit K-04: the guide built a smokehouse, salt and cane fields that served no goal and shut the
 * well in); `any` restores that fallback for the direct-delivery trial, which needs some processing building.
 */
export function nextBuild(s,{any=false}={}){
 if(!s.warehouse||s.rank<1)return null;
 const built=new Set(s.buildings.map(b=>b.type)),made=new Set(s.buildings.flatMap(b=>productsOf(BUILDINGS[b.type]).map(r=>r.output)));
 // Goods a pending requirement asks to make or sell that nothing here makes yet.
 const wanted=(s.promotion()?.requirements||[]).filter(r=>!r.done&&/^(produced|sold):/.test(r.key)).map(r=>r.key.split(':')[1]).filter(item=>!made.has(item));
 // Every sale, order and import rides a vehicle that burns fuel; running dry with nothing making it leaves only an import at
 // the round-trip price (tests/guide-bot.mjs: 10 fuel quoted at 1,529G with 750G in hand), so from 3단계, or once the starting
 // 40 fall under 25, the guide names a fuel maker first.
 // An open order counted by the next rank whose good nothing here makes is wanted too (see goalAction contracts).
 const order=typeof s.contract==='function'&&(s.promotion()?.requirements||[]).some(r=>!r.done&&r.key==='contracts')?s.contract()?.item:null;
 if(order&&!made.has(order)&&!wanted.includes(order))wanted.push(order);
 if(!made.has('fuel')&&RESOURCES.fuel&&(s.rank>=2||(typeof s.availableStock==='function'?s.availableStock('fuel'):s.stock?.fuel||0)<25))wanted.unshift('fuel');
 let best=null,bestScore=0;
 for(const type of Object.keys(BUILDINGS)){
  const rank=unlockRank(type),products=productsOf(BUILDINGS[type]);
  if(built.has(type)||rank>s.rank||!products.length||!offered(s,type))continue;
  // G1-E8: the optional expansion chains are suggested only when one of their recipes can run on goods this site already
  // makes or holds; otherwise the guide would send the player to a workshop with no raw material.
  if((type in EXPANSION_BUILDINGS||type in EXPANSION2_BUILDINGS)&&!products.some(r=>Object.keys(r.inputs||{}).every(i=>made.has(i)||(typeof s.availableStock==='function'?s.availableStock(i):s.stock?.[i]||0)>=1)))continue;
  // K-04: only recipes whose inputs this land can get, and only when the facility has a free tile to stand on.
  const runnable=products.filter(r=>!(r.unlock>s.rank)&&Object.keys(r.inputs||{}).every(i=>obtainable(s,i,made)));
  if(!runnable.length)continue;
  const serving=runnable.find(r=>wanted.includes(r.output)),score=(serving?2:0)+(rank===s.rank?1:0);
  if(!serving&&!any)continue;
  if(!(score>bestScore||(score===bestScore&&score>0&&rank>unlockRank(best.type))))continue;
  if(!placeSpot(s,type))continue;
  [best,bestScore]=[{type,product:serving||runnable[0]},score];
 }
 if(!best){
  // At the start one vehicle carries every sale, order and import, and each export terminal adds a truck (export-route fleet).
  // With none standing the guide names the cheapest one that fits (tests/guide-bot.mjs waited days on 운송 수단이 모두 운행 중).
  if(any)return null;
  if(!s.buildings.some(b=>BUILDINGS[b.type].terminal)){
   const t=Object.keys(BUILDINGS).filter(k=>BUILDINGS[k].terminal&&unlockRank(k)<=s.rank&&offered(s,k)&&placeSpot(s,k)).sort((a,b)=>s.buildCost(a)-s.buildCost(b))[0];
   if(t)return {type:t,name:BUILDINGS[t].name,output:null,chain:'운송 수단 +1',text:BUILDINGS[t].name+' · 운송 수단 +1'};
  }
  return scaleUp(s);
 }
 const d=BUILDINGS[best.type],chain=chainOf(best.product);
 return {type:best.type,name:d.name,output:best.product.output,chain,text:d.name+' · '+chain};
}

/** Lock reason of a product ("지역 공급자 승급 후"), '' when it can be chosen. */
export function recipeLock(s,r){
 const need=typeof r.unlock==='number'?r.unlock:typeof r.unlock==='string'?RANKS.findIndex(v=>v.name===r.unlock):-1;
 return need>s.rank?(RANKS[need]?.name||'')+' 승급 후':'';
}
/** Product choices of a multi-product facility for the facility card; [] when it makes one thing. */
export function recipeChoices(s,b){
 const list=BUILDINGS[b.type]?.recipes;if(!Array.isArray(list)||list.length<2)return [];
 const current=(typeof s.recipeOf==='function'?s.recipeOf(b)?.id:null)??b.recipe??list[0].id;
 return list.map(r=>({...r,chain:chainOf(r),current:r.id===current,locked:recipeLock(s,r)}));
}

/**
 * Contract button state shared by the quick card and the rank dialog. With the delivery API (contractStatus) the button follows
 * `ready`, a cooldown shows its seconds and a shipment on the road shows 운송 중; older sims fall back to the stock check.
 */
export function contractState(s){
 const c=s.contract(),have=Math.floor(s.availableStock(c.item)),st=typeof s.contractStatus==='function'?s.contractStatus():null;
 if(!st)return {contract:c,have,ready:have>=c.amount,label:'납품',note:''};
 if(st.inTransit)return {contract:c,have,ready:false,label:'운송 중',note:'',transit:true};
 const wait=remainingSeconds(st.wait||0,s);
 if(wait>0)return {contract:c,have,ready:false,label:wait+'초',note:'',wait};
 // A short stock already shows as have/amount; the note is for other stops (export road cut).
 return {contract:c,have,ready:!!st.ready,label:'납품',note:!st.ready&&have>=c.amount?st.error||'':''};
}

/**
 * Export fleet for the market and the operations card: every vehicle slot, how many are out, and a fuel note only when
 * fuel is what holds shipments back now (every fuel-free vehicle is out and a fuel vehicle waits). null before the fleet API.
 */
export function fleetState(s){
 if(typeof s.exportStatus!=='function')return null;const e=s.exportStatus();if(!Array.isArray(e.vehicles))return null;
 const busy=e.vehicles.filter(v=>v.busy).length,waiting=e.vehicles.filter(v=>v.fuel&&!v.busy),freeOut=e.vehicles.every(v=>v.fuel||v.busy);
 const names=[...new Set(waiting.map(v=>v.name))].join('·');
 const short=freeOut&&waiting.length>0&&!e.fuelReady;
 return {vehicles:e.vehicles,busy,total:e.vehicles.length,fuelNote:short?'연료 부족':'',waiting:short?names+' 대기':'',fuelPerTrip:e.fuelPerTrip,spareFuel:e.spareFuel,destination:e.destination,duration:e.duration,distance:e.distance};
}

// ---- 2026-09-29 HUD fixes (F3a): problem -> fix actions, ledger, notices ----

/** Stock that can be sold now (above auto-sale reserve and contract hold), priced at the current market quote. */
export function sellableStock(s,keep={}){
 const items=[];let value=0;
 for(const id of Object.keys(RESOURCES)){
  const n=Math.floor(typeof s.availableStock==='function'?s.availableStock(id):s.stock[id]||0)-(typeof s.minimumStock==='function'?s.minimumStock(id):0)-(keep[id]||0);if(n<1)continue;
  const v=typeof s.saleQuote==='function'?s.saleQuote(id,Math.min(n,60))*n/Math.min(n,60):RESOURCES[id].price*n;
  items.push({id,n,value:Math.round(v)});value+=v;
 }
 return {value:Math.round(value),items:items.sort((a,b)=>b.value-a.value)};
}
/** K-05: goods the plans on screen still need, kept out of the sell hint: the suggested building's materials, the
 *  materials of a building a promotion condition asks for, the open lord order and a fuel reserve for the vehicles. */
export function plannedNeeds(s,next){
 const keep={},add=(m={},k=1)=>{for(const [r,n] of Object.entries(m))keep[r]=(keep[r]||0)+n*k;};
 if(next)add(BUILDINGS[next.type]?.materials);
 for(const part of promotionParts(s,s.promotion?.()).filter(v=>!v.done)){const a=goalAction(s,part.key);if(a?.kind==='tool'&&BUILDINGS[a.tool]&&a.tool!==next?.type)add(BUILDINGS[a.tool].materials);}
 const c=typeof s.contract==='function'?s.contract():null;if(c?.item)add({[c.item]:c.amount});
 // The vehicles burn fuel on every trip, the sale itself included: the hint never sells the last 20.
 add({fuel:20});
 return keep;
}
/** K-03: the price lists live in simulation.js ACTION_PRICES; the buttons lock on the rules' own *Short() checks. */
/** What is missing for a price {money, items} against money and stock free of reservations: [] when it can be paid. */
export function shortfall(s,p){
 const out=[];if(p?.money&&s.money<p.money)out.push({id:'money',n:Math.ceil(p.money-s.money),label:Math.ceil(p.money-s.money).toLocaleString('ko-KR')+'G'});
 for(const [r,n] of Object.entries(p?.items||{})){const have=Math.floor(typeof s.availableStock==='function'?s.availableStock(r):s.stock[r]||0);if(have<n)out.push({id:r,n:n-have,label:RESOURCES[r].name+' '+(n-have)});}
 return out;
}
/** A full store holds every good together (storage.js capacity), so its fix sells the largest stock no plan on screen needs,
 *  not the stalled facility's own output (tests/guide-bot.mjs sold the smoked fish an open order was waiting on). */
export function fullStoreSale(s,output=null){
 // A depot set to one kind of goods (storage.js STORE_MODES) takes nothing else: selling water out of a full water tank
 // makes no room for the wood a lumber camp waits to store. With such a depot the goods are ranked by what the stores
 // taking the stalled `output` hold; without one every store takes every good and the ranking is the plain stock.
 const items=sellableStock(s,plannedNeeds(s,nextBuild(s))).items,dedicated=output&&s.buildings?.some(b=>b.mode);
 const inRoom=id=>[s.starterStore,...s.buildings].filter(b=>b?.inventory&&!(b.health<=0)&&b.enabled!==false&&!(b.movingUntil>s.time)&&accepts(b,output)).reduce((n,b)=>n+(b.inventory[id]||0),0);
 const top=dedicated?items.map(v=>({...v,n:Math.min(v.n,Math.floor(inRoom(v.id)))})).filter(v=>v.n>0).sort((a,b)=>b.n-a.n)[0]:items.sort((a,b)=>b.n-a.n)[0];if(!top)return null;
 // With no fuel a sale cannot leave and an import has no room, and a distillery cannot put fuel in a full store: the only way
 // out is to throw some stock away (tests/guide-bot.mjs locked at 1,080/1,080 with fuel 0 for ten days).
 const store=s.warehouse,held=Math.floor(store?.inventory?.[top.id]||0),dry=!!fleetState(s)?.fuelNote;
 return {item:top.id,lot:quickSaleLot(s,top.id),discard:dry&&store&&typeof s.discardStock==='function'?Math.min(30,held):0,store:store?.id};
}
/** One market lot for a quick sale: 10 or the trade route capacity when smaller, never more than what may be sold. */
export function quickSaleLot(s,item){
 const cap=typeof s.tradeConnection==='function'?s.tradeConnection().capacity||10:10;
 const free=Math.floor(typeof s.availableStock==='function'?s.availableStock(item):s.stock[item]||0);
 return Math.max(0,Math.min(10,cap,free));
}
/** Item a facility makes now (chosen product of a multi-product facility). */
export const outputOf=(s,b)=>(typeof s.recipeOf==='function'?s.recipeOf(b)?.output:null)||BUILDINGS[b.type]?.output||null;

/** Owned empty tile nearest to a depleted gatherer, inside its four-tile reach, where plant() succeeds (economy.js plant). */
export function plantSpot(s,b){
 if(BUILDINGS[b.type]?.natural!=='tree')return null;let best=null,bestD=Infinity;
 for(let x=b.x-4;x<=b.x+4;x++)for(let z=b.z-4;z<=b.z+4;z++){
  const d=Math.abs(x-b.x)+Math.abs(z-b.z);if(d<1||d>4||d>=bestD)continue;const t=s.tile(x,z);
  if(!t||t.terrain==='water'||!s.ownedAt(x,z)||s.at(x,z)||t.nature||s.roads.has(x+','+z))continue;best={x,z};bestD=d;
 }
 return best;
}

/** Damaged facilities, worst first, with the summed repair cost (simulation repairAllCost) and the cheapest single repair. */
export function repairPlan(s){
 const list=s.buildings.filter(b=>b.health<100).sort((a,b)=>a.health-b.health),costs=list.map(b=>s.repairCost(b));
 return {list,total:typeof s.repairAllCost==='function'?s.repairAllCost():costs.reduce((n,v)=>n+v,0),cheapest:costs.length?Math.min(...costs):0};
}
/** Whether an emergency fund may be granted now (economy.js recoveryReady) and, when only the five-day wait blocks it, how long. */
export function recoveryState(s){
 if(recoveryReady(s))return {ready:true,reason:''};
 if(s.money>RECOVERY_LIMIT)return {ready:false,reason:''};
 const last=s.campaign?.treasury?.lastRecoveryDay??s.lastRecoveryDay??-10;
 return {ready:false,reason:Math.max(1,5-(s.day-last))+'일 후 회생 자금'};
}

/**
 * The open contract takes stock the next promotion still needs (J6): the goal item itself when the goal is to sell it, or an
 * ingredient of a goal item, and what is left after the delivery no longer covers the rest of that goal.
 * null when there is no conflict. {item,goal,kind,short}
 */
export function contractConflict(s){
 const c=s.contract?.(),p=s.promotion?.();if(!c||!p)return null;
 const left=Math.floor(typeof s.availableStock==='function'?s.availableStock(c.item):s.stock[c.item]||0)-c.amount;
 for(const r of p.requirements||[]){
  if(r.done)continue;const [kind,goal]=String(r.key).split(':');if(kind!=='produced'&&kind!=='sold')continue;
  const rest=Math.max(0,r.target-r.current);let need=0;
  if(goal===c.item)need=kind==='sold'?rest:0;
  else{const line=Object.values(BUILDINGS).flatMap(d=>productsOf(d)).find(x=>x.output===goal&&(x.inputs||{})[c.item]);if(line)need=Math.ceil(rest/Math.max(1,line.amount||1))*line.inputs[c.item];}
  if(need>0&&left<need)return {item:c.item,goal,kind,short:need-Math.max(0,left)};
 }
 return null;
}

/** Money back for demolishing a facility: the simulation's own refund when it has one, else the long-standing 40 % rule. */
export function demolishRefund(s,b){
 if(typeof s.demolishRefund==='function'){const r=s.demolishRefund(b);return typeof r==='number'?{money:r}:r||{money:0};}
 return {money:Math.floor((BUILDINGS[b.type]?.cost||0)*(b.specialized&&b.race==='goblin'?.65:.4))};
}

/** Facilities that open at exactly this rank and this settlement can build. */
export const unlockedAt=(s,rank)=>Object.keys(BUILDINGS).filter(t=>unlockRank(t)===rank&&rank>0&&offered(s,t));

/**
 * Tile numbers for the info panel. `now` holds the ones a facility of the current rank can use; the rest wait behind 더 보기.
 * {id,label,value,now}
 */
export function tileMetrics(s,t){
 const uses=type=>!BUILDINGS[type]||s.rank>=unlockRank(type);
 return [
  {id:'field',label:'밀 생산 효율',value:Math.round(s.tileMultiplier('field',t.x,t.z)*100)+'%',now:uses('field')},
  {id:'well',label:'취수 효율',value:Math.round(s.tileMultiplier('well',t.x,t.z)*100)+'%',now:uses('well')},
  {id:'quarry',label:'채석 효율',value:Math.round(s.tileMultiplier('quarry',t.x,t.z)*100)+'%',now:uses('quarry')},
  {id:'mana',label:'마력 농도',value:(t.mana??0)+'%',now:BUILDINGS.manaextractor?uses('manaextractor'):false},
  {id:'oil',label:'원유 농도',value:(t.oil??t.ore??0)+'%',now:BUILDINGS.oilpump?uses('oilpump'):false},
 ];
}

/**
 * Where a notice goes. Warnings ask the player to act and always pop up; successes confirm; plain info (daily upkeep,
 * world news, a storm that did no harm) goes to the ledger news list unless it answers the player's own action just now.
 * Notices of a settlement not on screen pop up only as warnings, named after that settlement.
 * Returns 'warning' | 'success' | 'info' | null (null = news list only).
 */
export function noticeRoute(notice,{active=true,ownAction=false}={}){
 if(notice.type==='warning')return 'warning';
 if(!active)return null;
 if(notice.type==='success')return 'success';
 return ownAction&&notice.type!=='news'?'info':null;
}

/**
 * Day-boundary snapshot of what the ledger compares: money, income and expenses booked so far that day, the previous
 * day's income and expenses, stock, produced and sold counters.
 * G3-06: money, produced and sold are kept once for the whole campaign (campaign.js SHARED), so with more than one site
 * the snapshot covers every site (stock and budgets summed) instead of mixing one site's stock with all sites' output.
 * A site still on the previous day (off-screen sites tick in batches) has booked nothing for the new day yet.
 */
export function ledgerSnapshot(s,campaign){
 const sims=campaign?.sites?.length>1?campaign.sites.map(v=>v.sim):[s],stock={};
 for(const v of sims)for(const [k,n] of Object.entries(v.stock||{}))stock[k]=(stock[k]||0)+n;
 const rolled=v=>v===s||v.day>=s.day,sum=f=>sims.reduce((n,v)=>n+(f(v.budget||{},rolled(v))||0),0);
 const today=key=>sum((b,r)=>r?b[key]:0),yesterday=key=>sum((b,r)=>r?b['last'+key[0].toUpperCase()+key.slice(1)]:b[key]);
 return {day:s.day,time:s.time,money:s.money,sites:sims.length,income:today('income'),expenses:today('expenses'),lastIncome:yesterday('income'),lastExpenses:yesterday('expenses'),stock,produced:{...(s.produced||{})},sold:{...(s.sold||{})}};
}
/**
 * Difference of two snapshots: money change and, per item, made / sold / used (made - sold - stock change, other uses
 * such as facility inputs, contracts and construction). Items with no movement are left out.
 */
export function ledgerDiff(a,b){
 const items=[];
 for(const id of Object.keys(RESOURCES)){
  const made=(b.produced[id]||0)-(a.produced[id]||0),sold=(b.sold[id]||0)-(a.sold[id]||0),change=Math.floor(b.stock[id]||0)-Math.floor(a.stock[id]||0);
  const used=Math.max(0,Math.round(made-sold-change));if(!made&&!sold&&!change)continue;
  items.push({id,made:Math.round(made),sold:Math.round(sold),used,change});
 }
 return {days:Math.max(1,(b.time-a.time)/80),money:Math.round(b.money-a.money),items:items.sort((x,y)=>(y.made+y.used)-(x.made+x.used))};
}
/**
 * Merge facility markers that would overlap on screen (B13): the most important marker of a close group stays and carries
 * the count of the rest. `solo` markers (selected, hovered) neither absorb nor join. Input items need x, y, rank, solo and
 * may give their screen width w (labels on), else gapX stands for it.
 */
export function clusterMarkers(items,gapX=50,gapY=28){
 const groups=[];
 for(const m of [...items].sort((a,b)=>b.rank-a.rank)){
  const g=!m.solo&&groups.find(v=>!v.lead.solo&&Math.abs(v.lead.x-m.x)<((v.lead.w||gapX)+(m.w||gapX))/2&&Math.abs(v.lead.y-m.y)<gapY);
  if(g)g.members.push(m);else groups.push({lead:m,members:[]});
 }
 return groups;
}

/**
 * Town Star's efficiency needle (docs/TOWNSTAR_RULES.md): the facility its spot slows most (shade, wind shelter or
 * pollution cutting at least 20%), with the nearest owned spot that runs it at least 15 points faster and the move's
 * price. null when every facility runs within 20% of its spot's best. The operations card shows it and tests/guide-bot.mjs
 * presses it, as a player would. The card renders every 0.4 s and checking a spot the way canRelocate does lifts the
 * facility off its tile, which bumps Simulation.revision and so rebuilds the scene: the answer is kept while the revision
 * stays the same, the whole list is checked under one lift, and money and the facility's shipments (canRelocate's other
 * checks, which change without a revision) are read when the answer is returned.
 */
const SLOW_SPOTS=new WeakMap();
export function slowSpot(s){
 if(typeof s.placementEffects!=='function'||typeof s.canRelocate!=='function')return null;
 const kept=SLOW_SPOTS.get(s),v=kept&&kept.revision===s.revision&&(!kept.spot||s.buildings.includes(kept.spot.building)&&!(kept.spot.building.movingUntil>s.time))?kept.spot:(()=>{const spot=findSlowSpot(s);SLOW_SPOTS.set(s,{revision:s.revision,spot});return spot;})();
 if(!v)return null;const b=v.building,cost=s.relocationCost(b);
 if(s.moneyShort?.(cost)||s.shipments?.some(sh=>sh.storeId===b.id||sh.terminalId==='b:'+b.id))return null;
 return {...v,cost};
}
function findSlowSpot(s){
 const penalty=(type,x,z)=>{const e=s.placementEffects(type,x,z);return {speed:e.speed,hit:(e.pollution||0)+(e.shade||0)+(e.windBlock||0)};};
 let worst=null;
 for(const b of s.buildings){const d=BUILDINGS[b.type];if(!d?.period||b.health<=0||b.enabled===false||b.movingUntil>s.time)continue;
  const now=penalty(b.type,b.x,b.z);if(!now.hit||now.speed>=.8)continue;if(!worst||now.speed<worst.from)worst={b,from:now.speed};}
 if(!worst)return null;const {b,from}=worst;
 // The faster spots, nearest first and the faster on a tie, judged where the facility stands now.
 const spots=[];
 for(const k of s.owned){const [x,z]=k.split(',').map(Number);if(s.at(x,z)||s.roads.has(k))continue;const to=s.placementEffects(b.type,x,z).speed;if(to<from+.15)continue;spots.push({x,z,to,far:Math.abs(x-b.x)+Math.abs(z-b.z)});}
 spots.sort((p,q)=>p.far-q.far||q.to-p.to);
 // canRelocate's tile check (canBuild with the facility off its tile) for the whole list under one lift.
 const list=s.buildings;let open=[];s.buildings=list.filter(v=>v!==b);s.revision++;
 try{open=spots.filter(p=>!s.canBuild(b.type,p.x,p.z,true));}finally{s.buildings=list;s.revision++;}
 const door=s.warehouse&&s.entries(s.warehouse)[0],best=open.find(p=>!door||s.routeTo(door,{x:p.x,z:p.z,size:1}));
 return best?{building:b,x:best.x,z:best.z,from,to:best.to}:null;
}

/** A depleted lumber camp or quarry: the nearest owned spot with trees or rock left within four tiles it can move to, or
 *  null. The operations card offers it beside planting and expanding; tests/guide-bot.mjs presses it first. */
export function depletedMove(s,b){
 const nature=BUILDINGS[b?.type]?.natural;if(!nature||typeof s.canRelocate!=='function')return null;let best=null;
 for(const k of s.owned){const [x,z]=k.split(',').map(Number),t=s.tile(x,z);if(t.nature||s.at(x,z)||s.roads.has(k))continue;const far=Math.abs(x-b.x)+Math.abs(z-b.z);if(best&&far>=best.far)continue;
  if(!s.closestNatural({x,z,size:1},nature)||s.canRelocate(b.id,x,z))continue;best={x,z,far};}
 return best&&{x:best.x,z:best.z,cost:s.relocationCost(b,best.x,best.z)};
}
