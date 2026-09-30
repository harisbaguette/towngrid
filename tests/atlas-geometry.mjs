import assert from 'node:assert/strict';
import {WORLD_CELLS,CELL,COLS,ROWS} from '../src/app/game/world-grid.js';
import {PROVINCES} from '../src/app/game/territory.js';
import {TERRAIN_PATHS,NATION_SHAPES,CELL_PROVINCES,boundaryPath,tileAt,clampView,zoomView,viewAround,FULL_VIEW,ATLAS_WIDTH,ATLAS_HEIGHT} from '../src/app/game/atlas-geometry.js';

assert.equal(TERRAIN_PATHS.reduce((n,g)=>n+(g.path.match(/M/g)||[]).length,0),WORLD_CELLS.length,'Every authoritative tile is rendered once');
assert.ok(TERRAIN_PATHS.length<=10,'Terrain DOM is batched by type');
for(const cell of WORLD_CELLS){
 assert.equal(tileAt((cell.cx+.5)*CELL,(cell.cz+.5)*CELL),cell,'Hit testing returns original tile');
 if(cell.site)assert.equal(CELL_PROVINCES.get(cell.cx+','+cell.cz)?.id,cell.site);
}
assert.equal(tileAt(-.1,0),null);
assert.equal(tileAt(0,-.1),null);
assert.equal(tileAt(COLS*CELL,0),null);
assert.equal(tileAt(0,ROWS*CELL),null);
assert.equal((boundaryPath([[0,0],[1,0]]).match(/M/g)||[]).length,6,'Adjacent tiles share no internal border');
assert.equal((boundaryPath([[0,0],[1,0],[0,1],[1,1]]).match(/M/g)||[]).length,8);
assert.equal(NATION_SHAPES.length,30);
for(const p of PROVINCES){
 for(const [x,z] of p.cells)assert.equal(CELL_PROVINCES.get(x+','+z).id,p.id);
 for(const width of [100,600,2000]){
  const view=viewAround(p.point,width);
  assert.ok(view.x>=0&&view.y>=0&&view.x+view.width<=ATLAS_WIDTH+.001&&view.y+view.height<=ATLAS_HEIGHT+.001);
 }
}
let view=FULL_VIEW;
for(let i=0;i<20;i++)view=zoomView(view,.5);
assert.equal(view.width,CELL*8);
for(let i=0;i<20;i++)view=zoomView(view,2);
assert.deepEqual(view,FULL_VIEW);
assert.deepEqual(clampView({x:-400,y:-400,width:ATLAS_WIDTH*2}),FULL_VIEW);
console.log(JSON.stringify({tiles:WORLD_CELLS.length,terrainPaths:TERRAIN_PATHS.length,reductionPercent:Math.round((1-TERRAIN_PATHS.length/WORLD_CELLS.length)*1000)/10,countries:NATION_SHAPES.length,provinces:PROVINCES.length}));
