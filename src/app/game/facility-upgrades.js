import {powerSupply} from './power-grid.js';
import {BUILDINGS} from './simulation.js';
import {unlockRank,RANKS} from './world.js';
import {capacity} from './storage.js';
import {terminalVehicleCapacity} from './trade-terminals.js';
export const levelFactor=b=>1+Math.max(0,(b?.level||1)-1)*.5;
export function upgradeKind(b){const d=BUILDINGS[b?.type];return !d||d.emergency||d.tile||d.terrain?null:d.home?'home':['warehouse','depot'].includes(b.type)?'storage':d.terminal?'transport':d.output==='power'?'power':d.period?'production':null;}
export function upgradeQuote(s,b){
 const kind=upgradeKind(b),level=b?.level||1;if(!kind||level>=3)return null;
 const item=level>=2?'brick':kind==='home'?'wood':'plank',quantity=['storage','transport'].includes(kind)?6:3;
 const money=Math.round((kind==='home'?level*60:Math.max(10,s.buildCost(b.type)*(level===1?.25:.4)))*(b.specialized&&b.race==='human'?.8:1));
 const materialRank=item==='brick'?unlockRank('kiln'):item==='plank'?unlockRank('sawmill'):0;
 const next={...b,level:level+1};let label,from,to;
 if(kind==='power'){label='발전 용량';from=powerSupply(b)+'전력';to=powerSupply(next)+'전력';}
 else if(kind==='home'){label='주민';from=level+'명';to=(level+1)+'명 · 유지비 +1G/일';}
 else if(kind==='storage'){label='보관 용량';from=capacity(s,b)+'개';to=capacity(s,next)+'개';}
 else if(kind==='transport'){label='차량 적재량';const t=s.tradeTerminals().find(t=>t.building===b.id),current=terminalVehicleCapacity(t||{type:b.type,capacity:BUILDINGS[b.type].terminal.capacity*levelFactor(b)});from=current+'개';to=Math.floor(current/levelFactor(b)*levelFactor(next))+'개';}
 else {label='생산 속도';from=(100+(level-1)*30)+'%';to=(100+level*30)+'%';}
 return {kind,level,nextLevel:level+1,money,items:{[item]:quantity},item,quantity,rank:materialRank,label,from,to};
}
export function upgradeError(s,b){const q=upgradeQuote(s,b);if(!q)return '더 이상 업그레이드할 수 없습니다';if(b.health<100)return '시설을 수리한 뒤 업그레이드하세요';if(b.movingUntil>s.time)return '이전이 끝난 뒤 업그레이드하세요';if(s.rank<q.rank)return RANKS[q.rank].name+' 승급이 필요합니다';return s.priceShort({money:q.money,items:q.items},'업그레이드 비용 ');}
