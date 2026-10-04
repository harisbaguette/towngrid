// Read-only gameplay audit. Fixtures set ranks/inventory; every probed action uses the game API.
// Reports the observed problems rather than treating their presence as a passing regression.
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {Simulation,BUILDINGS,RESOURCES} from '../../src/app/game/simulation.js';
import {capacity,deposit} from '../../src/app/game/storage.js';
import {fleet,vehicleLoad,shipmentPose,tickShipments,exportableStock} from '../../src/app/game/export-route.js';
import {unlockRank} from '../../src/app/game/world.js';
import {EMISSIONS,HEIGHTS} from '../../src/app/game/proximity.js';

const findings=[];
const fresh=()=>{const s=new Simulation('river');s.nextEvent=1e9;s.autoSell={};return s;};
const place=(s,type,x,z)=>{const p=x===undefined?s.tiles.find(t=>!s.canBuild(type,t.x,t.z,true)):{x,z};assert.ok(p,type);const r=s.build(type,p.x,p.z,true);assert.ok(r.ok,r.error);return s.at(p.x,p.z);};
const empty=s=>{for(const k of Object.keys(RESOURCES))s.stock[k]=0;};
const run=(s,n)=>{for(let i=0;i<n*4;i++)s.tick(.25);};
const report=(id,reproduced,data)=>findings.push({id,reproduced,...data});

// Switching an existing production facility's recipe can bypass both hauling and shared storage limits.
{
 const s=fresh();s.rank=3;const mill=place(s,'mill');empty(s);s.stock.wood=160;
 mill.inputs.grain=3;run(s,16);assert.ok(mill.out>0,'a real flour batch completes');
 const before={stock:s.storageUsed,capacity:s.storageCapacity,flour:s.stock.flour,output:mill.out,workers:s.workers.length};
 const result=s.setRecipe(mill.id,'sugar');
 const after={stock:s.storageUsed,capacity:s.storageCapacity,flour:s.stock.flour,output:mill.out,workers:s.workers.length};
 report('recipe_storage_bypass',result.ok&&after.stock>after.capacity&&after.flour>before.flour,{result,before,after});
}

// Buildings may be legally placed on the remaining route of an already-dispatched truck.
{
 const s=fresh();const w=place(s,'warehouse',11,12);empty(s);deposit(s,'wood',50,w);deposit(s,'fuel',40,s.starterStore);
 assert.ok(s.sell('wood',10).ok);const sh=s.shipments[0];
 const obstruction=sh.route.slice(2,-1).find(p=>!s.canBuild('house',p.x,p.z,true));assert.ok(obstruction,'a buildable tile on the existing route');
 const result=s.build('house',obstruction.x,obstruction.z,true);let droveThrough=false,pose=null;
 for(let i=0;i<1000&&s.shipments.includes(sh);i++){tickShipments(s,.02);const p=shipmentPose(sh);if(!sh.away&&Math.hypot(p.x-obstruction.x,p.z-obstruction.z)<.25){droveThrough=true;pose=p;break;}}
 report('truck_crosses_new_building',result.ok&&droveThrough,{obstruction,result,pose});
}

// A warehouse undergoing relocation is unavailable to hauling/export, but still supplies truck fuel globally.
{
 const s=fresh(),w=place(s,'warehouse',11,12);empty(s);deposit(s,'wood',20,s.starterStore);deposit(s,'fuel',10,w);
 const p=s.tiles.find(t=>!s.canRelocate(w.id,t.x,t.z));assert.ok(p);assert.ok(s.relocate(w.id,p.x,p.z).ok);
 const reachableFuel=exportableStock(s,'fuel'),before=w.inventory.fuel,result=s.sell('wood',1);
 report('unavailable_store_fuel',result.ok&&reachableFuel===0&&w.inventory.fuel<before,{reachableFuel,result,before,after:w.inventory.fuel,movingUntil:w.movingUntil,time:s.time});
}

// Imports accept more than the exact vehicle's carrying capacity (API-level; the UI currently orders 1 or 10).
{
 const s=fresh();for(const id of ['wood','stone','grain'])assert.ok(s.discardStock(0,id,s.stock[id]).ok);
 const load=vehicleLoad(s),result=s.buy('wood',100),shipment=s.shipments[0];
 report('import_over_vehicle_capacity',result.ok&&shipment.amount>load,{apiOnly:true,result,load,shipped:shipment?.amount,vehicle:shipment?.vehicle});
}

// Disconnecting a terminal disables it, but does not remove the additional truck it provides.
{
 const s=fresh();assert.ok(s.build('road',8,11,true).ok);const hub=place(s,'roadhub',8,12);
 const before=fleet(s).length;assert.ok(s.demolish(8,11).ok);
 const terminal=s.tradeTerminals().find(t=>t.building===hub.id),after=fleet(s).length;
 report('disconnected_terminal_truck',!terminal.usable&&after===before,{before,after,terminalUsable:terminal.usable,error:terminal.error});
}

// Compare two storage facilities under identical rank/site conditions, and confirm duplicates are legal.
{
 const s=fresh();s.rank=5;const a=place(s,'warehouse'),b=place(s,'warehouse'),d=place(s,'depot');
 const entry=b=>({cost:s.buildCost(b.type),materials:BUILDINGS[b.type].materials,capacity:capacity(s,b),tiles:BUILDINGS[b.type].size,shade:HEIGHTS[b.type],unlock:unlockRank(b.type)});
 const warehouse=entry(a),depot=entry(d);
 report('depot_dominated',warehouse.cost<depot.cost&&warehouse.capacity>depot.capacity&&!!b,{warehouse,depot,multipleWarehouses:true});
}

// Staffing cost does not change when a house goes from one to three residents.
{
 const s=fresh();s.rank=10;s.money=5000;const h=place(s,'house');s.stock.wood=20;s.stock.brick=20;
 const before={workers:s.workerCount,wage:s.wage};assert.ok(s.upgrade(h.id).ok);assert.ok(s.upgrade(h.id).ok);
 const after={workers:s.workerCount,wage:s.wage};report('resident_wages_flat',before.wage===after.wage&&after.workers>before.workers,{before,after});
}

// Compare baseline fuel throughput, input value, build cost and required infrastructure (not a whole-town profit simulation).
{
 const values=id=>{const b=BUILDINGS[id],inputs=Object.entries(b.inputs).reduce((n,[r,q])=>n+RESOURCES[r].price*q,0);return {cost:b.cost,materials:b.materials,perGameMinute:b.amount/b.period*60,inputValuePerFuel:inputs/b.amount,power:!!b.power,unlock:unlockRank(id),pollution:EMISSIONS[id]||0,height:HEIGHTS[id]||0};};
 const distillery=values('distillery'),refinery=values('refinery');report('fuel_chain_tradeoff',distillery.perGameMinute>refinery.perGameMinute*.1||distillery.inputValuePerFuel<=RESOURCES.fuel.price,{distillery,refinery});
}

mkdirSync('docs/verification',{recursive:true});
writeFileSync('docs/verification/townstar-gaps-20261003.json',JSON.stringify(findings,null,2)+'\n');
console.log(JSON.stringify(findings,null,2));

assert.ok(findings.every(f=>!f.reproduced),JSON.stringify(findings.filter(f=>f.reproduced)));
