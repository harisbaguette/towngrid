// audit-2: is each alternative product ever the better choice? A recipe is a trap when another recipe of the same
// product, open no later, uses no input the alternative does not use, needs no more of each input per unit made,
// and makes at least as many per second. scripts/balance-report.mjs C9 only checks that an alternative is "different".
import {BUILDINGS,RESOURCES} from '../../src/app/game/simulation.js';
import {unlockRank,RANKS} from '../../src/app/game/world.js';
import {expectBug,finish} from './_fixture.mjs';
const all=[];for(const [type,d] of Object.entries(BUILDINGS))for(const r of d.recipes||[])if(RESOURCES[r.output])all.push({type,...r,alt:r!==d.recipes[0],open:Math.max(unlockRank(type),r.unlock||0)});
const per=(r,k)=>(r.inputs[k]||0)/r.amount,rate=r=>r.amount/r.period;
const traps=[];
for(const a of all.filter(r=>r.alt)){const better=all.filter(c=>c!==a&&c.output===a.output&&c.open<=a.open&&Object.keys(c.inputs).every(k=>k in a.inputs&&per(c,k)<=per(a,k))&&rate(c)>=rate(a));
 if(better.length)traps.push({alternative:a.type+'/'+a.id,opens:RANKS[a.open].name,inputs:a.inputs,amount:a.amount,period:a.period,beatenBy:better.map(c=>c.type+'/'+c.id+' (opens '+RANKS[c.open].name+', '+JSON.stringify(c.inputs)+' -> '+c.amount+' in '+c.period+'s)')});}
for(const t of traps)console.log(JSON.stringify(t));
expectBug('R1 alternative products that are never the better choice',traps.length>0,{count:traps.length,of:all.filter(r=>r.alt).length,traps:traps.map(t=>t.alternative)});
finish('recipe-choice');
