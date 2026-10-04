import assert from 'node:assert/strict';
import {Campaign} from '../src/app/game/campaign.js';
import {Simulation,BUILDINGS,RESOURCES} from '../src/app/game/simulation.js';
import {advanceGame} from '../src/app/game/game-time.js';
import {checkpointOffline,catchUpOffline,cancelOffline,isOfflineProcessing} from '../src/app/game/offline-progress.js';
import {readTrialRecords,recordIndustryTrial,TRIAL_RECORDS_KEY,createIndustryTrial} from '../src/app/game/industry-trials.js';
import {productionDiagnosis} from '../src/app/game/proximity.js';
import {encodeSave,decodeSave} from '../src/app/game/persistence.js';
const town=()=>{const c=new Campaign();c.active.money=100000;c.active.nextEvent=1e12;c.offline={enabled:true,running:true,at:100000};return c;};

// Re-entry joins the same work; autosave and live frames cannot advance or re-arm it.
{const c=town();let duplicate,checks=0;const work=catchUpOffline(c,160000,async()=>{
 const time=c.active.time;advanceGame(c.active,.5);assert.equal(c.active.time,time);
 checkpointOffline(c,170000);assert.equal(c.offline.running,false);assert.equal(c.offline.at,160000);
 duplicate=catchUpOffline(c,180000);checks++;
});assert.equal(catchUpOffline(c,190000),work);const result=await work;
 assert.ok(checks>0);assert.equal(duplicate,work);assert.deepEqual(await duplicate,result);assert.equal(c.active.time,30);assert.equal(result.seconds,60);assert.equal(c.active.paused,true);assert.equal(isOfflineProcessing(c),false);
 c.active.paused=false;advanceGame(c.active,.5);assert.ok(c.active.time>30,'live clock resumes');}

// A real visibility pause and an explicit cancellation both terminate at the next chunk.
for(const mode of ['pause','cancel','hidden']){const c=town();let hidden=false;
 const r=await catchUpOffline(c,700000,async()=>{if(mode==='pause')c.active.paused=true;else if(mode==='cancel')cancelOffline(c);else hidden=true;},()=>hidden);
 assert.ok(r.seconds>0&&r.seconds<600);assert.match(r.stop,/중단/);assert.equal(c.active.paused,true);assert.equal(isOfflineProcessing(c),false);
 assert.equal((await catchUpOffline(c,800000)).seconds,0,'cancelled time is not awarded twice');}

// A blocked or failing clock must never hang, leak its lock, or leave the town running.
{const c=town();c.tick=()=>{};const r=await catchUpOffline(c,160000);assert.equal(r.seconds,0);assert.match(r.stop,/중단/);assert.equal(isOfflineProcessing(c),false);}
{const c=town();c.active.speed=4;await assert.rejects(catchUpOffline(c,160000,async()=>{throw new Error('yield failed');}),/yield failed/);assert.equal(c.active.paused,true);assert.equal(c.active.speed,4);assert.equal(isOfflineProcessing(c),false);c.active.paused=false;advanceGame(c.active,.1);assert.ok(c.active.time>0);}

// A save taken during a yield contains committed progress but cannot replay the elapsed absence.
{const c=town();let saved;await catchUpOffline(c,160000,async()=>{saved=decodeSave(encodeSave(c.save()));});const restored=new Campaign({saved});const t=restored.active.time;assert.equal((await catchUpOffline(restored,220000)).seconds,0);assert.equal(restored.active.time,t);}

// Corrupt local record fields never reach JSX; valid records survive and quota errors stay local.
{const good={score:12000,elapsed:600,delivered:100,status:'won'},data={bread:good,cloth:{...good,score:{bad:true}},steel:{...good,delivered:['bad']},'weekly-38':{...good,elapsed:Infinity},unknown:good};
 const storage={getItem:()=>JSON.stringify(data),setItem(){throw new Error('quota');}};
 assert.deepEqual(readTrialRecords(storage),{bread:good});assert.deepEqual(readTrialRecords({getItem(){throw new Error('denied');}}),{});
 assert.deepEqual(readTrialRecords({getItem:()=>'{broken'}),{});
 const c=createIndustryTrial('bread');Object.assign(c.trial,{status:'won',score:13000,elapsed:500,delivered:100});assert.equal(recordIndustryTrial(storage,c),false);
 assert.equal(readTrialRecords({getItem:()=>JSON.stringify({bread:{...good,score:-1}})}).bread,undefined);assert.ok(TRIAL_RECORDS_KEY);}

// A refinery's returned petroleum, not its newly selected fuel, can be the blocked item.
{const s=new Simulation('river');s.money=1e6;s.rank=8;const r=s.build('refinery',12,12,true);assert.ok(r.ok);const b=s.at(12,12);
 b.returnStock={petroleum:3};assert.ok(s.setStorageRule(0,'petroleum',0).ok);b.status='보관 제한 · '+RESOURCES.petroleum.name;
 const d=productionDiagnosis(s,b,BUILDINGS,RESOURCES);assert.match(d.text,new RegExp(RESOURCES.petroleum.name));assert.match(d.text,/입고 거부/);assert.equal(d.storeId,0);}
console.log('PASS final integrity: offline concurrency, cancellation, save during catch-up, record corruption and returned-goods diagnosis');
