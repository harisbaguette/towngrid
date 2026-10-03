// G1 audit (2026-09-30): the economy of the two expansion rounds (resources 44, facilities 24) that balance-report does not
// judge. Reads the code tables and the strict balance report itself; nothing is injected. Run: node tests/audit-3/g1-expansion-economy.mjs
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {BUILDINGS,RESOURCES,CONTRACT_POOLS,Simulation} from '../../src/app/game/simulation.js';
import {RANKS,unlockRank} from '../../src/app/game/world.js';
import {placementEffects,productionDiagnosis} from '../../src/app/game/proximity.js';
import * as I from '../../src/app/game/industry.js';
import {expectBug,finish} from '../audit-2/_fixture.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const recipeRank=(type,r)=>Math.max(unlockRank(type),r.unlock||0);
const makers=item=>Object.entries(BUILDINGS).flatMap(([t,d])=>(d.recipes||[]).filter(r=>r.output===item).map(r=>({type:t,recipe:r,rank:recipeRank(t,r),isDefault:r===d.recipes[0]})));
const expRes=Object.keys({...I.EXPANSION_RESOURCES,...I.EXPANSION2_RESOURCES}),expFac=Object.keys({...I.EXPANSION_BUILDINGS,...I.EXPANSION2_BUILDINGS});
console.log('scope',JSON.stringify({resources:expRes.length,facilities:expFac.length}));
const consumers=item=>Object.entries(BUILDINGS).flatMap(([t,d])=>[...(d.recipes||[]).filter(r=>r.inputs&&r.inputs[item]).map(r=>t+':'+r.id),...(d.materials&&d.materials[item]?[t+':materials']:[])]);

// E0 inventory: every expansion resource has a maker, and every non-final one has a consumer (recipe input or material).
const orphan=expRes.filter(r=>!makers(r).length||(!RESOURCES[r].final&&!consumers(r).length));
expectBug('G1-E0 expansion resource without a maker or (non-final) without a consumer',orphan.length>0,{orphan});

// E1 value: balance-report section 1 (its own per-tile numbers). An expansion processing line is compared with the existing
// processing lines already open at its unlock rank. Market-price basis; the report's C6/C7 only compare a line with its inputs.
const rep=spawnSync(process.execPath,['scripts/balance-report.mjs','--strict'],{cwd:root,encoding:'utf8'});
const lines=rep.stdout.split('\n');const from=lines.findIndex(l=>l.startsWith('## 1.'));const rows=[];
for(let i=from;i<lines.length&&!lines[i].startsWith('## 2.');i++){const c=lines[i].split('|').map(v=>v.trim());if(c.length>=15&&/^\d+$/.test(c[1]))rows.push({rank:+c[1],name:c[2],inputs:c[6],tile:+c[13]});}
const expNames=new Set();
for(const t of expFac){const d=BUILDINGS[t];expNames.add(d.name);for(const r of (d.recipes||[]).slice(1))expNames.add(d.name+' · '+r.name);}
for(const L of [I.EXPANSION_RECIPES,I.EXPANSION2_RECIPES])for(const [t,list] of Object.entries(L))for(const r of list)expNames.add(BUILDINGS[t].name+' · '+r.name);
const processing=r=>r.inputs!=='—'&&r.inputs!=='물 1';
const table=rows.filter(r=>expNames.has(r.name)&&processing(r)).map(r=>{const pool=rows.filter(o=>!expNames.has(o.name)&&processing(o)&&o.rank<=r.rank).map(o=>o.tile).sort((a,b)=>b-a);
 return {rank:r.rank,line:r.name,perTile:r.tile,bestOpen:pool[0],medianOpen:pool[Math.floor(pool.length/2)],beatenBy:pool.filter(v=>v>r.tile).length+'/'+pool.length,atFloor:+(r.tile/(pool[0]*.5)).toFixed(2)};});
