import assert from 'node:assert/strict';
import {WORLD_CELLS,layoutOf,MAP,waterAt,SIDES} from '../src/app/game/world-grid.js';
import {cellLayout,WorldTerrainData} from '../src/app/game/world-space.js';
import {landformOf,mountainHeight,reliefHeight,waterCellShape} from '../src/app/game/landform-data.js';
import {reliefGeometry} from '../src/app/game/world-relief.js';
import {Simulation} from '../src/app/game/simulation.js';
import {generateTerrainTiles} from '../src/app/game/terrain-tiles.js';
import {encodeSave,decodeSave} from '../src/app/game/persistence.js';
import {settlementPlan} from '../src/app/game/settlement-scenery.js';
import {WORLD_PLOTS} from '../src/app/game/territory.js';

const data=new WorldTerrainData(),types=new Set(WORLD_CELLS.map(c=>landformOf(cellLayout(c.cx,c.cz)).id));
for(const id of ['mountain','snowMountain','rockMountain','volcano','meadow','dryGrass','flowerMeadow','highlandGrass','dunes','gravelDesert','rockDesert','woodland','pineForest','wetForest','marsh','glacier','coast','lake','river','stream','canal'])assert.ok(types.has(id),'World contains '+id);
let joined=0,flatEdges=0,connectedInlets=0;
for(const c of WORLD_CELLS.filter(c=>c.terrain==='mountain')){
 const geometry=reliefGeometry(c),positions=geometry.attributes.position;let elevated=0,max=0;
 assert.equal(positions.count,169);assert.equal(geometry.index.count,864);
 for(let i=0;i<positions.count;i++){const y=positions.getY(i);if(y>2)elevated++;max=Math.max(max,y);}
 assert.ok(max>8);assert.ok(elevated>55,'A mountain fills the region rather than being four tiny props');
 for(const [side,dx,dz]of SIDES){
  const neighbor=WORLD_CELLS.find(n=>n.cx===c.cx+dx&&n.cz===c.cz+dz);if(!neighbor)continue;
  for(let u=2;u<24;u+=4){
   const x=c.cx*MAP+(dx===1?23.5:dx===-1?-.5:u),z=c.cz*MAP+(dz===1?23.5:dz===-1?-.5:u);
   const a=mountainHeight(x-dx*.00001,z-dz*.00001),b=mountainHeight(x+dx*.00001,z+dz*.00001);
   assert.ok(Math.abs(a-b)<.001,`No elevation seam at ${c.cx},${c.cz} ${side}`);
   if(neighbor.terrain!=='mountain'){assert.ok(a<.001);flatEdges++;}else joined++;
  }
 }
 const x=c.cx*24+8.3,z=c.cz*24+11.8;assert.ok(reliefHeight(x,z)>=0);geometry.dispose();
}
for(const c of WORLD_CELLS.filter(c=>['river','stream','canal'].includes(c.terrain))){
 const wet=[];for(let z=0;z<24;z++)for(let x=0;x<24;x++)if(waterCellShape(c,c.cx*24+x,c.cz*24+z).water)wet.push(x+','+z);
 const all=new Set(wet),seen=new Set(),queue=[wet[0]];while(queue.length){const key=queue.pop();if(seen.has(key))continue;seen.add(key);const[x,z]=key.split(',').map(Number);for(const[,dx,dz]of SIDES){const n=(x+dx)+','+(z+dz);if(all.has(n)&&!seen.has(n))queue.push(n);}}
 assert.equal(seen.size,all.size,'Each stream/river/canal has a connected bed');assert.ok(wet.length<576,'Banks occupy part of the 24×24 cell');
 for(const [side,dx,dz]of SIDES){
  const n=WORLD_CELLS.find(v=>v.cx===c.cx+dx&&v.cz===c.cz+dz);if(!n?.site)continue;const layout=layoutOf(n.site);
  let connection=false;
  for(let u=0;u<24;u++){
   const x=dx===1?23:dx===-1?0:u,z=dz===1?23:dz===-1?0:u;
   const wx=c.cx*24+x,wz=c.cz*24+z,tx=wx+dx-n.cx*24,tz=wz+dz-n.cz*24;
   if(data.sample(wx,wz).water===c.terrain&&waterAt(layout,tx,tz)===c.terrain)connection=true;
  }
  assert.ok(connection,'Water connects into the neighboring playable plot at '+c.cx+','+c.cz+' '+side);connectedInlets++;
 }
}
assert.ok(joined&&flatEdges&&connectedInlets);
// A save written before this terrain revision must regenerate exactly its old layout.
for(const id of ['estern-3','kardum-1',WORLD_PLOTS.find(p=>layoutOf(p.id).ecology==='desert').id]){
 const layout=structuredClone(layoutOf(id));delete layout.surfaceVersion;
 const old=new Simulation('river',null,{land:layout,seed:19});const available=old.tiles.find(t=>!old.canBuild('well',t.x,t.z,true));old.build('well',available.x,available.z,true);
 const saved=old.save(),loaded=new Simulation('river',decodeSave(encodeSave(saved)));
 assert.deepEqual(loaded.tiles,old.tiles);assert.deepEqual(loaded.buildings,old.buildings);assert.deepEqual(loaded.save(),saved);assert.equal(loaded.layout.surfaceVersion,undefined);
 const view=new WorldTerrainData(loaded);for(const t of loaded.tiles)assert.equal(view.sample(layout.cell[0]*24+t.x,layout.cell[1]*24+t.z).water,t.water);
}
const signatures=new Set();for(const c of WORLD_CELLS.filter(c=>c.site&&cellLayout(c.cx,c.cz).ecology==='meadow').slice(0,20))signatures.add(JSON.stringify(data.tiles(c).filter(t=>t.water==='pond').map(t=>[t.x,t.z])));assert.ok(signatures.size>=5,'Ponds do not repeat at an identical place in every region');
for(const plot of WORLD_PLOTS.filter(p=>p.developed)){
 const tiles=generateTerrainTiles(layoutOf(plot.id)),plan=settlementPlan(plot,tiles);assert.ok(plan.buildings.length>10);assert.ok(plan.roads.size>10);
 for(const b of plan.buildings){assert.ok(!plan.roads.has(b.x+','+b.z));if(!b.type.endsWith('port'))assert.ok(!tiles[b.z*24+b.x].water);}
}
console.log(JSON.stringify({result:'PASS',landforms:types.size,mountainJoins:joined,levelFootEdges:flatEdges,connectedInlets,pondPatterns:signatures.size,checks:['whole-region relief','fixed geometry at every zoom','connected water','old save and structures','settlement streets']},null,2));
