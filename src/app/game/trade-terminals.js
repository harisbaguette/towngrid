import {isStore,freeSpace,storeStock,deposit,withdraw} from './storage.js';
// Export terminals, pipe and conveyor networks, and the local power grid (infrastructure.js holds the
// definitions). Every site keeps the west gate as a small built-in road terminal; the other terminals
// are buildings whose placement ties them to the export road, a railway, an airport or the water.
// Imports from simulation.js are used inside functions only (module cycle, see infrastructure.js).
import {BUILDINGS} from './simulation.js';
import {reserved,available} from './logistics.js';
import {tradeOptions,ROUTE_KINDS} from './trade-routes.js';
import {EXPORT_TILES,EXPORT_GATE,findExportRoute} from './export-route.js';
import {provinceZone} from './infrastructure.js';
import {TERRAIN_NAMES} from './world-grid.js';
import {recordNetworkTransfer} from './logistics-visual-events.js';

const K=(x,z)=>x+','+z;
const around=(x,z)=>[[x+1,z],[x-1,z],[x,z+1],[x,z-1]];
const alive=b=>b.health>0&&b.enabled!==false;


/** Road and rail tiles joined to the export road. Cached per map revision. */
export function connectedRoads(s){
 if(s.connectedRevision===s.revision)return s.connectedCache;
 const seen=new Set(EXPORT_TILES.map(p=>K(p.x,p.z)).filter(k=>s.roads.has(k))),queue=[...seen];
 while(queue.length){const [x,z]=queue.pop().split(',').map(Number);for(const [a,c] of around(x,z)){const k=K(a,c);if(s.roads.has(k)&&!seen.has(k)){seen.add(k);queue.push(k);}}}
 s.connectedRevision=s.revision;return s.connectedCache=seen;
}
/** Tiles in the body of water that holds (x,z), counted up to 64. */
export function waterSize(s,x,z){
 const seen=new Set([K(x,z)]),queue=[[x,z]];
 while(queue.length&&seen.size<64){const [a,c]=queue.pop();for(const [p,q] of around(a,c))if(s.tile(p,q)?.terrain==='water'&&!seen.has(K(p,q))){seen.add(K(p,q));queue.push([p,q]);}}
 return seen.size;
}

/** Why an infrastructure building cannot stand on (x,z), or null. Other types always pass. */
export function placementError(s,type,x,z){
 const d=BUILDINGS[type],T=d?.terminal;if(!d)return null;
 const zone=provinceZone(s);
 if(d.ice&&!zone.ice)return '얼음 지역에서만 지을 수 있습니다';
 if(d.mountain&&!zone.mountain)return '산악 지역에서만 깔 수 있습니다';
 if(d.onWater){
  if(s.tile(x,z)?.terrain!=='water')return '항구는 물 위에만 지을 수 있습니다';
  if(!around(x,z).some(([a,c])=>s.walkable(a,c)))return '뭍과 닿은 물 위에 지으세요 · 옆 땅 한 칸이 비어 있어야 합니다';
  if(T.water!=='polar'){
   if(zone.ice)return '얼음 지역에서는 극지 항과 극지 나룻터만 지을 수 있습니다';
   // A port stands on its own kind of water; the small ferry landing takes any water.
   if(T.water!=='ferry'&&s.tile(x,z).water!==T.water)return TERRAIN_NAMES[T.water]+' 위에만 지을 수 있습니다';
  }
  if(T.capacity>10&&waterSize(s,x,z)<8)return '물이 좁아 나룻터만 지을 수 있습니다';
  return null;
 }
 const roads=connectedRoads(s),touch=only=>around(x,z).some(([a,c])=>roads.has(K(a,c))&&(!only||only.has(K(a,c))));
 if(type==='airport'&&!touch())return '무역로와 이어진 도로나 철로 옆에 지으세요';
 if(!T)return null;
 if(T.via==='road'&&!touch())return '무역로와 이어진 도로 옆에 지으세요';
 if(T.via==='paved'&&!touch(s.paved))return '무역로와 이어진 포장 도로 옆에만 지을 수 있습니다';
 if(T.via==='rail'&&!touch(s.rails))return '무역로와 이어진 철로 옆에만 지을 수 있습니다';
 if(T.via==='air'){if(!around(x,z).some(([a,c])=>s.at(a,c)?.type==='airport'))return '공항 바로 옆에만 지을 수 있습니다';if(!touch())return '무역로와 이어진 도로나 철로 옆에 지으세요';}
 return null;
}

