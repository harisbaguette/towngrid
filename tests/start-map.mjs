import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {WORLD_PLOTS} from '../src/app/game/territory.js';
import {layoutOf,CELL,WORLD_CELLS} from '../src/app/game/world-grid.js';
import {NATIONS} from '../src/app/game/world.js';
import {startingProvinces} from '../src/app/game/starting-sites.js';
import {Simulation} from '../src/app/game/simulation.js';
import {Campaign} from '../src/app/game/campaign.js';
import {FULL_VIEW,tileAt,viewAround} from '../src/app/game/atlas-geometry.js';
import {projectView,unprojectAtlas} from '../src/app/game/atlas-projection.js';
import {OUTSKIRT_BOUNDS,exteriorCell,exteriorColor} from '../src/app/game/atlas-outskirts.js';

const baseline=JSON.parse(readFileSync('docs/verification/start-map-20261003/baseline.json','utf8'));
assert.deepEqual(WORLD_PLOTS.map(({id,cell,nation})=>({id,cell,nation})),baseline.plots,'All plot IDs, positions and countries remain compatible');
for(const old of baseline.saved){
 const restored=new Simulation(old.save.region,old.save);
 assert.deepEqual(restored.tiles,old.tiles,'Existing resources and nature are not regenerated: '+old.id);
 assert.deepEqual(restored.layout,old.save.land,'Existing terrain and neighbouring edges survive');
}
const distributions={};let starts=0;
for(const [id,n] of Object.entries(NATIONS)){
 if(!n.playable)continue;
 const candidates=startingProvinces(id),counts={};
 for(const p of candidates){
  const land=layoutOf(p.id);counts[land.ecology]=(counts[land.ecology]||0)+1;starts++;
  const preview=new Simulation(n.region,null,{nation:id,race:n.race,provinceId:p.id,seed:0}),actual=new Campaign({nation:id,race:n.race,provinceId:p.id});
  assert.deepEqual(preview.tiles,actual.active.tiles,'Preview is the actual starting map');
  assert.ok(preview.tiles.some(t=>t.nature==='tree'&&t.remaining>=90));assert.ok(preview.tiles.some(t=>t.nature==='rock'&&t.remaining>=90));
  for(let z=10;z<=15;z++)for(let x=9;x<=14;x++)assert.equal(preview.tile(x,z).nature,null,'Clear central starting area');
 }
 assert.ok(Object.keys(counts).length>=2,'Every playable country offers at least two ecological starts: '+id);
 assert.ok(Math.max(...Object.values(counts))/candidates.length<=.75,'No country is overwhelmingly one start biome: '+id);
 distributions[id]=counts;
}
assert.equal(starts,279);
let coverage=0;
for(const size of [[390,844],[360,800],[844,390],[1440,900],[2560,1080]])for(let q=0;q<4;q++)for(const view of [FULL_VIEW,viewAround([0,0],CELL*8),viewAround([1300,806],CELL*8)]){
 const iso=projectView(view,q),scale=Math.min(size[0]/iso.width,size[1]/iso.height),cx=iso.x+iso.width/2,cy=iso.y+iso.height/2;
 for(const [sx,sy] of [[0,0],[size[0],0],[0,size[1]],[size[0],size[1]]]){
  const [x,z]=unprojectAtlas([cx+(sx-size[0]/2)/scale,cy+(sy-size[1]/2)/scale],q);
  assert.ok(x>=OUTSKIRT_BOUNDS.x&&x<=OUTSKIRT_BOUNDS.x+OUTSKIRT_BOUNDS.width&&z>=OUTSKIRT_BOUNDS.y&&z<=OUTSKIRT_BOUNDS.y+OUTSKIRT_BOUNDS.height,'Scenery covers every viewport corner');coverage++;
 }
}
for(const c of WORLD_CELLS){const outside=c.cx===0?[-1,c.cz]:c.cz===0?[c.cx,-1]:null;if(!outside)continue;assert.equal(tileAt((outside[0]+.5)*CELL,(outside[1]+.5)*CELL),null,'Scenery is never selectable');assert.ok(exteriorCell(...outside));assert.ok(exteriorColor(...outside).every(Number.isFinite));}
console.log(JSON.stringify({passed:true,plots:WORLD_PLOTS.length,oldSaves:baseline.saved.length,starts,coverage,distributions}));
