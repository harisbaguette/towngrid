// Trade terminals, special networks and special ground. Definitions only: simulation.js merges
// INFRA_BUILDINGS while it is still being evaluated, so this file must never import simulation.js.
// The rules that use these definitions live in trade-terminals.js.
import {RANKS} from './world.js';
import {tradeProvince} from './trade-routes.js';
import {layoutOf} from './world-grid.js';

// terminal: how many goods one shipment from this terminal may carry, and what it must be joined to.
//  via road|paved|rail|air: next to a road, paved road, railway or airport joined to the export road;
//  via snow: anywhere in an ice province.
//  water: the kind of water option (trade-routes.js) a port on the water sells through.
export const INFRA_BUILDINGS={
 roadhub:{name:'도로 물류 집하지',group:'transport',cost:120,materials:{wood:6},rank:0,terminal:{capacity:10,via:'road'},description:'무역로와 이어진 도로 옆에 짓습니다. 한 번에 10개를 보냅니다.'},
 pavedroad:{name:'포장 도로',group:'transport',cost:12,materials:{stone:1},rank:6,tile:true,description:'흙길 위에도 깔 수 있습니다. 주민과 수출 마차가 흙길보다 빠르게 다닙니다.'},
 pavedhub:{name:'포장 도로 물류센터',group:'transport',cost:600,materials:{plank:8,stone:10},rank:6,terminal:{capacity:30,via:'paved'},description:'무역로와 이어진 포장 도로 옆에만 짓습니다. 한 번에 30개를 보냅니다.'},
 snowmobile:{name:'스노모빌 집하지',group:'transport',cost:200,materials:{wood:8},rank:0,ice:true,terminal:{capacity:10,via:'snow'},description:'얼음 지역이면 도로 없이 어디든 짓습니다. 스노모빌이 눈길로 무역로까지 나릅니다. 한 번에 10개를 보냅니다.'},
 ferrydock:{name:'작은 수로 나룻터',group:'transport',cost:150,materials:{wood:8},rank:1,onWater:true,terminal:{capacity:10,water:'ferry'},description:'물 위에 짓습니다. 작은 물웅덩이에서도 됩니다. 한 번에 10개를 보냅니다.'},
 canaldock:{name:'운하 선착장',group:'transport',cost:400,materials:{plank:8,stone:4},rank:4,onWater:true,terminal:{capacity:30,water:'canal'},description:'운하가 닿는 지역의 넓은 물 위에 짓습니다. 한 번에 30개를 보냅니다.'},
 streamdock:{name:'하천 선착장',group:'transport',cost:400,materials:{plank:8,stone:4},rank:4,onWater:true,terminal:{capacity:30,water:'stream'},description:'하천이 닿는 지역의 넓은 물 위에 짓습니다. 한 번에 30개를 보냅니다.'},
 riverport:{name:'강 항구',group:'transport',cost:1200,materials:{plank:14,stone:12},rank:9,onWater:true,terminal:{capacity:100,water:'river'},description:'큰 강이 닿는 지역의 넓은 물 위에 짓습니다. 한 번에 100개를 보냅니다.'},
 lakeport:{name:'호수 항',group:'transport',cost:1200,materials:{plank:14,stone:12},rank:9,onWater:true,terminal:{capacity:100,water:'lake'},description:'호수가 닿는 지역의 넓은 물 위에 짓습니다. 한 번에 100개를 보냅니다.'},
 coastport:{name:'바다 연안항',group:'transport',cost:2400,materials:{plank:20,stone:20,gear:4},rank:11,onWater:true,terminal:{capacity:200,water:'coast'},description:'바다가 닿는 지역의 넓은 물 위에 짓습니다. 한 번에 200개를 보냅니다.'},
 polarferry:{name:'작은 극지 수로 나룻터',group:'transport',cost:150,materials:{wood:8},rank:1,onWater:true,ice:true,terminal:{capacity:10,water:'polar',price:.93},description:'얼음 지역의 물 위에 짓습니다. 한 번에 10개를 보냅니다.'},
 polarport:{name:'극지 항',group:'transport',cost:700,materials:{plank:10,stone:8},rank:4,onWater:true,ice:true,terminal:{capacity:30,water:'polar',price:.96},description:'얼음 지역의 넓은 물 위에 짓습니다. 한 번에 30개를 보냅니다.'},
 railterminal:{name:'철도 터미널',group:'transport',cost:2600,materials:{steel:10,brick:8},rank:18,terminal:{capacity:100,via:'rail',price:1.03},description:'무역로와 이어진 철로 옆에만 짓습니다. 한 번에 100개를 보냅니다.'},
 airport:{name:'공항',group:'transport',cost:6000,materials:{concrete:12,steel:10},rank:21,unique:true,description:'공항 터미널을 지을 수 있는 특수 시설입니다. 무역로와 이어진 도로나 철로 옆에 짓습니다.'},
 airterminal:{name:'공항 터미널',group:'transport',cost:3000,materials:{concrete:6,steel:6,circuit:2},rank:21,terminal:{capacity:100,via:'air',price:1.1},description:'공항 바로 옆, 무역로와 이어진 도로나 철로 옆에 짓습니다. 한 번에 100개를 보냅니다.'},
 pipe:{name:'송유·송수관',group:'energy',cost:10,materials:{brick:1},rank:11,tile:true,carries:['water','oil','fuel'],description:'관에 닿은 시설끼리 물·원유·연료를 주민 없이 주고받습니다. 창고에 닿으면 창고와도 주고받습니다.'},
 substation:{name:'변전소',group:'energy',cost:400,materials:{plank:6,gear:2},rank:11,description:'발전소나 다른 변전소에서 여섯 칸 안에 지으면 주변 여섯 칸까지 전기를 보냅니다.'},
 conveyor:{name:'광물 컨베이어',group:'industry',cost:16,materials:{plank:1},rank:13,tile:true,mountain:true,carries:['stone','iron','coal','copper'],description:'산악 지역 전용. 벨트에 닿은 시설끼리 석재·광석·석탄을 주민 없이 주고받습니다.'}
};
for(const [type,d] of Object.entries(INFRA_BUILDINGS))if(!RANKS[d.rank].unlocks.includes(type))RANKS[d.rank].unlocks.push(type);

