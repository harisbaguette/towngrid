import { createPixelCharacter, animatePixelCharacter, loadPixelCharacters } from './pixel-characters.js';
import { loadPixelEnvironment } from './pixel-environment.js';

// Only the pixel packs are used by the game. Legacy GLBs remain archived on disk.
export const assetStatus = { loaded: 0, failed: [] };
const loadedPacks = new Set();
async function loadPack(key, load) {
 try {
  await load();
  loadedPacks.add(key);
  assetStatus.loaded = loadedPacks.size;
  assetStatus.failed = assetStatus.failed.filter(id => id !== key);
 } catch {
  if (!assetStatus.failed.includes(key)) assetStatus.failed.push(key);
 }
}
export async function loadAssets(race = 'human') {
 await Promise.all([
  loadPack('pixel/environment', loadPixelEnvironment),
  loadPack('pixel/' + race, () => loadPixelCharacters(race)),
 ]);
}
export function character(index, race = 'human', appearance) { return createPixelCharacter(index, race, appearance); }
export function animateCharacter(group, worker, time, camera) { return animatePixelCharacter(group, worker, time, camera); }
