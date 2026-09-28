// Shared helpers for the 2026-09-28 audit probes. Probes only use public game APIs
// and real elapsed ticks; where a probe sets state directly it says so in its output.
import {Campaign} from '../../src/app/game/campaign.js';
export {Campaign};
export const run=(c,seconds,each)=>{for(let i=0;i<seconds*4;i++){c.tick(.25);if(each)each(c);}};
export const home=c=>c.home.sim;
export const snapshot=s=>({t:Math.round(s.time),day:s.day,rank:s.rank,money:Math.round(s.money),debt:s.debt,contracts:s.contracts,stock:Object.fromEntries(Object.entries(s.stock).filter(([,v])=>v>0).map(([k,v])=>[k,Math.floor(v)])),produced:{...s.produced},sold:{...s.sold}});
export const status=s=>s.buildings.map(b=>`${b.type}@${b.x},${b.z}:${b.status}${b.health<100?'(hp'+Math.round(b.health)+')':''}`);
// Results table: every probe ends with PASS/FAIL lines so the fix owner can reuse them as regressions.
const results=[];
export function expectBug(id,cond,detail){results.push({id,reproduced:!!cond,detail});console.log((cond?'REPRODUCED ':'NOT-REPRODUCED ')+id+' :: '+JSON.stringify(detail));}
export function finish(name){const n=results.length,m=results.filter(r=>r.reproduced).length;console.log(`\n[${name}] ${m} of ${n} audit findings reproduced`);
 // Exit code 1 while the defects still reproduce, so a fixed build turns the probe green.
 if(process.argv.includes('--regression'))process.exit(m?1:0);}
