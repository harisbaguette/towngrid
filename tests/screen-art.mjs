import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createArtworkPicker, createHomeArtworkPicker, WORK_ART, TRANSITION_ART, SCREEN_ART_KEY, HOME_ART_KEY, HOME_ART_CHANCE, SCREEN_BACKGROUNDS, artworkThumbnail, transitionArtwork } from '../src/app/game/screen-art.js';
import { RESIDENT_LOOKS } from '../src/app/game/resident-roster.js';

const memory = new Map([['existing-game-save', 'untouched']]);
const storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) };
let pick = createArtworkPicker(storage, () => 0.5), sequence = [];
for (let i = 0; i < WORK_ART.length * 10; i++) {
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
// A six-image installation must immediately gain access to the expanded catalog.
memory.set(SCREEN_ART_KEY, JSON.stringify({ queue: ['mira', 'bron'], last: 'marna' }));
const upgraded = createArtworkPicker(storage, () => .5);
const peeked = upgraded.peek();
assert.equal(upgraded.peek(), peeked, 'Preload must not consume or reshuffle artwork');
assert.notEqual(peeked.id, 'marna');
assert.equal(upgraded().id, peeked.id);
assert.equal(new Set([peeked.id, ...Array.from({ length: WORK_ART.length - 1 }, () => upgraded().id)]).size, WORK_ART.length);
const loadingHistory = memory.get(SCREEN_ART_KEY);
assert.equal(createHomeArtworkPicker(storage, () => HOME_ART_CHANCE)(), null);
const homeSequence = Array.from({ length: WORK_ART.length * 2 }, () => createHomeArtworkPicker(storage, () => 0)().id);
for (let i = 1; i < homeSequence.length; i++) assert.notEqual(homeSequence[i], homeSequence[i - 1]);
for (let i = 0; i < homeSequence.length; i += WORK_ART.length) assert.equal(new Set(homeSequence.slice(i, i + WORK_ART.length)).size, WORK_ART.length);
assert.equal(memory.get(SCREEN_ART_KEY), loadingHistory, 'Home selection must not consume the loading deck');
assert.ok(memory.get(HOME_ART_KEY));
assert.equal(memory.get('existing-game-save'), 'untouched');
for (const [context, id] of Object.entries({ world: 'map-table', village: 'village-arrival', site: 'river-crossing', restore: 'records-room' })) assert.equal(transitionArtwork(context).id, id);
const known = new Set(Object.values(RESIDENT_LOOKS).flat().map(person => person.id));
const leads = WORK_ART.map(art => art.characters[0]);
assert.equal(new Set(leads).size, WORK_ART.length, 'Every daily scene features a different lead');
for (const art of WORK_ART) for (const id of art.characters) assert.ok(known.has(id), `${art.id}: existing character ${id}`);
const illustratedCast = new Set(WORK_ART.flatMap(art => art.characters));
assert.ok(illustratedCast.size >= WORK_ART.length);
const gallery = [...WORK_ART, ...TRANSITION_ART];
assert.equal(new Set(gallery.map(art => art.id)).size, gallery.length);
const manifest = JSON.parse(await readFile(new URL('../art-source/screen-concepts/2026-09-29/daily-expansion/manifest.json', import.meta.url), 'utf8'));
for (const item of manifest.images) {
  assert.deepEqual(gallery.find(art => art.id === item.id)?.characters, item.characters);
  assert.ok((await stat(new URL('../' + item.source, import.meta.url))).size > 0);
}
for (const source of [...Object.values(SCREEN_BACKGROUNDS), ...gallery.map(art => art.src), ...gallery.map(artworkThumbnail)]) {
  const file = new URL('../public' + source, import.meta.url), data = await readFile(file);
  assert.equal(data.toString('ascii', 0, 4), 'RIFF');
  assert.equal(data.toString('ascii', 8, 12), 'WEBP');
  assert.ok((await stat(file)).size < 900000, 'Runtime illustration should stay under 900KB');
}
console.log(`Screen artwork: ${WORK_ART.length} daily scenes / ${illustratedCast.size} existing cast / ${TRANSITION_ART.length} transitions; independent no-repeat decks, migration, source manifests and thumbnails verified.`);
