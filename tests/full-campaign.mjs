import {vehicleLoad} from '../src/app/game/export-route.js';
import {BASE_TIME_SCALE, realSeconds} from '../src/app/game/game-time.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Campaign} from '../src/app/game/campaign.js';
import {BUILDINGS,RESOURCES} from '../src/app/game/simulation.js';
import {RANKS,NATIONS,unlockRank} from '../src/app/game/world.js';
import {encodeSave,decodeSave} from '../src/app/game/persistence.js';
import {POWER_REACH} from '../src/app/game/trade-terminals.js';
// This driver uses only player actions and elapsed time. It never grants money,
// stock, production totals, rank or contract completions.
let c=new Campaign(),lastRank=-1,lastAction=0,lastPowerBuild=-100;const milestones=[],days=[];
const count=(s,t)=>s.buildings.filter(b=>b.type===t).length;
// Power is local (POWER_REACH tiles from a plant or substation): powered facilities go inside the grid,
// and when it has no room left a substation goes where it newly covers the most free land.
const gridNodes=s=>s.buildings.filter(b=>b.health>0&&(BUILDINGS[b.type].output==='power'||b.type==='substation'));
const inReach=(s,t)=>gridNodes(s).some(n=>Math.max(Math.abs(n.x-t.x),Math.abs(n.z-t.z))<=POWER_REACH);
// Imports ride an export vehicle in (export-route.js): order what is missing, counting what is already on the way,
// and report ready only once the goods are in the warehouse.
const incoming=(s,r)=>s.shipments.filter(sh=>sh.kind==='import'&&sh.item===r).reduce((n,sh)=>n+sh.amount,0);
// Residents keep hauling warehouse stock to facilities that use it, so a player orders a few extra and builds once
// enough is free (availableStock) rather than merely in the warehouse.
function order(s,r,n){const need=Math.ceil(n-s.availableStock(r)-incoming(s,r));if(need>0)s.buy(r,Math.min(vehicleLoad(s),need+6));}
function buyMissing(s,cost,items){let budget=cost;for(const [r,n] of Object.entries(items||{}))budget+=Math.max(0,n-s.availableStock(r)-incoming(s,r))*Math.ceil(RESOURCES[r].price*1.85);if(s.money<budget+120)return false;for(const [r,n] of Object.entries(items||{}))if(s.availableStock(r)<n)order(s,r,n);return Object.entries(items||{}).every(([r,n])=>s.availableStock(r)>=n);}
// While the next rank counts lord orders, the goods of the open order are not spent on construction.
const heldForOrder=s=>s.campaign&&!s.contractStatus().ready&&(s.promotion()?.requirements||[]).some(q=>q.key==='contracts'&&!q.done)?s.contract()?.item:null;
function build(s,type,desired=1){if(s.rank<unlockRank(type)||count(s,type)>=desired)return;
 const def=BUILDINGS[type],held=heldForOrder(s);if(held&&def.materials?.[held])return;if(!buyMissing(s,s.buildCost(type),def.materials))return;
 const free=s.tiles.filter(t=>t.terrain!=='water'&&s.ownedAt(t.x,t.z)&&!s.at(t.x,t.z)&&!s.roads.has(t.x+','+t.z)&&(type==='warehouse'||t.z%2===0&&t.x!==13));
 const onGrid=(def.power||type==='substation')&&gridNodes(s).length>0,tiles=onGrid?free.filter(t=>inReach(s,t)):[...free];
 if(type==='substation'){const gain=t=>free.filter(f=>!inReach(s,f)&&Math.max(Math.abs(f.x-t.x),Math.abs(f.z-t.z))<=POWER_REACH).length;tiles.sort((a,b)=>gain(b)-gain(a));}
 else if(def.irrigable)tiles.sort((a,b)=>s.placementEffects(type,b.x,b.z).water-s.placementEffects(type,a.x,a.z).water||Math.abs(a.x-11)+Math.abs(a.z-12)-Math.abs(b.x-11)-Math.abs(b.z-12));
 // The placement preview's slowdown (proximity.js slowNotes) counts like a few tiles of walking.
 else{const far=t=>Math.abs(t.x-11)+Math.abs(t.z-12)+(1-s.placementEffects(type,t.x,t.z).speed)*8;const cost=new Map(tiles.map(t=>[t,far(t)]));tiles.sort((a,b)=>cost.get(a)-cost.get(b));}
 // Guards defend their barracks, so its placement follows the exposed border shown by the raid forecast.
 if(type==='barracks'){const border=s.tiles.filter(t=>s.walkable(t.x,t.z)&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>!s.ownedAt(t.x+dx,t.z+dz))).sort((a,b)=>a.z-b.z||a.x-b.x).slice(0,6);const score=t=>border.reduce((n,p)=>n+Math.hypot(t.x-p.x,t.z-p.z),0);tiles.sort((a,b)=>score(a)-score(b));}
 for(const t of tiles){if(type!=='warehouse'&&!s.routeTo(s.entries(s.warehouse)[0],{x:t.x,z:t.z,size:1}))continue;if(s.build(type,t.x,t.z).ok)return;}
 if(onGrid&&type!=='substation'){build(s,'substation',count(s,'substation')+1);return;}
 if(s.money>s.expansionCost()+400){for(let z=0;z<6;z++)for(let x=0;x<6;x++)if(s.canExpand(x,z)){s.expand(x,z);return;}}
}
// Home build order follows the unlock ladder (docs/BALANCE_PATCH_20260928.md 9-3). A locked or already
// built entry is skipped, so the list is also the priority order once several entries are open.
const PLAN=[['roadhub',2],['house',4],['well',3],['field',3],['lumber',2],['distillery',1],['sawmill',1],['quarry',1],['mill',1],['bakery',1],['windturbine',1],['oilpump',1],['refinery',1],['cottonfield',2],['herbgarden',2],['clinic',1],['weaver',1],['dock',2],['smokehouse',1],['depot',1],['henhouse',1],['marketplace',1],['confectionery',1],['reservoir',1],['kiln',1],['stable',1],['tailor',1],['glassworks',1],['watermill',1],['dwarfhouse',2],['generator',1],['workshop',1],['windturbine',1],['logistics',1],['ironmine',1],['coalpit',1],['titanhouse',1],['smelter',1],['steamworks',1],['wardpost',1],['oilpump',1],['refinery',1],['coppermine',1],['chemical',1],['manaextractor',1],['wiremill',1],['electronics',1],['magetower',1],['cementworks',1],['station',1],['cannery',1],['automotive',1],['laboratory',1],['hospital',1],['arcanepower',1],['battery',1],['leyrelay',1],['bank',1],['barracks',1],['fortress',2],['lampworks',1],['engineworks',1],['mithrilforge',1],['parliament',1],['shipyard',1],['airdock',1],['blastfurnace',1],['assemblyline',1],['exchange',1]];
// Intermediates feed other chains and are never auto-sold; smoked fish is sold until the cannery needs it.
const KEEP=['water','wood','stone','iron','coal','oil','mana','steel','fuel','polymer','circuit','cotton','herb','egg','cloth','brick','glass','copper','wire','concrete','canned','engine','mithril'];
let contractsSent=0,recipeSwitches=0,tradedDay=0,stateTrades=0;const switchedAt=new Map(),recipeUse={};
function chooseRecipes(s){
 const waiting=new Set(s.buildings.map(b=>Object.keys(RESOURCES).find(r=>b.status===RESOURCES[r].name+' 대기')).filter(Boolean));
 const asked=new Set((s.promotion()?.requirements||[]).filter(q=>!q.done&&q.key.startsWith('produced:')).map(q=>q.key.split(':')[1]));
 const makers=r=>s.buildings.filter(b=>b.health>0&&b.enabled!==false&&s.recipeOf(b).output===r).length;
 for(const b of s.buildings){const list=BUILDINGS[b.type].recipes;if(!list||list.length<2||s.time-(switchedAt.get(b.id)??-1e9)<60)continue;const now=s.recipeOf(b);
  const want=list.find(r=>r!==now&&(r.unlock||0)<=s.rank&&(waiting.has(r.output)||asked.has(r.output))&&!makers(r.output)&&!waiting.has(now.output));
  const back=now!==list[0]&&!waiting.has(now.output)&&!asked.has(now.output)&&s.stock[now.output]>=s.minimumStock(now.output)+10;
  const next=want||(back?list[0]:null);if(next&&s.setRecipe(b.id,next.id).ok){switchedAt.set(b.id,s.time);recipeSwitches++;recipeUse[b.type+':'+next.id]=(recipeUse[b.type+':'+next.id]||0)+1;}}
}
function operate(){const s=c.home.sim;c.activeId=c.homeId;
 if(!s.warehouse){assert.ok(s.build('warehouse',11,12).ok);}
 if(s.stock.fuel<2&&s.money>300&&!s.buildings.some(b=>s.recipeOf(b).output==='fuel'&&b.out>0)&&!incoming(s,'fuel'))s.buy('fuel',2);
 if(s.storageUsed>s.storageCapacity*.8){build(s,'depot',count(s,'depot')+1);if(s.storageUsed>s.storageCapacity-100&&s.stock.fuel<s.minimumStock('fuel')+5){const waste=Object.entries(s.stock).filter(([r,n])=>r!=='fuel'&&n>s.minimumStock(r)+60).sort((a,b)=>b[1]-a[1])[0];if(waste)for(const store of [s.starterStore,...s.buildings.filter(b=>b.inventory)]){const n=Math.min(100,Math.floor((store.inventory[waste[0]]||0)-20));if(n>0){s.discardStock(store.id,waste[0],n);break;}}}}
 // A player follows the next promotion's land goal before spending on new facilities.
 if(s.promotion()?.requirements.some(r=>r.key==='expansions'&&!r.done)&&s.money>=s.expansionCost()){for(const [x,z]of [[4,3],[3,4],[2,4],[1,3],[3,1]])if(s.expand(x,z).ok)break;}
 // Hauling grows with the town: one more basic house every two ranks, as a player adds homes when goods wait.
 for(const [type,n] of PLAN)build(s,type,type==='house'?Math.min(18,n+Math.floor(s.rank/2)):n);
 // A rank that asks for more residents gets another home of the newest unlocked kind.
 if(s.promotion()?.requirements.some(q=>q.key==='workers'&&!q.done)){const home=Object.keys(BUILDINGS).filter(t=>BUILDINGS[t].home&&unlockRank(t)<=s.rank).sort((a,b)=>unlockRank(b)-unlockRank(a))[0];build(s,home,count(s,home)+1);}
 // The power map identifies overloaded factories; add generation as their upgraded loads grow.
 if(s.time-lastPowerBuild>=80&&s.buildings.some(b=>b.status.startsWith('전력 용량 부족'))){lastPowerBuild=s.time;build(s,'windturbine',count(s,'windturbine')+1);}
 chooseRecipes(s);
 for(const b of s.buildings){const recipe=s.recipeOf(b);if(RESOURCES[recipe?.output]&&!RESOURCES[recipe.output].final){const limit=Math.max(s.minimumStock(recipe.output)+30,60);const on=s.stock[recipe.output]<limit;if(b.enabled!==on)s.setOperation(b.id,on);}}

 // Like a player reading "X 대기" on a facility, add one more producer of a starved input (at most three of a kind).
 if(s.money>(s.promotion()?.fee||0)+500){const starved=new Set(s.buildings.map(b=>Object.keys(RESOURCES).find(r=>b.status===RESOURCES[r].name+' 대기')).filter(Boolean));for(const r of starved){const p=Object.keys(BUILDINGS).filter(t=>BUILDINGS[t].output===r&&BUILDINGS[t].period&&unlockRank(t)<=s.rank).sort((a,b)=>unlockRank(b)-unlockRank(a))[0];if(p&&count(s,p)<(['grain','water'].includes(r)?6:3)){build(s,p,count(s,p)+1);break;}}}
 // Upgrades wait while they would eat the goods of the lord's open order.
 const ordered=heldForOrder(s);
 for(const site of c.sites){const sim=site.sim;for(const b of sim.buildings){if(b.health<100&&sim.money>sim.repairCost(b)+100)sim.repair(b.id);if(b.level<3&&sim.upgradeItem(b)===ordered)continue;if(b.level<3&&BUILDINGS[b.type].home&&sim.money>200&&sim.stock.wood>=6)sim.upgrade(b.id);if(b.level<3&&(BUILDINGS[b.type].period||BUILDINGS[b.type].terminal)&&sim.money>1200&&sim.stock.plank>=3)sim.upgrade(b.id);}
  if(sim.money>300)for(const t of sim.tiles)if(sim.ownedAt(t.x,t.z)&&t.z%2===1&&!sim.at(t.x,t.z)&&!sim.roads.has(t.x+','+t.z)&&sim.money>220)sim.build('road',t.x,t.z);
  if(sim.health.infection>15&&sim.health.sanitationUntil<sim.time&&sim.money>100)sim.sanitize();if(sim.pendingEvent?.type==='storm')sim.reinforce();if(sim.raid&&!sim.raid.finished)sim.mobilize();
  if(site.id!==c.homeId){if(sim.stock.fuel<5&&sim.money>400)order(sim,'fuel',10);build(sim,'warehouse');if(sim.warehouse){build(sim,'house');build(sim,'generator');build(sim,'station');}for(const r of ['wood','water'])if(sim.stock[r]+incoming(sim,r)<12&&sim.money>1200)sim.buy(r,Math.min(30,vehicleLoad(sim)));}
  const st=sim.buildings.find(b=>b.type==='station');if(st&&!sim.rails.size&&buyMissing(sim,sim.buildCost('rail'),BUILDINGS.rail.materials))for(const[dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]])if(sim.build('rail',st.x+dx,st.z+dz).ok)break;
 }
 for(const r of Object.keys(RESOURCES)){s.autoSell[r]=!KEEP.includes(r)&&!(r==='smokedfish'&&s.rank>=unlockRank('cannery'));s.reserves[r]=({fuel:0,grain:35,plank:25,gear:30,bread:s.rank>=20?35:0,car:8,medicine:20,workwear:8,lamp:6}[r]??(RESOURCES[r].price>=1000?0:12));}
 // High-value finished goods (airships) are shipped as soon as they are made instead of waiting for a lot of ten.
 for(const r of Object.keys(RESOURCES)){const spare=Math.floor(s.availableStock(r)-s.minimumStock(r));if(RESOURCES[r].price>=1000&&s.autoSell[r]&&spare>=1)s.sell(r,spare);}
 // Import only resources whose unlocked producer is genuinely short of supply.
 if(s.money>2400)for(const r of ['wood','stone','water','grain','iron','coal','oil','mana','steel','gear','fuel','polymer','circuit'])if(s.stock[r]+incoming(s,r)<12)s.buy(r,Math.min(20,vehicleLoad(s)));
 if(s.contractStatus().ready&&s.fulfill().ok)contractsSent++;
 if(s.debt&&(s.money>1400||(s.promotion()?.requirements.some(r=>r.key==='debtFree'&&!r.done)&&s.money>300)))s.repay();if(!s.family&&s.rank>=2&&s.money>400)s.rescue();if(s.rank>=5&&!s.charter)s.chooseCharter('commons');
 if(s.rank>=2&&s.expansions<2&&s.money>s.expansionCost()+300){for(const [x,z]of [[4,3],[3,4],[2,4]])if(s.expand(x,z).ok)break;}
 // Each promotion also records how far the next rank's requirements already stand the moment it lands (audit A2-P1).
 const p=s.promotion();if(p?.ready){assert.equal(s.promote().ok,true);milestones.push({rank:s.rank+1,name:RANKS[s.rank].name,day:s.day,elapsed:+(s.time/80).toFixed(2),money:Math.floor(s.money),nextOnArrival:(s.promotion()?.requirements||[]).map(q=>[q.key,Math.floor(q.current),q.target])});console.log(JSON.stringify(milestones.at(-1)));}
 const neededSites=Math.max(s.rank>=20?3:2,...(s.promotion()?.requirements||[]).filter(r=>r.key==='sites').map(r=>r.target));
 if(s.rank>=13&&c.sites.length<neededSites&&s.money>2600&&buyMissing(s,1400,{wood:24,stone:16,water:8}))c.foundSite('estern','highland');
 // The first freight route opens with spare steel, or with timber as soon as the next rank counts inter-site freight
 // (the rail routes later carry grain, and one pair of sites takes one route per good).
 const freightAsked=(s.promotion()?.requirements||[]).some(q=>q.key==='deliveries'&&!q.done);
 if(c.sites.length>1&&!c.routes.length&&(s.stock.steel>15||freightAsked&&s.availableStock('wood')>=18))c.createRoute(c.homeId,c.sites[1].id,s.stock.steel>15?'steel':'wood',6,'truck');
 // A side challenge asking for more kinds of goods sold: sell one unit of the cheapest good not sold yet.
 const trial=s.promotion()?.trial;if(trial?.key==='diversity'&&!trial.done){const r=Object.keys(RESOURCES).filter(r=>!(s.sold[r]>0)&&s.availableStock(r)>=1).sort((a,b)=>RESOURCES[a].price-RESOURCES[b].price)[0];if(r)s.sell(r,1);}
 // A branch sells what the routes bring into its own market instead of letting its warehouse fill up.
 for(const r of c.routes){const to=c.sites.find(v=>v.id===r.to);if(to&&to.id!==c.homeId)to.sim.autoSell[r.item]=true;}
 if(s.rank>=18){for(const site of c.sites.slice(1,1+Math.max(2,(s.promotion()?.requirements||[]).find(q=>q.key==='railRoutes')?.target||0)))if(c.stationReady(s)&&c.stationReady(site.sim)&&!c.routes.some(r=>r.to===site.id&&r.mode==='rail'))c.createRoute(c.homeId,site.id,'grain',6,'rail');}
 if(s.rank>=22&&c.defense<12){const price=c.councilPrice('defense');if(s.money>price.money+100&&buyMissing(s,price.money,price.items))c.council('defense');}
 if(s.rank>=24&&c.support<87&&s.money>1000)c.council('welfare');
 if(s.rank>=25&&s.money>2800){for(const id of Object.keys(NATIONS).filter(id=>NATIONS[id].playable&&id!=='estern'&&!c.recognition.includes(id))){if(c.recognition.length>=6)break;if(!c.council('recognition',id).ok)break;}for(const site of c.sites)if(!site.territory&&s.money>3400)c.council('territory',site.id);}
 // Money is spent on what the next promotion asks, never poured into land or stakes nobody needs (audit A2-M1): the bot
 // buys land when a build finds no tile (build) or a rank asks for it, and takes the stakes the next rank asks for.
 const asked=key=>(s.promotion()?.requirements||[]).find(q=>q.key===key)?.target||0,buffer=()=>(s.promotion()?.fee||0)+1000;
 // Land is bought ahead while the town is short of room (fewer than four free building tiles) or a quarry has run out of rock.
 const room=s.tiles.filter(t=>t.terrain!=='water'&&s.ownedAt(t.x,t.z)&&!s.at(t.x,t.z)&&!s.roads.has(t.x+','+t.z)&&t.z%2===0&&t.x!==13).length;
 const spent=s.buildings.some(b=>b.type==='quarry'&&!s.closestNatural(b,'rock'));
 if((room<4||spent)&&s.money>buffer()+s.expansionCost()){let grown=false;for(let z=0;z<6&&!grown;z++)for(let x=0;x<6&&!grown;x++)if(s.canExpand(x,z))grown=s.expand(x,z).ok;}
 if(c.investments.length<asked('investment')&&s.money>buffer()+c.investPrice())c.council('invest','estern');
 // Once a day the player sends every emerging-state order that can leave (EmergingStates "모두 보내기").
 if(c.newStates.length&&tradedDay!==c.lastWorldDay){tradedDay=c.lastWorldDay;if(c.tradeAll().ok)stateTrades++;}
 // Plant after local timber runs low; actions have normal material/cash costs.
 if(s.buildings.some(b=>b.type==='lumber'&&!s.closestNatural(b,'tree'))&&s.money>200){for(const t of s.tiles){if(t.x<8||t.x>15||t.z<8||t.z>15||t.z%2===1)continue;if(s.plant(t.x,t.z).ok)break;}}
 if(s.money<100)s.recover();
 if(s.rank!==lastRank){lastRank=s.rank;lastAction=s.time;}
 if(s.time-lastAction>3600){console.error('BLOCKED',s.rank,JSON.stringify(s.promotion()),JSON.stringify(s.stock),JSON.stringify(s.buildings.map(b=>[b.type,b.x,b.z,b.status])),s.money,JSON.stringify(c.routes),JSON.stringify(c.sites.map(site=>({id:site.id,power:site.sim.power,rail:[...site.sim.rails],buildings:site.sim.buildings.map(b=>[b.type,b.x,b.z,b.status]),stock:site.sim.stock}))));process.exit(1);}
}
// Daily ledger (end of each day): rank, cash, revenue earned that day across every site, facilities on the map.
let revenueMark=0,dayMark=c.active.day;
const record=()=>{const day=c.active.day;if(day===dayMark)return;if(process.env.TG_CAMPAIGN_TRACE)console.log('TRACE '+JSON.stringify({day,rank:c.rank,open:c.active.promotion()?.requirements.filter(r=>!r.done),contract:c.active.contract(),status:c.active.contractStatus(),trial:c.active.promotion()?.trial,pending:c.active.pendingEvent,nextEvent:c.active.nextEvent,time:c.active.time,buildings:c.active.buildings.filter(b=>/대기|부족/.test(b.status)).map(b=>[b.type,b.status])}));days.push({day:dayMark,rank:c.rank,money:Math.floor(c.treasury.money),income:Math.round(c.treasury.totalRevenue-revenueMark),buildings:c.sites.reduce((n,v)=>n+v.sim.buildings.length,0)});revenueMark=c.treasury.totalRevenue;dayMark=day;};
// The player also acts at the moment the day turns, so the end-of-day cash is what remains after that day's decisions.
for(let i=0;i<240000&&c.rank<32;i++){if(i%40===0)operate();c.tick(.25);if(c.active.day!==dayMark)operate();record();if(i>0&&i%8000===0){const before=c.save();c=new Campaign({saved:decodeSave(encodeSave(before))});assert.deepEqual(c.save(),before,'periodic save recovery preserves full campaign');}}
days.push({day:dayMark,rank:c.rank,money:Math.floor(c.treasury.money),income:Math.round(c.treasury.totalRevenue-revenueMark),buildings:c.sites.reduce((n,v)=>n+v.sim.buildings.length,0),partial:true});
assert.equal(c.rank,32,'all 33 ranks must be reachable through player actions');assert.equal(milestones.length,32);assert.ok(c.treasury.produced.car>=RANKS[32].requirements.find(r=>r[0]==='produced:car')[1]);assert.ok((c.treasury.produced.airship||0)>=RANKS[31].requirements.find(r=>r[0]==='produced:airship')[1]);assert.ok(c.metric('territories')>=5);assert.ok(c.routes.filter(r=>r.mode==='rail'&&r.completed>0).length>=2);

