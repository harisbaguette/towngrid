// Idle or struggling early player: wages include 1% daily debt interest, and every rescue loan adds 130% of the
// grant to the debt. Tracks whether daily costs can outgrow what an early settlement earns.
import {Campaign,run,home,expectBug,finish} from './_harness.mjs';
const c=new Campaign(),s=home(c);s.build('warehouse',11,12);s.build('house',11,14);s.build('well',13,12);s.build('field',13,13);s.nextEvent=1e9;
const rows=[];let loans=0;
for(let d=1;d<=80;d++){run(c,80);if(s.money<=150){const r=s.recover();if(r.ok)loans++;}if(d%10===0)rows.push({day:s.day,money:Math.round(s.money),debt:s.debt,wage:s.wage,loans,unrest:Math.round(c.home.unrest),support:Math.round(c.support)});}
console.log(JSON.stringify(rows));
// Reference: what the same 4 buildings earn per day if every grain is sold at market (no contracts).
const c2=new Campaign(),t=home(c2);t.build('warehouse',11,12);t.build('house',11,14);t.build('well',13,12);t.build('field',13,13);t.nextEvent=1e9;t.autoSell.grain=true;const m0=t.money;run(c2,800);const perDay=Math.round((t.money-m0)/10);
const last=rows.at(-1);
expectBug('B1-debt-spiral-irreversible',last.wage>=perDay,{after80Days:last,referenceIncomePerDayWithGrainAutoSell:perDay,code:'simulation.js:90 wage adds ceil(debt*1%); economy.js:39-40 loan adds 130% to debt'});
finish('debt-spiral');
