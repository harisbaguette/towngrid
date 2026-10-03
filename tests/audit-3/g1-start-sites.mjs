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
// plainGround: what-if for the proposed fix (G1-S1 handoff): ice and sand tiles of the new map count as plain for the
// farm and well ground factor (infrastructure.js groundFactor), so only the biome's own fertility and moisture remain.
function tutorial(nation,id,plainGround=false){const c=new Campaign({nation,provinceId:id}),s=c.active;s.nextEvent=1e12;if(plainGround)for(const t of s.tiles)if(t.ground==='ice'||t.ground==='sand')t.ground='plain';/* what-if only */
 for(const [t,x,z] of [['warehouse',11,12],['house',11,14],['well',13,12],['field',13,13],['lumber',9,10]])if(!s.build(t,x,z).ok)return {error:t};
 for(let i=0;i<4*900;i++){c.tick(.25);if(s.contractStatus().ready)s.fulfill();const p=s.promotion();if(p?.ready){s.promote();return {firstPromotionRealSeconds:Math.round(realSeconds(s.time)),grainAt:s.produced.grain||0};}}
 return {firstPromotionRealSeconds:null};}
// S3 every start candidate (the five named provinces and every settlement square of the world grid) holds the starting
// town: the warehouse at 11,12, a field and a well beside it, and a tree and a rock on the starting land.
{const bad=[];let n=0;for(const nation of Object.keys(NATIONS)){if(!NATIONS[nation].playable)continue;for(const p of startingProvinces(nation)){n++;
  try{const c=new Campaign({nation,provinceId:p.id}),s=c.active,own=s.tiles.filter(t=>s.ownedAt(t.x,t.z));const ok=s.build('warehouse',11,12).ok&&s.build('field',13,13).ok&&s.build('well',13,12).ok;
   if(!ok||!own.some(t=>t.nature==='tree')||!own.some(t=>t.nature==='rock'))bad.push(p.id+' '+s.layout.ecology);}catch(e){bad.push(p.id+' '+e.message);}}}
 expectBug('[control] G1-S3 a start candidate cannot hold the starting town (warehouse 11,12, field, well, a tree and a rock on the owned land)',bad.length>0,{candidates:n,bad});}
const rows=[];
for(const nation of Object.keys(NATIONS)){if(!NATIONS[nation].playable)continue;const def=defaultStartingProvince(nation).id;
 // The bot plays the five named provinces of each nation (nation-1..5); the settlement squares share their biomes.
 for(const p of startingProvinces(nation).filter(p=>/^[a-z]+-[1-5]$/.test(p.id))){const st=statics(nation,p.id),bot=await runBot({nation,provinceId:p.id,gameSeconds:GAME});
  rows.push({...st,nation,isDefault:p.id===def,rank20:bot.rank,ranks20:bot.ranks,revenue20:bot.revenue,grain20:bot.produced.grain||0,money20:bot.money});}}
if(process.argv.includes('--rows'))for(const r of rows)console.log(JSON.stringify(r));
const meadow=rows.filter(r=>r.eco==='meadow'),base={well:avg(meadow.map(r=>r.well)),field:avg(meadow.map(r=>r.field))};
const byEco=Object.fromEntries(Object.keys(BIOMES).map(e=>[e,rows.filter(r=>r.eco===e)]).filter(([,v])=>v.length).map(([e,v])=>[e,{starts:v.length,well:avg(v.map(r=>r.well)),field:avg(v.map(r=>r.field)),grain20:Math.round(avg(v.map(r=>r.grain20))),rank20:avg(v.map(r=>r.rank20)),revenue20:Math.round(avg(v.map(r=>r.revenue20)))}]));
console.log('by ecology',JSON.stringify(byEco));
const harshDefaults=rows.filter(r=>r.isDefault&&(r.well<base.well*.65||r.field<base.field*.65)).map(r=>{const same=rows.filter(o=>o.nation===r.nation),best=same.reduce((a,b)=>b.grain20>a.grain20?b:a);
 return {start:r.id,eco:r.eco,well:r.well,field:r.field,meadow:base,grain20:r.grain20,bestInNation:best.id+' '+best.grain20,rank20:r.rank20,bestRank20:Math.max(...same.map(o=>o.rank20))};});
