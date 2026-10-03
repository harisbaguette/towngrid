import {WORLD_PLOTS as PROVINCES,initializeTerritory,tradeConditions,splitTerritory,sovereignOf,frontierClaimOf} from './territory.js';
import {Simulation,createShowcase,RESOURCES,BUILDINGS,noise} from './simulation.js';
import {NATIONS,RACES,RANKS,PROGRESSION_OFFSET,playableRace,BRAND} from './world.js';
import {createStarterShowcase} from './starter-demo.js';
import {dispatchShipment,spareFuel,shipmentError,fuelHold,FUEL_PER_TRIP} from './export-route.js';
import {defaultStartingProvince,startingProvince} from './starting-sites.js';
import {expansionOffer,SITE_MATERIALS} from './site-expansion.js';
import {newLeague,ensureLeague,leagueDay,sendGift} from './league.js';
import {roomFor} from './storage.js';
// Running transit facilities of a site: the smallest travel-time factor they offer (M5), 1 when none run.
const transitFactor=sim=>Math.min(1,...sim.buildings.filter(b=>BUILDINGS[b.type].output==='transit'&&b.health>0&&b.enabled!==false&&b.activeUntil>sim.time).map(b=>BUILDINGS[b.type].transitFactor||1));
const SHARED=['money','debt','family','rank','contracts','contractReadyAt','totalRevenue','produced','sold','emergencyUsed','rescueQuest','charter','haulGear'];
const ok=()=>({ok:true});const fail=error=>({ok:false,error});
// Council, diplomacy and freight prices (docs/BALANCE_PATCH_20260928.md 15). The rules and the buttons both read these (A2-L1).
// perRank: one act becomes available at each rank from `from`, unused ones carry over (A2-U3). welfare: per site, once a day (A2-U1).
export const COUNCIL={
 welfare:{money:250,items:{bread:4},perSite:true,unrest:12,support:12},
 defense:{money:1200,items:{steel:4,workwear:4,canned:4},from:22,upkeep:25},
 invest:{money:2500,growth:1.4,maxSteps:10,yield:.1,legacy:80},
 territory:{money:3000,support:65,defense:2,from:28,stage:20},
 recognition:{money:1200,items:{car:1},from:25,stage:20},
 aid:{money:180,items:{bread:8},relation:12},
 pact:{money:750,relation:55,defense:2,stage:20},
 stateRecognition:{money:1200,items:{car:1},relation:55,stage:20},
 route:{truck:120,rail:360}
};
// Daily running costs from 법인 대표 on (A2-M1): facilities pay a share of their build cost (a switched-off one a quarter of
// that), every branch site a governance fee that grows with the stage, and each guard unit its pay.
// Facility wages from the first day (Town Star charges every facility's wage whether it works or not, docs/TOWNSTAR_RULES.md):
// 1.5% of the build cost a day from 등록 사업주 (the first stage where money piles up, guide-bot 2026-10-03), 3% from
// 법인 대표, a quarter for a facility switched off. Before 등록 사업주 the start money and the ransom debt are the pressure.
export const UPKEEP={earlyFrom:6,fromRank:13,facility:.03,early:.015,idle:.25,sitePerStage:15};
// A running airdock anywhere flies emerging-state orders: their payment rises by this factor (A2-F1).
export const AIR_FREIGHT=1.2;
/** "1,200G · 강철 4 · 자동차 1" for a price {money, items}. */
export const costText=p=>[p.money?p.money.toLocaleString('en-US')+'G':'',...Object.entries(p.items||{}).map(([r,n])=>RESOURCES[r].name+' '+n)].filter(Boolean).join(' · ');
// Endless goals after 패권국 (A2-E1): each goal has tiers; the next target grows by `growth` (or `step`) per tier reached.
export const LEGACY_GOALS=[
 {id:'revenue',name:'대륙 교역 기록',text:'누적 교역 수입',base:1500000,growth:1.6,value:c=>c.treasury.totalRevenue},
 {id:'exports',name:'대륙 수출 기록',text:'누적 판매 수량',base:20000,growth:1.5,value:c=>Object.values(c.treasury.sold||{}).reduce((n,v)=>n+v,0)},
 {id:'pacts',name:'신생국 안정',text:'방위 협정을 맺은 신생국',base:3,step:3,value:c=>c.newStates.filter(v=>v.pact&&!v.dissolved).length},
 {id:'fleet',name:'비공정 함대',text:'누적 비공정 건조',base:20,growth:1.5,value:c=>c.treasury.produced?.airship||0},
 {id:'federation',name:'평온한 연방',text:'불만 40 미만인 자치 지역',base:6,step:2,value:c=>c.sites.filter(v=>v.territory&&v.unrest<40).length}
];
const legacyTarget=(g,level)=>g.step?g.base+g.step*level:Math.round(g.base*g.growth**level);
export class Campaign{
 /** @param {{nation?:string,race?:string,demo?:boolean,starter?:boolean,saved?:any,provinceId?:string|null}} [options] */
 constructor({nation='estern',race=NATIONS[nation].race,demo=false,starter=false,saved=null,provinceId=undefined}={}){
  this.provinces=null;this.sites=[];this.routes=[];this.nextSite=1;this.nextRoute=1;this.deliveries=0;this.defense=0;this.investments=[];this.recognition=[];this.support=55;this.history=[];this.newStates=[];this.lastWorldDay=1;this.nextState=1;this.battles=[];this.relations=Object.fromEntries(Object.keys(NATIONS).map(id=>[id,NATIONS[id].playable?45:-25]));this.treasury={};this.demo=demo;this.welfareDay=0;this.completion=null;this.lag=new Map();
  this.factions=Object.keys(NATIONS).map((id,i)=>({id,wealth:2500+i*73,industry:1+i%5,unrest:20+i%7*5,enterprise:0,age:0}));
  if(saved?.campaignVersion){this.restore(saved);return;}
  if(!saved&&(!playableRace(race)||!NATIONS[nation].playable))throw new Error('현재 인족과 엘프족만 플레이할 수 있습니다');
  const start=!saved&&!demo&&!starter?startingProvince(nation,provinceId===undefined?defaultStartingProvince(nation)?.id:provinceId):null;
  if(!saved&&!demo&&!starter&&!start)throw new Error('수도권을 제외한 정착 가능한 지역을 선택하세요');
  const sim=saved?new Simulation(saved.region,saved):starter?createStarterShowcase(nation,race):demo?createShowcase(nation,race):new Simulation(NATIONS[nation].region,null,{nation,race,provinceId:start.id});
  this.lastWorldDay=sim.day;for(const k of SHARED)this.treasury[k]=structuredClone(sim[k]);this.homeId='site-1';this.activeId=this.homeId;this.nextSite=2;
  this.attach({id:this.homeId,name:start?.name||NATIONS[sim.nation].district,nation:sim.nation,territory:false,unrest:15,sim});
  if(demo){this.support=74;this.defense=2;this.addDemoBranch();}initializeTerritory(this);this.league=newLeague(this);
 }
 tradeConditions(siteId){return tradeConditions(this,siteId);}
 get active(){return this.sites.find(s=>s.id===this.activeId)?.sim||this.sites[0].sim;}
 get home(){return this.sites.find(s=>s.id===this.homeId);}
 get rank(){return this.treasury.rank;}
 get stage(){return this.rank-PROGRESSION_OFFSET;}
 attach(site){site.provinceId??=site.sim.provinceId||site.nation+'-'+((+site.id.split('-')[1]-1)%6);this.sites.push(site);const sim=site.sim;sim.campaign=this;sim.siteId=site.id;for(const k of SHARED)Object.defineProperty(sim,k,{configurable:true,get:()=>this.treasury[k],set:v=>{this.treasury[k]=v;}});return site;}
 addDemoBranch(){const nation=this.home.nation;const sim=new Simulation('highland',null,{nation,race:this.active.race,seed:81,provinceId:nation+'-1'});sim.time=this.active.time;sim.rank=22;sim.nextEvent=999999;const site=this.attach({id:'site-2',name:'북부 제철 지구',nation,territory:false,unrest:12,sim});this.nextSite=3;for(const r of Object.keys(RESOURCES))sim.stock[r]=0;for(const[t,x,z]of [['warehouse',10,12],['generator',10,10],['ironmine',12,10],['coalpit',14,10],['smelter',12,12],['station',14,12],['house',10,14],['dwarfhouse',8,14],['spirithouse',8,14],['battery',12,14]])sim.build(t,x,z,true);for(let x=8;x<16;x++){sim.roads.add(x+',11');sim.roads.add(x+',13');sim.rails.add(x+',13');}for(const b of sim.buildings){for(const[r,n]of Object.entries(BUILDINGS[b.type].inputs||{}))b.inputs[r]=n*4;if(b.type==='generator')b.activeUntil=60;}for(const r of ['wood','stone','water','grain','coal','iron','steel','fuel'])sim.stock[r]=40;sim.revision++;this.createRoute(site.id,this.homeId,'steel',12,'rail',true);}
 metric(key){return ({sites:this.sites.length,deliveries:this.deliveries,railRoutes:this.routes.filter(r=>r.mode==='rail'&&r.completed>0).length,defense:this.defense,investment:this.investments.length,support:Math.round(this.support),recognition:this.recognition.length,territories:this.sites.filter(s=>s.territory).length})[key]||0;}
 switchSite(id){const site=this.sites.find(s=>s.id===id);if(!site)return fail('거점을 찾을 수 없습니다');const paused=this.active.paused,speed=this.active.speed;this.activeId=id;this.active.paused=paused;this.active.speed=speed;return ok();}
 siteOffer(nation,provinceId=null){return expansionOffer(this,nation,provinceId);}
 foundSite(nation,region=NATIONS[nation]?.region,requestedProvince=null){
  const offer=this.siteOffer(nation,requestedProvince);if(!offer.ok)return fail(offer.reason);
  nation=offer.nation;region??=NATIONS[nation].region;
  const from=this.active,{cost,provinceId,seed}=offer;
  // Generate before charging. The preview uses the identical province and seed.
  const sim=new Simulation(region,null,{nation,race:from.race,seed,provinceId});
  this.treasury.money-=cost;const id='site-'+this.nextSite++;sim.time=from.time;sim.nextEvent=sim.time+170;for(const r of Object.keys(RESOURCES))sim.stock[r]=0;for(const[r,n]of Object.entries(SITE_MATERIALS)){from.stock[r]-=n;sim.stock[r]=n;}const site=this.attach({id,name:offer.province.name,nation,territory:false,unrest:18,sim});this.log(site.name+' 진출 · 새 부지를 확보했습니다.');return {ok:true,id};
 }
 stationReady(sim){if(!sim.warehouse)return false;const b=sim.buildings.find(b=>b.type==='station'&&b.health>0&&b.enabled!==false);return !!(b&&sim.poweredAt(b)&&[[1,0],[-1,0],[0,1],[0,-1]].some(([x,z])=>sim.rails.has((b.x+x)+','+(b.z+z)))&&sim.entries(sim.warehouse).length&&sim.routeTo(sim.entries(sim.warehouse)[0],b));}
 createRoute(fromId,toId,item,amount,mode='truck',free=false){if(!['truck','rail'].includes(mode))return fail('운송 방식을 선택하세요');const from=this.sites.find(s=>s.id===fromId),to=this.sites.find(s=>s.id===toId);if(!from||!to||from===to||!RESOURCES[item])return fail('출발지와 도착지, 화물을 선택하세요');if(!from.sim.warehouse||!to.sim.warehouse)return fail('양쪽 거점에 창고가 필요합니다');if(!Number.isInteger(amount)||amount<1||amount>(mode==='rail'?30:12))return fail('트럭은 1~12개, 철도는 1~30개를 운송합니다');if(mode==='rail'&&(!this.stationReady(from.sim)||!this.stationReady(to.sim)))return fail('양쪽 거점에 전력과 선로가 연결된 화물역이 필요합니다');if(this.routes.some(r=>r.from===fromId&&r.to===toId&&r.item===item))return fail('같은 화물 노선이 이미 있습니다');const cost=COUNCIL.route[mode];if(!free&&this.treasury.money<cost)return fail('노선 개설비 '+costText({money:cost})+'가 필요합니다');if(!free)this.treasury.money-=cost;this.routes.push({id:'route-'+this.nextRoute++,from:fromId,to:toId,item,amount,mode,enabled:true,cargo:0,remaining:0,duration:0,completed:0,status:'화물 대기'});return ok();}
 // C4: the site on screen runs every frame; the others run in steps of 0.25 simulated seconds (the step the full-campaign bot
 // runs every site at), each on its own phase so they do not all land on one frame. Time is never dropped, only batched.
 tick(dt){const current=this.active;if(current.paused||!Number.isFinite(dt)||dt<=0)return;const speed=current.speed,step=.25/Math.max(1,speed);
  this.sites.forEach((site,i)=>{const sim=site.sim;sim.speed=speed;sim.paused=false;if(site.id===this.activeId){this.lag.delete(site.id);sim.tick(dt);return;}
   let lag=(this.lag.get(site.id)??step*i/this.sites.length)+Math.min(dt,.25);while(lag>=step-1e-9){sim.tick(step);lag-=step;}this.lag.set(site.id,lag);});
  const elapsed=Math.min(.25,dt)*speed;for(const route of this.routes)this.tickRoute(route,elapsed);const day=this.active.day;if(day>this.lastWorldDay){while(this.lastWorldDay<day){this.lastWorldDay++;this.worldDay();}}}
 closeRoute(id){const r=this.routes.find(v=>v.id===id);if(!r)return fail('노선을 찾을 수 없습니다');r.enabled=false;if(r.cargo){r.closing=true;r.status='도착 후 폐쇄';}else{this.routes=this.routes.filter(v=>v.id!==id);}for(const s of this.sites)s.sim.revision++;return ok();}
 tickRoute(r,dt){const from=this.sites.find(s=>s.id===r.from)?.sim,to=this.sites.find(s=>s.id===r.to)?.sim;if(!from||!to)return;if(r.ambush>0){r.ambush-=dt;r.status='수인족 기습 · 우회 중';return;}
  if(r.cargo){r.remaining-=dt;r.status='운송 중';if(r.remaining<=0){if(roomFor(to,r.item)<r.cargo){r.remaining=0;r.status='도착지 창고 가득 참';return;}to.stock[r.item]+=r.cargo;this.deliveries++;r.completed++;r.cargo=0;r.remaining=0;r.status='하역 완료';this.active.sound('delivery');if(r.closing){this.routes=this.routes.filter(v=>v!==r);for(const s of this.sites)s.sim.revision++;}}return;}
  if(!r.enabled){r.status='노선 중지';return;}if(from.availableStock(r.item)<r.amount){r.status='화물 부족';return;}
  if(from.warehouse?.health<=0||to.warehouse?.health<=0){r.status='창고 수리 필요';return;}
  if(r.mode==='rail'&&(!this.stationReady(from)||!this.stationReady(to))){r.status='화물역·선로·전력 확인';return;}
  // Early branch freight hires a fuel-included carrier. Own refined fuel cuts the dispatch fee.
  const border=this.tradeConditions(to.siteId);if(border.closed){r.status='국경 봉쇄 · 민생 지원으로 관계 회복';return;}const foreign=from.nation!==to.nation;
  // C7: only fuel beyond production reserves and open lord orders (spareFuel) may be burnt, and fuel sent as this cargo is not spare.
  const fuel=spareFuel(from)-fuelHold(r.item,r.amount)>=FUEL_PER_TRIP;const fee=Math.ceil(((r.mode==='rail'?6:12)+(foreign?8:0)+(fuel?0:8)+(border.toll||0))*(this.treasury.charter==='trade'?.8:1)*(this.rank>=30?.8:1));if(this.treasury.money<fee){r.status='운송비 부족';return;}
  this.treasury.money-=fee;if(fuel)from.stock.fuel-=FUEL_PER_TRIP;from.stock[r.item]-=r.amount;r.cargo=r.amount;r.duration=(r.mode==='rail'?24:48)+(foreign?12:0);const fast=[transitFactor(from),transitFactor(to)];if(fast.every(f=>f<1))r.duration*=Math.max(...fast);r.remaining=r.duration;r.status='운송 중';from.sound('dispatch');
 }
 // What moves a site's unrest each day (A2-U2). worldDay applies exactly this list and the site panel shows it.
 unrestCauses(site){const s=site.sim,food=s.stock.bread+s.stock.grain+s.stock.fish;
  // M7: a running parliament in any site lowers every site's unrest by its unrestRelief each day.
  const relief=Math.max(0,...this.sites.flatMap(v=>v.sim.buildings.filter(b=>b.health>0&&b.enabled!==false).map(b=>BUILDINGS[b.type].unrestRelief||0)));
  return [this.treasury.money<0?{id:'deficit',label:'운영 자금 적자',delta:10}:food<4?{id:'food',label:'식량 부족 · 이 거점 창고에 빵·밀·생선 4개 이상',delta:4}:{id:'fed',label:'식량 충분',delta:-1},
   s.diseaseUntil>s.time&&!s.medicalProtection&&{id:'disease',label:'감염 · 병원 의약품으로 막음',delta:3},
   this.stage>=20&&!site.territory&&{id:'charter',label:'자치권 없음',delta:1},
   relief&&{id:'parliament',label:'의사당',delta:-relief}].filter(Boolean);}
 /** Damage, raids and unrest drivers of one site, for the site list (C1, A2-U2). */
 siteStatus(site){const s=site.sim,causes=this.unrestCauses(site);return {broken:s.buildings.filter(b=>b.health<=0).length,damaged:s.buildings.filter(b=>b.health>0&&b.health<100).length,raid:!!(s.raid&&!s.raid.finished),causes,trend:causes.reduce((n,v)=>n+v.delta,0)};}
 /** Daily running costs (A2-M1). */
 upkeep(){const early=this.rank<UPKEEP.fromRank,rate=this.rank<UPKEEP.earlyFrom?0:early?UPKEEP.early:UPKEEP.facility;
  let facilities=0;for(const site of this.sites)for(const b of site.sim.buildings){const d=BUILDINGS[b.type];if(d.home||d.tile||d.terrain||b.type==='warehouse'||b.health<=0)continue;facilities+=d.cost*rate*(b.enabled===false?UPKEEP.idle:1);}
  facilities=Math.round(facilities);const sites=early?0:(this.sites.length-1)*UPKEEP.sitePerStage*Math.max(1,this.stage),guards=this.defense*COUNCIL.defense.upkeep;return {facilities,sites,guards,total:facilities+sites+guards};}
 /** Send one good to a neighbouring nation (league.js sendGift). */
 giftNeighbor(nation,item){return sendGift(this,nation,item);}
 worldDay(){let average=0;
  for(const site of this.sites){site.unrest=Math.max(0,Math.min(100,site.unrest+this.unrestCauses(site).reduce((n,v)=>n+v.delta,0)));average+=site.unrest;if(this.stage>=22&&site.unrest>=85&&site.id!==this.homeId&&site.territory){site.territory=false;site.unrest=55;this.spawnState(site.nation,site.name+' 자치국');this.log(site.name+'이 독립했습니다. 사업장은 남지만 현지 세금이 다시 부과됩니다.');}}
  this.support=Math.max(10,Math.min(95,100-average/this.sites.length-20));const dividend=this.dividend(),cost=this.upkeep().total,budget=this.home.sim.budget;this.treasury.money+=dividend-cost;if(budget){budget.income+=dividend;budget.expenses+=cost;}
  for(const f of this.factions){f.age++;const roll=noise(f.age+f.wealth,f.industry+this.lastWorldDay);f.wealth+=80+f.industry*25-(f.unrest>65?120:0);f.enterprise+=35+roll*50;if(f.enterprise>800){f.enterprise=0;f.industry=Math.min(12,f.industry+1);f.unrest+=4;}f.unrest+=roll>.5?3:-1;if(f.unrest>=78&&f.wealth>3000){f.unrest=32;f.wealth-=1000;this.spawnState(f.id,NATIONS[f.id].capital+' 신연방');}}
  for(const state of [...this.newStates]){if(state.dissolved)continue;state.age=(state.age||0)+1;state.wealth+=70+state.industry*16;state.unrest=Math.max(0,Math.min(100,(state.unrest??30)+(noise(state.age,state.industry+this.lastWorldDay)>.55?4:-1)-(state.pact?2:0)));if(state.age%6===0){state.industry=Math.min(12,state.industry+1);state.unrest+=5;}if(state.age>12&&state.unrest>=82&&state.wealth>1800&&!state.pact){state.unrest=30;state.wealth-=800;this.spawnState(state.id,NATIONS[state.rootNation||state.parent].capital+' 자유공국');}}
  leagueDay(this);
 }
 spawnState(parent,name){const ancestor=this.newStates.find(v=>v.id===parent);const rootNation=ancestor?.rootNation||parent;const state={id:'new-'+this.nextState++,name:name+' '+(this.nextState-1),parent,rootNation,day:this.lastWorldDay,wealth:1000,industry:1,age:0,unrest:30,relation:25,pact:false,trades:0};if(!splitTerritory(this,parent,state))return null;this.newStates.push(state);if(this.newStates.length>180){const old=this.newStates.find(v=>!v.pact&&!this.recognition.includes(v.id)&&!Object.values(this.provinces).some(p=>p.owner===v.id));if(old)this.newStates=this.newStates.filter(v=>v!==old);}this.log(name+' 독립 · '+(ancestor?.name||NATIONS[rootNation]?.name||'기존 국가')+'에서 분리되었습니다.');return state;}
 dividend(){return this.investments.reduce((total,i)=>{const states=this.newStates.filter(v=>v.rootNation===i.nation&&!v.dissolved);const stability=states.length?states.reduce((n,v)=>n+(v.pact?1.3:v.unrest>65?.5:1),0)/states.length:1;return total+Math.round((i.stake?i.stake*COUNCIL.invest.yield:COUNCIL.invest.legacy)*stability);},0);}
 // A2-M3: each stake costs 40% more than the last (up to the tenth) and pays 10% of itself a day, so it returns its price in
 // about ten days. Stakes from saves before this rule have no `stake` and keep their old 80G base.
 investPrice(){const n=Math.min(COUNCIL.invest.maxSteps,this.investments.filter(i=>i.stake).length);return Math.round(COUNCIL.invest.money*COUNCIL.invest.growth**n/100)*100;}
 /** Council acts that open one per rank and carry over (A2-U3): how many can be taken now. */
 allowance(action){const a=COUNCIL[action],used={defense:this.defense,recognition:this.recognition.length,territory:this.sites.filter(s=>s.territory&&s.id!==this.homeId).length}[action];return Math.max(0,this.rank-a.from+1-used);}
 /** Current price of a council act {money, items}: welfare grows with the number of sites, investment with the stakes held. */
 councilPrice(action){const a=COUNCIL[action];if(action==='welfare')return {money:a.money*this.sites.length,items:Object.fromEntries(Object.entries(a.items).map(([r,n])=>[r,n*this.sites.length]))};if(action==='invest')return {money:this.investPrice()};return {money:a.money,items:a.items};}
  // Pays a price from the treasury and the active site's warehouse. Returns '' or the refusal: the money message is the
 // simulation's own moneyShort (amount, shortfall, where to find cash), then any missing goods.
 pay(p,what=''){const s=this.active,lack=Object.entries(p.items||{}).filter(([r,n])=>s.availableStock(r)<n).map(([r,n])=>RESOURCES[r].name+' '+Math.ceil(n-s.availableStock(r))+'개 부족').join(' · '),money=s.moneyShort(p.money,what);
  if(money||lack)return money?money+(lack?' · '+lack:''):what+costText(p)+' · '+lack;this.treasury.money-=p.money;for(const [r,n] of Object.entries(p.items||{}))s.stock[r]-=n;return '';}
 stateOrigin(state){return this.newStates.find(v=>v.id===state.parent)?.name||NATIONS[state.rootNation||state.parent]?.name||'해체된 연방';}
 stateOrder(state){const pool=state.industry<3?['grain','wood','bread','cloth']:state.industry<6?['steel','fuel','brick','glass']:['circuit','medicine','car','lamp'];const item=pool[Math.floor(this.lastWorldDay/4)%pool.length],amount=item==='car'?1:state.industry<3?12:6;return {item,amount,reward:Math.round(RESOURCES[item].price*amount*1.45*(this.airFreight()?AIR_FREIGHT:1)),air:this.airFreight()};}
 airFreight(){return this.sites.some(v=>v.sim.buildings.some(b=>b.type==='airdock'&&b.health>0&&b.enabled!==false&&b.activeUntil>v.sim.time));}
 /** Every open emerging-state order in one list (A2-U4): what it asks, whether it can leave now and why not. */
 stateOrders(){const s=this.active;return this.newStates.filter(v=>!v.dissolved).map(state=>{const order=this.stateOrder(state),have=Math.floor(s.availableStock(order.item)),done=state.lastTradeDay===this.lastWorldDay;
  const reason=done?'오늘 교역 완료':have<order.amount?RESOURCES[order.item].name+' '+order.amount+'개 필요':state.wealth<order.reward?'상대국 대금 준비 중':'';return {state,order,have,done,ready:!reason,reason};}).sort((a,b)=>b.ready-a.ready||b.order.reward-a.order.reward);}
 /** Sends every order that can leave now, best paid first, until the export vehicles run out. */
 tradeAll(){let sent=0,total=0,last='';for(const row of this.stateOrders().filter(v=>v.ready)){const idle=shipmentError(this.active);if(idle){last=idle;break;}const r=this.stateAction('trade',row.state.id);if(!r.ok){last=r.error;continue;}sent++;total+=row.order.reward;}
  if(!sent)return fail(last||'지금 보낼 수 있는 신생국 주문이 없습니다');this.log('신생국 교역 '+sent+'건 출발 · 도착 시 +'+total.toLocaleString('en-US')+'G');return {ok:true,sent,total};}
 stateAction(action,id){const state=this.newStates.find(v=>v.id===id&&!v.dissolved);if(!state)return fail('현재 교섭할 수 있는 국가가 아닙니다');const sim=this.active;if(action==='trade'){if(state.lastTradeDay===this.lastWorldDay)return fail('이 국가의 오늘 계약을 완료했습니다');const order=this.stateOrder(state);if(sim.availableStock(order.item)<order.amount)return fail(RESOURCES[order.item].name+' '+order.amount+'개가 필요합니다');if(state.wealth<order.reward)return fail('상대국이 대금을 준비하고 있습니다');// The order leaves on an export vehicle and is paid at the terminal (export-route.js); the state books it at once.
  const error=dispatchShipment(sim,order.item,order.amount,order.reward,false,{kind:'state',label:state.name});if(error)return fail(error);state.wealth-=order.reward;state.trades++;state.lastTradeDay=this.lastWorldDay;state.relation=Math.min(100,state.relation+10);state.unrest=Math.max(0,state.unrest-4);sim.sound('dispatch');this.log(state.name+'행 교역품 출발 · 도착 시 +'+order.reward+'G');return ok();}if(action==='aid'){const a=COUNCIL.aid;const error=this.pay(a,'민생 지원 ');if(error)return fail(error);state.wealth+=a.money;state.unrest=Math.max(0,state.unrest-12);state.relation=Math.min(100,state.relation+a.relation);return ok();}
  if(action==='pact'){const a=COUNCIL.pact;if(state.pact)return fail('이미 방위 협정을 맺었습니다');if(this.stage<a.stage||state.relation<a.relation||this.defense<a.defense)return fail(this.councilTerms('pact')+'가 필요합니다');const error=this.pay(a,'협정금 ');if(error)return fail(error);state.pact=true;state.unrest=Math.max(0,state.unrest-15);this.log(state.name+'와 상호 방위 협정 체결');return ok();}
  if(action==='recognition'){const a=COUNCIL.stateRecognition;if(this.recognition.includes(id))return fail('이미 독립을 지지했습니다');if(this.stage>=a.stage&&!this.allowance('recognition'))return fail(this.envoyWait());if(this.stage<a.stage||state.relation<a.relation)return fail(this.councilTerms('stateRecognition')+'가 필요합니다');const error=this.pay(a,'지지 요청 ');if(error)return fail(error);this.recognition.push(id);this.log(state.name+'의 독립 지지를 얻었습니다.');return ok();}return fail('외교 행동을 선택하세요');}
 /** Conditions and price of a council or diplomacy act, as the button shows them and the refusal names them (A2-L1). */
 councilTerms(action){const a=COUNCIL[action],rank=a.stage!==undefined?RANKS[a.stage+PROGRESSION_OFFSET].name:'',p=this.councilPrice(action);
  return [action==='pact'||action==='stateRecognition'?rank:'',a.relation&&action!=='aid'?'관계 '+a.relation:'',action==='territory'?'주민 지지 '+a.support:'',a.defense?'경비대 '+a.defense:'',costText(p)].filter(Boolean).join(' · ');}
 envoyWait(){return '이번 단계의 외교 사절을 모두 보냈습니다 · 승급하면 한 명 더 보낼 수 있습니다';}
 recordBattle(sim,raid){this.battles.unshift({day:sim.day,site:sim.siteId,faction:raid.faction,damage:Math.round(raid.damage),defeated:raid.defeated});this.battles=this.battles.slice(0,20);const site=this.sites.find(s=>s.id===sim.siteId);if(site)site.unrest=Math.max(0,Math.min(100,site.unrest+(raid.damage?6:-2)));}
 log(text){this.history.unshift({day:this.active.day,text});this.history=this.history.slice(0,35);this.active.notify(text);}
 onPromotion(){if(this.stage===20){this.home.territory=true;this.log('개발구의 자치권을 확보했습니다. 지방 운영을 직접 맡습니다.');}if(this.stage===22)this.log('독립을 선언했습니다. 외교 승인과 방위력을 확보하세요.');if(this.rank===RANKS.length-1&&!this.completion){this.completion=this.record();this.log(RANKS[this.rank].name+' 달성 · '+this.completion.day+'일 만에 완주했습니다. 이제 대륙 기록에 도전합니다.');}}
 /** The run so far, kept as the completion record at the last rank (A2-E1). */
 record(){const s=this.active;return {day:s.day,seconds:Math.round(s.time),revenue:Math.round(this.treasury.totalRevenue),produced:Object.values(this.treasury.produced||{}).reduce((n,v)=>n+v,0),sold:Object.values(this.treasury.sold||{}).reduce((n,v)=>n+v,0),contracts:this.treasury.contracts,sites:this.sites.length,territories:this.metric('territories'),recognition:this.recognition.length,states:this.newStates.filter(v=>!v.dissolved).length,battles:this.battles.length};}
 /** Endless goals after the last rank: tiers reached, next target and progress (A2-E1). score is the sum of tiers. */
 legacy(){const goals=LEGACY_GOALS.map(g=>{const current=g.value(this);let level=0;while(level<99&&current>=legacyTarget(g,level))level++;return {id:g.id,name:g.name,text:g.text,level,current,target:legacyTarget(g,level)};});return {active:!!this.completion,score:goals.reduce((n,g)=>n+g.level,0),goals};}
 council(action,target){const s=this.active,a=COUNCIL[action],p=a&&this.councilPrice(action),terms=a&&this.councilTerms(action);
  // A2-U1: one welfare pact a day, priced per site.
  if(action==='welfare'){if(this.welfareDay===this.lastWorldDay)return fail('복지 협약은 하루 한 번 맺습니다 · 다음 날 다시');const error=this.pay(p,'복지 협약 ');if(error)return fail(error);this.welfareDay=this.lastWorldDay;for(const site of this.sites){site.unrest=Math.max(0,site.unrest-a.unrest);site.sim.strikeUntil=0;}this.support=Math.min(95,this.support+a.support);this.log('복지 협약 체결 · 파업 해소와 주민 지지 회복');return ok();}
  if(action==='defense'){if(!this.sites.some(v=>v.sim.buildings.some(b=>b.type==='barracks'&&b.health>0)))return fail('경비대 본부를 먼저 건설하세요');if(!this.allowance('defense'))return fail('이번 단계의 경비대 편성을 마쳤습니다 · 승급하면 한 부대 더 편성합니다');const error=this.pay(p,'편성비 ');if(error)return fail(error);this.defense++;this.log('경비대 편성 · 유지비 하루 '+a.upkeep+'G');return ok();}
  if(action==='invest'){if(!this.sites.some(v=>v.sim.buildings.some(b=>b.type==='bank'&&b.health>0)))return fail('투자 사무소가 필요합니다');const error=this.pay(p,'출자금 ');if(error)return fail(error);this.investments.push({nation:target||s.nation,day:s.day,stake:p.money});this.log('산업 투자 체결 · 기본 배당 하루 '+Math.round(p.money*a.yield)+'G · 현지 정세에 따라 변동');return ok();}
  if(action==='recognition'){if(this.stage<a.stage)return fail(RANKS[a.stage+PROGRESSION_OFFSET].name+'부터 외교 사절을 보낼 수 있습니다');if(!NATIONS[target]||!NATIONS[target].playable||target===this.home.nation||this.recognition.includes(target))return fail('아직 지지를 얻지 않은 다른 국가를 선택하세요');if(!this.allowance('recognition'))return fail(this.envoyWait());const error=this.pay(p,'외교 사절 ');if(error)return fail(error);this.recognition.push(target);this.log(NATIONS[target].name+'의 외교 지지를 확보했습니다.');return ok();}
  // G3-12c: the per-rank allowance counts and limits the OTHER sites only. The home got its autonomy at stage 20 for free;
  // when an emerging state takes the home province it can buy it back at any rank (price and terms as for any site).
  if(action==='territory'){if(this.stage<a.stage)return fail('먼저 '+RANKS[a.stage+PROGRESSION_OFFSET].name+'에 도달하세요');const site=this.sites.find(v=>v.id===target);if(!site||site.territory)return fail('자치권을 확보할 거점을 선택하세요');if(site.id!==this.homeId&&!this.allowance('territory'))return fail(this.rank<a.from?RANKS[a.from].name+'부터 다른 거점의 자치권 협약을 맺습니다':'이번 단계의 자치권 협약을 마쳤습니다 · 승급하면 한 곳 더 맺습니다');if(this.support<a.support||this.defense<a.defense)return fail(terms+'가 필요합니다');const error=this.pay(p,'협약금 ');if(error)return fail(error);site.territory=true;site.unrest=Math.max(0,site.unrest-10);this.log(site.name+' 자치권 협약 체결');return ok();}return fail('진행할 수 없는 협약입니다');
 }
 // Titles above the site on screen, then the site and the rank. The domain is the province the site's plot belongs to
 // (its territory; the capital province is the crown domain). A site is named after its plot or province, or after the
 // nation's district at a capital start, so the domain read from the site's own plot and that district were the site
 // itself: the chain listed it twice. The site's own name is now left out of the titles above it.
 hierarchy(){const site=this.sites.find(s=>s.id===this.activeId),n=NATIONS[site.nation],plot=PROVINCES.find(p=>p.id===site.provinceId),province=plot&&PROVINCES.find(p=>p.id===(plot.territoryId||plot.id)),domain=province&&!province.capital?province.name:n.capitalDomain;
  if(frontierClaimOf(site.provinceId,this.sites))return ['내 변경 영지',n.name+' 출신 개척단',site.name,RANKS[this.rank].name];
  if(province&&sovereignOf(province.id,this.provinces)===null)return ['무주지',n.name+' 소속 개척단',site.name,RANKS[this.rank].name];
  const above=this.stage>=22?['독립국 '+BRAND.name,'외교 승인 '+this.recognition.length+'개국',domain,n.fief]:[n.overlord+' 영향권',n.sovereign,n.name,n.dependency,domain,n.fief,n.district,n.manor];
  return [...above.filter(v=>v!==site.name),site.name,RANKS[this.rank].name];}
 save(){return {campaignVersion:1,provinces:structuredClone(this.provinces),battles:structuredClone(this.battles),relations:structuredClone(this.relations),nextState:this.nextState,treasury:structuredClone(this.treasury),homeId:this.homeId,activeId:this.activeId,nextSite:this.nextSite,nextRoute:this.nextRoute,deliveries:this.deliveries,defense:this.defense,investments:structuredClone(this.investments),recognition:[...this.recognition],support:this.support,history:structuredClone(this.history),newStates:structuredClone(this.newStates),factions:structuredClone(this.factions),lastWorldDay:this.lastWorldDay,routes:structuredClone(this.routes),welfareDay:this.welfareDay,completion:structuredClone(this.completion),league:structuredClone(this.league),sites:this.sites.map(({sim,...site})=>({...site,simulation:sim.save()}))};}
 restore(data){for(const k of ['provinces','battles','relations','nextState','treasury','homeId','activeId','nextSite','nextRoute','deliveries','defense','investments','recognition','support','history','newStates','factions','lastWorldDay','routes','welfareDay','completion','league'])if(data[k]!==undefined)this[k]=structuredClone(data[k]);for(const site of data.sites){const {simulation,...meta}=site;this.treasury.charter??=null;this.treasury.rescueQuest??={step:this.treasury.family?5:0,remaining:0,route:null};this.attach({...meta,sim:new Simulation(simulation.region,simulation,{provinceId:meta.provinceId})});}if(!this.sites.length)throw new Error('저장된 거점이 없습니다');for(const state of this.newStates){state.rootNation??=state.parent;state.relation??=25;state.unrest??=30;state.age??=0;state.trades??=0;}initializeTerritory(this);if(!data.provinces)for(const state of this.newStates)splitTerritory(this,state.parent,state);
  // Id counters never fall to a number already in use (an edited or damaged save would otherwise reuse a site/route/state id).
  const top=(list,prefix)=>Math.max(0,...list.map(v=>+String(v.id).slice(prefix.length)||0));
  this.nextSite=Math.max(+this.nextSite||1,top(this.sites,'site-')+1);this.nextRoute=Math.max(+this.nextRoute||1,top(this.routes,'route-')+1);this.nextState=Math.max(+this.nextState||1,top(this.newStates,'new-')+1);
  // A save that reached the last rank before completion records existed gets one from its current state.
  if(this.rank===RANKS.length-1&&!this.completion)this.completion={...this.record(),restored:true};
  // An order a save kept from before the skip rule, for a base good nothing makes, is drawn again (simulation.js contractStale).
  if(this.active.contractStale())delete this.treasury.contractOrder;
  // A save from before the league starts one; a saved one gets any part it lacks (league.js ensureLeague).
  ensureLeague(this);}
}
