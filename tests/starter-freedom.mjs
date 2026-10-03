import assert from 'node:assert/strict';
import {Simulation} from '../src/app/game/simulation.js';
import {NATIONS} from '../src/app/game/world.js';
import {startingProvinces} from '../src/app/game/starting-sites.js';
import {EXPORT_GATE,STARTER_LOADING,STARTER_FLEET,FUEL_PER_TRIP,fleet,parkedVehicles,tickShipments} from '../src/app/game/export-route.js';
import {fleetState} from '../src/app/game/ui-rules.js';
import {encodeSave,decodeSave} from '../src/app/game/persistence.js';

const reload=s=>new Simulation(s.region,decodeSave(encodeSave(s.save())));
const finish=s=>{for(let i=0;i<400&&s.shipments.length;i++)tickShipments(s,.25);assert.equal(s.shipments.length,0);};
let starts=0;
for(const [nation,n] of Object.entries(NATIONS))for(const p of startingProvinces(nation)){
 const s=new Simulation(n.region,null,{nation,provinceId:p.id});
 assert.equal(s.buildings.length,0);assert.equal(s.workers.length,0);
 assert.ok(s.exportStatus().connected,p.id+' has usable starting transport');
 assert.equal(fleetState(s).total,STARTER_FLEET);
 assert.equal(parkedVehicles(s).length,STARTER_FLEET,p.id+' has parked vehicles');
 const money=s.money,wood=s.stock.wood,sale=s.sell('wood',1);
 assert.ok(sale.ok,p.id);assert.equal(s.money,money);assert.equal(s.stock.wood,wood-1);
 assert.deepEqual(s.shipments[0].route[0],STARTER_LOADING);
 assert.deepEqual(s.shipments[0].route.at(-1),EXPORT_GATE);
 assert.equal(parkedVehicles(s).length,STARTER_FLEET-1);
 const loaded=reload(s);finish(loaded);
 assert.equal(loaded.money,money+sale.revenue);assert.equal(loaded.sold.wood,1);
 finish(loaded);assert.equal(loaded.money,money+sale.revenue,'no repeated payment');
 assert.equal(parkedVehicles(loaded).length,STARTER_FLEET);
 starts++;
}
assert.ok(starts>0);

for(const first of ['house','field','well','lumber','quarry']){
 const s=new Simulation('river'),spot=s.tiles.find(t=>!s.canBuild(first,t.x,t.z));
 assert.ok(spot,first);assert.ok(s.build(first,spot.x,spot.z).ok);
 assert.equal(s.workers.length,first==='house'?1:0,'only housing creates residents');
 assert.ok(s.sell('wood',1).ok,first+' first still allows export');
 const before=s.shipments[0].route.map(p=>({...p}));
 const store=s.tiles.find(t=>!s.canBuild('warehouse',t.x,t.z)&&t.x>8);
 assert.ok(store);assert.ok(s.build('warehouse',store.x,store.z).ok);
 assert.deepEqual(s.shipments[0].route,before,'building a warehouse keeps the shipment already on its way');
 assert.ok(s.exportStatus().connected);finish(s);assert.ok(s.sell('wood',1).ok);
 assert.ok(s.shipments[0].storeId===0,'starting stock stays in its physical store');
}

// Fuel limits the supplied vehicle, persists during travel, and respects reserves.
const s=new Simulation('highland');s.stock.fuel=FUEL_PER_TRIP;s.reserves.fuel=0;
assert.ok(s.sell('wood',1).ok);assert.equal(s.shipments[0].vehicle,'van');assert.equal(s.stock.fuel,0);
assert.equal(s.sell('wood',1).ok,false);const loaded=reload(s);finish(loaded);
assert.equal(fleet(loaded).length,STARTER_FLEET);assert.equal(fleetState(loaded).fuelNote,'연료 부족');assert.equal(loaded.sell('wood',1).ok,false);
loaded.stock.fuel=2;loaded.reserves.fuel=2;assert.equal(loaded.sell('wood',1).ok,false,'reserved fuel stays protected');
console.log(`PASS starter freedom: ${starts} plots, first build, residents, physical stores, export/return/save and limited fuel`);
