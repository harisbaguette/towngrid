import {outputStorageIssue} from './storage.js';
import {outputItems} from './facility-inventory.js';
import {BUILDINGS,RESOURCES,damageFactor} from './simulation.js';
import {RACES,unlockRank} from './world.js';
import {remainingSeconds} from './game-time.js';
import {SAPLING_GROW} from './economy.js';
// Project-specific balance, inspired by Town Star's documented adjacency rules.
// Distances use a square tile radius; roads use orthogonal adjacency.
export const EMISSIONS={generator:2,steamworks:2,smelter:3,refinery:3,chemical:3,coalpit:2,oilpump:2,automotive:1,kiln:1,glassworks:2,cementworks:2,wiremill:1,mithrilforge:2,blastfurnace:3,shipyard:1,cannery:1};
export const HEIGHTS={warehouse:2,house:1,dwarfhouse:1,titanhouse:1,spirithouse:1,centaurhouse:1,mill:2,generator:2,workshop:1,logistics:2,smelter:3,refinery:3,chemical:2,magetower:3,manaextractor:2,arcanepower:3,station:2,hospital:2,bank:2,barracks:1,depot:2,windturbine:2,parliament:3,shipyard:3,cementworks:2,fortress:2,airdock:2,exchange:2,blastfurnace:3,watermill:1,marketplace:1};
// Terrain rules of 2026-09-29 (docs/EXPANSION_20260929.md 3, docs/BALANCE_PATCH_20260928.md 14). A map with
// land.ecology (every site made since 2026-09-28) plays them; an older save keeps the old rules, as it keeps its
// old ground. The showcase tour (Campaign demo) is built on the old fixed map but is never saved, so it plays the
// current rules its facility cards describe (G1-T3). The terrain facilities (pond, pasture, clover) work on every map.
export const terrainRules=sim=>!!sim.layout?.ecology||!!sim.campaign?.demo;
export const MINES=['ironmine','coalpit','coppermine','sandpit','shallowmine'],HERDS=['sheeppen','milkbarn'],WIND=['mill','windturbine','windpump'];
/** Water within two tiles: a touching tile gives 2, the next ring 1. Open water (river, lake, marsh pool) within
 *  two tiles also gives a base of 3, so a wheat field (need 3) is watered exactly where the old rule watered it. */
export const WATER_RING=[0,2,1],OPEN_WATER=3;
/** Each same-kind facility on the eight tiles around (corners included) cuts the production time by 10%, at most by 30%
 *  (three neighbours). At the first cap of 50% a clustered raw field out-earned the processing plant it feeds per tile
 *  (balance-report C12, docs/BALANCE_PATCH_20260928.md 17-3). */
export const CLUSTER_STEP=.1,CLUSTER_MAX=3;
/** Each point of shade, wind shelter or pollution multiplies the time by this on a current map (placementEffects). */
export const PENALTY_STEP=1.2,PENALTY_FLOOR=.25;
/** Extraction sites (every raw producer outside the farm group: wells, lumber camps, quarries, pits, mines, pumps) share
 *  the trees, rock, ore or ground water around them, so a cluster of them gains at most 10% (one neighbour). With the
 *  30% cap a full cluster of lumber camps and iron mines let charcoal steel, planks and steel gears fall under 1.15 times
 *  their inputs per tile (balance-report C13; at 20% charcoal steel still sat at 1.09, docs/BALANCE_PATCH_20260928.md 18). */
