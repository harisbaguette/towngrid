import {stores,storeStock,freeSpace,withdraw,deposit,storeById} from './storage.js';
import {findExportRoute,EXPORT_GATE} from './export-route.js';
const reachable=(s,mode)=>{if(mode==='rail'&&!s.campaign?.stationReady(s))return [];const station=mode==='rail'&&s.buildings.find(b=>b.type==='station'&&b.health>0&&b.enabled!==false&&!(b.movingUntil>s.time));const goals=mode==='rail'?(station?s.entries(station):[]):[EXPORT_GATE];return stores(s).filter(b=>findExportRoute(s,goals,null,b));};
export function freightPlan(s,item,amount,mode,receive=false,exclude=null){
 let left=amount;const plan=[];for(const b of reachable(s,mode)){const n=Math.min(left,Math.floor(receive?freeSpace(s,b,item,exclude):storeStock(s,b,item)));if(n>0){plan.push({id:b.id,amount:n});left-=n;}if(!left)return plan;}return null;
}
export function takeFreight(s,item,plan){for(const p of plan)withdraw(s,item,p.amount,storeById(s,p.id));}
export function unloadFreight(s,item,plan){for(const p of plan)deposit(s,item,p.amount,storeById(s,p.id));}
