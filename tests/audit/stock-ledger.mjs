// Item conservation ledger. Every tick: stock + building inputs/outputs + carried cargo must change only by
// production, cycle input consumption and export dispatch. Stress actions: save/load, demolish+rebuild,
// house demolition while residents carry, on/off toggling. Any unexplained delta is a loss/duplication path.
import {Simulation,createShowcase,BUILDINGS,RESOURCES} from '../../src/app/game/simulation.js';
import {expectBug,finish} from './_harness.mjs';
const items=Object.keys(RESOURCES);
const mass=s=>{const m=Object.fromEntries(items.map(r=>[r,s.stock[r]||0]));for(const b of s.buildings){for(const[r,n]of Object.entries(b.inputs))m[r]+=n;const o=BUILDINGS[b.type].output;if(RESOURCES[o])m[o]+=b.out;}for(const w of s.workers)if(w.task?.carried)m[w.task.item]+=w.task.amount;return m;};
let s=createShowcase('estern','human');s.nextEvent=1e9;for(const b of s.buildings)if(b.specialized)b.specialized=false;
const anomalies=[];let actions=[];
function step(dt,label){const before=mass(s),prog=new Map(s.buildings.map(b=>[b.id,{p:b.progress,c:b.cycles||0}])),prod={...s.produced},ship=new Set(s.shipments.map(v=>v.id)),inf=s.health.infection;
 s.tick(dt);const after=mass(s),expect=Object.fromEntries(items.map(r=>[r,0]));
 for(const[r,n]of Object.entries(s.produced))expect[r]+=n-(prod[r]||0);
 for(const b of s.buildings){const p=prog.get(b.id);if(!p)continue;if(p.p===0&&(b.progress>0||(b.cycles||0)>p.c))for(const[r,n]of Object.entries(s.effectiveInputs(b)))expect[r]-=n;}
 for(const sh of s.shipments)if(!ship.has(sh.id))expect[sh.item]-=sh.amount;
 for(const r of items){const d=after[r]-before[r]-expect[r];if(Math.abs(d)>1e-6)anomalies.push({t:Math.round(s.time*100)/100,item:r,unexplained:d,during:label});}}
for(let i=0;i<4*900;i++){
 let label='tick';
 if(i%80===40){const raw=JSON.parse(JSON.stringify(s.save()));const m0=mass(s);s=new Simulation(s.region,raw);s.nextEvent=1e9;const m1=mass(s);for(const r of items)if(Math.abs(m1[r]-m0[r])>1e-6)anomalies.push({t:s.time,item:r,unexplained:m1[r]-m0[r],during:'save/load'});}
 if(i%120===60){const carrier=s.workers.find(w=>w.task?.carried);if(carrier){const h=s.buildings.find(b=>b.id===carrier.homeId);const m0=mass(s);const {type,x,z,level}=h;s.demolish(x,z);const m1=mass(s);for(const r of items)if(Math.abs(m1[r]-m0[r])>1e-6)anomalies.push({t:s.time,item:r,unexplained:m1[r]-m0[r],during:'demolish home of carrier'});s.build(type,x,z,true);s.at(x,z).level=level;actions.push('home-demolish');}}
 if(i%120===0&&i){const b=s.buildings.filter(b=>BUILDINGS[b.type].period&&!BUILDINGS[b.type].home)[(i/120)%20];if(b){const m0=mass(s);const {type,x,z}=b;s.demolish(x,z);const m1=mass(s);for(const r of items)if(Math.abs(m1[r]-m0[r])>1e-6)anomalies.push({t:s.time,item:r,unexplained:m1[r]-m0[r],during:'demolish '+type});s.build(type,x,z,true);actions.push('demolish '+type);}}
 if(i%100===50){const b=s.buildings[(i/50)%s.buildings.length];s.setOperation(b.id,false);step(.25,'disabled '+b.type);s.setOperation(b.id,true);continue;}
 step(.25,label);
}
console.log(JSON.stringify({seconds:Math.round(s.time),actions:actions.length,anomalies:anomalies.length,sample:anomalies.slice(0,12)}));
const neg=items.filter(r=>s.stock[r]<0);
expectBug('L1-unexplained-item-delta',anomalies.length>0,{count:anomalies.length,byContext:Object.entries(anomalies.reduce((m,a)=>(m[a.during.split(' ')[0]]=(m[a.during.split(' ')[0]]||0)+1,m),{}))});
expectBug('L2-negative-stock',neg.length>0,neg);
// Decided rule (L3): returns from demolition or cancelled hauls are kept above capacity so nothing is lost, and the
// simulation reports the overflow (storageOverflow, one warning) so the player sells it. Unreported overflow is the defect.
const over=items.filter(r=>s.stock[r]>s.storageCapacity).map(r=>[r,Math.floor(s.stock[r]),s.storageCapacity]);
const reported=typeof s.storageOverflow==='function'?s.storageOverflow():[];
expectBug('L3-stock-above-capacity',over.some(([r])=>!reported.includes(r)),{over,reported});
finish('stock-ledger');
