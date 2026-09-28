// On-screen advice and building descriptions compared with what the simulation actually does.
import {Campaign,run,home,expectBug,finish} from './_harness.mjs';
import {operationHint,productionDiagnosis} from '../../src/app/game/proximity.js';
import {BUILDINGS,RESOURCES,createShowcase} from '../../src/app/game/simulation.js';
import {RANKS,unlockRank} from '../../src/app/game/world.js';
import {startRaid} from '../../src/app/game/encounters.js';
import {readFileSync} from 'node:fs';
import {itemGate} from '../../src/app/game/ui-rules.js';
const ui=['Game.tsx','Operations.tsx','QualityPanels.tsx'].map(n=>readFileSync(new URL('../../src/app/game/'+n,import.meta.url),'utf8')).join(String.fromCharCode(10));
// H1: with one resident the first hauling jam says "build the automatic logistics centre", which is locked for 13 ranks.
{const c=new Campaign(),s=home(c);s.build('warehouse',11,12);s.build('house',11,14);s.build('well',13,12);s.build('field',13,13);s.build('lumber',9,10);s.nextEvent=1e9;
 let jam=null;run(c,240,()=>{if(!jam){const b=s.buildings.find(b=>b.status==='운반 대기');if(b)jam={t:Math.round(s.time),type:b.type,rank:s.rank}}});
 const hint=operationHint('운반 대기');
 expectBug('H1-hauling-hint-points-to-locked-building',jam&&/물류센터/.test(hint)&&s.rank<unlockRank('logistics'),{jam,hint,logisticsUnlock:RANKS[unlockRank('logistics')].name,workers:s.workerCount,note:'the real early fix is another house or a house upgrade'});}
// H2: a human-faction workshop without a dwarf stalls with "드워프 주민 필요", which has no hint, so the operations card reports "생산망 연결됨".
{const c=new Campaign(),s=home(c);s.rank=12;s.money=5000;s.stock.plank=40;s.stock.stone=40;s.nextEvent=1e9;/* rank/stock set directly to reach the workshop */
 s.build('warehouse',11,12);s.build('house',11,14);s.build('generator',13,12);s.build('workshop',13,10);for(let x=8;x<16;x++)s.build('road',x,11);run(c,30);
 const w=s.buildings.find(b=>b.type==='workshop'),failures=s.buildings.filter(b=>b.enabled!==false&&(b.health<100||operationHint(b.status)));
 expectBug('H2-crew-missing-has-no-hint',w.status.endsWith('주민 필요')&&!failures.includes(w),{status:w.status,hint:operationHint(w.status),operationsCardFailures:failures.map(b=>b.type+':'+b.status)});}
// H3: production upgrades and specialisation ask for planks from rank 0, but planks cannot be made or imported before 지역 공급자.
{const c=new Campaign(),s=home(c);s.build('warehouse',11,12);s.build('well',13,12);const well=s.buildings.find(b=>b.type==='well');
 const up=s.upgrade(well.id),imp=s.buy('plank',3),spec=s.specialize(well.id,'human');
 const gate=itemGate(s,'plank',3);
 expectBug('H3-plank-gated-actions-offered-early',!up.ok&&!imp.ok&&!spec.ok&&!gate,{uiGate:gate,upgrade:up.error,importPlank:imp.error,specialize:spec.error,plankUnlock:RANKS[unlockRank('sawmill')].name+' (rank index '+unlockRank('sawmill')+')'});}
// H4: stone cannot be imported until 등록 사업주 while wells (4) and houses (1) consume it; demolition refunds no materials.
// Second pass: imports arrive on an export vehicle, so the warehouse that receives them comes first.
{const c=new Campaign(),s=home(c);s.build('warehouse',11,12);const imp=s.buy('stone',5);const stone0=s.stock.stone;s.build('well',13,12);s.demolish(13,12);
 expectBug('H4-stone-unimportable-and-not-refunded',!imp.ok&&s.stock.stone===stone0-4,{importStone:imp.error,stoneBefore:stone0,stoneAfterBuildAndDemolish:s.stock.stone,quarryUnlock:RANKS[unlockRank('quarry')].name});}