/** Every export terminal of this site: the west gate first, then each terminal building. */
export function terminalsOf(s){
 if(s.terminalRevision===s.revision)return s.terminalList;
 const options=tradeOptions(s),land=options.find(o=>ROUTE_KINDS[o.kind].scale!=='port'),landCap=ROUTE_KINDS[land.kind].capacity;
 const along=o=>({kind:o.kind,terrain:o.terrain,joins:o.joins,line:o.line,from:o.from,to:o.to,scale:ROUTE_KINDS[o.kind].scale,label:o.name});
 const list=[{id:'gate',type:'gate',name:'서쪽 관문 도로 집하지',...along(land),capacity:Math.min(10,landCap),price:land.price,usable:true,error:null,goals:[EXPORT_GATE]}];
 for(const b of s.buildings){
  const T=BUILDINGS[b.type].terminal;if(!T)continue;
  const water=T.water&&options.find(o=>o.kind===T.water),goals=s.entries(b);
  // Road hubs load onto the land route and share its lot; ships, trains, planes and snowmobiles carry their own.
  const capacity=T.via==='road'||T.via==='paved'?Math.min(T.capacity,landCap):T.capacity;
  const price=T.price??(T.water?water?.price??ROUTE_KINDS[T.water].price:land.price);
  const error=b.movingUntil>s.time?'이전 중':b.health<=0?'파손됨':b.enabled===false?'운영 중지':placementError(s,b.type,b.x,b.z)||(goals.length?null:'출입구가 막혔습니다');
  list.push({id:'b:'+b.id,type:b.type,building:b.id,name:BUILDINGS[b.type].name,...along(water||land),capacity,price:+price.toFixed(3),usable:!error,error,goals});
 }
 s.terminalRevision=s.revision;return s.terminalList=list;
}

/** The terminal goods leave through: the player's choice while it works, else the best one the
 *  warehouse can reach (lot size × price), else the gate. Cached per map revision. */
export function activeTerminal(s){
 if(s.activeTerminalRevision===s.revision)return s.activeTerminalCache;
 const usable=terminalsOf(s).filter(t=>t.usable),chosen=usable.find(t=>t.id===s.tradeRoute);
 const ranked=chosen?[chosen]:[...usable].sort((a,b)=>b.capacity*b.price-a.capacity*a.price);
 const pick=ranked.find(t=>findExportRoute(s,t.goals))||ranked[0];
 s.activeTerminalRevision=s.revision;return s.activeTerminalCache=pick;
}
export const tradeConnection=activeTerminal;
/** Largest lot one shipment can carry, and the smallest lot auto-sale waits for. */
export const tradeCapacity=s=>activeTerminal(s).capacity;
export const autoSaleLot=s=>Math.min(10,tradeCapacity(s));
export function chooseTradeRoute(s,id){
 const t=terminalsOf(s).find(t=>t.id===id);if(!t)return {ok:false,error:'이 거점에 없는 수출 터미널입니다'};
 if(!t.usable)return {ok:false,error:t.name+' · '+t.error};s.tradeRoute=id;s.revision++;return {ok:true};
}

