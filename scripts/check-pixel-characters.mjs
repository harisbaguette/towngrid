import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { pixelDirection, pixelAction, pixelFrame, pixelRoster, pixelAtlasFrame, PIXEL_DIRECTIONS, PIXEL_ENEMIES } from '../src/app/game/pixel-character-data.js';
import { RESIDENT_LOOKS } from '../src/app/game/resident-roster.js';
import * as THREE from 'three';
import { createPixelCharacter, animatePixelCharacter } from '../src/app/game/pixel-characters.js';
import { pixelMetadata } from '../src/app/game/pixel-character-meta.js';
import { SoftwareRenderer } from '../src/app/game/software-renderer.js';
import { advanceCharacterRoute } from '../src/app/game/character-movement.js';

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
assert.equal(identities.length, 51);
for (const identity of identities) {
 for (const file of [identity.portrait, identity.sheet]) assert.ok(existsSync(`public${file}`), `${identity.id}: missing ${file}`);
 const png = readFileSync(`public${identity.sheet}`);
 const meta = JSON.parse(readFileSync(`public/assets/pixel-characters/${identity.id}/frames.json`));
 assert.equal(meta.rigFinish, 'continuous-joints-1', `${identity.id}: repack the shared joint finish`);
 const columns = 64;
 assert.equal(meta.columns.length, columns);
 assert.equal(png.readUInt32BE(16), columns * 128, `${identity.id}: atlas width`);
 assert.equal(png.readUInt32BE(20), 512, `${identity.id}: atlas height`);
 assert.equal(png[25], 6, `${identity.id}: RGBA atlas required`);
 pixelMetadata.set(identity.id, meta);
 assert.equal(meta.frames, columns * 4);
 assert.deepEqual(meta.directions, PIXEL_DIRECTIONS);
 assert.equal(meta.anchors.length, 4);
 for (let direction = 0; direction < 4; direction++) for (let frame = 0; frame < columns; frame++) {
  const selected = pixelAtlasFrame(direction, frame, meta);
  assert.equal(selected.row, direction);
  assert.equal(selected.rows, 4);
  assert.deepEqual(selected.anchor, meta.anchors[direction][frame]);
 }
 for (const row of meta.anchors) {
  assert.equal(row.length, columns);
  for (const [x, y] of row) assert.ok(x >= 0 && x <= 1 && y > 0 && y <= 1, `${identity.id}: invalid foot anchor`);
 }
}
// Exercise the actual WebGL texture addressing and CPU crop path together.
const camera = new THREE.OrthographicCamera(-8, 8, 8, -8, .1, 120);
const group = createPixelCharacter(0, 'human', 'mira');
group.userData.image = { width: 8192, height: 512 };
let crop;
const ctx = { save(){}, restore(){}, beginPath(){}, ellipse(){}, fill(){}, translate(){}, rotate(){}, drawImage(...args){crop=args.slice(1,5);} };
for (let view = 0; view < 4; view++) {
 const azimuth = Math.PI / 4 + view * Math.PI / 2;
 camera.position.set(20 * Math.sin(azimuth), 20, 20 * Math.cos(azimuth));camera.lookAt(0,0,0);camera.updateMatrixWorld();
 for (let heading = 0; heading < 4; heading++) {
  group.userData.motionState={};
  const worker = { id: 0, x: 3, z: 4, dir: heading * Math.PI / 2, walking: true };
  animatePixelCharacter(group, worker, .2 + view + heading, camera);
  const u = group.userData;
  assert.equal(u.direction, (view - heading + 4) % 4);
  assert.deepEqual(u.texture.repeat.toArray(), [1/64, 1/4]);
  assert.deepEqual(u.texture.offset.toArray(), [u.frame/64, (3-u.direction)/4]);
  assert.equal(u.sprite.center.x, pixelMetadata.get('mira').anchors[u.direction][u.frame][0]);
  SoftwareRenderer.prototype.drawPixelCharacter.call({ctx,pixelsPerWorldUnit:100},group,{x:100,y:200});
  assert.deepEqual(crop,[u.frame*128,u.direction*128,128,128]);
 }
}
const mira = pixelMetadata.get('mira');
assert.deepEqual(Array.from({length:12},(_,i)=>pixelFrame('walk',i / 20 + .001,1,mira)),Array.from({length:12},(_,i)=>i+4));
assert.equal(pixelFrame('walk', .601, 1, mira), 4);
assert.equal(pixelFrame('carry', .2, 1, mira), 20);
assert.equal(pixelFrame('drop', 10, 1, mira), 0);
assert.equal(mira.legacyActions, undefined, 'no mixed legacy body');
assert.equal(mira.clips.walk.strideLength, mira.clips.carry.strideLength);
for (const clip of Object.values(mira.clips)) for (const frame of clip.frames) assert.ok(frame >= 0 && frame < 64);
for (const row of mira.rigAudit) {
 const walk = row.filter(f => f.action === 'walk');
 assert.equal(walk.length,12);
 assert.equal(walk[0].feet[0].travel,1);assert.ok(walk[6].feet[0].travel<-.8);
 assert.ok(walk[0].feet[1].travel<-.8);assert.equal(walk[6].feet[1].travel,1);
 assert.ok(walk.every(f => f.feet.some(p => p.contact && p.lift === 0)), 'always a planted support foot');
 assert.ok(walk.some(f => f.feet[0].lift > 0) && walk.some(f => f.feet[1].lift > 0));
 for(const frame of walk) for(const foot of frame.feet) {
  const [hip,knee,ankle]=foot.joints3d;
  const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
  assert.ok(Math.abs(distance(hip,knee)-mira.gait.thigh)<.00001,'thigh length cannot pump between poses');
  assert.ok(Math.abs(distance(knee,ankle)-mira.gait.shin)<.00001,'shin length cannot pump between poses');
  assert.equal(Math.abs(ankle[0]),mira.gait.footHalfWidth,'feet follow narrow parallel tracks');
 }
}
// A planted foot cancels the actor's translation, in the actual camera projection.
const stride=mira.clips.walk.strideLength, forward=[-Math.SQRT1_2,1/Math.sqrt(6)];
const cycle=mira.rigAudit[0].filter(f=>f.action==='walk');
for(let i=0;i<6;i++) for(let axis=0;axis<2;axis++) {
 const worldPixel=cycle[i].feet[0].ankle[axis]+i/12*stride*128/1.05*forward[axis];
 assert.ok(Math.abs(worldPixel-cycle[0].feet[0].ankle[axis])<.001,'stance foot stays planted as the actor moves');
}
group.userData.motionState={};
const paced={id:99,x:0,z:0,route:[{x:10,z:0}],race:'human'};
advanceCharacterRoute(paced,stride/4,1);
animatePixelCharacter(group,paced,50);
assert.equal(group.userData.frame,7,'quarter of a stride selects the fourth walking pose');
paced.task={carried:true};
animatePixelCharacter(group,paced,50);
assert.equal(group.userData.frame,19,'picking up cargo preserves left/right gait phase');
console.log('51 character identities, four facings, 256 cells each; alternating 12-frame walk/carry and foot contacts verified.');