// Acceptance criteria A1~A5 (docs/BALANCE_PATCH_20260928.md 9-3).
const SEGMENTS=[['A 개척',1,6,6],['B 가공',7,13,16],['C 중공업',14,19,27],['D 첨단',20,23,35],['E 자치',24,28,47],['F 국가',29,32,60]];
// Segment targets are days played (6 days = 480 game seconds), so the end is the elapsed time, not the 1-based day number
// (reaching 임차 사업주 7.1 days in is day 8 by number but inside the 7.5-day window).
const reached=rank=>milestones.find(m=>m.rank-1>=rank)?.elapsed;
const full=days.filter(d=>!d.partial);
const segments=SEGMENTS.map(([name,from,to,target])=>{const rows=full.filter(d=>d.rank>=from-(from===1?1:0)&&d.rank<=to);return {name,ranks:from+'~'+to,endDay:reached(to),target,window:[target*.75,target*1.25],averageIncome:rows.length?Math.round(rows.reduce((n,d)=>n+d.income,0)/rows.length):0,days:rows.length};});
const perDay=Object.values(milestones.reduce((m,v)=>(m[v.day]=(m[v.day]||0)+1,m),{}));
const lateDays=full.filter(d=>d.rank>=13&&d.rank<=31),poor=lateDays.filter(d=>d.money<300).length;
const promotionDays=milestones.map(m=>m.day),gaps=promotionDays.slice(1).map((d,i)=>d-promotionDays[i]);
const lastThree=milestones.slice(-3),hoard=Math.max(...days.filter(d=>d.day>=lastThree[0].day&&d.day<=lastThree.at(-1).day).map(d=>d.money));
const acceptance={
 A1:{rule:'각 구간 종료일이 목표의 ±25% 안',segments:segments.map(v=>({name:v.name,endDay:v.endDay,window:v.window})),pass:segments.every(v=>v.endDay>=v.window[0]&&v.endDay<=v.window[1])},
 A2:{rule:'같은 날 승급 3회 이상 없음',maxPerDay:Math.max(...perDay),pass:Math.max(...perDay)<3},
 A3:{rule:'13~31단계 일말 자금 300G 미만인 날 20% 이하',poorDays:poor,days:lateDays.length,pass:poor<=lateDays.length*.2},
 A4:{rule:'승급 간 최장 간격 5일 이하 · 마지막 3개 승급 사이 최대 보유 자금이 최종 수수료의 2배 이하',maxGap:Math.max(...gaps),maxMoney:hoard,limit:RANKS[32].fee*2,pass:Math.max(...gaps)<=5&&hoard<=RANKS[32].fee*2},
 A5:{rule:'구간별 평균 일일 수입이 A→F 단조 증가 · E 평균이 C 평균의 2배 이상',averages:segments.map(v=>v.averageIncome),pass:segments.every((v,i)=>!i||v.averageIncome>segments[i-1].averageIncome)&&segments[4].averageIncome>=segments[2].averageIncome*2}
};
const fuel=c.sites.reduce((n,v)=>n+(v.sim.logisticsStats.fuel||0),0),fuelTrips=c.sites.reduce((n,v)=>n+(v.sim.logisticsStats.fuelTrips||0),0);
const result={day:c.active.day,baseTimeScale:BASE_TIME_SCALE,completionRealMinutesAt1x:Math.round(realSeconds(c.active.time)/60),sites:c.sites.length,revenue:Math.round(c.treasury.totalRevenue),produced:c.treasury.produced,milestones:milestones.length,contracts:c.treasury.contracts,contractsSent,recipeSwitches,recipeUse,fuelBurnedByVehicles:fuel,fuelTrips,investments:c.investments.length,stateTradeDays:stateTrades,upkeepPerDay:c.upkeep(),completion:c.completion};
assert.ok(recipeSwitches>0,'the player uses alternative products');assert.ok(fuel>0&&fuelTrips>0,'fuel vehicles run and burn fuel');
fs.writeFileSync(process.env.TG_CAMPAIGN_REPORT||new URL('../docs/FULL_CAMPAIGN_RESULT.json',import.meta.url),JSON.stringify({date:new Date().toISOString().slice(0,10),test:'tests/full-campaign.mjs',method:'Normal paid player actions and elapsed time; no injected cash, stock, production or ranks. Roads built through player actions. Periodic save/restore. Days are recorded at each day change: rank and cash at the end of the day, revenue earned that day across all sites, facilities on the map.',result,segments,acceptance,promotions:milestones,days},null,1)+'\n');
console.log(JSON.stringify({segments,acceptance},null,1));
for(const [id,a] of Object.entries(acceptance))assert.ok(a.pass,id+' '+a.rule+' :: '+JSON.stringify(a));
console.log('FULL CAMPAIGN PASS',JSON.stringify(result));