if(process.argv.includes('--table'))for(const r of table)console.log('E1 '+JSON.stringify(r));
// The goods a player sells are the final ones; an intermediate (sugar, barrel, batter...) is judged through them. A final
// good of the expansion that earns under 0.8 of the median existing line of its rank is a chain nobody runs for money.
const finals=table.filter(r=>{const l=[...Object.entries(BUILDINGS)].flatMap(([t,d])=>(d.recipes||[]).map((x,i)=>({name:i?d.name+' · '+x.name:d.name,out:x.output}))).find(v=>v.name===r.line);return l&&RESOURCES[l.out]?.final;});
const weak=finals.filter(r=>r.perTile<r.medianOpen*.8),dominant=finals.filter(r=>r.perTile>r.bestOpen);
expectBug('G1-E1 expansion final goods earn under 0.8 of the median existing line of their rank per tile (a chain nobody runs for money)',rows.length>50&&weak.length>0,{balanceReportExit:rep.status,finals:finals.length,weak:weak.map(r=>r.rank+' '+r.line+' '+r.perTile+' vs median '+r.medianOpen),all:finals.map(r=>r.rank+' '+r.line+' '+r.perTile+'/'+r.medianOpen)});
expectBug('[control] G1-E1b an expansion final good out-earns the best existing line of its rank (would make the base chain obsolete)',dominant.length>0,{dominant:dominant.map(r=>r.line+' '+r.perTile+' > '+r.bestOpen)});

// E2 solar panel against the wind turbine. Power is on/off within reach of a running plant, so a plant matters only by
// cost, inputs and gaps: a timed output keeps power 60 game s per cycle and a cycle longer than that leaves a gap.
// Before the fix the turbine (24 s, never over 60 s even at 40% speed) had no gap anywhere and the solar panel, slowed by
// the same heights, was a costlier, later copy. Now the turbine gaps under shelter 3 and the panel reads mountain shade only.
{const up=(p,m)=>Math.min(1,60/(p/m));
 // Real ticks: the share of time the grid has power with one plant beside a height-3 smelter and one at a mountain foot.
 const uptime=(type,where)=>{const c=new Simulation('river',null,{nation:'kardum',provinceId:'kardum-3'});c.nextEvent=1e12;c.money=1e6;c.rank=23;for(const r of Object.keys(RESOURCES))c.stock[r]=200;/* stock, land and rank set directly */
  for(let x=0;x<24;x++)for(let z=0;z<24;z++)c.owned.add(x+','+z);c.build('warehouse',11,12);c.build('house',11,14);
  let spot;if(where==='factory'){const f=c.tiles.find(t=>t.terrain!=='water'&&!t.nature&&!placementEffects(c,'smelter',t.x,t.z).mountain&&c.build('smelter',t.x,t.z).ok);const sm=f&&c.at(f.x,f.z);if(sm)sm.enabled=false;spot=sm&&c.tiles.find(t=>Math.max(Math.abs(t.x-sm.x),Math.abs(t.z-sm.z))===1&&t.terrain!=='water'&&!t.nature&&!placementEffects(c,type,t.x,t.z).mountain&&c.build(type,t.x,t.z).ok);}
  else spot=c.tiles.find(t=>t.terrain!=='water'&&!t.nature&&placementEffects(c,type,t.x,t.z).mountain>=3&&c.build(type,t.x,t.z).ok);
  if(!spot)return null;let on=0,n=0;for(let i=0;i<2400;i++){c.tick(.25);if(i>400){n++;if(c.power)on++;}}return +(on/n).toFixed(3);};
 const s=new Simulation('river',null,{nation:'kardum',provinceId:'kardum-3'});let solarBetter=0,windBetter=0,spots=0;
 for(const t of s.tiles){if(t.terrain==='water')continue;spots++;const a=up(BUILDINGS.windturbine.period,placementEffects(s,'windturbine',t.x,t.z).speed),b=up(BUILDINGS.solarpanel.period,placementEffects(s,'solarpanel',t.x,t.z).speed);if(b>a+1e-9)solarBetter++;if(a>b+1e-9)windBetter++;}
 const cost=t=>({build:BUILDINGS[t].cost,period:BUILDINGS[t].period,rank:unlockRank(t),upkeepPerDay:+(BUILDINGS[t].cost*.03).toFixed(1)});
 const detail={uptime:{besideTallFactory:{windturbine:uptime('windturbine','factory'),solarpanel:uptime('solarpanel','factory')},mountainFoot:{windturbine:uptime('windturbine','mountain'),solarpanel:uptime('solarpanel','mountain')}},emptyMapSpots:{spots,solarBetter,windBetter},windturbine:cost('windturbine'),solarpanel:cost('solarpanel')};
 const f=detail.uptime.besideTallFactory;
 expectBug('G1-E2 the solar panel is never better than the cheaper, earlier wind turbine (same power, never fewer gaps)',!(f.solarpanel>f.windturbine),detail);}

