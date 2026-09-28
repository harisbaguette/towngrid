// What the HUD shows, derived from the same simulation data the rules use.
// Plain JS so node probes (tests/audit) can check the screen logic without a browser.
import {BUILDINGS,RESOURCES} from './simulation.js';
import {RACES,RANKS,unlockRank} from './world.js';
import {operationHint} from './proximity.js';

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
 const p=s.promotion(),need=p?[...p.requirements.filter(r=>!r.done).map(r=>r.name+' '+r.target),...(p.trial&&!p.trial.done?[p.trial.name]:[]),...(s.money<p.fee?['승급비 '+p.fee+'G']:[])].join(' · '):'';
 const steps=[
 {done:!!s.warehouse,title:'첫 창고',text:'밝은 경계 안에 창고를 놓으세요.',tool:'warehouse'},
 {done:s.workerCount>0,title:'주민을 맞이하세요',text:'주거 탭에서 주민 주택을 지으세요. 주민이 짐을 나릅니다.',tool:'house'},
 {done:s.buildings.some(b=>b.type==='well'),title:'물을 공급하세요',text:'창고 주변에 우물을 지으세요.',tool:'well'},
 {done:s.buildings.some(b=>b.type==='field'),title:'밀을 생산하세요',text:'우물 근처에 밀밭을 놓고 통로를 남기세요.',tool:'field'},
 {done:s.buildings.some(b=>b.type==='lumber'),title:'목재를 확보하세요',text:'나무에서 네 칸 이내에 벌목장을 지으세요.',tool:'lumber'},
 {done:s.contracts>0,title:'첫 납품',text:'창고에 모인 재고로 납품 계약을 완료하세요.',tool:null},
 {done:s.rank>0,title:'첫 승급',text:need?need+' 달성 후 승급':'지금 승급할 수 있습니다.',tool:null}
 ];
 const index=steps.findIndex(v=>!v.done);return index<0?null:{...steps[index],index,total:steps.length};
}

/** Import and production are both possible once any producer of the item is unlocked (economy.js purchase). */
export const permitted=(s,item)=>Object.entries(BUILDINGS).some(([type,d])=>d.output===item&&unlockRank(type)<=s.rank);
/** Why an item cannot be gathered at this rank ("지역 공급자 승급 후"), or '' when it is in stock or obtainable. */
export function itemGate(s,item,need){
 if(!RESOURCES[item]||s.stock[item]>=need)return '';
 const producers=Object.keys(BUILDINGS).filter(k=>BUILDINGS[k].output===item);
 if(!producers.length||producers.some(k=>unlockRank(k)<=s.rank))return '';
 return RANKS[Math.min(...producers.map(k=>unlockRank(k)))]?.name+' 승급 후';
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
