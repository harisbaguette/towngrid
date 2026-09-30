// audit-2: how much each crisis costs a mid/late town, with and without the player's counter-measure.
// Method: load a real bot save (rank 22 / 29), silence random events, then trigger one event at the home site by
// setting pendingEvent (STATE INJECTION: only the event type and time are set; everything else is the save as played).
// Compare treasury cash and home production over 320 s (4 days) against the same save with no event.
import {load,run,calm,expectBug,finish} from './_fixture.mjs';
import {BUILDINGS,RESOURCES} from '../../src/app/game/simulation.js';
const value=s=>Object.entries(s.produced).reduce((n,[k,v])=>n+(RESOURCES[k]?.price||0)*v,0);
function trial(rank,type,respond){const c=load(rank);calm(c);const s=c.home.sim;const m0=c.treasury.money,v0=value(s);
 if(type)s.pendingEvent={type,at:s.time+1};
 run(c,320,()=>{for(const v of c.sites)if(!v.sim.pendingEvent)v.sim.nextEvent=1e12;if(!respond)return;if(s.pendingEvent?.type==='storm')s.reinforce();if(s.raid&&!s.raid.finished)s.mobilize();if(s.health.infection>15&&s.health.sanitationUntil<s.time)s.sanitize();if(s.strikeUntil>s.time)c.council('welfare');/* the sanction's counter since the F1 fix (2026-09-29): a trade negotiation named in its notice */if(s.sanctionUntil>s.time)s.negotiateSanction();
  for(const b of s.buildings)if(b.health<100)s.repair(b.id);});
 const hurt=s.buildings.filter(b=>b.health<100).length;return {cash:Math.round(c.treasury.money-m0),made:Math.round(value(s)-v0),hurt,infection:Math.round(s.health.infection),raid:s.raid?{damage:Math.round(s.raid.damage),defeated:s.raid.defeated}:null};}
const out={};
for(const rank of [22,29]){const c=load(rank);const income=c.home.sim.budget.lastIncome;const base=trial(rank,null,false);out[rank]={income,base};
 for(const type of ['storm','illness','strike','raid','manaStorm','sanction']){const a=trial(rank,type,false),b=trial(rank,type,true);
  out[rank][type]={passive:{loss:base.cash-a.cash,prodLoss:base.made-a.made,hurt:a.hurt,infection:a.infection,raid:a.raid},countered:{loss:base.cash-b.cash,prodLoss:base.made-b.made,raid:b.raid}};}}
console.log(JSON.stringify(out,null,1));
// Home daily income from the save's own budget line vs the worst passive loss.
for(const rank of [22,29]){const o=out[rank],worst=Math.max(...['storm','illness','strike','raid','manaStorm','sanction'].map(t=>o[t].passive.loss));
 const dayValue=o.base.made/4; // 320 s = 4 days of home production at list price
 const light=['storm','strike'].map(t=>({t,share:+(Math.max(o[t].passive.prodLoss,o[t].passive.loss)/dayValue).toFixed(3)}));
 expectBug('C1-r'+rank+' storm and strike each cost under 5% of one day of home production when ignored',light.every(v=>v.share<.05),{rank,homeProductionValuePerDay:Math.round(dayValue),light});
 expectBug('C2-r'+rank+' trade sanction has no counter: countered loss equals passive loss',o.sanction.countered.loss===o.sanction.passive.loss&&o.sanction.passive.loss>0,{rank,passive:o.sanction.passive.loss,countered:o.sanction.countered.loss,shareOfDay:+(o.sanction.passive.loss/dayValue).toFixed(3)});}
// C3 storms ignored for good: ten late storms 100 s apart, never reinforced or repaired. A damaged facility works at full
// speed until its health reaches 0 (simulation.js tick: only health<=0 stops), so the doc's "reinforcing pays after day 12"
// (docs/BALANCE_PATCH_20260928.md 12-5) never becomes true in play.
{const run10=storms=>{const c=load(26);calm(c);const s=c.home.sim;const v0=value(s);let n=0;run(c,1000,(cc,i)=>{for(const v of c.sites)if(!v.sim.pendingEvent)v.sim.nextEvent=1e12;if(storms&&i%400===0&&n<10){s.pendingEvent={type:'storm',at:s.time+.1};n++;}});return {made:value(s)-v0,stopped:s.buildings.filter(b=>b.health<=0).length,damaged:s.buildings.filter(b=>b.health>0&&b.health<100).length,day:s.day,facilities:s.buildings.length};};
 const base=run10(false),hit=run10(true);const dayValue=base.made/12.5;
 expectBug('C3 ten ignored late storms (never repaired) cost under 10% of one day of production',(base.made-hit.made)<dayValue*.1,{facilities:hit.facilities,stormsIgnored:10,stopped:hit.stopped,damagedButRunning:hit.damaged,productionLoss:Math.round(base.made-hit.made),homeProductionPerDay:Math.round(dayValue),reinforceCost:'70G + wood 4 each'});}
finish('crisis-impact');
