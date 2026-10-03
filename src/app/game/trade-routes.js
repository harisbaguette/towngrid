// World trade network. A province joins it over land (it sits on a major road, or a small road
// leads to one) and through each kind of water it touches: sea coast, river, lake, canal, stream
// or small waterway. Which of these a site can build export terminals and ports for, and the lot and
// price they give, is decided in trade-terminals.js.
import {PROVINCES,WORLD_PLOTS} from './territory.js';
import {WATERWAYS,TOUCH,WATER_KINDS,SIDES,nearestOnLine,layoutOf,waterwayAt} from './world-grid.js';
export {WATERWAYS};

export const ROUTE_KINDS={
 silk:{name:'비단길',scale:'major',capacity:30,price:1.12,note:'먼 나라 상인이 비싸게 삼'},
 paved:{name:'포장 무역로',scale:'major',capacity:40,price:1.04,note:'짐마차가 줄지어 다님'},
 rural:{name:'시골 무역로',scale:'minor',capacity:10,price:.94,note:'마을 길로 큰길까지 감'},
 mountain:{name:'산길',scale:'minor',capacity:8,price:.98,note:'노새 짐만큼만 넘김'},
 coast:{name:'바다 연안항',scale:'port',capacity:200,price:.97,note:'큰 배로 가장 많이 보냄'},
 river:{name:'강 항구',scale:'port',capacity:100,price:1,note:'강배로 많이 실어 나름'},
 lake:{name:'호수 항',scale:'port',capacity:100,price:.99,note:'호숫가 배가 모아 실어 감'},
 canal:{name:'운하 선착장',scale:'port',capacity:30,price:1.02,note:'잘 닦은 운하로 곧게 감'},
 stream:{name:'하천 선착장',scale:'port',capacity:30,price:.97,note:'작은 배가 내를 따라 내려감'},
 ferry:{name:'작은 수로 나룻터',scale:'port',capacity:10,price:.95,note:'나룻배 한 척만큼 보냄'}
};

/** Land roads, drawn in squares of the world grid. Provinces off these roads reach the nearest one by a
 *  small rural or mountain road. Two silk roads cross the continent between the harsh rim and the green
 *  ring — one along the frost line, one along the desert edge — and paved roads circle the Glass Sea. */
const road=(id,kind,name,squares)=>({id,kind,name,points:squares.map(([x,z])=>[(x+.5)*26,(z+.5)*26])});
export const MAJOR_ROUTES=[
 road('silk-north','silk','북방 비단길',[[2,8],[5,8],[8,5.5],[13,4.5],[18,4.5],[22,5],[26,5.5],[30,4.5],[33,5],[38,4],[43,5.5],[47,5.5],[49,5]]),
 road('silk-south','silk','남방 비단길',[[1,26],[6,26],[11,25.5],[17,26],[22,26.5],[26,26],[31,26],[35,25],[38,25]]),
 road('glass-ring','paved','내해 순환 대로',[[14,14],[17,11],[21,9],[26,9],[31,11],[34,13],[34,16],[33,19],[32,20],[30,23],[26,24],[22,22],[18,18],[14,14]]),
 road('west-highway','paved','서부 왕도',[[1,17.5],[5,17.5],[10,17],[14,14]]),
 road('east-highway','paved','동부 종단로',[[38,12],[41,14.5],[44,16],[44,19],[41,22],[39,22]])
];

const DIRECT=30;
// A river end that meets the sea is a mouth (world-grid.js); the stretch near it is the estuary.
const MOUTH_ZONE=70;
function terrainAt(w,r){if(w.kind!=='river')return {coast:'바다 해안',lake:'호수',canal:'운하',stream:'하천',ferry:'작은 수로'}[w.kind];return (w.mouths[0]&&r.s<=MOUTH_ZONE)||(w.mouths[1]&&r.length-r.s<=MOUTH_ZONE)?'강 하구':'강 중상류';}
const portName=(w,terrain)=>w.port||{river:`${w.name} ${terrain==='강 하구'?'하구':'중상류'} 항구`,lake:w.name+' 항',canal:w.name+' 선착장',stream:w.name+' 선착장',ferry:w.name+' 나룻터'}[w.kind];

function connectionsOf(p){
 const options=[],edges=Object.values(layoutOf(p.id).edges);
 // Two routes of the same kind would offer the same deal, so only the nearest one counts.
 const land=MAJOR_ROUTES.map(r=>({r,...nearestOnLine(p.point,r.points)})).sort((a,b)=>a.d-b.d);
 for(const {r,d,at} of land)if(d<=DIRECT&&!options.some(o=>o.kind===r.kind))options.push({id:r.id,kind:r.kind,terrain:'큰길',name:r.name,joins:r.name,line:r.points,from:p.point,to:at,price:ROUTE_KINDS[r.kind].price});
 if(!options.length){const {r,at}=land[0],kind=edges.includes('mountain')?'mountain':'rural';options.push({id:'minor:'+p.id,kind,terrain:kind==='mountain'?'산길':'시골길',name:p.name+' '+ROUTE_KINDS[kind].name,joins:r.name,line:r.points,from:p.point,to:at,price:ROUTE_KINDS[kind].price*ROUTE_KINDS[r.kind].price});}
 // Water comes from the sides of the local map: a side on the sea opens that sea's lane, a side on a
 // river that river, and so on. Small waterways run inside a square, so they go by distance.
 const [cx,cz]=layoutOf(p.id).cell,water=[];
 for(const [,dx,dz] of SIDES){const r=waterwayAt(cx+dx,cz+dz);if(r&&WATER_KINDS.includes(r.w.kind))water.push({...r,at:[(cx+dx+.5)*26,(cz+dz+.5)*26]});}
 for(const w of WATERWAYS.filter(w=>w.kind==='ferry')){const r=nearestOnLine(p.point,w.line);if(r.d<=TOUCH.ferry)water.push({w,...r});}
 for(const r of water){const {w}=r;if(options.some(o=>o.kind===w.kind))continue;const terrain=terrainAt(w,r);options.push({id:w.id,kind:w.kind,terrain,name:portName(w,terrain),joins:w.joins||w.name,line:w.lane||w.line,from:p.point,to:r.at,price:ROUTE_KINDS[w.kind].price});}
 return options.map(o=>({...o,scale:ROUTE_KINDS[o.kind].scale,capacity:ROUTE_KINDS[o.kind].capacity,price:+o.price.toFixed(3)})).sort((a,b)=>b.capacity*b.price-a.capacity*a.price);
}
export const TRADE_CONNECTIONS=Object.fromEntries(WORLD_PLOTS.map(p=>[p.id,connectionsOf(p)]));
/** Links drawn on the atlas from a province to the road or water it uses. A coastal province is
 *  its own sea port, so coast links are left out. */
export const TRADE_LINKS=PROVINCES.flatMap(p=>TRADE_CONNECTIONS[p.id]).filter(o=>o.kind!=='coast'&&Math.hypot(o.from[0]-o.to[0],o.from[1]-o.to[1])>=6);

export const tradeProvince=s=>{const id=s.campaign?.sites?.find(v=>v.id===s.siteId)?.provinceId||s.layout?.province;return TRADE_CONNECTIONS[id]?id:(s.nation||'estern')+'-0';};
export const tradeOptions=s=>TRADE_CONNECTIONS[tradeProvince(s)];
// The connection a site actually sells through is its active export terminal (trade-terminals.js).
