// Code audit (C): per-frame simulation cost and autosave cost on the real rank fixtures (campaign-trace.mjs saves).
// The browser loop (scene.js loop) calls campaign.tick(step<=.05) once per frame for EVERY site; Game.tsx persist()
// runs writeSave every 6 s and after every successful action. Nothing is injected except where the output says so.
import {load,calm,Campaign} from './_fixture.mjs';
import {encodeSave,writeSave,SAVE_KEY} from '../../src/app/game/persistence.js';
import {facilityRoster} from '../../src/app/game/facility-staff.js';
import {productionVisualState} from '../../src/app/game/production-visuals.js';
const ms=f=>{const t=process.hrtime.bigint();f();return Number(process.hrtime.bigint()-t)/1e6;};
const mem=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};};
const out={};
for(const rank of [13,22,31]){
 const c=load(rank);calm(c);c.active.paused=false;for(const s of c.sites)s.sim.speed=4;
 for(let i=0;i<200;i++)c.tick(.05);// warm up
 const ticks=[];for(let i=0;i<300;i++)ticks.push(ms(()=>c.tick(.05)));ticks.sort((a,b)=>a-b);
 // What the scene loop also does every frame for the active site (facility staff + production states).
 const s=c.active,frameExtra=[];for(let i=0;i<100;i++)frameExtra.push(ms(()=>{facilityRoster(s);for(const b of s.buildings)productionVisualState(b.type,b,s);}));frameExtra.sort((a,b)=>a-b);
 const store=mem();writeSave(store,c.save());const saves=[];for(let i=0;i<20;i++)saves.push(ms(()=>writeSave(store,c.save())));saves.sort((a,b)=>a-b);
 const raw=store.getItem(SAVE_KEY);
 out['rank'+rank]={sites:c.sites.length,buildings:c.sites.map(v=>v.sim.buildings.length),workers:c.sites.map(v=>v.sim.workers.length),
  tickMedianMs:+ticks[150].toFixed(2),tickP95Ms:+ticks[285].toFixed(2),frameExtraMedianMs:+frameExtra[50].toFixed(2),
  persistMedianMs:+saves[10].toFixed(1),saveChars:raw.length,perSiteChars:c.sites.map(v=>JSON.stringify(v.sim.save()).length)};
}
console.log(JSON.stringify(out,null,1));
// Scaling: the same developed home site cloned into 24 sites (the foundSite cap) shows how the save grows with the empire.
{const c=load(31);const data=c.save();const homeSite=data.sites.find(v=>v.id===data.homeId);
 const sites=Array.from({length:24},(_,i)=>i===0?homeSite:{...structuredClone(homeSite),id:'site-'+(100+i),name:homeSite.name+' '+i});
 const big={...data,sites,routes:[],homeId:homeSite.id,activeId:homeSite.id};const raw=encodeSave(big);
 console.log(JSON.stringify({syntheticNote:'24 copies of the rank31 home site (injected)',saveChars:raw.length,withRecoveryCopy:raw.length*2,withNewGameBackup:raw.length*3}));
 const store=mem();const t=ms(()=>writeSave(store,big));const t2=ms(()=>writeSave(store,big));console.log(JSON.stringify({persist24SitesMs:[+t.toFixed(0),+t2.toFixed(0)]}));
 const bc=new Campaign({saved:big});calm(bc);for(let i=0;i<100;i++)bc.tick(.05);const tk=[];for(let i=0;i<200;i++)tk.push(ms(()=>bc.tick(.05)));tk.sort((a,b)=>a-b);console.log(JSON.stringify({tick24SitesMedianMs:+tk[100].toFixed(2),tick24SitesP95Ms:+tk[190].toFixed(2)}));}
