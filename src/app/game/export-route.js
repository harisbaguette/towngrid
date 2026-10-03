import {stores,storeById,storeStock,freeSpace,withdraw,deposit} from './storage.js';
import {tradeJourney} from './trade-journey.js';
import {RESOURCES,BUILDINGS,N,CONTRACT_WAIT} from './simulation.js';
import {activeTerminal,tradeCapacity,terminalsOf} from './trade-terminals.js';
import {recordTerminalTransfer} from './logistics-visual-events.js';
// Every map has a fixed export road from the west edge to the starting land.
// Sold goods leave the warehouse on a vehicle and are paid for when it reaches the trading city.
// Imports ride the same vehicles the other way, and the lord's contracts and state orders go out on them too.
export const EXPORT_GATE={x:0,z:11};
// A new town has one small fuel-powered truck. Terminals and later ranks add larger trucks.
// Wagon and raft definitions remain for vehicles already traveling in old saves.
export const VEHICLES={
 van:{name:'소형 트럭',fuel:true,load:1,land:1.4,water:0},
 wagon:{name:'마차',fuel:false,load:1,land:1,water:0},
 raft:{name:'뗏목',fuel:false,load:1.5,land:1,water:1.2},
 truck:{name:'트럭',fuel:true,load:2,land:2,water:0},
 steamer:{name:'증기선',fuel:true,load:3,land:1.6,water:2.4}
};
export const FUEL_FREE=0;
export const STARTER_FLEET=1;
export const FUEL_FLEET=2;
export const FUEL_PER_TRIP=1;
/** Initial vehicle count, also used by older UI callers. */
export const EXPORT_CARTS=STARTER_FLEET;
/** Fleet and save validation ceiling. */
export const MAX_EXPORT_CARTS=7;
const K=(x,z)=>x+','+z;
export const EXPORT_TILES=Array.from({length:8},(_,x)=>({x,z:EXPORT_GATE.z}));
// Starting supplies can leave from the end of the protected road before a warehouse is built.
export const STARTER_LOADING=EXPORT_TILES.at(-1);
const EXPORT_KEYS=new Set(EXPORT_TILES.map(p=>K(p.x,p.z)));
export const isExportTile=(x,z)=>EXPORT_KEYS.has(K(x,z));

/** Lay the export road on a new map or an older save. Buildings already standing on it are kept. */
export function layExportRoad(s){
 for(const p of EXPORT_TILES){const t=s.tile(p.x,p.z);if(!t||t.terrain==='water'||s.at(p.x,p.z))continue;t.nature=null;t.remaining=0;delete t.growAt;s.roads.add(K(p.x,p.z));}
}

// Carts use owned land plus the export road, which stays usable before the western land is bought.
export const passable=s=>(x,z)=>{const t=s.tile(x,z);return !!t&&t.terrain!=='water'&&!s.at(x,z)&&(s.ownedAt(x,z)||isExportTile(x,z));};

const loadingPoints=s=>s.starterStore?stores(s).flatMap(b=>s.entries(b)):[STARTER_LOADING];
/** Warehouse door (or the starting supply cart) to a reachable goal. */
export function findExportRoute(s,goals,block=null,origin=null){
 if(!goals.length)return null;const base=passable(s),pass=block?(x,z)=>(x!==block.x||z!==block.z)&&base(x,z):base,tag=block?'export-cut:'+block.x+','+block.z+':':'export:';
 const far=p=>Math.min(...goals.map(g=>Math.abs(p.x-g.x)+Math.abs(p.z-g.z)));
 const near=d=>[...goals].sort((a,c)=>Math.abs(a.x-d.x)+Math.abs(a.z-d.z)-Math.abs(c.x-d.x)-Math.abs(c.z-d.z));
 for(const door of (origin?s.entries(origin):loadingPoints(s)).filter(p=>!block||p.x!==block.x||p.z!==block.z).sort((a,c)=>far(a)-far(c)))for(const goal of near(door)){const p=s.path(door,goal,pass,tag);if(p)return [door,...p];}
 return null;
}

