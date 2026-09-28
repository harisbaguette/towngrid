import assert from 'node:assert/strict';
import {Simulation,createShowcase} from '../app/game/simulation.js';
import {createStarterShowcase} from '../app/game/starter-demo.js';
import {encodeSave,decodeSave} from '../app/game/persistence.js';
import {EXPORT_GATE,EXPORT_TILES,EXPORT_CARTS} from '../app/game/export-route.js';
const run=(s,t)=>{for(let i=0;i<t*4;i++)s.tick(.25);};
const fresh=()=>{const s=new Simulation('river');s.nextEvent=1e9;s.autoSell={};return s;};

// Every region starts with a clear export road from the west edge into the starting land.
for(const region of ['river','coast','highland']){const s=new Simulation(region);for(const p of EXPORT_TILES){assert.ok(s.roads.has(p.x+','+p.z),region+' export road '+p.x);assert.equal(s.tile(p.x,p.z).nature,null);assert.notEqual(s.tile(p.x,p.z).terrain,'water');}assert.ok(s.ownedAt(EXPORT_TILES.length,EXPORT_GATE.z),'the road meets owned land');}

// No warehouse, no export.
const bare=fresh();assert.equal(bare.sell('wood',5).ok,false);assert.equal(bare.stock.wood,50);

// Goods leave on a cart and are paid for only at the gate.
const s=fresh();s.build('warehouse',10,12);const money=s.money,wood=s.stock.wood;
const sale=s.sell('wood',5);assert.ok(sale.ok&&sale.revenue>0);assert.equal(s.stock.wood,wood-5);assert.equal(s.money,money,'no payment before the cart arrives');assert.equal(s.sold.wood,undefined);assert.equal(s.shipments.length,1);
assert.deepEqual(s.shipments[0].route.at(-1),EXPORT_GATE,'the cart drives to the gate');
let paid=sale.revenue;for(let i=1;i<EXPORT_CARTS;i++){const r=s.sell('stone',1);assert.ok(r.ok);paid+=r.revenue;}assert.equal(s.sell('stone',1).ok,false,'only '+EXPORT_CARTS+' carts run at once');
// A cart that is on the road survives saving and still pays out after loading.
const loaded=new Simulation(s.region,decodeSave(encodeSave(s.save())));assert.equal(loaded.shipments.length,EXPORT_CARTS);
run(s,8);assert.equal(s.money,money+paid,'every cart pays its loading price at the gate');assert.equal(s.sold.wood,5);
run(loaded,8);assert.equal(loaded.sold.wood,5);assert.ok(loaded.money>money);
run(s,12);assert.equal(s.shipments.length,0,'carts come back and free their slot');assert.ok(s.sell('stone',1).ok);

// The export road cannot be demolished or built over.
assert.equal(s.demolish(3,EXPORT_GATE.z).ok,false);assert.ok(s.roads.has('3,'+EXPORT_GATE.z));
s.money=5000;assert.ok(s.expand(1,2).ok);assert.match(s.canBuild('house',5,EXPORT_GATE.z,true),/수출길/);

// Blocking the only way out stops sales without losing stock.
const blocked=fresh();blocked.build('warehouse',10,12);blocked.build('house',8,EXPORT_GATE.z,true);assert.equal(blocked.exportStatus().connected,false);const before=blocked.stock.wood;assert.equal(blocked.sell('wood',5).ok,false);assert.equal(blocked.stock.wood,before);
blocked.demolish(8,EXPORT_GATE.z);assert.equal(blocked.exportStatus().connected,true);

// Older saves without the road get it back, clearing any tree on it.
const old=fresh().save();old.roads=old.roads.filter(k=>!EXPORT_TILES.some(p=>k===p.x+','+p.z));delete old.shipments;delete old.nextShipmentId;old.tiles[EXPORT_GATE.z*24+2]={nature:'tree',remaining:90};
const upgraded=new Simulation('river',decodeSave(encodeSave(old)));assert.ok(EXPORT_TILES.every(p=>upgraded.roads.has(p.x+','+p.z)));assert.equal(upgraded.tile(2,EXPORT_GATE.z).nature,null);assert.deepEqual(upgraded.shipments,[]);

// A tampered cart route is rejected like any other broken save.
const bad=s.save();bad.shipments=[{id:1,item:'wood',amount:5,revenue:40,route:[{x:99,z:3}],progress:0,phase:'out'}];assert.throws(()=>encodeSave(bad));

// Prebuilt villages keep working and can reach the gate.
const starter=createStarterShowcase();assert.equal(starter.exportStatus().connected,true);run(starter,120);assert.ok((starter.sold.grain||0)+(starter.sold.plank||0)>0,'starter village exports goods');
assert.equal(createShowcase().exportStatus().connected,true);
console.log(JSON.stringify({result:'PASS',checked:['export road on every region','no warehouse no export','paid on arrival','cart limit','save/load in transit','carts return','road protected','blocked route','old save upgrade','tampered route rejected','starter and showcase villages']}));
