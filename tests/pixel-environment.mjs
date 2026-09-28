import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ENVIRONMENT_ASSETS, ENVIRONMENT_CELL, PIXEL_BUILDINGS, pixelBuildingFrame, sawmillFrame, oakFrame, waterFrame } from '../src/app/game/pixel-environment-data.js';
import { makePixelBuilding, makePixelSawmill, makePixelTree, makePixelWater } from '../src/app/game/pixel-environment.js';
import { Simulation } from '../src/app/game/simulation.js';
import { Campaign } from '../src/app/game/campaign.js';
import { NATIONS } from '../src/app/game/world.js';
import { decodeSave } from '../src/app/game/persistence.js';

// Production status must govern the art, including repairs, pauses and shortages.
for (const building of [{ working: false }, { working: true, enabled: false }, { working: true, health: 0 }]) {
 assert.equal(sawmillFrame(building, 12), 0);
}
const active = { working: true, enabled: true, health: 100 };
assert.deepEqual([0, .21, .41, .61].map(t => sawmillFrame(active, t)), [1, 2, 3, 2]);
assert.equal(sawmillFrame({ ...active, animationTime: .21 }, 99), 2);
for (const type of ['well', 'lumber']) {
 assert.deepEqual([0, .41, .81, 1.21].map(t => pixelBuildingFrame(type, active, t)), [1, 2, 3, 2]);
 for (const b of [{ working: false }, { ...active, enabled: false }, { ...active, health: 0 }]) assert.equal(pixelBuildingFrame(type, b, 2), 0);
 assert.equal(pixelBuildingFrame(type, { ...active, animationTime: .41 }, 99), 2);
}
assert.deepEqual([0, .26, .51, .76, 1].map(progress => pixelBuildingFrame('field', { progress, enabled: false }, 99)), [0, 1, 2, 3, 3]);
assert.equal(pixelBuildingFrame('house', { id: 2 }, 1, { workers: [] }), 0);
assert.equal(pixelBuildingFrame('house', { id: 2 }, 1, { workers: [{ homeId: 2 }] }), 3);
const warehouse = { x: 10, z: 10 };
const handler = { x: 10, z: 11, handling: 'drop', phase: 'destination', task: { sourceId: 3, targetId: null } };
assert.equal(pixelBuildingFrame('warehouse', warehouse, .26, { workers: [handler] }), 2);
assert.equal(pixelBuildingFrame('warehouse', warehouse, .26, { workers: [{ ...handler, handling: null }] }), 0);
assert.equal(pixelBuildingFrame('warehouse', warehouse, .26, { workers: [{ ...handler, x: 20 }] }), 0);
assert.equal(pixelBuildingFrame('warehouse', warehouse, .26, { workers: [{ ...handler, task: { sourceId: null, targetId: 3 } }] }), 0);
assert.equal(oakFrame({ nature: 'sapling', growAt: 200 }, 50), 5);
assert.equal(oakFrame({ nature: 'sapling', growAt: 200 }, 150), 6);
assert.equal(oakFrame({ nature: null }, 20), 4);
assert.equal(oakFrame({ nature: 'tree' }, .2, true), 3);
assert.equal(waterFrame(0), 0);
assert.equal(waterFrame(.4), 1);
assert.equal(waterFrame(1.4), 0);

const mill = makePixelSawmill('human');
mill.userData.animate(.21, active);
assert.equal(mill.userData.frame, 2);
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
assert.equal(makePixelBuilding('bakery', 'human'), null);

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
