import {PROVINCES,PLOT_INDEX,plotBelongsTo} from './territory.js';
import {BUILDINGS,RESOURCES,N,homeCapacity,unpackTiles,GOOD_EVENTS} from './simulation.js';
import {NATIONS,RANKS,RACES} from './world.js';
import {MAX_EXPORT_CARTS,VEHICLES} from './export-route.js';
import {validLayout} from './world-grid.js';
import {STORE_MODES} from './storage.js';
export const SAVE_KEY='first-land-v1';
export const RECOVERY_KEY=SAVE_KEY+'-recovery';
export const BACKUP_KEY=SAVE_KEY+'-backup';
const fail=()=>{throw new Error('유효한 타운그리드 저장 파일이 아닙니다. 현재 진행은 유지됩니다.');};
const number=(n,min=0,max=1e12)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const point=k=>typeof k==='string'&&/^\d{1,2},\d{1,2}$/.test(k)&&k.split(',').every(v=>+v<N);
const ref=(table,key)=>typeof key==='string'&&Object.hasOwn(table,key);
const label=(v,max=500)=>typeof v==='string'&&v.length<=max;
const route=value=>Array.isArray(value)&&value.length<=N*N&&value.every(p=>p&&number(p.x,0,N-1)&&number(p.z,0,N-1));
const events=['storm','illness','strike','raid','manaStorm','sanction',...GOOD_EVENTS];
function numericFields(o,keys,min=0,max=1e12){for(const k of keys)if(o[k]!==undefined&&!number(o[k],min,max))fail();}
function flags(o,keys){for(const k of keys)if(o[k]!==undefined&&typeof o[k]!=='boolean')fail();}
function safeObject(value,depth=0){if(depth>40||(typeof value==='number'&&!Number.isFinite(value)))fail();if(value&&typeof value==='object')for(const [k,v]of Object.entries(value)){if(['__proto__','prototype','constructor'].includes(k))fail();safeObject(v,depth+1);}}
function resourceMap(value){if(!value||typeof value!=='object'||Array.isArray(value))fail();for(const[id,n]of Object.entries(value))if(!ref(RESOURCES,id)||!number(n))fail();}
const record=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const PROVINCE=new Map(PROVINCES.map(p=>[p.id,p]));
const provinceRef=id=>typeof id==='string'&&PROVINCE.has(id);
const charter=v=>v===undefined||v===null||['industry','commons','trade'].includes(v);
// The open lord's order kept until delivered (simulation.js contractItem, G1-E4): its number and item.
const order=o=>o===undefined||record(o)&&Number.isInteger(o.n)&&o.n>=0&&ref(RESOURCES,o.item);
// The family rescue: the campaign's copy is used as is (shared), a site's copy is merged over defaults (simulation.js MERGED).
const rescue=(q,whole)=>{if(!record(q)||!Number.isInteger(q.step)||!number(q.step,0,5)||!number(whole?q.remaining:q.remaining??0,0,100)||![undefined,null,'river','checkpoint'].includes(q.route))fail();};
// Moving characters (residents, guards, attackers): the fields their walk, work and fight read every step.
function actor(w){numericFields(w,['dir','think','lastAttack','attackAt','handlingTime','moveSpeed','stepDistance','idleFor','hitUntil','target','targetId'],-1e12);flags(w,['walking','attacking','guard','enemy','atHome']);
 for(const k of ['phase','name','appearance','gender'])if(w[k]!==undefined&&!label(w[k],100))fail();if(![undefined,null,'pickup','drop'].includes(w.handling)||w.id!==undefined&&!Number.isInteger(w.id))fail();}
