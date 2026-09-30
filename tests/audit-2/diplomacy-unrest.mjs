// audit-2: late council/diplomacy loop on real bot saves (fixtures/rank*.json). Only paid player actions are used.
import fs from 'node:fs';
import {load,run,calm,expectBug,finish} from './_fixture.mjs';
// Since the 2026-09-29 fix the site list (CampaignPanel 거점 현황) prints campaign.siteStatus causes and the emerging-state tab
// prints every open order (stateOrders) with a send-all button (tradeAll). U2/U4 now ask whether the screen shows the rule.
const panel=fs.readFileSync(new URL('../../src/app/game/CampaignPanel.tsx',import.meta.url),'utf8'),qp=fs.readFileSync(new URL('../../src/app/game/QualityPanels.tsx',import.meta.url),'utf8');
import {RANKS,NATIONS} from '../../src/app/game/world.js';
// U1 welfare (campaign.js council 'welfare'): 300G + bread 6 lowers EVERY site's unrest by 12 and ends strikes, with no cooldown.
// Late income makes the whole unrest / independence threat a few clicks: measure the clicks and cost to take all sites from 60 to 0.
{const c=load(29);calm(c);const s=c.home.sim;for(const v of c.sites)v.unrest=60;c.worldDay();const before=c.support,m0=c.treasury.money;let clicks=0;
 while(c.sites.some(v=>v.unrest>0)&&clicks<20&&c.council('welfare').ok)clicks++;const after=c.sites.map(v=>Math.round(v.unrest)),spent=Math.round(m0-c.treasury.money);c.worldDay();
 expectBug('U1 a few welfare clicks erase unrest on every site; cost is a few % of one day of income, no cooldown',after.every(v=>v<=5)&&spent<s.budget.lastIncome*.1,{sites:c.sites.length,unrestBefore:60,unrestAfterClicks:after,supportBefore:Math.round(before),welfareClicks:clicks,cash:spent,bread:clicks*6,homeIncomeLastDay:s.budget.lastIncome,supportNextDay:Math.round(c.support),stateInjection:'unrest set to 60 on every site'});}
// U2 hidden food rule: a site whose own warehouse holds fewer than 4 bread+grain+fish gains +4 unrest a day.
{const c=load(22);calm(c);c.treasury.money=1e6;const b=c.sites.find(v=>v.id!==c.homeId);for(const r of ['bread','grain','fish'])b.sim.stock[r]=0;b.unrest=20;const u0=b.unrest;c.worldDay();c.worldDay();c.worldDay();const hungry=b.unrest-u0;
 b.sim.stock.grain=4;b.unrest=20;c.worldDay();c.worldDay();c.worldDay();const fed=b.unrest-20;
 const shown=panel.includes('siteStatus(')&&b.sim&&c.unrestCauses(b).length>0;b.sim.stock.grain=0;const named=c.unrestCauses(b).some(v=>v.id==='food'&&v.delta===4);
 expectBug('U2 branch unrest rises 4-5 a day only because its warehouse lacks 4 food, a rule no screen states',hungry>=12&&fed<=3&&!(shown&&named),{shownOnScreen:shown,foodCauseNamed:named,site:b.id,unrestGain3DaysNoFood:hungry,unrestGain3DaysWith4Grain:fed,stateInjection:'food stock and unrest set, then 3 daily ticks'});}
// U3 recognition: the six recognitions asked at ranks 28/29/32 can all be bought the moment rank 25 opens envoys.
// The fixture is the current bot at rank 26; the rule check tries to buy six envoys at once on it.
{const c=load(26);calm(c);c.treasury.money=1e6;c.home.sim.stock.car=50;const before=c.recognition.length;for(const id of Object.keys(NATIONS).filter(id=>NATIONS[id].playable&&id!==c.home.nation))c.council('recognition',id);const burst=c.recognition.length-before;const r=RANKS.filter(v=>v.requirements.some(q=>q[0]==='recognition')).map(v=>v.id+':'+v.requirements.find(q=>q[0]==='recognition')[1]);
 expectBug('U3 recognition 2/4/6 across three ranks is already 6 when rank 26 is reached (bought in one go)',c.recognition.length>=6||burst>1,{recognitionAtRank26:c.recognition.length,envoysBoughtInOneBurst:burst,asked:r,envoyCost:'1200G + car 1',homeIncomeLastDay:c.home.sim.budget.lastIncome});}
// U4 emerging-state trade orders: 1.45x list price, no market pressure; limited by free export vehicles only.
{const c=load(29);calm(c);const s=c.home.sim;const m0=c.treasury.money;let ok=0,fail={},importCost=0;const orders={};const states=c.newStates.filter(v=>!v.dissolved);
 run(c,80,(cc,i)=>{if(i%8)return;for(const st of states){if(st.lastTradeDay===c.lastWorldDay)continue;const o=c.stateOrder(st);if(s.availableStock(o.item)<o.amount){const b=s.buy(o.item,Math.min(100,o.amount));if(b.ok)importCost+=b.cost;}const r=c.stateAction('trade',st.id);if(r.ok){ok++;orders[st.id]=o.reward;}else fail[r.error]=(fail[r.error]||0)+1;}});
 const paid=c.newStates.reduce((n,v)=>n,0)+Object.values(orders).reduce((n,v)=>n+v,0);
 const table=qp.includes('stateOrders()')&&qp.includes('tradeAll()');
 expectBug('U4 emerging-state orders pay a large share of a day of income but each of dozens of states is picked one by one in a dropdown',states.length>=30&&paid>s.budget.lastIncome*.3&&!table,{orderTableOnScreen:table,states:states.length,ordersSentInOneDay:ok,orderValue:paid,homeIncomeLastDay:s.budget.lastIncome,importsBoughtToFillOrders:Math.round(importCost),failures:fail});}
finish('diplomacy-unrest');
