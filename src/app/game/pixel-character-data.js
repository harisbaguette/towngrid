import { RESIDENT_LOOKS, residentLook } from './resident-roster.js';

// One identity is shared by its illustration, UI sprite, and world sprite.
export const PIXEL_DIRECTIONS = ['SW', 'NW', 'NE', 'SE'];
const LEGACY_DIRECTIONS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'];
export const PIXEL_ENEMIES = {
 demon: { id: 'ravik', name: '라비크', gender: 'male' },
 orc: { id: 'grum', name: '그룸', gender: 'male' },
 goblin: { id: 'niki', name: '니키', gender: 'female' },
 beast: { id: 'sora', name: '소라', gender: 'female' },
 dragon: { id: 'kael', name: '카엘', gender: 'male' },
 aquatic: { id: 'neris', name: '네리스', gender: 'female' },
};
export const PIXEL_CELL = 128;
export const PIXEL_BASELINE = 116 / PIXEL_CELL;
export const PIXEL_CLIPS = {
 idle: { frames: [0], fps: 1 },
 walk: { frames: [1, 2, 3, 2], fps: 8 },
 carry: { frames: [4, 5], fps: 6 },
 work: { frames: [6, 6, 7, 7], fps: 6 },
 attack: { frames: [0, 6, 7, 7], fps: 7 },
 pickup: { frames: [0, 6, 7, 4], fps: 7, once: true },
 drop: { frames: [4, 7, 6, 0], fps: 7, once: true },
 defeat: { frames: [0], fps: 1, once: true },
};
export const PIXEL_HEIGHT = { human: 1.05, dwarf: .84, titan: 1.28, elf: 1.12, spirit: .9, centaur: 1.18, fae: .82, demon: 1.18, orc: 1.15, goblin: .8, beast: 1.08, dragon: 1.2, aquatic: 1.1 };
export function pixelIdentity(race = 'human', index = 0, appearance) {
 const look = residentLook(race, index, appearance) || PIXEL_ENEMIES[race] || residentLook('human', index);
 return { ...look, race, portrait: `/assets/pixel-characters/${look.id}/portrait.png`, sheet: `/assets/pixel-characters/${look.id}/sprites.png` };
}
export function pixelRoster(race) {
 const list = RESIDENT_LOOKS[race] || (PIXEL_ENEMIES[race] ? [PIXEL_ENEMIES[race]] : []);
 return list.map((look, index) => pixelIdentity(race, index, look.id));
}
export function pixelDirection(heading = 0, cameraAzimuth = Math.PI / 4) {
 // Four diagonal views relative to the quarter-view camera. Arbitrary combat
 // headings also select one of these four, without additional artwork.
 return ((Math.round((cameraAzimuth - heading - Math.PI / 4) / (Math.PI / 2)) % 4) + 4) % 4;
}
export function pixelAtlasFrame(direction, frame, metadata) {
 // Eight-row originals remain readable; newly packed atlases need four rows.
 const directions = metadata?.directions || LEGACY_DIRECTIONS;
 const facing = PIXEL_DIRECTIONS[((direction % 4) + 4) % 4];
 const row = Math.max(0, directions.indexOf(facing));
 return { row, rows: directions.length, columns: metadata?.columns?.length || 8, anchor: metadata?.anchors?.[row]?.[frame] || [.5, PIXEL_BASELINE] };
}
export function pixelAction(worker) {
 if (worker.hp !== undefined && worker.hp <= 0) return 'defeat';
 if (worker.attacking) return 'attack';
 if (worker.handling) return worker.handling === 'pickup' ? 'pickup' : 'drop';
 if (worker.walking) return worker.task?.carried || worker.phase === 'destination' ? 'carry' : 'walk';
 if (worker.working) return 'work';
 return 'idle';
}
export function pixelClip(action, metadata) {
 return metadata?.clips?.[action] || PIXEL_CLIPS[action] || PIXEL_CLIPS.idle;
}
export function pixelFrame(action, time, speed = 1, metadata) {
 const clip = pixelClip(action, metadata);
 const step = Math.max(0, Math.floor(time * clip.fps * speed));
 return clip.frames[clip.once ? Math.min(step, clip.frames.length - 1) : step % clip.frames.length];
}
