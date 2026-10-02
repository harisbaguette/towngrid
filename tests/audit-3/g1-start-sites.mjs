// G1 audit (2026-09-30): the non-capital start candidates (5 per playable nation) and the first 20 real minutes.
// Static: the production factor of the early facilities on the free tiles of the starting land (tileMultiplier x placement).
// Tutorial path: the in-game guide's order on fixed tiles, real ticks, first promotion in real seconds at 1x.
// Bot: the reference player of tests/full-campaign.mjs (instrumented, see _g1-bot.mjs) for 20 real minutes from each start.
// Run: node tests/audit-3/g1-start-sites.mjs   (--rows prints every candidate)
import {Campaign} from '../../src/app/game/campaign.js';
import {NATIONS} from '../../src/app/game/world.js';
import {startingProvinces,defaultStartingProvince} from '../../src/app/game/starting-sites.js';
import {realSeconds} from '../../src/app/game/game-time.js';
import {BIOMES} from '../../src/app/game/biome-data.js';
import {expectBug,finish} from '../audit-2/_fixture.mjs';
import {runBot} from './_g1-bot.mjs';
const REAL_MIN=20,GAME=REAL_MIN*60*.5;// game seconds in 20 real minutes at 1x (BASE_TIME_SCALE 0.5)
const avg=a=>+(a.reduce((n,v)=>n+v,0)/a.length).toFixed(2);
function statics(nation,id){const c=new Campaign({nation,provinceId:id}),s=c.active,own=s.tiles.filter(t=>s.ownedAt(t.x,t.z)),free=own.filter(t=>!t.nature&&t.terrain!=='water');
 const f=type=>avg(free.map(t=>s.tileMultiplier(type,t.x,t.z)*s.placementEffects(type,t.x,t.z).speed));
 return {id,eco:s.layout.ecology,well:f('well'),field:f('field'),mill:f('mill'),wood:own.filter(t=>t.nature==='tree').reduce((n,t)=>n+t.remaining,0)};}
function tutorial(nation,id){const c=new Campaign({nation,provinceId:id}),s=c.active;s.nextEvent=1e12;
 for(const [t,x,z] of [['warehouse',11,12],['house',11,14],['well',13,12],['field',13,13],['lumber',9,10]])if(!s.build(t,x,z).ok)return {error:t};
 for(let i=0;i<4*900;i++){c.tick(.25);if(s.contractStatus().ready)s.fulfill();const p=s.promotion();if(p?.ready){s.promote();return {firstPromotionRealSeconds:Math.round(realSeconds(s.time)),grainAt:s.produced.grain||0};}}
 return {firstPromotionRealSeconds:null};}
const rows=[];
for(const nation of Object.keys(NATIONS)){if(!NATIONS[nation].playable)continue;const def=defaultStartingProvince(nation).id;
 for(const p of startingProvinces(nation)){const st=statics(nation,p.id),bot=await runBot({nation,provinceId:p.id,gameSeconds:GAME});
  rows.push({...st,nation,isDefault:p.id===def,rank20:bot.rank,revenue20:bot.revenue,grain20:bot.produced.grain||0,money20:bot.money});}}
if(process.argv.includes('--rows'))for(const r of rows)console.log(JSON.stringify(r));
const meadow=rows.filter(r=>r.eco==='meadow'),base={well:avg(meadow.map(r=>r.well)),field:avg(meadow.map(r=>r.field))};
const byEco=Object.fromEntries(Object.keys(BIOMES).map(e=>[e,rows.filter(r=>r.eco===e)]).filter(([,v])=>v.length).map(([e,v])=>[e,{starts:v.length,well:avg(v.map(r=>r.well)),field:avg(v.map(r=>r.field)),grain20:Math.round(avg(v.map(r=>r.grain20))),rank20:avg(v.map(r=>r.rank20)),revenue20:Math.round(avg(v.map(r=>r.revenue20)))}]));
console.log('by ecology',JSON.stringify(byEco));
const harshDefaults=rows.filter(r=>r.isDefault&&(r.well<base.well*.65||r.field<base.field*.65)).map(r=>{const same=rows.filter(o=>o.nation===r.nation),best=same.reduce((a,b)=>b.grain20>a.grain20?b:a);
 return {start:r.id,eco:r.eco,well:r.well,field:r.field,meadow:base,grain20:r.grain20,bestInNation:best.id+' '+best.grain20,rank20:r.rank20,bestRank20:Math.max(...same.map(o=>o.rank20))};});
const tut=Object.fromEntries(['estern-5','estern-2','silvaen-1','miel-4','kardum-5','harren-5'].map(id=>[id+'('+rows.find(r=>r.id===id).eco+')',tutorial(id.split('-')[0],id)]));
console.log('tutorial path first promotion',JSON.stringify(tut));
expectBug('G1-S1 the default start (외곽 개척지) of some nations is a desert or snow field where wells and wheat run at about half the meadow rate',harshDefaults.length>0,{harshDefaults,tutorial:tut});
const spread=Object.values(Object.groupBy(rows,r=>r.nation)).map(v=>({nation:v[0].nation,minRank20:Math.min(...v.map(r=>r.rank20)),maxRank20:Math.max(...v.map(r=>r.rank20)),revenueRatio:+(Math.min(...v.map(r=>r.revenue20))/Math.max(...v.map(r=>r.revenue20))).toFixed(2)}));
const extreme=spread.filter(v=>v.maxRank20-v.minRank20>=2||v.revenueRatio<.6);
expectBug('G1-S2 within one nation a start candidate is extremely behind after 20 real minutes (2+ ranks or under 60% revenue of the best candidate)',extreme.length>0,{extreme,all:spread});
finish('g1-start-sites');
