// Round 3 (U, 2026-10-02): regression for the screen side of audit G3-06, G3-06b, G3-08, G3-11 and G3-13.
// Uses the real ui-rules / campaign code with the formulas Game.tsx renders, and checks Game.tsx reads them.
// node tests/fix-20260930/g3-screens.mjs
import {readFileSync} from 'node:fs';
import {load,run,calm} from '../audit-2/_fixture.mjs';
import {ledgerSnapshot,ledgerDiff,blockHint} from '../../src/app/game/ui-rules.js';
import {Simulation,BUILDINGS} from '../../src/app/game/simulation.js';
import {realSeconds} from '../../src/app/game/game-time.js';

const game=readFileSync(new URL('../../src/app/game/Game.tsx',import.meta.url),'utf8');
const fails=[];const check=(id,ok,detail)=>{console.log((ok?'PASS ':'FAIL ')+id+' :: '+JSON.stringify(detail));if(!ok)fails.push(id);};

// G3-06: a site with every facility off. The ledger covers every site (shared money/output), so money change splits into
// summed sales income - summed expenses + other, and other stays near freight fees instead of other sites' sales.
{const c=load(31);calm(c);c.switchSite('site-2');c.active.paused=false;for(const v of c.sites)v.sim.speed=1;const s=c.active;
 for(const b of s.buildings)s.setOperation(b.id,false);for(const k of Object.keys(s.autoSell))s.autoSell[k]=false;
 const start=ledgerSnapshot(s,c);run(c,40);const now=ledgerSnapshot(s,c),diff=ledgerDiff(start,now);
 const income=now.income-start.income,expenses=now.expenses-start.expenses,other=diff.money-income+expenses;
 check('G3-06 ledger scope = all sites, other money is not the other sites\' sales',start.sites===c.sites.length&&Math.abs(other)<Math.max(200,income*.05),{sites:start.sites,moneyChange:diff.money,income,expenses,other});
 check('G3-06 ledger stock is the sum of every site',Object.keys(now.stock).every(k=>Math.abs(now.stock[k]-c.sites.reduce((n,v)=>n+(v.sim.stock[k]||0),0))<1e-6),{grain:now.stock.grain});
 // With the rules' own books (R team, simulation.js ledger()) the site with nothing running shows nothing made or sold.
 if(typeof s.ledger==='function'){const T=s.ledger().today,made=T.items.reduce((n,r)=>n+r.made,0),sold=T.items.reduce((n,r)=>n+r.sold,0);
  check('G3-06 site books of an idle site: nothing made, sold or earned',made===0&&sold===0&&T.income===0&&Math.abs(T.other)<1,{made,sold,income:T.income,other:T.other});
  check('Game.tsx ledger reads s.ledger() when present',/typeof s\.ledger==='function'&&!ledgerAll\?s\.ledger\(\):null/.test(game),{});}
 check('Game.tsx passes the campaign to ledgerSnapshot',/ledgerSnapshot\(s,campaign\.current\)/.test(game)&&!/ledgerSnapshot\(s\)/.test(game),{});}
// G3-06b: today's net after a trade negotiation booked once.
{const c=load(13);calm(c);c.active.paused=false;const s=c.active;const d0=s.day;while(s.day===d0)c.tick(.25);
 const before=s.money,start=ledgerSnapshot(s,c);s.sanctionUntil=s.time+100;const r=s.negotiateSanction();
 const now=ledgerSnapshot(s,c),today=ledgerDiff(start,now),shown=today.money+start.income-start.expenses,truth=s.money-before-(s.budget.expenses-r.cost)+(start.income||0);
 check('G3-06b 오늘 지금까지 net counts a negotiation once',r.ok&&Math.round(shown)===Math.round(truth),{cost:r.cost,shown,truth});
 check('Game.tsx today net uses start income and start expenses',game.includes('today.money+l!.start.income-l!.start.expenses'),{});}
// G3-08: the sapling time in the facility advice follows the speed.
{const rows=[1,2,4].map(speed=>{const s=new Simulation('river',null,{nation:'estern'});s.speed=speed;return {speed,shown:+(blockHint('자원 고갈',s).match(/(\d+)초 뒤 자람/)?.[1]??NaN),real:realSeconds(160,{speed})};});
 check('G3-08 sapling seconds match the speed',rows.every(r=>r.shown===r.real),{rows});
 check('Game.tsx facility advice passes the simulation',game.includes('||blockHint(b.status,s)}</p>')&&!/blockHint\([a-z]\.status\)/.test(game),{});}
// G3-11: upgrade and specialize buttons use the stock free of reservations, like the actions.
{const c=load(13);calm(c);const s=c.active;const b=s.buildings.find(v=>BUILDINGS[v.type].period&&(v.level||1)<3&&v.health>=100),item=s.upgradeItem(b);
 const w=s.workers.find(v=>!v.task),target=s.buildings.find(v=>v!==b&&BUILDINGS[v.type].period);s.stock[item]=3;w.task={kind:'supply',item,amount:2,building:target.id,targetId:target.id,carried:false};s.money=Math.max(s.money,s.upgradeCost(b)+100);
 const enabled=!(s.money<s.upgradeCost(b)||s.availableStock(item)<3),r=s.upgrade(b.id);
 check('G3-11 upgrade button disabled exactly when the action refuses',enabled===r.ok,{enabled,result:r.ok,available:s.availableStock(item)});
 check('Game.tsx upgrade/specialize use the rules upgradeShort/specializeShort and show the reason',game.includes('s.upgradeShort(b)')&&game.includes('s.specializeShort(b,b.race)')&&game.includes('action-short'),{});
 {const q=readFileSync(new URL('../../src/app/game/QualityPanels.tsx',import.meta.url),'utf8');check('market sell buttons use stock free of reservations',(q.match(/s\.availableStock\(id\)<1/g)||[]).length===2&&!/s\.stock\[id\]<1/.test(q),{});}
 check('Game.tsx upgrade/specialize read availableStock',game.includes("s.availableStock(item)<3")&&game.includes("s.availableStock('plank')<2")&&!game.includes('s.stock[item]<3')&&!game.includes('s.stock.plank<2'),{});}
// G3-13: after 패권국 the goals, finale and campaign screens render campaign.legacy().
{const c=load(32);const l=c.legacy();const panel=readFileSync(new URL('../../src/app/game/CampaignPanel.tsx',import.meta.url),'utf8'),q=readFileSync(new URL('../../src/app/game/QualityPanels.tsx',import.meta.url),'utf8');
 check('G3-13 legacy goals exist after completion',l.active&&l.goals.length===5,{score:l.score});
 check('G3-13 goals window, finale and campaign window show LegacyGoals',(game.match(/<LegacyGoals /g)||[]).length>=2&&panel.includes('<LegacyGoals ')&&q.includes('c?.legacy?.()'),{});}
console.log(`\n[g3-screens] ${fails.length?'FAIL '+fails.join(', '):'all pass'}`);process.exit(fails.length?1:0);