export const EXTRACTORS=['well','lumber','quarry','sandpit','clayfield','ironmine','coalpit','coppermine','shallowmine','oilpump','manaextractor'],EXTRACT_MAX=1;
export const clusterMax=type=>EXTRACTORS.includes(type)?EXTRACT_MAX:CLUSTER_MAX;
/** Mountain shade and wind shelter by distance 1..5 (steps 3,2,2,1,1); salt by distance to the sea 1..2. */
const MOUNTAIN=[0,3,2,2,1,1],SALT=[0,2,1];
// Simulation.placementEffects caches this result per spot (simulation.js effectsKey). Any state read here besides building
// positions and types, roads, fixed terrain and the running state of polluters and irrigators must be added to that key.
// A terrain facility works while its health is above 0; a building reaching 0 or being repaired bumps the revision, which
// the key already holds.
export function placementEffects(sim,type,x,z){
 const d=BUILDINGS[type],modern=terrainRules(sim),crop=!!d?.irrigable,need=modern?d?.waterNeed||0:0;
 let pollution=0,shade=0,windBlock=0,water=0,reservoir=false,ponds=0,waterScore=0,open=false,mountain=0,coast=9,flooded=false,graze=0,clover=0,cluster=0,serves=0,irrigator=null;const sources=[];const irrigates=d?.output==='irrigation';
 for(const b of sim.buildings){if(b.x===x&&b.z===z)continue;const distance=Math.max(Math.abs(b.x-x),Math.abs(b.z-z));
  const dirty=EMISSIONS[b.type]||0,height=HEIGHTS[b.type]||0;
  if(b.health>0&&b.enabled!==false&&dirty&&distance<=dirty){pollution+=dirty+1-distance;sources.push({type:b.type,kind:'pollution',distance});}
  if(height&&distance<=height){shade=Math.max(shade,height+1-distance);windBlock=Math.max(windBlock,height+1-distance);}
  // A water tower and a wind pump both water the crops within two tiles while their supply window runs.
  if(crop&&BUILDINGS[b.type]?.output==='irrigation'&&b.health>0&&b.enabled!==false&&!(b.movingUntil>sim.time)&&b.activeUntil>sim.time&&distance<=2){reservoir=true;irrigator=irrigator||b.type;}
  if(distance<=2){
   // G1-T2: a broken pond, pasture or clover patch shows 수리 필요 like any facility and gives nothing until repaired.
   const live=b.health>0;
   if(b.type==='pond'){if(live){ponds++;waterScore+=WATER_RING[distance];if(distance===1)flooded=true;}}
   else if(b.type==='pasture'){if(live)graze+=WATER_RING[distance];}
   else if(b.type==='clover'){if(live)clover++;}
   // An irrigator counts the crops its supply window will water (the same crops the reservoir flag above reaches).
   const bd=BUILDINGS[b.type];if(type==='pond'&&(modern?bd.waterNeed:bd.irrigable)||irrigates&&bd.irrigable&&(!modern||bd.waterNeed)||type==='pasture'&&HERDS.includes(b.type)||type==='clover'&&b.type==='apiary')serves++;
  }
  if(modern&&b.type===type&&distance===1)cluster++;
 }
 if(modern){for(let dz=-5;dz<=5;dz++)for(let dx=-5;dx<=5;dx++){const t=sim.tile(x+dx,z+dz),r=Math.max(Math.abs(dx),Math.abs(dz));if(!t||!r)continue;
  if(t.ground==='mountain')mountain=Math.max(mountain,MOUNTAIN[r]);if(r>2)continue;
  if(t.terrain==='water'){if(r===1)flooded=true;if(t.water==='coast')coast=Math.min(coast,r);
   // A salt pan evaporates sea water as well as fresh water.
   if(t.water!=='coast'||type==='saltfield'){open=true;waterScore+=WATER_RING[r];}}}
  shade=Math.max(shade,mountain);windBlock=Math.max(windBlock,mountain);if(open)waterScore+=OPEN_WATER;
  if(need)water=reservoir||waterScore>=need?1:0;
 }else if(crop){water=reservoir||ponds>0?1:0;for(let dz=-2;dz<=2&&!water;dz++)for(let dx=-2;dx<=2;dx++){const t=sim.tile(x+dx,z+dz);if(t?.terrain==='water'&&t.water!=='coast')water=1;}}
 pollution=Math.min(6,pollution);shade=Math.min(3,shade);windBlock=Math.min(3,windBlock);
 const salt=modern?SALT[coast]||0:0;flooded=modern&&MINES.includes(type)&&flooded;cluster=modern&&d?.period&&RESOURCES[d.output]?Math.min(clusterMax(type),cluster):0;
 const road=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>sim.roads.has((x+dx)+','+(z+dz)));
 const sensitive=crop||['stable','dock','henhouse','sheeppen','milkbarn','duckhouse','apiary'].includes(type),wind=WIND.includes(type);
 // A solar panel loses 20% per step of MOUNTAIN shade only (G1-E2, docs/BALANCE_PATCH_20260928.md 19): it stands among
 // tall factories that block the wind turbine. Salt slows an irrigated crop 15% a step and speeds a salt pan 20% a
 // step; a flooded mine runs at 70%; pasture feeds a herd 10% a point up to 40%.
 // Town Star doubles a facility's time for every point of shade, wind shelter or pollution (docs/TOWNSTAR_RULES.md). A map
 // with land.ecology plays a softer version: each point multiplies the time by PENALTY_STEP (1.2), down to a quarter of the
 // speed, and never cuts less than the old rule did (wind keeps its 20% a point); an older save keeps the old 10%/20%-a-point
 // cut, as it keeps its other terrain rules. A steeper step cost the reference bot more than a day before 임차 사업주.
 const steep=(n,old)=>Math.min(old,Math.max(PENALTY_FLOOR,1/PENALTY_STEP**n));
 const speed=(sensitive?modern?steep(pollution+(crop?shade:0),Math.max(.4,1-pollution*.1-(crop?shade*.1:0)))*(crop?Math.max(.4,1-salt*.15):1):Math.max(.4,1-pollution*.1-(crop?shade*.1+salt*.15:0)):1)*(wind?modern?steep(windBlock,Math.max(.4,1-windBlock*.2)):Math.max(.4,1-windBlock*.2):1)*(type==='solarpanel'?Math.max(.4,1-Math.min(3,mountain)*.2):1)
  *(type==='saltfield'?1+salt*.2:1)*(flooded?.7:1)*(HERDS.includes(type)?1+Math.min(.4,graze*.1):1)/(1-cluster*CLUSTER_STEP);
 const blocked=type==='apiary'&&!clover?'야생 클로버 필요':null;
 return {water,waterScore,waterNeed:need,irrigator,pollution,shade,mountain,windBlock,salt,flooded,graze,clover,cluster,serves,blocked,modern,road,speed,sources};
}
/** The height rule by what it does here: wind facilities lose wind behind a tall building or a mountain, the rest lose
 *  light (both come from the same heights, so the values are equal; only the name differs). A solar panel reads only
 *  the mountain's shade (G1-E2). */
