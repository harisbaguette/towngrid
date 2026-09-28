import assert from 'node:assert/strict';
import {Simulation} from '../src/app/game/simulation.js';
import {mapEdges,edgeScenery,outsideSide} from '../src/app/game/map-edges.js';
import {groundOf,waterAt,legacyLayout,SIDES,edgePoint} from '../src/app/game/world-grid.js';
import {makeScenery} from '../src/app/game/scenery.js';
import {encodeSave,decodeSave} from '../src/app/game/persistence.js';

const land={province:null,cell:[14,12],biome:'plain',edges:{n:'mountain',e:'coast',s:'river',w:'forest'}};
const s=new Simulation('river',null,{land});s.money=1e6;s.rank=32;
for(const t of s.tiles)s.owned.add(t.x+','+t.z);
assert.deepEqual(mapEdges(land).map(e=>e.kind),['mountain','coast','river','forest']);
const mountains=s.tiles.filter(t=>t.ground==='mountain');
assert.ok(mountains.length>15);assert.ok(mountains.every(t=>t.ore>=80));
assert.ok(mountains.some(t=>t.nature==='rock'&&t.remaining===180));
const mountain=mountains.find(t=>t.nature===null&&s.canBuild('ironmine',t.x,t.z,true)===null);
assert.ok(mountain);assert.ok(s.tileMultiplier('ironmine',mountain.x,mountain.z)>=1.675);
const mk=(type,t)=>({type,x:t.x,z:t.z,size:1,level:1,enabled:true,health:100,race:'human',out:0,inputs:{},progress:0});
// Same ore amount: the existing mountain production factor must have a real effect.
const plain=s.tile(12,12);plain.ore=mountain.ore;
assert.equal(s.tileMultiplier('ironmine',mountain.x,mountain.z)/s.tileMultiplier('ironmine',12,12),1.25);
// Sea and freshwater lead to different gameplay; only the corresponding port accepts each water.
for(const [kind,port,wrong] of [['coast','coastport','riverport'],['river','riverport','coastport']]){
 const t=s.tiles.find(t=>t.water===kind&&s.canBuild(port,t.x,t.z,true)===null);assert.ok(t,kind+' port placement');assert.notEqual(s.canBuild(wrong,t.x,t.z,true),null);
 const dry=s.tiles.find(d=>!d.water&&Math.max(Math.abs(t.x-d.x),Math.abs(t.z-d.z))<=2&&s.placementEffects('field',d.x,d.z).water===(kind==='coast'?0:1));assert.ok(dry,kind+' irrigation');
 assert.ok(s.nearWater(dry.x,dry.z,1,3));
}
const center=s.tile(12,9);assert.ok(!s.nearWater(center.x,center.z,1,3));assert.ok(s.canBuild('dock',center.x,center.z,true));
// Forest resources are denser than the matched opposite plain edge in the same deterministic seed.
const wooded=s.tiles.filter(t=>t.x<5&&!t.water&&t.nature==='tree').length;
const flat=new Simulation('river',null,{land:{...land,edges:{...land.edges,w:'plain'}}});
assert.ok(wooded>flat.tiles.filter(t=>t.x<5&&!t.water&&t.nature==='tree').length);
// Every rotated arrangement drives both logical tiles and scenery; no prop can stand on water.
for(let turn=0;turn<4;turn++){
 const l={...land,edges:Object.fromEntries(SIDES.map(([side],i)=>[side,['mountain','coast','river','forest'][(i+turn)%4]]))};
 const props=edgeScenery(l);for(const p of props){assert.ok(!waterAt(l,Math.round(p.x),Math.round(p.z)));assert.ok(outsideSide(p.x,p.z));if(p.id==='mountain'||p.id==='oreRock')assert.equal(l.edges[p.side],'mountain');}
 for(const [side]of SIDES)if(l.edges[side]==='mountain'){const [x,z]=edgePoint(side,0,12);assert.equal(groundOf(l,x,z),'mountain');assert.ok(props.some(p=>p.id==='mountain'&&p.side===side));}
 const sim=new Simulation('river',null,{land:l}),before=JSON.stringify(sim.save()),scenery=makeScenery(sim.region,sim.race,sim);
 for(let view=0;view<4;view++)scenery.animate(2,view);
 assert.equal(JSON.stringify(sim.save()),before,'Rendering must not mutate gameplay');
}
// Stored resource depletion survives loading, and legacy template resources are not upgraded.
const rock=mountains.find(t=>t.nature==='rock');rock.remaining=17;
const restored=new Simulation('river',decodeSave(encodeSave(s.save())));assert.equal(restored.tile(rock.x,rock.z).remaining,17);assert.deepEqual(restored.layout,land);
const legacy=new Simulation('highland',null,{land:legacyLayout('highland','kardum-0')});assert.ok(legacy.tiles.filter(t=>t.nature).every(t=>t.remaining===90));
console.log('Map edges: four rotated layouts, mountain yield/resources, forest density, sea/freshwater ports/irrigation, matching scenery and save compatibility PASS.');
