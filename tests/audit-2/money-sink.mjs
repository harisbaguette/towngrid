// audit-2: late-game money. (1) The full-campaign bot now spends only on what promotions ask (tests/full-campaign.mjs; the old
// "pour every surplus 2,500 G into investment" loop is gone, 2026-09-29 fix of A2-M1), so its A4 cash-hoard limit is judged
// honestly: the trace (campaign-trace.mjs = the same bot) must pass A4 and take no more stakes than a rank asks. (2) The fee
// still holds a promotion back somewhere from rank 15 on (money is a constraint). (3) An investment's payback time vs the
// days left in the campaign once the investment office opens.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {load,calm,expectBug,finish} from './_fixture.mjs';
import {RANKS} from '../../src/app/game/world.js';
const out=path.join(os.tmpdir(),'tg-trace-money.json');const r0=spawnSync(process.execPath,['tests/audit-2/campaign-trace.mjs'],{cwd:new URL('../../',import.meta.url),env:{...process.env,NO_SNAP:'1',TRACE_OUT:out},encoding:'utf8'});if(r0.status!==0)throw new Error(r0.stderr.slice(0,500));
const t=JSON.parse(fs.readFileSync(out,'utf8'));
const asked=Math.max(...RANKS.flatMap(r=>r.requirements.filter(q=>q[0]==='investment').map(q=>q[1])));
expectBug('M1 without a cash sink the bot hoards cash past the A4 limit (or needs stakes nobody asks for)',!t.acceptance.A4.pass||t.investments>asked,{A4:t.acceptance.A4,investments:t.investments,stakesAsked:asked,spent:t.sinks,finalDays:t.days.slice(-6).map(d=>({day:d.day,rank:d.rank,money:d.money,income:d.income}))});
const waits=t.ranks.filter(r=>r.rank>=15).map(r=>r.feeWait||0);
expectBug('M2 from rank 15 on the promotion fee never holds a promotion back more than a minute',Math.max(...waits)<=60,{feeWaitSeconds:t.ranks.filter(r=>r.rank>=15).map(r=>r.rank+':'+r.feeWait),fees:t.ranks.filter(r=>r.rank>=15).map(r=>r.rank+':'+r.fee)});
// Investment payback on a real save.
const c=load(26);calm(c);c.treasury.money=Math.max(c.treasury.money,1e5);const before=c.dividend(),price=c.investPrice();const r=c.council('invest',c.home.nation);const per=c.dividend()-before;
const bankDay=t.ranks.find(x=>x.rank===23).day,endDay=t.ranks.at(-1).day;
expectBug('M3 an industry investment does not pay back before the campaign ends',!r.ok||price/per>endDay-bankDay,{invested:r.ok,error:r.error,price,dividendPerDay:per,paybackDays:+(price/per).toFixed(1),daysFromBankToFinalRank:endDay-bankDay});
finish('money-sink');
