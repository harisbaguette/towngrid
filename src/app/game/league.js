// Town Star's competition layer, played against the computer (docs/TOWNSTAR_RULES.md 2026-10-03): stars for every sale,
// a daily star goal that grows each time it is met, a seven-day league against rival trading houses with a cash prize,
// a festival season each league week that lifts the price of its goods, and gifts sent to a neighbouring nation.
// The state lives on the campaign (Campaign.league) and is saved with it; a lone Simulation (tests, previews) has none.
import {RESOURCES} from './simulation.js';
import {NATIONS} from './world.js';

export const WEEK_DAYS=7;
/** Stars a sold unit earns: about one per 10G of list price, at least one. A lord's order earns half again. */
export const starsOf=(item,amount)=>Math.max(1,Math.ceil((RESOURCES[item]?.price||0)/10))*amount;
export const CONTRACT_STARS=1.5;
/** Prize for the week's place (1st..8th) times the prize base of the rank (LEAGUE_BASE + per rank). */
export const LEAGUE_PRIZE=[5,3,2,1,.5,0,0,0],LEAGUE_BASE=100,LEAGUE_PER_RANK=60;
/** The daily goal: 80% of the stars of an average recent day, up 8% for each goal met before (Town Star's rising daily
 *  star goal), never under 30. Meeting it pays 1G a star of the goal. */
export const DAILY={share:.8,growth:1.08,min:30,pay:1};
/** A gift to a neighbour: one unit every 30 game seconds, relation +1 per 40G of list price (1..3), and a thank-you
 *  payment the first time the relation reaches 60, 75 and 90. */
export const GIFT={wait:30,step:40,max:3,thanks:[60,75,90],thanksBase:150,thanksPerRank:50};
export const SEASONS=[
 {id:'spring',name:'봄 꽃 축제',goods:{strawberry:1.3,jam:1.3,honey:1.3,honeycomb:1.3,mint:1.2,candy:1.2,herb:1.2}},
 {id:'summer',name:'여름 항구 축제',goods:{fish:1.3,smokedfish:1.3,salt:1.2,canned:1.2,winewhite:1.3,sangria:1.3}},
 {id:'autumn',name:'가을 수확제',goods:{grain:1.2,flour:1.2,bread:1.3,pumpkin:1.3,pie:1.3,lantern:1.3,grapered:1.2,winered:1.3}},
 {id:'winter',name:'겨울 등불제',goods:{cake:1.3,fancycake:1.3,decorcake:1.3,wool:1.3,yarn:1.3,workwear:1.2,fuel:1.2,lamp:1.3}},
];
export const seasonOf=day=>SEASONS[Math.floor(Math.max(0,day-1)/WEEK_DAYS)%SEASONS.length];
export const seasonFactor=(s,item)=>seasonOf(s.campaign?.lastWorldDay??s.day).goods[item]||1;
const noise=(a,b)=>{const v=Math.sin(a*91.7+b*47.3+11)*43758.5453;return v-Math.floor(v);};

export function newLeague(campaign){
 const own=campaign?.sites?.[0]?.nation;
 const rivals=Object.keys(NATIONS).filter(id=>id!==own).slice(0,7).map((id,i)=>({id,name:NATIONS[id].capital+' 상회',pace:.65+i*.11,score:0}));
 return {week:1,stars:0,total:0,dayStars:0,recent:[],rivals,history:[],daily:{day:1,goal:DAILY.min,from:0,done:false,met:0,streak:0},gifts:{at:-1e9,count:0,thanked:{}}};
}
/** Restore defaults for a save from before the league (or a damaged part of one). */
export function ensureLeague(campaign){
 const l=campaign.league||(campaign.league=newLeague(campaign));
 l.recent??=[];l.history??=[];l.rivals??=newLeague(campaign).rivals;l.daily??={day:campaign.lastWorldDay,goal:DAILY.min,from:l.total||0,done:false,met:0,streak:0};l.gifts??={at:-1e9,count:0,thanked:{}};l.gifts.thanked??={};
 return l;
}
/** A sale or a lord's order reached its buyer (export-route.js arrive): count its stars. */
export function awardStars(s,sh){
 const c=s.campaign;if(!c?.league||!RESOURCES[sh.item]||sh.kind==='import')return 0;
 const n=Math.round(starsOf(sh.item,sh.amount)*(sh.kind==='contract'?CONTRACT_STARS:1));addStars(c,n);return n;
}
function addStars(c,n){const l=c.league;l.stars+=n;l.total+=n;l.dayStars+=n;
 const d=l.daily;if(!d.done&&l.total-d.from>=d.goal){d.done=true;d.met++;d.streak++;const pay=Math.round(d.goal*DAILY.pay);c.treasury.money+=pay;const b=c.home?.sim?.budget;if(b)b.income+=pay;c.active.notify('오늘의 도전 달성 · 별 '+d.goal+'개 · +'+pay+'G','success');c.active.sound('contract');}}