/** Warehouse door to the active export terminal (trade-terminals.js), or null with the reason. Cached per map revision. */
export function exportRoute(s){
 if(s.exportRevision===s.revision)return s.exportCache;
 s.exportRevision=s.revision;const t=activeTerminal(s),route=findExportRoute(s,t.goals);
 const result=route?{route,error:null}:{route:null,error:(s.warehouse?'창고':'미니 창고')+'에서 '+(t.id==='gate'?'수출 관문':t.name)+'까지 길이 막혔습니다'};
 return s.exportCache=result;
}

/** True when a building on (x,z) would cut the open road from the warehouse to the export terminal (audit X1). */
export function cutsExportRoute(s,x,z){
 const goals=activeTerminal(s).goals;
 return stores(s).some(store=>{const before=findExportRoute(s,goals,null,store);return before?.some(p=>p.x===x&&p.z===z)&&!findExportRoute(s,goals,{x,z},store);});
}

const water=(s,x,z)=>s.tile(x,z)?.terrain==='water';
const STEPS=[[1,0],[-1,0],[0,1],[0,-1]];
/** Breadth-first path from any start to the first tile that meets goal, or null. */
function search(starts,pass,goal){
 const prev=new Map(),queue=[];for(const p of starts){const k=K(p.x,p.z);if(!prev.has(k)){prev.set(k,null);queue.push(p);}}
 for(let i=0;i<queue.length;i++){const p=queue[i];if(goal(p.x,p.z)){const path=[];for(let k=K(p.x,p.z);k;k=prev.get(k)){const [x,z]=k.split(',').map(Number);path.unshift({x,z});}return path;}
  for(const [dx,dz] of STEPS){const x=p.x+dx,z=p.z+dz,k=K(x,z);if(!prev.has(k)&&pass(x,z)){prev.set(k,K(p.x,p.z));queue.push({x,z});}}}
 return null;
}
/** Water tiles joined to a map edge: the river or sea a raft can leave by. Terrain never changes, so it is kept per map. */
function outlet(s){
 if(s.outletWater)return s.outletWater;const seen=new Set(),queue=[];
 for(const t of s.tiles)if(t.terrain==='water'&&(t.x===0||t.z===0||t.x===N-1||t.z===N-1)){seen.add(K(t.x,t.z));queue.push(t);}
 for(let i=0;i<queue.length;i++){const p=queue[i];for(const [dx,dz] of STEPS){const x=p.x+dx,z=p.z+dz,k=K(x,z);if(!seen.has(k)&&water(s,x,z)){seen.add(k);queue.push({x,z});}}}
 return s.outletWater=seen;
}
/** True when the site's water leaves the map, so its free fleet has a raft. */
export const waterside=s=>outlet(s).size>0;
/** Rafts and steamers: warehouse door to the nearest reachable shore by land, then down the water to the map edge.
 *  Null when no owned shore on outlet water can be reached; those boats then use the export road. Cached per revision. */
