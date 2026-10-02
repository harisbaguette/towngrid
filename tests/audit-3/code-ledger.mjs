// Audit 3 (G3, code): the ledger (Game.tsx trackLedger + ui-rules ledgerSnapshot/ledgerDiff) compares campaign-wide
// counters (money, produced, sold are SHARED through campaign.js attach) with the numbers of one site (stock, budget).
// With more than one site the ledger of the site on screen shows the other sites' production as "사용" and their sales
// as "건설·수리·기타".  node tests/audit-3/code-ledger.mjs
import {load,run,calm,expectBug,finish} from '../audit-2/_fixture.mjs';
import {ledgerSnapshot,ledgerDiff} from '../../src/app/game/ui-rules.js';
const c=load(31);calm(c);c.switchSite('site-2');c.active.paused=false;for(const s of c.sites)s.sim.speed=1;
const s=c.active;/* the site on screen: switch every facility off so it makes, uses and sells nothing */
for(const b of s.buildings)s.setOperation(b.id,false);for(const k of Object.keys(s.autoSell))s.autoSell[k]=false;
const start=ledgerSnapshot(s),income0=s.budget.income,exp0=s.budget.expenses,dayStart=s.day;
run(c,40);/* 40 game seconds, same day */
const now=ledgerSnapshot(s),diff=ledgerDiff(start,now);
const made=diff.items.reduce((n,r)=>n+r.made,0),used=diff.items.reduce((n,r)=>n+r.used,0);
const income=s.budget.income-income0,expenses=s.budget.expenses-exp0,other=diff.money-income+expenses;
console.log(JSON.stringify({sites:c.sites.length,sameDay:s.day===dayStart,activeWorking:s.buildings.filter(b=>b.working).length,ledgerMade:made,ledgerUsed:used,top:diff.items.slice(0,4),moneyChange:diff.money,siteIncome:income,siteExpenses:expenses,shownAsOther:other}));
expectBug('G3-06 the ledger of a site with every facility off shows the other sites\' output as made/used and their money as 건설·수리·기타',made>0&&(used>0||other!==0),{made,used,shownAsOther:other});
// (2) "오늘 지금까지" net (Game.tsx ledger: today.money + start.income - budget.expenses) subtracts an expense booked after
//     the day's snapshot twice: once in the money change and again in budget.expenses (negotiateSanction books both).
{const c=load(13);calm(c);c.active.paused=false;const s=c.active;const d0=s.day;while(s.day===d0)c.tick(.25);/* a fresh day */
 const before=s.money,start=ledgerSnapshot(s);s.sanctionUntil=s.time+100;/* injected: a trade sanction is on */const r=s.negotiateSanction();
 const today=ledgerDiff(start,ledgerSnapshot(s)),shown=today.money+(start.income||0)-(s.budget.expenses||0),truth=s.money-before-(s.budget.expenses-r.cost)+(start.income||0);
 console.log(JSON.stringify({negotiated:r,shownNet:shown,moneyChangeSinceDayStartPlusBooked:truth}));
 expectBug('G3-06b the ledger\'s "오늘 지금까지" net counts a trade negotiation twice',r.ok&&Math.round(truth-shown)===r.cost,{cost:r.cost,shown,expected:truth});}
finish('code-ledger');
