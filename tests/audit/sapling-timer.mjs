// Tile panel promises "묘목 성장 중 · 약 N일" from growAt, but saplings only turn into trees at a day change.
import {Campaign,run,home,expectBug,finish} from './_harness.mjs';
const c=new Campaign(),s=home(c);s.build('warehouse',11,12);s.nextEvent=1e9;run(c,1);/* just after day 1 starts */
const t=s.tiles.find(t=>s.ownedAt(t.x,t.z)&&!t.nature&&!s.at(t.x,t.z)&&!s.roads.has(t.x+','+t.z));const r=s.plant(t.x,t.z);
const shown=Math.max(0,Math.ceil((t.growAt-s.time)/80)),planted=s.time;let grown=null;run(c,400,()=>{if(grown===null&&t.nature==='tree')grown=s.time;});
const actualDays=+((grown-planted)/80).toFixed(2);
expectBug('Y1-sapling-eta-understated',r.ok&&actualDays>shown,{shownDays:shown,actualDays,code:'Game.tsx tile panel ceil((growAt-time)/80); simulation.js:149 growth only on day change'});
finish('sapling-timer');