// E3 contract pools: an optional item is ordered only while a facility makes it, so an item listed in a band where no rank of
// the band can make it yet is never ordered there.
{const bands=[];let lo=0;for(const [below,,extra] of CONTRACT_POOLS){bands.push({ranks:[lo,Math.min(below,RANKS.length)-1],extra});lo=below;}
 const dead=[];for(const b of bands)for(const item of b.extra){const first=Math.min(...makers(item).map(m=>m.rank));if(first>b.ranks[1])dead.push({item,band:b.ranks.join('~'),firstMakeRank:first});}
 const everOrdered=item=>bands.some(b=>b.extra.includes(item)&&Math.min(...makers(item).map(m=>m.rank))<=b.ranks[1]);
 expectBug('G1-E3 contract pool lists optional goods in a band where they cannot be made yet, so the lord never orders them',dead.length>0,{dead,neverOrderedAtAll:[...new Set(dead.map(d=>d.item))].filter(i=>!everOrdered(i))});}

// E4 the open lord's order changes when the player switches a facility to an optional product (the pool grows, the index
// contracts % pool.length points elsewhere). Rank and contract count set directly; the switch is the real setRecipe.
{const s=new Simulation('river',null,{nation:'estern',provinceId:'estern-5'});s.nextEvent=1e12;s.rank=5;s.contracts=5;s.money=1e5;for(const r of Object.keys(RESOURCES))s.stock[r]=60;
 s.build('warehouse',11,12);const a=s.build('bakery',9,12).id,b=s.build('bakery',13,12).id;
 const seen=[s.contract().item+' '+s.contract().amount];s.setRecipe(a,'jam');seen.push(s.contract().item+' '+s.contract().amount);s.setRecipe(b,'baguette');seen.push(s.contract().item+' '+s.contract().amount);s.setRecipe(a,'bread');seen.push(s.contract().item+' '+s.contract().amount);
 expectBug('G1-E4 [R simulation.js contract()] switching a facility to an optional product changes the open lord order (and lets the player re-roll it)',new Set(seen).size>1,{contractsDone:s.contracts,orderAfterEachSwitch:seen,switches:['start','bakery A → 딸기잼','bakery B → 바게트','bakery A → 빵']});}

// E5 production hint for an input that only an alternative product makes: it names the facility kind to build, not the
// product switch, even when that facility already stands. Stock and rank set directly; statuses come from real ticks.
{const s=new Simulation('river',null,{nation:'estern',provinceId:'estern-5'});s.nextEvent=1e12;s.rank=13;s.money=1e5;for(const r of Object.keys(RESOURCES))s.stock[r]=60;s.stock.barrel=0;
 s.build('warehouse',11,12);s.build('house',11,14);s.build('house',12,14);s.build('sawmill',9,12);const w=s.build('winery',13,12);
 for(let i=0;i<200;i++)s.tick(.25);const winery=s.buildings.find(b=>b.id===w.id),saw=s.buildings.find(b=>b.type==='sawmill');
 const d=productionDiagnosis(s,winery,BUILDINGS,RESOURCES);
 const altOnly=Object.keys(RESOURCES).filter(item=>consumers(item).length&&makers(item).length&&makers(item).every(m=>!m.isDefault)).map(item=>{const first=Math.min(...makers(item).map(m=>m.rank)),types=Object.keys(BUILDINGS).filter(k=>(BUILDINGS[k].recipes||[BUILDINGS[k]]).some(r=>r.output===item)).sort((x,y)=>unlockRank(x)-unlockRank(y)),hint=types.find(k=>unlockRank(k)<=first);return RESOURCES[item].name+' → '+BUILDINGS[hint].name+' 선택(기본 '+RESOURCES[BUILDINGS[hint].recipes[0].output].name+')';});
 expectBug('G1-E5 a facility starved of an alternative-only input is told to build another facility of the maker kind (default product), even when one stands there',winery.status==='오크통 대기'&&d.tool==='sawmill'&&!!saw,{winery:winery.status,existingSawmillMakes:saw&&s.recipeOf(saw).name,hint:d,altOnlyInputs:altOnly});}

