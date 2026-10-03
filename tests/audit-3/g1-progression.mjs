// G1 audit (2026-10-02): what gates each promotion and how long a player only waits, from the reference bot
// (tests/audit-2/campaign-trace.mjs instruments tests/full-campaign.mjs without copying it), plus the per-rank side
// challenges (progression.js) on real bot saves. Run: node tests/audit-3/g1-progression.mjs   (TRACE=<json> reuses a trace)
import {spawnSync} from 'node:child_process';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {realSeconds} from '../../src/app/game/game-time.js';
import {RANKS} from '../../src/app/game/world.js';
import {nextTrial} from '../../src/app/game/progression.js';
import {load,calm,expectBug,finish} from '../audit-2/_fixture.mjs';
const root=new URL('../../',import.meta.url);
let file=process.env.TRACE;if(!file){file=path.join(os.tmpdir(),'tg-g1-progression-'+process.pid+'.json');const r=spawnSync(process.execPath,['tests/audit-2/campaign-trace.mjs'],{cwd:root,env:{...process.env,NO_SNAP:'1',TRACE_OUT:file},encoding:'utf8',maxBuffer:1e8});if(r.status!==0)throw new Error(r.stderr.slice(0,600));}
const t=JSON.parse(fs.readFileSync(file,'utf8'));if(!process.env.TRACE)fs.rmSync(file,{force:true});

// P1 (A2-P3 follow-up): the last gate of a promotion is the requirement or side challenge met last.
const last=t.ranks.map(r=>({rank:r.rank,name:RANKS[r.rank].name,last:r.last||'(도착 즉시)',took:r.took}));
const production=last.filter(r=>r.last.startsWith('produced:'));
const kinds=Object.entries(last.reduce((m,r)=>{const k=r.last.startsWith('produced:')?'생산':r.last==='trial'?'시험 과제':r.last.split(':')[0];m[k]=(m[k]||0)+1;return m;},{}));
expectBug('G1-P1 most promotions end on "make N of the newest product" (half or more of 32)',production.length/last.length>=.5,{production:production.length,of:last.length,lastGateKinds:Object.fromEntries(kinds),ranks:last.map(r=>r.rank+' '+r.last)});

// P2 per-rank side challenges must not be complete the moment the rank begins (bot saves at the rank they reached).
{const rows=[];for(const rank of [8,22]){const c=load(rank),s=c.home.sim;calm(c);c.tick(.25);/* one tick sets the baselines */const tr=nextTrial(s);rows.push({save:rank,trial:tr&&tr.name,current:tr&&tr.current,target:tr&&tr.target,doneOnArrival:!!tr?.done});}
 expectBug('G1-P2 a side challenge of the next rank is already complete when the rank begins (resident hauls, direct hauls, repelled raids counted over the whole run)',rows.some(r=>r.doneOnArrival),rows);}

// G6 waiting only: after every gate the player can speed up is met, time left on the lord's order timer or the fee, in real s at 1x.
const waits=t.ranks.map(r=>{const done=Object.entries(r.reqDoneAt||{}),other=done.filter(([k])=>k!=='contracts').reduce((n,[,v])=>Math.max(n,v),0),contract=(r.reqDoneAt||{}).contracts;
 return {rank:r.rank,lordOrderOnly:Math.round(realSeconds(contract!==undefined&&contract===Math.max(...done.map(([,v])=>v))?contract-other:0)),feeOnly:Math.round(realSeconds(r.feeWait||0))};});
const worst=[...waits].sort((a,b)=>Math.max(b.lordOrderOnly,b.feeOnly)-Math.max(a.lordOrderOnly,a.feeOnly)).slice(0,5);
const first=t.promotions[0],tenMinutes=t.promotions.filter(p=>realSeconds(p.day*80)<=600).at(-1);
console.log('pace at 1x',JSON.stringify({firstPromotionRealS:Math.round(realSeconds(t.ranks[0].took)),rankAfterAbout10RealMin:tenMinutes?.rank,completionRealMinutes:t.result.completionRealMinutesAt1x,days:t.result.day,segments:t.segments.map(s=>s.endDay),acceptance:Object.fromEntries(Object.entries(t.acceptance).map(([k,v])=>[k,v.pass]))}));
expectBug('G1-G6 a rank keeps the player only waiting (lord order timer or fee) for more than 5 real minutes at 1x',worst.some(w=>Math.max(w.lordOrderOnly,w.feeOnly)>300),{worst});
finish('g1-progression');
