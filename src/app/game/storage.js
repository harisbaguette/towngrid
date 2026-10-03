import {RESOURCES} from './simulation.js';

export const STARTER_CAPACITY=160, WAREHOUSE_CAPACITY=960, DEPOT_CAPACITY=240;
export const isStore=b=>b?.type==='warehouse'||b?.type==='depot'||b?.type==='starter';
export const used=store=>Object.values(store.inventory||{}).reduce((n,v)=>n+v,0);
export const capacity=(s,b)=>b.type==='starter'?STARTER_CAPACITY:b.type==='depot'?DEPOT_CAPACITY:WAREHOUSE_CAPACITY+(s.rank>=1?120:0);
export function stores(s,active=true){
 const all=[s.starterStore,...s.buildings.filter(isStore)].filter(Boolean);
 return active?all.filter(b=>b.health>0&&b.enabled!==false&&!(b.movingUntil>s.time)):all;
}
export const freeSpace=(s,b)=>b.drain?0:Math.max(0,capacity(s,b)-used(b)-s.workers.reduce((n,w)=>n+(w.task?.targetStore===b.id?w.task.amount:0),0)-s.shipments.reduce((n,sh)=>n+(sh.kind==='import'&&sh.storeId===b.id?sh.amount:0),0));
export const storeById=(s,id)=>id===0?s.starterStore:s.buildings.find(b=>b.id===id&&isStore(b));
export const storeStock=(s,b,item)=>Math.max(0,(b.inventory?.[item]||0)-s.workers.reduce((n,w)=>n+(w.task?.sourceStore===b.id&&!w.task.carried&&w.task.item===item?w.task.amount:0),0));
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.z-b.z);
export function nearbyStores(s,point){return stores(s).sort((a,b)=>distance(a,point)-distance(b,point));}
// stock remains the public aggregate used by recipes, construction, the ledger and old saves.
// Its setters account for all existing callers; physical transfers specify a store explicitly.
export function initStorage(s,saved){
 const total={...s.stock};
 s.starterStore={id:0,type:'starter',x:7,z:11,size:1,health:100,enabled:true,drain:!!saved?.starterDrain,inventory:{...(saved?.starterInventory||{})}};
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
 const list=preferred?[preferred]:nearbyStores(s,s.warehouse||s.starterStore);
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
export function storageSummary(s,b){return {used:used(b),capacity:capacity(s,b),items:Object.entries(b.inventory||{}).filter(([,n])=>n>0)};}
