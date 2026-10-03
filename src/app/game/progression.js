import {realSeconds, remainingSeconds} from './game-time.js';

// Side challenges of a promotion (shown under the requirements; promotion waits for them too). G1-P2: delivery, direct,
// defended and trades count only what happens in the rank being played, from the baselines tickChallenges keeps in
// s.challenge. Counted over the whole run they were already met when the rank began (resident hauls 41 of 18, direct
// hauls 683 of 12 and 5,643 of 160, raids repelled 3 of 1), so the challenge was never played.
const trials={
 2:{key:'delivery',target:60,name:'주민이 자원 60개 운반',right:'첫 납품 보너스가 10% 늘어납니다.'},
 3:{key:'reserves',target:1,name:'목재 12 · 물 8 비축',right:'개간 허가로 다음 확장 비용이 10% 줄어듭니다.'},
 7:{key:'diversity',target:2,name:'서로 다른 두 품목 판매',right:'제과점과 급수탑을 운영합니다.'},
 9:{key:'direct',target:40,name:'시설 간 직송 40개',right:'봉제소와 유리 공방을 운영합니다.'},
 12:{key:'uptime',target:50,name:'생산 시설 3곳을 50초 연속 가동',right:'풍력 발전과 자동 물류센터를 운영합니다.'},
 17:{key:'healthy',target:60,name:'감염 15% 이하로 60초 운영',right:'마탑과 정밀 회로 산업을 허가받습니다.'},
 20:{key:'diversity',target:18,name:'열여덟 품목을 시장에 공급',right:'의약품 제조와 종합 병원을 운영합니다.'},
 23:{key:'defended',target:1,name:'이번 단계에 습격 한 번 격퇴',right:'자체 경비대의 경계 범위가 늘어납니다.'},
 25:{key:'healthy',target:120,name:'감염 15% 이하로 120초 운영',right:'자치권·외교 사절·지역 협약이 열립니다.'},
 26:{key:'trades',target:4,name:'신생국 교역 4건',right:'의사당을 세워 모든 거점의 불만을 낮출 수 있습니다.'},
 28:{key:'delivery',target:1200,name:'창고·시설 운반 1,200개',right:'국경 통행세가 줄고 독립국 계약을 체결합니다.'},
 30:{key:'stableSites',target:3,name:'불만 40 미만인 자치 지역 3곳',right:'연방 공동시장으로 거점 운송비가 줄어듭니다.'},
 32:{key:'stableSites',target:5,name:'불만 40 미만인 자치 지역 5곳',right:'패권국의 공동 방위를 운영합니다.'}
};
/** Campaign-wide running totals the per-rank challenges count from (resident hauls, direct hauls, emerging-state trades). */
const totals=s=>{const sites=s.campaign?.sites.map(v=>v.sim)||[s];return {delivered:sites.reduce((n,v)=>n+v.logisticsStats.delivered,0),direct:sites.reduce((n,v)=>n+v.logisticsStats.direct,0),trades:s.campaign?.newStates.reduce((n,v)=>n+(v.trades||0),0)||0};};
export function trialValue(s,key){
 const c=s.challenge||{},now=totals(s),since=k=>Math.max(0,now[k]-(c[k+'From']??now[k])),startDay=Number.isFinite(c.since)?Math.floor(c.since/80)+1:s.day;
 return ({delivery:since('delivered'),direct:since('direct'),trades:since('trades'),reserves:+(s.stock.wood>=12&&s.stock.water>=8),diversity:Object.values(s.sold).filter(n=>n>0).length,uptime:c.bestUptime||0,healthy:c.bestHealthy||0,defended:s.campaign?.battles.filter(v=>!(v.day<startDay)&&(v.defeated>=3||!v.damage)).length||0,stableSites:s.campaign?.sites.filter(v=>v.territory&&v.unrest<40).length||0})[key]||0;
}
export function nextTrial(s){
 const t=trials[s.rank+1];if(!t)return null;
 const current=trialValue(s,t.key),timed=t.key==='uptime'||t.key==='healthy';
 const displayCurrent=timed?Math.floor(realSeconds(current,s)+1e-9):Math.floor(current);
 const displayTarget=timed?remainingSeconds(t.target,s):t.target;
 const name=t.key==='uptime'?'생산 시설 3곳을 '+displayTarget+'초 연속 가동':t.key==='healthy'?'감염 15% 이하로 '+displayTarget+'초 운영':t.name;
 return {...t,name,current,done:current>=t.target,displayCurrent,displayTarget};
}
export function tickChallenges(s,dt){
 const c=s.challenge;
 // Baselines of the rank being played. promote() clears the challenge of the promoting site; every other site (rank is
 // shared) notices the new rank here. A save from before the baselines starts counting when it is loaded.
 if(c.rank!==s.rank){const fresh=c.rank!==undefined,t=totals(s);if(fresh){c.uptime=0;c.bestUptime=0;c.healthy=0;c.bestHealthy=0;}c.rank=s.rank;c.since=s.time;c.deliveredFrom=t.delivered;c.directFrom=t.direct;c.tradesFrom=t.trades;}
 c.uptime=s.buildings.filter(b=>b.working).length>=3?(c.uptime||0)+dt:0;c.bestUptime=Math.max(c.bestUptime||0,c.uptime);
 c.healthy=s.warehouse&&s.health.infection<=15?(c.healthy||0)+dt:0;c.bestHealthy=Math.max(c.bestHealthy||0,c.healthy);
}
export const CHARTERS={
 industry:{name:'산업 특허',text:'가공·산업 생산 +8% · 세금 하루 +4G'},
 commons:{name:'공동체 헌장',text:'방역 효과 +25% · 세금 하루 −3G'},
 trade:{name:'교역 헌장',text:'판매 후 수요 회복 +40% · 운송비 −20%'}
};
export function chooseCharter(s,id){if(!CHARTERS[id])return {ok:false,error:'헌장을 선택하세요'};if(s.rank<5)return {ok:false,error:'임차 사업주부터 헌장을 선택합니다'};if(s.charter)return {ok:false,error:'이미 채택한 헌장입니다'};s.charter=id;s.notify(CHARTERS[id].name+' 채택','success');return {ok:true};}