// Updated 2026-10-02 (R team): the world map now hands some provinces to other realms (territory.js), so fixed ids such as
// harren-5 may no longer be start candidates and the lookups threw after the S3 line (run-all then showed no S1/S2 line).
// The samples come from the rows: one start per ecology (a nation's default first), and every snow or desert default.
const byId=new Map(rows.map(r=>[r.id,r])),sample=[...new Map([...rows].sort((a,b)=>b.isDefault-a.isDefault).map(r=>[r.eco,r])).values()];
const tut=Object.fromEntries(sample.map(r=>[r.id+'('+r.eco+')',tutorial(r.nation,r.id)]));
const whatIf=Object.fromEntries(rows.filter(r=>r.isDefault&&['snow','desert'].includes(r.eco)).map(r=>[r.id,tutorial(r.nation,r.id,true).firstPromotionRealSeconds]));
for(const id of Object.keys(whatIf))if(!byId.has(id))throw new Error('what-if sample is not a start: '+id);
console.log('tutorial path first promotion',JSON.stringify(tut),'what-if plain ground (no double penalty)',JSON.stringify(whatIf));
expectBug('G1-S1 [infrastructure.js groundFactor · docs/BIOMES.md] the default start (외곽 개척지) of some nations is a desert or snow field where wells and wheat run at about half the meadow rate',harshDefaults.length>0,{harshDefaults,tutorial:tut,whatIfPlainGround:whatIf});
const spread=Object.values(Object.groupBy(rows,r=>r.nation)).map(v=>({nation:v[0].nation,minRank20:Math.min(...v.map(r=>r.rank20)),maxRank20:Math.max(...v.map(r=>r.rank20)),revenueRatio:+(Math.min(...v.map(r=>r.revenue20))/Math.max(...v.map(r=>r.revenue20))).toFixed(2)}));
// Revenue after 20 minutes follows the export geography of the square (a river port or fish nearby), which is intended
// variety; two whole ranks behind is the measure. Same root as S1 (kardum-1 snow: rank 4, rank 5 with plain ground).
// Updated 2026-10-02 (R team, after the S1 fix in groundFactor): the rank at the 20-minute mark flips on seconds, since
// the bot's 5th and 6th promotions land about 10 game seconds apart. neiren-3 and vesra-1 (snow) were "two ranks behind"
// at 600 s, reached that rank at 620 s against 550-570 s for the best start, and were a rank ahead at 900 s. A start two
// ranks behind at the mark is now measured by when it reaches the best start's rank (the bot plays on to 30 minutes):
// behind means more than 1.5 times the best start's time, or not at all.
const reach=(ranks,rank)=>ranks?.find(v=>v.rank>=rank)?.t??Infinity,behind=[];
for(const v of Object.values(Object.groupBy(rows,r=>r.nation))){const top=Math.max(...v.map(r=>r.rank20)),best=Math.min(...v.filter(r=>r.rank20===top).map(r=>reach(r.ranks20,top)));
 for(const r of v.filter(r=>r.rank20<=top-2)){const late=await runBot({nation:r.nation,provinceId:r.id,gameSeconds:GAME*1.5}),t=reach(late.ranks,top);
  behind.push({nation:r.nation,start:r.id,eco:r.eco,rank20:r.rank20,targetRank:top,bestSeconds:best,seconds:Number.isFinite(t)?t:null,ratio:+(t/best).toFixed(2),late:!(t<=best*1.5)});}}
const extreme=behind.filter(v=>v.late);
expectBug('G1-S2 [infrastructure.js groundFactor, root of S1] within one nation a start candidate is two ranks behind the best after 20 real minutes',extreme.length>0,{extreme,twoRanksAtMark:behind,all:spread});
finish('g1-start-sites');
