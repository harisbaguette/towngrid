// Offline progress (Town Star's "Update Town Offline", docs/TOWNSTAR_RULES.md): a town continued from the browser's save
// runs the real time it was closed, up to half an hour, before the player sees it. Production, hauling, auto-sales and
// shipments go on; no storm, raid or other event starts while away (each site's next event moves back by the time away).
import {BASE_TIME_SCALE} from './game-time.js';

export const OFFLINE={maxReal:1800,minReal:60,speed:4};
/** Real seconds since a raw save was written, from the save wrapper's savedAt (0 when unknown or in the future). */
export function awaySeconds(raw,now=Date.now()){
 try{const at=Date.parse(JSON.parse(raw)?.savedAt);return Number.isFinite(at)?Math.max(0,(now-at)/1000):0;}catch{return 0;}
}
const totals=c=>({money:c.treasury.money,revenue:c.treasury.totalRevenue||0,produced:Object.values(c.treasury.produced||{}).reduce((n,v)=>n+(+v||0),0),stars:c.league?.total||0});
/** Run `real` seconds of time away on a campaign; returns what changed, or null when too short to bother. */
export function catchUp(c,real){
 if(!c||!(real>=OFFLINE.minReal))return null;
 const capped=Math.min(real,OFFLINE.maxReal),game=capped*BASE_TIME_SCALE,active=c.active,speed=active.speed,paused=active.paused,before=totals(c);
 for(const site of c.sites)site.sim.nextEvent=Math.max(site.sim.nextEvent,site.sim.time)+game;
 active.speed=OFFLINE.speed;active.paused=false;
 const end=active.time+game;let guard=0;
 while(active.time<end-1e-6&&guard++<game*8){c.tick(.25);}
 active.speed=speed;active.paused=paused;for(const site of c.sites){site.sim.soundEvents=[];}
 const after=totals(c);
 return {real:capped,game,days:game/80,capped:real>OFFLINE.maxReal,income:Math.round(after.revenue-before.revenue),money:Math.round(after.money-before.money),produced:after.produced-before.produced,stars:after.stars-before.stars};
}
