import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {advanceGame, BASE_TIME_SCALE, realSeconds, remainingSeconds} from '../src/app/game/game-time.js';
import {Campaign} from '../src/app/game/campaign.js';
import {Simulation, FIRST_EVENT} from '../src/app/game/simulation.js';
import {encodeSave, decodeSave} from '../src/app/game/persistence.js';
import {contractState} from '../src/app/game/ui-rules.js';
import {productionVisualState} from '../src/app/game/production-visuals.js';

const close=(a,b,message)=>assert.ok(Math.abs(a-b)<1e-7,`${message}: ${a} vs ${b}`);
const run=(sim,seconds)=>{for(let i=0;i<Math.round(seconds*20);i++)advanceGame(sim,.05);};
const patch=JSON.parse(readFileSync(new URL('../docs/balance/patch-20260928.json',import.meta.url),'utf8'));
assert.equal(patch.pacing.baseTimeScale,BASE_TIME_SCALE);
assert.equal(patch.pacing.dayRealSecondsAt1x,realSeconds(80));

for(const speed of [1,2,4]){
 const s=new Simulation();s.speed=speed;
 run(s,8);close(s.time,4*speed,'real seconds honor the selected speed');
 assert.equal(remainingSeconds(20*speed,s),40,'event warnings give forty real seconds at every speed');
 s.paused=true;const before=s.save();run(s,5);assert.deepEqual(s.save(),before,'pause freezes the entire world');
 s.paused=false;run(s,2);close(s.time,5*speed,'resume continues without catching up');
}
{
 const s=new Simulation();
 for(const dt of [NaN,Infinity,-1,0])advanceGame(s,dt);
 assert.equal(s.time,0);advanceGame(s,600);close(s.time,.25,'a hidden tab cannot fast-forward the village');
}
{
 const s=new Simulation();run(s,159.9);assert.equal(s.day,1);run(s,.2);assert.equal(s.day,2,'a day takes 160 real seconds');
 const e=new Simulation();run(e,FIRST_EVENT*2-.1);assert.equal(e.pendingEvent,null,'first event is delayed too');
 run(e,.2);assert.ok(e.pendingEvent);assert.equal(remainingSeconds(e.pendingEvent.at-e.time,e),40);
}

// The live clock must match the existing economy after twice the real time:
// production, wages, infection, worker movement, sales and remote freight.
for(const options of [{starter:true},{demo:true}]){
 const paced=new Campaign(options),normal=new Campaign({saved:decodeSave(encodeSave(paced.save()))});
 // Restore both sides identically, including constructor defaults for old saves.
 const live=new Campaign({saved:decodeSave(encodeSave(paced.save()))});
 for(let i=0;i<2400;i++){
  advanceGame(live.active,.05);normal.tick(.025);
  if(i===1200&&live.sites.length>1){live.switchSite(live.sites[1].id);normal.switchSite(normal.sites[1].id);}
 }
 assert.deepEqual(live.save(),normal.save(),'all systems share the same slower clock');
 assert.ok(Object.values(live.treasury.produced).some(n=>n>0),'production continues');
 if(options.demo)assert.ok(live.deliveries>0,'off-screen freight still arrives');
 const snapshot=live.save(),loaded=new Campaign({saved:decodeSave(encodeSave(snapshot))});
 assert.deepEqual(loaded.save(),snapshot,'saving does not rescale existing timestamps');
 const time=loaded.active.time;run(loaded.active,2);close(loaded.active.time-time,1,'loaded saves use the slower pace');
}

// Display values use real seconds without changing simulation-side counters.
{
 const s=new Simulation();s.contractReadyAt=80;
 assert.equal(contractState(s).label,'160초');s.speed=2;assert.equal(contractState(s).label,'80초');
 s.rescueQuest={step:4,remaining:45};assert.equal(s.rescueInfo().label,'45초 뒤 도착');
 s.speed=1;assert.equal(s.rescueInfo().label,'90초 뒤 도착');
 assert.equal(productionVisualState('well',{},s).displayValue,'0');
 const support={type:'generator',health:100,enabled:true,activeUntil:s.time+60};
 assert.equal(productionVisualState('generator',support,s).displayValue,'120초');
 s.rank=11;s.challenge.bestUptime=25;
 const t=s.promotion().trial;assert.equal(t.current,25);assert.equal(t.target,50);
 assert.equal(t.displayCurrent,50);assert.equal(t.displayTarget,100);assert.equal(t.done,false);
 s.challenge.bestUptime=50;assert.equal(s.promotion().trial.done,true);
}
console.log('PASS: half-speed live clock; pause, acceleration, days, events, remote freight, old saves and real-time countdowns');