// Special ground comes from the world grid (world-grid.js): an ice or desert square is ice or sand all
// over, and a mountain, ice or desert square beside it lays a band of that ground along that side.
/** What a province's site offers: ice or desert ground, and a mountain side for conveyors. */
export function zoneOf(id){
 const l=layoutOf(id);
 return zoneOfLayout(l);
}
const zoneOfLayout=l=>({ice:l?.biome==='ice',desert:l?.biome==='desert',mountain:!!l&&Object.values(l.edges).includes('mountain')});
export const provinceZone=s=>zoneOfLayout(s.layout||layoutOf(tradeProvince(s)));
export const ZONE_NAMES={ice:'얼음 지대',desert:'사막',mountain:'산악 지대'};
/** 'water' | 'mountain' | 'ice' | 'sand' | 'plain'. */
export function groundAt(s,x,z){
 const t=s.tile(x,z);if(!t)return null;return t.terrain==='water'?'water':t.ground||'plain';
}
export const GROUND_NAMES={mountain:'산',ice:'얼음',sand:'모래',plain:'평지',water:'물'};
const MINES=['quarry','ironmine','coalpit','coppermine'];
/** Production factor of the ground under a building: dry sand and ice slow farms and wells, a
 *  mountain helps mines, sand helps oil. */
export function groundFactor(s,type,x,z,irrigable){
 const g=groundAt(s,x,z);
 if(g==='sand')return irrigable?.7:type==='well'?.6:type==='oilpump'?1.25:1;
 if(g==='ice')return irrigable?.6:type==='well'?.8:1;
 if(g==='mountain')return MINES.includes(type)?1.25:1;
 return 1;
}
