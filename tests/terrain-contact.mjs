import assert from 'node:assert/strict';
import {terrainHeightAt,connectionMask} from '../src/app/game/pixel-terrain.js';
import {roadContains} from '../src/app/game/road-footprint.js';

const tile={roads:new Set(['3,4']),at:()=>null};
assert.equal(terrainHeightAt(tile,3,4),.026);
assert.equal(terrainHeightAt(tile,3.4,4.4),.013,'bare corner of a road tile is ground');
assert.equal(terrainHeightAt(tile,3,4.4),.013,'unconnected end is ground');
tile.roads.add('3,5');
assert.equal(terrainHeightAt(tile,3,4.4),.026,'connected south arm is road');
assert.equal(terrainHeightAt(tile,3,3.6),.013,'north stays unconnected');
tile.at=(x,z)=>x===4&&z===4?{type:'warehouse'}:null;
assert.equal(terrainHeightAt(tile,3.4,4),.026,'building entrance extends the road');
assert.equal(terrainHeightAt(tile,2.6,4),.013);
for(const [x,z] of [[-3,-4],[0,0],[23,23]]){
 const sim={roads:new Set([`${x},${z}`,`${x+1},${z}`])};
 for(const offset of [.49,.4999,.5,.5001,.51])assert.equal(terrainHeightAt(sim,x+offset,z),.026,'no height gap across tile boundary');
 assert.equal(terrainHeightAt(sim,x+.4,z+.4),.013);
}
for(let mask=0;mask<16;mask++){
 const roads=new Set(['0,0']);
 for(const [x,z,bit] of [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]])if(mask&bit)roads.add(`${x},${z}`);
 assert.equal(connectionMask(0,0,(x,z)=>roads.has(`${x},${z}`)),mask);
 for(const [x,z,bit] of [[0,-.45,1],[.45,0,2],[0,.45,4],[-.45,0,8]])
  assert.equal(terrainHeightAt({roads},x,z),mask&bit?.026:.013);
 for(const x of [.1,.9])for(const z of [.1,.9])assert.equal(roadContains(mask,x,z),false);
}
console.log('TERRAIN_CONTACT_OK: road corners, open ends, entrances, four directions and tile seams');
