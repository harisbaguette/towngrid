import {RESOURCES} from './simulation.js';
// Every map has a fixed export road from the west edge to the starting land.
// Sold goods leave the warehouse on carts and are paid for when a cart reaches the gate.
export const EXPORT_GATE={x:0,z:11};
export const EXPORT_CARTS=3;
const K=(x,z)=>x+','+z;
export const EXPORT_TILES=Array.from({length:8},(_,x)=>({x,z:EXPORT_GATE.z}));
const EXPORT_KEYS=new Set(EXPORT_TILES.map(p=>K(p.x,p.z)));
export const isExportTile=(x,z)=>EXPORT_KEYS.has(K(x,z));

/** Lay the export road on a new map or an older save. Buildings already standing on it are kept. */
export function layExportRoad(s){
 for(const p of EXPORT_TILES){const t=s.tile(p.x,p.z);if(!t||t.terrain==='water'||s.at(p.x,p.z))continue;t.nature=null;t.remaining=0;delete t.growAt;s.roads.add(K(p.x,p.z));}
}

// Carts use owned land plus the export road, which stays usable before the western land is bought.
const passable=s=>(x,z)=>{const t=s.tile(x,z);return !!t&&t.terrain!=='water'&&!s.at(x,z)&&(s.ownedAt(x,z)||isExportTile(x,z));};

/** Warehouse door to gate, or null with the reason. Cached per map revision. */
export function exportRoute(s){
 if(s.exportRevision===s.revision)return s.exportCache;
 s.exportRevision=s.revision;const w=s.warehouse;let result={route:null,error:'창고가 있어야 수출할 수 있습니다'};
 if(w){result={route:null,error:'창고에서 수출 관문까지 길이 막혔습니다'};const pass=passable(s);
  for(const door of s.entries(w).sort((a,c)=>Math.abs(a.x-EXPORT_GATE.x)+Math.abs(a.z-EXPORT_GATE.z)-Math.abs(c.x-EXPORT_GATE.x)-Math.abs(c.z-EXPORT_GATE.z))){const p=s.path(door,EXPORT_GATE,pass,'export:');if(p){result={route:[door,...p],error:null};break;}}}
 return s.exportCache=result;
}

export function dispatchShipment(s,item,amount,revenue,auto){
 const {route,error}=exportRoute(s);if(!route)return error;if(s.shipments.length>=EXPORT_CARTS)return '수출 마차 '+EXPORT_CARTS+'대가 모두 나가 있습니다';
 s.shipments.push({id:(s.nextShipmentId=(s.nextShipmentId||0)+1),item,amount,revenue,auto:!!auto,route:route.map(p=>({x:p.x,z:p.z})),progress:0,phase:'out'});return null;
}

/** Where a cart stands along its route, and which way it faces. */
export function shipmentPose(sh){
 const r=sh.route,last=r.length-1,p=Math.max(0,Math.min(last,sh.progress)),i=Math.min(last-1,Math.floor(p)),f=p-i;
 if(last<1)return {x:r[0].x,z:r[0].z,dx:-1,dz:0};
 const a=r[i],b=r[i+1],sign=sh.phase==='out'?1:-1;return {x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f,dx:(b.x-a.x)*sign,dz:(b.z-a.z)*sign};
}

function arrive(s,sh){
 s.money+=sh.revenue;s.budget.income+=sh.revenue;s.totalRevenue+=sh.revenue;s.sold[sh.item]=(s.sold[sh.item]||0)+sh.amount;
 s.sound('sell',EXPORT_GATE.x,EXPORT_GATE.z);if(!sh.auto)s.notify(RESOURCES[sh.item].name+' '+sh.amount+'개 수출 완료 · +'+sh.revenue+'G','success');
}

export function tickShipments(s,dt){
 for(const sh of s.shipments){
  const pose=shipmentPose(sh),speed=1.25*(s.roads.has(K(Math.round(pose.x),Math.round(pose.z)))?1.7:1)*(s.horse?1.35:1);
  if(sh.phase==='out'){sh.progress+=dt*speed;if(sh.progress>=sh.route.length-1){sh.progress=sh.route.length-1;sh.phase='back';arrive(s,sh);}}
  else sh.progress-=dt*speed;
 }
 s.shipments=s.shipments.filter(sh=>sh.phase==='out'||sh.progress>0);
}

export function exportStatus(s){const {route,error}=exportRoute(s);return {connected:!!route,error,busy:s.shipments.length,carts:EXPORT_CARTS,inTransit:s.shipments.filter(sh=>sh.phase==='out').reduce((n,sh)=>n+sh.revenue,0)};}
