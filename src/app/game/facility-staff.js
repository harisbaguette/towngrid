import { factionOf } from './world.js';
import { residentLook } from './resident-roster.js';
import { productionVisualState } from './production-visuals.js';

// Facility staff are automatic, attached to a workplace, and do not consume
// a housing/transport slot. Production remains the simulation's authority.
const profession=(name,human,elf)=>({name,human,elf});
export const PROFESSIONS={
 baker:profession('제빵사',['human','hana'],['elf','lien']),
 farmer:profession('재배사',['human','ethan'],['elf','elion']),
 rancher:profession('사육사',['human','roa'],['centaur','lana']),
 lumber:profession('벌목·목공',['human','garron'],['elf','ael']),
 miner:profession('광부',['dwarf','dorin'],['elf','elvar']),
 smith:profession('제련공',['dwarf','marna'],['elf','serin']),
 textile:profession('재봉사',['human','nara'],['elf','lyra']),
 glass:profession('유리공',['dwarf','borik'],['elf','oriel']),
 engineer:profession('설비 기술자',['human','rowan'],['elf','terin']),
 medic:profession('의료 연구원',['human','vera'],['fae','eil']),
 carrier:profession('운송원',['human','dax'],['elf','norin']),
 mage:profession('마력 기술자',['human','cedric'],['spirit','mist']),
 merchant:profession('상인',['human','bel'],['elf','vian']),
 administrator:profession('행정관',['human','oswin'],['elf','erena']),
 guard:profession('경비대원',['human','garen'],['elf','aster']),
 fisher:profession('어부',['human','maren'],['elf','nalia']),
 sailor:profession('선원',['human','hugo'],['elf','selia']),
 rail:profession('철도원',['dwarf','otto'],['elf','luth']),
 aviator:profession('조종사',['human','iris'],['elf','aira']),
};
export const FACILITY_PROFESSIONS={
 warehouse:'carrier',depot:'carrier',logistics:'carrier',station:'rail',airdock:'aviator',
 well:'farmer',field:'farmer',cottonfield:'farmer',herbgarden:'farmer',reservoir:'farmer',
 stable:'rancher',henhouse:'rancher',dock:'fisher',
 lumber:'lumber',sawmill:'lumber',
 mill:'baker',bakery:'baker',confectionery:'baker',smokehouse:'baker',cannery:'baker',
 quarry:'miner',ironmine:'miner',coalpit:'miner',coppermine:'miner',
 workshop:'engineer',steamworks:'engineer',smelter:'smith',mithrilforge:'smith',blastfurnace:'smith',
 kiln:'smith',glassworks:'glass',cementworks:'smith',wiremill:'engineer',weaver:'textile',tailor:'textile',
 generator:'engineer',windturbine:'engineer',oilpump:'engineer',refinery:'engineer',chemical:'engineer',
 electronics:'engineer',automotive:'engineer',battery:'engineer',shipyard:'engineer',assemblyline:'engineer',watermill:'engineer',
 clinic:'medic',laboratory:'medic',hospital:'medic',
 magetower:'mage',manaextractor:'mage',arcanepower:'mage',leyrelay:'mage',lampworks:'mage',engineworks:'mage',wardpost:'mage',
 bank:'merchant',marketplace:'merchant',parliament:'administrator',exchange:'merchant',barracks:'guard',fortress:'guard',
 roadhub:'carrier',pavedhub:'carrier',snowmobile:'carrier',ferrydock:'sailor',canaldock:'sailor',streamdock:'sailor',
 riverport:'sailor',lakeport:'sailor',coastport:'sailor',polarferry:'sailor',polarport:'sailor',railterminal:'rail',airport:'aviator',airterminal:'aviator',substation:'engineer',
 // Expansion 2026-09-29. Pond, pasture and clover are ground, not workplaces, so they have no staff.
 sugarfield:'farmer',saltfield:'farmer',vineyard:'farmer',cocoafarm:'farmer',berryfield:'farmer',mintfield:'farmer',pumpkinpatch:'farmer',oakfarm:'lumber',
 winery:'baker',chocolatier:'baker',sheeppen:'rancher',milkbarn:'rancher',apiary:'rancher',duckhouse:'rancher',feedmill:'farmer',
 sandpit:'miner',clayfield:'miner',packshop:'carrier',solarpanel:'engineer',
 // Second expansion 2026-09-30.
 shallowmine:'miner',windpump:'farmer',
};
const TITLES={bakery:'제빵사',confectionery:'제과사',mill:'제분사',smokehouse:'훈제사',cannery:'식품 가공사',
 lumber:'벌목꾼',sawmill:'목공',quarry:'채석공',ironmine:'광부',coalpit:'광부',coppermine:'광부',
 smelter:'제철공',mithrilforge:'제련공',blastfurnace:'제철공',weaver:'직조공',tailor:'봉제공',
 dock:'어부',clinic:'치료사',hospital:'의료진',laboratory:'연구원',
 winery:'양조사',chocolatier:'초콜릿 장인',apiary:'양봉가',feedmill:'사료공',sandpit:'채굴공',clayfield:'채굴공',packshop:'포장공',shallowmine:'광부'};

export function facilityStaff(sim,building){
 const key=FACILITY_PROFESSIONS[building?.type],job=PROFESSIONS[key];
 if(!job||building.health<=0)return null;
 const [race,appearance]=job[factionOf(sim.race)==='elf'?'elf':'human'];
 const identity=residentLook(race,0,appearance);
 const production=productionVisualState(building.type,building,sim);
 const working=building.enabled!==false&&(production?production.working||production.active:!!building.working);
 // Stand beside the facility's fixed south-east work apron. They face their
 // workplace in world space, so all four camera angles select the right view.
 return {id:-100000-building.id,buildingId:building.id,race,appearance,name:identity.name,
  gender:identity.gender,profession:key,jobTitle:TITLES[building.type]||job.name,
  workplace:building.type,x:building.x+.46,z:building.z+.42,dir:Math.PI*1.25,
  working,walking:false,phase:'idle',task:null,staff:true,
  duty:building.enabled===false?'가동 중지':working?'작업 중':building.status||'대기'};
}
export const facilityRoster=sim=>sim.buildings.map(b=>facilityStaff(sim,b)).filter(Boolean);
