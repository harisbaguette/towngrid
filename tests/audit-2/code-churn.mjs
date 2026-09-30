// Code audit (C): hauling reservations under churn. Real rank22 fixture at 4x; every in-game second one random player
// action (demolish + rebuild the same facility, toggle operation, switch product, upgrade, sell, buy) hits a busy site.
// After every tick: no negative or NaN stock/pad/input, no task pointing at a missing building, the save stays valid.
import {load,calm,expectBug,finish} from './_fixture.mjs';
import {validateSave} from '../../src/app/game/persistence.js';
import {BUILDINGS,RESOURCES} from '../../src/app/game/simulation.js';
let seed=7;const rnd=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648;const pick=a=>a[Math.floor(rnd()*a.length)];
const c=load(22);calm(c);c.active.paused=false;const s=c.active;for(const v of c.sites)v.sim.speed=4;s.money=Math.max(s.money,1e6);/* injected: money so every action is affordable */
const problems=[];const note=(t,d)=>{if(problems.length<12)problems.push({t:Math.round(s.time),...d});};
const actions={
 rebuild(){const b=pick(s.buildings.filter(v=>v.type!=='warehouse'&&!BUILDINGS[v.type].home));if(!b)return;const {type,x,z}=b;s.demolish(x,z);s.build(type,x,z,true);},
 toggle(){const b=pick(s.buildings.filter(v=>BUILDINGS[v.type].period));if(b)s.setOperation(b.id,b.enabled===false);},
 recipe(){const b=pick(s.buildings.filter(v=>(BUILDINGS[v.type].recipes||[]).length>1));if(b)s.setRecipe(b.id,pick(BUILDINGS[b.type].recipes).id);},
 upgrade(){const b=pick(s.buildings);if(b)s.upgrade(b.id);},
 sell(){const r=pick(Object.keys(RESOURCES));s.sell(r,5);},
 buy(){s.buy(pick(['wood','stone','water','grain','plank']),5);},
 house(){const h=pick(s.buildings.filter(v=>BUILDINGS[v.type].home));if(h){const {type,x,z}=h;s.demolish(x,z);s.build(type,x,z,true);}}
};
const ids=()=>new Set(s.buildings.map(b=>b.id));let checks=0,saveBad=null;
for(let sec=0;sec<1800;sec++){
 pick(Object.values(actions))();
 for(let i=0;i<5;i++){c.tick(.05);checks++;
  const known=ids();
  for(const [r,n] of Object.entries(s.stock))if(!(n>=0))note('stock',{r,n});
  for(const b of s.buildings){if(!(b.out>=0))note('out',{type:b.type,out:b.out});for(const [r,n] of Object.entries(b.inputs))if(!(n>=0))note('inputs',{type:b.type,r,n});}
  for(const w of s.workers){const t=w.task;if(!t)continue;if(!known.has(t.building)||t.sourceId&&!known.has(t.sourceId)||t.targetId&&!known.has(t.targetId))note('task',{task:t});}
 }
 if(sec%60===0&&!saveBad)try{validateSave(structuredClone(c.save()));}catch(e){saveBad={sec,error:e.message};}
}
console.log(JSON.stringify({checks,problems,saveBad,delivered:s.logisticsStats.delivered}));
expectBug('C-R1 churn (demolish/rebuild, toggle, switch product, upgrade) breaks a hauling invariant or the save',problems.length>0||!!saveBad,{problems:problems.slice(0,5),saveBad});
finish('code-churn');
