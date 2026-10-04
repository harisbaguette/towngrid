import assert from 'node:assert/strict';
import {Simulation} from '../src/app/game/simulation.js';
import {BIOMES} from '../src/app/game/biome-data.js';
import {biomeSurface,biomeTree,biomeDecoration} from '../src/app/game/biome-terrain.js';
import {BIOME_EXAMPLES} from '../src/app/game/biome-preview.js';
import {layoutOf,waterAt,validLayout} from '../src/app/game/world-grid.js';
import {PROVINCES} from '../src/app/game/territory.js';
import {NATIONS} from '../src/app/game/world.js';
import {encodeSave,decodeSave} from '../src/app/game/persistence.js';
import {edgeScenery} from '../src/app/game/map-edges.js';

const playable=new Set(PROVINCES.filter(p=>!p.nation||NATIONS[p.nation].playable).map(p=>layoutOf(p.id).ecology));
assert.deepEqual([...playable].sort(),Object.keys(BIOMES).sort(),'All eight biomes must be reachable in playable countries');
const sims={};
for(const [id,province] of Object.entries(BIOME_EXAMPLES)){
 const s=sims[id]=new Simulation('river',null,{provinceId:province,seed:7}),profile=BIOMES[id];
 assert.equal(s.layout.ecology,id);assert.ok(validLayout(s.layout));
 for(const t of s.tiles){
  assert.equal(t.water,waterAt(s.layout,t.x,t.z));
  assert.ok(t.fertility>=profile.fertility[0]&&t.fertility<=(t.oasis?90:profile.fertility[1]));
  assert.ok(t.ore>=profile.ore[0]&&t.ore<=(t.ground==='mountain'?100:profile.ore[1]));
  if(t.water)assert.equal(t.nature,null);else assert.ok(Number.isInteger(biomeSurface(s.layout,t.x,t.z,t.ground)));
  if(t.nature==='tree')assert.equal(t.remaining,profile.wood);
 }
 for(let z=8;z<16;z++)for(let x=8;x<16;x++)assert.equal(s.tile(x,z).water,null,'Starting area stays dry');
 for(let x=0;x<8;x++)assert.equal(s.tile(x,11).water,null,'Export route stays dry');
 assert.deepEqual(s.tiles,new Simulation('river',null,{provinceId:province,seed:7}).tiles,'Deterministic resources');
 const natural=s.tiles.find(t=>t.nature);natural.remaining=11;
 const restored=new Simulation('river',decodeSave(encodeSave(s.save())));
 assert.deepEqual(restored.layout,s.layout);assert.deepEqual(restored.tiles,s.tiles,'Save restores resource fields and depletion');
 for(const p of edgeScenery(s.layout)){assert.equal(waterAt(s.layout,Math.round(p.x),Math.round(p.z)),null,'Scenery stays off water');if(['mountain','snowMountain','volcanicMountain'].includes(p.id))assert.ok(['mountain','ice'].includes(s.layout.edges[p.side]));}
}
const trees=s=>s.tiles.filter(t=>t.nature==='tree').length/s.tiles.filter(t=>!t.water).length;
assert.ok(trees(sims.forest)>trees(sims.meadow)*2.5);
assert.ok(sims.basin.tiles.filter(t=>t.nature==='rock').length>sims.meadow.tiles.filter(t=>t.nature==='rock').length*2);
assert.ok(sims.meadow.tileMultiplier('field',12,12)>sims.desert.tileMultiplier('field',12,12));
assert.ok(sims.volcanic.tiles.every(t=>t.mana>=75));
assert.equal(biomeTree(sims.snow.layout,sims.snow.tile(8,8)),'snowPine');
assert.equal(biomeSurface(sims.snow.layout,12,12),0);
const desert=sims.desert,oasis=desert.tiles.find(t=>t.oasis&&!t.water),oil=desert.tiles.find(t=>t.oil>=85&&!t.water&&t.ground==='sand'),poor=desert.tiles.find(t=>t.oil<55&&!t.water&&t.ground==='sand');
assert.ok(oasis&&oasis.fertility>=70&&oasis.moisture>=75);assert.equal(biomeSurface(desert.layout,oasis.x,oasis.z),1);assert.ok(desert.tiles.some(t=>t.oasis&&!t.water&&desert.placementEffects('field',t.x,t.z).water===1),'Freshwater-facing oasis cells satisfy crop water needs');
assert.ok(oil&&poor);assert.ok(desert.tileMultiplier('oilpump',oil.x,oil.z)>desert.tileMultiplier('oilpump',poor.x,poor.z));
const efficiency=desert.tileMultiplier('oilpump',oil.x,oil.z);oil.ore=0;assert.equal(desert.tileMultiplier('oilpump',oil.x,oil.z),efficiency,'Oil must not use iron/coal concentration');
assert.ok(desert.tiles.some(t=>!t.water&&biomeDecoration(desert.layout,t)==='oilSeep'));
assert.ok(sims.marsh.tiles.filter(t=>t.water==='pond').length>20);
const coast=sims.coast,shore=coast.tiles.find(t=>!t.water&&coast.nearWater(t.x,t.z,1,2)&&coast.placementEffects('field',t.x,t.z).water===0);assert.ok(shore,'Sea never irrigates');
// Old saves with a grid but no ecology retain their original shape and resource rules.
const oldLand=structuredClone(layoutOf('miel-4'));delete oldLand.ecology;
const old=new Simulation('river',null,{land:oldLand});const oldSave=old.save(),loaded=new Simulation('river',decodeSave(encodeSave(oldSave)));
assert.equal(loaded.layout.ecology,undefined);assert.deepEqual(loaded.tiles,old.tiles);assert.equal(biomeSurface(oldLand,12,12),null);assert.equal(loaded.tile(12,12).oil,undefined);
assert.ok(!validLayout({...oldLand,ecology:'unknown'}));
console.log('Biomes PASS: eight playable profiles, actual resource advantages, oil/oasis, marsh water, matching scenery, deterministic generation and old/new saves.');
