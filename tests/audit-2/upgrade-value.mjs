// audit-2: facility upgrade (level 1 -> 3: +60% speed, simulation.js tick `1+(level-1)*.3`) costs level*90 G + 3 plank / 3 brick
// whatever the facility (simulation.js upgradeCost). Compare the gold paid per +1% output: upgrade vs building another copy.
// Dynamic check: the same facility on the rank-29 bot save, level 3 vs set to level 1 (STATE INJECTION: level only).
import {load,run,calm,expectBug,finish} from './_fixture.mjs';
import {BUILDINGS} from '../../src/app/game/simulation.js';
const cycles=(level,type)=>{const c=load(29);calm(c);const s=c.home.sim;const b=s.buildings.find(v=>v.type===type);b.level=level;for(const [k,n] of Object.entries(s.effectiveInputs(b)))s.stock[k]+=n*40;const c0=b.cycles||0;run(c,600);return (b.cycles||0)-c0;};
const rows=[];
for(const type of ['automotive','shipyard','engineworks','mithrilforge','sawmill']){const l1=cycles(1,type),l3=cycles(3,type);const c=load(29);const s=c.home.sim;const b=s.buildings.find(v=>v.type===type);b.level=1;const up=s.upgradeCost(b);b.level=2;const up2=s.upgradeCost(b);
 const gain=l1?(l3/l1-1)*100:0;rows.push({type,cyclesL1:l1,cyclesL3:l3,gainPct:Math.round(gain),upgradeGold:up+up2,goldPerPctUpgrade:+((up+up2)/Math.max(1,gain)).toFixed(1),newCopyGold:BUILDINGS[type].cost,goldPerPctNewCopy:+(BUILDINGS[type].cost/100).toFixed(1)});}
for(const r of rows)console.log(JSON.stringify(r));
const top=rows.find(r=>r.type==='shipyard');
expectBug('B1 upgrading a top-tier facility is 20x+ cheaper per unit of output than building another, so it is never a choice',top&&top.goldPerPctNewCopy/top.goldPerPctUpgrade>=20,{shipyard:top});
finish('upgrade-value');
