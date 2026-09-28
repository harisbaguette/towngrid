import {RESOURCES, BUILDINGS} from './simulation.js';
import {NATIONS} from './world.js';
export function marketFactor(s,item,extra=0){
 const demand=1+Math.sin(Math.floor(s.day/3)*1.71+Object.keys(RESOURCES).indexOf(item)*.83)*.12;
 const pressure=(s.market.pressure[item]||0)+extra;
 const policy=NATIONS[s.nation].sale*(item==='fish'?(NATIONS[s.nation].fishSale||1):1);
 const border=s.campaign?.tradeConditions?.(s.siteId)?.market??1;
 return Math.max(.5,Math.min(1.3,demand-pressure*.009))*policy*border*(s.sanctionUntil>s.time?.75:1);
}
export function saleQuote(s,item,amount=1){let total=0;for(let i=0;i<amount;i++)total+=RESOURCES[item].price*marketFactor(s,item,i);return Math.round(total);}
export function tickEconomy(s,dt){
 for(const item of Object.keys(s.market.pressure))s.market.pressure[item]=Math.max(0,s.market.pressure[item]-dt*.085*(s.charter==='trade'?1.4:1));
 const h=s.health;if(!h.infection)return;
 const clinic=s.buildings.some(b=>b.type==='clinic'&&b.health>0&&b.enabled!==false);
 const hospital=s.buildings.some(b=>b.type==='hospital'&&b.health>0&&b.enabled!==false&&b.activeUntil>s.time);
 if(clinic&&s.stage<15&&s.time>=h.nextCare&&s.availableStock('water')>=2&&s.availableStock('grain')>=1){s.stock.water-=2;s.stock.grain--;h.infection=Math.max(0,h.infection-9);h.nextCare=s.time+16;s.sound('heal');}
 const sanitation=h.sanitationUntil>s.time,care=hospital||s.healthUntil>s.time;
 const growth=care?-.9:sanitation?(s.charter==='commons'?-.34:-.27):clinic&&s.stage<15?-.025:.075+(s.stage>=15?.045:0);
 h.infection=Math.max(0,Math.min(100,h.infection+growth*dt));
 s.diseaseUntil=h.infection>0?s.time+80:0;
 if(!h.infection){h.recoveries++;s.notify('감염이 진정되었습니다. 의료 물자를 비축하세요.','success');s.sound('heal');}
}
export function sanitation(s){
 if(s.money<35||s.availableStock('water')<8||s.availableStock('wood')<3)return {ok:false,error:'방역: 35G · 물 8 · 목재 3개'};
 s.money-=35;s.stock.water-=8;s.stock.wood-=3;s.health.sanitationUntil=s.time+65;s.health.infection=Math.max(0,s.health.infection-12);s.sound('heal');return {ok:true};
}

export function rescueInfo(s){
 const q=s.rescueQuest;
 const steps=[
  {title:'소식을 찾다',text:'영주 납품 두 건을 완료해 국경 연락책을 만납니다.',label:'연락책 접촉 · 75G',ready:s.contracts>=2&&s.money>=75},
  {title:'통행 협상',text:'채무를 절반 이하로 줄이고 통행 문서를 구합니다.',label:'통행 문서 · 125G',ready:s.debt<=500&&s.money>=125},
  {title:'귀환 수레',text:'가족을 태울 수레와 여정을 버틸 식량을 준비합니다.',label:'수레 준비 · 목재 12 · 밀 12',ready:s.availableStock('wood')>=12&&s.availableStock('grain')>=12},
  {title:'검문소 우회',text:'검문소 비용을 내거나 식량을 더 싣고 긴 강변 길로 돌아갑니다.',label:'검문소 통과 · 160G',ready:s.money>=160},
  {title:'집으로 오는 길',text:q.remaining>0?'가족이 귀환 중입니다. 마을의 식량과 안전을 지키세요.':'가족이 머물 주택과 밀 8개를 준비하세요.',label:q.remaining>0?Math.ceil(q.remaining)+'초 뒤 도착':'가족 맞이하기 · 밀 8',ready:q.remaining<=0&&s.buildings.some(b=>BUILDINGS[b.type].home&&b.health>0)&&s.availableStock('grain')>=8},
  {title:'다시 함께',text:'가족이 마을에 정착했습니다. 하루 채무 이자가 20% 줄어듭니다.',label:'합류 완료',ready:false}
 ];return {...steps[Math.min(q.step,5)],step:q.step};
}
export function advanceRescue(s,choice='checkpoint'){
 const q=s.rescueQuest,info=rescueInfo(s);if(s.family)return {ok:false,error:'가족이 이미 합류했습니다'};
 if(q.step===3&&choice==='river'){
  if(s.availableStock('grain')<16)return {ok:false,error:'강변 우회에는 밀 16개가 필요합니다'};
  s.stock.grain-=16;q.route='river';q.remaining=100;
 }else{
  if(!info.ready)return {ok:false,error:info.text};
  if(q.step===0)s.money-=75;
  if(q.step===1)s.money-=125;
  if(q.step===2){s.stock.wood-=12;s.stock.grain-=12;}
  if(q.step===3){s.money-=160;q.route='checkpoint';q.remaining=45;}
  if(q.step===4){s.stock.grain-=8;s.family=true;s.notify('가족이 집으로 돌아왔습니다.','success');s.sound('victory');}
 }
 q.step++;s.sound('delivery');return {ok:true};
}
export function tickRescue(s,dt){
 if(s.campaign&&s.siteId!==s.campaign.homeId)return;const q=s.rescueQuest;if(q.step!==4||q.remaining<=0)return;
 if(s.raid&&!s.raid.finished)return;
 q.remaining=Math.max(0,q.remaining-dt);if(q.remaining===0){s.notify('가족의 수레가 도착했습니다. 주택에서 맞이하세요.','success');s.sound('delivery');}
}
