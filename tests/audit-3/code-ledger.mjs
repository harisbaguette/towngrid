// Audit 3 (G3, code): the ledger compared campaign-wide counters (money, produced, sold are SHARED through campaign.js
// attach) with the numbers of one site (stock, budget), so with more than one site the ledger of the site on screen showed
// the other sites' production as "사용" and their sales as "건설·수리·기타".  node tests/audit-3/code-ledger.mjs
// Updated with the fix (R team, 2026-10-02): the rule now keeps each site's own books (simulation.js ledger(): money the
// site itself moved, what its facilities made and its carts sold, by day). The probes below read that rule; the old ones
// measured ui-rules ledgerSnapshot/ledgerDiff, which only the screen used. G3-06u checks the screen reads the new rule.
import fs from 'node:fs';
import {load,run,calm,expectBug,finish} from '../audit-2/_fixture.mjs';
const c=load(31);calm(c);c.switchSite('site-2');c.active.paused=false;for(const s of c.sites)s.sim.speed=1;
const s=c.active;/* the site on screen: switch every facility off so it makes, uses and sells nothing */
for(const b of s.buildings)s.setOperation(b.id,false);for(const k of Object.keys(s.autoSell))s.autoSell[k]=false;
const sum=(l,k)=>l.items.reduce((n,r)=>n+r[k],0),start=s.ledger().today,own0=c.sites.map(v=>v.sim.ownMoney()),money0=c.treasury.money,dayStart=s.day;
run(c,40);/* 40 game seconds, same day */
const end=s.ledger().today,made=sum(end,'made')-sum(start,'made'),used=sum(end,'used')-sum(start,'used'),other=end.other-start.other;
const books=Math.round(c.sites.reduce((n,v,i)=>n+v.sim.ownMoney()-own0[i],0)),treasury=Math.round(c.treasury.money-money0);
console.log(JSON.stringify({sites:c.sites.length,sameDay:s.day===dayStart,activeWorking:s.buildings.filter(b=>b.working).length,ledgerMade:made,ledgerUsed:used,shownAsOther:other,top:end.items.slice(0,4),allSitesBooks:books,treasuryChange:treasury}));
expectBug('G3-06 the ledger of a site with every facility off shows the other sites\' output as made/used and their money as 건설·수리·기타 (or the sites\' books do not add up to the treasury)',made>0||used>0||other!==0||books!==treasury,{made,used,shownAsOther:other,allSitesBooks:books,treasuryChange:treasury});
// (2) "오늘 지금까지": a trade negotiation booked after the day began must count once (money -cost, expenses +cost, other 0).
{const c=load(13);calm(c);c.active.paused=false;const s=c.active;const d0=s.day;while(s.day===d0)c.tick(.25);/* a fresh day */
 const before=s.ledger().today;s.sanctionUntil=s.time+100;/* injected: a trade sanction is on */const r=s.negotiateSanction();const after=s.ledger().today;
 const counted={net:after.net-before.net,expenses:after.expenses-before.expenses,other:after.other-before.other};
 console.log(JSON.stringify({negotiated:r,counted,fullDay:!before.partial}));
 expectBug('G3-06b the ledger\'s "오늘 지금까지" net counts a trade negotiation twice',!r.ok||counted.net!==-r.cost||counted.expenses!==r.cost||counted.other!==0,{cost:r.cost,counted});}
// (3) The ledger screen (Game.tsx, U team) must not mix scopes: it reads either one site's own books (sim.ledger()) or the
//     whole campaign (ledgerSnapshot with the campaign: every site's stock and budgets with the shared counters).
{const tsx=fs.readFileSync(new URL('../../src/app/game/Game.tsx',import.meta.url),'utf8'),site=/\.ledger\(\)/.test(tsx),whole=/ledgerSnapshot\(s,campaign\.current\)/.test(tsx)&&!/ledgerSnapshot\(s\)/.test(tsx);
 expectBug('G3-06u the ledger screen still mixes one site\'s stock and budget with the campaign-shared money and output',!site&&!whole,{siteBooks:site,campaignWide:whole});}
finish('code-ledger');
