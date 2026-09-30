// Every facility in BUILDINGS must have pixel art on disk before it ships (B3), and the game must survive when one
// does not: the runtime builder shows a marker and logs once instead of throwing and blanking the whole game.
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { BUILDINGS } from '../src/app/game/simulation.js';
import { ENVIRONMENT_ASSETS } from '../src/app/game/pixel-environment-data.js';
import { makeBuilding, makeBuildingSafe } from '../src/app/game/models.js';

const missing = [];
for (const [type, def] of Object.entries(BUILDINGS)) {
  let model;
  try { model = makeBuilding(type, def.resident || 'human'); } catch (error) { missing.push(type + ': ' + error.message); continue; }
  const ids = new Set();
  model.traverse(node => { if (node.userData?.environmentId) ids.add(node.userData.environmentId); });
  if (!ids.size) missing.push(type + ': no pixel sprite in the model');
  for (const id of ids) {
    const sheet = ENVIRONMENT_ASSETS[id]?.sheet;
    if (!sheet) { missing.push(type + ': no sheet for ' + id); continue; }
    try { await access(new URL('../public' + sheet, import.meta.url)); } catch { missing.push(type + ': sheet file missing ' + sheet); }
  }
}
assert.deepEqual(missing, [], 'every BUILDINGS key needs authored pixel art on disk');

// Runtime fallback: no throw, a visible marker, one console.error per type.
const logged = [], original = console.error;
console.error = (...args) => logged.push(args.map(String).join(' '));
try {
  const a = makeBuildingSafe('audit-no-art'), b = makeBuildingSafe('audit-no-art');
  assert.ok(a.userData.missingArt && b.userData.missingArt, 'missing art becomes a marker');
  assert.equal(a.userData.buildingType, 'audit-no-art');
  assert.ok(a.children.length > 0, 'marker is visible geometry');
  assert.equal(logged.length, 1, 'logged once per type');
  assert.match(logged[0], /audit-no-art/);
  assert.ok(!makeBuildingSafe('warehouse').userData.missingArt, 'real art is untouched');
} finally { console.error = original; }
assert.throws(() => makeBuilding('audit-no-art'), /Missing pixel building/, 'the strict builder still refuses');
console.log(`Building art guard passed: ${Object.keys(BUILDINGS).length} facilities have pixel art on disk; missing art falls back to a marker.`);
