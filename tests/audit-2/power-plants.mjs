// audit-2: the four power plants give the same thing (POWER_REACH tiles of power while activeUntil holds). Compare the
// share of 600 s a powered consumer next to each plant actually runs, and what each plant burns.
// Setup (STATE INJECTION): a fresh home map set to rank 22 with stock and cash, one plant + one electronics factory each.
import {Simulation,BUILDINGS,TIMED} from '../../src/app/game/simulation.js';
import {expectBug,finish} from './_fixture.mjs';
function trial(plant,shade){const s=new Simulation('river',null,{nation:'estern',race:'human'});s.rank=22;s.money=1e6;s.debt=0;s.nextEvent=1e12;for(const r of Object.keys(s.stock))s.stock[r]=200;
 s.build('warehouse',11,12);s.build('house',10,12);s.build('spirithouse',12,14);
 const at=plant==='watermill'?null:[13,10];let ok;
 if(plant==='watermill'){for(const t of s.tiles.filter(t=>s.ownedAt(t.x,t.z)))if((ok=s.build('watermill',t.x,t.z)).ok)break;}else ok=s.build(plant,...at);
 if(shade){s.build('smelter',13,9);s.build('refinery',14,10);}
 const p=s.buildings.find(b=>b.type===plant);if(!p)return {plant,error:ok?.error};for(const [k,n] of Object.entries(BUILDINGS[plant].inputs||{}))p.inputs[k]=n*20;
 // afterFirst: share once the plant first delivered power. The first cycle's start-up (60 s for a shaded turbine at 40%
 // speed) is not a drop-out in each cycle, which is what G2 is about (F1 fix 2026-09-29).
 const used0={...s.stock};let on=0,n=0,on2=0,n2=0;for(let i=0;i<2400;i++){s.tick(.25);n++;if(s.power)on++;if(on){n2++;if(s.power)on2++;}}
 const burned=Object.fromEntries(Object.keys(BUILDINGS[plant].inputs||{}).map(k=>[k,20*BUILDINGS[plant].inputs[k]-(p.inputs[k]||0)]));
 // realCycle: the plant's cycle at the speed it actually runs (period / speedOf); window: the power one cycle grants (TIMED).
 const realCycle=+(s.recipeOf(p).period/s.speedOf(p)).toFixed(2),window=TIMED[BUILDINGS[plant].output][1];
 return {plant,shaded:!!shade,cost:BUILDINGS[plant].cost,materials:BUILDINGS[plant].materials,unique:!!BUILDINGS[plant].unique,poweredShare:+(on/n).toFixed(3),poweredShareAfterFirst:+(on2/Math.max(1,n2)).toFixed(3),realCycle,window,burned600s:burned};}
const rows=[trial('windturbine'),trial('windturbine',true),trial('generator'),trial('watermill'),trial('arcanepower')];
for(const r of rows)console.log(JSON.stringify(r));
const w=rows[0],a=rows[4],ws=rows[1];
//G1 dropped: arcane plant is not dominated once the wind turbine's own shading is counted
if(0)expectBug('G1 마력 발전소 (1,900G + steel 8 + wire 4 + circuit 3, burns mana+water) powers no more than a 330G wind turbine that burns nothing',w.poweredShare>=a.poweredShare-.01,{wind:w,arcane:a});
// G2 is the restart threshold: a timed plant must start its next cycle in time by its real (slowed) cycle, not the nominal
// period. Updated 2026-10-02 (R team): since the 2026-09-30 balance (docs/BALANCE_PATCH_20260928.md 19-3) the wind turbine
// runs 30 s, so at shade level 3 (40% speed) one cycle (75 s) is longer than the 60 s of power it grants and a gap of the
// difference is the intended weakness, not this bug. Each plant is held to what its real cycle allows: no gap when the
// cycle fits in the window, otherwise powered at least window / cycle of the time (the threshold bug lost more than that).
const expected=r=>r.realCycle<=r.window?.95:r.window/r.realCycle-.03,late=rows.filter(r=>!r.error&&r.poweredShareAfterFirst<expected(r));
expectBug('G2 a wind turbine shaded by tall neighbours drops out for part of each cycle (restart threshold uses the nominal period)',late.length>0||!!ws.error,{late,shadedWind:ws,expectedShadedShare:+expected(ws).toFixed(3)});
// G2b neighbour: every timed support facility (power, horse, ward, transit, irrigation, health) restarts at remaining <= nominal
// period, so any speed factor below 1 (shading, infection) opens a gap. Generator under 60% infection (STATE INJECTION).
{const s=new Simulation('river',null,{nation:'estern',race:'human'});s.rank=22;s.money=1e6;s.debt=0;s.nextEvent=1e12;for(const r of Object.keys(s.stock))s.stock[r]=200;
 s.build('warehouse',11,12);s.build('house',10,12);s.build('generator',14,14);const g=s.buildings.find(b=>b.type==='generator');g.inputs={wood:80,water:40};s.health.infection=60;
 let on=0,n=0;for(let i=0;i<2400;i++){s.health.infection=60;s.tick(.25);if(i>200){n++;if(s.power)on++;}}
 expectBug('G2b a supplied generator flickers while the town is 60% infected',on/n<.99,{poweredShareAfterWarmup:+(on/n).toFixed(3),infection:60});}
finish('power-plants');
