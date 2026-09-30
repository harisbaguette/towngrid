// audit-2: promotion pacing from the reference bot run (campaign-trace.mjs = tests/full-campaign.mjs player plus a
// per-rank ledger: when each requirement of the next rank was met, measured from the previous promotion).
// TRACE=<json> reuses an existing trace; otherwise the bot is run (about 30 s).
import {spawnSync} from 'node:child_process';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {RANKS} from '../../src/app/game/world.js';
import {expectBug,finish} from './_fixture.mjs';
let file=process.env.TRACE;if(!file){file=path.join(os.tmpdir(),'tg-trace-pacing.json');const r=spawnSync(process.execPath,['tests/audit-2/campaign-trace.mjs'],{cwd:new URL('../../',import.meta.url),env:{...process.env,NO_SNAP:'1',TRACE_OUT:file},encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr.slice(0,400));}
const t=JSON.parse(fs.readFileSync(file,'utf8'));
// Requirements already satisfied the moment the previous promotion happened (<= 1 s).
// Exact state at the promotion instant: the bot records each next rank's requirements the moment it lands (promotions[].nextOnArrival).
// The earlier '<= 1 s after arrival' window also counted acts the player took in that first second (hiring a guard, founding a site).
const arrival=Object.fromEntries((t.promotions||[]).map(m=>[m.rank,m.nextOnArrival||[]]));
const onArrival=t.ranks.map(r=>({rank:r.rank,name:RANKS[r.rank].name,took:r.took,metOnArrival:(arrival[r.rank]||[]).filter(([k,c,n])=>c>=n).map(([k])=>k),asked:RANKS[r.rank].requirements.map(q=>q[0]+' '+q[1])}));
const free=onArrival.filter(r=>r.metOnArrival.length===RANKS[r.rank].requirements.length);
const partly=onArrival.filter(r=>r.metOnArrival.length);
for(const r of partly)console.log(JSON.stringify(r));
expectBug('P1b ranks whose every requirement is already met when the previous promotion lands (only the fee is left)',free.length>0,{free:free.map(r=>r.rank+' '+r.name+' ('+r.asked.join(', ')+')')});
const lifetime=partly.flatMap(r=>r.metOnArrival.filter(k=>/^(produced|contracts|expansions|revenue|deliveries|recognition|investment|defense|support|sites|territories|railRoutes)/.test(k)).map(k=>r.rank+':'+k));
expectBug('P2 requirements met on arrival (lifetime or already-bought counters)',lifetime.length>=10,{count:lifetime.length,of:t.ranks.reduce((n,r)=>n+RANKS[r.rank].requirements.length,0),list:lifetime});
const last=t.ranks.map(r=>r.last),prod=last.filter(k=>k&&k.startsWith('produced')).length;
expectBug('P3 the last gate of most ranks is the same act: make N of what the previous rank unlocked',prod/last.length>=.6,{lastGateIsProduction:prod,ranks:last.length,durationsSeconds:t.ranks.map(r=>r.rank+':'+r.took)});
const minutes=+(t.days.length*80/60).toFixed(0);
console.log('bot total play time at 1x:',minutes,'min over',t.days.length,'days');
finish('pacing');
