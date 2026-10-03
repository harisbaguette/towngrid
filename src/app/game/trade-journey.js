import {WORLD_PLOTS,PROVINCES} from './territory.js';
import {NATIONS} from './world.js';
export function tradeJourney(s,terminal){
 const from=WORLD_PLOTS.find(p=>p.id===s.provinceId)||PROVINCES.find(p=>p.nation===s.nation);
 const cities=PROVINCES.filter(p=>p.developed&&NATIONS[p.nation]?.playable&&p.id!==from?.id);
 const distance=p=>Math.max(1,Math.abs((from?.cell[0]||0)-p.cell[0])+Math.abs((from?.cell[1]||0)-p.cell[1]));
 const destination=cities.sort((a,b)=>distance(a)-distance(b))[0]||PROVINCES.find(p=>p.nation===s.nation&&p.capital);
 const tiles=destination?distance(destination):6;
 const factor=terminal?.type==='airterminal'?.45:terminal?.type==='railterminal'?.65:terminal?.scale==='port'?.8:1;
 return {destination:destination?.name||'인근 교역 도시',distance:tiles,duration:Math.ceil((1+tiles*.5)*factor),fuel:Math.max(1,Math.ceil(tiles/12))};
}
