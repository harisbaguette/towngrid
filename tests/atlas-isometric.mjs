import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {WORLD_CELLS,CELL} from '../src/app/game/world-grid.js';
import {FULL_VIEW,tileAt,viewAround} from '../src/app/game/atlas-geometry.js';
import {projectAtlas,unprojectAtlas,unprojectDelta,projectView,ISO_FULL_VIEW,screenStep} from '../src/app/game/atlas-projection.js';
import {ATLAS_SPRITES,atlasQuarterSprite,ATLAS_DECORATIONS} from '../src/app/game/atlas-terrain.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
for(let q=0;q<4;q++){
 const full=projectView(FULL_VIEW,q);for(const k of ['x','y','width','height'])near(full[k],ISO_FULL_VIEW[k]);
 for(const c of WORLD_CELLS){
  const ground=[(c.cx+.5)*CELL,(c.cz+.5)*CELL],p=projectAtlas(ground,q),back=unprojectAtlas(p,q);
  near(back[0],ground[0]);near(back[1],ground[1]);assert.equal(tileAt(...back),c,'Picking returns the same geographic tile in every view');
  assert.ok(p[0]>full.x&&p[0]<full.x+full.width&&p[1]>full.y&&p[1]<full.y+full.height);
 }
 for(const key of ['ArrowRight','ArrowLeft','ArrowUp','ArrowDown']){
  const step=screenStep(key,q),a=projectAtlas([0,0],q),b=projectAtlas(step,q),dx=b[0]-a[0],dy=b[1]-a[1];
  if(key==='ArrowRight'){assert.ok(dx>0);near(dy,0);}if(key==='ArrowLeft'){assert.ok(dx<0);near(dy,0);}
  if(key==='ArrowDown'){assert.ok(dy>0);near(dx,0);}if(key==='ArrowUp'){assert.ok(dy<0);near(dx,0);}
 }
 const view=viewAround([650,400],300),iso=projectView(view,q),delta=unprojectDelta([17,-9],q),moved=projectView({...view,x:view.x+delta[0],y:view.y+delta[1]},q);
 near(moved.x-iso.x,17);near(moved.y-iso.y,-9);
}
const manifest=JSON.parse(await readFile('public/assets/world-atlas/iso/manifest.json','utf8'));
assert.equal(manifest.sprites.length,64);assert.deepEqual(manifest.views,['SE','NE','NW','SW']);
for(const s of [...manifest.sources,...manifest.sprites])assert.equal(createHash('sha256').update(await readFile(s.path)).digest('hex'),s.hash);
for(const name of ATLAS_SPRITES){
 const views=manifest.sprites.filter(s=>s.name===name);assert.equal(views.length,4);assert.equal(new Set(views.map(s=>s.hash)).size,4,'Four distinct authored images: '+name);
 for(let q=0;q<4;q++)assert.equal(atlasQuarterSprite(name,q),'/assets/world-atlas/iso/'+name+'-'+q+'.png');
}
const atlas=JSON.parse(await readFile('public/assets/world-atlas/manifest.json','utf8'));
const ground=await readFile(atlas.ground.path);
assert.equal(createHash('sha256').update(ground).digest('hex'),atlas.ground.hash);
assert.equal(ground.length,atlas.ground.bytes);assert.equal(atlas.directions,'public/assets/world-atlas/iso/manifest.json');
assert.ok(ATLAS_DECORATIONS.length>100);assert.ok(ground.length>1000);
console.log(JSON.stringify({passed:true,views:4,pickedCells:WORLD_CELLS.length*4,authoredSprites:64,terrainObjects:ATLAS_DECORATIONS.length}));
