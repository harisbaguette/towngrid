import {createIndustryTrial,trialRule} from './industry-trials.js';
import {RESOURCES} from './simulation.js';
import {Campaign} from './campaign.js';

const LIMIT=24000,STEP=.25;
// Only public player actions. In particular, build's internal `free` argument,
// startBatch, restore, seedMap and direct inventory writes are never accepted.
const ACTIONS={build:3,demolish:2,relocate:3,expand:2,repair:1,repairAll:0,upgrade:1,setRecipe:2,setOperation:3,buy:2,sell:2,plant:2,setStorageRule:4,setStoreDrain:2,setStoreMode:2,setStockCap:2,discardStock:3,chooseTradeRoute:1,buyHaulGear:0,specialize:2,fulfill:0,promote:0,repay:0,rescue:1,chooseCharter:1,sellLand:2,recover:0,mobilize:0,reinforce:0,sanitize:0,negotiateSanction:0};
const CAMPAIGN_ACTIONS={'campaign.giftNeighbor':2,'campaign.council':2,'campaign.stateAction':2,'campaign.tradeAll':0};
const primitive=v=>v===null||typeof v==='boolean'||typeof v==='string'&&v.length<=100||typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e6;
const validMap=(map,boolean=false)=>map&&typeof map==='object'&&!Array.isArray(map)&&Object.entries(map).every(([key,v])=>Object.hasOwn(RESOURCES,key)&&(boolean?typeof v==='boolean':Number.isInteger(v)&&v>=0&&v<=1000000));
export function validReplay(replay){
 return !!replay&&replay.version===1&&trialRule(replay.id)?.version===2&&Array.isArray(replay.commands)&&replay.commands.length<=LIMIT&&replay.commands.every(e=>
  Array.isArray(e)&&(e[0]==='wait'?e.length===2&&Number.isInteger(e[1])&&e[1]>0&&e[1]<=10000:
  e[0]==='controls'?e.length===3&&validMap(e[1],true)&&validMap(e[2]):
  e[0]==='resume'||e[0]==='contractItem'?e.length===2&&Array.isArray(e[1])&&e[1].length===0:
  (Object.hasOwn(ACTIONS,e[0])||Object.hasOwn(CAMPAIGN_ACTIONS,e[0]))&&e.length===2&&Array.isArray(e[1])&&e[1].length<=(ACTIONS[e[0]]??CAMPAIGN_ACTIONS[e[0]])&&e[1].every(primitive)));
}
export function attachTrialReplay(c){
 if(trialRule(c.trial?.id)?.version!==2||c.replayAttached)return;
 c.replayAttached=true;const s=c.active,originalTick=c.tick.bind(c);
 const resumed=!!c.trial.replay;c.trial.replay??={version:1,id:c.trial.id,commands:[]};let nested=false,remainder=0,controls='';
 const append=e=>{const log=c.trial.replay;if(log.commands.length>=LIMIT){log.overflow=true;return;}const last=log.commands.at(-1);if(e[0]==='wait'&&last?.[0]==='wait'&&last[1]<10000)last[1]+=e[1];else log.commands.push(e);};
 const capture=()=>{const raw=JSON.stringify([s.autoSell||{},s.reserves||{}]);if(raw!==controls){controls=raw;append(['controls',structuredClone(s.autoSell||{}),structuredClone(s.reserves||{})]);}};
 if(resumed&&c.trial.status==='playing')append(['resume',[]]);
 // Opening the contract UI can choose and pin an order before the next tick.
 // Record that deterministic choice, never a client-supplied order or reward.
 const contractItem=s.contractItem.bind(s);s.contractItem=()=>{if(nested||c.trial.status!=='playing')return contractItem();const before=JSON.stringify(c.treasury.contractOrder);capture();nested=true;let result;try{result=contractItem();}finally{nested=false;}if(before!==JSON.stringify(c.treasury.contractOrder))append(['contractItem',[]]);return result;};
 for(const name of [...Object.keys(ACTIONS),...Object.keys(CAMPAIGN_ACTIONS)]){const target=name.startsWith('campaign.')?c:s,key=name.split('.').at(-1),fn=target[key].bind(target);target[key]=(...args)=>{if(nested)return fn(...args);if(c.trial.status!=='playing')return {ok:false,error:'도전이 끝났습니다. 다시 시작해 새 기록에 도전하세요.'};capture();nested=true;let result;try{result=fn(...args);}finally{nested=false;}if(result?.ok)append([name,structuredClone(args.map(v=>v===undefined?null:v))]);return result;};}
 c.tick=dt=>{
  if(s.paused||c.trial.status!=='playing'||!Number.isFinite(dt)||dt<=0)return;
  const speed=s.speed;remainder+=Math.min(dt,.25)*speed;capture();
  while(remainder>=STEP-1e-9&&c.trial.status==='playing'){
   remainder-=STEP;s.speed=1;nested=true;try{originalTick(STEP);}finally{nested=false;s.speed=speed;}
   append(['wait',1]);
  }
 };
}
export function verifyTrialReplay(replay){
 if(!validReplay(replay)||replay.overflow)throw new Error('검증할 수 없는 도전 기록입니다.');
 let c=createIndustryTrial(replay.id,{record:false}),s=c.active;const rule=trialRule(replay.id);let steps=0;
 for(const entry of replay.commands){
  if(c.trial.status!=='playing')throw new Error('도전 종료 뒤의 조작이 포함되어 있습니다.');
  const [name,args]=entry;
  if(name==='wait'){steps+=args;if(steps>Math.ceil(rule.duration/STEP))throw new Error('제한 시간을 넘긴 기록입니다.');for(let n=0;n<args;n++){if(c.trial.status!=='playing')throw new Error('종료 시간을 확인하세요.');c.tick(STEP);}}
  else if(name==='controls'){s.autoSell=structuredClone(entry[1]);s.reserves=structuredClone(entry[2]);}
  else if(name==='resume'){c=new Campaign({saved:c.save()});s=c.active;}
  else if(name==='contractItem')s.contractItem();
  else{const params=name==='setOperation'?args.map(v=>v===null?undefined:v):args,target=name.startsWith('campaign.')?c:s,key=name.split('.').at(-1);const result=target[key](...params);if(!result?.ok)throw new Error('재현할 수 없는 조작: '+name+' · '+(result?.error||''));}
 }
 if(c.trial.status==='playing')throw new Error('완료한 도전만 제출할 수 있습니다.');
 return {id:rule.id,score:c.trial.score,elapsed:c.trial.elapsed,delivered:c.trial.delivered,status:c.trial.status};
}
