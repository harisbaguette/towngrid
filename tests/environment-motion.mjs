import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {Simulation,RESOURCES,BUILDINGS} from '../src/app/game/simulation.js';
import {legacyLayout} from '../src/app/game/world-grid.js';
import {tickNetworks,chooseTradeRoute} from '../src/app/game/trade-terminals.js';
import {tickShipments} from '../src/app/game/export-route.js';
import {logisticsVisualEvents,transferPose} from '../src/app/game/logistics-visual-events.js';
import {makePixelBuilding,makePixelVehicle} from '../src/app/game/pixel-environment.js';
import {CRANE_RIGS,vehicleMotion,MOTION_FRAMES} from '../src/app/game/pixel-motion-data.js';
import {discProjection} from '../src/app/game/pixel-part-projection.js';
const rig=JSON.parse(await readFile('art-source/pixel-environment/motion-v10/rig.json','utf8'));
assert.deepEqual(CRANE_RIGS,rig.cranes);assert.equal(MOTION_FRAMES,rig.frames);
const wrangler=createRequire(import.meta.resolve('wrangler')),sharp=createRequire(wrangler.resolve('miniflare'))('sharp');
for(const id of Object.keys(rig.vehicles)){
 const original=await sharp('public/assets/pixel-environment/'+id+'.png').ensureAlpha().raw().toBuffer();
 const rest=await sharp('public/assets/pixel-environment/'+id+'Motion.png').extract({left:0,top:0,width:192,height:768}).ensureAlpha().raw().toBuffer();
 assert.deepEqual(rest,original,id+' rest frame must preserve every original pixel');
 assert.deepEqual(await readFile('art-source/pixel-environment/motion-v10/'+id+'Motion.png'),await readFile('public/assets/pixel-environment/'+id+'Motion.png'));
}
const u={};assert.equal(vehicleMotion(u,0,{x:0,z:0}),0);
const moved=vehicleMotion(u,1,{x:.25,z:0});assert.equal(moved,3);
assert.equal(vehicleMotion(u,2,{x:.25,z:0}),moved);assert.equal(u.motionMoving,false);
assert.equal(vehicleMotion(u,2,{x:.25,z:0}),moved,'camera rotation must not advance a wheel');
assert.equal(vehicleMotion(u,3,{x:20,z:20}),moved,'teleport does not spin through the map');
for(let view=0;view<4;view++){
 const [a,b,c,d]=discProjection(view);assert.ok(Math.abs(a*d-b*c)>.3,'disc cannot flatten to a line');
 for(const id of Object.keys(BUILDINGS).filter(id=>!BUILDINGS[id].tile)){
  const model=makePixelBuilding(id),u=model.userData,base={type:id,health:100,enabled:true};
  u.animate(0,base,{time:0},view);assert.ok(!u.layers.some(l=>l.userData.structurePiece),'healthy buildings allocate no fragments');
  u.animate(1,{...base,health:0},{time:1},view);assert.equal(u.damageAmount,1);assert.equal(u.sprite.visible,false);
  assert.equal(u.layers.filter(l=>l.userData.structurePiece&&l.visible).length,4);
  u.animate(2,base,{time:2},view);assert.equal(u.damageAmount,1,'repair reconstructs the old silhouette');
  u.animate(2.6,base,{time:2.6},view);assert.ok(u.damageAmount>0&&u.damageAmount<1);
  u.animate(3.3,base,{time:3.3},view);assert.equal(u.damageAmount,0);assert.ok(u.sprite.visible);
  assert.ok(u.layers.filter(l=>l.userData.structurePiece).every(l=>!l.visible));
  const rebuilt=makePixelBuilding(id);rebuilt.userData.conditionHealth=0;
  rebuilt.userData.animate(10,base,{time:10},view);
  assert.equal(rebuilt.userData.damageAmount,1,'rebuild preserves the previous destroyed state');
  rebuilt.userData.animate(11.3,base,{time:11.3},view);assert.equal(rebuilt.userData.damageAmount,0);
 }
 const vehicle=makePixelVehicle('steamer');vehicle.userData.animate(0,null,false,view);
 vehicle.position.x=.5;vehicle.userData.animate(1,null,false,view);assert.ok(vehicle.userData.wakes.every(w=>w.visible));
 vehicle.userData.animate(2,null,false,view);assert.ok(vehicle.userData.wakes.every(w=>!w.visible));
}
const town=()=>{
 const s=new Simulation('river',null,{land:legacyLayout('river')});s.nextEvent=1e9;s.autoSell={};s.money=1e7;s.debt=0;s.rank=32;
 for(const id of Object.keys(RESOURCES))s.stock[id]=200;
 assert.ok(s.build('warehouse',11,12).ok);assert.ok(s.expand(4,3).ok);return s;
};
const s=town();s.workers=[];s.stock.water=0;
assert.ok(s.build('well',9,14).ok);for(const [x,z]of[[10,14],[10,13],[10,12]])assert.ok(s.build('pipe',x,z).ok);
const well=s.at(9,14);well.out=6;s.time=1;tickNetworks(s,1);
const event=logisticsVisualEvents(s).find(e=>e.kind==='pipe');assert.ok(event);assert.equal(event.amount,3);assert.equal(s.stock.water,3);assert.equal(well.out,3);
assert.deepEqual(event.path,[{x:9,z:14},{x:10,z:14},{x:10,z:13},{x:10,z:12},{x:11,z:12}]);
assert.deepEqual(transferPose(event,event.start),{x:9,z:14,progress:0});
const before=JSON.stringify(s.save());logisticsVisualEvents(s);assert.equal(JSON.stringify(s.save()),before,'visual events cannot alter a save');
const restored=new Simulation('river',s.save());assert.equal(logisticsVisualEvents(restored).length,0,'events are not persisted');
s.demolish(10,13);assert.equal(logisticsVisualEvents(s).length,0,'removed networks leave no flying cargo');
const portTown=town();assert.ok(portTown.build('riverport',16,13).ok);assert.ok(portTown.sell('wood',100).ok);
assert.ok(chooseTradeRoute(portTown,'gate').ok,'changing the next route must not redirect the current handling animation');
for(let n=0;n<200&&!logisticsVisualEvents(portTown).some(e=>e.kind==='terminal');n++){portTown.time+=.1;tickShipments(portTown,.1);}
const handling=logisticsVisualEvents(portTown).find(e=>e.kind==='terminal');assert.ok(handling,'real shipment arrival starts the hoist');
const port=portTown.at(16,13),crane=makePixelBuilding('riverport');
crane.userData.animate(portTown.time,port,portTown,0);assert.ok(crane.userData.handlingCargo);
port.enabled=false;assert.equal(logisticsVisualEvents(portTown).length,0);crane.userData.animate(portTown.time,port,portTown,0);assert.equal(crane.userData.handlingCargo,false);
console.log('Environment motion PASS: 104 facilities × 4 views, collapse/repair, projected discs, distance-driven vehicles, actual network/terminal transfers, pause and save isolation.');
