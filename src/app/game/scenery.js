import * as THREE from 'three';
import {makePixelProp} from './pixel-environment.js';
import {edgeScenery,outsideSide} from './map-edges.js';
import {makeBackgroundTerrain} from './pixel-terrain.js';
import {waterAt,groundOf,legacyLayout,edgePoint,riverMiddle} from './world-grid.js';
import {noise} from './simulation.js';

export function makeScenery(region,race,sim){
 const g=new THREE.Group(),objects=[],ships=[],clouds=[],birds=[];g.name='scenery';
 const terrain=makeBackgroundTerrain(region,sim);g.add(terrain);
 const layout=sim?.layout||legacyLayout(region),wet=(x,z)=>!!waterAt(layout,Math.round(x),Math.round(z));
 const add=(id,x,z,scale=1)=>{const p=makePixelProp(id,scale);p.position.set(x,.014,z);g.add(p);objects.push(p);return p;};
 const landmarks=edgeScenery(layout);
 for(const prop of landmarks){const p=add(prop.id,prop.x,prop.z,prop.scale);p.userData.mapSide=prop.side;}
 // Distant details follow the same side; keep the near edge clean enough to read.
 for(let i=0;i<75;i++){
  const x=-19+noise(i,83)*62,z=-19+noise(i,97)*62,side=outsideSide(x,z);
  if(!side||x>-9&&x<33&&z>-9&&z<33||wet(x,z))continue;
  const kind=layout.edges[side],ground=groundOf(layout,Math.round(x),Math.round(z));
  const eco=layout.ecology;
  const id=kind==='mountain'?(eco==='snow'?'snowMountain':eco==='volcanic'?'volcanicMountain':'mountain'):ground==='ice'||eco==='snow'?(eco?'snowPine':'pine'):ground==='sand'||eco==='desert'?(i%4?'rock':eco?'cactus':'palm'):eco==='volcanic'?'oreRock':kind==='forest'||eco==='forest'?(eco?'forestTree':'pine'):eco==='marsh'?'willow':i%3?'bush':'willow';
  const p=add(id,x,z,kind==='mountain'?1.3:.65+noise(i,14)*.45);p.userData.mapSide=side;
 }
 g.userData.edgeProps=landmarks;
 // Boats sail beyond a sea side, or down the middle of a river side.
 const sea=['e','n','s','w'].find(s=>layout.edges[s]==='coast'),river=['e','n','s','w'].find(s=>layout.edges[s]==='river');
 const lane=sea?{side:sea,depth:i=>-2-i*3}:river?{side:river,depth:(i,u)=>riverMiddle(layout,river,u)}:null;
 for(let i=0;i<(sea?3:river?1:0);i++){
  const boat=add('fishingBoat',0,0,sea?1.2:.8);
  boat.userData.vehicle=true;ships.push({boat,index:i});
 }
 for(let i=0;i<4;i++){
  const c=makePixelProp('clouds',.8+noise(i,7)*.5,i);c.position.set(i*14-15,6.5,-10+(i%2)*42);g.add(c);clouds.push(c);
 }
 for(let i=0;i<5;i++){const bird=makePixelProp('birds');g.add(bird);birds.push(bird);}
 return {group:g,animate:(time,view=0)=>{
  terrain.userData.animate(time);
  for(const p of objects)p.userData.animate?.(time,{},null,view);
  for(const {boat,index} of ships){
   const u=((time*.075+index*9)%32)-3,[x,z]=edgePoint(lane.side,lane.depth(index,u),u);
   boat.position.x=x;boat.position.z=z;
   boat.position.y=-.165+Math.sin(time+index)*.008;boat.userData.animate(time,null,false,view);
  }
  clouds.forEach((c,i)=>{c.position.x=((time*.08+i*14)%65)-19;c.userData.animate(time,null,false,view);});
  birds.forEach((b,i)=>{const a=time*.08+i*1.4;b.position.set(12+Math.cos(a)*16,4+i*.25,12+Math.sin(a)*16);b.userData.animate(time+i*.15,null,false,view);});
 }};
}