// H5: 마탑 says facilities inside its ward take no raid damage and demon power disruption is blocked while the ward holds.
// Damage to facilities outside the ward radius is expected; only damage inside it or a disruption counts as the defect.
{const s=createShowcase();s.nextEvent=1e9;for(let i=0;i<200;i++)s.tick(.25);const tower=s.buildings.find(b=>b.type==='magetower');const towerActiveAtRaid=tower.activeUntil>s.time;
 s.raidCount=0;startRaid(s);/* demon raid first in sequence */const money0=s.money;let hits=0;const hp0=Object.fromEntries(s.buildings.map(b=>[b.id,b.health]));
 for(let i=0;i<280&&s.raid&&!s.raid.finished;i++)s.tick(.25);
 const radius=BUILDINGS.magetower.wardRadius,inside=b=>Math.hypot(b.x-tower.x,b.z-tower.z)<radius,damaged=s.buildings.filter(b=>b.health<hp0[b.id]).map(b=>b.type),damagedInside=s.buildings.filter(b=>b.health<hp0[b.id]&&inside(b)).map(b=>b.type);
 expectBug('H5-magetower-ward-not-protective',towerActiveAtRaid&&(damagedInside.length>0||s.raid.disrupted),{towerActiveAtRaid,faction:s.raid.faction,damage:Math.round(s.raid.damage),damagedInside,damagedOutside:damaged.filter(t=>!damagedInside.includes(t)),powerDisrupted:s.raid.disrupted,description:BUILDINGS.magetower.description});}
// H6: help text says "종족에 따른 산업 제한은 없습니다" but dwarf/spirit-only workshops and hauler bans exist.
{const c=new Campaign(),s=home(c);const {crewFor}=await import('../../src/app/game/logistics.js');const locked=Object.keys(BUILDINGS).filter(t=>crewFor(s,t));const skilled=Object.keys(BUILDINGS).filter(t=>BUILDINGS[t].skilled);
 expectBug('H6-help-says-no-race-limits',locked.length>0&&ui.includes('종족에 따른 산업 제한은 없습니다'),{humanFactionCrewLocked:locked,skilledNoHaulers:skilled,help:'Game.tsx help 04: 종족에 따른 산업 제한은 없습니다'});}
// H7: the rank gauge on the HUD ignores the trial and the fee, so it can read 100% while promotion is impossible.
{const c=new Campaign(),s=home(c);s.build('warehouse',11,12);s.rank=1;s.produced.wood=24;s.contracts=2;/* state set directly: rank-1 player with both listed requirements met but the trial (18 hauled) not yet */
 const p=s.promotion(),gauge=Math.round(p.requirements.reduce((n,r)=>n+Math.min(1,r.current/Math.max(1,r.target)),0)/p.requirements.length*100);
 expectBug('H7-rank-gauge-full-but-blocked',gauge===100&&!p.ready,{gauge,ready:p.ready,trial:{name:p.trial.name,current:p.trial.current,target:p.trial.target},code:'Game.tsx rankProgress (line 135 staged) uses requirements only; trial/fee ignored'});}
// H8: goals dialog enables the contract button from raw stock; fulfil() checks stock minus worker reservations.
{const c=new Campaign(),t=home(c);t.rank=7;t.money=4000;t.nextEvent=1e9;t.build('warehouse',11,12);t.build('house',11,14);t.build('sawmill',13,12);/* rank set directly: sawmill pulls wood from the warehouse */
 const need={item:'wood',amount:12,reward:146};t.contract=()=>need;t.stock.wood=need.amount;let snap=null;
 for(let i=0;i<200&&!snap;i++){c.tick(.05);const reserved=t.stock.wood-t.availableStock('wood');if(reserved>0)snap={stock:t.stock.wood,available:t.availableStock('wood'),reserved};}
 const rawGate=/disabled={[^}]*s.stock[[^}]*}[^>]*onClick={()=>[^}]*fulfill()/.test(ui),buttonEnabled=snap&&(rawGate?!(snap.stock<need.amount):!(snap.available<need.amount)),result=t.fulfill();
 expectBug('H8-contract-button-uses-raw-stock',!!snap&&buttonEnabled&&!result.ok,{contract:need,snap,goalsDialogEnabled:buttonEnabled,fulfil:result,note:'contract overridden to wood to create a reservation; Game.tsx goals dialog uses s.stock, simulation.js:248 uses availableStock'});}
finish('hints-vs-rules');
