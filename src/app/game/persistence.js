import {PROVINCES} from './territory.js';
import {BUILDINGS,RESOURCES,N,homeCapacity} from './simulation.js';
import {NATIONS,RANKS,RACES} from './world.js';
import {MAX_EXPORT_CARTS} from './export-route.js';
export const SAVE_KEY='first-land-v1';
export const RECOVERY_KEY=SAVE_KEY+'-recovery';
export const BACKUP_KEY=SAVE_KEY+'-backup';
const fail=()=>{throw new Error('유효한 타운그리드 저장 파일이 아닙니다. 현재 진행은 유지됩니다.');};
const number=(n,min=0,max=1e12)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const point=k=>typeof k==='string'&&/^\d{1,2},\d{1,2}$/.test(k)&&k.split(',').every(v=>+v<N);
const ref=(table,key)=>typeof key==='string'&&Object.hasOwn(table,key);
const label=(v,max=500)=>typeof v==='string'&&v.length<=max;
const route=value=>Array.isArray(value)&&value.length<=N*N&&value.every(p=>p&&number(p.x,0,N-1)&&number(p.z,0,N-1));
const events=['storm','illness','strike','raid','manaStorm','sanction'];
function numericFields(o,keys,min=0,max=1e12){for(const k of keys)if(o[k]!==undefined&&!number(o[k],min,max))fail();}
function flags(o,keys){for(const k of keys)if(o[k]!==undefined&&typeof o[k]!=='boolean')fail();}
function safeObject(value,depth=0){if(depth>40||(typeof value==='number'&&!Number.isFinite(value)))fail();if(value&&typeof value==='object')for(const [k,v]of Object.entries(value)){if(['__proto__','prototype','constructor'].includes(k))fail();safeObject(v,depth+1);}}
function resourceMap(value){if(!value||typeof value!=='object'||Array.isArray(value))fail();for(const[id,n]of Object.entries(value))if(!ref(RESOURCES,id)||!number(n))fail();}
function validateSimulation(s){
 if(!s||![1,2,3,4,5,6,7,8].includes(s.version)||!ref(NATIONS,s.nation||'estern')||!number(s.time)||!number(s.money,-1e12)||!number(s.debt)||!s.stock||!Array.isArray(s.buildings)||s.buildings.length>N*N||!Array.isArray(s.owned)||s.owned.length>N*N||!s.owned.every(point))fail();
 resourceMap(s.stock);if(s.produced)resourceMap(s.produced);if(s.sold)resourceMap(s.sold);if(s.reserves)resourceMap(s.reserves);
 if(s.charter!==undefined&&s.charter!==null&&!['industry','commons','trade'].includes(s.charter))fail();
 if(s.challenge)numericFields(s.challenge,['uptime','bestUptime','healthy','bestHealthy']);
 if(s.health){numericFields(s.health,['infection'],0,100);numericFields(s.health,['sanitationUntil','nextCare','recoveries']);}
 if(s.market){if(!s.market.pressure)fail();resourceMap(s.market.pressure);}
 if(s.rescueQuest){if(!Number.isInteger(s.rescueQuest.step))fail();numericFields(s.rescueQuest,['step'],0,5);numericFields(s.rescueQuest,['remaining'],0,100);}
 if(s.logisticsStats)numericFields(s.logisticsStats,['direct','delivered']);
 if(s.race&&!ref(RACES,s.race))fail();
 if(!['river','coast','highland'].includes(s.region))fail();
 numericFields(s,['time','nextEvent','nextId','seed','raidCount','eventCount','contracts','expansions','totalRevenue','wardUntil','healthUntil','outageUntil','strikeUntil','sanctionUntil','batteryCharge','diseaseUntil']);
 numericFields(s,['lastRecoveryDay'],-1e12);flags(s,['family','protected','emergencyUsed']);
 if(s.budget){if(typeof s.budget!=='object')fail();numericFields(s.budget,['day','income','expenses','lastIncome','lastExpenses']);}
 if(s.autoSell)for(const[k,v]of Object.entries(s.autoSell))if(!ref(RESOURCES,k)||typeof v!=='boolean')fail();
 if(s.pendingEvent&&(!events.includes(s.pendingEvent.type)||!number(s.pendingEvent.at)))fail();
 const ids=new Set(),occupied=new Set();
 for(const b of s.buildings){if(!ref(BUILDINGS,b.type)||!Number.isInteger(b.id)||ids.has(b.id)||!Number.isInteger(b.x)||!Number.isInteger(b.z)||b.x<0||b.x>=N||b.z<0||b.z>=N||!number(b.health,0,100)||!number(b.out)||!number(b.progress,0,1.01)||!b.inputs)fail();ids.add(b.id);const k=`${b.x},${b.z}`;if(occupied.has(k))fail();occupied.add(k);for(const[r,n]of Object.entries(b.inputs))if(!ref(RESOURCES,r)||!number(n))fail();}
 for(const b of s.buildings){if(b.level!==undefined&&(!Number.isInteger(b.level)||b.level<1||b.level>3))fail();if(b.race&&!ref(RACES,b.race))fail();numericFields(b,['activeUntil','age','animationTime','cycles']);numericFields(b,['priority'],0,2);flags(b,['enabled','working','specialized','armorUsed']);}
 if(s.nextId!==undefined&&(!Number.isInteger(s.nextId)||[...ids].some(id=>id>=s.nextId)))fail();
 for(const key of ['roads','rails'])if(s[key]&&(!Array.isArray(s[key])||!s[key].every(point)))fail();
 if(s.shipments!==undefined&&(!Array.isArray(s.shipments)||s.shipments.length>MAX_EXPORT_CARTS))fail();for(const sh of s.shipments||[]){if(!sh||!Number.isInteger(sh.id)||!ref(RESOURCES,sh.item)||!Number.isInteger(sh.amount)||!number(sh.amount,1,1e6)||!number(sh.revenue)||!route(sh.route)||!sh.route.length||!number(sh.progress,0,sh.route.length-1)||!['out','back'].includes(sh.phase))fail();flags(sh,['auto']);}if(s.nextShipmentId!==undefined&&!Number.isInteger(s.nextShipmentId))fail();
 // An id the current map no longer has falls back to the best route (trade-routes.js).
 if(s.tradeRoute!==undefined&&s.tradeRoute!==null&&!label(s.tradeRoute,64))fail();
 if(s.workers&&(!Array.isArray(s.workers)||s.workers.length>Math.max(100,s.buildings.reduce((n,b)=>n+homeCapacity(b),0))))fail();if(s.nextWorkerId!==undefined&&!Number.isInteger(s.nextWorkerId))fail();
 const workerIds=new Set();for(const w of s.workers||[]){if(!w||!Number.isInteger(w.id)||workerIds.has(w.id)||!number(w.x,-1,N)||!number(w.z,-1,N)||!route(w.route))fail();workerIds.add(w.id);if(w.task?.sourceId&&!ids.has(w.task.sourceId))fail();if(w.task?.targetId&&!ids.has(w.task.targetId))fail();if(w.race&&!ref(RACES,w.race))fail();if(w.homeId!==undefined&&!ids.has(w.homeId))fail();numericFields(w,['dir','think'],-1e12);if(w.task&&(!ref(RESOURCES,w.task.item)||!number(w.task.amount)||!['pickup','supply'].includes(w.task.kind)||!ids.has(w.task.building)||(w.task.dest&&!route([w.task.dest]))))fail();}
 if(s.guards&&(!Array.isArray(s.guards)||s.guards.length>8))fail();for(const g of s.guards||[]){if(!g||!ref(RACES,g.race)||!route(g.route)||!number(g.x,-1,N)||!number(g.z,-1,N)||!number(g.hp,0,75)||!ids.has(g.homeId))fail();}
 if(s.attackers&&(!Array.isArray(s.attackers)||s.attackers.length>100))fail();for(const w of s.attackers||[]){if(!w||!ref(RACES,w.race)||!number(w.x,-1,N)||!number(w.z,-1,N)||!route(w.route)||!number(w.hp)||!number(w.maxHp,1)||w.hp>w.maxHp)fail();numericFields(w,['until','delay']);numericFields(w,['dir'],-1e12);}
 if(s.raid){if(!['demon','orc','beast'].includes(s.raid.faction))fail();numericFields(s.raid,['started','ends','strength','damage','defeated','boostUntil','lastHit']);flags(s.raid,['finished','boosted','disrupted']);}
 if(s.tiles&&(!Array.isArray(s.tiles)||s.tiles.length!==N*N||s.tiles.some(t=>!t||![null,'tree','rock','sapling'].includes(t.nature)||!number(t.remaining,-100,1e6))))fail();
 if(s.events&&(!Array.isArray(s.events)||s.events.length>1000))fail();
 for(const e of s.events||[])if(!e||!events.includes(e.type)||!number(e.time))fail();
 if(s.rank!==undefined&&(!Number.isInteger(s.rank)||s.rank<0||s.rank>=RANKS.length))fail();
 return s;
}
export function validateSave(data){
 safeObject(data);
 if(!data?.campaignVersion)return validateSimulation(data);
 if(data.campaignVersion!==1||!Array.isArray(data.sites)||data.sites.length<1||data.sites.length>50||!data.treasury||!number(data.treasury.money,-1e12)||!number(data.treasury.debt)||!Number.isInteger(data.treasury.rank)||data.treasury.rank<0||data.treasury.rank>=RANKS.length)fail();
 resourceMap(data.treasury.produced);resourceMap(data.treasury.sold);if(!number(data.support,0,100)||!number(data.defense,0,1e6))fail();
 for(const key of ['newStates','factions','investments','recognition','history'])if(!Array.isArray(data[key]))fail();
 if(data.newStates.length>1000||data.factions.length>100||data.investments.length>10000||data.history.length>1000)fail();
 numericFields(data,['nextSite','nextRoute','nextState','deliveries','lastWorldDay']);
 flags(data.treasury,['family','emergencyUsed']);numericFields(data.treasury,['contracts','totalRevenue']);
 const stateIds=new Set();for(const state of data.newStates){if(!state||!label(state.id,100)||stateIds.has(state.id)||!label(state.name,2000)||!ref(NATIONS,state.rootNation||state.parent)||!number(state.wealth,-1e12)||!number(state.industry,1,12))fail();stateIds.add(state.id);numericFields(state,['age','day','trades','lastTradeDay']);numericFields(state,['unrest','relation'],0,105);flags(state,['pact']);}
 const factionIds=new Set();for(const f of data.factions){if(!f||!ref(NATIONS,f.id)||factionIds.has(f.id)||!number(f.wealth,-1e12)||!number(f.industry,1,12)||!number(f.unrest,-1e12)||!number(f.enterprise)||!number(f.age))fail();factionIds.add(f.id);}
 for(const i of data.investments)if(!i||!ref(NATIONS,i.nation)||!number(i.day))fail();
 for(const h of data.history)if(!h||!number(h.day)||!label(h.text,4000))fail();
 if(data.treasury.rescueQuest){const q=data.treasury.rescueQuest;if(!Number.isInteger(q.step)||!number(q.step,0,5)||!number(q.remaining,0,100))fail();}
 if(data.provinces){const valid=new Set(PROVINCES.map(p=>p.id));for(const[id,v]of Object.entries(data.provinces))if(!valid.has(id)||!v||(!ref(NATIONS,v.owner)&&!stateIds.has(v.owner)))fail();}
 if(data.recognition.some(id=>!ref(NATIONS,id)&&!stateIds.has(id)))fail();
 if(data.relations)for(const[id,v]of Object.entries(data.relations))if(!ref(NATIONS,id)||!number(v,-100,100))fail();
 const ids=new Set();for(const s of data.sites){if(typeof s.id!=='string'||ids.has(s.id)||!ref(NATIONS,s.nation))fail();ids.add(s.id);validateSimulation(s.simulation);}
 for(const site of data.sites){if(!label(site.name)||!number(site.unrest,0,100)||site.nation!==site.simulation.nation)fail();flags(site,['territory']);}
 if(!ids.has(data.homeId)||!ids.has(data.activeId)||!Array.isArray(data.routes)||data.routes.length>300)fail();
 for(const r of data.routes)if(!ids.has(r.from)||!ids.has(r.to)||r.from===r.to||!ref(RESOURCES,r.item)||!['truck','rail'].includes(r.mode)||!number(r.amount,1,30)||!number(r.cargo,0,30)||!number(r.remaining,0,10000))fail();
 const routeIds=new Set();for(const r of data.routes){if(!label(r.id,100)||routeIds.has(r.id)||!number(r.duration,r.cargo?1:0,10000)||!number(r.completed))fail();routeIds.add(r.id);numericFields(r,['ambush'],-1);flags(r,['enabled','closing']);}
 const active=data.sites.find(s=>s.id===data.activeId).simulation;if(data.lastWorldDay!==undefined&&Math.abs(data.lastWorldDay-(Math.floor(active.time/80)+1))>1)fail();
 return data;
}
function checksum(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
export function encodeSave(data){validateSave(data);const game=JSON.stringify(data);return JSON.stringify({format:'erdynth',version:1,savedAt:new Date().toISOString(),checksum:checksum(game),game:data});}
export function decodeSave(raw){if(typeof raw!=='string'||raw.length>8_000_000)fail();const data=JSON.parse(raw);if(['orvetharn','erdynth'].includes(data?.format)){if(data.version!==1||checksum(JSON.stringify(data.game))!==data.checksum)throw new Error('저장 파일이 손상되었습니다. 백업 파일을 불러오세요.');return validateSave(data.game);}return validateSave(data);}
function validRaw(raw){try{if(raw){decodeSave(raw);return true;}}catch{}return false;}
export function backupSave(storage){const raw=storage.getItem(SAVE_KEY);if(!validRaw(raw))return false;storage.setItem(BACKUP_KEY,raw);if(storage.getItem(BACKUP_KEY)!==raw)throw new Error('이전 진행을 백업하지 못했습니다. 저장 파일을 먼저 내보내세요.');return true;}
export function readRecovery(storage){for(const key of [RECOVERY_KEY,BACKUP_KEY]){const raw=storage.getItem(key);if(validRaw(raw))return raw;}throw new Error('복구 가능한 백업이 없습니다. 저장 파일을 불러오세요.');}
export function writeSave(storage,data){
 const raw=encodeSave(data),previous=storage.getItem(SAVE_KEY);
 // Keep new-game/import backups separate from rolling recovery. Corrupt data never replaces a healthy backup.
 if(previous!==raw&&validRaw(previous)){storage.setItem(RECOVERY_KEY,previous);if(storage.getItem(RECOVERY_KEY)!==previous)throw new Error('자동 백업을 확인하지 못했습니다.');}
 storage.setItem(SAVE_KEY,raw);if(storage.getItem(SAVE_KEY)!==raw)throw new Error('저장을 확인하지 못했습니다.');return raw;
}
