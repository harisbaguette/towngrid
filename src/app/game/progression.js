const trials={
 2:{key:'delivery',target:18,name:'주민이 자원 18개 운반',right:'첫 납품 보너스가 10% 늘어납니다.'},
 3:{key:'reserves',target:1,name:'목재 12 · 물 8 비축',right:'개간 허가로 다음 확장 비용이 10% 줄어듭니다.'},
 7:{key:'diversity',target:2,name:'서로 다른 두 품목 판매',right:'제과점과 급수탑을 운영합니다.'},
 9:{key:'direct',target:12,name:'시설 간 직송 12개',right:'봉제소와 유리 공방을 운영합니다.'},
 12:{key:'uptime',target:50,name:'생산 시설 3곳을 50초 연속 가동',right:'풍력 발전과 자동 물류센터를 운영합니다.'},
 17:{key:'healthy',target:60,name:'감염 15% 이하로 60초 운영',right:'마탑과 정밀 회로 산업을 허가받습니다.'},
 20:{key:'diversity',target:7,name:'일곱 품목을 시장에 공급',right:'의약품 제조와 종합 병원을 운영합니다.'},
 23:{key:'defended',target:1,name:'현장에서 습격 한 번 격퇴',right:'자체 경비대의 경계 범위가 늘어납니다.'},
 25:{key:'healthy',target:120,name:'감염 15% 이하로 120초 운영',right:'자치권·외교 사절·지역 협약이 열립니다.'},
 28:{key:'direct',target:160,name:'시설 간 직송 160개',right:'국경 통행세가 줄고 독립국 계약을 체결합니다.'},
 30:{key:'stableSites',target:3,name:'불만 40 미만인 자치 지역 3곳',right:'연방 공동시장으로 거점 운송비가 줄어듭니다.'},
 32:{key:'stableSites',target:5,name:'불만 40 미만인 자치 지역 5곳',right:'패권국의 공동 방위를 운영합니다.'}
};
export function trialValue(s,key){
 const sites=s.campaign?.sites.map(v=>v.sim)||[s];
 return ({delivery:sites.reduce((n,v)=>n+v.logisticsStats.delivered,0),direct:sites.reduce((n,v)=>n+v.logisticsStats.direct,0),reserves:+(s.stock.wood>=12&&s.stock.water>=8),diversity:Object.values(s.sold).filter(n=>n>0).length,uptime:s.challenge.bestUptime||0,healthy:s.challenge.bestHealthy||0,defended:s.campaign?.battles.filter(v=>v.defeated>=3||!v.damage).length||0,stableSites:s.campaign?.sites.filter(v=>v.territory&&v.unrest<40).length||0})[key]||0;
}
export function nextTrial(s){const t=trials[s.rank+1];return t?{...t,current:trialValue(s,t.key),done:trialValue(s,t.key)>=t.target}:null;}
export function tickChallenges(s,dt){
 const c=s.challenge;
 c.uptime=s.buildings.filter(b=>b.working).length>=3?(c.uptime||0)+dt:0;c.bestUptime=Math.max(c.bestUptime||0,c.uptime);
 c.healthy=s.warehouse&&s.health.infection<=15?(c.healthy||0)+dt:0;c.bestHealthy=Math.max(c.bestHealthy||0,c.healthy);
}
export const CHARTERS={
 industry:{name:'산업 특허',text:'가공·산업 생산 +8% · 세금 하루 +4G'},
 commons:{name:'공동체 헌장',text:'방역 효과 +25% · 세금 하루 −3G'},
 trade:{name:'교역 헌장',text:'판매 후 수요 회복 +40% · 운송비 −20%'}
};
export function chooseCharter(s,id){if(!CHARTERS[id])return {ok:false,error:'헌장을 선택하세요'};if(s.rank<5)return {ok:false,error:'임차 사업주부터 헌장을 선택합니다'};if(s.charter)return {ok:false,error:'이미 채택한 헌장입니다'};s.charter=id;s.notify(CHARTERS[id].name+' 채택','success');return {ok:true};}
