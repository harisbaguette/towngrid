// Round 3 (U, 2026-10-02): player re-check K-01, K-03, K-04, K-05, K-06, K-08 on the rules the screens read.
// node tests/fix-20260930/goal-actions.mjs
import {readFileSync} from 'node:fs';
import {Simulation,BUILDINGS} from '../../src/app/game/simulation.js';
import {RANKS,unlockRank} from '../../src/app/game/world.js';
import {goalAction,nextBuild,placeSpot,makersOf,productsOf,sellableStock,plannedNeeds,shortfall} from '../../src/app/game/ui-rules.js';
import {ACTION_PRICES} from '../../src/app/game/simulation.js';
import {productionDiagnosis,slowNotes} from '../../src/app/game/proximity.js';
import {RESOURCES} from '../../src/app/game/simulation.js';
import {load,calm} from '../audit-2/_fixture.mjs';
import {startRaid} from '../../src/app/game/encounters.js';

const fails=[];const check=(id,ok,detail)=>{console.log((ok?'PASS ':'FAIL ')+id+' :: '+JSON.stringify(detail??'').slice(0,600));if(!ok)fails.push(id);};
const src=f=>readFileSync(new URL('../../src/app/game/'+f,import.meta.url),'utf8');
const TRIALS=[...src('progression.js').matchAll(/key:'([a-zA-Z]+)'/g)].map(m=>m[1]);

