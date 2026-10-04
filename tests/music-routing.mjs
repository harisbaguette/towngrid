import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {SCREEN_MUSIC,NATION_MUSIC,BIOME_MUSIC,MUSIC,musicSelection,locationMusic} from '../src/app/game/soundscape.js';
import {MUSIC_CATALOG} from '../src/app/game/music-catalog.js';
import {musicLocation,musicNation} from '../src/app/game/audio-geography.js';
import {WORLD_REALMS} from '../src/app/game/world-politics.js';
import {BIOMES} from '../src/app/game/biome-data.js';
import {WORLD_PLOTS,territoryOf} from '../src/app/game/territory.js';
import {layoutOf} from '../src/app/game/world-grid.js';
import {worldOrigin} from '../src/app/game/world-space.js';

// Prevent a future menu from silently falling back to the old town playlist.
const game=fs.readFileSync('src/app/game/Game.tsx','utf8');
const dialogs=new Set([...game.matchAll(/(?:setDialog\(|view===)'([\w-]+)'/g)].map(m=>m[1]));
for(const dialog of dialogs){const selection=musicSelection({front:'home',dialog});assert.ok(SCREEN_MUSIC[dialog==='world'?'diplomacy':dialog],dialog+' has an explicit score');assert.equal(selection.tracks.length,1);}
assert.deepEqual(Object.keys(NATION_MUSIC).sort(),Object.keys(WORLD_REALMS).sort());
assert.deepEqual(Object.keys(BIOME_MUSIC).sort(),Object.keys(BIOMES).sort());
assert.equal(MUSIC.length,51);
assert.equal(new Set([...Object.values(SCREEN_MUSIC),...Object.values(NATION_MUSIC),...Object.values(BIOME_MUSIC)].map(v=>v.track)).size,51,'every screen, country and biome has a different recording');
const sources=JSON.parse(fs.readFileSync('public/assets/audio/music-sources.json','utf8'));
const hashes=new Set();
for(const track of MUSIC){
 assert.ok(MUSIC_CATALOG[track]);assert.ok(MUSIC_CATALOG[track].seconds>15);
 const credit=sources.find(v=>v.file===track+'.ogg');assert.ok(credit?.license_url&&credit?.author&&credit?.source);
 assert.ok(!hashes.has(credit.original_sha256),'no duplicate recordings under different names: '+track);hashes.add(credit.original_sha256);
 for(const ext of ['ogg','mp3']){const entry=sources.find(v=>v.file===track+'.'+ext),bytes=fs.readFileSync(entry.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);}
}
for(const nation of Object.keys(WORLD_REALMS))for(const ecology of Object.keys(BIOMES)){
 const s=locationMusic({nation,ecology});assert.equal(s.tracks[0],BIOME_MUSIC[ecology].track);assert.equal(s.tracks[1],NATION_MUSIC[nation].track);
 assert.equal(locationMusic({nation,ecology,entry:'nation'}).tracks[0],NATION_MUSIC[nation].track);
}
// Start screen, dialog precedence, map scale and real country ownership.
assert.equal(musicSelection({front:'title'}).tracks[0],'score-title');
assert.equal(musicSelection({front:'home'}).tracks[0],'music-morning');
assert.equal(musicSelection({front:'home',dialog:'settings'}).tracks[0],'score-settings');
assert.equal(musicSelection({front:'game',raid:true,location:{nation:'estern',ecology:'meadow'}}).scene,'danger');
assert.equal(musicSelection({loading:true,dialog:'settings'}).scene,'loading');
const base=WORLD_PLOTS.find(p=>p.nation==='estern'),sim={provinceId:base.id,layout:layoutOf(base.id),nation:'estern',campaign:{provinces:{},newStates:[]}},[ox,oz]=worldOrigin(sim);
for(const nation of Object.keys(WORLD_REALMS)){
 const plot=WORLD_PLOTS.find(p=>p.nation===nation),camera={x:plot.cell[0]*24+11.5-ox,z:plot.cell[1]*24+11.5-oz};
 const l=musicLocation(sim,camera,{span:620});assert.equal(l.nation,nation);assert.equal(l.country,true);assert.equal(l.world,false);
 assert.equal(musicLocation(sim,camera,{span:1500}).world,true);
}
const vacant=WORLD_PLOTS.find(p=>p.nation===null),camera={x:vacant.cell[0]*24+11.5-ox,z:vacant.cell[1]*24+11.5-oz};
assert.equal(musicLocation(sim,camera,{span:55}).nation,null,'frontier citizenship does not annex wilderness music');
sim.campaign.provinces[territoryOf(base.id)]={owner:'new-1'};sim.campaign.newStates.push({id:'new-1',rootNation:'arsel'});
assert.equal(musicLocation(sim,{x:11.5,z:11.5},{span:55}).nation,'arsel','successor state follows its musical origin');
assert.equal(musicNation(null,sim.campaign),null);
console.log('PASS 51 unique licensed scores, all dialogs, 14 countries, 8 biomes, 112 geographic playlists, camera ownership and successor/wilderness compatibility');
