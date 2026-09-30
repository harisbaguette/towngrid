// Item conservation ledger. Every tick: stock + building inputs/outputs + carried cargo must change only by
// production, cycle input consumption and export dispatch. Stress actions: save/load, demolish+rebuild,
// house demolition while residents carry, on/off toggling. Any unexplained delta is a loss/duplication path.
import {Simulation,createShowcase,BUILDINGS,RESOURCES} from '../../src/app/game/simulation.js';
import {expectBug,finish} from './_harness.mjs';
import {VEHICLES,FUEL_PER_TRIP} from '../../src/app/game/export-route.js';
const items=Object.keys(RESOURCES);
const mass=s=>{const m=Object.fromEntries(items.map(r=>[r,s.stock[r]||0]));for(const b of s.buildings){for(const[r,n]of Object.entries(b.inputs))m[r]+=n;const o=s.recipeOf(b).output;if(RESOURCES[o])m[o]+=b.out;}for(const w of s.workers)if(w.task?.carried)m[w.task.item]+=w.task.amount;return m;};
let s=createShowcase('estern','human');s.nextEvent=1e9;for(const b of s.buildings)if(b.specialized)b.specialized=false;
const anomalies=[];let actions=[];
function step(dt,label){const before=mass(s),prog=new Map(s.buildings.map(b=>[b.id,{p:b.progress,c:b.cycles||0}])),prod={...s.produced},ship=new Set(s.shipments.map(v=>v.id)),shipBefore=s.shipments.map(v=>({...v})),inf=s.health.infection;
 s.tick(dt);const after=mass(s),expect=Object.fromEntries(items.map(r=>[r,0]));
 for(const[r,n]of Object.entries(s.produced))expect[r]+=n-(prod[r]||0);
 // A completed cycle can immediately start its next batch with the same tick's
 // remainder. Count batch starts even when progress stays above zero.
 for(const b of s.buildings){const p=prog.get(b.id);if(!p)continue;const starts=(b.cycles||0)-p.c+(b.progress>0?1:0)-(p.p>0?1:0);if(starts>0)for(const[r,n]of Object.entries(s.effectiveInputs(b)))expect[r]-=n*starts;}
 // A new shipment takes its goods (an import takes none until it unloads) and a fuel vehicle burns its trip's fuel;
 // an import that has left the list has unloaded at the warehouse.
 for(const sh of s.shipments)if(!ship.has(sh.id)){if(sh.kind!=='import')expect[sh.item]-=sh.amount;if(VEHICLES[sh.vehicle]?.fuel)expect.fuel-=FUEL_PER_TRIP;}
 for(const sh of shipBefore)if(sh.kind==='import'&&!s.shipments.some(v=>v.id===sh.id))expect[sh.item]+=sh.amount;
 for(const r of items){const d=after[r]-before[r]-expect[r];if(Math.abs(d)>1e-6)anomalies.push({t:Math.round(s.time*100)/100,item:r,unexplained:d,during:label});}}
for(let i=0;i<4*900;i++){
 let label='tick';
 if(i%80===40){const raw=JSON.parse(JSON.stringify(s.save()));const m0=mass(s);s=new Simulation(s.region,raw);s.nextEvent=1e9;const m1=mass(s);for(const r of items)if(Math.abs(m1[r]-m0[r])>1e-6)anomalies.push({t:s.time,item:r,unexplained:m1[r]-m0[r],during:'save/load'});}
 if(i%120===60){const carrier=s.workers.find(w=>w.task?.carried);if(carrier){const h=s.buildings.find(b=>b.id===carrier.homeId);const m0=mass(s);const {type,x,z,level}=h;s.demolish(x,z);const m1=mass(s);for(const r of items)if(Math.abs(m1[r]-m0[r])>1e-6)anomalies.push({t:s.time,item:r,unexplained:m1[r]-m0[r],during:'demolish home of carrier'});s.build(type,x,z,true);s.at(x,z).level=level;actions.push('home-demolish');}}
 if(i%120===0&&i){const b=s.buildings.filter(b=>BUILDINGS[b.type].period&&!BUILDINGS[b.type].home)[(i/120)%20];if(b){const m0=mass(s);const {type,x,z}=b,batch={...(b.progress>0?b.batch||s.effectiveInputs(b):{})};s.demolish(x,z);const m1=mass(s);for(const r of items)if(Math.abs(m1[r]-m0[r]-(batch[r]||0))>1e-6)anomalies.push({t:s.time,item:r,unexplained:m1[r]-m0[r]-(batch[r]||0),during:'demolish '+type});s.build(type,x,z,true);actions.push('demolish '+type);}}
 // Second pass: switching a facility's product hands back exactly what its running cycle consumed (a cycle saved
 // without a batch record counts as having consumed its recipe's inputs); imports, contracts
 // and fuel vehicles are covered by the shipment rules in step().
 if(i%70===35){const multi=s.buildings.filter(b=>(BUILDINGS[b.type].recipes||[]).length>1),b=multi[(i/70|0)%multi.length];if(b){const list=BUILDINGS[b.type].recipes.filter(r=>(r.unlock||0)<=s.rank),next=list[(list.indexOf(s.recipeOf(b))+1)%list.length],batch={...(b.progress>0?b.batch||s.effectiveInputs(b):{})},m0=mass(s);if(s.setRecipe(b.id,next.id).ok){const m1=mass(s);for(const r of items)if(Math.abs(m1[r]-m0[r]-(batch[r]||0))>1e-6)anomalies.push({t:s.time,item:r,unexplained:m1[r]-m0[r]-(batch[r]||0),during:'recipe '+b.type});actions.push('recipe '+b.type+':'+next.id);}}}
 if(i%200===100){if(s.buy(['stone','coal','wood'][(i/200|0)%3],5).ok)actions.push('import');if(s.contractStatus().ready&&s.fulfill().ok)actions.push('contract');}
 if(i%100===50){const b=s.buildings[(i/50)%s.buildings.length];s.setOperation(b.id,false);step(.25,'disabled '+b.type);s.setOperation(b.id,true);continue;}
 step(.25,label);
}
console.log(JSON.stringify({seconds:Math.round(s.time),actions:actions.length,imports:actions.filter(a=>a==='import').length,contracts:actions.filter(a=>a==='contract').length,recipeSwitches:actions.filter(a=>a.startsWith('recipe')).length,fuelTrips:s.logisticsStats.fuelTrips||0,anomalies:anomalies.length,sample:anomalies.slice(0,12)}));
const neg=items.filter(r=>s.stock[r]<0);
expectBug('L1-unexplained-item-delta',anomalies.length>0,{count:anomalies.length,byContext:Object.entries(anomalies.reduce((m,a)=>(m[a.during.split(' ')[0]]=(m[a.during.split(' ')[0]]||0)+1,m),{}))});
expectBug('L2-negative-stock',neg.length>0,neg);
// Decided rule (L3): returns from demolition or cancelled hauls are kept above capacity so nothing is lost, and the
// simulation reports the overflow (storageOverflow, one warning) so the player sells it. Unreported overflow is the defect.
const over=items.filter(r=>s.stock[r]>s.storageCapacity).map(r=>[r,Math.floor(s.stock[r]),s.storageCapacity]);
const reported=typeof s.storageOverflow==='function'?s.storageOverflow():[];
expectBug('L3-stock-above-capacity',over.some(([r])=>!reported.includes(r)),{over,reported});
finish('stock-ledger');
