import assert from 'node:assert/strict';
import { advanceCharacterRoute, characterDistance } from '../app/game/character-movement.js';
import { createPixelCharacter, animatePixelCharacter } from '../app/game/pixel-characters.js';
import { moveWorkers } from '../app/game/logistics.js';

const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} != ${expected}`);
const actor = route => ({ x: 0, z: 0, dir: 0, route: structuredClone(route), race: 'human' });
const turn = [{ x: 1, z: 0 }, { x: 1, z: 1 }, { x: 2, z: 1 }];

// One tick crosses a corner without discarding distance or cutting diagonally.
const corner = actor(turn);
close(advanceCharacterRoute(corner, .6, 2.5), 1.5, 'corner distance');
close(corner.x, 1, 'corner x'); close(corner.z, .5, 'corner z');
close(characterDistance(corner), 1.5, 'arc length used by gait');
close(advanceCharacterRoute(corner, 10, 2.5), 1.5, 'stop exactly at route end');
assert.deepEqual([corner.x, corner.z, corner.route.length], [2, 1, 0]);
advanceCharacterRoute(corner, .1, 2.5);
assert.equal(corner.walking, false);

// Duplicate nodes must not consume a tick; a newly blocked later node must stop us.
const blocked = actor([{ x: 0, z: 0 }, ...turn]);
advanceCharacterRoute(blocked, 2, 3, (x, z) => z === 0);
assert.deepEqual([blocked.x, blocked.z, blocked.route.length], [1, 0, 2]);
const paused = JSON.stringify(blocked);
advanceCharacterRoute(blocked, 0, 3);
assert.equal(blocked.x, 1); assert.equal(blocked.z, 0);
assert.equal(characterDistance(blocked), 1);
assert.equal(JSON.parse(paused).route.length, blocked.route.length);

const route = Array.from({ length: 100 }, (_, i) => ({ x: Math.ceil((i + 1) / 2), z: Math.floor((i + 1) / 2) }));
function oldStep(w, dt, speed) {
 const p = w.route[0]; if (!p) return 0;
 const dx = p.x - w.x, dz = p.z - w.z, d = Math.hypot(dx, dz), step = Math.min(d, dt * speed);
 if (d > .001) { w.x += dx / d * step; w.z += dz / d * step; }
 if (d <= step + .01) w.route.shift();
 return d > .001 ? step : 0;
}
const comparisons = [];
for (const fps of [20, 30, 60, 144]) {
 const current = actor(route), previous = actor(route);
 let oldDistance = 0;
 for (let i = 0; i < fps * 10; i++) {
  advanceCharacterRoute(current, 1 / fps, 2.37);
  oldDistance += oldStep(previous, 1 / fps, 2.37);
 }
 close(characterDistance(current), 23.7, `${fps}fps full movement budget`);
 close(current.x, 12, `${fps}fps final x`); close(current.z, 11.7, `${fps}fps final z`);
 comparisons.push({ fps, oldDistance: Number(oldDistance.toFixed(6)), distance: Number(characterDistance(current).toFixed(6)), oldLossPercent: Number((100 * (1 - oldDistance / 23.7)).toFixed(3)) });
}

// Exercise the actual logistics caller, not only its movement helper.
const carrier = { ...actor(turn), task: { carried: true, item: 'wood', amount: 3 }, phase: 'destination', stepDistance: .4 };
const simulation = { workers: [carrier], warehouse: { x: 2, z: 2, health: 100 }, buildings: [], roads: new Set(), time: 1, strikeUntil: 0, money: 100, walkable: () => true, sound: () => {} };
moveWorkers(simulation, 1);
close(carrier.x, 1, 'logistics reaches corner'); close(carrier.z, .25, 'logistics spends remainder');
assert.equal(carrier.task.amount, 3); assert.equal(carrier.task.carried, true);
assert.ok(carrier.stepDistance < .42, 'footstep accumulator preserves fractional remainder');

// World sprites advance by distance, not by elapsedTime * latestSpeed.
const walker = actor([{ x: 100, z: 0 }]);
const model = createPixelCharacter(0, 'human', 'mira');
animatePixelCharacter(model, walker, 0);
advanceCharacterRoute(walker, .31, 1.25);
animatePixelCharacter(model, walker, .31);
const frame = model.userData.frame, gait = model.userData.gaitDistance;
walker.moveSpeed = 4;
animatePixelCharacter(model, walker, .31);
assert.equal(model.userData.frame, frame, 'changing speed without moving cannot skip a frame');
assert.equal(model.userData.gaitDistance, gait);
animatePixelCharacter(model, walker, 100);
assert.equal(model.userData.frame, frame, 'no movement means no gait advancement');
advanceCharacterRoute(walker, .1, 4);
animatePixelCharacter(model, walker, 100.1);
close(model.userData.gaitDistance, gait + .4, 'new speed advances only new distance');
const rebuilt = createPixelCharacter(0, 'human', 'mira');
animatePixelCharacter(rebuilt, walker, 100.1);
assert.equal(rebuilt.userData.frame, model.userData.frame, 'rebuilding scene models preserves the walking phase');
close(rebuilt.userData.gaitDistance, model.userData.gaitDistance, 'rebuilt gait distance');
assert.equal(Object.hasOwn(walker, 'gaitDistance'), false, 'animation phase does not enter save data');
model.userData.sprite.material.map.dispose(); model.userData.sprite.material.dispose();
rebuilt.userData.sprite.material.map.dispose(); rebuilt.userData.sprite.material.dispose();
console.log(JSON.stringify({ result: 'CHARACTER MOVEMENT PASS', comparisons, cornerTraversal: true, blockedNodes: true, logistics: true, speedChangeWithoutPhaseJump: true }, null, 2));