// E6/E7 alternatives that make the default obsolete, or cost more input for the same output and time.
{const val=o=>Object.entries(o).reduce((n,[k,v])=>n+RESOURCES[k].price*v,0),units=o=>Object.values(o).reduce((x,y)=>x+y,0);
 // An alternative that needs an input kind the other line does not (clay brick: a clay pit; sand glass: a sand pit) is a
 // trade of land and setup for cheaper input, not an obsolete default, so only same-or-fewer input kinds count.
 const kinds=(a,b)=>Object.keys(a.inputs||{}).every(k=>k in (b.inputs||{}));
 const better=(a,b)=>a.output===b.output&&kinds(a,b)&&a.period<=b.period&&a.amount>=b.amount&&units(a.inputs)<=units(b.inputs)&&val(a.inputs)<=val(b.inputs)&&(a.period<b.period||a.amount>b.amount||units(a.inputs)<units(b.inputs)||val(a.inputs)<val(b.inputs));
 const newIds=new Set([...Object.values(I.EXPANSION_RECIPES),...Object.values(I.EXPANSION2_RECIPES)].flat().map(r=>r.id));
 const obsolete=[],costlier=[];for(const d of Object.values(BUILDINGS)){const L=d.recipes||[];for(const a of L)for(const b of L){if(a===b||!newIds.has(a.id))continue;
  if(better(a,b))obsolete.push(d.name+': '+a.name+' > '+b.name+(b===L[0]?' (기본 제품)':''));
  if(a.output===b.output&&a.period===b.period&&a.amount===b.amount&&units(a.inputs)===units(b.inputs)&&val(a.inputs)>val(b.inputs))costlier.push(d.name+': '+a.name+' 투입가 '+val(a.inputs)+'G > '+b.name+' '+val(b.inputs)+'G');}}
 expectBug('G1-E6 an expansion product makes an existing product of the same facility obsolete (same output, not slower, fewer or cheaper inputs)',obsolete.length>0,{obsolete});
 expectBug('G1-E7 an expansion product costs more input value than another product of the same facility for the same output and time',costlier.length>0,{costlier,honeycombConsumers:consumers('honeycomb')});}
// E8 the "다음 건설" card (ui-rules nextBuild): once a rank's base producers stand it names the rank's newest producer, which is
// an optional expansion facility; for several ranks that facility's inputs have no producer yet, so it stalls on arrival.
// Sweep: every rank with every base producer unlocked so far in place (buildings listed directly, no ticks).
{const {nextBuild,productsOf}=await import('../../src/app/game/ui-rules.js');const {load}=await import('../audit-2/_fixture.mjs');
 const exp=new Set(expFac),sweep=[],stalled=[];
 for(let r=1;r<RANKS.length;r++){const s=new Simulation('river',null,{nation:'estern',provinceId:'estern-5'});s.rank=r;s.buildings=[{type:'warehouse',x:11,z:12,health:100,id:1}];
  for(const t of Object.keys(BUILDINGS))if(!exp.has(t)&&unlockRank(t)<=r&&productsOf(BUILDINGS[t]).length&&!BUILDINGS[t].home)s.buildings.push({type:t,x:-1,z:-1,health:100,id:s.buildings.length+1});
  s.revision++;const made=new Set(s.buildings.flatMap(b=>productsOf(BUILDINGS[b.type]).map(q=>q.output)));const n=nextBuild(s);if(!n)continue;
  const miss=Object.keys(productsOf(BUILDINGS[n.type])[0].inputs||{}).filter(i=>i!=='water'&&!made.has(i));sweep.push(r+' '+BUILDINGS[n.type].name+(exp.has(n.type)?' (확장)':''));if(exp.has(n.type)&&miss.length)stalled.push(r+' '+n.text+' · 원료 없음: '+miss.map(i=>RESOURCES[i].name).join(','));}
 // The same on the bot's own saves: after it builds the base facility the card names, the card turns to an expansion facility.
 const real=[];for(const r of [8,13]){const c=load(r),s=c.home.sim;for(let k=0;k<4;k++){const n=nextBuild(s);if(!n)break;if(exp.has(n.type)){real.push('rank'+r+' → '+n.text);break;}s.buildings.push({type:n.type,x:-1,z:-1,health:100,id:9e5+k});s.revision++;}}
 expectBug('G1-E8 [U ui-rules.js nextBuild] the next-build card sends the player to an optional expansion facility whose inputs nothing makes yet',stalled.length>0,{stalled,expansionSuggestedAtRanks:sweep.filter(v=>v.endsWith('(확장)')).length+' of '+sweep.length,botSaves:real});}
finish('g1-expansion-economy');
