// "What to build next" after the first-session guide (ui-rules nextBuild), plus the contract button and product
// picker rules the HUD reads. Rank/stock are set directly where noted to reach a stage quickly.
import {Campaign,home,expectBug,finish} from './_harness.mjs';
import {BUILDINGS} from '../../src/app/game/simulation.js';
import {RANKS,unlockRank} from '../../src/app/game/world.js';
import {nextBuild,tutorialStep,offered,productsOf,contractState,recipeChoices,fleetState} from '../../src/app/game/ui-rules.js';

const starter=()=>{const c=new Campaign(),s=home(c);s.nextEvent=1e9;s.build('warehouse',11,12);s.build('house',11,14);s.build('well',13,12);s.build('field',13,13);s.build('lumber',9,10);return s;};

// N1: the guide ends at the first promotion; the next line must take over at once with the facility rank 1 opened.
{const s=starter();const before={tutorial:!!tutorialStep(s),next:nextBuild(s)};s.rank=1;/* rank set directly */
 const after={tutorial:tutorialStep(s),next:nextBuild(s)};
 expectBug('N1-no-next-build-after-first-promotion',before.next!==null||!before.tutorial||after.tutorial!==null||after.next?.type!=='sawmill',{before,after});}

// N2: a facility that is already built is never suggested again.
{const s=starter();s.rank=1;s.money=5000;s.stock.wood=99;s.stock.stone=99;/* state set directly */const r=s.build('sawmill',10,12);
 const next=nextBuild(s);expectBug('N2-suggests-built-facility',!r.ok||next?.type==='sawmill',{build:r,next});}

// N3: among this rank's openings, the one the next promotion needs comes first (rank 2 needs flour -> mill, not smokehouse).
{const s=starter();s.rank=2;/* rank set directly */const next=nextBuild(s);
 expectBug('N3-ignores-promotion-need',next?.type!=='mill',{next,unlocks:RANKS[2].unlocks,needs:s.promotion().requirements.map(r=>r.key)});}

// N4: at every rank the suggestion is unlocked, unbuilt, offered in the build dock and has a chain line.
{const bad=[];for(let rank=1;rank<RANKS.length;rank++){const s=starter();s.rank=rank;/* rank set directly */const n=nextBuild(s);if(!n)continue;
  if(unlockRank(n.type)>rank||s.buildings.some(b=>b.type===n.type)||!offered(s,n.type)||!BUILDINGS[n.type].group||!n.chain||!productsOf(BUILDINGS[n.type]).length)bad.push({rank,n});}
 expectBug('N4-suggestion-not-buildable',bad.length>0,{bad});}

// C1: the contract button follows contractStatus().ready and names the wait or the shipment on the road.
{const s=starter();const st=typeof s.contractStatus==='function'?s.contractStatus():null,deal=contractState(s);
 const wrong=st?deal.ready!==!!st.ready||(st.inTransit&&deal.label!=='운송 중')||(!st.inTransit&&st.wait>0&&!deal.label.endsWith('초')):deal.ready!==(deal.have>=deal.contract.amount);
 expectBug('C1-contract-button-state',wrong,{status:st,deal:{ready:deal.ready,label:deal.label,note:deal.note}});}

// R1: every multi-product facility lists all products with exactly one current, and locked ones carry a reason.
{const s=starter();const bad=[];for(const [type,d] of Object.entries(BUILDINGS)){if(!(d.recipes?.length>1))continue;
  const b={id:-1,type,recipe:undefined,inputs:{}},list=recipeChoices(s,b);
  if(list.length!==d.recipes.length||list.filter(r=>r.current).length!==1||list.some(r=>r.locked&&!/승급 후$/.test(r.locked)))bad.push({type,list:list.map(r=>[r.id,r.current,r.locked])});}
 expectBug('R1-product-picker',bad.length>0,{multiProduct:Object.keys(BUILDINGS).filter(t=>BUILDINGS[t].recipes?.length>1),bad});}

// F1: the fleet line counts every vehicle slot, and the fuel note shows only while every fuel-free vehicle is out and fuel is short.
// Updated 2026-10-02 (R team, player audit K-07): fuel vehicles join the fleet only once fuel can be had (export-route.js
// fuelInReach: a facility of the rank makes fuel, or some is in stock), so a starting town with its carts out is told to
// wait, not that fuel is short. The fuel note is checked at the rank that opens the refinery.
{const s=starter();s.stock.wood=200;s.stock.fuel=0;s.reserves.fuel=0;/* stock set directly */const idle=fleetState(s);
 const sales=[1,2,3].map(()=>s.sell('wood',1));const out=fleetState(s);s.rank=unlockRank('refinery');/* rank set directly */const short=fleetState(s);s.stock.fuel=10;const fuelled=fleetState(s);
 expectBug('F1-fleet-line',!idle||idle.busy!==0||idle.fuelNote!==''||out.busy!==3||out.fuelNote!==''||!short.fuelNote||fuelled.fuelNote!=='',{idle,sales,out:{busy:out.busy,total:out.total,fuelNote:out.fuelNote},refineryRank:{total:short.total,fuelNote:short.fuelNote},withFuel:fuelled.fuelNote});}

finish('next-build');
