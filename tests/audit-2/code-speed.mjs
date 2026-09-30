// Code audit (C): is 4x the same game as 1x? Same fixture, same in-game time, frame steps as the browser loop feeds them
// (scene.js loop: campaign.tick(min(.05, frame dt))). Compares goods made and moved per in-game minute.
import {load,calm,expectBug,finish} from './_fixture.mjs';
import {BUILDINGS} from '../../src/app/game/simulation.js';
const runAt=(speed,frame,gameSeconds)=>{const c=load(22);calm(c);c.active.paused=false;for(const v of c.sites)v.sim.speed=speed;const s=c.home.sim;
 const made0=Object.values(s.produced).reduce((a,b)=>a+b,0),net0=s.logisticsStats.direct,t0=s.time;
 while(s.time-t0<gameSeconds)c.tick(frame);
 const cycles=s.buildings.reduce((n,b)=>n+(b.cycles||0),0);
 return {speed,frameMs:Math.round(frame*1000),gameSeconds:Math.round(s.time-t0),made:Object.values(s.produced).reduce((a,b)=>a+b,0)-made0,cycles,networkMoved:s.logisticsStats.direct-net0};};
const rows=[runAt(1,1/30,1200),runAt(4,1/30,1200),runAt(1,1/60,1200),runAt(4,1/60,1200)];
console.log(JSON.stringify(rows));
const loss=1-rows[1].made/rows[0].made;
expectBug('C-T1 at 4x the same in-game time makes fewer goods than at 1x (cycle remainder dropped each cycle)',loss>.02,{lossAt30fps:+(loss*100).toFixed(1)+'%',lossAt60fps:+((1-rows[3].made/rows[2].made)*100).toFixed(1)+'%'});
finish('code-speed');