// Pipes and conveyors: each joined run of tiles links the buildings that touch it. Once a second a run
// moves up to NETWORK_RATE of each item it carries: producer to consumer, spare output into a touching
// warehouse, then warehouse stock to consumers. Residents are not involved.
export const NETWORK_RATE=3;
function networks(s){
 if(s.networkRevision===s.revision)return s.networkCache;
 const result=[];
 for(const [set,type] of [[s.pipes,'pipe'],[s.conveyors,'conveyor']]){
  const seen=new Set();
  for(const start of set){if(seen.has(start))continue;const tiles=[start],members=new Set();seen.add(start);
   for(let i=0;i<tiles.length;i++){const [x,z]=tiles[i].split(',').map(Number);for(const [a,c] of around(x,z)){const k=K(a,c);if(set.has(k)&&!seen.has(k)){seen.add(k);tiles.push(k);}const b=s.at(a,c);if(b)members.add(b);}}
   result.push({type,carries:BUILDINGS[type].carries,tiles,members:[...members]});
  }
 }
 s.networkRevision=s.revision;return s.networkCache=result;
}
export function networkOf(s,x,z){return networks(s).find(n=>n.tiles.includes(K(x,z)))||null;}
function pending(s,b,item){return s.workers.reduce((n,w)=>n+(w.task?.targetId===b.id&&w.task.item===item?w.task.amount:0),0);}
export function tickNetworks(s,dt){
 s.networkTimer=(s.networkTimer||0)+dt;if(s.networkTimer<1)return;s.networkTimer=0;
 for(const net of networks(s))for(const item of net.carries){
  const members=net.members.filter(b=>alive(b)&&!(b.movingUntil>s.time)),localStores=members.filter(isStore);
  const sources=members.filter(b=>!isStore(b)&&s.recipeOf(b).output===item);
  const sinks=members.filter(b=>!isStore(b)&&s.effectiveInputs(b)[item]);
  const want=b=>Math.max(0,s.effectiveInputs(b)[item]*2-(b.inputs[item]||0)-pending(s,b,item));
  const spare=b=>Math.max(0,Math.floor(b.out-reserved(s,item,b.id)));
  let budget=NETWORK_RATE;
  const move=(from,to,n)=>{n=Math.min(n,budget);if(n<=0)return;budget-=n;
   if(isStore(from))withdraw(s,item,n,from);else from.out-=n;
   if(isStore(to))deposit(s,item,n,to);else to.inputs[item]=(to.inputs[item]||0)+n;
   s.logisticsStats.direct=(s.logisticsStats.direct||0)+n;s.logisticsStats.delivered=(s.logisticsStats.delivered||0)+n;
   recordNetworkTransfer(s,net,from,to,item,n);};
  for(const to of sinks)for(const from of sources)move(from,to,Math.min(spare(from),want(to)));
  for(const store of localStores){for(const from of sources)move(from,store,Math.min(spare(from),Math.floor(freeSpace(s,store))));
   for(const to of sinks)move(store,to,Math.min(Math.floor(storeStock(s,store,item)),want(to)));}
 }
}

// Local power: a running power plant (a charged battery during an outage) feeds everything within
// POWER_REACH tiles. A substation within reach of the grid joins it and carries power POWER_REACH further.
export const POWER_REACH=6;
const reach=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.z-b.z))<=POWER_REACH;
export function powerNodes(s){
 if(s.gridTime===s.time&&s.gridRevision===s.revision)return s.gridNodes;
 const outage=s.outageUntil>s.time,nodes=s.buildings.filter(b=>alive(b)&&!(b.movingUntil>s.time)&&(outage?b.type==='battery'&&s.batteryCharge>0:BUILDINGS[b.type].output==='power'&&b.activeUntil>s.time));
 const subs=s.buildings.filter(b=>alive(b)&&!(b.movingUntil>s.time)&&b.type==='substation');
 for(let grew=true;grew;){grew=false;for(const sub of subs)if(!nodes.includes(sub)&&nodes.some(n=>reach(n,sub))){nodes.push(sub);grew=true;}}
 s.gridTime=s.time;s.gridRevision=s.revision;return s.gridNodes=nodes;
}
export const poweredAt=(s,b)=>powerNodes(s).some(n=>reach(n,b));
