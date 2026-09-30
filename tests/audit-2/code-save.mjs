// Code audit (C): save/load robustness. (1) old-field fallbacks in Simulation.restore, (2) a long real run at 4x with
// every random event on, validating the save each in-game minute the way Game.tsx persist() does (writeSave -> validateSave).
import fs from 'node:fs';
import {load,Campaign,expectBug,finish} from './_fixture.mjs';
import {validateSave,decodeSave,encodeSave} from '../../src/app/game/persistence.js';
const valid=d=>{try{validateSave(structuredClone(d));return true;}catch{return false;}};
// (1a) simulation.js:362 `this.nextWorkerId??=max(ids)+1` never fires: the constructor already set nextWorkerId=0 (simulation.js:79).
{const c=load(13),data=c.save();const site=data.sites[0].simulation;delete site.nextWorkerId;/* injected: a save without the field */
 const accepted=valid(data);const r=new Campaign({saved:data}),s=r.active;const before=s.workers.map(w=>w.id);
 const tile=s.tiles.find(t=>s.canBuild('house',t.x,t.z,true)===null);s.build('house',tile.x,tile.z,true);
 const ids=s.workers.map(w=>w.id),dup=ids.filter((v,i)=>ids.indexOf(v)!==i);const after=valid(r.save());
 expectBug('C-V1 a save without nextWorkerId restarts worker ids at 0: duplicate ids, then every autosave is rejected',accepted&&dup.length>0&&!after,{validatorAcceptsOld:accepted,nextWorkerIdAfterLoad:0,oldMax:Math.max(...before),newIds:ids.slice(-1),duplicates:dup,saveAfterBuildValid:after});}
// (1a') the shipped v5 fixture (tests/fixtures/browser-roundtrip.json) has no nextWorkerId either.
{const raw=fs.readFileSync(new URL('../fixtures/browser-roundtrip.json',import.meta.url),'utf8');const d=decodeSave(raw);const sims=d.sites?d.sites.map(v=>v.simulation):[d];
 console.log(JSON.stringify({fixture:'browser-roundtrip.json',versions:sims.map(v=>v.version),hasNextWorkerId:sims.map(v=>'nextWorkerId' in v)}));
 const r=new Campaign({saved:d});const s=r.active;const tile=s.tiles.find(t=>s.canBuild('house',t.x,t.z,true)===null);s.build('house',tile.x,tile.z,true);const ids=s.workers.map(w=>w.id);console.log(JSON.stringify({v5AfterLoadIds:ids,unique:new Set(ids).size===ids.length,saveValid:valid(r.save())}));}
// (1b) restore() replaces nested objects wholesale (simulation.js:359); defaults from the constructor are lost.
{const c=load(13),data=c.save();const site=data.sites[0].simulation;site.health={infection:3,sanitationUntil:0,nextCare:0};/* injected: health without recoveries */
 const accepted=valid(data);const r=new Campaign({saved:data}),s=r.active;s.nextEvent=1e12;r.active.paused=false;
 for(let i=0;i<4*400&&!(s.health.infection===0);i++)r.tick(.25);for(let i=0;i<8;i++)r.tick(.25);
 expectBug('C-V2 health saved without recoveries: first cure makes recoveries NaN and every later save is rejected',accepted&&Number.isNaN(s.health.recoveries)&&!valid(r.save()),{validatorAcceptsOld:accepted,recoveries:s.health.recoveries});}
{const c=load(13),data=c.save();const site=data.sites[0].simulation;site.logisticsStats={delivered:5};/* injected: stats without direct */
 const accepted=valid(data);const r=new Campaign({saved:data}),s=r.active;s.nextEvent=1e12;
 for(let i=0;i<4*120;i++)r.tick(.25);
 expectBug('C-V2b logisticsStats saved without direct: logistics.js:75 moveWorkers direct+=n gives NaN (network path uses ||0)',accepted&&(Number.isNaN(s.logisticsStats.direct)||!valid(r.save())),{validatorAcceptsOld:accepted,direct:s.logisticsStats.direct,saveValid:valid(r.save())});}
// (2) long run: rank31 fixture, speed 4, all random events on, 6 in-game hours, validate every in-game minute.
{const c=load(31);c.active.paused=false;for(const s of c.sites)s.sim.speed=4;let bad=null,checks=0;
 for(let m=0;m<6*60&&!bad;m++){for(let i=0;i<60*20/4;i++)c.tick(.05);checks++;try{encodeSave(c.save());}catch(e){bad={minute:m,error:e.message};}}
 console.log(JSON.stringify({longRun:{checks,bad,day:c.active.day,money:Math.round(c.active.money)}}));
 expectBug('C-V3 a long 4x run produces a save the validator rejects',!!bad,bad||{checks});}
finish('code-save');
