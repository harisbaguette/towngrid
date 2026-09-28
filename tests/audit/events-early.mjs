// Early events: what an early player is told to do versus what is available at that rank.
import {Campaign,run,home,expectBug,finish} from './_harness.mjs';
import {RANKS,unlockRank} from '../../src/app/game/world.js';
import {operationHint} from '../../src/app/game/proximity.js';
const setup=()=>{const c=new Campaign(),s=home(c);s.build('warehouse',11,12);s.build('house',11,14);s.build('well',13,12);s.build('field',13,13);s.build('lumber',9,10);return {c,s};};
// V1: illness at rank 0. The alert says to supply the clinic, which unlocks at 지역 납품업자.
{const {c,s}=setup();s.nextEvent=5;s.eventCount=1;/* forces the event roll; see below */let ev=null;run(c,40,()=>{if(!ev&&s.events.length)ev=s.events[0].type;});
 // roll until an illness happens using real event scheduling
 let tries=0,seenText=null;while(s.health.infection===0&&tries<20){s.nextEvent=s.time;run(c,21);tries++;}
 const text=s.notices.map(n=>n.text).find(t=>/감염 발생|감염 확산/.test(t)),alert=s.stage>=15?'병원에 의약품 공급':'진료소에 약초와 물 공급';
 const traj=[];for(let d=0;d<10;d++){run(c,80);traj.push(Math.round(s.health.infection));}
 expectBug('V1-illness-advice-names-locked-clinic',!!text&&/진료소/.test(text)&&s.rank<unlockRank('clinic'),{rank:s.rank,notice:text,alert,clinicUnlock:RANKS[unlockRank('clinic')].name,infectionPerDayNoAction:traj,note:'nextEvent set directly to roll events sooner'});}
// V2: the storm always wrecks the first-built production building (or the first near water); here the only well.
{const hits=[];for(let seed=0;seed<6;seed++){const c=new Campaign(),s=home(c);s.seed=seed;s.build('warehouse',11,12);s.build('house',11,14);s.build('well',9+seed%3,9);s.build('field',12,9);s.build('lumber',9,12);s.pendingEvent={type:'storm',at:s.time};s.resolveEvent();hits.push(s.buildings.filter(b=>b.health===0).map(b=>b.type).join('+'));}
 expectBug('V2-storm-target-deterministic-first-building',hits.every(h=>h==='well'),{hitsAcrossLayouts:hits,code:'simulation.js:192-194 list.find(nearWater)||list[0]'});}
// V3: advice strings that name a building the player may not have unlocked when the status can first appear.
// The hint is read for a rank-0 settlement, with and without the simulation passed in; a hint that names a locked facility is the defect.
const rank0=setup().s,label={depot:'자재 보관소',logistics:'물류센터'};
const early=[['창고 가득 참','depot',0],['운반 대기','logistics',0]].flatMap(([status,building,rank])=>[operationHint(status),operationHint(status,rank0)].map(hint=>({status,hint,names:building,unlock:RANKS[unlockRank(building)].name,canAppearAtRank:rank}))).filter(v=>unlockRank(v.names)>v.canAppearAtRank&&v.hint.includes(label[v.names]));
expectBug('V3-hints-name-locked-buildings',early.length>0,early);
finish('events-early');
