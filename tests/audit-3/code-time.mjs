// Audit 3 (G3, code): the real-time clock (game-time.js BASE_TIME_SCALE) against the texts and timers written in game
// seconds, and the batched ticking of sites off screen (campaign.js tick).  node tests/audit-3/code-time.mjs
import {load,calm,expectBug,finish} from '../audit-2/_fixture.mjs';
import {advanceGame,realSeconds} from '../../src/app/game/game-time.js';
import {BUILDINGS,Simulation} from '../../src/app/game/simulation.js';
import {blockHint} from '../../src/app/game/ui-rules.js';
import * as visuals from '../../src/app/game/production-visuals.js';
// (1) Texts that quote a duration must show the real seconds at the speed the player is running.
{const at=speed=>{const s=new Simulation('river',null,{nation:'estern'});s.speed=speed;return s;};
 /* Game.tsx shows the facility text through describeFacility when it exists (working tree), else the raw description */
 const text=speed=>visuals.describeFacility?visuals.describeFacility('windpump',at(speed)):BUILDINGS.windpump.description;
 const rows=[1,4].map(speed=>({speed,shown:+(text(speed).match(/(\d+)초간/)?.[1]??NaN),real:realSeconds(60,{speed})}));/* TIMED.irrigation = 60 game s */
 expectBug('G3-07 windpump text quotes a watering window that is not the real one',rows.some(r=>r.shown!==r.real),{rows,text:text(1).slice(0,40)});
 /* Game.tsx facility advice: blockHint(b.status) - no simulation, so no speed */
 const n=+(blockHint('자원 고갈').match(/(\d+)초 뒤 자람/)?.[1]??NaN),rows2=[1,2,4].map(speed=>({speed,shown:n,real:realSeconds(160,{speed})}));/* economy.js plant: growAt=time+160 */
 expectBug('G3-08 depleted-gatherer advice quotes a sapling growth time that is not the real one at the current speed',rows2.some(r=>r.shown!==r.real),{rows:rows2});}
// (2) Sites off screen tick in 0.25 s batches: their clocks and output must match the site on screen.
{const mk=()=>{const c=load(31);calm(c);c.active.paused=false;for(const x of c.sites)x.sim.speed=1;return c;};
 const a=mk(),b=mk();b.switchSite('site-2');b.active.paused=false;
 const cycles=(c,id)=>c.sites.find(v=>v.id===id).sim.buildings.reduce((n,x)=>n+(x.cycles||0),0);const c1a=cycles(a,'site-1'),c1b=cycles(b,'site-1'),t0=a.active.time;
 for(let i=0;i<20*400;i++){advanceGame(a.active,.05);advanceGame(b.active,.05);}/* 400 real seconds = 200 game seconds */
 const drift=Math.max(...a.sites.map(v=>Math.abs(v.sim.time-a.active.time))),made=[cycles(a,'site-1')-c1a,cycles(b,'site-1')-c1b];
 console.log(JSON.stringify({gameSeconds:+(a.active.time-t0).toFixed(2),maxClockDriftOffScreen:+drift.toFixed(3),homeCyclesOnScreen:made[0],homeCyclesOffScreen:made[1]}));
 expectBug('G3-09 control: an off-screen site drifts more than one batch (0.25 s) or makes over 5% less than on screen',drift>.25+1e-6||Math.abs(made[0]-made[1])>Math.max(2,made[0]*.05),{drift,made});}
// (3) worldDay books the daily dividend and running costs into the home site's budget; with another site on screen the
//     home site is ticked in batches and must still be on the new day when that happens.
{const c=load(31);calm(c);c.switchSite('site-2');c.active.paused=false;for(const x of c.sites)x.sim.speed=1;const home=c.home.sim;const seen=[];
 const orig=c.worldDay.bind(c);c.worldDay=()=>{seen.push({activeDay:c.active.day,homeDay:home.day});orig();};
 for(let i=0;i<20*2*80*3&&seen.length<3;i++)advanceGame(c.active,.05);
 expectBug('G3-10 control: the day\'s dividend and upkeep land in the home ledger of the previous day',seen.some(v=>v.homeDay!==v.activeDay),{worldDays:seen});}
finish('code-time');
