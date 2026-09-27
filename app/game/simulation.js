import {nextTrial,tickChallenges,chooseCharter} from './progression.js';
import {available, cancelTask, assignJob, moveWorkers, crewFor} from './logistics.js';
import {marketFactor, saleQuote, tickEconomy, sanitation, rescueInfo, advanceRescue, tickRescue} from './living-economy.js';
import {assignResidentAppearance} from './resident-roster.js';
import { placementEffects } from './proximity.js';
import { reserveFor, purchase, plant, restructure } from './economy.js';
import { startRaid, tickRaid, mobilize } from './encounters.js';
import { MODERN_RESOURCES, MODERN_BUILDINGS } from './industry.js';
import { NATIONS, RACES, RANKS, unlockRank, RESIDENT_NAMES, FACTIONS, factionOf, playableRace, PROGRESSION_OFFSET, crewOf } from './world.js';
export const N=24;
export const RESOURCES={
 wood:{name:'목재',color:'#b67b46',price:9},stone:{name:'석재',color:'#94a2ab',price:10},
 water:{name:'물',color:'#4bbde5',price:3},grain:{name:'밀',color:'#e8be48',price:9},
 plank:{name:'판재',color:'#d8a15d',price:25},flour:{name:'밀가루',color:'#ecddb7',price:23},
 bread:{name:'빵',color:'#d99449',price:42},fish:{name:'생선',color:'#60b7c7',price:24},gear:{name:'기계 부품',color:'#839bac',price:95}
};
export const REGIONS={
 river:{name:'버드나무 강변',tag:'농업과 식품',description:'담수와 비옥한 땅을 이용해 식품 산업을 키웁니다.',bonus:'강과 비옥한 타일 분포',risk:'강변 범람 주의',color:'#769b50'},
 coast:{name:'푸른빛 해안',tag:'어업과 교역',description:'바다에서 생선을 얻고 교역으로 성장합니다.',bonus:'어항 건설 가능',risk:'해안 폭풍 주의',color:'#419bb8'},
 highland:{name:'붉은돌 고원',tag:'채석과 가공',description:'풍부한 석재로 가공 산업을 먼저 준비합니다.',bonus:'산악과 암석 타일 분포',risk:'광산 접근로 확보',color:'#ae8863'}
};
export const BUILDINGS={
 warehouse:{name:'창고',group:'base',size:1,cost:80,materials:{wood:6},unique:true,description:'재고와 출하의 중심입니다. 주민은 가까운 생산 시설끼리 직접 운반할 수도 있습니다.'},
 road:{name:'흙길',group:'base',size:1,cost:4,description:'운반자가 길 위에서 70% 빠르게 이동합니다.'},
 well:{name:'우물',group:'base',size:1,cost:60,materials:{stone:4},period:9,output:'water',amount:3,description:'물통을 끌어올려 물을 공급합니다.'},
 field:{name:'밀밭',group:'farm',size:1,cost:45,period:17,inputs:{water:1},output:'grain',amount:4,description:'물을 공급받아 밀을 재배합니다.'},
 lumber:{name:'벌목장',group:'base',size:1,cost:90,materials:{wood:4},period:13,output:'wood',amount:4,natural:'tree',description:'네 칸 이내의 나무를 베어 목재를 얻습니다.'},
 quarry:{name:'채석장',group:'base',size:1,cost:100,materials:{wood:5},period:16,output:'stone',amount:3,natural:'rock',description:'네 칸 이내의 바위에서 석재를 캡니다.'},
 stable:{name:'말 축사',group:'farm',size:1,cost:160,materials:{wood:10},period:28,inputs:{grain:1,water:1},output:'horse',amount:1,unique:true,description:'먹이와 물을 공급하면 운반 속도가 35% 빨라집니다.'},
 house:{name:'주민 주택',group:'home',home:true,size:1,cost:60,materials:{wood:4,stone:1},description:'가장 싼 기본 주택. 진영의 기본 종족(인간·엘프) 주민 1명이 살며 어느 시설이든 운반합니다. 개선할 때마다 1명씩 늘어 최대 3명이 삽니다.'},
 dwarfhouse:{name:'드워프 주택',group:'home',home:true,resident:'dwarf',size:1,cost:140,materials:{plank:3,stone:4},description:'드워프 주민 1명이 삽니다. 개선할 때마다 1명씩 늘어 최대 3명이 삽니다. 기계 공장·제철소·증기 기계공장은 드워프만 다룰 수 있습니다.'},
 titanhouse:{name:'티탄 주택',group:'home',home:true,resident:'titan',size:1,cost:180,materials:{plank:4,stone:6,gear:1},description:'티탄 주민 1명이 삽니다. 개선할 때마다 1명씩 늘어 최대 3명이 삽니다. 짐을 두 배로 나르지만 전자 공장·제약 공장·종합 병원·마탑 같은 고지능 작업장에는 들어가지 못합니다.'},
 spirithouse:{name:'정령 거처',group:'home',home:true,resident:'spirit',size:1,cost:140,materials:{plank:3,stone:4},description:'정령 주민 1명이(요정 모습도 나옴) 삽니다. 개선할 때마다 1명씩 늘어 최대 3명이 삽니다. 마력 추출소·마탑·마력 발전소·전자 공장·제약 공장은 정령만 다룰 수 있습니다.'},
 centaurhouse:{name:'켄타로스 주택',group:'home',home:true,resident:'centaur',size:1,cost:180,materials:{plank:4,stone:6,gear:1},description:'켄타로스 주민 1명이 삽니다. 개선할 때마다 1명씩 늘어 최대 3명이 삽니다. 짐을 두 배로 나르고 빠르지만 고지능 작업장에는 들어가지 못합니다.'},
 sawmill:{name:'제재소',group:'craft',size:1,cost:150,materials:{wood:8,stone:3},period:15,inputs:{wood:2},output:'plank',amount:3,description:'원목을 투입하고 노출된 톱날로 판재를 가공합니다.'},
 mill:{name:'제분소',group:'craft',size:1,cost:170,materials:{wood:10,stone:4},period:15,inputs:{grain:3},output:'flour',amount:3,description:'밀을 갈아 밀가루 포대를 만듭니다.'},
 bakery:{name:'빵집',group:'craft',size:1,cost:200,materials:{wood:8,stone:6},period:19,inputs:{flour:2,water:1,wood:1},output:'bread',amount:5,description:'반죽을 장작 화덕에 넣어 빵을 굽습니다.'},
 dock:{name:'어항',group:'farm',size:1,cost:180,materials:{wood:10},period:17,output:'fish',amount:4,description:'강이나 바다에서 세 칸 이내에 건설하세요.'},
 generator:{name:'증기 발전소',group:'industry',size:1,cost:260,materials:{plank:8,stone:10},period:12,inputs:{wood:2,water:1},output:'power',amount:1,unique:true,description:'장작과 물로 증기를 만들어 산업 설비에 전력을 공급합니다.'},
 workshop:{name:'기계 공장',group:'industry',size:1,cost:280,materials:{plank:8,stone:8},period:22,inputs:{plank:2,stone:2},output:'gear',amount:2,power:true,description:'전력을 받아 판재와 석재를 기계 부품으로 가공합니다.'},
 logistics:{name:'자동 물류센터',group:'industry',size:1,cost:350,materials:{plank:10,gear:4},power:true,unique:true,description:'전력이 공급되면 운반량이 두 배가 되고 운반 속도가 빨라집니다.'},
 clinic:{name:'진료소',group:'industry',size:1,cost:220,materials:{plank:6,stone:6},unique:true,description:'물 2개와 밀 1개를 정기적으로 소비해 초기 감염을 치료합니다. 산업화 뒤에는 병원과 의약품이 필요합니다.'}
};
Object.assign(RESOURCES,MODERN_RESOURCES);Object.assign(BUILDINGS,MODERN_BUILDINGS);for(const d of Object.values(BUILDINGS))d.size=1;BUILDINGS.logistics.road=true;for(const id of ['electronics','laboratory','hospital','magetower'])BUILDINGS[id].skilled=true;
const K=(x,z)=>x+','+z;
// A house holds one resident per upgrade level (1-3); other buildings hold none.
export const homeCapacity=b=>BUILDINGS[b?.type]?.home?Math.max(1,b.level||1):0;
export const noise=(x,z)=>{let a=Math.sin(x*127.1+z*311.7+37)*43758.5453;return a-Math.floor(a);};
export class Simulation{
 constructor(region='river',saved=null,options={}){
  this.charter=null;this.market={pressure:{}};this.health={infection:0,sanitationUntil:0,nextCare:0,recoveries:0};this.rescueQuest={step:0,remaining:0,route:null};this.logisticsStats={direct:0,delivered:0,last:null};this.challenge={};
  this.nation=saved?.nation||options.nation||'estern';this.race=saved?.race||options.race||NATIONS[this.nation].race;this.rank=0;this.contracts=0;this.soundEvents=[];this.eventLog=[];this.raid=null;this.raidCount=0;this.eventCount=0;this.lastRecoveryDay=-10;this.reserves={wood:12,stone:8,water:6,grain:8};this.budget={day:1,income:0,expenses:0,lastIncome:0,lastExpenses:0};this.protected=false;
  this.seed=saved?.seed||options.seed||0;this.availableRaces=[...FACTIONS[factionOf(this.race)].members];this.guards=[];this.attackers=[];this.wardUntil=0;this.rails=new Set();this.healthUntil=0;this.outageUntil=0;this.strikeUntil=0;this.sanctionUntil=0;this.batteryCharge=0;this.region=REGIONS[region]?region:'river';this.time=0;this.money=1100;this.debt=1000;this.family=false;this.expansions=0;
  this.stock={wood:50,stone:30,water:16,grain:8,plank:0,flour:0,bread:0,fish:0,gear:0};
  for(const r of Object.keys(RESOURCES))this.stock[r]??=0;this.buildings=[];this.roads=new Set();this.owned=new Set();this.workers=[];this.nextId=1;this.nextWorkerId=0;this.revision=0;
  this.events=[];this.notices=[];this.sold={};this.produced={};this.nextEvent=170;this.pendingEvent=null;this.diseaseUntil=0;
  this.autoSell={bread:true,fish:true,gear:false};this.salesTimer=0;this.totalRevenue=0;this.paused=false;this.speed=1;this.emergencyUsed=false;
  this.seedMap();if(saved)this.restore(saved);else for(let x=8;x<16;x++)for(let z=8;z<16;z++)this.owned.add(K(x,z));
 }
 seedMap(){
  this.tiles=[];
  for(let z=0;z<N;z++)for(let x=0;x<N;x++){
   let terrain='grass',river=18+Math.floor(Math.sin(z*.35)*1.3);
   if(this.region==='river'&&x>=river&&x<river+2)terrain='water';
   if(this.region==='coast'&&(x>=18||z<3))terrain='water';
   if(this.region==='highland'&&x===19&&z>3&&z<21)terrain='water';
   if((x===3||x===4)&&(z===5||z===6))terrain='water';
   let nature=null;if(terrain==='grass'&&noise(x,z)>.72)nature=noise(z,x)>.3?'tree':'rock';
   if(x>=9&&x<=14&&z>=10&&z<=15)nature=null;
   if((x===8&&z===8)||(x===8&&z===9)||(x===9&&z===8))nature='tree';
   if((x===15&&z===8)||(x===15&&z===9)||(x===14&&z===8))nature='rock';
   const fertility=Math.round(35+noise(x+17+this.seed,z+4)*65), moisture=Math.round(30+noise(x+8,z+22+this.seed)*70), ore=Math.round(30+noise(x+31+this.seed,z+7)*70);
   this.tiles.push({x,z,terrain,nature,remaining:nature?90:0,fertility,moisture,ore,mana:Math.round(25+noise(x+43+this.seed,z+51)*75)});
  }
 }
 tile(x,z){return x>=0&&z>=0&&x<N&&z<N?this.tiles[z*N+x]:null;}
 ownedAt(x,z){return this.owned.has(K(x,z));}
 at(x,z){if(this.occupancyRevision!==this.revision){this.occupancyRevision=this.revision;this.occupancy=new Map();for(const b of this.buildings)this.occupancy.set(K(b.x,b.z),b);}return this.occupancy.get(K(x,z));}
 get warehouse(){return this.buildings.find(b=>b.type==='warehouse');}
 get power(){if(this.outageUntil>this.time)return this.batteryCharge>0&&this.buildings.some(b=>b.type==='battery'&&b.health>0&&b.enabled!==false);return this.buildings.some(b=>['generator','arcanepower','windturbine'].includes(b.type)&&b.activeUntil>this.time&&b.health>0&&b.enabled!==false);}
 get medicalProtection(){return this.healthUntil>this.time||(this.stage<15&&this.buildings.some(b=>b.type==='clinic'&&b.health>0&&b.enabled!==false));}
 get horse(){return this.buildings.some(b=>b.type==='stable'&&b.activeUntil>this.time&&b.health>0&&b.enabled!==false);}
 get automatic(){return this.power&&this.buildings.some(b=>b.type==='logistics'&&b.health>0&&b.enabled!==false);}
 get workerCount(){return this.buildings.reduce((n,b)=>n+homeCapacity(b),0);}
 residentOf(type){const d=BUILDINGS[type];return d?.home?d.resident||this.availableRaces[0]:null;}
 get stage(){return this.rank-PROGRESSION_OFFSET;}
 get day(){return Math.floor(this.time/80)+1;}
 get tax(){const site=this.campaign?.sites.find(v=>v.id===this.siteId);if(this.stage>=22&&(!site||site.territory||site.id===this.campaign?.homeId))return 0;if(this.stage>=20&&site?.territory)return 2;return Math.max(0,NATIONS[this.nation].tax+(this.charter==='industry'?4:this.charter==='commons'?-3:0)-(this.rank>=1?2:0));}
 get wage(){return 5+this.buildings.length+this.buildings.filter(b=>b.specialized).length*2+this.tax+(this.campaign&&this.campaign.homeId!==this.siteId?0:this.debt>0?Math.ceil(this.debt*(this.family?.008:.01)):0);}
 notify(text,type='info'){this.notices.push({id:(this.noticeSeq=(this.noticeSeq||0)+1),text,type});if(this.notices.length>5)this.notices.shift();}
 closestNatural(b,type){const size=b.size||1,dist=t=>Math.max(b.x-t.x,0,t.x-(b.x+size-1))+Math.max(b.z-t.z,0,t.z-(b.z+size-1));return this.tiles.filter(t=>t.nature===type&&t.remaining>0&&this.ownedAt(t.x,t.z)&&dist(t)>0&&dist(t)<=4).sort((a,c)=>dist(a)-dist(c))[0];}
 nearWater(x,z,size=1){return this.tiles.some(t=>t.terrain==='water'&&t.x>=x-3&&t.x<=x+size+2&&t.z>=z-3&&t.z<=z+size+2);}
 canBuild(type,x,z,free=false){
  const d=BUILDINGS[type];if(!d||!Number.isInteger(x)||!Number.isInteger(z))return '건설 위치를 선택하세요';
  if(d.unique&&this.buildings.some(b=>b.type===type))return '한 곳만 건설할 수 있습니다';
  if(d.resident&&!this.availableRaces.includes(d.resident))return '이 진영에는 '+RACES[d.resident].name+' 주민이 없습니다';
  if(!free&&this.rank<unlockRank(type))return RANKS[unlockRank(type)].name+' 승급이 필요합니다';
  if(type==='dock'&&!this.nearWater(x,z,d.size))return '강이나 바다에서 세 칸 이내에 놓으세요';
  for(let a=x;a<x+d.size;a++)for(let c=z;c<z+d.size;c++){
   const t=this.tile(a,c);if(!t||!this.ownedAt(a,c))return '먼저 이 구역을 확보하세요';
   if(t.terrain==='water')return '물 위에는 건설할 수 없습니다';
   if(this.at(a,c))return '다른 건물이 있는 자리입니다';if(type==='rail'&&this.rails.has(K(a,c)))return '이미 선로가 있는 자리입니다';
   if(this.roads.has(K(a,c))&&type!=='rail')return '흙길을 먼저 철거하세요';
  }
  if(d.natural&&!this.closestNatural({x,z},d.natural))return d.natural==='tree'?'네 칸 이내에 나무가 필요합니다':'네 칸 이내에 바위가 필요합니다';
  if(!free){if(this.money<this.buildCost(type))return '자금이 부족합니다';for(const[r,v]of Object.entries(d.materials||{}))if(this.availableStock(r)<v)return RESOURCES[r].name+' '+v+'개가 필요합니다';}
  return null;
 }
 build(type,x,z,free=false){
  const error=this.canBuild(type,x,z,free);if(error)return {ok:false,error};const d=BUILDINGS[type];
  if(!free){this.money-=this.buildCost(type);for(const[r,v]of Object.entries(d.materials||{}))this.stock[r]-=v;}
  for(let a=x;a<x+d.size;a++)for(let c=z;c<z+d.size;c++){const t=this.tile(a,c);if(t.nature){if(t.nature==='tree'||t.nature==='rock')this.stock[t.nature==='tree'?'wood':'stone']+=2;t.nature=null;t.remaining=0;delete t.growAt;}}
  if(type==='road'||type==='rail'){this.roads.add(K(x,z));if(type==='rail')this.rails.add(K(x,z));this.revision++;return {ok:true};}
  const b={enabled:true,priority:1,id:this.nextId++,type,x,z,size:d.size,inputs:{},out:0,progress:0,working:false,health:100,level:1,status:'준비 중',activeUntil:0,age:0,animationTime:0,race:this.residentOf(type)||this.availableRaces[(this.nextId-2)%this.availableRaces.length],specialized:false,cycles:0};
  this.sound('build',x,z);this.buildings.push(b);this.revision++;this.syncWorkers();return {ok:true,id:b.id};
 }
 walkable(x,z){const t=this.tile(x,z);return t&&this.ownedAt(x,z)&&t.terrain!=='water'&&!this.at(x,z);}
 entries(b){const p=[];for(let i=0;i<b.size;i++)p.push({x:b.x+i,z:b.z+b.size},{x:b.x+b.size,z:b.z+i},{x:b.x-1,z:b.z+i},{x:b.x+i,z:b.z-1});return p.filter(p=>this.walkable(p.x,p.z));}
 path(start,end){
  if(!start||!end||!this.walkable(end.x,end.z))return null;
  const sx=Math.round(start.x),sz=Math.round(start.z),sk=K(sx,sz),goal=K(end.x,end.z);if(sk===goal)return [];if(this.routeRevision!==this.revision){this.routeRevision=this.revision;this.routeCache=new Map();}const cacheKey=sk+'>'+goal;if(this.routeCache.has(cacheKey)){const cached=this.routeCache.get(cacheKey);return cached?cached.map(p=>({...p})):null;}
  const open=[{x:sx,z:sz,c:0}],cost=new Map([[sk,0]]),prev=new Map();let found=false;
  while(open.length){
   open.sort((a,b)=>a.c-b.c);const p=open.shift(),pk=K(p.x,p.z);if(pk===goal){found=true;break;}
   for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,z=p.z+dz,key=K(x,z);if(!this.walkable(x,z))continue;const c=p.c+(this.roads.has(key)?.65:1.05);if(c<(cost.get(key)??Infinity)){cost.set(key,c);prev.set(key,pk);open.push({x,z,c});}}
  }
  if(!found){this.routeCache.set(cacheKey,null);return null;}const result=[];let key=goal;while(key!==sk){const[x,z]=key.split(',').map(Number);result.unshift({x,z});key=prev.get(key);if(!key)return null;}this.routeCache.set(cacheKey,result);return result.map(p=>({...p}));
 }
 routeTo(start,b){for(const e of this.entries(b).sort((a,c)=>Math.abs(a.x-start.x)+Math.abs(a.z-start.z)-Math.abs(c.x-start.x)-Math.abs(c.z-start.z))){const p=this.path(start,e);if(p)return {path:p,end:e};}return null;}
 syncWorkers(){
  // Residents live in houses: each house keeps its own race at its own door. Warehouses hold goods, not people.
  const homes=new Map(),count=new Map();for(const b of this.buildings)if(BUILDINGS[b.type].home)homes.set(b.id,b);
  const stays=w=>{const h=homes.get(w.homeId),n=count.get(w.homeId)||0;if(!h||crewOf(w.race)!==this.residentOf(h.type)||n>=homeCapacity(h))return false;count.set(w.homeId,n+1);return true;};
  if(!this.workers.every(stays)){count.clear();this.workers=this.workers.filter(w=>stays(w)||(this.refundTask(w),false));}
  for(const h of homes.values()){const race=this.residentOf(h.type);
   for(let n=count.get(h.id)||0;n<homeCapacity(h);n++){const doors=this.entries(h),spawn=doors[n%Math.max(1,doors.length)]||{x:h.x,z:h.z},kin=this.availableRaces.filter(r=>crewOf(r)===race),pick=kin[this.workers.filter(w=>crewOf(w.race)===race).length%kin.length]||race,ordinal=this.workers.filter(w=>w.race===pick).length;this.workers.push(assignResidentAppearance({id:this.nextWorkerId++,homeId:h.id,race:pick,x:spawn.x,z:spawn.z,route:[],task:null,phase:'idle',walking:false,dir:0},this.availableRaces,ordinal));}}
 }
 refundTask(w){cancelTask(this,w);}
 jobFor(w){assignJob(this,w);}
 tickWorkers(dt){moveWorkers(this,dt);}
 availableStock(item){return available(this,item);}
 marketFactor(item){return marketFactor(this,item);}
 saleQuote(item,amount=1){return saleQuote(this,item,amount);}
 sanitize(){return sanitation(this);}
 rescueInfo(){return rescueInfo(this);}
 tick(dt){
  if(this.paused||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.25)*this.speed;const lastDay=this.day;this.time+=dt;tickChallenges(this,dt);tickEconomy(this,dt);tickRescue(this,dt);
  if(this.day!==lastDay){this.budget.lastIncome=this.budget.income;this.budget.lastExpenses=this.budget.expenses;this.budget.income=0;this.budget.expenses=this.wage;this.budget.day=this.day;for(const t of this.tiles)if(t.nature==='sapling'&&t.growAt<=this.time){t.nature='tree';t.remaining=90;delete t.growAt;this.revision++;}this.money-=this.wage;this.notify(this.day+'일째 · 유지비·세금 '+this.wage+'G 지출');}
  if(this.outageUntil>this.time)this.batteryCharge=Math.max(0,this.batteryCharge-dt);else if(this.power&&this.buildings.some(b=>b.type==='battery'&&b.health>0&&b.enabled!==false))this.batteryCharge=Math.min(90,this.batteryCharge+dt*2);tickRaid(this,dt);this.syncWorkers();this.tickWorkers(dt);if(this.pathRevision!==this.revision){this.pathRevision=this.revision;this.reachable=new Set();const q=this.warehouse?this.entries(this.warehouse):[];q.forEach(p=>this.reachable.add(K(p.x,p.z)));for(let i=0;i<q.length;i++){const p=q[i];for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,z=p.z+dz,k=K(x,z);if(!this.reachable.has(k)&&this.walkable(x,z)){this.reachable.add(k);q.push({x,z});}}}}
  for(const b of this.buildings){
   const d=BUILDINGS[b.type];b.age+=dt;b.animationTime=(b.animationTime||0)+(b.working?dt:0);b.working=false;
   if(b.health<=0){b.status='수리 필요';continue;}if(b.enabled===false){b.status='가동 중지';continue;}
   if(!this.warehouse&&b.type!=='warehouse'){b.status='창고 필요';continue;}
   if(d.road&&!this.placementEffects(b.type,b.x,b.z).road){b.status='도로 연결 필요';continue;}
   if(d.power&&!this.power){b.status='전력 부족';continue;}
   if(!d.period){b.status=b.type==='logistics'?'자동 분류 중':b.type==='warehouse'?'운반 중':'정상 운영';b.working=b.type==='logistics'&&this.workers.some(w=>w.task);continue;}
   if(!this.entries(b).length){b.status='출입구 막힘';continue;}if(!this.entries(b).some(p=>this.reachable.has(K(p.x,p.z)))){b.status='창고 경로 막힘';continue;}
   const crew=crewFor(this,b.type);if(crew&&!this.workers.some(w=>crewOf(w.race)===crew)){b.status=RACES[crew].name+' 주민 필요';continue;}
   if(b.out>=10){b.status=this.stock[d.output]>=this.storageCapacity?'창고 가득 참':'운반 대기';continue;}
   if((['horse','power','health','ward','transit','irrigation'].includes(d.output))&&b.activeUntil-this.time>12){b.status=({horse:'운반 지원 중',power:'전력 공급 중',health:'의료 지원 중',ward:'결계 유지 중',transit:'운송 가속 중',irrigation:'관개 공급 중'})[d.output];b.working=true;continue;}
   const missing=Object.entries(this.effectiveInputs(b)).find(([r,n])=>(b.inputs[r]||0)<n);
   if(b.progress===0&&missing){b.status=RESOURCES[missing[0]].name+' 대기';continue;}
   if(d.natural&&!this.closestNatural(b,d.natural)){b.status='자원 고갈';continue;}
   if(b.progress===0)for(const[r,n]of Object.entries(this.effectiveInputs(b)))b.inputs[r]-=n;
   let mult=1+(b.level-1)*.3;
   mult*=1-this.health.infection*.0025;if(this.charter==='industry'&&['craft','industry','advanced'].includes(d.group))mult*=1.08;mult*=this.tileMultiplier(b.type,b.x,b.z)*this.countryMultiplier(b.type)*this.specialtyMultiplier(b)*this.placementEffects(b.type,b.x,b.z).speed;
   b.progress+=dt*mult/d.period;b.working=true;b.status='생산 중';
   if(b.progress>=1){
    b.progress=0;b.cycles=(b.cycles||0)+1;if(b.specialized&&b.race==='elf'&&b.cycles%4===0&&d.inputs){const key=Object.keys(d.inputs)[0];b.inputs[key]=(b.inputs[key]||0)+1;}this.sound(b.type,b.x,b.z);if(d.output==='horse')b.activeUntil=this.time+65;else if(d.output==='power')b.activeUntil=this.time+60;else if(d.output==='ward'){b.activeUntil=this.time+65;this.wardUntil=this.time+65;}else if(d.output==='irrigation'){b.activeUntil=this.time+60;}else if(d.output==='transit'){b.activeUntil=this.time+65;}else if(d.output==='health'){b.activeUntil=this.time+65;this.healthUntil=this.time+65;}
    else{b.out+=d.amount;this.produced[d.output]=(this.produced[d.output]||0)+d.amount;}
    if(d.natural){const t=this.closestNatural(b,d.natural);if(t){t.remaining-=d.amount;if(t.remaining<=0){t.nature=null;this.revision++;}}}
   }
  }
  this.salesTimer+=dt;if(this.salesTimer>=8){this.salesTimer=0;for(const[r,on]of Object.entries(this.autoSell))if(on){const reserve=this.minimumStock(r);const n=Math.floor(this.stock[r])-reserve;if(n>=10)this.sell(r,10,true);}}
  if(this.pendingEvent&&this.time>=this.pendingEvent.at)this.resolveEvent();
  if(!this.pendingEvent&&this.time>=this.nextEvent){this.pendingEvent={type:this.chooseEvent(),at:this.time+20};this.notify(this.eventName(this.pendingEvent.type)+' 예고 · 20초 뒤 발생합니다.','warning');}
 }
 chooseEvent(){
  const pressure=this.campaign?.sites.find(v=>v.id===this.siteId)?.unrest||15;
  const weights=[['storm',this.region==='coast'?4:2],['illness',this.health.infection>35?.6:2]];
  if(this.stage>=8)weights.push(['strike',pressure>50?4:1],['raid',1+Math.min(2,this.totalRevenue/20000)]);
  if(this.stage>=15)weights.push(['manaStorm',this.buildings.filter(b=>BUILDINGS[b.type].power).length/4+1],['sanction',this.stage>=20?3:1]);
  let roll=noise(this.seed+this.eventCount*37,this.day+this.buildings.length)*weights.reduce((n,p)=>n+p[1],0);
  for(const [type,weight]of weights){roll-=weight;if(roll<=0)return type;}return 'storm';
 }
 resolveEvent(){
  const e=this.pendingEvent;if(!e)return;this.pendingEvent=null;this.nextEvent=this.time+Math.max(110,180-Math.max(0,this.stage)*2)+Math.floor(noise(this.eventCount,this.seed+this.day)*30);
  this.sound(e.type);if(e.type==='storm'&&this.protected){this.protected=false;this.notify('보강한 시설이 폭풍을 버텼습니다.','success');}
  else if(e.type==='storm'){
   const list=this.buildings.filter(b=>!['warehouse','clinic'].includes(b.type)&&!BUILDINGS[b.type].home&&b.health>0);
   const b=list.find(b=>this.nearWater(b.x,b.z,b.size))||list[0];
   if(b){if(b.specialized&&b.race==='dwarf'&&!b.armorUsed){b.armorUsed=true;this.notify('내구 설계가 '+BUILDINGS[b.type].name+'의 피해를 막았습니다.','success');}else b.health=0;b.status=b.health>0?'정상 운영':'수리 필요';this.notify('비바람 피해 · '+BUILDINGS[b.type].name+' 정지. 50G로 수리하세요.','warning');}else this.notify('비바람이 지나갔습니다. 시설 피해가 없습니다.');
  }else if(e.type==='strike'){this.strikeUntil=this.time+(this.campaign?.support>=70?15:55);this.notify('파업 발생 · 복지 협약으로 조기 해소할 수 있습니다.','warning');}
  else if(e.type==='manaStorm'){this.outageUntil=this.time+45;this.notify('마력 폭풍 · 45초 정전. 축전 시설이 있으면 저장 전력을 사용합니다.','warning');}
  else if(e.type==='sanction'){this.sanctionUntil=this.time+100;this.notify('무역 압박 · 100초 동안 판매 수익 25% 감소','warning');}
  else if(e.type==='raid'){startRaid(this);}
  else{this.health.infection=Math.min(100,this.health.infection+32);this.health.nextCare=this.time;this.diseaseUntil=this.time+80;this.notify(this.stage>=15?'마력성 감염 확산 · 의약품을 병원에 공급하세요.':'감염 발생 · 방역으로 확산을 낮추고 진료소를 운영하세요.','warning');}
  this.eventCount++;this.events.push({type:e.type,time:this.time});this.events=this.events.slice(-120);this.revision++;
 }
 sell(item,amount,auto=false){
  if(!RESOURCES[item]||!Number.isInteger(amount)||amount<=0)return {ok:false,error:'판매 수량을 확인하세요'};
  amount=Math.min(amount,Math.floor(this.availableStock(item)));if(amount<=0)return {ok:false,error:'판매할 재고가 없습니다'};
  const revenue=this.saleQuote(item,amount);this.market.pressure[item]=Math.min(100,(this.market.pressure[item]||0)+amount);this.stock[item]-=amount;this.money+=revenue;this.budget.income+=revenue;this.totalRevenue+=revenue;this.sold[item]=(this.sold[item]||0)+amount;
  this.sound('sell');if(!auto)this.notify(RESOURCES[item].name+' '+amount+'개 판매 · +'+revenue+'G','success');return {ok:true,amount,revenue};
 }
 expansionCost(){return Math.round((180+this.expansions*90)*(this.rank>=3?.9:1));}
 canExpand(cx,cz){if(!Number.isInteger(cx)||!Number.isInteger(cz)||cx<0||cz<0||cx>=6||cz>=6||this.ownedAt(cx*4,cz*4))return false;return [[-1,0],[1,0],[0,-1],[0,1]].some(([a,b])=>this.ownedAt((cx+a)*4,(cz+b)*4));}
 expand(cx,cz){
  if(!this.canExpand(cx,cz))return {ok:false,error:'현재 영토와 맞닿은 구역을 선택하세요'};const cost=this.expansionCost();if(this.money<cost)return {ok:false,error:'확장 자금이 부족합니다'};
  this.money-=cost;for(let x=cx*4;x<cx*4+4;x++)for(let z=cz*4;z<cz*4+4;z++)this.owned.add(K(x,z));this.expansions++;this.revision++;this.notify('새로운 땅 16칸을 확보했습니다.','success');return {ok:true};
 }
 repairCost(b){return Math.max(5,Math.ceil((100-b.health)/100*(b.specialized&&b.race==='dwarf'?25:50)));}
 repair(id){const b=this.buildings.find(b=>b.id===id);if(!b||b.health>=100)return {ok:false,error:'수리할 시설이 없습니다'};const cost=this.repairCost(b);if(this.money<cost)return {ok:false,error:'수리비 '+cost+'G가 필요합니다'};this.money-=cost;b.health=100;b.armorUsed=false;this.revision++;return {ok:true};}
 upgrade(id){const b=this.buildings.find(b=>b.id===id),d=b&&BUILDINGS[b.type];if(!b||!(d.period||d.home)||b.level>=3)return {ok:false,error:'더 이상 개선할 수 없습니다'};const cost=this.upgradeCost(b),item=this.upgradeItem(b);if(this.money<cost||this.stock[item]<3)return {ok:false,error:cost+'G와 '+RESOURCES[item].name+' 3개가 필요합니다'};this.money-=cost;this.stock[item]-=3;b.level++;this.syncWorkers();this.revision++;return {ok:true};}
 upgradeItem(b){return BUILDINGS[b.type].home?'wood':'plank';}
 demolish(x,z){
  if(this.roads.delete(K(x,z))){this.rails.delete(K(x,z));this.money+=2;this.revision++;return {ok:true};}const b=this.at(x,z);if(!b)return {ok:false,error:'철거할 시설이 없습니다'};
  if(b.type==='warehouse')return {ok:false,error:'창고는 마을의 중심이라 철거할 수 없습니다'};
  for(const g of this.guards)if(g.homeId===b.id){g.homeId=this.warehouse.id;g.route=[];}
  for(const w of this.workers)if(w.task?.building===b.id||w.task?.sourceId===b.id||w.task?.targetId===b.id)this.refundTask(w);for(const[r,n]of Object.entries(b.inputs))this.stock[r]+=n;
  if(RESOURCES[BUILDINGS[b.type].output])this.stock[BUILDINGS[b.type].output]+=b.out;this.money+=Math.floor(BUILDINGS[b.type].cost*(b.specialized&&b.race==='goblin'?.65:.4));this.buildings=this.buildings.filter(a=>a.id!==b.id);this.syncWorkers();this.revision++;return {ok:true};
 }
 repay(){const n=Math.min(this.debt,200);if(n<=0)return {ok:false,error:'빚을 모두 갚았습니다'};if(this.money<n)return {ok:false,error:n+'G가 필요합니다'};this.money-=n;this.debt-=n;this.notify(this.debt===0?'빚을 모두 상환했습니다!':'채무 '+n+'G 상환','success');return {ok:true};}
 rescue(choice){return advanceRescue(this,choice);}
 emergency(){if(this.emergencyUsed)return {ok:false,error:'긴급 대출은 한 번만 가능합니다'};this.emergencyUsed=true;this.money+=300;this.debt+=420;return {ok:true};}
 sound(type,x=12,z=12){this.soundEvents.push({type,x,z});if(this.soundEvents.length>30)this.soundEvents.shift();}
 buildCost(type){return Math.round(BUILDINGS[type].cost*(NATIONS[this.nation].build||1));}
 get storageCapacity(){return 240+(this.rank>=1?30:0)+this.buildings.filter(b=>b.type==='depot'&&b.health>0).length*120;}
 placementEffects(type,x,z){return placementEffects(this,type,x,z);}
 effectiveInputs(b){const inputs={...(BUILDINGS[b.type].inputs||{})};if(b.type==='field'&&this.placementEffects(b.type,b.x,b.z).water)delete inputs.water;return inputs;}
 tileMultiplier(type,x,z){const t=this.tile(x,z);if(!t)return 1;const v=type==='field'?t.fertility:type==='well'?t.moisture:['quarry','ironmine','coalpit','oilpump'].includes(type)?t.ore:type==='manaextractor'?t.mana:null;return v===null?1:.7+v*.008;}
 upgradeCost(b){return Math.round(b.level*(BUILDINGS[b.type].home?60:90)*(b.specialized&&b.race==='human'?.8:1));}
 eventName(type){return ({storm:'폭풍',illness:this.stage>=15?'마력성 감염병':'감염병',strike:'파업',raid:'외부 습격',manaStorm:'마력 폭풍',sanction:'무역 압박'})[type]||type;}
 specialtyMultiplier(b){if(!b.specialized)return 1;const d=BUILDINGS[b.type];if(['demon','spirit'].includes(b.race)&&(d.power||['power','mana','ward'].includes(d.output)))return 1.12;if(['orc','titan'].includes(b.race)&&d.amount>=3)return 1.12;if(['beast','centaur'].includes(b.race))return 1.05;if(b.race==='goblin')return 1.07;if(b.race==='dragon'&&['smelter','refinery','generator','arcanepower','chemical'].includes(b.type))return 1.15;if(b.race==='aquatic'&&(d.inputs?.water||['well','dock'].includes(b.type)))return 1.12;if(b.race==='fae'&&d.amount<=2)return 1.12;return 1;}
 specialize(id,race){const b=this.buildings.find(v=>v.id===id);if(!b||!this.availableRaces.includes(race))return {ok:false,error:'현재 진영에서 이용할 수 없는 특화입니다'};if(this.money<100||this.stock.plank<2)return {ok:false,error:'특화 작업조: 100G + 판재 2개'};this.money-=100;this.stock.plank-=2;b.race=race;b.specialized=true;b.armorUsed=false;this.revision++;this.sound('promotion');return {ok:true};}
 countryMultiplier(type){return NATIONS[this.nation].production[type]||1;}
 rankValue(key){if(this.campaign&&['sites','deliveries','railRoutes','defense','investment','support','recognition','territories'].includes(key))return this.campaign.metric(key);const [kind,item]=key.split(':');if(kind==='building')return this.buildings.filter(b=>b.type===item&&b.health>0).length;if(kind==='produced')return this.produced[item]||0;if(kind==='sold')return this.sold[item]||0;return {contracts:this.contracts,revenue:this.totalRevenue,expansions:this.expansions,power:+this.power,automatic:+this.automatic,family:+this.family,debtFree:+(this.debt===0),workers:this.workerCount}[key]||0;}
 chooseCharter(id){return chooseCharter(this,id);}
 promotion(){const next=RANKS[this.rank+1];if(!next)return null;const requirements=next.requirements.map(([key,target,name])=>({key,target,name,current:this.rankValue(key),done:this.rankValue(key)>=target}));const trial=nextTrial(this);return {...next,trial,requirements,ready:requirements.every(r=>r.done)&&(!trial||trial.done)&&this.money>=next.fee};}
 promote(){const n=this.promotion();if(!n||!n.ready)return {ok:false,error:'승급 조건과 수수료를 확인하세요'};this.money-=n.fee;this.rank++;this.challenge={};this.campaign?.onPromotion();this.revision++;this.sound('promotion');this.notify(n.name+' 승급','success');return {ok:true};}
 contract(){const pool=this.stage>=15?['car','medicine','circuit']:this.stage>=12?['steel','fuel','circuit']:this.stage>=10?['steel','gear','bread']:this.stage<3?['grain','wood']:this.stage<5?['plank','flour']:this.stage<8?['bread','plank']:['gear','bread'];const item=pool[this.contracts%pool.length];const amount=item==='car'?2:['gear','circuit','medicine'].includes(item)?6:12+Math.min(this.contracts*2,16);return {item,amount,reward:Math.round(amount*RESOURCES[item].price*(this.rank>=2?1.45:1.35))};}
 fulfill(){const c=this.contract();if(this.availableStock(c.item)<c.amount)return {ok:false,error:'창고 재고가 부족합니다'};this.stock[c.item]-=c.amount;this.sold[c.item]=(this.sold[c.item]||0)+c.amount;this.money+=c.reward;this.budget.income+=c.reward;this.totalRevenue+=c.reward;this.contracts++;this.sound('sell');return {ok:true};}
 reinforce(){if(!this.pendingEvent||this.pendingEvent.type!=='storm'||this.protected)return {ok:false,error:'현재 보강할 필요가 없습니다'};if(this.money<70||this.stock.wood<4)return {ok:false,error:'70G와 목재 4개가 필요합니다'};this.money-=70;this.stock.wood-=4;this.protected=true;this.sound('build');return {ok:true};}
 objectives(){return [
  {id:'store',name:'첫 거점',detail:'창고와 주민 주택을 지어 운반할 주민을 맞이하세요.',done:!!this.warehouse&&this.workerCount>0},
  {id:'food',name:'물을 먹고 자라는 밀',detail:'우물과 밀밭을 연결해 밀 8개를 생산하세요.',done:(this.produced.grain||0)>=8},
  {id:'bread',name:'원료에서 제품으로',detail:'제분소와 빵집을 운영해 빵 10개를 판매하세요.',done:(this.sold.bread||0)>=10},
  {id:'land',name:'경계 너머의 자원',detail:'인접 구역 한 곳을 확보하세요.',done:this.expansions>0},
  {id:'debt',name:'자기 이름으로',detail:'몸값 채무를 모두 상환하세요.',done:this.debt===0},
  {id:'family',name:'집으로 오는 길',detail:this.rescueInfo().text,done:this.family},
  {id:'industry',name:'기계가 움직이는 마을',detail:'발전소와 기계 공장에서 부품 4개를 생산하세요.',done:(this.produced.gear||0)>=4},
  {id:'logistics',name:'더 큰 산업의 시작',detail:'자동 물류센터에 전력을 공급하세요.',done:this.automatic}
 ];}
 minimumStock(item){return reserveFor(this,item);}
 buy(item,quantity){return purchase(this,item,quantity);}
 plant(x,z){return plant(this,x,z);}
 recover(){return restructure(this);}
 mobilize(){return mobilize(this);}
 setOperation(id,enabled,priority){const b=this.buildings.find(b=>b.id===id);if(!b)return {ok:false,error:'시설을 찾을 수 없습니다'};if(enabled!==undefined)b.enabled=!!enabled;if(priority!==undefined)b.priority=Math.max(0,Math.min(2,Number(priority)||0));if(b.enabled===false)for(const w of this.workers)if(w.task?.building===id&&w.task.kind==='supply')this.refundTask(w);return {ok:true};}
 settleHouseLevels(){
  // v7 houses held 2-3 people at level 1. A house now holds one person per level, so raise the level to keep everyone home.
  for(const b of this.buildings)if(BUILDINGS[b.type].home)b.level=Math.min(3,Math.max(b.level||1,this.workers.filter(w=>w.homeId===b.id).length));
 }
 moveResidentsIntoHouses(){
  // Before v7 the warehouse produced residents. Keep the same workforce by giving it free basic houses beside the warehouse.
  for(const b of this.buildings)if(BUILDINGS[b.type].home)b.race=this.residentOf(b.type);
  const before=this.workers.length;for(const w of this.workers)this.refundTask(w);
  const origin=this.warehouse||this.buildings[0];let missing=Math.ceil(Math.max(0,before-this.workerCount)/3);
  if(origin&&missing>0)for(const t of this.tiles.filter(t=>this.walkable(t.x,t.z)&&!this.roads.has(K(t.x,t.z))&&!t.nature).sort((a,c)=>Math.abs(a.x-origin.x)+Math.abs(a.z-origin.z)-Math.abs(c.x-origin.x)-Math.abs(c.z-origin.z))){if(missing<=0)break;if(this.build('house',t.x,t.z,true).ok){this.at(t.x,t.z).level=3;missing--;}}
  this.workers=this.workers.filter(w=>{const h=this.buildings.find(b=>b.id===w.homeId);return h&&w.race===this.residentOf(h.type);});
  if(before)this.notify('주민이 이제 주택에서 나옵니다. 기존 주민을 위해 주민 주택을 지어 두었습니다.','success');
 }
 save(){return {version:8,nextWorkerId:this.nextWorkerId,charter:this.charter,market:structuredClone(this.market),health:structuredClone(this.health),rescueQuest:structuredClone(this.rescueQuest),logisticsStats:structuredClone(this.logisticsStats),challenge:structuredClone(this.challenge),guards:structuredClone(this.guards),raid:this.raid,raidCount:this.raidCount,eventCount:this.eventCount,lastRecoveryDay:this.lastRecoveryDay,reserves:this.reserves,budget:this.budget,attackers:this.attackers,wardUntil:this.wardUntil,seed:this.seed,availableRaces:this.availableRaces,rails:[...this.rails],healthUntil:this.healthUntil,outageUntil:this.outageUntil,strikeUntil:this.strikeUntil,sanctionUntil:this.sanctionUntil,batteryCharge:this.batteryCharge,nation:this.nation,race:this.race,rank:this.rank,contracts:this.contracts,protected:this.protected,region:this.region,time:this.time,money:this.money,debt:this.debt,family:this.family,expansions:this.expansions,stock:{...this.stock},buildings:structuredClone(this.buildings),roads:[...this.roads],owned:[...this.owned],workers:structuredClone(this.workers),nextId:this.nextId,sold:{...this.sold},produced:{...this.produced},nextEvent:this.nextEvent,pendingEvent:this.pendingEvent,diseaseUntil:this.diseaseUntil,events:this.events,autoSell:this.autoSell,totalRevenue:this.totalRevenue,emergencyUsed:this.emergencyUsed,tiles:this.tiles.map(t=>({nature:t.nature,remaining:t.remaining,...(t.growAt?{growAt:t.growAt}:{})}))};}
 restore(s){
  if(![1,2,3,4,5,6,7,8].includes(s.version)||!Array.isArray(s.buildings)||!Array.isArray(s.owned)||!s.stock)throw new Error('저장 형식이 맞지 않습니다');
  for(const key of ['charter','market','health','rescueQuest','logisticsStats','challenge','guards','raid','raidCount','eventCount','lastRecoveryDay','reserves','budget','attackers','wardUntil','availableRaces','healthUntil','outageUntil','strikeUntil','sanctionUntil','batteryCharge','nation','race','rank','contracts','protected','time','money','debt','family','expansions','stock','buildings','workers','nextId','nextWorkerId','sold','produced','nextEvent','pendingEvent','diseaseUntil','events','autoSell','totalRevenue','emergencyUsed'])if(s[key]!==undefined)this[key]=structuredClone(s[key]);
  if(s.version===1)this.rank=Math.max(PROGRESSION_OFFSET,...this.buildings.map(b=>unlockRank(b.type)));else if(s.version<4)this.rank+=PROGRESSION_OFFSET;if(!playableRace(this.race)){this.race='human';this.nation='estern';}this.availableRaces=[...FACTIONS[factionOf(this.race)].members];this.buildings.forEach(b=>{if(!playableRace(b.race))b.race=this.race;b.race=b.race||this.race;b.size=1;});for(const r of Object.keys(RESOURCES))this.stock[r]??=0;this.rails=new Set(s.rails||[]);if(!this.availableRaces.includes(this.race))this.availableRaces.unshift(this.race);
  for(const w of this.workers)if(!playableRace(w.race)){w.race=this.availableRaces[w.id%this.availableRaces.length];w.name=RESIDENT_NAMES[w.race][w.id%4];}for(const w of this.workers)assignResidentAppearance(w,this.availableRaces);if(s.version<6){for(const w of this.workers){if(w.task){const t=w.task,b=this.buildings.find(b=>b.id===t.building);if(t.kind==='pickup'&&w.phase==='source'&&b)b.out+=t.amount;else this.stock[t.item]=(this.stock[t.item]||0)+t.amount;w.task=null;w.route=[];w.phase='idle';}}if(this.diseaseUntil>this.time)this.health.infection=25;this.rescueQuest.step=this.family?5:0;}
  if(s.version<5)this.eventCount=this.events.length;this.owned=new Set(s.owned);this.roads=new Set(s.roads);if(s.tiles?.length===N*N)s.tiles.forEach((t,i)=>Object.assign(this.tiles[i],t));this.nextWorkerId??=Math.max(-1,...this.workers.map(w=>w.id))+1;
  if(s.version<7)this.moveResidentsIntoHouses();else if(s.version<8)this.settleHouseLevels();this.revision++;
 }
}
/** A free-build tour. Production, transport and costs still use the real simulation. */
export function createShowcase(nation='estern',race=null){
 const s=new Simulation(NATIONS[nation].region,null,{nation,race:race||NATIONS[nation].race});s.rank=22;s.money=18000;s.debt=0;s.family=true;
 for(const r of Object.keys(RESOURCES))s.stock[r]=['car','medicine'].includes(r)?12:100;
 for(let x=4;x<20;x++)for(let z=4;z<20;z++)s.owned.add(K(x,z));
 const homes=Object.keys(BUILDINGS).filter(t=>BUILDINGS[t].home&&s.residentOf(t)&&s.availableRaces.includes(s.residentOf(t)));
 const layout=[['warehouse',10,12],...homes.map((t,i)=>[t,...[[9,12],[11,12],[10,14],[8,12]][i]]),['depot',5,12],['reservoir',5,8],['windturbine',5,6],['stable',7,12],['well',8,9],['field',6,9],['field',7,9],['field',6,10],['field',7,10],['sawmill',12,7],['mill',7,6],['bakery',9,6],['generator',14,12],['workshop',14,8],['logistics',12,12],['ironmine',14,6],['coalpit',15,6],['smelter',14,10],['oilpump',16,8],['refinery',16,10],['chemical',16,12],['manaextractor',12,6],['electronics',14,14],['automotive',12,14],['station',10,16],['laboratory',8,14],['hospital',6,14],['battery',15,12],['magetower',6,16],['steamworks',16,14],['leyrelay',14,16],['bank',8,16],['barracks',12,16],['dock',17,8]];
 for(const[t,x,z]of layout)s.build(t,x,z,true);for(const b of s.buildings)if(BUILDINGS[b.type].home)b.level=3;s.syncWorkers();
 for(let x=5;x<18;x++)for(const z of [5,7,9,11,13,15,17])if(!s.at(x,z)&&s.tile(x,z)?.terrain!=='water')s.roads.add(K(x,z));
 for(let z=5;z<19;z++)if(!s.at(13,z))s.roads.add(K(13,z));
 for(let x=5;x<18;x++){if(!s.at(x,17)){s.roads.add(K(x,17));s.rails.add(K(x,17));}}
 for(const b of s.buildings){const d=BUILDINGS[b.type];for(const[r,n]of Object.entries(s.effectiveInputs(b)))b.inputs[r]=n*3;if(d.output==='power'||d.output==='horse')b.activeUntil=60;b.progress=(b.id%5)/5;}
 s.nextEvent=999999;s.syncWorkers();s.revision++;return s;
}