export function waterRoute(s){
 if(s.waterRevision===s.revision)return s.waterCache;s.waterRevision=s.revision;s.waterCache=null;
 const out=outlet(s);if(!out.size)return null;const land=passable(s),shore=(x,z)=>STEPS.some(([dx,dz])=>out.has(K(x+dx,z+dz)));
 const walk=search(loadingPoints(s),land,shore);if(!walk)return null;const end=walk.at(-1),launch=STEPS.map(([dx,dz])=>({x:end.x+dx,z:end.z+dz})).filter(p=>out.has(K(p.x,p.z)));
 const sail=search(launch,(x,z)=>out.has(K(x,z)),(x,z)=>x===0||z===0||x===N-1||z===N-1);
 return s.waterCache=sail?[...walk,...sail]:null;
}
/** The supplied truck plus vehicles from operating terminals and later ranks. */
export function fleet(s){
 const extra=s.buildings.filter(b=>BUILDINGS[b.type].terminal&&b.health>0&&b.enabled!==false&&!(b.movingUntil>s.time)).length+(s.rank>=14?2:0)+s.buildings.reduce((n,b)=>n+(b.health>0&&b.enabled!==false?BUILDINGS[b.type].exportCarts||0:0),0);
 const free=['van'],fuel=Array.from({length:Math.min(MAX_EXPORT_CARTS-1,extra)},()=> 'truck');
 // Each shipment holds the slot of its kind; shipments saved before vehicles existed are wagons and take any slot left.
 const slots=[...free,...fuel].map(kind=>({kind,busy:false}));
 for(const sh of s.shipments){const slot=slots.find(v=>!v.busy&&v.kind===(sh.vehicle||'wagon'))||slots.find(v=>!v.busy);if(slot)slot.busy=true;}
 return slots;
}
/** Idle slots stay visible on the export road, or at a reachable shore for boats. Never saved as shipments. */
export function parkedVehicles(s){
 const slots=fleet(s),sail=slots.some(v=>!v.busy&&VEHICLES[v.kind].water)?waterRoute(s)?.filter(p=>water(s,p.x,p.z)&&!s.at(p.x,p.z)):null;
 let berth=0;
 return slots.flatMap((v,i)=>{
  if(v.busy)return [];
  const afloat=VEHICLES[v.kind].water&&sail?.[berth++],p=afloat||EXPORT_TILES[EXPORT_TILES.length-1-i];
  if(!p||s.at(p.x,p.z)||s.tile(p.x,p.z)?.terrain==='water'&&!afloat)return [];
  return [{...v,id:i,x:p.x,z:p.z,afloat:!!afloat}];
 });
}
/** Fuel above the warehouse reserve (production needs, freight, the open contract and the player's own reserve). Anything
 *  that burns fuel from a site's stock (vehicles here, the campaign's freight trucks) should spend only this. */
export const spareFuel=s=>Math.floor((s.availableStock?.('fuel')??s.stock.fuel??0)-(s.minimumStock?.('fuel')??0));
/** The vehicle the next shipment would take: a free one first, then a fuel one while spare fuel lasts. hold: fuel the
 *  shipment itself carries, which the vehicle may not burn. */
export function nextVehicle(s,hold=0){
 const slots=fleet(s),free=slots.find(v=>!v.busy&&!VEHICLES[v.kind].fuel);if(free)return free.kind;
 const fuel=slots.find(v=>!v.busy&&VEHICLES[v.kind].fuel);return fuel&&spareFuel(s)-hold>=tripFuel(s)?fuel.kind:null;
}
/** Idle vehicles whose round-trip fuel is available. */
export function idleVehicles(s){const slots=fleet(s).filter(v=>!v.busy);return slots.filter(v=>!VEHICLES[v.kind].fuel).length+Math.min(slots.filter(v=>VEHICLES[v.kind].fuel).length,Math.max(0,Math.floor(spareFuel(s)/tripFuel(s))));}
/** Goods the next vehicle can carry: the terminal's lot times its load. */
export const vehicleLoad=(s,kind=nextVehicle(s)||'wagon')=>Math.max(1,Math.floor(tradeCapacity(s)*VEHICLES[kind].load));
/** Fuel a shipment carries that the reserve has not already set aside, which its vehicle may not burn. The lord's order
 *  is already in the reserve (economy.js reserveFor) and leaves with this shipment, so it holds nothing extra (audit C7:
 *  it was counted twice and a truck needed the order's fuel twice over). An import carries nothing out. */
