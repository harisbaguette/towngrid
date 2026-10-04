import {landscapeHash} from './landscape-colors.js';
export const unit=v=>v-Math.floor(v);
export const hash=landscapeHash;
export const clamp=v=>Math.max(0,Math.min(1,v));

// Presentation reads the existing event history; it never consumes soundEvents
// or adds weather timers to the campaign save.
export function weatherState(sim){
 const upcoming=sim.pendingEvent?.type==='storm'?clamp(1-(sim.pendingEvent.at-sim.time)/20):0;
 const last=(sim.events||[]).findLast(e=>e.type==='storm'&&e.time<=sim.time);
 const rain=Math.max(upcoming,last?clamp(1-(sim.time-last.time)/14):0);
 const mana=sim.outageUntil>sim.time?1:0;
 return {rain,mana};
}
// Weather belongs to the active settlement, not every place the camera visits.
export function localWeatherState(sim,camera={x:11.5,z:11.5}){
 const weather=weatherState(sim),distance=Math.hypot(camera.x-11.5,camera.z-11.5);
 const fade=Math.max(0,1-Math.max(0,distance-24)/48);
 return {rain:weather.rain*fade,mana:weather.mana*fade};
}
export function daylight(time){
 // A new village opens in daylight; night remains readable and does not alter production.
 const phase=unit(time/80+.2),sun=Math.sin(phase*Math.PI*2);
 return {phase,night:clamp(-sun),dusk:Math.max(0,1-Math.abs(sun)*4)*(phase>.4&&phase<.8?1:0)};
}
export const WORK_DUST=new Set(['quarry','ironmine','coalpit','coppermine','shallowmine','clayfield','sandpit','cementworks','stonecutter']);
export const WOOD_CHIPS=new Set(['lumber','sawmill','carpenter','woodshop','boxworks']);
export const MAGIC_BUILDINGS=new Set(['magetower','arcanepower','manaextractor','leyrelay','mithrilforge','fortress']);

export class ActionChanges{
 constructor(){this.sim=null;this.previous=new Map();}
 read(sim){
  const next=new Map(sim.buildings.map(b=>[b.id,{id:b.id,x:b.x,z:b.z,health:b.health??100,cycles:b.cycles||0,type:b.type}])),events=[];
  if(this.sim===sim){
   for(const [id,b]of next){const old=this.previous.get(id);
    if(!old)events.push({kind:'build',...b});
    else if(old.x!==b.x||old.z!==b.z)events.push({kind:'move',...old},{kind:'build',...b});
    else if(b.health>old.health)events.push({kind:'repair',...b});
    else if(b.health<old.health)events.push({kind:'impact',...b});
    else if(b.cycles>old.cycles)events.push({kind:'complete',...b});
   }
   for(const [id,b]of this.previous)if(!next.has(id))events.push({kind:'demolish',...b});
  }
  this.sim=sim;this.previous=next;return events;
 }
}
