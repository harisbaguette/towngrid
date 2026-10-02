import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { SCREEN_BACKGROUNDS, WORK_ART, TRANSITION_ART } from '../src/app/game/screen-art.js';
import { SCREEN_MOTION, motionId, sceneryRect } from '../src/app/game/screen-motion.js';
import { FRONT_AMBIENCE, FILES, SOUND_PROFILES, BACKGROUND_FILES } from '../src/app/game/audio.js';
const sources=[...Object.values(SCREEN_BACKGROUNDS),...WORK_ART.map(x=>x.src),...TRANSITION_ART.map(x=>x.src)];
for(const src of sources){
 const config=SCREEN_MOTION[motionId(src)];assert.ok(config,src+' has an authored motion configuration');assert.ok(FRONT_AMBIENCE[config.ambience]);
 for(const [x,y,w,h] of config.water||[])assert.ok(x>=0&&y>=0&&x+w<=1&&y+h<=1,'water stays inside art');
}
assert.deepEqual(sceneryRect(400,400,800,400,'cover','68% 50%'),{x:-272,y:0,w:800,h:400});
assert.deepEqual(sceneryRect(400,400,800,400,'contain','50% 50%'),{x:0,y:100,w:400,h:200});
const manifest=JSON.parse(readFileSync(new URL('../public/assets/audio/presentation-sounds.json',import.meta.url)));
const used=new Set([...Object.values(FILES),...BACKGROUND_FILES,...Object.values(SOUND_PROFILES).flatMap(p=>p.files)]);
for(const sound of manifest.files){
 assert.ok(used.has(sound.name),sound.name+' connected to runtime');assert.ok(sound.peak<=.76&&sound.rmsDb>-40,'audible without clipping');
 for(const ext of ['ogg','mp3'])assert.ok(existsSync(new URL('../public/assets/audio/'+sound.name+'.'+ext,import.meta.url)));
}
console.log(`PASS ${sources.length} scene motion/ambience configurations, cover/contain coordinates, ${manifest.files.length} original sounds and fallback files.`);
