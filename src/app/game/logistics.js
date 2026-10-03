import {stores,isStore,nearbyStores,freeSpace,storeStock,storeById,withdraw,deposit} from './storage.js';
import {BUILDINGS, RESOURCES} from './simulation.js';
import {RACES,crewOf} from './world.js';
import {advanceCharacterRoute} from './character-movement.js';

const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.z-b.z);
const sourceOf=(s,t)=>t.sourceStore!==undefined?storeById(s,t.sourceStore):t.sourceId?s.buildings.find(b=>b.id===t.sourceId):s.warehouse||s.starterStore;
const targetOf=(s,t)=>t.targetStore!==undefined?storeById(s,t.targetStore):t.targetId?s.buildings.find(b=>b.id===t.targetId):s.warehouse||s.starterStore;
export function reserved(s,item,sourceId=null){return s.workers.reduce((n,w)=>n+(w.task&&!w.task.carried&&w.task.item===item&&(w.task.sourceId||null)===sourceId?w.task.amount:0),0);}
export function available(s,item){return Math.max(0,(s.stock[item]||0)-reserved(s,item));}
export function cancelTask(s,w){
 const t=w.task;
 if(t?.carried)s.stock[t.item]=(s.stock[t.item]||0)+t.amount;
 w.task=null;w.route=[];w.phase='idle';w.handling=null;w.handlingTime=0;
}
// The faction member whose trade this is; only that race may crew the building.
export function crewFor(s,type){return s.availableRaces.find(r=>RACES[r]?.crafts?.includes(type));}
export function canEnter(s,race,b){
 if(!b||isStore(b))return true;const crew=crewFor(s,b.type);if(crew&&crewOf(race)!==crew)return false;
 return !(BUILDINGS[b.type].skilled&&RACES[race]?.hauler);
}
export function assignJob(s,w){
 if(!stores(s).length)return;
 const capacity=(s.automatic?6:3)*(RACES[w.race]?.hauler?2:1), jobs=[];
 for(const b of s.buildings){
  if(b.health<=0||isStore(b)||b.movingUntil>s.time)continue;
  const allowed=canEnter(s,w.race,b);
  if(allowed&&b.enabled!==false)for(const [item,need] of Object.entries(s.effectiveInputs(b))){
   const pending=s.workers.reduce((n,p)=>n+(p.task?.targetId===b.id&&p.task.item===item?p.task.amount:0),0);
   const demand=need*2-(b.inputs[item]||0)-pending;if(demand<=0)continue;
   const sources=s.buildings.filter(p=>p.id!==b.id&&p.health>0&&!(p.movingUntil>s.time)&&s.recipeOf(p).output===item&&p.out-reserved(s,item,p.id)>0&&canEnter(s,w.race,p));
   sources.push(...nearbyStores(s,b).filter(store=>storeStock(s,store,item)>0));
   for(const source of sources){const stock=isStore(source)?storeStock(s,source,item):source.out-reserved(s,item,source.id);
    jobs.push({source,target:b,item,amount:Math.min(capacity,stock,demand),priority:(b.inputs[item]||0)<need?40:10,score:distance(w,source)+distance(source,b),age:b.age,kind:'supply'});
   }
  }
  const item=s.recipeOf(b).output;
  if(allowed&&RESOURCES[item]){
   const output=b.out-reserved(s,item,b.id);
   for(const store of nearbyStores(s,b)){
    const space=freeSpace(s,store);
    if(output>0&&space>0)jobs.push({source:b,target:store,item,amount:Math.min(capacity,output,space),priority:output>=8?38:18,score:distance(w,b)+distance(b,store),age:b.age,kind:'pickup'});
   }
  }
 }
 for(const source of stores(s).filter(b=>b.drain))for(const [item,n]of Object.entries(source.inventory||{})){
  if(n<=0)continue;
  for(const target of nearbyStores(s,source).filter(b=>b!==source&&!b.drain)){
   const amount=Math.min(capacity,storeStock(s,source,item),freeSpace(s,target));
   if(amount>0)jobs.push({source,target,item,amount,priority:45,score:distance(w,source)+distance(source,target),age:0,kind:'pickup',building:source.id||target.id});
  }
 }
 jobs.sort((a,b)=>(b.priority+(b.target.priority||1)*5+Math.min(20,b.age*.12)-b.score*.7)-(a.priority+(a.target.priority||1)*5+Math.min(20,a.age*.12)-a.score*.7));
 for(const j of jobs){
  const first=s.routeTo(w,j.source);if(!first||!s.routeTo(first.end,j.target))continue;
  w.task={kind:j.kind,building:j.building??(j.kind==='supply'?j.target.id:j.source.id),sourceId:isStore(j.source)?null:j.source.id,targetId:isStore(j.target)?null:j.target.id,...(isStore(j.source)?{sourceStore:j.source.id}:{}),...(isStore(j.target)?{targetStore:j.target.id}:{}),item:j.item,amount:j.amount,carried:false};
  w.atHome=false;w.idleFor=0;w.route=first.path;w.phase='source';w.handling=null;j.target.age=0;return;
 }
}
export function moveWorkers(s,dt){
 for(const w of s.workers){
  w.walking=false;w.moveSpeed=0;w.think=(w.think||0)-dt;
  if(!w.task&&w.think<=0){assignJob(s,w);w.think=.65;}
  if(!w.task){
   w.idleFor=(w.idleFor||0)+dt;
   const home=s.buildings.find(b=>b.id===w.homeId&&b.health>0&&!(b.movingUntil>s.time));
   if(home&&w.idleFor>=6&&!w.atHome){
    if(w.phase!=='home'||!w.route.length||!s.walkable(w.route[0].x,w.route[0].z)){const route=s.routeTo(w,home);w.route=route?.path||[];w.phase='home';if(!route)continue;}
    if(w.route.length)advanceCharacterRoute(w,dt,1.25,(x,z)=>s.walkable(x,z));
    if(!w.route.length){w.atHome=true;w.walking=false;w.phase='rest';}
   }
   continue;
  }
  const t=w.task,target=w.phase==='source'?sourceOf(s,t):targetOf(s,t);
  if(!target||target.health<=0||(target.enabled===false&&(w.phase!=='source'||isStore(target)))||target.movingUntil>s.time){cancelTask(s,w);continue;}
  if(w.route.length&&!s.walkable(w.route[0].x,w.route[0].z)){const route=s.routeTo(w,target);if(route)w.route=route.path;else{cancelTask(s,w);continue;}}
  if(w.route.length){
   const speed=1.25*(w.race==='centaur'?1.15:1)*(s.time<s.strikeUntil?.55:1)*(s.paved?.has(`${Math.round(w.x)},${Math.round(w.z)}`)?2.2:s.roads.has(`${Math.round(w.x)},${Math.round(w.z)}`)?1.7:1)*(s.horse?1.35:1)*(s.automatic?1.65:1)*(1-(s.health?.infection||0)*.005)*(s.money<0?.65:1);
   const step=advanceCharacterRoute(w,dt,speed,(x,z)=>s.walkable(x,z));
   w.stepDistance=(w.stepDistance||0)+step;
   if(w.stepDistance>=.42){w.stepDistance%=.42;s.sound('footstep',w.x,w.z);}
   continue;
  }
  if(!w.handling){w.handling=w.phase==='source'?'pickup':'drop';w.handlingTime=0;w.dir=Math.atan2(target.x-w.x,target.z-w.z);}
  w.handlingTime+=dt;if(w.handlingTime<.55)continue;
  if(w.phase==='source'){
   const source=sourceOf(s,t),stock=isStore(source)?source.inventory?.[t.item]||0:source.out;t.amount=Math.min(t.amount,stock);
   if(t.amount<=0){cancelTask(s,w);continue;}
   const destination=targetOf(s,t),route=destination&&s.routeTo(w,destination);if(!route){cancelTask(s,w);continue;}
   if(isStore(source))withdraw(s,t.item,t.amount,source);else source.out-=t.amount;
   t.carried=true;w.phase='destination';w.route=route.path;w.handling=null;s.sound('pickup',w.x,w.z);
  }else{
   const dest=targetOf(s,t);if(isStore(dest))deposit(s,t.item,t.amount,dest);else dest.inputs[t.item]=(dest.inputs[t.item]||0)+t.amount;
   const st=s.logisticsStats;st.delivered=(st.delivered||0)+t.amount;if(t.sourceId&&t.targetId)st.direct=(st.direct||0)+t.amount;
   s.logisticsStats.last={from:t.sourceId,to:t.targetId,item:t.item,amount:t.amount,time:s.time};
   s.sound('drop',w.x,w.z);w.task=null;w.handling=null;w.phase='idle';
  }
 }
}
