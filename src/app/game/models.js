import * as THREE from 'three';
import { BUILDINGS } from './simulation.js';
import { character, animateCharacter } from './assets.js';
import { makePixelBuilding, makePixelTree, makePixelProp, makePixelVehicle } from './pixel-environment.js';
import { makePixelNetwork } from './pixel-terrain.js';

export function makeBuilding(type, race = 'human') {
 if (BUILDINGS[type]?.tile) return makePixelNetwork(type);
 const building = makePixelBuilding(type, race);
 if (!building) throw new Error(`Missing pixel building: ${type}`);
 return building;
}
// Runtime path: one facility without art (e.g. added to BUILDINGS before its sheet) shows a plain crate marker and
// logs once, instead of stopping the whole game. makeBuilding stays strict so tests still catch the gap.
const missingArt = new Set();
export function makeBuildingSafe(type, race = 'human') {
 try { return makeBuilding(type, race); } catch (error) {
  if (!missingArt.has(type)) { missingArt.add(type); console.error(`[TownGrid] building art unavailable for "${type}", showing a marker.`, error); }
  const group = new THREE.Group();
  const crate = new THREE.Mesh(new THREE.BoxGeometry(.72, .46, .72), new THREE.MeshLambertMaterial({ color: '#9c7a52' }));
  const band = new THREE.Mesh(new THREE.BoxGeometry(.76, .08, .76), new THREE.MeshLambertMaterial({ color: '#e2b04f' }));
  crate.position.y = .23; band.position.y = .34; crate.castShadow = true;
  group.add(crate, band); group.name = type; group.userData.buildingType = type; group.userData.missingArt = true;
  return group;
 }
}
export function makeTree(kind = 0, scale = 1) { return makePixelTree(kind, scale); }
export function makeRock(scale = 1, kind = 'rock') { return makePixelProp(kind, scale); }
export function makeWorker(index = 0, race = 'human', appearance) { return character(index, race, appearance); }
export function animateWorker(group, worker, time, camera, groundHeight) { animateCharacter(group, worker, time, camera, groundHeight); }
// The west-edge gate spans z while the export road runs along x.
export function makeExportGate() {
 const gate = makePixelProp('exportGate');
 gate.name = 'export-gate';gate.userData.oriented = true;gate.rotation.y = Math.PI / 2;
 return gate;
}
export function makeFreightVehicle(mode = 'truck', item = 'steel') {
 const vehicle = makePixelVehicle(mode, item);vehicle.name = 'freight-' + mode;return vehicle;
}
