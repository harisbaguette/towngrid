// G1 audit (2026-09-30): the half-speed clock (game-time.js BASE_TIME_SCALE 0.5). Checks the real-time numbers the
// players read (docs table 16, notices, hints, descriptions) against the clock, and measures the lord's order cadence,
// the only progress gate a player cannot speed up by building. Run: node tests/audit-3/g1-game-time.mjs
import fs from 'node:fs';
import {BASE_TIME_SCALE,realSeconds,remainingSeconds,advanceGame} from '../../src/app/game/game-time.js';
import {Simulation,BUILDINGS,RESOURCES,CONTRACT_WAIT,FIRST_EVENT} from '../../src/app/game/simulation.js';
import {operationHint} from '../../src/app/game/proximity.js';
import {blockHint} from '../../src/app/game/ui-rules.js';
import * as visuals from '../../src/app/game/production-visuals.js';
import {Campaign,expectBug,finish} from '../audit-2/_fixture.mjs';
const root=new URL('../../',import.meta.url);
const at=(speed)=>({speed});// a stand-in sim for remainingSeconds: only the speed is read

// T0 the 1x table in docs/BALANCE_PATCH_20260928.md 16 against the code.
{const doc=fs.readFileSync(new URL('docs/BALANCE_PATCH_20260928.md',root),'utf8');const sec=doc.slice(doc.indexOf('## 16.'),doc.indexOf('## 17.'));
 const mmss=s=>{const m=/(\d+)분(?: (\d+)초)?|(\d+)초/.exec(s);return m?(m[1]?+m[1]*60+(+m[2]||0):+m[3]):null;};
 const row=name=>{const l=sec.split('\n').find(v=>v.includes(name));return l?mmss(l.split('|')[2]):null;};
 const want={'하루':realSeconds(80),'기본 우물 한 주기':realSeconds(BUILDINGS.well.period),'기본 밀밭 한 주기':realSeconds(BUILDINGS.field.period),'다음 영주 납품 주문':realSeconds(CONTRACT_WAIT),'첫 사건 예고':realSeconds(FIRST_EVENT)};
 const off=Object.entries(want).filter(([k,v])=>row(k)!==v).map(([k,v])=>k+' 문서 '+row(k)+'초 · 코드 '+v+'초');
 expectBug('G1-G0 the 1x real-time table (balance doc 16) disagrees with the code',off.length>0,{off,scale:BASE_TIME_SCALE});}

// T1 hints and descriptions that name a duration: the number must be the real seconds the clock will take.
{const sapling=160;const s=new Simulation('river',null,{nation:'estern',provinceId:'estern-5'});
 const hint=operationHint('자원 고갈',s),n=+(/(\d+)초 뒤 자람/.exec(hint)||[])[1];
 expectBug('G1-G1 the depleted-camp hint gives the sapling time in game seconds (half the real wait at 1x)',n!==realSeconds(sapling),{hint:hint.match(/묘목[^)]*\)/)?.[0],realAt1x:realSeconds(sapling)});
 const text=typeof visuals.describeFacility==='function'?visuals.describeFacility('windpump',s):BUILDINGS.windpump.description,w=+(/(\d+)초간/.exec(text)||[])[1];
 expectBug('G1-G2 the wind pump card gives its watering window in game seconds (the card timer counts real seconds)',w!==realSeconds(60),{text:text.slice(0,40),realAt1x:realSeconds(60)});
 // The same hint reached through the UI helper that has no simulation (Game.tsx, Operations.tsx: blockHint(status)).
 s.speed=4;const ui=blockHint('자원 고갈'),u=+(/(\d+)초 뒤 자람/.exec(ui)||[])[1];
 expectBug('G1-G3 the facility-card hint (blockHint, no simulation) shows the 1x sapling time at every speed',Number.isFinite(u)&&u!==remainingSeconds(sapling,s),{speed:4,shown:u,realAt4x:remainingSeconds(sapling,s)});}

// T2 every "N초" literal in game code that is not produced by the clock helpers (static sweep).
{const dir=new URL('src/app/game/',root),found=[];
 for(const f of fs.readdirSync(dir).filter(f=>/\.(js|tsx)$/.test(f))){const src=fs.readFileSync(new URL(f,dir),'utf8');for(const m of src.matchAll(/['"`][^'"`\n]*?\d+초[^'"`\n]*['"`]/g))found.push(f+': '+m[0].slice(0,60));}
 const allowed=[/6초마다 자동 저장/,/하루 2분 40초/,/50초 연속|60초 운영|120초 운영/];// real-time autosave, the explicit 1x note, trial names rebuilt by nextTrial
 const bad=found.filter(v=>!allowed.some(a=>a.test(v)));
 expectBug('G1-G4 a game-code string still names a fixed number of seconds that the half-speed clock does not match',bad.length>0,{bad,allowed:found.length-bad.length});}

// T3 the lord's order cadence at 1x: goods in stock, every order sent the moment it is allowed (stock set directly).
{const c=new Campaign({nation:'estern',provinceId:'estern-5'}),s=c.active;s.nextEvent=1e12;s.build('warehouse',11,12);s.build('house',11,14);for(const r of Object.keys(RESOURCES))s.stock[r]=200;
 const arrivals=[];let seen=0,real=0;while(real<1800){advanceGame(s,.5);real+=.5;if(s.contractStatus().ready)s.fulfill();if(s.contracts>seen){seen=s.contracts;arrivals.push(real);}}
 const gaps=arrivals.slice(1).map((v,i)=>Math.round(v-arrivals[i]));
 const need=[2,6,8,10,19,27,30],ranks=[2,7,8,10,20,24,25];
 const minReal=need.map((n,i)=>({rank:ranks[i],contracts:n,minRealMinutes:+(((n-1)*(gaps[0]||0))/60).toFixed(1)}));
 console.log('lord order cadence (real s at 1x)',JSON.stringify({firstArrival:Math.round(arrivals[0]),gaps:gaps.slice(0,5),perOrder:gaps[0],minRealToReach:minReal}));
 expectBug('G1-G5 the lord order cadence is not the documented 2:40 plus the delivery trip',!(gaps[0]>=realSeconds(CONTRACT_WAIT)&&gaps[0]<=realSeconds(CONTRACT_WAIT)+120),{gaps:gaps.slice(0,5),documentedWait:realSeconds(CONTRACT_WAIT)});}
finish('g1-game-time');
