import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ENVIRONMENT_ASSETS, ENVIRONMENT_CELL, PIXEL_BUILDINGS, pixelBuildingFrame, sawmillFrame, oakFrame, waterFrame } from '../src/app/game/pixel-environment-data.js';
import { makePixelBuilding, makePixelSawmill, makePixelTree, makePixelWater } from '../src/app/game/pixel-environment.js';
import { productionVisualState } from '../src/app/game/production-visuals.js';
import { Simulation } from '../src/app/game/simulation.js';
import { Campaign } from '../src/app/game/campaign.js';
import { NATIONS } from '../src/app/game/world.js';
import { decodeSave } from '../src/app/game/persistence.js';

// Architecture remains fixed while moving parts and inventory change independently.
const active = { working: true, enabled: true, health: 100, progress: .4, out: 0 };
for (const type of PIXEL_BUILDINGS) for (const time of [0,.21,.41,2]) assert.equal(pixelBuildingFrame(type,active,time),0);
assert.equal(sawmillFrame(active,4),0);
for (const type of ['well','lumber','sawmill','field']) {
 const model=makePixelBuilding(type,'human');
 const b={...active,type,animationTime:.2};
 model.userData.animate(.2,b);
 const base=model.userData.texture.offset.toArray();
 const pose=model.userData.layers.map(l=>[...l.position.toArray(),l.userData.sprite.material.rotation]);
 model.userData.animate(.8,{...b,animationTime:.8});
 assert.deepEqual(model.userData.texture.offset.toArray(),base,type+' fixed architecture');
 if(type!=='field')assert.notDeepEqual(model.userData.layers.map(l=>[...l.position.toArray(),l.userData.sprite.material.rotation]),pose,type+' tool motion');
 const outputs=()=>model.userData.layers.filter(l=>l.name.startsWith('output-')&&l.visible).length;
 assert.equal(outputs(),0);
 model.userData.animate(1,{...b,out:6});
 assert.equal(model.userData.production.working,true);assert.equal(model.userData.production.ready,true);assert.equal(outputs(),2);
 model.userData.animate(2,{...b,enabled:false,out:6});assert.equal(outputs(),2);assert.equal(model.userData.production.phase,'disabled');
 model.userData.animate(3,{...b,working:false,out:0});assert.equal(outputs(),0);
 // A paused simulation has unchanged animationTime even if wall-clock changes.
 model.userData.animate(20,b);const frozen=model.userData.layers.map(l=>[...l.position.toArray(),l.userData.sprite.material.rotation]);
 model.userData.animate(99,b);assert.deepEqual(model.userData.layers.map(l=>[...l.position.toArray(),l.userData.sprite.material.rotation]),frozen);
}
assert.equal(productionVisualState('warehouse',{}),null);
assert.equal(productionVisualState('sawmill',{inputs:{},progress:.5}).missing,undefined);
assert.equal(productionVisualState('sawmill',{inputs:{},progress:.5}).workpiece,true);
assert.equal(productionVisualState('sawmill',{inputs:{},progress:0}).missing,'wood');
assert.equal(productionVisualState('sawmill',{inputs:{},progress:0}).workpiece,false);
assert.equal(productionVisualState('field',{type:'field',inputs:{},progress:0},{effectiveInputs:()=>({})}).missing,undefined);
assert.equal(productionVisualState('lumber',{out:4},{closestNatural:()=>null}).phase,'blocked');
assert.equal(productionVisualState('lumber',{out:4},{closestNatural:()=>null}).ready,true);
assert.equal(productionVisualState('well',{out:0}).phase,'empty');
assert.equal(productionVisualState('well',{out:3}).phase,'ready');
assert.equal(productionVisualState('well',{out:3,health:0,working:true}).working,false);
// Ghosts omit type and coordinates; state inspection still uses the requested
// facility definition and never changes the building or its simulation.
const ghostSim=new Simulation();
assert.doesNotThrow(()=>makePixelBuilding('field','human').userData.animate(0,{working:false,inputs:{}},ghostSim,0));

