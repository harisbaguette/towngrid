import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { pixelDirection, pixelAction, pixelFrame, pixelRoster, pixelAtlasFrame, PIXEL_DIRECTIONS, PIXEL_ENEMIES } from '../app/game/pixel-character-data.js';
import { RESIDENT_LOOKS } from '../app/game/resident-roster.js';
import * as THREE from 'three';
import { createPixelCharacter, animatePixelCharacter } from '../app/game/pixel-characters.js';
import { pixelMetadata } from '../app/game/pixel-character-meta.js';
import { SoftwareRenderer } from '../app/game/software-renderer.js';

// Cardinal headings must stay correct while the user rotates the world camera.
for (let camera = 0; camera < 4; camera++) {
 for (let facing = 0; facing < 4; facing++) {
  assert.equal(pixelDirection(facing * Math.PI / 2, Math.PI / 4 + camera * Math.PI / 2), (camera - facing + 4) % 4);
 }
}
for (let heading = -Math.PI * 2; heading < Math.PI * 2; heading += .03) {
 const index = pixelDirection(heading, Math.PI / 4);
 assert.ok(index >= 0 && index < 4 && Number.isInteger(index), 'combat headings use four facings');
}
// Legacy eight-row data must select authored diagonals, never a wrong crop.
for (let direction = 0; direction < 4; direction++) {
 const legacy = pixelAtlasFrame(direction, 0);
 assert.equal(legacy.row, [1, 3, 5, 7][direction]);
 assert.equal(legacy.rows, 8);
}
assert.equal(pixelAction({ walking: true, phase: 'destination', task: { carried: true } }), 'carry');
assert.equal(pixelAction({ walking: true, phase: 'source', task: { carried: false } }), 'walk');
assert.equal(pixelAction({ walking: false, handling: 'drop' }), 'drop');
assert.equal(pixelAction({ attacking: true, hp: 0 }), 'defeat');
assert.equal(pixelAction({ attacking: true, hp: 10 }), 'attack');
assert.deepEqual([0, .125, .25, .375].map(t => pixelFrame('walk', t)), [1, 2, 3, 2]);
assert.equal(pixelFrame('drop', 10), 0);
const races = [...Object.keys(RESIDENT_LOOKS), ...Object.keys(PIXEL_ENEMIES)];
const identities = races.flatMap(pixelRoster);
assert.equal(identities.length, 24);
for (const identity of identities) {
 for (const file of [identity.portrait, identity.sheet]) assert.ok(existsSync(`public${file}`), `${identity.id}: missing ${file}`);
 const png = readFileSync(`public${identity.sheet}`);
 assert.equal(png.readUInt32BE(16), 1024, `${identity.id}: atlas width`);
 assert.equal(png.readUInt32BE(20), 512, `${identity.id}: atlas height`);
 assert.equal(png[25], 6, `${identity.id}: RGBA atlas required`);
 const meta = JSON.parse(readFileSync(`public/assets/pixel-characters/${identity.id}/frames.json`));
 pixelMetadata.set(identity.id, meta);
 assert.equal(meta.frames, 32);
 assert.deepEqual(meta.directions, PIXEL_DIRECTIONS);
 assert.equal(meta.anchors.length, 4);
 for (let direction = 0; direction < 4; direction++) for (let frame = 0; frame < 8; frame++) {
  const selected = pixelAtlasFrame(direction, frame, meta);
  assert.equal(selected.row, direction);
  assert.equal(selected.rows, 4);
  assert.deepEqual(selected.anchor, meta.anchors[direction][frame]);
 }
 for (const row of meta.anchors) {
  assert.equal(row.length, 8);
  for (const [x, y] of row) assert.ok(x >= 0 && x <= 1 && y > 0 && y <= 1, `${identity.id}: invalid foot anchor`);
 }
}
// Exercise the actual WebGL texture addressing and CPU crop path together.
const camera = new THREE.OrthographicCamera(-8, 8, 8, -8, .1, 120);
const group = createPixelCharacter(0, 'human', 'mira');
group.userData.image = { width: 1024, height: 512 };
let crop;
const ctx = { save(){}, restore(){}, beginPath(){}, ellipse(){}, fill(){}, translate(){}, rotate(){}, drawImage(...args){crop=args.slice(1,5);} };
for (let view = 0; view < 4; view++) {
 const azimuth = Math.PI / 4 + view * Math.PI / 2;
 camera.position.set(20 * Math.sin(azimuth), 20, 20 * Math.cos(azimuth));camera.lookAt(0,0,0);camera.updateMatrixWorld();
 for (let heading = 0; heading < 4; heading++) {
  const worker = { id: 0, x: 3, z: 4, dir: heading * Math.PI / 2, walking: true };
  animatePixelCharacter(group, worker, .2 + view + heading, camera);
  const u = group.userData;
  assert.equal(u.direction, (view - heading + 4) % 4);
  assert.deepEqual(u.texture.repeat.toArray(), [1/8, 1/4]);
  assert.deepEqual(u.texture.offset.toArray(), [u.frame/8, (3-u.direction)/4]);
  assert.equal(u.sprite.center.x, pixelMetadata.get('mira').anchors[u.direction][u.frame][0]);
  SoftwareRenderer.prototype.drawPixelCharacter.call({ctx,pixelsPerWorldUnit:100},group,{x:100,y:200});
  assert.deepEqual(crop,[u.frame*128,u.direction*128,128,128]);
 }
}
console.log('24 character identities, 4 camera/character facings, transport/attack actions and 768 atlas cells verified.');
