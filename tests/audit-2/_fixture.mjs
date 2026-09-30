// audit-2 helpers. Fixtures are real campaign saves written by campaign-trace.mjs (bot plays with paid actions only)
// at the moment it reached each rank. Loading one gives a mid/late game without injecting anything.
import fs from 'node:fs';
import {Campaign} from '../../src/app/game/campaign.js';
import {decodeSave} from '../../src/app/game/persistence.js';
export {Campaign};
export const load=rank=>new Campaign({saved:decodeSave(fs.readFileSync(new URL('./fixtures/rank'+rank+'.json',import.meta.url),'utf8'))});
export const run=(c,seconds,each)=>{for(let i=0;i<seconds*4;i++){c.tick(.25);if(each)each(c,i);}};
// Silence random events on every site so an experiment measures only what it triggers.
export const calm=c=>{for(const s of c.sites){s.sim.nextEvent=1e12;s.sim.pendingEvent=null;}};
const results=[];
export function expectBug(id,cond,detail){results.push({id,reproduced:!!cond});console.log((cond?'REPRODUCED ':'NOT-REPRODUCED ')+id+' :: '+JSON.stringify(detail));}
export function finish(name){const m=results.filter(r=>r.reproduced).length;console.log(`\n[${name}] ${m} of ${results.length} audit findings reproduced`);if(process.argv.includes('--regression'))process.exit(m?1:0);}
