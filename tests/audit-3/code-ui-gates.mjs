// Audit 3 (G3, code): buttons enabled by raw stock while the action checks stock free of workers' reservations
// (563bcc9 moved upgrade/specialize to availableStock; Game.tsx still enables them with s.stock).
// node tests/audit-3/code-ui-gates.mjs
import fs from 'node:fs';
import {load,calm,expectBug,finish} from '../audit-2/_fixture.mjs';
import {BUILDINGS} from '../../src/app/game/simulation.js';
const c=load(13);calm(c);const s=c.active;
const b=s.buildings.find(v=>BUILDINGS[v.type].period&&(v.level||1)<3&&v.health>=100),item=s.upgradeItem(b);
const w=s.workers.find(v=>!v.task),target=s.buildings.find(v=>v!==b&&BUILDINGS[v.type].period);
s.stock[item]=3;w.task={kind:'supply',item,amount:2,building:target.id,targetId:target.id,carried:false};/* injected: a resident about to carry 2 of the 3 to a facility (the normal supply task shape) */
s.money=Math.max(s.money,s.upgradeCost(b)+100);
// Updated with the fix (R team, 2026-10-02): the rule exports the gate the action itself uses (simulation.js upgradeShort,
// specializeShort), so the probe checks (1) that gate against the action and (2) that Game.tsx enables the buttons by it
// or by the same reserved-free stock, never by raw s.stock. The old probe copied Game.tsx's raw-stock condition inline.
const gate=s.upgradeShort(b),label=Math.floor(s.availableStock(item))+'/3',r=s.upgrade(b.id);
s.stock.plank=2;const pw=s.workers.find(v=>!v.task&&v!==w);pw.task={kind:'supply',item:'plank',amount:1,building:target.id,targetId:target.id,carried:false};/* injected: 1 of the 2 planks reserved */
const specGate=s.specializeShort(b,b.race),spec=s.specialize(b.id,b.race);
const tsx=fs.readFileSync(new URL('../../src/app/game/Game.tsx',import.meta.url),'utf8'),buttons=tsx.split('\n').filter(l=>/upgradeCost\(b\)|specializeCost\(b\)|시설 특화 작업반/.test(l)).join('\n');
const rawGate=/s\.stock\[item\]\s*<\s*3|s\.stock\.plank\s*<\s*2|Math\.floor\(s\.stock\[item\]/.test(buttons);
expectBug('G3-11 the upgrade button is enabled and reads "'+label+'" but the action refuses: 2 of the 3 are already reserved for a delivery',!gate!==r.ok||!specGate!==spec.ok||rawGate,{type:b.type,item,stock:s.stock[item],available:s.availableStock(item),gate,label,result:r,specializeGate:specGate,specialize:spec,gameTsxRawStockGate:rawGate});
finish('code-ui-gates');
