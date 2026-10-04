import {BUILDINGS} from './simulation.js';
import {blockHint,contractState,fuelRestock,promotionParts,operatingReserve} from './ui-rules.js';

// A way into the existing screens, without selecting a building or enabling the tutorial.
export function focusNext(s){
 if(s.pendingEvent)return {label:'사건에 대응하세요',detail:s.eventName(s.pendingEvent.type),view:'operations',urgent:true};
 const reserve=operatingReserve(s);if(reserve.short)return {label:'운영비·연료 예산을 확보하세요',detail:'권장 여유 자금 '+reserve.target.toLocaleString('ko-KR')+'G · 판매 확인',view:'operations',urgent:true};
 const broken=s.buildings.find(b=>b.enabled!==false&&(b.health<=0||blockHint(b.status,s)));
 if(broken)return {label:BUILDINGS[broken.type].name+' · '+broken.status,detail:'원인과 해결 방법',view:'operations',urgent:true};
 if(!s.buildings.some(b=>!BUILDINGS[b.type].tile))return {label:'첫 시설을 지어 생산을 시작하세요',detail:'건설 · B',view:'build'};
 const fuel=fuelRestock(s);if(fuel&&s.stock.fuel<5)return {label:'운송 연료가 부족합니다',detail:'연료 수입·자급 확인',view:'operations',urgent:true};
 const p=s.promotion();if(p?.ready)return {label:'승급할 수 있습니다',detail:'새 시설과 권한 확인',view:'goals'};
 const deal=contractState(s);if(deal.ready)return {label:'납품할 물자가 준비됐습니다',detail:'목표·납품 열기',view:'goals'};
 const part=promotionParts(s,p).find(v=>!v.done);
 return part?{label:part.label+' '+Math.floor(part.current)+' / '+part.target+(part.unit||''),detail:'다음 목표 확인',view:'goals'}:{label:'마을의 생산 흐름을 살펴보세요',detail:'생산·위기 열기',view:'operations'};
}
