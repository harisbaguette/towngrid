// Audit 3 (G3, code): buttons enabled by raw stock while the action checks stock free of workers' reservations
// (563bcc9 moved upgrade/specialize to availableStock; Game.tsx still enables them with s.stock).
// node tests/audit-3/code-ui-gates.mjs
import {load,calm,expectBug,finish} from '../audit-2/_fixture.mjs';
import {BUILDINGS} from '../../src/app/game/simulation.js';
const c=load(13);calm(c);const s=c.active;
const b=s.buildings.find(v=>BUILDINGS[v.type].period&&(v.level||1)<3&&v.health>=100),item=s.upgradeItem(b);
const w=s.workers.find(v=>!v.task),target=s.buildings.find(v=>v!==b&&BUILDINGS[v.type].period);
s.stock[item]=3;w.task={kind:'supply',item,amount:2,building:target.id,targetId:target.id,carried:false};/* injected: a resident about to carry 2 of the 3 to a facility (the normal supply task shape) */
s.money=Math.max(s.money,s.upgradeCost(b)+100);
const buttonEnabled=!(s.money<s.upgradeCost(b)||s.stock[item]<3),label=Math.floor(s.stock[item])+'/3',r=s.upgrade(b.id);
const specEnabled=!(b.specialized||s.money<s.specializeCost(b)||s.stock.plank<2);
expectBug('G3-11 the upgrade button is enabled and reads "'+label+'" but the action refuses: 2 of the 3 are already reserved for a delivery',buttonEnabled&&!r.ok,{type:b.type,item,stock:s.stock[item],available:s.availableStock(item),buttonEnabled,label,result:r,specializeButtonSameRule:specEnabled});
finish('code-ui-gates');