// Watch real production and carrier pickups, not just synthetic UI scenarios.
const stockVillage=new Campaign({starter:true}).active;
const sawOutput=new Set(),sawPickup=new Set();
for(let tick=0;tick<1800;tick++){
 const previous=new Map(stockVillage.buildings.map(b=>[b.id,b.out]));stockVillage.tick(.1);
 for(const b of stockVillage.buildings){
  const p=productionVisualState(b.type,b,stockVillage);if(!p)continue;
  assert.equal(p.count,b.out);assert.equal(p.ready,b.out>0);
  if(b.out>0)sawOutput.add(b.type);
  if(b.out<previous.get(b.id))sawPickup.add(b.type);
 }
}
for(const type of ['well','lumber','sawmill','field']){assert.ok(sawOutput.has(type),type+' produced');assert.ok(sawPickup.has(type),type+' collected');}
assert.equal(oakFrame({ nature: 'sapling', growAt: 200 }, 50), 5);
assert.equal(oakFrame({ nature: 'sapling', growAt: 200 }, 150), 6);
assert.equal(oakFrame({ nature: null }, 20), 4);
assert.equal(oakFrame({ nature: 'tree' }, .2, true), 3);
assert.equal(waterFrame(0), 0);
assert.equal(waterFrame(.4), 1);
assert.equal(waterFrame(1.4), 0);

const mill = makePixelSawmill('human');
mill.userData.animate(.21, active);
assert.equal(mill.userData.frame, 0);
mill.userData.animate(.41, { working: false });
assert.equal(mill.userData.frame, 0);
assert.equal(mill.children[0].isSprite, true);
for(let view=0;view<4;view++){
 mill.userData.animate(.21,active,null,view);
 assert.equal(mill.userData.direction,view);
 assert.equal(mill.userData.texture.offset.y,(3-view)/4);
 assert.equal(mill.userData.texture.repeat.y,.25);
}
const tree = makePixelTree();
const anchor = tree.userData.sprite.center.toArray();
for (const tile of [{ nature: 'tree' }, { nature: null }, { nature: 'sapling', growAt: 200 }]) {
 tree.userData.animate(100, tile);
 assert.deepEqual(tree.userData.sprite.center.toArray(), anchor);
}
const water = makePixelWater(3);
water.userData.animate(.4);
assert.equal(water.userData.texture.offset.x, .25);
for (const type of PIXEL_BUILDINGS) {
 const model = makePixelBuilding(type, 'human');
 for (let view = 0; view < 4; view++) {
  model.userData.animate(.41, active, null, view);
  assert.equal(model.userData.direction, view, type);
  assert.equal(model.userData.texture.offset.y, (3 - view) / 4, type);
 }
}
assert.equal(makePixelBuilding('nonexistent', 'human'), null);

// Runtime dimensions must match UV addressing, not silently sample another cell.
for (const [id, asset] of Object.entries(ENVIRONMENT_ASSETS)) {
 const png = await readFile(new URL('../public' + asset.sheet, import.meta.url));
 assert.equal(png.subarray(1, 4).toString(), 'PNG');
 assert.equal(png.readUInt32BE(16), ENVIRONMENT_CELL * asset.frames, id);
 assert.equal(png.readUInt32BE(20), ENVIRONMENT_CELL * (asset.directions || 1), id);
 assert.equal(png[25], 6, `${id} must retain RGBA`);
}
// Art does not introduce a terrain/save type or change paid replanting.
const sim = new Simulation();
const tile = sim.tiles.find(t => sim.ownedAt(t.x,t.z) && !sim.at(t.x,t.z) && t.terrain !== 'water' && !t.nature && !sim.roads.has(`${t.x},${t.z}`));
sim.money = 1000;sim.stock.water = 20;
assert.equal(sim.plant(tile.x, tile.z).ok, true);
const before = JSON.stringify(sim.save());
tree.userData.animate(sim.time, tile, false);
assert.equal(tree.userData.frame, 5);
assert.equal(JSON.stringify(sim.save()), before, 'rendering must not mutate the save');
assert.equal(sim.money, 985);
assert.equal(sim.stock.water, 18);
// The start-screen fixture must function in every offered nation, using the
// real simulation and the existing save format, without changing normal starts.
assert.equal(new Campaign().active.buildings.length, 0);
for (const [nation, data] of Object.entries(NATIONS).filter(([, n]) => n.playable)) {
 const campaign = new Campaign({ nation, race: data.race, starter: true }), village = campaign.active;
 assert.equal(village.buildings.length, 9, nation);
 assert.equal(village.workers.length, 6, nation);
 for (let tick = 0; tick < 1200; tick++) campaign.tick(.1);
 for (const resource of ['grain', 'water', 'wood', 'plank']) assert.ok(village.produced[resource] > 0, `${nation}: ${resource}`);
 assert.ok(village.logisticsStats.delivered > 0, `${nation}: hauling`);
 const restored = new Campaign({ saved: decodeSave(JSON.stringify(campaign.save())) });
 assert.deepEqual(restored.active.produced, village.produced, nation);
 assert.equal(restored.active.buildings.length, 9, nation);
}
console.log('Pixel environment: six building states / four views / harvest / growth / PNG layout / starter production and saves in all playable nations passed.');
