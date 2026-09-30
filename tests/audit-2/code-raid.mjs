// Code audit (C): guards only engage attackers within range of their barracks (encounters.js:45 tickRaid `distance(w,home)<range`),
// but attackers hit any guard within 1.35 tiles (encounters.js:56). An attacker standing just past the range line hits
// guards that never hit back, so the same raid swings on a tenth of a tile. Real rank31 fixture, frames as the browser feeds them.
import {load,calm,expectBug,finish} from './_fixture.mjs';
import {startRaid} from '../../src/app/game/encounters.js';
const d=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const rows=[];let oneSided=null;
for(const [speed,frame] of [[1,1/60],[4,1/60],[1,1/30],[4,1/30]]){const c=load(31);calm(c);c.active.paused=false;for(const v of c.sites)v.sim.speed=speed;const s=c.home.sim;startRaid(s);const t0=s.time,home=s.buildings.find(b=>b.id===s.guards[0].homeId),range=s.rank>=23?9:6.5;
 let guardHits=0,lastGuardHp=s.guards.reduce((n,g)=>n+g.hp,0);
 while(!s.raid.finished&&s.time-t0<100){c.tick(frame);const hp=s.guards.reduce((n,g)=>n+g.hp,0);if(hp<lastGuardHp){guardHits++;
   // A guard just lost hp: is the attacker next to it outside the guard's engagement range?
   for(const g of s.guards)for(const w of s.attackers)if(w.hp>0&&d(g,w)<1.35&&d(w,home)>=range&&!g.attacking&&!oneSided)oneSided={speed,t:+(s.time-t0).toFixed(1),guardToAttacker:+d(g,w).toFixed(2),attackerToBarracks:+d(w,home).toFixed(2),range};}
  lastGuardHp=hp;}
 rows.push({speed,frameMs:Math.round(frame*1000),seconds:Math.round(s.time-t0),moneyLost:Math.round(s.raid.damage),attackersDefeated:s.raid.defeated,guardHp:s.guards.map(g=>Math.round(g.hp))});}
console.log(JSON.stringify(rows));
const spread=Math.max(...rows.map(r=>r.moneyLost))/Math.max(1,Math.min(...rows.map(r=>r.moneyLost)));
expectBug('C-A1 guards take hits from attackers just outside the barracks range and never strike back; the same raid swings 5x',!!oneSided&&spread>3,{oneSided,moneyLostSpread:+spread.toFixed(1)});
finish('code-raid');
