import {NATIONS} from './world.js';
import {WORLD_PLOTS,sovereignOf,frontierClaimOf} from './territory.js';
import {restrictionOf} from './settlement-access.js';

export const SITE_MATERIALS={wood:24,stone:16,water:8};
/** Read-only quote shared by the atlas, the button and the actual transaction. */
export function expansionOffer(c,nation,requested=null){
 const wilderness=nation==='unclaimed',frontier=nation==='player',operator=wilderness||frontier?c.home.nation:nation;
 // Unoccupied world tiles already exist before a deed is bought. Acquiring a
 // plot must not reroll its trees or deposits; existing sites keep their seed.
 const cost=700+(c.sites.length-1)*250,seed=c.sites.find(s=>s.provinceId===requested)?.sim.seed??0;
 const candidates=WORLD_PLOTS.filter(p=>frontier?frontierClaimOf(p.id,c.sites):wilderness?sovereignOf(p.id,c.provinces)===null:p.nation===nation);
 const automatic=[...Array.from({length:6},(_,i)=>nation+'-'+((c.nextSite-1+i)%6)),...candidates.map(p=>p.id)].find(id=>candidates.some(p=>p.id===id)&&!restrictionOf(id)&&(frontier||!c.sites.some(s=>s.provinceId===id)));
 const province=candidates.find(p=>p.id===(requested||automatic))||null;
 const owned=province?c.sites.find(s=>s.provinceId===province.id):null;
 const requiredStage=!wilderness&&nation===c.home.nation?8:13;
 const requirements=[{id:'money',label:'자금',have:c.treasury.money,need:cost},...Object.entries(SITE_MATERIALS).map(([id,need])=>({id,label:{wood:'목재',stone:'석재',water:'물'}[id],have:c.active.stock[id]||0,need}))];
 let reason='';
 if(!NATIONS[operator])reason='국가를 선택하세요';
 else if(!NATIONS[operator].playable)reason='적대 세력에는 거점을 세울 수 없습니다';
 else if(owned)reason='이미 보유한 거점입니다';
 else if(!province)reason=requested?'이 칸에는 거점을 세울 수 없습니다':'이 국가에 빈 거점 부지가 없습니다';
 else if(restrictionOf(province.id))reason=restrictionOf(province.id).reason;
 else if(c.sites.length>=24)reason='동시에 운영할 수 있는 거점은 24곳입니다';
 else if(c.stage<requiredStage)reason=wilderness?'광역 투자자부터 무주지를 개척할 수 있습니다':requiredStage===8?'법인 대표부터 국내 거점에 진출할 수 있습니다':'광역 투자자부터 해외 거점에 진출할 수 있습니다';
 else if(requirements.some(r=>r.have<r.need))reason='진출에 필요한 자금과 자재를 준비하세요';
 const restricted=!!province&&!!restrictionOf(province.id),unlocked=!!province&&!owned&&!restricted&&!!NATIONS[operator]?.playable&&c.sites.length<24&&c.stage>=requiredStage;
 return {ok:!reason,reason,cost,seed,nation:operator,wilderness,provinceId:province?.id||null,province,ownedId:owned?.id||null,requiredStage,requirements,unlocked,status:owned?'owned':!NATIONS[operator]?.playable?'hostile':!province?'unavailable':restricted?'restricted':unlocked?(!reason?'available':'materials'):'locked'};
}
