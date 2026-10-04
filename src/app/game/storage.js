import {RESOURCES} from './simulation.js';

export const STARTER_CAPACITY=160, WAREHOUSE_CAPACITY=480, DEPOT_CAPACITY=1200;
export const isStore=b=>b?.type==='warehouse'||b?.type==='depot'||b?.type==='starter';
export const used=store=>Object.values(store.inventory||{}).reduce((n,v)=>n+v,0);
/** A materials depot set to one kind of goods, like Town Star's silo, wood shed, water tower and fuel storage
 *  (docs/TOWNSTAR_RULES.md): it takes only those goods and holds several times as many on its one tile. */
export const STORE_MODES={
 crops:{name:'작물 전용',short:'사일로',capacity:1440,items:['grain','cotton','herb','sugarcane','grapered','grapewhite','cocoa','strawberry','mint','pumpkin','salt','feed']},
 materials:{name:'자재 전용',short:'자재 야적장',capacity:1440,items:['wood','plank','oakwood','stone','clay','sand','limestone','brick']},
 water:{name:'물 전용',short:'물 탱크',capacity:2400,items:['water','processwater']},
 fuel:{name:'연료 전용',short:'연료 저장소',capacity:720,items:['fuel','oil','jetfuel','coal','petroleum']},
};
export const accepts=(b,item)=>item===undefined||!b?.mode||!!STORE_MODES[b.mode]?.items.includes(item);
/** A dedicated depot never holds less than an ordinary one (modeCapacity), whatever DEPOT_CAPACITY is set to. */
export const modeCapacity=b=>Math.max(DEPOT_CAPACITY,STORE_MODES[b.mode]?.capacity||0);
export const capacity=(s,b)=>b.type==='starter'?STARTER_CAPACITY:(b.type==='depot'?modeCapacity(b):WAREHOUSE_CAPACITY+(s.rank>=1?120:0))*(1+Math.max(0,(b.level||1)-1)*.5);
export function stores(s,active=true){
 const all=[s.starterStore,...s.buildings.filter(isStore)].filter(Boolean);
 return active?all.filter(b=>b.health>0&&b.enabled!==false&&!(b.movingUntil>s.time)):all;
}
const incoming=(s,b,item,exclude)=>s.workers.reduce((n,w)=>n+(w.task!==exclude&&w.task?.targetStore===b.id&&(!item||w.task.item===item)?w.task.amount:0),0)+s.shipments.reduce((n,sh)=>n+(sh!==exclude&&sh.kind==='import'&&sh.storeId===b.id&&(!item||sh.item===item)?sh.amount:0),0)+(s.campaign?.routes||[]).reduce((n,r)=>n+(r!==exclude&&r.to===s.siteId&&r.cargo&&(!item||r.item===item)?(r.dropoffs||[]).filter(v=>v.id===b.id).reduce((a,v)=>a+v.amount,0):0),0);
export function freeSpace(s,b,item=null,exclude=null){
 // A depot set to one kind of goods takes only those (STORE_MODES).
 if(item&&!accepts(b,item))return 0;
 if(b.drain||b.health<=0||b.enabled===false||b.movingUntil>s.time)return 0;
 const physical=Math.max(0,capacity(s,b)-used(b)-incoming(s,b,null,exclude));
 if(!item)return physical;
 const rules=b.storageRules||{},rule=rules[item]||{},held=(b.inventory?.[item]||0)+incoming(s,b,item,exclude);
 const reservedElsewhere=Object.entries(rules).reduce((n,[id,r])=>n+(id===item?0:Math.max(0,(r.reserve||0)-(b.inventory?.[id]||0)-incoming(s,b,id,exclude))),0);
 return Math.max(0,Math.min(physical-reservedElsewhere,(rule.limit??Infinity)-held));
}
export function setStorageRule(s,id,item,limit,reserve=0){
 const b=storeById(s,id);if(!b||!RESOURCES[item]||limit!==null&&(!Number.isInteger(limit)||limit<0||limit>100000)||!Number.isInteger(reserve)||reserve<0||reserve>(limit??capacity(s,b)))return {ok:false,error:'수용 상한과 예약 공간을 확인하세요'};
 const others=Object.entries(b.storageRules||{}).reduce((n,[k,r])=>n+(k===item?0:r.reserve||0),0);
 if(others+reserve>capacity(s,b))return {ok:false,error:'예약 공간의 합계가 창고 용량을 넘습니다'};
 b.storageRules??={};if(limit===null&&!reserve)delete b.storageRules[item];else b.storageRules[item]={...(limit===null?{}:{limit}),reserve};s.revision++;return {ok:true};
}
export const storeById=(s,id)=>id===0?s.starterStore:s.buildings.find(b=>b.id===id&&isStore(b));
export const storeStock=(s,b,item)=>Math.max(0,(b.inventory?.[item]||0)-s.workers.reduce((n,w)=>n+(w.task?.sourceStore===b.id&&!w.task.carried&&w.task.item===item?w.task.amount:0),0));
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.z-b.z);
export function nearbyStores(s,point,item){return stores(s).filter(b=>accepts(b,item)).sort((a,b)=>distance(a,point)-distance(b,point));}
/** Room for one good across the stores that take it, as deposit fills them (a water tank is no room for steel). */
export const roomFor=(s,item)=>stores(s).reduce((n,b)=>n+(accepts(b,item)?Math.max(0,capacity(s,b)-used(b)):0),0);
// stock remains the public aggregate used by recipes, construction, the ledger and old saves.
// Its setters account for all existing callers; physical transfers specify a store explicitly.
export function initStorage(s,saved){
 const total={...s.stock};
 s.starterStore={id:0,type:'starter',x:7,z:11,size:1,health:100,enabled:true,drain:!!saved?.starterDrain,storageRules:structuredClone(saved?.starterStorageRules||{}),inventory:{...(saved?.starterInventory||{})}};
 for(const b of s.buildings.filter(isStore))b.inventory??={};
 const old=!saved?.storageVersion;
 if(old){for(const b of stores(s,false))b.inventory={};const target=s.warehouse||s.starterStore;target.inventory={...total};}
 for(const sh of s.shipments)if(sh.storeId===undefined)sh.storeId=s.warehouse?.id||0;
 s.inventoryTotals=total;
 const stock={};for(const item of Object.keys(RESOURCES))Object.defineProperty(stock,item,{enumerable:true,configurable:true,get:()=>s.inventoryTotals[item]||0,set:value=>{
  const delta=value-(s.inventoryTotals[item]||0);if(!delta)return;
  if(delta>0)deposit(s,item,delta);else withdraw(s,item,-delta);
 }});
 s.stock=stock;
}
export function deposit(s,item,amount,preferred=null){
 if(!(amount>0))return;let left=amount;
 const list=preferred?[preferred]:nearbyStores(s,s.warehouse||s.starterStore,item);
 for(const b of list){b.inventory??={};const n=preferred?left:Math.min(left,Math.max(0,capacity(s,b)-used(b)));b.inventory[item]=(b.inventory[item]||0)+n;left-=n;if(left<=0)break;}
 // Refunds and legacy over-capacity stock are kept, never discarded.
 if(left>0){const b=preferred||s.warehouse||s.starterStore;b.inventory??={};b.inventory[item]=(b.inventory[item]||0)+left;}
 s.inventoryTotals[item]=(s.inventoryTotals[item]||0)+amount;
}
export function withdraw(s,item,amount,preferred=null){
 if(!(amount>0))return 0;let left=amount;
 const list=preferred?[preferred]:stores(s,false).sort((a,b)=>(b.inventory?.[item]||0)-(a.inventory?.[item]||0));
 for(const b of list){const n=Math.min(left,b.inventory?.[item]||0);if(n){b.inventory[item]-=n;left-=n;}if(left<=0)break;}
 s.inventoryTotals[item]=Math.max(0,(s.inventoryTotals[item]||0)-(amount-left));return amount-left;
}
export function removeStore(s,b){for(const[item,n]of Object.entries(b.inventory||{})){withdraw(s,item,n,b);deposit(s,item,n,s.starterStore);}b.inventory={};}
export function storageSummary(s,b){return {used:used(b),capacity:capacity(s,b),mode:b.mode||null,items:Object.entries(b.inventory||{}).filter(([,n])=>n>0)};}

export function outputStorageIssue(s,b,item){
 const all=stores(s),reachable=all.filter(v=>s.entries(b).some(p=>s.routeTo(p,v)));
 if(!reachable.length)return {status:'창고 경로 막힘'};
 if(reachable.some(v=>freeSpace(s,v,item)>=1))return null;
 // A depot set to other goods (STORE_MODES) is no room for this one, so a full store beside a water tank reads 창고 가득 참.
 const physical=reachable.filter(v=>accepts(v,item)&&capacity(s,v)-used(v)-incoming(s,v,null,null)>=1);
 if(!physical.length)return {status:'창고 가득 참'};
 const target=physical[0],rule=target.storageRules?.[item];
 const reason=physical.every(v=>v.drain)?'출고 전용':physical.every(v=>v.storageRules?.[item]?.limit===0)?'입고 거부':rule?.limit!==undefined&&(target.inventory?.[item]||0)+incoming(s,target,item,null)>=rule.limit?'보관 상한':'예약 공간';
 return {status:'보관 제한 · '+RESOURCES[item].name,reason,storeId:target.id,item};
}
