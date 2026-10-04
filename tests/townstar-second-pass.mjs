import assert from 'node:assert/strict';
import {Simulation,BUILDINGS,RESOURCES} from '../src/app/game/simulation.js';
import {Campaign} from '../src/app/game/campaign.js';
import {gridAllocation,powerPreview} from '../src/app/game/power-grid.js';
import {encodeSave,decodeSave} from '../src/app/game/persistence.js';
import {weeklyTrial,trialRule,createIndustryTrial,trialState,recordIndustryTrial,TRIAL_RECORDS_KEY} from '../src/app/game/industry-trials.js';
import {checkpointOffline,catchUpOffline} from '../src/app/game/offline-progress.js';
const fresh=()=>{const s=new Simulation('river');s.money=1e6;s.autoSell={};s.nextEvent=1e12;for(const k of Object.keys(RESOURCES))s.stock[k]=0;return s;};
const put=(s,type,x,z)=>{const r=s.build(type,x,z,true);assert.ok(r.ok,r.error);return s.at(x,z);};
const run=(s,n)=>{for(let i=0;i<n*4;i++)s.tick(.25);};
// Earlier flexible loads must move to another grid to make room for a later, less flexible load.
{const s=fresh(),make=(id,type,x,z)=>({id,type,x,z,health:100,enabled:true,level:1});const a=make(1,'windturbine',4,10),b=make(2,'windturbine',14,10),flex=make(3,'refinery',9,10),onlyA=make(4,'refinery',3,10),onlyA2=make(5,'refinery',4,9);
 s.buildings=[a,b,flex,onlyA,onlyA2];let g=gridAllocation(s,[a,b]);assert.equal(g.powered.size,3);assert.equal(g.groups[0].used,6);assert.equal(g.groups[1].used,3);
 s.revision++;s.buildings.reverse();g=gridAllocation(s,[b,a]);assert.equal(g.powered.size,3);assert.equal(g.groups[0].used,6);
 const tooLarge=make(6,'shipyard',3,9);s.buildings.push(tooLarge);s.revision++;g=gridAllocation(s,[a,b]);assert.ok(!g.powered.has(6));assert.equal(g.powered.size,3);assert.equal(g.groups.reduce((n,g)=>n+g.used,0),9);
}
// Charge and migration are local to the battery's actual connected grid.
for(const x of [6,19]){const s=fresh();s.owned=new Set(s.tiles.map(t=>t.x+','+t.z));const wind=put(s,'windturbine',4,12),battery=put(s,'battery',x,12);wind.activeUntil=1000;s.revision++;run(s,5);assert.equal(battery.charge,x===6?10:0);
 s.outageUntil=100;s.revision++;assert.equal(s.poweredAt(battery),x===6);const copy=new Simulation('river',decodeSave(encodeSave(s.save())));assert.equal(copy.buildings.find(b=>b.id===battery.id).charge,battery.charge);
 const legacy=s.save();for(const b of legacy.buildings)delete b.charge;const migrated=new Simulation('river',decodeSave(encodeSave(legacy)));assert.equal(migrated.buildings.find(b=>b.id===battery.id).charge,battery.charge);
}
// The separated refinery chain uses real output inventories; a mid-cycle save never creates raw inputs twice.
{let s=fresh();s.rank=8;const w=put(s,'windturbine',10,12),r=put(s,'refinery',12,12);put(s,'dwarfhouse',10,14);for(let x=8;x<=12;x++)s.build('road',x,11,true);w.activeUntil=1e6;s.revision++;
 assert.ok(s.setRecipe(r.id,'petroleum').ok);r.inputs={oil:3};run(s,3);s=new Simulation('river',decodeSave(encodeSave(s.save())));let ref=s.at(12,12);run(s,20);assert.equal(s.produced.petroleum,3);
 assert.ok(s.setRecipe(ref.id,'blendedfuel').ok);s.stock.processwater=1;run(s,100);assert.equal(s.produced.fuel,3);assert.equal(ref.inputs.petroleum,0);assert.equal(ref.inputs.processwater,0);
 assert.ok(BUILDINGS.well.recipes.some(r=>r.output==='processwater'));assert.ok(powerPreview(s,'refinery',13,12).connected);
}
// A weekly round has a stable location/rules across calendar changes, including save and retry.
{for(const n of [0,1,2,38,39]){const rule=weeklyTrial(n),c=createIndustryTrial(rule.id),same=createIndustryTrial(rule.id);assert.deepEqual(c.active.layout,same.active.layout);assert.deepEqual({...c.active.stock},{...same.active.stock});assert.equal(trialState(new Campaign({saved:decodeSave(encodeSave(c.save()))})).id,rule.id);assert.equal(trialRule(rule.id).target,rule.target);}
 assert.notEqual(weeklyTrial(38).provinceId,weeklyTrial(41).provinceId);assert.equal(trialRule('weekly-99999'),null);
 const data=new Map([[TRIAL_RECORDS_KEY,JSON.stringify({bread:{score:'broken'}})]]),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},c=createIndustryTrial('bread');c.trial.status='won';c.trial.score=12000;recordIndustryTrial(storage,c);assert.equal(JSON.parse(data.get(TRIAL_RECORDS_KEY)).bread.score,12000);
}
// Offline processing is opt-in, bounded, one-shot, and respects manual pause and risk stops.
{const c=new Campaign(),s=c.active;s.money=100000;s.nextEvent=1e12;s.speed=4;c.offline.enabled=true;s.paused=false;checkpointOffline(c,100000);let result=await catchUpOffline(c,160000,async()=>{});assert.equal(result.seconds,60);assert.equal(s.time,30);assert.equal(s.speed,4);assert.equal(s.paused,true);
 result=await catchUpOffline(c,160000,async()=>{});assert.equal(result.seconds,0);checkpointOffline(c,160000);assert.equal(c.offline.running,false);assert.equal((await catchUpOffline(c,220000,async()=>{})).seconds,0);
 s.paused=false;s.stock.fuel=0;checkpointOffline(c,200000);result=await catchUpOffline(c,300000,async()=>{});assert.equal(result.seconds,0);assert.match(result.stop,/연료/);
 s.stock.fuel=40;s.pendingEvent={type:'storm',at:s.time+20};s.paused=false;checkpointOffline(c,300000);result=await catchUpOffline(c,400000,async()=>{});assert.equal(result.seconds,0);assert.match(result.stop,/사건/);
 const copy=new Campaign({saved:decodeSave(encodeSave(c.save()))});assert.equal(copy.offline.enabled,true);
}


{const c=new Campaign();c.offline={enabled:true,running:true,at:Date.now()};assert.equal(decodeSave(encodeSave(c.save())).offline.at,c.offline.at);}

{const c=new Campaign();c.offline.enabled=true;c.active.paused=false;c.active.books.last={net:-20};checkpointOffline(c,Date.now()-60000);const copy=new Campaign({saved:decodeSave(encodeSave(c.save()))});const r=await catchUpOffline(copy);assert.equal(r.seconds,0);assert.match(r.stop,/적자/);}
console.log('PASS second pass: grid reassignment, individual batteries, refinery inventory, weekly rounds and safe offline progress');
