import {remainingSeconds} from './game-time.js';
// What the HUD shows, derived from the same simulation data the rules use.
// Plain JS so node probes (tests/audit) can check the screen logic without a browser.
import {BUILDINGS,RESOURCES} from './simulation.js';
import {RACES,RANKS,unlockRank} from './world.js';
import {operationHint} from './proximity.js';
import {provinceZone} from './infrastructure.js';
import {SERVICE_OUTPUTS} from './production-visuals.js';
import {recoveryReady,RECOVERY_LIMIT} from './economy.js';

const particle=(w,withFinal,without)=>{const c=w.charCodeAt(w.length-1)-0xac00;return w+(c>=0&&c<11172&&c%28?withFinal:without);};
export const objectOf=w=>particle(w,'을','를');
export const topicOf=w=>particle(w,'은','는');
export const subjectOf=w=>particle(w,'이','가');

/** House type that brings the crew race a stalled facility waits for ("드워프 주민 필요"), or null. */
export function crewHouse(status){
 const race=Object.keys(RACES).find(r=>status===RACES[r].name+' 주민 필요');
 return (race&&Object.keys(BUILDINGS).find(k=>BUILDINGS[k].home&&(BUILDINGS[k].resident||'human')===race))||null;
}
/** Advice for a blocked status, including the crew stall that operationHint has no text for. Empty when running. */
export function blockHint(status){const hint=operationHint(status);if(hint)return hint;const house=crewHouse(status);return house?BUILDINGS[house].name+' 건설 필요':'';}

/** The export road to the west gate is cut, so every sale stops; auto tells whether an auto sale is waiting on it. */
export function exportBlocked(s){
 if(!s.warehouse||typeof s.exportStatus!=='function')return null;const e=s.exportStatus();if(e.connected)return null;
 return {error:e.error,auto:Object.entries(s.autoSell||{}).some(([r,on])=>on&&RESOURCES[r]&&Math.floor(s.stock[r]||0)>s.minimumStock(r))};
}

/** Every promotion condition: listed requirements, the operating trial and the fee. */
export function promotionParts(s,p){
 if(!p)return [];
 const parts=p.requirements.map(r=>({label:r.name,current:Math.min(r.current,r.target),target:r.target}));
 if(p.trial)parts.push({label:p.trial.name,current:Math.min(p.trial.displayCurrent,p.trial.displayTarget),target:p.trial.displayTarget,done:p.trial.done});
 if(p.fee>0)parts.push({label:'승급비',current:Math.min(Math.floor(s.money),p.fee),target:p.fee,unit:'G'});
 return parts.map(v=>({...v,done:v.done??v.current>=v.target}));
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
export const permitted=(s,item)=>firstMakerRank(item)<=s.rank;
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
export function nextBuild(s){
 if(!s.warehouse||s.rank<1)return null;
 const built=new Set(s.buildings.map(b=>b.type)),made=new Set(s.buildings.flatMap(b=>productsOf(BUILDINGS[b.type]).map(r=>r.output)));
 const wanted=(s.promotion()?.requirements||[]).filter(r=>!r.done&&r.key.startsWith('produced:')).map(r=>r.key.slice(9)).filter(item=>!made.has(item));
 let best=null,bestScore=0;
 for(const type of Object.keys(BUILDINGS)){
  const rank=unlockRank(type),products=productsOf(BUILDINGS[type]);
  if(built.has(type)||rank>s.rank||!products.length||!offered(s,type))continue;
  const serving=products.find(r=>wanted.includes(r.output)&&!(r.unlock>s.rank)),score=(serving?2:0)+(rank===s.rank?1:0);
  if(score>bestScore||(score===bestScore&&score>0&&rank>unlockRank(best.type)))[best,bestScore]=[{type,product:serving||products[0]},score];
 }
 if(!best)return null;
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
 if(!s.warehouse||typeof s.exportStatus!=='function')return null;const e=s.exportStatus();if(!Array.isArray(e.vehicles))return null;
 const busy=e.vehicles.filter(v=>v.busy).length,waiting=e.vehicles.filter(v=>v.fuel&&!v.busy),freeOut=e.vehicles.every(v=>v.fuel||v.busy);
 const names=[...new Set(waiting.map(v=>v.name))].join('·');
 const short=freeOut&&waiting.length>0&&!e.fuelReady;
 return {vehicles:e.vehicles,busy,total:e.vehicles.length,fuelNote:short?'연료 부족':'',waiting:short?names+' 대기':''};
}

// ---- 2026-09-29 HUD fixes (F3a): problem -> fix actions, ledger, notices ----

/** Stock that can be sold now (above auto-sale reserve and contract hold), priced at the current market quote. */
export function sellableStock(s){
 const items=[];let value=0;
 for(const id of Object.keys(RESOURCES)){
  const n=Math.floor(typeof s.availableStock==='function'?s.availableStock(id):s.stock[id]||0)-(typeof s.minimumStock==='function'?s.minimumStock(id):0);if(n<1)continue;
  const v=typeof s.saleQuote==='function'?s.saleQuote(id,Math.min(n,60))*n/Math.min(n,60):RESOURCES[id].price*n;
  items.push({id,n,value:Math.round(v)});value+=v;
 }
 return {value:Math.round(value),items:items.sort((a,b)=>b.value-a.value)};
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

/** Day-boundary snapshot of what the ledger compares: money, sales income so far that day, stock, produced and sold counters. */
export const ledgerSnapshot=s=>({day:s.day,time:s.time,money:s.money,income:s.budget?.income||0,stock:{...s.stock},produced:{...(s.produced||{})},sold:{...(s.sold||{})}});
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
