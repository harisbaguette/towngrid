import {Campaign} from './campaign.js';
import {RESOURCES,BUILDINGS} from './simulation.js';
import {startingProvinces} from './starting-sites.js';
import {TRIAL_CATALOG,TRIAL_CONDITIONS} from './competition-rules.js';
import {attachTrialReplay} from './trial-replay.js';
export const TRIAL_SAVE_KEY='towngrid-industry-trial-v1',TRIAL_RECORDS_KEY='towngrid-industry-records-v1';
export const INDUSTRY_TRIALS=[
 {id:'bread',name:'강변 제빵사',nation:'estern',rank:3,item:'bread',target:100,duration:800,money:3000,text:'강변에서 빵 100개를 직접 생산해 수출하세요.'},
 {id:'cloth',name:'숲의 직물 공방',nation:'silvaen',rank:5,item:'cloth',target:60,duration:960,money:4000,text:'목화 공급과 직조를 연결해 직물 60개를 수출하세요.'},
 {id:'steel',name:'산업 동력 시험',nation:'kardum',rank:15,item:'steel',target:60,duration:1200,money:8000,text:'광산·전력·제철을 연결해 강철 60개를 수출하세요.'}
];
const WEEK=7*24*60*60*1000,EPOCH=Date.UTC(2026,0,5);
export const currentTrialRound=(now=Date.now())=>Math.max(0,Math.floor((now-EPOCH)/WEEK));
export function legacyWeeklyTrial(round=currentTrialRound()){
 if(!Number.isInteger(round)||round<0||round>10000)return null;
 const base=INDUSTRY_TRIALS[round%3],plots=startingProvinces(base.nation),plot=plots[(round*17+3)%plots.length],target=base.target+(round%2?20:0);
 return {...base,id:'weekly-'+round,round,name:'주간 산업 도전 '+(round+1)+'회',provinceId:plot.id,location:plot.name,target,duration:base.duration*1.5,money:base.money+1000,efficient:round%2===1,text:RESOURCES[base.item].name+' '+target+'개 직접 생산·수출 · '+(round%2?'연료 절약 점수':'완료 시간 점수')};
}
export function weeklyTrial(round=currentTrialRound()){
 if(!Number.isInteger(round)||round<0||round>10000)return null;
 const base=TRIAL_CATALOG[round%TRIAL_CATALOG.length],condition=TRIAL_CONDITIONS[Math.floor(round/TRIAL_CATALOG.length)%TRIAL_CONDITIONS.length];
 const plots=startingProvinces(base.nation),plot=plots[(round*17+3)%plots.length];
 return {...base,id:'weekly-v2-'+round,round,version:2,condition,provinceId:plot.id,location:plot.name,name:'주간 산업 도전 '+(round+1)+'회 · '+base.name,text:RESOURCES[base.item].name+' '+base.target+'개 직접 생산·수출 · '+condition.name};
}
export function practiceTrials(){return TRIAL_CATALOG.map((rule,i)=>({...rule,id:'practice-v2-'+i,version:2,condition:TRIAL_CONDITIONS[0],text:RESOURCES[rule.item].name+' '+rule.target+'개 직접 생산·수출'}));}
export function trialRule(id){const base=INDUSTRY_TRIALS.find(v=>v.id===id);if(base)return base;const current=/^weekly-v2-(\d{1,5})$/.exec(id||'');if(current)return weeklyTrial(+current[1]);const practice=/^practice-v2-(\d)$/.exec(id||'');if(practice)return practiceTrials()[+practice[1]]||null;const m=/^weekly-(\d{1,5})$/.exec(id||'');return m?legacyWeeklyTrial(+m[1]):null;}
export function createIndustryTrial(id,{record=true}={}){
 const rule=trialRule(id);if(!rule)throw new Error('산업 도전을 선택하세요');
 const c=new Campaign({nation:rule.nation,...(rule.provinceId?{provinceId:rule.provinceId}:{})}),s=c.active;s.rank=rule.rank;s.money=rule.money;s.debt=0;s.family=true;s.nextEvent=1e12;s.autoSell={};
 for(const item of Object.keys(RESOURCES))s.stock[item]=0;for(const [item,n]of Object.entries({wood:45,stone:25,water:10,grain:10,fuel:40,plank:15,brick:8,gear:5}))s.stock[item]=n;
 c.trial={id,status:'playing',started:s.time,elapsed:0,score:0,delivered:0};if(record)attachTrialReplay(c);return c;
}
export function trialState(c){const t=c?.trial,rule=trialRule(t?.id);if(!rule)return null;return {...rule,...t,left:Math.max(0,rule.duration-t.elapsed)};}
export function tickIndustryTrial(c){const t=c.trial,rule=trialRule(t?.id);if(!rule||t.status!=='playing')return;
 t.elapsed=Math.min(rule.duration,Math.max(0,c.active.time-t.started));t.delivered=Math.min(c.treasury.sold[rule.item]||0,c.treasury.produced[rule.item]||0);
 if(t.delivered>=rule.target||t.elapsed>=rule.duration){t.status=t.delivered>=rule.target?'won':'expired';const fuel=c.sites.reduce((n,v)=>n+(v.sim.logisticsStats.fuel||0),0),facilities=c.sites.reduce((n,v)=>n+v.sim.buildings.filter(b=>!BUILDINGS[b.type].tile).length,0);t.score=Math.max(0,Math.floor(Math.min(t.delivered,rule.target)*100+(t.status==='won'?(rule.duration-t.elapsed)*10:0)-fuel*(rule.condition?.fuelPenalty||(rule.efficient?50:0))-facilities*(rule.condition?.buildingPenalty||0)));for(const s of c.sites)s.sim.paused=true;c.active.sound(t.status==='won'?'trial-won':'trial-ended');c.log(t.status==='won'?'산업 도전 성공':'산업 도전 시간 종료');}
}
export function readTrialRecords(storage){
 const records={};
 try{const raw=JSON.parse(storage.getItem(TRIAL_RECORDS_KEY)||'{}');if(!raw||typeof raw!=='object'||Array.isArray(raw))return records;
  for(const [id,v]of Object.entries(raw)){const rule=trialRule(id);
   if(!rule||!v||typeof v!=='object'||!['won','expired'].includes(v.status)||!Number.isSafeInteger(v.score)||v.score<0||v.score>rule.target*100+rule.duration*10||!Number.isFinite(v.elapsed)||v.elapsed<0||v.elapsed>rule.duration||!Number.isSafeInteger(v.delivered)||v.delivered<0||v.delivered>1e9)continue;
   records[id]={score:v.score,elapsed:v.elapsed,delivered:v.delivered,status:v.status};
  }
 }catch{}
 return records;
}
export function recordIndustryTrial(storage,c){const t=trialState(c);if(!t||t.status==='playing')return true;const records=readTrialRecords(storage),old=records[t.id];
 if(!old||t.score>old.score){records[t.id]={score:t.score,elapsed:t.elapsed,delivered:t.delivered,status:t.status};try{storage.setItem(TRIAL_RECORDS_KEY,JSON.stringify(records));}catch{return false;}}
 return true;
}
