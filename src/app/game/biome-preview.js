import {Simulation,RESOURCES} from './simulation.js';
import {layoutOf} from './world-grid.js';

// These are real province layouts, including the very same four neighbours as the atlas.
export const BIOME_EXAMPLES={snow:'kardum-1',meadow:'estern-0',forest:'silvaen-1',basin:'kardum-0',desert:'torvik-3',coast:'rivente-0',marsh:'miel-4',volcanic:'elune-0'};
export function biomePreview(id='meadow'){
 const land=structuredClone(layoutOf(Object.hasOwn(BIOME_EXAMPLES,id)?BIOME_EXAMPLES[id]:BIOME_EXAMPLES.meadow));
 const sim=new Simulation('river',null,{land,nation:land.province.split('-')[0],race:'human'});
 sim.paused=true;sim.rank=32;sim.money=1e6;sim.debt=0;sim.nextEvent=1e9;
 for(const r of Object.keys(RESOURCES))sim.stock[r]=150;
 for(const t of sim.tiles)sim.owned.add(t.x+','+t.z);
 for(const [type,x,z] of [['warehouse',11,12],['house',9,12],['house',11,14],['house',13,14],['dwarfhouse',9,14]]){
  const result=sim.build(type,x,z,true);if(!result.ok)throw new Error(type+': '+result.error);if(type!=='warehouse')sim.at(x,z).level=3;
 }
 sim.syncWorkers();
 const build=(type,predicate=()=>true,score=t=>Math.hypot(t.x-11,t.z-12))=>{
  const origin=sim.entries(sim.warehouse)[0];
  const reachable=t=>sim.entries({x:t.x,z:t.z,size:1}).some(e=>sim.path(origin,e));
  const tile=sim.tiles.filter(t=>predicate(t)&&reachable(t)).sort((a,b)=>score(a)-score(b)).find(t=>sim.canBuild(type,t.x,t.z,true)===null);
  if(tile)sim.build(type,tile.x,tile.z,true);return tile;
 };
 build('well');build('lumber');build('quarry');
 build('field',t=>!t.water,t=>sim.placementEffects('field',t.x,t.z).water?-100+Math.hypot(t.x-11,t.z-12):Math.hypot(t.x-11,t.z-12));
 if(['basin','volcanic','snow'].includes(id)){build('ironmine',t=>!t.water,t=>-t.ore);build('coalpit',t=>!t.water,t=>-t.ore);}
 if(id==='forest')build('sawmill');
 if(id==='desert'){build('windturbine');build('oilpump',t=>!t.water&&t.oil>=85);}
 if(['coast','marsh'].includes(id)){build('dock');build('watermill');}
 if(id==='coast')build('coastport');
 if(id==='snow')build('polarport');
 const origin=sim.entries(sim.warehouse)[0];
 for(const b of sim.buildings){const entry=sim.entries(b).find(e=>sim.path(origin,e));if(entry)for(const t of sim.path(origin,entry)){sim.roads.add(t.x+','+t.z);const tile=sim.tile(t.x,t.z);tile.nature=null;tile.remaining=0;}}
 sim.revision++;return sim;
}
