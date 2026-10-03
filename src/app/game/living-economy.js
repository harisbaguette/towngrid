import {remainingSeconds} from './game-time.js';
import {RESOURCES, BUILDINGS, MERCHANT_PRICE, SANITATION} from './simulation.js';
import {NATIONS} from './world.js';
import {tradeConnection} from './trade-terminals.js';
import {seasonFactor} from './league.js';
export function marketFactor(s,item,extra=0){
 const demand=1+Math.sin(Math.floor(s.day/3)*1.71+Object.keys(RESOURCES).indexOf(item)*.83)*.12;
 const pressure=(s.market.pressure[item]||0)+extra;
 const policy=NATIONS[s.nation].sale*(item==='fish'?(NATIONS[s.nation].fishSale||1):1);
 const border=s.campaign?.tradeConditions?.(s.siteId)?.market??1;
 // The festival of the league week lifts its goods (league.js SEASONS).
 return Math.max(.5,Math.min(1.3,demand-pressure*.009))*seasonFactor(s,item)*policy*border*(s.sanctionUntil>s.time?.75:1)*(s.merchantUntil>s.time?MERCHANT_PRICE:1);
}
// The trade route a site sells through adds its own premium or middleman cut (trade-routes.js).
export function saleQuote(s,item,amount=1){let total=0;for(let i=0;i<amount;i++)total+=RESOURCES[item].price*marketFactor(s,item,i);return Math.round(total*tradeConnection(s).price);}
export const INFECTION_SPREAD=.0086;
export function tickEconomy(s,dt){
 // M6: a running marketplace speeds price recovery (marketRecovery), multiplied with the trade charter.
 const market=Math.max(1,...s.buildings.filter(b=>b.health>0&&b.enabled!==false).map(b=>BUILDINGS[b.type].marketRecovery||1));
 for(const item of Object.keys(s.market.pressure))s.market.pressure[item]=Math.max(0,s.market.pressure[item]-dt*.085*(s.charter==='trade'?1.4:1)*market);
 const h=s.health;if(!h.infection)return;
 const clinic=s.buildings.some(b=>b.type==='clinic'&&b.health>0&&b.enabled!==false);
 const hospital=s.buildings.some(b=>b.type==='hospital'&&b.health>0&&b.enabled!==false&&b.activeUntil>s.time);
 if(clinic&&s.stage<15&&s.time>=h.nextCare&&s.availableStock('herb')>=1&&s.availableStock('water')>=1){s.stock.herb--;s.stock.water--;h.infection=Math.max(0,h.infection-9);h.nextCare=s.time+16;s.sound('heal');}
 const sanitation=h.sanitationUntil>s.time,care=hospital||s.healthUntil>s.time;
 // Untreated infection spreads with the share already infected (docs/BALANCE_PATCH_20260928.md 12-6): an outbreak of 32
 // reaches about 48 after one day and 65 after two, while a trace barely grows; the mana-borne disease spreads 1.5x.
 const growth=care?-.9:sanitation?(s.charter==='commons'?-.34:-.27):clinic&&s.stage<15?-.025:INFECTION_SPREAD*h.infection*(1-h.infection/100)*(s.stage>=15?1.5:1);
 h.infection=Math.max(0,Math.min(100,h.infection+growth*dt));
 s.diseaseUntil=h.infection>0?s.time+80:0;
 if(!h.infection){h.recoveries=(h.recoveries||0)+1;s.notify('감염이 진정되었습니다. 의료 물자를 비축하세요.','success');s.sound('heal');}
}
/** Why sanitation cannot be bought now, or null (K-03): the price and what of it is short ("방역 35G · 물 8 · 목재 3 · 목재
 *  3개 부족"), the same text the button shows and the action refuses with. */
export function sanitationShort(s){return s.priceShort(SANITATION,'방역 ');}
export function sanitation(s){
 const error=sanitationShort(s);if(error)return {ok:false,error};
 s.money-=SANITATION.money;for(const[r,n]of Object.entries(SANITATION.items))s.stock[r]-=n;s.health.sanitationUntil=s.time+65;s.health.infection=Math.max(0,s.health.infection-12);s.sound('heal');return {ok:true};
}