// K-01: every promotion condition kind of every rank (requirements, trials, fee) has a button that does something now.
{const missing=[],weak=[],kinds=new Set();
 for(let r=0;r<RANKS.length-1;r++){
  const s=new Simulation('river',null,{nation:'estern'});s.rank=r;s.money=5000;
  const keys=[...RANKS[r+1].requirements.map(q=>q[0]),...TRIALS.map(k=>'trial:'+k),'fee'];
  for(const key of new Set(keys)){const kind=key.split(':')[0];kinds.add(kind==='trial'?key:kind);const a=goalAction(s,key);
   if(!a||!a.label){missing.push(r+' '+key);continue;}
   if(a.kind==='tool'&&a.tool!=='expand'&&!(BUILDINGS[a.tool]&&unlockRank(a.tool)<=s.rank))missing.push(r+' '+key+' -> locked tool '+a.tool);
   if(kind==='produced'&&a.kind!=='tool')weak.push(r+' '+key+' -> '+a.kind);}}
 check('K-01 every condition kind maps to a button ('+kinds.size+' kinds)',missing.length===0,{missing:missing.slice(0,12)});
 check('K-01 production conditions open a build tool (river start)',weak.length===0,{weak:weak.slice(0,12)});
 const s=new Simulation('river',null,{nation:'estern'});s.rank=1;const a=goalAction(s,'expansions');
 check('K-01 rank 2 "개간지 확장" opens the expansion tool with its price',a.kind==='tool'&&a.tool==='expand'&&/영토 확장 · \d+G/.test(a.label),a);
 const ops=src('Operations.tsx'),game=src('Game.tsx');
 check('K-01 operations card and rank dialog render the condition buttons',/unmet\.map\(\(part:any\)=><GoalButton/.test(ops)&&(game.match(/<GoalButton /g)||[]).length>=3,{});}

// K-03: the listed prices are the rules' prices: one short refuses, exact passes.
{const rows=[];
 const setups={sanitize:s=>{s.health.infection=40;return [()=>s.sanitize(),()=>s.sanitizeShort()];},reinforce:s=>{s.pendingEvent={type:'storm',at:s.time+50};s.protected=false;return [()=>s.reinforce(),()=>s.reinforceShort()];},
  mobilize:s=>{const m=s.money,st={...s.stock};const w=[...s.owned].map(k=>k.split(',').map(Number)).find(([x,z])=>!s.canBuild('warehouse',x,z,true));s.build('warehouse',w[0],w[1],true);startRaid(s);s.money=m;Object.assign(s.stock,st);return [()=>s.mobilize(),()=>s.mobilizeShort()];},
  plant:s=>{const k=[...s.owned].find(k=>{const [x,z]=k.split(',').map(Number),t=s.tile(x,z);return t&&t.terrain!=='water'&&!t.nature&&!s.at(x,z)&&!s.roads.has(k);});const [x,z]=k.split(',').map(Number);return [()=>s.plant(x,z),()=>s.plantShort(x,z)];}};
 for(const [name,price] of Object.entries(ACTION_PRICES)){
  const trial=(cut)=>{const s=new Simulation('river',null,{nation:'estern'});s.rank=20;for(const r of Object.keys(s.stock))s.stock[r]=0;s.money=price.money;for(const [r,n] of Object.entries(price.items))s.stock[r]=n;if(cut==='money')s.money-=1;else if(cut)s.stock[cut]-=1;const [run,whyOf]=setups[name](s),why=whyOf(),short=shortfall(s,price).map(v=>v.label);if(!!why!==short.length>0)short.push('rule:'+why);let res;try{res=run();}catch(e){res={ok:false,error:'throw '+e.message};}return {res,short};};
  const exact=trial(null),cuts=['money',...Object.keys(price.items)].map(c=>({c,...trial(c)}));
  rows.push({name,exact:exact.res.ok,error:exact.res.error,cuts:cuts.map(v=>v.c+':'+(v.res.ok?'ok':'refused')+':'+v.short.join(','))});
  check('K-03 '+name+' price matches the rule',exact.res.ok&&exact.short.length===0&&cuts.every(v=>!v.res.ok&&v.short.length===1),rows.at(-1));}
 const ops=src('Operations.tsx'),panels=src('QualityPanels.tsx'),game=src('Game.tsx'),camp=src('CampaignPanel.tsx');
 check('K-03 every goods-priced button locks on the rule check and shows its sentence (sanitize, plant x2, reinforce, mobilize, rescue, council x5)',
  /disabled=\{!!sanitizeWhy\}/.test(ops)&&/s\.sanitizeShort\(\)/.test(ops)&&/s\.plantShort\(spot\.x,spot\.z\)/.test(ops)&&/disabled=\{!!s\.plantShort\?\.\(tile\.x,tile\.z\)\}/.test(game)&&/s\.reinforceShort\?\.\(\)/.test(game)&&/disabled=\{r\.boosted\|\|!!s\.mobilizeShort\?\.\(\)\}/.test(panels)&&/s\.rescueShort\?\.\(\)/.test(ops)&&!/ACTION_COSTS/.test(ops+game+panels)&&(camp.match(/lack\('[a-z]+'\)\.length>0/g)||[]).length===5,{});}

// K-04: the next-build card only names facilities with a free tile whose recipe inputs this land can get.
{const bad=[],seen=[];
 const sims=[8,13,18,22,26,29,31].flatMap(r=>{const c=load(r);calm(c);return c.sites.map(v=>v.sim);});
 for(const n of ['estern','silvaen','kardum','arsel'])for(const region of ['river','highland','coast','snow']){try{const s=new Simulation(region,null,{nation:n});s.rank=2;s.build('warehouse',...[...s.owned][10].split(',').map(Number),true);sims.push(s);}catch{}}
 for(const s of sims){const nb=nextBuild(s);if(!nb)continue;seen.push(nb.type);
  const made=new Set(s.buildings.flatMap(b=>productsOf(BUILDINGS[b.type]).map(r=>r.output)));
  const inputs=Object.keys(productsOf(BUILDINGS[nb.type]).find(r=>r.output===nb.output)?.inputs||{});
  const lacking=inputs.filter(i=>!made.has(i)&&s.availableStock(i)<1&&makersOf(s,i).length===0);
  if(!placeSpot(s,nb.type)||lacking.length)bad.push({type:nb.type,lacking,spot:!!placeSpot(s,nb.type)});}
 check('K-04 next build has a tile and obtainable inputs ('+seen.length+' suggestions)',bad.length===0,{bad});}

// K-05: the sell hint keeps the suggested building's materials and the open order.
{const c=load(13);calm(c);const s=c.active;const nb=nextBuild(s),keep=plannedNeeds(s,nb),sale=sellableStock(s,keep);
 const over=Object.entries(keep).filter(([r,n])=>{const item=sale.items.find(v=>v.id===r);return item&&Math.floor(s.availableStock(r))-item.n<Math.min(n,Math.floor(s.availableStock(r)));});
 check('K-05 sell hint leaves planned materials',over.length===0&&Object.keys(keep).length>0,{next:nb?.type,keep,over});
 check('K-05 operations card passes the plan to the hint',/sellableStock\(s,plannedNeeds\(s,next\)\)/.test(src('Operations.tsx')),{});
 check('K-05 next-build card names missing materials with an import button',/next-build-short"><CostShort sim=\{s\} price=\{\{money:s\.buildCost\(next\.type\),items:B\[next\.type\]\.materials/.test(src('Operations.tsx')),{});}

// K-06: an empty store with the makers running is a supply shortfall, not a path.
{const s=new Simulation('river',null,{nation:'estern'});s.rank=4;const owned=[...s.owned].map(k=>k.split(',').map(Number));
 const free=()=>owned.find(([x,z])=>!s.canBuild('well',x,z,true));
 const [wx,wz]=free();s.build('warehouse',wx,wz,true);const [qx,qz]=free();s.build('well',qx,qz,true);
 const fields=[];for(let i=0;i<4;i++){const p=owned.find(([x,z])=>!s.canBuild('field',x,z,true));if(p){const r=s.build('field',p[0],p[1],true);if(r.ok)fields.push(r.id);}}
 const b=s.buildings.find(v=>v.id===fields[0]);s.stock.water=0;b.status='물 대기';b.inputs={};
 const well=s.buildings.find(v=>v.type==='well');well.status='생산 중';
 const d=productionDiagnosis(s,b,BUILDINGS,RESOURCES);
 check('K-06 water shortfall names supply, offers one more well',/생산이 쓰는 곳보다 적습니다/.test(d.text)&&d.tool==='well'&&!/통로/.test(d.text),d);
 s.stock.water=30;const d2=productionDiagnosis(s,b,BUILDINGS,RESOURCES);
 check('K-06 stock in the store that does not arrive is the path',/오지 못합니다/.test(d2.text),d2);}

// K-08: shade and pollution only on facilities whose speed they change.
{const e={shade:2,mountain:0,pollution:2,windBlock:2};
 check('K-08 no shade/pollution notes on a house, a well or a quarry',['house','well','quarry'].every(t=>slowNotes(t,e).length===0),{});
 check('K-08 a field shows shade as its effect',slowNotes('field',e).some(n=>n.text==='그늘 2 · 생산 -20%'),slowNotes('field',e));
 check('K-08 preview has no blanket 통로 확보 필요',!src('Game.tsx').includes('통로 확보 필요'),{});}

console.log(`\n[goal-actions] ${fails.length?'FAIL '+fails.join(' | '):'all pass'}`);process.exit(fails.length?1:0);
