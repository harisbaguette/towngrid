import {BUILDINGS,RESOURCES} from './simulation.js';
import {RACES,unlockRank} from './world.js';
// Project-specific balance, inspired by Town Star's documented adjacency rules.
// Distances use a square tile radius; roads use orthogonal adjacency.
export const EMISSIONS={generator:2,steamworks:2,smelter:3,refinery:3,chemical:3,coalpit:2,oilpump:2,automotive:1,kiln:1,glassworks:2,cementworks:2,wiremill:1,mithrilforge:2,blastfurnace:3,shipyard:1,cannery:1};
export const HEIGHTS={warehouse:2,house:1,dwarfhouse:1,titanhouse:1,spirithouse:1,centaurhouse:1,mill:2,generator:2,workshop:1,logistics:2,smelter:3,refinery:3,chemical:2,magetower:3,manaextractor:2,arcanepower:3,station:2,hospital:2,bank:2,barracks:1,depot:2,windturbine:2,parliament:3,shipyard:3,cementworks:2,fortress:2,airdock:2,exchange:2,blastfurnace:3,watermill:1,marketplace:1};
// Terrain rules of 2026-09-29 (docs/EXPANSION_20260929.md 3, docs/BALANCE_PATCH_20260928.md 14). A map with
// land.ecology (every site made since 2026-09-28) plays them; an older map keeps the old rules, as it keeps its
// old ground. The terrain facilities (pond, pasture, clover) work on every map.
export const terrainRules=sim=>!!sim.layout?.ecology;
export const MINES=['ironmine','coalpit','coppermine','sandpit'],HERDS=['sheeppen','milkbarn'];
/** Water within two tiles: a touching tile gives 2, the next ring 1. Open water (river, lake, marsh pool) within
 *  two tiles also gives a base of 3, so a wheat field (need 3) is watered exactly where the old rule watered it. */
export const WATER_RING=[0,2,1],OPEN_WATER=3;
/** Each same-kind facility on the eight tiles around (corners included) cuts the production time by 10%, at most by
 *  half (five neighbours), so the cap is reachable while one side stays open as the entrance. */