/** The family rescue's price per step (the river detour at step 3 instead of the checkpoint fee). */
export const RESCUE_PRICES=[{money:75},{money:125},{items:{wood:12,grain:12}},{money:160},{items:{grain:8}}],RIVER_DETOUR={items:{grain:16}};
const RESCUE_WHAT=['연락책 접촉 ','통행 문서 ','수레 준비 ','검문소 통과 ','가족 맞이하기 '];
/** Why the next rescue step cannot be taken now, or null (K-03): the condition not yet met, else what of its price is short. */
export function rescueShort(s,choice='checkpoint'){
 const q=s.rescueQuest;if(s.family||q.step>=5)return '가족이 이미 합류했습니다';
 if(q.step===3&&choice==='river')return s.priceShort(RIVER_DETOUR,'강변 우회 ');
 if(q.step===0&&s.contracts<2)return '영주 납품 '+s.contracts+'/2건 · 납품을 더 완료하세요';
 if(q.step===1&&s.debt>500)return '채무 '+Math.ceil(s.debt)+'G · 500G 이하로 갚으세요';
 if(q.step===4&&q.remaining>0)return '가족이 귀환 중입니다 · '+remainingSeconds(q.remaining,s)+'초 뒤 도착';
 if(q.step===4&&!s.buildings.some(b=>BUILDINGS[b.type].home&&b.health>0))return '가족이 머물 주택이 필요합니다';
 return s.priceShort(RESCUE_PRICES[q.step],RESCUE_WHAT[q.step]);
}
export function rescueInfo(s){
 const q=s.rescueQuest,ready=q.step<5&&!rescueShort(s);
 const steps=[
  {title:'소식을 찾다',text:'영주 납품 두 건을 완료해 국경 연락책을 만납니다.',label:'연락책 접촉 · 75G',ready},
  {title:'통행 협상',text:'채무를 절반 이하로 줄이고 통행 문서를 구합니다.',label:'통행 문서 · 125G',ready},
  {title:'귀환 수레',text:'가족을 태울 수레와 여정을 버틸 식량을 준비합니다.',label:'수레 준비 · 목재 12 · 밀 12',ready},
  {title:'검문소 우회',text:'검문소 비용을 내거나 식량을 더 싣고 긴 강변 길로 돌아갑니다.',label:'검문소 통과 · 160G',ready},
  {title:'집으로 오는 길',text:q.remaining>0?'가족이 귀환 중입니다. 마을의 식량과 안전을 지키세요.':'가족이 머물 주택과 밀 8개를 준비하세요.',label:q.remaining>0?remainingSeconds(q.remaining,s)+'초 뒤 도착':'가족 맞이하기 · 밀 8',ready},
  {title:'다시 함께',text:'가족이 마을에 정착했습니다. 하루 채무 이자가 20% 줄어듭니다.',label:'합류 완료',ready:false}
 ];return {...steps[Math.min(q.step,5)],step:q.step};
}
export function advanceRescue(s,choice='checkpoint'){
 const q=s.rescueQuest,error=rescueShort(s,choice);if(error)return {ok:false,error};
 const river=q.step===3&&choice==='river',price=river?RIVER_DETOUR:RESCUE_PRICES[q.step];s.money-=price.money||0;for(const[r,n]of Object.entries(price.items||{}))s.stock[r]-=n;
 if(river){q.route='river';q.remaining=100;}else if(q.step===3){q.route='checkpoint';q.remaining=45;}
 if(q.step===4){s.family=true;s.notify('가족이 집으로 돌아왔습니다.','success');s.sound('victory');}
 q.step++;s.sound('delivery');return {ok:true};
}
export function tickRescue(s,dt){
 if(s.campaign&&s.siteId!==s.campaign.homeId)return;const q=s.rescueQuest;if(q.step!==4||q.remaining<=0)return;
 if(s.raid&&!s.raid.finished)return;
 q.remaining=Math.max(0,q.remaining-dt);if(q.remaining===0){s.notify('가족의 수레가 도착했습니다. 주택에서 맞이하세요.','success');s.sound('delivery');}
}