export function shelterNote(type,e){if(type==='solarpanel'){const value=Math.min(3,e.mountain||0);return {name:'산 그늘',value};}const wind=WIND.includes(type),value=wind?e.windBlock:e.shade;return {name:(value&&e.mountain>=value?'산 ':'')+(wind?'바람막이':'그늘'),value};}
/** K-08: pollution, shade, wind shelter and mountain shade only for the facilities whose speed they change (the speed
 *  formula in placementEffects), worded as the effect: "그늘 2 · 생산 -20%". Empty for a house, a well or a quarry. */
export function slowNotes(type,e,panel=false){
 const d=BUILDINGS[type],crop=!!d?.irrigable,out=[];
 const sensitive=crop||['stable','dock','henhouse','sheeppen','milkbarn','duckhouse','apiary'].includes(type);
 // In the facility panel a rule that applies is always listed with its scale ("바람막이 0/3"); the preview lists only hits.
 const add=(name,value,max,cut)=>{const old=Math.min(60,value*(cut==='solar'?20:cut)),pct=e.modern&&cut!=='solar'?Math.max(old,Math.round((1-Math.max(PENALTY_FLOOR,1/PENALTY_STEP**value))*100)):old;if(value>0||panel)out.push({text:name+' '+value+(panel?'/'+max:'')+(value>0?' · 생산 -'+pct+'%':''),tone:value>0?'negative':''});};
 if(sensitive)add('오염',e.pollution||0,6,10);
 // On a current map pollution and shade multiply on a crop (placementEffects steep): their joint cut is more than either line.
 const joint=e.modern&&crop&&e.pollution>0&&e.shade>0?Math.round((1-Math.min(Math.max(.4,1-e.pollution*.1-e.shade*.1),Math.max(PENALTY_FLOOR,1/PENALTY_STEP**(e.pollution+e.shade))))*100):0;
 if(crop)add((e.shade&&e.mountain>=e.shade?'산 ':'')+'그늘',e.shade||0,3,10);
 if(WIND.includes(type))add((e.windBlock&&e.mountain>=e.windBlock?'산 ':'')+'바람막이',e.windBlock||0,3,20);
 if(type==='solarpanel')add('산 그늘',Math.min(3,e.mountain||0),3,'solar');
 if(joint)out.push({text:'오염·그늘 함께 · 생산 -'+joint+'%',tone:'negative'});
 return out;
}
/** Short notes on the rules that act on this facility at this spot, for the placement preview and the facility panel. */
export function effectNotes(type,e){
 const d=BUILDINGS[type],out=[],crop=!!d?.irrigable,add=(text,tone='')=>out.push({text,tone});
 // A running water tower or wind pump fills the whole demand, so the ring score beside it would read as a shortfall.
 const piped=e.irrigator&&BUILDINGS[e.irrigator].name+' 관개 · 운반 생략';
 if(e.waterNeed)add(piped&&e.waterScore<e.waterNeed?piped:'물 '+e.waterScore+'/'+e.waterNeed+(e.water?' · 운반 생략':' · 운반 필요'),e.water?'positive':'');else if(crop&&e.water)add(piped||'담수 관개 · 물 운반 생략','positive');
 if(d?.output==='irrigation')add(e.serves?'물 받는 작물 '+e.serves+'곳':'물 받을 작물 없음',e.serves?'positive':'negative');
 if(e.cluster)add('같은 시설 '+e.cluster+' · 시간 -'+Math.round(e.cluster*CLUSTER_STEP*100)+'%','positive');
 if(e.salt&&(crop||type==='saltfield'))add('소금기 '+e.salt,type==='saltfield'?'positive':'negative');
 if(e.flooded)add('침수 -30%','negative');
 if(HERDS.includes(type)&&e.graze)add('목초지 +'+Math.min(40,e.graze*10)+'%','positive');
 if(type==='apiary')add(e.clover?'야생 클로버 '+e.clover:'야생 클로버 없음 · 가동 불가',e.clover?'positive':'negative');
 if(d?.terrain&&e.serves)add(({pond:'물 받는 시설 ',pasture:'풀 먹는 가축 ',clover:'꿀벌 양봉장 '})[type]+e.serves+'곳','positive');
 return out;
}
// Advice names only facilities the player can build now (audit H1/V1/H2). Without a simulation it falls back to
// advice that holds from the first rank; pass the simulation to add facilities that are already unlocked.
const open=(sim,type)=>!!sim&&sim.rank>=unlockRank(type),obj=w=>w+((w.charCodeAt(w.length-1)-0xac00)%28?'을':'를');
export function operationHint(status,sim){
 if(status.startsWith('보관 제한'))return '이 품목을 받을 창고가 없습니다 · 시장의 보관 설정에서 입고 상한·예약 공간·출고 전용을 확인하세요.';
 if(status.endsWith(' 대기')&&status!=='운반 대기')return '원료가 들어오지 않습니다 · 공급 시설의 생산량과 창고까지의 통로를 확인하세요.';
 if(status.endsWith(' 주민 필요')){const race=Object.keys(RACES).find(r=>status===RACES[r].name+' 주민 필요'),house=Object.keys(BUILDINGS).find(t=>BUILDINGS[t].resident===race);return house?obj(BUILDINGS[house].name)+' 지어 '+RACES[race].name+' 주민을 들이세요. 이 작업장은 '+RACES[race].name+'만 다룹니다.':'이 작업장을 다루는 주민의 주택을 지으세요.';}
 if(status.startsWith('전력 용량 부족'))return '발전소를 증설·업그레이드하거나 작업 순서로 우선 공급 시설을 정하세요.';
 return {'도로 연결 필요':'시설 옆에 흙길을 놓고 창고까지 이어주세요.','출입구 막힘':'시설 옆 한 칸을 비우세요.','창고 경로 막힘':'창고와 이어지는 빈 칸이나 흙길을 만드세요.','전력 부족':'발전 시설에 원료를 공급하거나 발전 시설을 더 지으세요.','전력망 밖 · 변전소 필요':'발전소 여섯 칸 안으로 옮기거나, 발전소와 이 시설 사이에 변전소를 지어 전기를 이어주세요.','운반 대기':'주민 주택을 더 짓거나 개선해 운반할 주민을 늘리고, 창고까지 흙길을 이으세요.'+(open(sim,'logistics')?' 자동 물류센터를 가동하면 운반량이 두 배가 됩니다.':''),'창고 가득 참':'재고를 팔아 창고 자리를 비우세요.'+(open(sim,'depot')?' 자재 보관소를 지으면 보관 한도가 늘어납니다.':''),'수리 필요':'수리하면 생산이 다시 시작됩니다.','야생 클로버 필요':'양봉장 두 칸 안에 야생 클로버를 심으세요.','자원 고갈':'네 칸 안의 내 땅에 남은 자원이 없습니다. 경계 밖 나무·바위는 쓸 수 없습니다. 벌목장은 빈 칸에 묘목(15G · 물 2, '+remainingSeconds(SAPLING_GROW,sim)+'초 뒤 자람)을 심거나 옆 구역을 사서 영토를 넓히고, 채석장은 바위가 남은 곳으로 옮기세요.','가동 중지':'가동 스위치를 켜세요.','창고 필요':'창고를 먼저 지으세요.'}[status]||'';
}

