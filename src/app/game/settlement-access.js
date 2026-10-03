import {NATIONS} from './world.js';
import {WORLD_PLOTS,PROVINCES,PLOT_INDEX,sovereignOf} from './territory.js';
import {layoutOf,terrainOfCell,WATER_KINDS} from './world-grid.js';

export const LAND_RESTRICTIONS={
 royal:{name:'왕실 직할지',reason:'왕실 직할지 · 정착 허가 없음'},
 military:{name:'군사 구역',reason:'군사 구역 · 민간 정착 금지'},
 reserve:{name:'보호구역',reason:'보호구역 · 개간 금지'}
};
const cellOwners=new Map(PROVINCES.flatMap(p=>p.cells.map(c=>[c.join(','),p.nation])));
export const PLOT_RESTRICTIONS=new Map();
for(const nation of Object.keys(NATIONS)){
 const capital=PLOT_INDEX.get(nation+'-0'),plots=WORLD_PLOTS.filter(p=>p.nation===nation&&p.territoryId&&!p.developed);
 const count=Math.max(1,Math.floor(plots.length*.2)),distance=p=>Math.hypot(p.cell[0]-capital.cell[0],p.cell[1]-capital.cell[1]);
 const scores={royal:p=>distance(p),military:p=>distance(p)*.05-[[1,0],[-1,0],[0,1],[0,-1]].filter(([x,z])=>cellOwners.get([p.cell[0]+x,p.cell[1]+z].join(','))!==nation).length*4,reserve:p=>distance(p)};
 // Compact protected parcels around the crown, frontier and existing natural habitats.
 // Original named centres remain usable by saved games and established scenario locations.
 for(let i=0;i<count;i++){
  let kind=['royal','military','reserve'][i%3];
  let candidates=plots.filter(p=>!PLOT_RESTRICTIONS.has(p.id)&&(kind!=='reserve'||['forest','marsh'].includes(layoutOf(p.id).ecology)));
  if(!candidates.length){kind='royal';candidates=plots.filter(p=>!PLOT_RESTRICTIONS.has(p.id));}
  const p=candidates.sort((a,b)=>scores[kind](a)-scores[kind](b)||a.id.localeCompare(b.id))[0];
  if(p)PLOT_RESTRICTIONS.set(p.id,kind);
 }
}
export const restrictionOf=id=>LAND_RESTRICTIONS[PLOT_RESTRICTIONS.get(id)]||null;
export function startBlockReason(nation,id){
 const p=PLOT_INDEX.get(id);if(!p)return '시작할 부지를 선택하세요';
 const terrain=terrainOfCell(...p.cell);
 if(terrain==='mountain'||WATER_KINDS.includes(terrain))return '산·수역 · 정착 불가';
 if(p.nation===null)return '무주지 · 성장 후 개척';
 if(p.nation!==nation)return '다른 국가의 땅입니다';
 if(!NATIONS[nation]?.playable)return '적대 세력 · 시작 불가';
 if(p.developed)return p.capital?'수도권 · 시작 불가':'기존 정착지 · 시작 불가';
 return restrictionOf(id)?.reason||null;
}
/** Every ecology can be inspected and settled, either domestically or on the frontier. */
export function biomeCandidates(ecology,preferredNation,sites=[],owners={}){
 return WORLD_PLOTS.filter(p=>layoutOf(p.id).ecology===ecology&&!p.developed&&!restrictionOf(p.id)&&!sites.some(s=>s.provinceId===p.id)&&(p.nation?NATIONS[p.nation]?.playable:sovereignOf(p.id,owners)===null))
  .sort((a,b)=>(a.nation===preferredNation?0:a.nation?1:2)-(b.nation===preferredNation?0:b.nation?1:2));
}