export const CLUSTER_STEP=.1,CLUSTER_MAX=5;
/** Mountain shade and wind shelter by distance 1..5 (steps 3,2,2,1,1); salt by distance to the sea 1..2. */
const MOUNTAIN=[0,3,2,2,1,1],SALT=[0,2,1];
export function placementEffects(sim,type,x,z){
 const d=BUILDINGS[type],modern=terrainRules(sim),crop=!!d?.irrigable,need=modern?d?.waterNeed||0:0;
 let pollution=0,shade=0,windBlock=0,water=0,reservoir=false,ponds=0,waterScore=0,open=false,mountain=0,coast=9,flooded=false,graze=0,clover=0,cluster=0,serves=0;const sources=[];
 for(const b of sim.buildings){if(b.x===x&&b.z===z)continue;const distance=Math.max(Math.abs(b.x-x),Math.abs(b.z-z));
  const dirty=EMISSIONS[b.type]||0,height=HEIGHTS[b.type]||0;
  if(b.health>0&&b.enabled!==false&&dirty&&distance<=dirty){pollution+=dirty+1-distance;sources.push({type:b.type,kind:'pollution',distance});}
  if(height&&distance<=height){shade=Math.max(shade,height+1-distance);windBlock=Math.max(windBlock,height+1-distance);}
  if(crop&&b.type==='reservoir'&&b.health>0&&b.enabled!==false&&b.activeUntil>sim.time&&distance<=2)reservoir=true;
  if(distance<=2){
   if(b.type==='pond'){ponds++;waterScore+=WATER_RING[distance];if(distance===1)flooded=true;}
   else if(b.type==='pasture')graze+=WATER_RING[distance];
   else if(b.type==='clover')clover++;
   const bd=BUILDINGS[b.type];if(type==='pond'&&(modern?bd.waterNeed:bd.irrigable)||type==='pasture'&&HERDS.includes(b.type)||type==='clover'&&b.type==='apiary')serves++;
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
 const salt=modern?SALT[coast]||0:0;flooded=modern&&MINES.includes(type)&&flooded;cluster=modern&&d?.period&&RESOURCES[d.output]?Math.min(CLUSTER_MAX,cluster):0;
 const road=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>sim.roads.has((x+dx)+','+(z+dz)));
 const sensitive=crop||['stable','dock','henhouse','sheeppen','milkbarn','duckhouse','apiary'].includes(type),wind=['mill','windturbine'].includes(type);
 // A solar panel loses 20% per shade step (docs/BALANCE_PATCH_20260928.md 13-2). Salt slows an irrigated crop 15% a
 // step and speeds a salt pan 20% a step; a flooded mine runs at 70%; pasture feeds a herd 10% a point up to 40%.
 const speed=(sensitive?Math.max(.4,1-pollution*.1-(crop?shade*.1+salt*.15:0)):1)*(wind?Math.max(.4,1-windBlock*.2):1)*(type==='solarpanel'?Math.max(.4,1-shade*.2):1)
  *(type==='saltfield'?1+salt*.2:1)*(flooded?.7:1)*(HERDS.includes(type)?1+Math.min(.4,graze*.1):1)/(1-cluster*CLUSTER_STEP);
 const blocked=type==='apiary'&&!clover?'야생 클로버 필요':null;
 return {water,waterScore,waterNeed:need,pollution,shade,mountain,windBlock,salt,flooded,graze,clover,cluster,serves,blocked,modern,road,speed,sources};
}
/** Short notes on the rules that act on this facility at this spot, for the placement preview and the facility panel. */
export function effectNotes(type,e){
 const d=BUILDINGS[type],out=[],crop=!!d?.irrigable,add=(text,tone='')=>out.push({text,tone});
 if(e.waterNeed)add('물 '+e.waterScore+'/'+e.waterNeed+(e.water?' · 운반 생략':' · 운반 필요'),e.water?'positive':'');else if(crop&&e.water)add('담수 관개 · 물 운반 생략','positive');
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
 if(status.endsWith(' 대기')&&status!=='운반 대기')return '원료 재고와 창고에서 이 시설까지의 통로를 확인하세요.';
 if(status.endsWith(' 주민 필요')){const race=Object.keys(RACES).find(r=>status===RACES[r].name+' 주민 필요'),house=Object.keys(BUILDINGS).find(t=>BUILDINGS[t].resident===race);return house?obj(BUILDINGS[house].name)+' 지어 '+RACES[race].name+' 주민을 들이세요. 이 작업장은 '+RACES[race].name+'만 다룹니다.':'이 작업장을 다루는 주민의 주택을 지으세요.';}
 return {'도로 연결 필요':'시설 옆에 흙길을 놓고 창고까지 이어주세요.','출입구 막힘':'시설 옆 한 칸을 비우세요.','창고 경로 막힘':'창고와 이어지는 빈 칸이나 흙길을 만드세요.','전력 부족':'발전 시설에 원료를 공급하거나 발전 시설을 더 지으세요.','전력망 밖 · 변전소 필요':'발전소 여섯 칸 안으로 옮기거나, 발전소와 이 시설 사이에 변전소를 지어 전기를 이어주세요.','운반 대기':'주민 주택을 더 짓거나 개선해 운반할 주민을 늘리고, 창고까지 흙길을 이으세요.'+(open(sim,'logistics')?' 자동 물류센터를 가동하면 운반량이 두 배가 됩니다.':''),'창고 가득 참':'재고를 팔아 창고 자리를 비우세요.'+(open(sim,'depot')?' 자재 보관소를 지으면 보관 한도가 늘어납니다.':''),'수리 필요':'수리하면 생산이 다시 시작됩니다.','야생 클로버 필요':'양봉장 두 칸 안에 야생 클로버를 심으세요.','자원 고갈':'벌목장은 나무를 심고, 채석장은 자원 주변으로 옮기세요.','가동 중지':'가동 스위치를 켜세요.','창고 필요':'창고를 먼저 지으세요.'}[status]||'';
}

export function productionDiagnosis(sim,b,definitions,resources){
 const fallback={text:operationHint(b.status,sim),label:'시설 확인',focus:b.id,tool:null};
 if(b.health<100)return {...fallback,text:'내구도 '+Math.round(b.health)+'% · 수리비 '+sim.repairCost(b)+'G'};
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
 if(!producer){const types=Object.keys(definitions).filter(k=>(definitions[k].recipes||[definitions[k]]).some(r=>r.output===item)).sort((a,c)=>unlockRank(a)-unlockRank(c)),type=types.find(k=>unlockRank(k)<=sim.rank);if(!type)return {text:resources[item].name+' 공급 시설이 아직 잠겨 있습니다. 창고 재고나 수입으로 공급하세요.',label:'시장 확인',focus:null,tool:null};return {text:resources[item].name+' 공급 시설이 없습니다.',label:definitions[type].name+' 선택',focus:null,tool:type};}
 if(producer.out===0&&sim.availableStock(item)===0)return {text:definitions[producer.type].name+'의 '+producer.status,label:definitions[producer.type].name+' 확인',focus:producer.id,tool:null};
 return {...fallback,text:resources[item].name+' '+need+'개가 필요합니다. 공급 시설까지 통로를 확인하세요.'};
}
