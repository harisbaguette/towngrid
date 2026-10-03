// Offline progress (Town Star's "Update Town Offline", docs/TOWNSTAR_RULES.md): a town continued from the browser's save
// runs the real time it was closed, up to half an hour and as much as two seconds of computing allow, before the player sees it. Production, hauling, auto-sales and
// shipments go on; no storm, raid or other event starts while away (each site's next event, and one already announced,
// moves back by the time away).
import {BASE_TIME_SCALE} from './game-time.js';

// speed 16 steps every site four game seconds at a time (the coarse steps the rules already carry, simulation.js tick);
// budgetMs stops the run when the computer has spent that long, so a large late empire (six sites, 120 facilities: about
// 8 ms a game second) runs as many days as fit in two seconds instead of freezing the loading screen for half a minute.
export const OFFLINE={maxReal:1800,minReal:60,speed:16,budgetMs:2000};
/** Real seconds since a raw save was written, from the save wrapper's savedAt (0 when unknown or in the future). */
export function awaySeconds(raw,now=Date.now()){
 try{const at=Date.parse(JSON.parse(raw)?.savedAt);return Number.isFinite(at)?Math.max(0,(now-at)/1000):0;}catch{return 0;}
}
const totals=c=>({money:c.treasury.money,revenue:c.treasury.totalRevenue||0,produced:Object.values(c.treasury.produced||{}).reduce((n,v)=>n+(+v||0),0),stars:c.league?.total||0});
/** Run `real` seconds of time away on a campaign; returns what changed, or null when too short to bother. */
export function catchUp(c,real,budgetMs=OFFLINE.budgetMs,clock=()=>performance.now()){
 if(!c||!(real>=OFFLINE.minReal))return null;
 const capped=Math.min(real,OFFLINE.maxReal),game=capped*BASE_TIME_SCALE,active=c.active,before=totals(c);
 // Campaign.tick sets every site's speed and pause from the active one; all of them get their own back afterwards.
 const kept=c.sites.map(site=>({sim:site.sim,speed:site.sim.speed,paused:site.sim.paused}));
 // An event already announced when the town was saved waits too: resolving it while away would also re-arm nextEvent
 // (Simulation.resolveEvent) and let the next storms or raids start before the player is back.
 for(const site of c.sites){const s=site.sim;s.nextEvent=Math.max(s.nextEvent,s.time)+game;if(s.pendingEvent)s.pendingEvent.at=Math.max(s.pendingEvent.at,s.time)+game;}
 active.speed=OFFLINE.speed;active.paused=false;
 const start=active.time,end=start+game,began=clock();let guard=0;
 while(active.time<end-1e-6&&guard++<game*8){c.tick(.25);if(guard%16===0&&clock()-began>budgetMs)break;}
 // Time not run hands its share of the event delay back.
 const done=active.time-start,unused=Math.max(0,game-done);if(unused)for(const site of c.sites){const s=site.sim;s.nextEvent-=unused;if(s.pendingEvent)s.pendingEvent.at-=unused;}
 for(const k of kept){k.sim.speed=k.speed;k.sim.paused=k.paused;k.sim.soundEvents=[];}
 const after=totals(c);
 return {real:capped,game:done,days:done/80,capped:real>OFFLINE.maxReal,limited:unused>0,income:Math.round(after.revenue-before.revenue),money:Math.round(after.money-before.money),produced:after.produced-before.produced,stars:after.stars-before.stars};
}
