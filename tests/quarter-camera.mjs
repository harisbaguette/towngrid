import assert from 'node:assert/strict';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { configureQuarterControls, applyQuarterView, QUARTER_POLAR, QUARTER_TURN, QUARTER_DISTANCE, quarterAzimuth, normalizeQuarter } from '../app/game/quarter-camera.js';

const near = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-9, `${message}: ${a} != ${b}`);
const camera = new THREE.OrthographicCamera(-8, 8, 8, -8, .1, 120);
camera.position.set(20, 20, 20);
const controls = new OrbitControls(camera);
controls.target.set(12, 0, 10);
controls.enableDamping = true;
configureQuarterControls(controls);
camera.zoom = 1.7;
const origin = controls.target.clone();
const vectors = [];
for (let view = 0; view < 8; view++) {
 assert.equal(applyQuarterView(camera, controls, view), view % 4);
 const offset = camera.position.clone().sub(controls.target);
 near(offset.length(), QUARTER_DISTANCE, 'distance');
 near(controls.getPolarAngle(), QUARTER_POLAR, 'elevation');
 near(controls.getAzimuthalAngle(), quarterAzimuth(view), 'azimuth');
 near(controls.target.distanceTo(origin), 0, 'target must not change');
 near(camera.zoom, 1.7, 'zoom must not change');
 // Even an API-driven free orbit attempt is clamped; this also catches damping.
 controls.rotateLeft(.18);controls.rotateUp(.27);
 for (let i = 0; i < 15; i++) controls.update();
 near(controls.getPolarAngle(), QUARTER_POLAR, 'free pitch clamp');
 near(controls.getAzimuthalAngle(), quarterAzimuth(view), 'free orbit clamp');
 vectors.push(offset);
}
for(let i=0;i<4;i++)near(vectors[i].distanceTo(vectors[i+4]),0,'four turns return to origin');
for(let i=1;i<4;i++)near(new THREE.Vector2(vectors[i-1].x,vectors[i-1].z).angleTo(new THREE.Vector2(vectors[i].x,vectors[i].z)),QUARTER_TURN,'90-degree steps');
assert.equal(normalizeQuarter(-1), 3);
assert.equal(normalizeQuarter(4), 0);
assert.equal(controls.enableRotate, false);
assert.equal(controls.mouseButtons.RIGHT, THREE.MOUSE.PAN);
assert.equal(controls.touches.TWO, THREE.TOUCH.DOLLY_PAN);
console.log('Quarter camera: four views, fixed pitch, orbit lock, return to origin, target and zoom preservation passed.');