export const dailyGoal=(l)=>{const avg=l.recent.length?l.recent.reduce((n,v)=>n+v,0)/l.recent.length:0;return Math.max(DAILY.min,Math.round(avg*DAILY.share*DAILY.growth**l.daily.met));};
const prizeBase=c=>LEAGUE_BASE+LEAGUE_PER_RANK*c.rank;
/** The table of the running week: the player and the rival houses, best first. */
export function standings(c){const l=c.league;if(!l)return [];return [{id:'player',name:c.home?.name||'내 마을',score:l.stars,player:true},...l.rivals.map(r=>({id:r.id,name:r.name,score:Math.round(r.score)}))].sort((a,b)=>b.score-a.score||(a.player?-1:1));}
/** A world day passed (Campaign.worldDay): rivals score, the daily goal resets, and every seventh day the week closes. */
export function leagueDay(c){
 const l=ensureLeague(c);l.recent=[...l.recent,l.dayStars].slice(-3);
 // Each rival scores about what the player averaged over the last days, times its pace (0.65..1.31) and the day's luck.
 const avg=l.recent.reduce((n,v)=>n+v,0)/l.recent.length;
 for(const [i,r] of l.rivals.entries())r.score+=Math.max(10,avg)*r.pace*(.75+noise(i+1,c.lastWorldDay)*.5);
 l.dayStars=0;if(!l.daily.done)l.daily.streak=0;
 l.daily={...l.daily,day:c.lastWorldDay,from:l.total,done:false};l.daily.goal=dailyGoal(l);
 if((c.lastWorldDay-1)%WEEK_DAYS===0){
  const table=standings(c),place=table.findIndex(v=>v.player)+1,prize=Math.round((LEAGUE_PRIZE[place-1]||0)*prizeBase(c));
  if(prize){c.treasury.money+=prize;const b=c.home?.sim?.budget;if(b)b.income+=prize;}
  l.history=[...l.history,{week:l.week,place,stars:l.stars,prize}].slice(-20);
  c.log(l.week+'주차 교역 순위 '+place+'위 · 별 '+l.stars+'개'+(prize?' · 상금 '+prize+'G':''));
  c.active.notify(l.week+'주차 교역 순위 '+place+'위'+(prize?' · 상금 +'+prize+'G':''),place<=3?'success':'info');
  l.week++;l.stars=0;for(const r of l.rivals)r.score=0;
  const season=seasonOf(c.lastWorldDay);c.active.notify(season.name+' 시작 · '+Object.keys(season.goods).map(k=>RESOURCES[k].name).slice(0,4).join('·')+' 값이 오릅니다','info');
 }
}
/** Why a gift cannot leave now, or null. */
export function giftShort(c,nation,item){
 const l=c.league,s=c.active;if(!l)return '선물을 보낼 수 없습니다';
 if(!NATIONS[nation]||nation===s.nation)return '보낼 이웃 나라를 고르세요';if((c.relations[nation]??0)<=0)return '적대 관계인 나라에는 보낼 수 없습니다';
 if(!RESOURCES[item])return '보낼 물건을 고르세요';if(s.availableStock(item)<1)return RESOURCES[item].name+' 재고가 없습니다';
 const wait=Math.ceil(l.gifts.at+GIFT.wait-s.time);if(wait>0)return '다음 선물까지 '+wait+'초';return null;
}
/** Send one unit to a neighbouring nation (Town Star's neighbour delivery): relation and stars, a thank-you at 60/75/90. */
export function sendGift(c,nation,item){
 const error=giftShort(c,nation,item);if(error)return {ok:false,error};const l=c.league,s=c.active;
 s.stock[item]-=1;l.gifts.at=s.time;l.gifts.count++;
 const before=c.relations[nation]??0,gain=Math.min(GIFT.max,Math.max(1,Math.ceil(RESOURCES[item].price/GIFT.step))),after=Math.min(100,before+gain);c.relations[nation]=after;
 addStars(c,starsOf(item,1));const thanks=GIFT.thanks.filter(t=>before<t&&after>=t&&!l.gifts.thanked[nation+':'+t]);
 let paid=0;for(const t of thanks){l.gifts.thanked[nation+':'+t]=true;paid+=GIFT.thanksBase+GIFT.thanksPerRank*c.rank;}
 if(paid){c.treasury.money+=paid;const b=c.home?.sim?.budget;if(b)b.income+=paid;}
 s.sound('dispatch');s.notify(NATIONS[nation].name+'에 '+RESOURCES[item].name+' 선물 · 관계 '+after+(paid?' · 답례 +'+paid+'G':''),'success');
 return {ok:true,relation:after,thanks:paid};
}
