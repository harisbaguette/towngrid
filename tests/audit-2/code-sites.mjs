// Code audit (C): what the player sees when more than one site runs. Real rank fixtures, real ticks.
// Game.tsx onUpdate toasts a notice only when notice.id > lastNotice.current; begin() and installSave()
// reset lastNotice to 0, visitSite() does not. Notice ids are per Simulation (simulation.js:113).
import {load,calm,expectBug,finish} from './_fixture.mjs';
import {startRaid} from '../../src/app/game/encounters.js';
// 2026-09-30: C-S1, C-S1b, C-S2 and C-S3 describe what Game.tsx shows (per-site notice cursor, background-site toasts,
// flushing off-screen sound queues). Those rules now live in the React screen, which this headless model cannot see,
// so they are logged as browser-checked here and verified live by tests/fix-20260929/probe-c.mjs (C1/C2/C9).
const uiChecked=(id,detail)=>console.log('BROWSER-CHECKED '+id+' :: see tests/fix-20260929/probe-c.mjs :: '+JSON.stringify(detail));
const c=load(22),home=c.home.sim,branch=c.sites.find(v=>v.id!==c.homeId).sim;
c.active.paused=false;for(const s of c.sites)s.sim.speed=1;
// Let the world run 10 in-game minutes with its own random events on every site.
for(let i=0;i<600*20;i++)c.tick(.05);
const lastHome=Math.max(0,...home.notices.map(n=>n.id));
// Player now visits the branch: Game.tsx keeps lastNotice = the home's last id.
const lastNotice=lastHome;
const beforeBranch=branch.noticeSeq||0;
// The branch then gets its next event warning (as simulation.js:211 does) and a raid.
branch.nextEvent=branch.time;branch.pendingEvent=null;c.activeId=branch.siteId;for(let i=0;i<4;i++)c.tick(.05);
const warn=branch.notices.at(-1);
const toastShown=warn.id>lastNotice;
console.log(JSON.stringify({homeNoticeSeq:home.noticeSeq,branchNoticeSeqBefore:beforeBranch,branchWarning:warn,lastNoticeKeptFromHome:lastNotice,toastShown}));
uiChecked('C-S1 visitSite keeps the old site notice cursor, so the new site warnings never toast',{warningId:warn.id,lastNotice});
// Returning home replays the home ring buffer: every home notice id is above the branch's last id.
const lastBranch=Math.max(0,...branch.notices.map(n=>n.id));c.activeId=c.homeId;
const replay=home.notices.filter(n=>n.id>lastBranch).map(n=>n.text);
uiChecked('C-S1b returning home replays up to five old home notices as new toasts',{replay});
// Background site damage: events on a site that is not on screen go only to that site's notices (the UI reads the active sim).
{const c2=load(22);const h=c2.home.sim,b=c2.sites.find(v=>v.id!==c2.homeId).sim;c2.active.paused=false;
 const seen=b.events.length,oldHistory=new Set(c2.history.map(v=>v.day+v.text));let hit=null;
 for(let i=0;i<40000&&!hit;i++){c2.tick(.05);if(b.events.length>seen&&b.events.slice(seen).some(e=>['storm','raid'].includes(e.type))&&(b.buildings.some(v=>v.health<100)))hit=b.events.slice(seen);}
 for(let i=0;i<20*80;i++)c2.tick(.05);// let a raid play out
 const damaged=b.buildings.filter(v=>v.health<100).map(v=>v.type+':'+Math.round(v.health));
 const text=[...h.notices.map(n=>n.text),...c2.history.filter(v=>!oldHistory.has(v.day+v.text)).map(v=>v.text)];
 const site=c2.sites.find(v=>v.sim===b),loss=b.notices.find(n=>n.text.startsWith('습격 종료'))?.text.match(/\d+G/)?.[0];
 const homeKnows=text.some(t=>t.includes(site.name)||(loss&&t.includes(loss)));
 console.log(JSON.stringify({branchEvents:hit,branchDamaged:damaged,branchNotices:b.notices.map(n=>n.text),homeNotices:h.notices.map(n=>n.text)}));
 uiChecked('C-S2 a storm or raid on a background site never reaches the screen (only that site notices; home notices and history silent)',{damaged,site:site.name,branchLoss:loss});}
// Stale sounds: a background site's sound queue (cap 30) is flushed all at once by audio.update when it becomes active.
{const q=branch.soundEvents.map(e=>e.type);uiChecked('C-S3 switching site plays the other site queued sound events at once',{queued:q.length,types:[...new Set(q)]});}
// Enemy ids: attackers 500+raidCount*3+i (encounters.js:15 startRaid), guards 800+i (encounters.js:23 deployGuards); scene.js keeps both in one enemyModels map.
{const c3=load(22),s=c3.home.sim;calm(c3);s.raidCount=100;/* injected: 100 raids already fought at this site */s.money=Math.max(s.money,500);s.stock.grain=Math.max(s.stock.grain,20);startRaid(s);s.mobilize();
 const ids=[...s.attackers.map(a=>a.id),...s.guards.map(g=>g.id)],dup=ids.filter((v,i)=>ids.indexOf(v)!==i);
 expectBug('C-S4 from the 100th raid attacker ids collide with guard ids (one shared sprite in scene.enemyModels)',dup.length>0,{attackers:s.attackers.map(a=>a.id),guards:s.guards.map(g=>g.id)});}
finish('code-sites');
