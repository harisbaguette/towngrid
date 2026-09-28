// Save/load round trips at awkward moments, plus save size growth per site (browser quota is checked
// separately in tests/audit/browser-first-session.mjs). Uses real ticks; state set directly is labelled.
import assert from 'node:assert/strict';
import {Campaign,run,home,expectBug,finish} from './_harness.mjs';
import {encodeSave,decodeSave} from '../../src/app/game/persistence.js';
import {startRaid} from '../../src/app/game/encounters.js';
import {createShowcase} from '../../src/app/game/simulation.js';
const round=c=>{const before=c.save();const raw=encodeSave(before);const back=new Campaign({saved:decodeSave(raw)});return {ok:JSON.stringify(back.save())===JSON.stringify(before),size:raw.length,back};};
const cases=[];
// 1) mid-raid with guards and attackers at speed 4
{const c=new Campaign({demo:true}),s=c.active;s.speed=4;s.rank=22;startRaid(s);s.mobilize();run(c,6);let r;try{r=round(c);}catch(e){r={ok:false,error:e.message};}cases.push(['mid-raid speed4',r.ok,r.error]);}
// 2) family cart on the river detour (remaining 100)
{const c=new Campaign(),s=home(c);s.build('warehouse',11,12);s.build('house',11,14);s.contracts=2;s.debt=0;s.money=2000;s.stock.wood=40;s.stock.grain=60;/* state set directly */
 s.rescue();s.rescue();s.rescue();const detour=s.rescue('river');run(c,1);let r;try{r=round(c);}catch(e){r={ok:false,error:e.message};}cases.push(['rescue river detour',detour.ok&&r.ok,r.error||detour.error]);}
// 3) freight route ambushed while speed 4 (ambush counts below zero)
{const c=new Campaign({demo:true});c.active.speed=4;for(const route of c.routes)route.ambush=0.3;run(c,1);let r;try{r=round(c);}catch(e){r={ok:false,error:e.message};}cases.push(['route ambush speed4',r.ok,r.error,c.routes.map(v=>v.ambush)]);}
// 4) export carts on the road + pending storm
{const c=new Campaign(),s=home(c);s.build('warehouse',11,12);s.stock.wood=60;s.sell('wood',10);s.sell('wood',1);s.pendingEvent={type:'storm',at:s.time+15};run(c,3);let r;try{r=round(c);}catch(e){r={ok:false,error:e.message};}cases.push(['carts + pending storm',r.ok,r.error]);}
for(const x of cases)console.log(JSON.stringify(x));
expectBug('S1-roundtrip-failure',cases.some(x=>!x[1]),cases.filter(x=>!x[1]));
// Save size per fully built site (showcase layout) to estimate the localStorage footprint (SAVE + RECOVERY + BACKUP copies).
const sizes=[];for(const n of [1,4,8,16,24]){const c=new Campaign({demo:true});while(c.sites.length<n){const sim=createShowcase();const id='site-'+c.nextSite++;c.attach({id,name:'측정 '+id,nation:'estern',territory:false,unrest:10,sim});}run(c,20);const raw=encodeSave(c.save());sizes.push({sites:n,saveChars:raw.length,threeCopiesMB:+(raw.length*3*2/1048576).toFixed(2)});}
console.log('save size',JSON.stringify(sizes));
finish('save-edges');
