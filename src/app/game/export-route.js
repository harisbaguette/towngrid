import {RESOURCES,BUILDINGS,N,CONTRACT_WAIT} from './simulation.js';
import {activeTerminal,tradeCapacity} from './trade-terminals.js';
// Every map has a fixed export road from the west edge to the starting land.
// Sold goods leave the warehouse on a vehicle and are paid for when it reaches the export terminal.
// Imports ride the same vehicles the other way, and the lord's contracts and state orders go out on them too.
export const EXPORT_GATE={x:0,z:11};
// Vehicles (second pass, docs/BALANCE_PATCH_20260928.md 12-4). Three run without fuel: two wagons and a raft on a site
// whose water leaves the map, else three wagons. More at once need fuel: a truck by road or a steamer by water burns
// FUEL_PER_TRIP per trip, carries more and runs faster. load multiplies the terminal's lot; speed is tiles per second
// before road bonuses. Without fuel only the free three run, so fuel speeds trade up and never blocks it.
export const VEHICLES={
 wagon:{name:'마차',fuel:false,load:1,land:1,water:0},
 raft:{name:'뗏목',fuel:false,load:1.5,land:1,water:1.2},
 truck:{name:'트럭',fuel:true,load:2,land:2,water:0},
 steamer:{name:'증기선',fuel:true,load:3,land:1.6,water:2.4}
};
export const FUEL_FREE=3;
export const FUEL_FLEET=2;
export const FUEL_PER_TRIP=1;
/** Kept for callers of the old cart count: the free vehicles. */
export const EXPORT_CARTS=FUEL_FREE;
/** Save validation ceiling: the free three, two fuel vehicles and the continental exchange's two more (M8). */
export const MAX_EXPORT_CARTS=7;
const K=(x,z)=>x+','+z;
export const EXPORT_TILES=Array.from({length:8},(_,x)=>({x,z:EXPORT_GATE.z}));
const EXPORT_KEYS=new Set(EXPORT_TILES.map(p=>K(p.x,p.z)));
export const isExportTile=(x,z)=>EXPORT_KEYS.has(K(x,z));

/** Lay the export road on a new map or an older save. Buildings already standing on it are kept. */
export function layExportRoad(s){
 for(const p of EXPORT_TILES){const t=s.tile(p.x,p.z);if(!t||t.terrain==='water'||s.at(p.x,p.z))continue;t.nature=null;t.remaining=0;delete t.growAt;s.roads.add(K(p.x,p.z));}
}

// Carts use owned land plus the export road, which stays usable before the western land is bought.
export const passable=s=>(x,z)=>{const t=s.tile(x,z);return !!t&&t.terrain!=='water'&&!s.at(x,z)&&(s.ownedAt(x,z)||isExportTile(x,z));};

/** Warehouse door to the nearest reachable goal tile, or null. A blocked tile can be left out. */
export function findExportRoute(s,goals,block=null){
 const w=s.warehouse;if(!w||!goals.length)return null;const base=passable(s),pass=block?(x,z)=>(x!==block.x||z!==block.z)&&base(x,z):base,tag=block?'export-cut:'+block.x+','+block.z+':':'export:';
 const far=p=>Math.min(...goals.map(g=>Math.abs(p.x-g.x)+Math.abs(p.z-g.z)));
 const near=d=>[...goals].sort((a,c)=>Math.abs(a.x-d.x)+Math.abs(a.z-d.z)-Math.abs(c.x-d.x)-Math.abs(c.z-d.z));
 for(const door of s.entries(w).filter(p=>!block||p.x!==block.x||p.z!==block.z).sort((a,c)=>far(a)-far(c)))for(const goal of near(door)){const p=s.path(door,goal,pass,tag);if(p)return [door,...p];}
 return null;
}

