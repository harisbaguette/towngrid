import {BUILDINGS} from './simulation.js';
export const RELOCATION_TIME=6;
export const relocationCost=(s,b)=>Math.max(5,Math.ceil(s.buildCost(b.type)*.1));
export function canRelocate(s,id,x,z){
 const b=s.buildings.find(v=>v.id===id);if(!b)return '이전할 시설을 선택하세요';
 if(b.movingUntil>s.time)return '이전 작업 중입니다';
 if(b.x===x&&b.z===z)return '다른 빈 칸을 선택하세요';
 if(s.shipments.some(sh=>sh.storeId===id||sh.terminalId==='b:'+id))return '운송 수단이 돌아온 뒤 이전하세요';
 const list=s.buildings;s.buildings=list.filter(v=>v!==b);s.revision++;
 let error;try{error=s.canBuild(b.type,x,z,true);}finally{s.buildings=list;s.revision++;}
 return error||s.moneyShort(relocationCost(s,b),'이전 비용 ')||null;
}
export function relocate(s,id,x,z){
 const error=canRelocate(s,id,x,z);if(error)return {ok:false,error};
 const b=s.buildings.find(v=>v.id===id),cost=relocationCost(s,b);
 for(const w of s.workers)if(w.task&&(w.task.building===id||w.task.sourceId===id||w.task.targetId===id||w.task.sourceStore===id||w.task.targetStore===id))s.refundTask(w);
 b.x=x;b.z=z;b.movingUntil=s.time+RELOCATION_TIME;b.working=false;b.status='이전 중';delete b.refundUntil;delete b.cleared;
 const t=s.tile(x,z);t.nature=null;t.remaining=0;delete t.growAt;
 for(const w of s.workers)if(w.homeId===id&&!w.task){const door=s.entries(b)[0]||{x,z};w.x=door.x;w.z=door.z;w.atHome=false;w.route=[];w.phase='idle';delete w.idleSince;}
 s.money-=cost;s.revision++;s.sound('build',x,z);s.notify(BUILDINGS[b.type].name+' 이전 · '+cost+'G');return {ok:true,id,cost};
}
