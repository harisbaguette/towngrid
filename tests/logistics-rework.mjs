import assert from 'node:assert/strict';
import {Simulation,RESOURCES} from '../src/app/game/simulation.js';
import {stores,deposit,withdraw,freeSpace,used,capacity} from '../src/app/game/storage.js';
import {fleet,tickShipments} from '../src/app/game/export-route.js';
import {startingProvinces} from '../src/app/game/starting-sites.js';
import {NATIONS} from '../src/app/game/world.js';
import {legacyLayout} from '../src/app/game/world-grid.js';
import {encodeSave,decodeSave} from '../src/app/game/persistence.js';
const run=(s,n)=>{s.nextEvent=1e9;s.autoSell={};for(let i=0;i<n*4;i++)s.tick(.25);};
const fresh=()=>{const s=new Simulation('river');s.nextEvent=1e9;s.autoSell={};return s;};
const place=(s,type)=>{const p=s.tiles.find(t=>!s.canBuild(type,t.x,t.z,true));assert.ok(p,type);assert.ok(s.build(type,p.x,p.z,true).ok);return s.at(p.x,p.z);};
const reload=s=>new Simulation(s.region,decodeSave(encodeSave(s.save())));
const finish=s=>{for(let i=0;i<1600&&s.shipments.length;i++)tickShipments(s,.25);assert.equal(s.shipments.length,0);};
let starts=0;
for(const[nation,n]of Object.entries(NATIONS))for(const p of startingProvinces(nation)){
 const s=new Simulation(n.region,null,{nation,provinceId:p.id});assert.equal(s.buildings.length,0);assert.ok(fleet(s).length>=1);assert.equal(s.stock.fuel,40);assert.ok(s.sell('wood',1).ok,p.id);assert.ok(s.stock.fuel<40);finish(s);starts++;
}
{
 const s=fresh();place(s,'house');place(s,'well');const initial=s.stock.water;run(s,35);
 assert.ok(s.produced.water>0);assert.ok(s.stock.water>initial);assert.ok(s.starterStore.inventory.water>initial);assert.equal(s.warehouse,undefined);
 const imp=s.buy('grain',1);assert.ok(imp.ok,imp.error);finish(s);assert.equal(s.stock.grain,9);assert.equal(reload(s).stock.water,s.stock.water);
}
{
 const s=fresh();s.stock.fuel=0;assert.equal(s.sell('wood',1).ok,false);const cash=s.money,imp=s.buy('fuel',3);assert.ok(imp.ok,imp.error);assert.equal(s.stock.fuel,0);assert.ok(imp.cost>3*Math.ceil(RESOURCES.fuel.price*1.85));finish(s);assert.equal(s.stock.fuel,3);assert.equal(s.money,cash-imp.cost);assert.ok(s.sell('wood',1).ok);
}
{
 const s=fresh(),cash=s.money;assert.ok(s.sell('wood',1).ok);while(!s.shipments[0].away)tickShipments(s,.25);assert.equal(s.money,cash,'local exit does not pay');
 const saved=reload(s);assert.equal(saved.shipments[0].away,'out');while(saved.shipments[0].phase==='out')tickShipments(saved,.25);assert.ok(saved.money>cash);const paid=saved.money;finish(saved);assert.equal(saved.money,paid);assert.equal(saved.sold.wood,1);
}
{
 const s=fresh();place(s,'house');const a=place(s,'warehouse'),b=place(s,'depot');assert.equal(used(a),0);assert.equal(used(b),0);s.setStoreDrain(0,true);run(s,100);assert.ok(used(a)+used(b)>0);assert.ok(used(s.starterStore)<144);assert.equal(s.storageUsed,stores(s,false).reduce((n,b)=>n+used(b),0));
 const back=reload(s);assert.deepEqual(back.buildings.filter(b=>b.inventory).map(b=>b.inventory),s.buildings.filter(b=>b.inventory).map(b=>b.inventory));
 const snap=back.save();snap.buildings.find(b=>b.inventory).inventory.wood+=1;assert.throws(()=>encodeSave(snap),'aggregate and physical stock mismatch rejected');
 const original=s.save(),legacy=structuredClone(original);legacy.version=8;delete legacy.storageVersion;delete legacy.starterInventory;for(const b of legacy.buildings)delete b.inventory;
 const migrated=new Simulation('river',decodeSave(encodeSave(legacy)));assert.deepEqual({...migrated.stock},original.stock);assert.deepEqual({...reload(migrated).stock},original.stock);
}
{
 const s=new Simulation('river',null,{land:legacyLayout('river',null)});s.money=1e6;s.rank=32;s.autoSell={};s.build('warehouse',11,12,true);s.expand(4,3);s.build('riverport',16,13,true);s.stock.wood=100;s.stock.fuel=30;
 const terminal=s.tradeConnection();assert.equal(terminal.type,'riverport');assert.ok(s.sell('wood',10).ok);const sh=s.shipments[0];assert.equal(sh.terminalId,terminal.id);assert.ok(sh.route.some(p=>p.x===16&&p.z===13));assert.ok(sh.route.some(p=>terminal.goals.some(g=>g.x===p.x&&g.z===p.z)));assert.ok(sh.duration>0);finish(s);
}
{
 const s=fresh(),w=place(s,'warehouse');deposit(s,'wood',20,w);const snapshot={...s.stock},old={x:w.x,z:w.z};
 // A clear tile: a tree or rock spot would add the two wood or stone its clearing gives (relocation.js).
 const p=s.tiles.find(t=>!t.nature&&!s.canRelocate(w.id,t.x,t.z));assert.ok(p);const cash=s.money,moved=s.relocate(w.id,p.x,p.z);assert.ok(moved.ok);assert.ok(s.money<cash);assert.equal(w.inventory.wood,20);assert.deepEqual({...s.stock},snapshot);assert.equal(s.at(old.x,old.z),undefined);assert.ok(w.movingUntil>s.time);assert.equal(reload(s).buildings.find(b=>b.id===w.id).x,p.x);run(s,7);assert.ok(!w.movingUntil);assert.equal(s.demolish(w.x,w.z).ok,false,'stock must be moved before demolition');
}
{
 const s=fresh(),h=place(s,'house');run(s,20);assert.equal(s.workers[0].atHome,true);place(s,'well');run(s,8);assert.ok(s.workers[0].task||!s.workers[0].atHome,'resident leaves when a job exists');assert.equal(s.workers.length,1);
}
// Stopping production never traps finished output or repeatedly cancels a hauling job.
{const s=fresh();place(s,'house');const well=place(s,'well');well.out=6;s.setOperation(well.id,false);const before=s.stock.water;run(s,40);assert.equal(well.out,0);assert.equal(s.stock.water,before+6);}
// Shared capacity includes workers already on the way, not a separate cap for each product.
{const s=fresh();for(const r of Object.keys(RESOURCES))s.stock[r]=0;place(s,'house');place(s,'house');place(s,'house');place(s,'well');for(const r of Object.keys(RESOURCES))s.stock[r]=0;s.stock.wood=140;s.stock.fuel=17;run(s,60);assert.ok(s.stock.water>0);assert.ok(used(s.starterStore)<=160);assert.equal(s.storageUsed,used(s.starterStore));}
// A pipe can use the second physical store when the first is full.
{const s=fresh();s.build('warehouse',11,14,true);s.build('depot',10,13,true);s.build('well',9,14,true);s.build('pipe',10,14,true);const a=s.at(11,14),b=s.at(10,13),well=s.at(9,14);deposit(s,'wood',capacity(s,a),a);well.out=6;run(s,3);assert.ok(b.inventory.water>0);assert.equal(a.inventory.water||0,0);}
// Emergency fuel is a slow non-electric production chain, and stock can be deliberately freed for an import.
{const s=fresh();place(s,'house');place(s,'distillery');s.stock.fuel=0;run(s,100);assert.ok(s.produced.fuel>=1);assert.equal(s.warehouse,undefined);assert.equal(s.workers.length,1);const b=s.starterStore,n=b.inventory.wood;assert.ok(s.discardStock(0,'wood',2).ok);assert.equal(b.inventory.wood,n-2);assert.equal(s.discardStock(0,'wood',9999).ok,false);reload(s);}
// An idle resident follows a moved home; all new shipment fields are validated.
{const s=fresh(),h=place(s,'house');run(s,20);const p=s.tiles.find(t=>!s.canRelocate(h.id,t.x,t.z));assert.ok(s.relocate(h.id,p.x,p.z).ok);run(s,12);assert.ok(s.workers[0].atHome);assert.ok(s.entries(h).some(p=>Math.hypot(p.x-s.workers[0].x,p.z-s.workers[0].z)<.1));reload(s);assert.ok(s.sell('wood',1).ok);const saved=s.save();for(const [k,v]of [['terminalId',3],['portBuilding','x'],['portLoaded','x'],['waterVehicle','truck'],['away','elsewhere']]){const bad=structuredClone(saved);bad.shipments[0][k]=v;assert.throws(()=>encodeSave(bad),k);}}
// With scarce transport, low-value auto-sale never starves a more valuable ready shipment.
{const s=fresh();for(const r of Object.keys(RESOURCES))s.stock[r]=0;s.stock.grain=30;s.stock.bread=30;s.stock.fuel=20;s.autoSell={grain:true,bread:true};s.reserves={};s.nextEvent=1e9;s.salesTimer=7.9;s.tick(.25);assert.equal(s.shipments[0].item,'bread');}
console.log(`PASS ${starts} starts; mini storage, fuel supply, real inventories, port routing, world journey, saves, relocation and resident rest`);