/** Warehouse door to the active export terminal (trade-terminals.js), or null with the reason. Cached per map revision. */
export function exportRoute(s){
 if(s.exportRevision===s.revision)return s.exportCache;
 s.exportRevision=s.revision;const w=s.warehouse;let result={route:null,error:'창고가 있어야 수출할 수 있습니다'};
 if(w){const t=activeTerminal(s),route=findExportRoute(s,t.goals);result=route?{route,error:null}:{route:null,error:'창고에서 '+(t.id==='gate'?'수출 관문':t.name)+'까지 길이 막혔습니다'};}
 return s.exportCache=result;
}

/** True when a building on (x,z) would cut the open road from the warehouse to the export terminal (audit X1). */
export function cutsExportRoute(s,x,z){
 const {route}=exportRoute(s);if(!route||!route.some(p=>p.x===x&&p.z===z))return false;
 return !findExportRoute(s,activeTerminal(s).goals,{x,z});
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
 const w=s.warehouse,out=outlet(s);if(!w||!out.size)return null;const land=passable(s),shore=(x,z)=>STEPS.some(([dx,dz])=>out.has(K(x+dx,z+dz)));
 const walk=search(s.entries(w),land,shore);if(!walk)return null;const end=walk.at(-1),launch=STEPS.map(([dx,dz])=>({x:end.x+dx,z:end.z+dz})).filter(p=>out.has(K(p.x,p.z)));
 const sail=search(launch,(x,z)=>out.has(K(x,z)),(x,z)=>x===0||z===0||x===N-1||z===N-1);
 return s.waterCache=sail?[...walk,...sail]:null;
}
/** The site's vehicle slots: the free three, then the fuel fleet (two, plus exportCarts of a running exchange). */
export function fleet(s){
 const wet=waterside(s),extra=s.buildings.reduce((n,b)=>n+(b.health>0&&b.enabled!==false?BUILDINGS[b.type].exportCarts||0:0),0);
 const free=wet?['wagon','wagon','raft']:['wagon','wagon','wagon'],fuel=Array.from({length:Math.min(MAX_EXPORT_CARTS-FUEL_FREE,FUEL_FLEET+extra)},(_,i)=>wet&&i%2?'steamer':'truck');
 // Each shipment holds the slot of its kind; shipments saved before vehicles existed are wagons and take any slot left.
 const slots=[...free,...fuel].map(kind=>({kind,busy:false}));
 for(const sh of s.shipments){const slot=slots.find(v=>!v.busy&&v.kind===(sh.vehicle||'wagon'))||slots.find(v=>!v.busy);if(slot)slot.busy=true;}
 return slots;
}
/** Fuel above the warehouse reserve (production needs, freight, the open contract and the player's own reserve). */
export const spareFuel=s=>Math.floor((s.availableStock?.('fuel')??s.stock.fuel??0)-(s.minimumStock?.('fuel')??0));
/** The vehicle the next shipment would take: a free one first, then a fuel one while spare fuel lasts. hold: fuel the
 *  shipment itself carries, which the vehicle may not burn. */
export function nextVehicle(s,hold=0){
 const slots=fleet(s),free=slots.find(v=>!v.busy&&!VEHICLES[v.kind].fuel);if(free)return free.kind;
 const fuel=slots.find(v=>!v.busy&&VEHICLES[v.kind].fuel);return fuel&&spareFuel(s)-hold>=FUEL_PER_TRIP?fuel.kind:null;
}
/** Vehicles that could leave now: idle free ones, plus idle fuel ones while spare fuel covers each trip. Auto-sale keeps
 *  one of them for the player's own orders (contracts, imports, manual sales), so it only ships while two or more are idle. */