export const tripFuel=s=>tradeJourney(s,activeTerminal(s)).fuel;
export const fuelHold=(item,amount,kind)=>item==='fuel'&&kind!=='import'&&kind!=='contract'?amount:0;
/** Why nothing can leave now, or null. */
export function shipmentError(s,hold=0){
 const {route,error}=exportRoute(s);if(!route)return error;if(nextVehicle(s,hold))return null;
 const slots=fleet(s),fuelIdle=slots.some(v=>!v.busy&&VEHICLES[v.kind].fuel);
 return fuelIdle?'연료 부족 · 이번 왕복에 '+tripFuel(s)+'개 필요 · 시장에서 연료를 수입하세요':'운송 수단이 모두 운행 중입니다 · 귀환 후 출발합니다';
}
/** Send goods (or, for an import, an empty vehicle) toward the terminal. kind: undefined sale, 'contract', 'state', 'import'. */
function storeRoute(s,b,t){
 const pass=passable(s);
 for(const door of s.entries(b))for(const goal of t.goals){const route=s.path(door,goal,pass,'store-export:');if(route)return [door,...route];}
 return null;
}
export function exportableStock(s,item){const t=activeTerminal(s);return stores(s).reduce((n,b)=>n+(storeRoute(s,b,t)?storeStock(s,b,item):0),0);}
export function dispatchShipment(s,item,amount,revenue,auto,extra={}){
 const hold=fuelHold(item,amount,extra.kind),terminal=activeTerminal(s),journey=tradeJourney(s,terminal),importing=extra.kind==='import';
 const supplied=importing&&item==='fuel',vehicle=nextVehicle(s,hold)||(supplied?fleet(s).find(v=>!v.busy)?.kind:null);
 if(!vehicle)return fleet(s).every(v=>v.busy)?'운송 수단이 모두 운행 중입니다':'연료 부족 · 시장에서 연료를 수입하세요';
 const candidates=stores(s).map(b=>({b,route:storeRoute(s,b,terminal)})).filter(v=>v.route).sort((a,b)=>a.route.length-b.route.length);
 const pickups=[];let left=amount,route=[],store=null;
 if(importing){const dest=candidates.find(v=>freeSpace(s,v.b,item)>=amount);if(!dest)return '수입품을 받을 연결된 창고의 공간이 부족합니다';store=dest.b;route=dest.route;}
 else{
  for(const v of candidates){const n=Math.min(left,Math.floor(storeStock(s,v.b,item)));if(n<=0)continue;
   if(!route.length){route=v.route.slice(0,1);store=v.b;}
   else{const link=s.path(route.at(-1),v.route[0],passable(s),'store-export:');if(!link)continue;route.push(...link);}
   pickups.push({store:v.b,amount:n});left-=n;
   if(!left){route.push(...v.route.slice(1));break;}
  }
  if(left)return '수출 터미널로 운반할 수 있는 창고 재고가 부족합니다';
 }
 const port=terminal.building&&s.buildings.find(b=>b.id===terminal.building&&BUILDINGS[b.type].onWater);
 const portIndex=route.length-1;
 if(port){
  const sail=search([{x:port.x,z:port.z}],(x,z)=>water(s,x,z)&&!s.at(x,z),(x,z)=>x===0||z===0||x===N-1||z===N-1);
  // Inland lake ports transfer onto their regional shipping route at the pier.
  route.push(...(sail||[{x:port.x,z:port.z}]));
 }
 const vendorFuel=supplied&&spareFuel(s)-hold<journey.fuel;
 if(!vendorFuel){if(spareFuel(s)-hold<journey.fuel)return '연료가 부족합니다';s.stock.fuel-=journey.fuel;}
 s.logisticsStats.fuel=(s.logisticsStats.fuel||0)+journey.fuel;s.logisticsStats.fuelTrips=(s.logisticsStats.fuelTrips||0)+1;
 for(const pick of pickups)withdraw(s,item,pick.amount,pick.store);
 s.shipments.push({id:(s.nextShipmentId=(s.nextShipmentId||0)+1),item,amount,revenue,auto:!!auto,...extra,vehicle,storeId:store.id,terminalId:terminal.id,portIndex,portBuilding:port?.id||null,waterVehicle:port?'steamer':null,...journey,route:route.map(p=>({x:p.x,z:p.z})),progress:0,phase:'out',away:null,remaining:0});return null;
}

/** Where a cart stands along its route, and which way it faces. */
export function shipmentPose(sh){
 const r=sh.route,last=r.length-1,p=Math.max(0,Math.min(last,sh.progress)),i=Math.min(last-1,Math.floor(p)),f=p-i;
 if(last<1)return {x:r[0].x,z:r[0].z,dx:-1,dz:0};
 const a=r[i],b=r[i+1],sign=sh.phase==='out'?1:-1;return {x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f,dx:(b.x-a.x)*sign,dz:(b.z-a.z)*sign};
}

