// Isolated audit fixtures. This script does not modify production code or player saves.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {Simulation,RESOURCES,BUILDINGS} from '../../src/app/game/simulation.js';
import {Campaign} from '../../src/app/game/campaign.js';
import {PROVINCES,sovereignOf} from '../../src/app/game/territory.js';
import {gridStatus,powerNodes} from '../../src/app/game/trade-terminals.js';
import {encodeSave,decodeSave} from '../../src/app/game/persistence.js';
import {freeSpace} from '../../src/app/game/storage.js';
import {contractState} from '../../src/app/game/ui-rules.js';
import {productionDiagnosis} from '../../src/app/game/proximity.js';
const findings=[];
const report=(id,reproduced,details)=>{const r={id,reproduced,...details};findings.push(r);console.log(JSON.stringify(r));};
const fresh=()=>{const s=new Simulation('river');s.money=1e6;s.autoSell={};s.nextEvent=1e9;for(const k of Object.keys(RESOURCES))s.stock[k]=0;return s;};
const put=(s,type,x,z)=>{const p=x===undefined?s.tiles.find(t=>!s.canBuild(type,t.x,t.z,true)):{x,z};assert.ok(p,type);const r=s.build(type,p.x,p.z,true);assert.ok(r.ok,r.error);return s.at(p.x,p.z);};
const run=(s,n)=>{for(let i=0;i<n*4;i++)s.tick(.25);};
const allLand=s=>{s.owned=new Set(s.tiles.map(t=>t.x+','+t.z));s.revision++;};
// Obtain a real carried load before expanding the population fixture beyond 100.
{
 const s=fresh(),h=put(s,'house',10,14),m=put(s,'sawmill',12,12);h.level=3;s.syncWorkers();s.stock.wood=10;let w;
 for(let i=0;i<300;i++){s.tick(.25);w=s.workers.find(w=>w.task?.carried&&w.task.targetId===m.id);if(w)break;}assert.ok(w,'real carried load');
 allLand(s);for(let i=1;i<35;i++){const h=put(s,'house');h.level=3;}s.syncWorkers();
 const before={workers:s.workers.length,capacity:s.workerCount};decodeSave(encodeSave(s.save()));
 s.stock.stone=s.storageCapacity-s.storageUsed;assert.ok(s.demolish(h.x,h.z).ok);
 let error=null;try{decodeSave(encodeSave(s.save()));}catch(e){error=e.message;}
 report('save_rejects_retiring_residents_over_100',!!error,{before,after:{workers:s.workers.length,capacity:s.workerCount,retiring:s.workers.filter(v=>v.retiring).length},error});
}
// A factory can be inside both independent power radii. Reverse node order to expose assignment order.
{
 const s=fresh();allLand(s);const a=put(s,'windturbine',4,12),b=put(s,'windturbine',14,12);
 const consumers=[put(s,'refinery',8,11),put(s,'refinery',9,11),put(s,'refinery',10,11)];a.activeUntil=b.activeUntil=1e6;s.revision++;
 const g=gridStatus(s);report('overlapping_power_radii_leave_usable_supply_idle',g.powered.size<3&&g.supply>=g.demand,{supply:g.supply,demand:g.demand,groups:g.groups.map(v=>({supply:v.supply,demand:v.demand,used:v.used})),consumers:consumers.map(v=>({id:v.id,powered:s.poweredAt(v),distanceA:Math.max(Math.abs(v.x-a.x),Math.abs(v.z-a.z)),distanceB:Math.max(Math.abs(v.x-b.x),Math.abs(v.z-b.z))}))});
}
// Battery charge uses the global flag instead of its local power connection.
{
 const s=fresh();allLand(s);const wind=put(s,'windturbine',4,12),battery=put(s,'battery',19,12);wind.activeUntil=1000;s.revision++;
 const connected=s.poweredAt(battery);run(s,2);
 report('disconnected_battery_charges',!connected&&s.batteryCharge>0,{connected,charge:s.batteryCharge,distance:Math.abs(wind.x-battery.x)});
 assert.ok(s.relocate(wind.id,5,12).ok);const before=s.batteryCharge;run(s,1);
 report('moving_generator_still_charges_battery',powerNodes(s).length===0&&s.batteryCharge>before,{globalPower:s.power,nodes:powerNodes(s).length,before,after:s.batteryCharge,status:wind.status});
}
// Policies reject a finished item while total warehouse space is still available.
{
 const s=fresh();put(s,'house',10,14);const m=put(s,'sawmill',12,12);m.out=10;assert.ok(s.setStorageRule(0,'plank',0).ok);run(s,10);
 const diagnosis=productionDiagnosis(s,m,BUILDINGS,RESOURCES);
 report('storage_policy_block_misdiagnosed',m.out===10&&m.status==='운반 대기'&&diagnosis.text.includes('주민'),{output:m.out,status:m.status,totalSpace:freeSpace(s,s.starterStore),plankSpace:freeSpace(s,s.starterStore,'plank'),idleResidents:s.workers.filter(w=>!w.task).length,diagnosis});
 s.setStorageRule(0,'plank',null);run(s,30);assert.ok(m.out<10,'lifting the policy must unblock the same workforce');
}
// Partial contract has enough goods for this vehicle, but no fuel: the button hides its actual reason.
{
 const s=fresh();s.contracts=1;s.contractOrder={n:1,item:'grain'};s.stock.grain=10;const logic=s.contractStatus(),ui=contractState(s);
 report('partial_contract_hides_fuel_error',!logic.ready&&!!logic.error&&!ui.note,{logic,ui});
}
// Diplomatic orders label the new state but retain the unrelated market destination and its travel cost.
{
 const c=new Campaign(),s=c.active,state=c.spawnState('arsel','Audit state');assert.ok(state);state.industry=3;
 s.rank=22;for(const k of Object.keys(RESOURCES))s.stock[k]=0;const order=c.stateOrder(state);s.stock[order.item]=order.amount;s.stock.fuel=40;
 const result=c.stateAction('trade',state.id);assert.ok(result.ok,result.error);const sh=s.shipments[0],capital=PROVINCES.find(p=>p.id===state.capitalProvince);
 report('diplomatic_order_sent_to_unrelated_market',sovereignOf(sh.destinationId,c.provinces)!==state.id,{state:state.id,capital:state.capitalProvince,capitalCell:capital.cell,shipmentLabel:sh.label,destination:sh.destinationId,destinationOwner:sovereignOf(sh.destinationId,c.provinces),end:sh.worldRoute.at(-1),fuel:sh.fuel,duration:sh.duration});
}
mkdirSync('docs/verification/townstar-second-audit-20261003',{recursive:true});
writeFileSync('docs/verification/townstar-second-audit-20261003/probes.json',JSON.stringify(findings,null,2)+'\n');

if(process.argv.includes('--regression'))for(const f of findings)assert.equal(f.reproduced,false,f.id);
