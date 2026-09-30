// Code audit (C): demolishing a facility mid-cycle. simulation.js:279 demolish returns loaded inputs and the finished pad to the
// warehouse, but not the batch the running cycle already consumed (simulation.js:198 tick). setRecipe (simulation.js:298) does.
import {load,calm,expectBug,finish} from './_fixture.mjs';
import {RESOURCES} from '../../src/app/game/simulation.js';
const c=load(31);calm(c);c.active.paused=false;const s=c.active;
for(let i=0;i<400;i++)c.tick(.05);
const b=s.buildings.filter(v=>v.progress>0&&v.batch&&Object.keys(v.batch).length).sort((a,z)=>Object.entries(z.batch).reduce((n,[r,k])=>n+RESOURCES[r].price*k,0)-Object.entries(a.batch).reduce((n,[r,k])=>n+RESOURCES[r].price*k,0))[0];
const batch={...b.batch},value=Object.entries(batch).reduce((n,[r,k])=>n+RESOURCES[r].price*k,0),before=Object.fromEntries(Object.keys(batch).map(r=>[r,s.stock[r]])),inputs={...b.inputs},out=b.out,carried={};for(const w of s.workers){const t=w.task;if(t?.carried&&(t.targetId===b.id||t.sourceId===b.id))carried[t.item]=(carried[t.item]||0)+t.amount;}
s.demolish(b.x,b.z);
const back=Object.fromEntries(Object.keys(batch).map(r=>[r,s.stock[r]-before[r]-(inputs[r]||0)-(carried[r]||0)]));
expectBug('C-D1 demolishing mid-cycle destroys the consumed batch (setRecipe returns it, demolish does not)',Object.entries(back).every(([r,v])=>v===0),{facility:b.type,progress:+b.progress.toFixed(2),batch,listValueG:value,carriedRefunded:carried,returnedOfBatch:back});
finish('code-demolish');