// At the terminal a sale, contract or state order is paid once (the phase turns to 'back' in the same step, so a save
// holds either the unpaid or the paid shipment). An import is loaded there and unloaded at the warehouse on return.
function arrive(s,sh){
 const end=sh.route[sh.route.length-1];if(sh.kind==='import'){s.sound('pickup',end.x,end.z);return;}
 s.money+=sh.revenue;s.budget.income+=sh.revenue;s.totalRevenue+=sh.revenue;s.sold[sh.item]=(s.sold[sh.item]||0)+sh.amount;
 if(sh.kind==='contract'){s.contracts++;s.contractReadyAt=s.time+CONTRACT_WAIT;s.sound('contract',end.x,end.z);s.notify('영주 납품 완료 · '+RESOURCES[sh.item].name+' '+sh.amount+'개 · +'+sh.revenue+'G · 다음 주문은 하루 뒤','success');return;}
 s.sound('sell',end.x,end.z);if(!sh.auto)s.notify((sh.label?sh.label+' · ':'')+RESOURCES[sh.item].name+' '+sh.amount+'개 '+(sh.kind==='state'?'교역':'수출')+' 완료 · +'+sh.revenue+'G','success');
}
function unload(s,sh){deposit(s,sh.item,sh.amount,storeById(s,sh.storeId)||s.warehouse||s.starterStore);s.sound('delivery',sh.route[0].x,sh.route[0].z);s.notify(RESOURCES[sh.item].name+' '+sh.amount+'개 수입품 입고','success');s.checkStorage?.();}

export function tickShipments(s,dt){
 for(const sh of s.shipments){
  if(sh.away){
   sh.remaining=Math.max(0,sh.remaining-dt);
   if(sh.remaining>0)continue;
   if(sh.away==='out'){sh.phase='back';arrive(s,sh);sh.away='back';sh.remaining=sh.duration;}
   else sh.away=null;
   continue;
  }
  const pose=shipmentPose(sh),x=Math.round(pose.x),z=Math.round(pose.z),key=K(x,z),v=VEHICLES[sh.vehicle]||VEHICLES.truck;
  const speed=1.25*(water(s,x,z)?2:v.land*(s.paved?.has(key)?2.2:s.roads.has(key)?1.7:1));
  if(sh.phase==='out'){
   sh.progress=Math.min(sh.route.length-1,sh.progress+dt*speed);
   if(sh.kind!=='import'&&sh.portBuilding&&!sh.portLoaded&&sh.progress>=(sh.portIndex||0)){recordTerminalTransfer(s,sh,sh.portBuilding,sh.route[sh.portIndex]);sh.portLoaded=true;}
   if(sh.progress>=sh.route.length-1){if(sh.duration){sh.away='out';sh.remaining=sh.duration;}else{sh.phase='back';arrive(s,sh);}}
  }else{sh.progress-=dt*speed;if(sh.kind==='import'&&sh.portBuilding&&!sh.portUnloaded&&sh.progress<=(sh.portIndex||0)){recordTerminalTransfer(s,sh,sh.portBuilding,sh.route[sh.portIndex]);sh.portUnloaded=true;}if(sh.progress<=0&&sh.kind==='import')unload(s,sh);}
 }
 s.shipments=s.shipments.filter(sh=>sh.phase==='out'||sh.away||sh.progress>0);
}

/** What the trade panel shows: connection, every vehicle slot and whether fuel vehicles can run now. */
export function exportStatus(s){
 const {route,error}=exportRoute(s),vehicles=fleet(s).map(v=>({...v,name:VEHICLES[v.kind].name,fuel:VEHICLES[v.kind].fuel})),fuelReady=spareFuel(s)>=tripFuel(s);
 return {connected:!!route,error,busy:s.shipments.length,carts:vehicles.filter(v=>!v.fuel||fuelReady).length,vehicles,fuelFree:FUEL_FREE,fuelPerTrip:tripFuel(s),...tradeJourney(s,activeTerminal(s)),fuelReady,spareFuel:Math.max(0,spareFuel(s)),waterside:waterside(s),waterRoute:!!waterRoute(s),
  inTransit:s.shipments.filter(sh=>sh.phase==='out'&&sh.kind!=='import').reduce((n,sh)=>n+sh.revenue,0),imports:s.shipments.filter(sh=>sh.kind==='import').length,contract:s.shipments.some(sh=>sh.kind==='contract'&&sh.phase==='out')};
}
