// What the HUD shows, derived from the same simulation data the rules use.
// Plain JS so node probes (tests/audit) can check the screen logic without a browser.
import {BUILDINGS,RESOURCES} from './simulation.js';
import {RACES,RANKS,unlockRank} from './world.js';
import {operationHint} from './proximity.js';
import {provinceZone} from './infrastructure.js';
import {SERVICE_OUTPUTS} from './production-visuals.js';

const particle=(w,withFinal,without)=>{const c=w.charCodeAt(w.length-1)-0xac00;return w+(c>=0&&c<11172&&c%28?withFinal:without);};
export const objectOf=w=>particle(w,'을','를');
export const topicOf=w=>particle(w,'은','는');

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
 if(p.trial)parts.push({label:p.trial.name,current:Math.min(Math.floor(p.trial.current),p.trial.target),target:p.trial.target,done:p.trial.done});
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
 {done:s.rank>0,title:'첫 승급',text:need?need+' 달성 후 승급':'지금 승급할 수 있습니다.',tool:null}
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
 const wait=Math.ceil(st.wait||0);
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
