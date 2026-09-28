import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createArtworkPicker, WORK_ART, SCREEN_ART_KEY, SCREEN_BACKGROUNDS } from '../app/game/screen-art.js';

const memory = new Map([['existing-game-save', 'untouched']]);
const storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) };
let pick = createArtworkPicker(storage, () => 0.5), sequence = [];
for (let i = 0; i < 60; i++) {
  if (i % 4 === 0) pick = createArtworkPicker(storage, () => 0.5); // A page refresh continues the deck.
  sequence.push(pick().id);
}
for (let i = 0; i < sequence.length; i += WORK_ART.length) assert.equal(new Set(sequence.slice(i, i + WORK_ART.length)).size, WORK_ART.length);
for (let i = 1; i < sequence.length; i++) assert.notEqual(sequence[i], sequence[i - 1], 'No repeat across deck boundaries or refreshes');
assert.equal(memory.get('existing-game-save'), 'untouched');
assert.deepEqual([...memory.keys()].sort(), ['existing-game-save', SCREEN_ART_KEY].sort());
for (const broken of ['not-json', '{}', '{"queue":["unknown"],"last":null}', '{"queue":["mira","mira"],"last":"mira"}']) {
  memory.set(SCREEN_ART_KEY, broken);
  const recover = createArtworkPicker(storage);
  assert.equal(new Set(Array.from({ length: WORK_ART.length }, () => recover().id)).size, WORK_ART.length);
}
const unavailable = createArtworkPicker({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } }, () => 0);
assert.equal(new Set(Array.from({ length: WORK_ART.length }, () => unavailable().id)).size, WORK_ART.length);
for (const source of [...Object.values(SCREEN_BACKGROUNDS), ...WORK_ART.map(art => art.src)]) {
  const file = new URL('../public' + source, import.meta.url), data = await readFile(file);
  assert.equal(data.toString('ascii', 0, 4), 'RIFF');
  assert.equal(data.toString('ascii', 8, 12), 'WEBP');
  assert.ok((await stat(file)).size < 900000, 'Runtime illustration should stay under 900KB');
}
console.log('Screen artwork: no-repeat decks, reload persistence, unavailable/corrupt storage and 9 runtime assets verified.');
