// The 치안권 보유자 trial needs "현장에서 습격 한 번 격퇴" (a raid with 3 defeated). Players cannot start a raid;
// it comes only from the random event roll. Measures how long a rank-22 settlement waits for its first raid.
import {Simulation} from '../../src/app/game/simulation.js';
import {expectBug,finish} from './_harness.mjs';
const waits=[];
for(let seed=1;seed<=30;seed++){const s=new Simulation('river',null,{seed});s.rank=22;/* rank set directly */s.build('warehouse',11,12,true);for(const [t,x,z] of [['house',11,14],['well',13,12],['field',13,13],['lumber',9,10]])s.build(t,x,z,true);
 let first=null;for(let i=0;i<4*80*40&&first===null;i++){s.tick(.25);if(s.raidCount>0)first=s.time;}waits.push(first===null?'>40일':Math.round(first/80*10)/10+'일');}
const days=waits.filter(w=>typeof w==='string'&&!w.startsWith('>')).map(w=>parseFloat(w)).sort((a,b)=>a-b);
console.log('first raid (game days) per seed',JSON.stringify(waits));
expectBug('T1-trial-waits-on-random-raid',days.length&&days[Math.floor(days.length/2)]>3,{medianDays:days[Math.floor(days.length/2)],max:days.at(-1),neverWithin40Days:waits.filter(w=>String(w).startsWith('>')).length,code:'progression.js:9 defended; simulation.js:183 raid only via chooseEvent'});
finish('raid-gated-trial');