export function productionDiagnosis(sim,b,definitions,resources){
 const fallback={text:operationHint(b.status,sim),label:'시설 확인',focus:b.id,tool:null};
 if(b.status.startsWith('보관 제한')){const issues=outputItems(sim,b).map(([item])=>outputStorageIssue(sim,b,item)),issue=issues.find(v=>v?.status===b.status)||issues.find(v=>v?.item),item=issue?.item||(sim.recipeOf(b)||{}).output;return {...fallback,text:(issue?.reason||'보관 규칙')+' 때문에 '+(resources[item]?.name||'생산품')+' 입고가 막혔습니다. 시장의 보관 설정을 수정하세요.',action:'storage',storeId:issue?.storeId};}
 if(b.health<100){const slow=damageFactor(b.health);return {...fallback,text:'내구도 '+Math.round(b.health)+'%'+(slow<1&&b.health>0?' · 속도 '+Math.round(slow*100)+'%':'')+' · 수리비 '+sim.repairCost(b)+'G'};}
 if(b.status==='도로 연결 필요'){const placement=[[1,0],[-1,0],[0,1],[0,-1]].map(([x,z])=>({x:b.x+x,z:b.z+z})).find(p=>!sim.canBuild('road',p.x,p.z,true));return {...fallback,label:'시설 옆 흙길 선택',tool:placement?'road':null,placement};}
 if(b.status.startsWith('전력 용량 부족')){const type=['windturbine','generator','watermill','arcanepower'].find(t=>open(sim,t)&&sim.tiles.some(p=>Math.max(Math.abs(p.x-b.x),Math.abs(p.z-b.z))<=6&&!sim.canBuild(t,p.x,p.z)));return {...fallback,text:'이 전력망의 발전량이 부족합니다. 발전소를 업그레이드하거나 증설하고, 작업 순서로 우선 공급 시설을 정하세요.',label:'발전소 증설',tool:type||null};}
 if(b.status==='전력 부족'||b.status==='전력망 밖 · 변전소 필요'){
  const near=sim.buildings.find(p=>definitions[p.type].output==='power'&&p.health>0&&p.enabled!==false&&Math.max(Math.abs(p.x-b.x),Math.abs(p.z-b.z))<=6);
  if(near)return {...fallback,text:definitions[near.type].name+'의 전력 공급을 기다립니다. '+(near.status||''),focus:near.id};
  const power=Object.keys(definitions).filter(t=>definitions[t].output==='power'&&open(sim,t)).sort((a,c)=>definitions[a].cost-definitions[c].cost);
  for(const type of power){const placement=sim.tiles.filter(p=>Math.max(Math.abs(p.x-b.x),Math.abs(p.z-b.z))<=6&&!sim.canBuild(type,p.x,p.z,true)).sort((a,c)=>Math.abs(a.x-b.x)+Math.abs(a.z-b.z)-Math.abs(c.x-b.x)-Math.abs(c.z-b.z))[0];if(placement)return {...fallback,text:'시설에서 여섯 칸 안에 '+obj(definitions[type].name)+' 지어 전기를 공급하세요.',label:definitions[type].name+' 선택',tool:type,placement:{x:placement.x,z:placement.z}};}
 }
 // J4: a depleted lumber camp or quarry names the two ways out, planting inside the border and buying the next block.
 if(b.status==='자원 고갈'){const tree=definitions[b.type]?.natural==='tree';return {text:(tree?'네 칸 안의 내 땅에 나무가 없습니다(경계 밖 나무는 못 씀). 빈 칸을 눌러 묘목(15G · 물 2)을 심거나 옆 구역을 사세요.':'네 칸 안의 내 땅에 바위가 없습니다(경계 밖 바위는 못 씀). 바위가 남은 곳으로 옮기거나 옆 구역을 사세요.'),label:'영토 확장',focus:b.id,tool:'expand'};}
 if(b.status==='야생 클로버 필요')return {...fallback,label:'야생 클로버 선택',focus:null,tool:open(sim,'clover')?'clover':null};
 if(!b.status.endsWith(' 대기')||b.status==='운반 대기')return fallback;
 const missing=Object.entries(sim.effectiveInputs(b)).find(([r,n])=>(b.inputs[r]||0)<n);
 if(!missing)return fallback;
 const [item,need]=missing;
 // A facility with a water demand can stop hauling water once the water around it meets the demand.
 const e=item==='water'&&sim.placementEffects(b.type,b.x,b.z);
 if(e?.waterNeed&&open(sim,'pond')&&!sim.workers.some(w=>w.task?.targetId===b.id&&w.task.item==='water'))return {text:'주변 물 '+e.waterScore+'/'+e.waterNeed+' · 연못으로 '+e.waterNeed+'까지 채우면 물을 나르지 않습니다.',label:'연못 선택',focus:null,tool:'pond'};
 const delivering=sim.workers.filter(w=>w.task?.targetId===b.id&&w.task.item===item);
 if(delivering.length)return {...fallback,text:resources[item].name+'을 주민 '+delivering.length+'명이 운반 중입니다.'};
 const producer=sim.buildings.find(p=>(sim.recipeOf?.(p)||definitions[p.type]).output===item&&p.health>0&&p.enabled!==false);
 if(!producer){
  // G1-E5: every product line that makes the item, open once both the facility and the product are unlocked. A default
  // product means "build one"; an alternative product made by a facility that already stands means "switch it".
  const lines=Object.keys(definitions).flatMap(k=>(definitions[k].recipes||[definitions[k]]).map((r,i)=>({type:k,recipe:r,alt:i>0,rank:Math.max(unlockRank(k),r.unlock||0)}))).filter(l=>l.recipe.output===item).sort((a,c)=>a.rank-c.rank||+a.alt-+c.alt);
  const open=lines.filter(l=>l.rank<=sim.rank),name=resources[item].name;
  if(!open.length)return {text:name+' 공급 시설이 아직 잠겨 있습니다. 창고 재고나 수입으로 공급하세요.',label:'시장 확인',focus:null,tool:null};
  const own=open.find(l=>!l.alt)||null,switchable=!own&&open.map(l=>({l,p:sim.buildings.find(p=>p!==b&&p.type===l.type&&p.health>0)})).find(v=>v.p);
  if(switchable){const d=definitions[switchable.l.type].name;return {text:name+' 공급 시설이 없습니다. '+obj(d)+' 「'+switchable.l.recipe.name+'」 제품으로 바꾸거나 한 곳 더 지으세요.',label:d+' 제품 바꾸기',focus:switchable.p.id,tool:null};}
  const l=own||open[0],d=definitions[l.type].name;
  return {text:name+' 공급 시설이 없습니다.'+(l.alt?' '+obj(d)+' 지은 뒤 「'+l.recipe.name+'」 제품으로 바꾸세요.':''),label:d+' 선택',focus:null,tool:l.type};
 }
 // K-06: tell a missing path from a missing supply. Stock in the store that does not arrive is a path; an empty store
 // with its makers stalled names the stall; an empty store with every maker running means more users than makers.
 const name=resources[item].name,pd=definitions[producer.type].name;
 if(sim.availableStock(item)>=need)return {...fallback,text:'창고에 '+name+'이 있지만 이 시설까지 오지 못합니다. 창고와 이어지는 빈 칸이나 흙길을 확인하세요.'};
 const makers=sim.buildings.filter(p=>(sim.recipeOf?.(p)||definitions[p.type]).output===item&&p.health>0&&p.enabled!==false);
 const stalled=makers.find(p=>operationHint(p.status,sim));
 if(stalled)return {text:pd+' · '+stalled.status+' · '+operationHint(stalled.status,sim),label:pd+' 확인',focus:stalled.id,tool:null};
 const users=sim.buildings.filter(p=>p.health>0&&p.enabled!==false&&(sim.effectiveInputs?.(p)||{})[item]>0).length;
 return {text:name+' 생산이 쓰는 곳보다 적습니다 · '+pd+' '+makers.length+'곳이 '+users+'곳에 공급합니다.',label:pd+' 하나 더',focus:null,tool:open(sim,producer.type)?producer.type:null};
}
