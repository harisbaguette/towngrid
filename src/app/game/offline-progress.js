import {BASE_TIME_SCALE,suspendLiveClock} from './game-time.js';
export const OFFLINE_LIMIT_SECONDS=600;
const processing=new WeakMap();

export const isOfflineProcessing=c=>!!c&&processing.has(c);
export function cancelOffline(c){const run=processing.get(c);if(run)run.cancelled=true;}
export function checkpointOffline(c,now=Date.now()){
 // Autosave must not arm a second catch-up while this one yields to the UI.
 if(isOfflineProcessing(c))return;
 c.offline??={enabled:false};c.offline.deficit=c.sites.some(({sim:s})=>(s.books?.last?.net??((s.budget?.lastIncome||0)-(s.budget?.lastExpenses||0)))<0);c.offline.at=now;c.offline.running=!!c.offline.enabled&&!c.trial&&!c.active.paused;
}
export function offlineStop(c){
 if(c.treasury.money<=0)return '운영 자금 부족';
 if(c.offline?.deficit)return '하루 적자 발생';
 for(const {sim:s} of c.sites){
  if(s.pendingEvent||s.raid&&!s.raid.finished||s.health.infection>0||s.strikeUntil>s.time||s.sanctionUntil>s.time)return '대응할 사건 발생';
  const e=s.exportStatus();if(e.spareFuel<Math.max(2,e.fuelPerTrip||0))return '운송 연료 부족';
  if(s.books?.last?.net<0)return '하루 적자 발생';
 }
 return '';
}
export function catchUpOffline(c,now=Date.now(),yieldStep=()=>new Promise(r=>setTimeout(r,0)),shouldStop=()=>false){
 const existing=processing.get(c);if(existing)return existing.promise;
 const run={cancelled:false,promise:null};processing.set(c,run);
 // Start after publishing the promise so even synchronous re-entry joins it.
 run.promise=Promise.resolve().then(async()=>{
  const cfg=c.offline||{},seconds=cfg.enabled&&cfg.running&&!c.trial&&Number.isFinite(cfg.at)&&Number.isFinite(now)?Math.max(0,Math.min(OFFLINE_LIMIT_SECONDS,(now-cfg.at)/1000)):0;
  c.offline={...cfg,at:now,running:false};const s=c.active,start=s.time,cash=c.treasury.money;let stop='';
  const kept=c.sites.map(v=>({sim:v.sim,speed:v.sim.speed,paused:v.sim.paused})),resumeLiveClock=suspendLiveClock(c);
  s.speed=1;s.paused=false;
  try{
   const target=seconds*BASE_TIME_SCALE;let yieldedAt=performance.now();
   for(let n=0;s.time-start<target-1e-8;n++){
    if(run.cancelled||shouldStop()||s.paused||s.speed!==1||c.active!==s){stop='계산 중단 · 일시정지';break;}
    stop=offlineStop(c);if(stop)break;
    const before=s.time;c.tick(Math.min(.25,target-(s.time-start)));
    if(!(s.time>before)){stop='진행 중단 · 일시정지';break;}
    if(n%40===39||performance.now()-yieldedAt>=12){await yieldStep();yieldedAt=performance.now();}
   }
  }finally{
   for(const k of kept){k.sim.speed=k.speed;k.sim.paused=k.paused;k.sim.soundEvents=[];}
   s.paused=true;resumeLiveClock();
  }
  return {seconds:Math.round((s.time-start)/BASE_TIME_SCALE),income:Math.round(c.treasury.money-cash),stop,capped:seconds===OFFLINE_LIMIT_SECONDS};
 }).finally(()=>processing.delete(c));
 return run.promise;
}