function validateSimulation(s){
 if(!s||![1,2,3,4,5,6,7,8,9].includes(s.version)||!ref(NATIONS,s.nation||'estern')||!number(s.time)||!number(s.money,-1e12)||!number(s.debt)||!s.stock||!Array.isArray(s.buildings)||s.buildings.length>N*N||!Array.isArray(s.owned)||s.owned.length>N*N||!s.owned.every(point))fail();
 resourceMap(s.stock);if(s.produced)resourceMap(s.produced);if(s.sold)resourceMap(s.sold);if(s.reserves)resourceMap(s.reserves);
 if(!charter(s.charter)||!order(s.contractOrder))fail();
 // Objects merged over the defaults on load (simulation.js MERGED) must be objects: a number or text there replaces the
 // default and the first step that writes into it throws.
 for(const key of ['market','health','rescueQuest','logisticsStats','budget','challenge'])if(s[key]!==undefined&&!record(s[key]))fail();
 // The rank's side challenge and, since G1-P2 (progression.js tickChallenges), the rank it counts for and its baselines.
 if(s.challenge){numericFields(s.challenge,['uptime','bestUptime','healthy','bestHealthy','since','deliveredFrom','directFrom','tradesFrom']);if(s.challenge.rank!==undefined&&(!Number.isInteger(s.challenge.rank)||s.challenge.rank<0||s.challenge.rank>=RANKS.length))fail();}
 if(s.health){numericFields(s.health,['infection'],0,100);numericFields(s.health,['sanitationUntil','nextCare','recoveries']);}
 if(s.market){if(!s.market.pressure)fail();resourceMap(s.market.pressure);}
 if(s.rescueQuest)rescue(s.rescueQuest);
 if(s.logisticsStats){numericFields(s.logisticsStats,['direct','delivered','fuel','fuelTrips']);const l=s.logisticsStats.last;if(l!==undefined&&l!==null&&(!record(l)||!ref(RESOURCES,l.item)||!number(l.amount)||!number(l.time)||[l.from,l.to].some(id=>id!==undefined&&id!==null&&!Number.isInteger(id))))fail();}
 if(s.race&&!ref(RACES,s.race))fail();
 if(!['river','coast','highland'].includes(s.region)||s.land!==undefined&&!validLayout(s.land))fail();
 numericFields(s,['time','nextEvent','nextId','seed','raidCount','eventCount','contracts','contractReadyAt','expansions','totalRevenue','wardUntil','healthUntil','outageUntil','strikeUntil','sanctionUntil','harvestUntil','merchantUntil','batteryCharge','diseaseUntil']);
 numericFields(s,['lastRecoveryDay'],-1e12);flags(s,['family','protected','emergencyUsed','starterDrain']);
 if(s.stockCap!==undefined)resourceMap(s.stockCap);if(s.haulGear!==undefined&&(!Number.isInteger(s.haulGear)||s.haulGear<0||s.haulGear>2))fail();
 if(s.budget){if(typeof s.budget!=='object')fail();numericFields(s.budget,['day','income','expenses','lastIncome','lastExpenses']);}
 if(s.autoSell)for(const[k,v]of Object.entries(s.autoSell))if(!ref(RESOURCES,k)||typeof v!=='boolean')fail();
 if(s.pendingEvent&&(!events.includes(s.pendingEvent.type)||!number(s.pendingEvent.at)))fail();
 const ids=new Set(),occupied=new Set();
 for(const b of s.buildings){if(!ref(BUILDINGS,b.type)||!Number.isInteger(b.id)||ids.has(b.id)||!Number.isInteger(b.x)||!Number.isInteger(b.z)||b.x<0||b.x>=N||b.z<0||b.z>=N||!number(b.health,0,100)||!number(b.out)||!number(b.progress,0,1.01)||!b.inputs)fail();ids.add(b.id);const k=`${b.x},${b.z}`;if(occupied.has(k))fail();occupied.add(k);for(const[r,n]of Object.entries(b.inputs))if(!ref(RESOURCES,r)||!number(n))fail();}
 // A chosen product must be one of the facility's recipes; the running batch lists real resources.
 for(const b of s.buildings){if(b.recipe!==undefined&&!BUILDINGS[b.type].recipes?.some(r=>r.id===b.recipe))fail();if(b.batch!==undefined)resourceMap(b.batch);}
 for(const b of s.buildings){if(b.level!==undefined&&(!Number.isInteger(b.level)||b.level<1||b.level>3))fail();if(b.race&&!ref(RACES,b.race))fail();numericFields(b,['activeUntil','age','animationTime','cycles','refundUntil','movingUntil','clearing']);numericFields(b,['priority'],0,2);flags(b,['enabled','working','specialized','armorUsed','drain']);if(b.status!==undefined&&!label(b.status,300))fail();
  // What a paid build cleared from its tile, put back if it is cancelled in full (simulation.js build / demolish).
  const c=b.cleared;if(c!==undefined&&(!record(c)||!['tree','rock','sapling'].includes(c.nature)||!number(c.remaining,-100,1e6)||c.growAt!==undefined&&!number(c.growAt)))fail();}
 if(s.storageVersion!==undefined){
  if(s.storageVersion!==1)fail();resourceMap(s.starterInventory);
  const total={...s.starterInventory};
  for(const b of s.buildings){if(b.mode!==undefined&&(b.type!=='depot'||!Object.hasOwn(STORE_MODES,b.mode)))fail();if(b.inventory!==undefined){if(!['warehouse','depot'].includes(b.type))fail();resourceMap(b.inventory);for(const [id,n]of Object.entries(b.inventory))total[id]=(total[id]||0)+n;}}
  for(const id of Object.keys(RESOURCES))if(Math.abs((total[id]||0)-(s.stock[id]||0))>1e-6)fail();
 }
 if(s.nextId!==undefined&&(!Number.isInteger(s.nextId)||[...ids].some(id=>id>=s.nextId)))fail();
 for(const key of ['roads','rails','paved','pipes','conveyors'])if(s[key]&&(!Array.isArray(s[key])||!s[key].every(point)))fail();
 if(s.shipments!==undefined&&(!Array.isArray(s.shipments)||s.shipments.length>MAX_EXPORT_CARTS))fail();for(const sh of s.shipments||[]){if(!sh||!Number.isInteger(sh.id)||!ref(RESOURCES,sh.item)||!Number.isInteger(sh.amount)||!number(sh.amount,1,1e6)||!number(sh.revenue)||!route(sh.route)||!sh.route.length||!number(sh.progress,0,sh.route.length-1)||!['out','back'].includes(sh.phase))fail();flags(sh,['auto','portLoaded','portUnloaded']);if(sh.kind!==undefined&&!['contract','state','import'].includes(sh.kind)||sh.vehicle!==undefined&&!ref(VEHICLES,sh.vehicle)||sh.label!==undefined&&!label(sh.label,2000))fail();numericFields(sh,['cost','duration','remaining','distance','fuel','portIndex']);
 if(![undefined,null,'out','back'].includes(sh.away)||sh.destination!==undefined&&!label(sh.destination,200)||sh.storeId!==undefined&&sh.storeId!==0&&!s.buildings.some(b=>b.id===sh.storeId&&['warehouse','depot'].includes(b.type)))fail();
 if(sh.portIndex!==undefined&&(!Number.isInteger(sh.portIndex)||sh.portIndex>=sh.route.length))fail();
 if(sh.terminalId!==undefined&&(typeof sh.terminalId!=='string'||!/^gate$|^b:\d+$/.test(sh.terminalId))||sh.portBuilding!==undefined&&sh.portBuilding!==null&&!ids.has(sh.portBuilding)||sh.waterVehicle!==undefined&&sh.waterVehicle!==null&&!['steamer','raft'].includes(sh.waterVehicle))fail();
 if(sh.away&&(!(sh.duration>0)||!number(sh.remaining,0,sh.duration)||sh.away==='out'&&sh.phase!=='out'||sh.away==='back'&&sh.phase!=='back'))fail();
 }if(s.nextShipmentId!==undefined&&!Number.isInteger(s.nextShipmentId))fail();
 // A terminal id ('gate' or 'b:<building>') the map no longer has falls back to the best terminal (trade-terminals.js).
 if(s.tradeRoute!==undefined&&s.tradeRoute!==null&&!label(s.tradeRoute,64))fail();
 if(s.workers&&(!Array.isArray(s.workers)||s.workers.length>Math.max(100,s.buildings.reduce((n,b)=>n+homeCapacity(b),0))))fail();if(s.nextWorkerId!==undefined&&!Number.isInteger(s.nextWorkerId))fail();
 const workerIds=new Set();for(const w of s.workers||[]){if(!w||!Number.isInteger(w.id)||workerIds.has(w.id)||!number(w.x,-1,N)||!number(w.z,-1,N)||!route(w.route))fail();workerIds.add(w.id);if(w.task?.sourceId&&!ids.has(w.task.sourceId))fail();if(w.task?.targetId&&!ids.has(w.task.targetId))fail();if(w.race&&!ref(RACES,w.race))fail();if(w.homeId!==undefined&&!ids.has(w.homeId))fail();actor(w);if(w.task!==undefined&&w.task!==null&&(!record(w.task)||!ref(RESOURCES,w.task.item)||!number(w.task.amount)||!['pickup','supply'].includes(w.task.kind)||!ids.has(w.task.building)||(w.task.dest&&!route([w.task.dest]))))fail();if(w.task){flags(w.task,['carried']);for(const k of ['sourceStore','targetStore'])if(w.task[k]!==undefined&&w.task[k]!==0&&!s.buildings.some(b=>b.id===w.task[k]&&['warehouse','depot'].includes(b.type)))fail();}}
 if(s.guards&&(!Array.isArray(s.guards)||s.guards.length>8))fail();for(const g of s.guards||[]){if(!g||!ref(RACES,g.race)||!route(g.route)||!number(g.x,-1,N)||!number(g.z,-1,N)||!number(g.hp,0,75)||!ids.has(g.homeId)||g.task!=null)fail();actor(g);numericFields(g,['maxHp'],1,75);}
 if(s.attackers&&(!Array.isArray(s.attackers)||s.attackers.length>100))fail();for(const w of s.attackers||[]){if(!w||!ref(RACES,w.race)||!number(w.x,-1,N)||!number(w.z,-1,N)||!route(w.route)||!number(w.hp)||!number(w.maxHp,1)||w.hp>w.maxHp||w.task!=null)fail();numericFields(w,['until','delay']);actor(w);}
 if(s.raid){if(!['demon','orc','beast'].includes(s.raid.faction))fail();numericFields(s.raid,['started','ends','strength','damage','defeated','boostUntil','lastHit']);flags(s.raid,['finished','boosted','disrupted']);}
 // Tiles are saved as one packed string (tileState); older saves hold an array of tile objects (tiles).
 const tileList=s.tileState!==undefined?unpackTiles(s.tileState):s.tiles;
 if(tileList&&(!Array.isArray(tileList)||tileList.length!==N*N||tileList.some(t=>!t||![null,'tree','rock','sapling'].includes(t.nature)||!number(t.remaining,-100,1e6)||t.growAt!==undefined&&!number(t.growAt))))fail();
 if(s.tileState!==undefined&&!tileList)fail();
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
 numericFields(data,['nextSite','nextRoute','nextState','deliveries','lastWorldDay','welfareDay']);
 flags(data.treasury,['family','emergencyUsed']);if(data.treasury.haulGear!==undefined&&(!Number.isInteger(data.treasury.haulGear)||data.treasury.haulGear<0||data.treasury.haulGear>2))fail();numericFields(data.treasury,['contracts','contractReadyAt','totalRevenue']);numericFields(data.treasury,['lastRecoveryDay'],-1e12);if(!charter(data.treasury.charter)||!order(data.treasury.contractOrder))fail();
 const stateIds=new Set();for(const state of data.newStates){if(!state||!label(state.id,100)||stateIds.has(state.id)||!label(state.name,2000)||!ref(NATIONS,state.rootNation||state.parent)||!number(state.wealth,-1e12)||!number(state.industry,1,12))fail();stateIds.add(state.id);numericFields(state,['age','day','trades','lastTradeDay']);numericFields(state,['unrest','relation'],0,105);flags(state,['pact','dissolved']);
  if(state.parent!==undefined&&!label(state.parent,100)||state.capitalProvince!==undefined&&!provinceRef(state.capitalProvince)||state.provinceIds!==undefined&&(!Array.isArray(state.provinceIds)||!state.provinceIds.every(provinceRef))||state.point!==undefined&&(!Array.isArray(state.point)||state.point.length!==2||!state.point.every(v=>number(v,-1e6,1e6))))fail();}
 const factionIds=new Set();for(const f of data.factions){if(!f||!ref(NATIONS,f.id)||factionIds.has(f.id)||!number(f.wealth,-1e12)||!number(f.industry,1,12)||!number(f.unrest,-1e12)||!number(f.enterprise)||!number(f.age))fail();factionIds.add(f.id);}
 // A stake is what the share cost (campaign.js investPrice, 2,500G and up); stakes from before that rule have none (G3-01).
 for(const i of data.investments)if(!i||!ref(NATIONS,i.nation)||!number(i.day)||i.stake!==undefined&&!number(i.stake,1,1e7))fail();
 for(const h of data.history)if(!h||!number(h.day)||!label(h.text,4000))fail();
 // The battle log (campaign.js recordBattle keeps the last 20), the run's completion record and the day of the last welfare pact (G3-02, G3-03b).
 if(data.battles!==undefined&&(!Array.isArray(data.battles)||data.battles.length>100))fail();for(const b of data.battles||[])if(!record(b)||!number(b.day)||!label(b.site,100)||!['demon','orc','beast'].includes(b.faction)||!number(b.damage)||!number(b.defeated))fail();
 if(data.completion!==undefined&&data.completion!==null){const done=data.completion;if(!record(done)||!['day','seconds','revenue','produced','sold','contracts','sites'].every(k=>number(done[k])))fail();numericFields(done,['territories','recognition','states','battles']);flags(done,['restored']);}
 if(data.treasury.rescueQuest)rescue(data.treasury.rescueQuest,true);
 if(data.provinces){if(!record(data.provinces))fail();for(const[id,v]of Object.entries(data.provinces))if(!PROVINCE.has(id)||!record(v)||(v.owner!==null||PROVINCE.get(id).nation!==null)&&!ref(NATIONS,v.owner)&&!stateIds.has(v.owner))fail();}
 if(data.recognition.some(id=>!ref(NATIONS,id)&&!stateIds.has(id)))fail();
 if(data.relations)for(const[id,v]of Object.entries(data.relations))if(!ref(NATIONS,id)||!number(v,-100,100))fail();
 const ids=new Set();for(const s of data.sites){if(typeof s.id!=='string'||ids.has(s.id)||!ref(NATIONS,s.nation))fail();ids.add(s.id);validateSimulation(s.simulation);}
 // A site's province is one of its own nation's; two sites on one province (saves from before provinces) are moved apart
 // on load (territory.js claimProvinces), not refused (G3-03).
 for(const site of data.sites){if(!label(site.name)||!number(site.unrest,0,100)||site.nation!==site.simulation.nation||site.provinceId!==undefined&&!plotBelongsTo(site.provinceId,site.nation))fail();flags(site,['territory']);}
 if(!ids.has(data.homeId)||!ids.has(data.activeId)||!Array.isArray(data.routes)||data.routes.length>300)fail();
 for(const r of data.routes)if(!ids.has(r.from)||!ids.has(r.to)||r.from===r.to||!ref(RESOURCES,r.item)||!['truck','rail'].includes(r.mode)||!number(r.amount,1,30)||!number(r.cargo,0,30)||!number(r.remaining,0,10000))fail();
 const routeIds=new Set();for(const r of data.routes){if(!label(r.id,100)||routeIds.has(r.id)||!number(r.duration,r.cargo?1:0,10000)||!number(r.completed)||r.status!==undefined&&!label(r.status,200))fail();routeIds.add(r.id);numericFields(r,['ambush'],-1);flags(r,['enabled','closing']);}
 const active=data.sites.find(s=>s.id===data.activeId).simulation;if(data.lastWorldDay!==undefined&&Math.abs(data.lastWorldDay-(Math.floor(active.time/80)+1))>1)fail();
 return data;
}
function checksum(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
export function encodeSave(data){validateSave(data);const game=JSON.stringify(data);return JSON.stringify({format:'erdynth',version:1,savedAt:new Date().toISOString(),checksum:checksum(game),game:data});}
export function decodeSave(raw){if(typeof raw!=='string'||raw.length>8_000_000)fail();const data=JSON.parse(raw);if(['orvetharn','erdynth'].includes(data?.format)){if(data.version!==1||checksum(JSON.stringify(data.game))!==data.checksum)throw new Error('저장 파일이 손상되었습니다. 백업 파일을 불러오세요.');return validateSave(data.game);}return validateSave(data);}
function validRaw(raw){try{if(raw){decodeSave(raw);return true;}}catch{}return false;}
export function backupSave(storage){const raw=storage.getItem(SAVE_KEY);if(!validRaw(raw))return false;storage.setItem(BACKUP_KEY,raw);if(storage.getItem(BACKUP_KEY)!==raw)throw new Error('이전 진행을 백업하지 못했습니다. 저장 파일을 먼저 내보내세요.');return true;}
export function readRecovery(storage){for(const key of [RECOVERY_KEY,BACKUP_KEY]){const raw=storage.getItem(key);if(validRaw(raw))return raw;}throw new Error('복구 가능한 백업이 없습니다. 저장 파일을 불러오세요.');}
// The save this module last wrote and read back per storage: already validated, so the next autosave need not parse and
// validate it again before keeping it as the recovery copy (audit C4: that was half of every autosave on a large empire).
const written=new WeakMap();
const quotaError=e=>e&&(e.name==='QuotaExceededError'||e.name==='NS_ERROR_DOM_QUOTA_REACHED'||e.code===22||e.code===1014||/quota/i.test(e.message||''));
export function writeSave(storage,data){
 const raw=encodeSave(data),previous=storage.getItem(SAVE_KEY);
 // Keep new-game/import backups separate from rolling recovery. Corrupt data never replaces a healthy backup.
 // When the browser's storage is too full for both copies (audit C5), the rolling recovery copy gives way to the save
 // itself; the new-game backup (BACKUP_KEY) is the player's other game and is never dropped here.
 if(previous!==raw&&(written.get(storage)===previous||validRaw(previous))){
  try{storage.setItem(RECOVERY_KEY,previous);if(storage.getItem(RECOVERY_KEY)!==previous)throw new Error('자동 백업을 확인하지 못했습니다.');}
  catch(e){if(!quotaError(e))throw e;storage.removeItem(RECOVERY_KEY);}
 }
 try{storage.setItem(SAVE_KEY,raw);}
 catch(e){if(!quotaError(e))throw e;storage.removeItem(RECOVERY_KEY);try{storage.setItem(SAVE_KEY,raw);}catch(again){if(!quotaError(again))throw again;throw new Error('브라우저 저장 공간이 부족해 저장하지 못했습니다. 저장 파일을 내보내 보관하세요.');}}
 if(storage.getItem(SAVE_KEY)!==raw)throw new Error('저장을 확인하지 못했습니다.');written.set(storage,raw);return raw;
}