export function idleVehicles(s){const slots=fleet(s).filter(v=>!v.busy);return slots.filter(v=>!VEHICLES[v.kind].fuel).length+Math.min(slots.filter(v=>VEHICLES[v.kind].fuel).length,Math.max(0,Math.floor(spareFuel(s)/FUEL_PER_TRIP)));}
/** Goods the next vehicle can carry: the terminal's lot times its load. */
export const vehicleLoad=(s,kind=nextVehicle(s)||'wagon')=>Math.max(1,Math.floor(tradeCapacity(s)*VEHICLES[kind].load));
/** Why nothing can leave now, or null. */
export function shipmentError(s,hold=0){
 const {route,error}=exportRoute(s);if(!route)return error;if(nextVehicle(s,hold))return null;
 const slots=fleet(s),fuelIdle=slots.some(v=>!v.busy&&VEHICLES[v.kind].fuel);
 return '운송 수단 '+slots.filter(v=>v.busy).length+'대가 모두 나가 있습니다'+(fuelIdle?' · 연료가 있으면 트럭'+(waterside(s)?'·증기선':'')+'이 더 나갑니다':'');
}
/** Send goods (or, for an import, an empty vehicle) toward the terminal. kind: undefined sale, 'contract', 'state', 'import'. */
export function dispatchShipment(s,item,amount,revenue,auto,extra={}){
 const hold=item==='fuel'&&extra.kind!=='import'?amount:0,error=shipmentError(s,hold);if(error)return error;const vehicle=nextVehicle(s,hold),spec=VEHICLES[vehicle],boat=spec.water>0&&waterRoute(s),route=boat||exportRoute(s).route;
 if(spec.fuel){s.stock.fuel-=FUEL_PER_TRIP;s.logisticsStats.fuel=(s.logisticsStats.fuel||0)+FUEL_PER_TRIP;s.logisticsStats.fuelTrips=(s.logisticsStats.fuelTrips||0)+1;}
 s.shipments.push({id:(s.nextShipmentId=(s.nextShipmentId||0)+1),item,amount,revenue,auto:!!auto,...extra,vehicle,route:route.map(p=>({x:p.x,z:p.z})),progress:0,phase:'out'});return null;
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
function unload(s,sh){s.stock[sh.item]=(s.stock[sh.item]||0)+sh.amount;s.sound('delivery',sh.route[0].x,sh.route[0].z);s.notify(RESOURCES[sh.item].name+' '+sh.amount+'개 수입품 입고','success');s.checkStorage?.();}

export function tickShipments(s,dt){
 for(const sh of s.shipments){
  const pose=shipmentPose(sh),x=Math.round(pose.x),z=Math.round(pose.z),key=K(x,z),v=VEHICLES[sh.vehicle]||VEHICLES.wagon;
  const speed=1.25*(v.water&&water(s,x,z)?v.water:v.land*(s.paved?.has(key)?2.2:s.roads.has(key)?1.7:1)*(v.fuel?1:s.horse?1.35:1));
  if(sh.phase==='out'){sh.progress+=dt*speed;if(sh.progress>=sh.route.length-1){sh.progress=sh.route.length-1;sh.phase='back';arrive(s,sh);}}
  else{sh.progress-=dt*speed;if(sh.progress<=0&&sh.kind==='import')unload(s,sh);}
 }
 s.shipments=s.shipments.filter(sh=>sh.phase==='out'||sh.progress>0);
}

/** What the trade panel shows: connection, every vehicle slot and whether fuel vehicles can run now. */
export function exportStatus(s){
 const {route,error}=exportRoute(s),vehicles=fleet(s).map(v=>({...v,name:VEHICLES[v.kind].name,fuel:VEHICLES[v.kind].fuel})),fuelReady=spareFuel(s)>=FUEL_PER_TRIP;
 return {connected:!!route,error,busy:s.shipments.length,carts:vehicles.filter(v=>!v.fuel||fuelReady).length,vehicles,fuelFree:FUEL_FREE,fuelPerTrip:FUEL_PER_TRIP,fuelReady,spareFuel:Math.max(0,spareFuel(s)),waterside:waterside(s),waterRoute:!!waterRoute(s),
  inTransit:s.shipments.filter(sh=>sh.phase==='out'&&sh.kind!=='import').reduce((n,sh)=>n+sh.revenue,0),imports:s.shipments.filter(sh=>sh.kind==='import').length,contract:s.shipments.some(sh=>sh.kind==='contract'&&sh.phase==='out')};
}
