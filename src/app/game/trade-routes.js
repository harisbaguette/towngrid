// World trade network. A province joins it over land (it sits on a major road, or a small road
// leads to one) and through each kind of water it touches: sea coast, river, lake, canal, stream
// or small waterway. The connection a site sells through caps how many goods one export shipment
// may carry and adjusts the price.
import {MAINLAND,INLAND_SEA,NATIONS} from './world.js';
import {PROVINCES} from './territory.js';

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

const outline=d=>{const n=d.match(/-?\d+(?:\.\d+)?/g).map(Number);return Array.from({length:n.length/2},(_,i)=>[n[2*i],n[2*i+1]]);};
const closed=line=>[...line,line[0]];
const COAST=closed(outline(MAINLAND)),SHORE=closed(outline(INLAND_SEA));
const ellipse=(c,rx,ry)=>closed(Array.from({length:24},(_,i)=>[Math.round(c[0]+rx*Math.cos(i*Math.PI/12)),Math.round(c[1]+ry*Math.sin(i*Math.PI/12))]));
// The ocean lane is traced about 25px off the painted coast of irdea-terrain.webp.
const OFFSHORE=[[30,250],[25,340],[40,420],[80,490],[130,560],[210,630],[290,690],[380,730],[480,750],[580,758],[680,748],[790,752],[880,732],[960,705],[1040,672],[1110,637],[1190,592],[1255,532],[1290,440],[1295,350],[1280,260],[1240,195],[1170,145],[1070,95],[960,55],[840,35],[720,30],[600,20],[480,20],[370,35],[260,50],[150,80],[85,125],[45,185],[30,250]];

/** Land roads. Provinces off these roads reach the nearest one by a small rural or mountain road. */
export const MAJOR_ROUTES=[
 {id:'silk-road',kind:'silk',name:'대륙 비단길',points:[[95,290],[228,217],[359,186],[467,151],[560,140],[640,135],[738,133],[848,207],[939,172],[1039,230],[1105,316],[1200,320]]},
 {id:'west-highway',kind:'paved',name:'서부 왕도',points:[[95,345],[202,341],[300,330],[389,315],[512,267],[590,235]]},
 {id:'south-highway',kind:'paved',name:'남부 제국대로',points:[[389,315],[324,418],[422,475],[495,520],[566,549],[612,556],[642,560],[690,572],[724,646],[800,640],[865,613],[975,527],[1108,461],[1158,396]]},
 {id:'east-highway',kind:'paved',name:'동부 종단로',points:[[939,172],[970,260],[997,335],[942,439],[975,527],[1037,564]]}
];

/** Water a port can stand on. The coasts and the four great rivers follow the painted atlas; the
 *  lakes, canals, streams and small waterways are drawn on top of it by the atlas (WorldAtlas.tsx). */
export const WATERWAYS=[
 {id:'ocean-lane',kind:'coast',name:'대양',port:'대양 연안항',joins:'대양 환상 항로',line:COAST,lane:OFFSHORE},
 {id:'glass-lane',kind:'coast',name:'유리 내해',port:'유리 내해 연안항',joins:'유리 내해 항로',line:SHORE,lane:[[640,240],[700,265],[745,310],[750,370],[760,430],[740,490],[700,520],[660,490],[630,440],[610,380],[605,310],[615,265],[640,240]]},
 {id:'river-eungyeol',kind:'river',name:'은결강',line:[[276,208],[304,222],[303,250],[286,278],[300,296],[335,305],[370,322],[400,342],[450,347],[500,352],[550,362]]},
 {id:'river-harden',kind:'river',name:'하르덴강',line:[[593,48],[583,70],[582,88],[607,108],[616,127],[608,147],[620,163],[630,181],[628,203],[637,222]]},
 {id:'river-belu',kind:'river',name:'벨루강',line:[[790,345],[825,339],[865,342],[905,355],[935,370],[975,380],[1015,377],[1050,365],[1090,357],[1130,360],[1170,367],[1205,380],[1228,386]]},
 {id:'river-lumen',kind:'river',name:'루멘강',line:[[682,518],[660,540],[640,560],[623,583],[620,607],[637,627],[647,647],[643,667],[650,690]]},
 {id:'lake-mirror',kind:'lake',name:'거울 호수',center:[252,392],line:ellipse([252,392],24,14)},
 {id:'lake-moon',kind:'lake',name:'달빛 호수',center:[440,560],line:ellipse([440,560],30,16)},
 {id:'lake-high',kind:'lake',name:'높은 호수',center:[410,215],line:ellipse([410,215],18,11)},
 {id:'lake-obsidian',kind:'lake',name:'흑요 호수',center:[890,250],line:ellipse([890,250],20,12)},
 {id:'lake-reed',kind:'lake',name:'갈대 호수',center:[893,440],line:ellipse([893,440],16,10)},
 {id:'lake-cloud',kind:'lake',name:'구름 호수',center:[1045,300],line:ellipse([1045,300],20,12)},
 {id:'canal-royal',kind:'canal',name:'왕도 운하',line:[[452,348],[447,400],[438,450],[438,544]]},
 {id:'canal-east',kind:'canal',name:'동부 운하',line:[[1090,357],[1098,405],[1135,445],[1175,505]]},
 {id:'canal-broden',kind:'canal',name:'브로덴 운하',line:[[622,598],[575,612],[520,618],[470,572]]},
 {id:'stream-willow',kind:'stream',name:'버들내',line:[[412,226],[405,262],[412,300],[402,342]]},
 {id:'stream-obsidian',kind:'stream',name:'흑요내',line:[[892,262],[880,300],[895,330],[905,355]]},
 {id:'stream-cloud',kind:'stream',name:'구름내',line:[[1060,200],[1055,245],[1045,288]]},
 {id:'stream-silver',kind:'stream',name:'은빛내',line:[[755,112],[738,160],[718,205],[700,245]]},
 {id:'stream-meadow',kind:'stream',name:'초원내',line:[[878,442],[845,452],[812,460],[792,452]]},
 {id:'stream-mirror',kind:'stream',name:'거울내',line:[[262,379],[268,335],[287,290]]},
 {id:'stream-tide',kind:'stream',name:'갯내',line:[[232,400],[190,430],[150,455],[118,470]]},
 {id:'stream-south',kind:'stream',name:'남내',line:[[900,450],[930,490],[955,540],[990,585],[1015,640]]},
 {id:'ferry-willow',kind:'ferry',name:'버들 수로',line:[[410,560],[385,578],[360,585]]},
 {id:'ferry-stone',kind:'ferry',name:'돌 수로',line:[[424,207],[450,190],[470,170]]},
 {id:'ferry-rock',kind:'ferry',name:'바위 수로',line:[[647,647],[675,650],[705,655]]},
 {id:'ferry-pine',kind:'ferry',name:'솔 수로',line:[[905,240],[925,215],[940,190]]},
 {id:'ferry-field',kind:'ferry',name:'들 수로',line:[[270,400],[300,420],[320,440]]}
];

function nearestOnLine(p,line){let best={d:Infinity,at:line[0],s:0},s=0;for(let i=0;i+1<line.length;i++){const a=line[i],b=line[i+1],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/((dx*dx+dy*dy)||1))),q=[a[0]+dx*t,a[1]+dy*t],d=Math.hypot(p[0]-q[0],p[1]-q[1]);if(d<best.d)best={d,at:q.map(Math.round),s:s+len*t};s+=len;}return {...best,length:s};}
const DIRECT=30,COASTAL_TOUCH=90,TOUCH={coast:38,river:30,lake:25,canal:24,stream:22,ferry:20};
// A river end that meets the ocean or the inland sea is a mouth; the stretch near it is the estuary.
const MOUTH_REACH=45,MOUTH_ZONE=70,seaAt=p=>Math.min(nearestOnLine(p,COAST).d,nearestOnLine(p,SHORE).d)<=MOUTH_REACH;
for(const w of WATERWAYS)if(w.kind==='river')w.mouths=[seaAt(w.line[0]),seaAt(w.line[w.line.length-1])];
function terrainAt(w,r){if(w.kind!=='river')return {coast:'바다 해안',lake:'호수',canal:'운하',stream:'하천',ferry:'작은 수로'}[w.kind];return (w.mouths[0]&&r.s<=MOUTH_ZONE)||(w.mouths[1]&&r.length-r.s<=MOUTH_ZONE)?'강 하구':'강 중상류';}
const portName=(w,terrain)=>w.port||{river:`${w.name} ${terrain==='강 하구'?'하구':'중상류'} 항구`,lake:w.name+' 항',canal:w.name+' 선착장',stream:w.name+' 선착장',ferry:w.name+' 나룻터'}[w.kind];

function connectionsOf(p){
 const options=[],region=NATIONS[p.nation].region;
 // Two routes of the same kind would offer the same deal, so only the nearest one counts.
 const land=MAJOR_ROUTES.map(r=>({r,...nearestOnLine(p.point,r.points)})).sort((a,b)=>a.d-b.d);
 for(const {r,d,at} of land)if(d<=DIRECT&&!options.some(o=>o.kind===r.kind))options.push({id:r.id,kind:r.kind,terrain:'큰길',name:r.name,joins:r.name,line:r.points,from:p.point,to:at,price:ROUTE_KINDS[r.kind].price});
 if(!options.length){const {r,at}=land[0],kind=region==='highland'?'mountain':'rural';options.push({id:'minor:'+p.id,kind,terrain:kind==='mountain'?'산길':'시골길',name:p.name+' '+ROUTE_KINDS[kind].name,joins:r.name,line:r.points,from:p.point,to:at,price:ROUTE_KINDS[kind].price*ROUTE_KINDS[r.kind].price});}
 const water=WATERWAYS.map(w=>({w,...nearestOnLine(p.point,w.line)})).sort((a,b)=>a.d-b.d);
 for(const r of water){const {w}=r;if(options.some(o=>o.kind===w.kind)||r.d>(w.kind==='coast'&&region==='coast'?COASTAL_TOUCH:TOUCH[w.kind]))continue;const terrain=terrainAt(w,r);options.push({id:w.id,kind:w.kind,terrain,name:portName(w,terrain),joins:w.joins||w.name,line:w.lane||w.line,from:p.point,to:r.at,price:ROUTE_KINDS[w.kind].price});}
 return options.map(o=>({...o,scale:ROUTE_KINDS[o.kind].scale,capacity:ROUTE_KINDS[o.kind].capacity,price:+o.price.toFixed(3)})).sort((a,b)=>b.capacity*b.price-a.capacity*a.price);
}
export const TRADE_CONNECTIONS=Object.fromEntries(PROVINCES.map(p=>[p.id,connectionsOf(p)]));
/** Links drawn on the atlas from a province to the road or water it uses. A coastal province is
 *  its own sea port, so coast links are left out. */
export const TRADE_LINKS=Object.values(TRADE_CONNECTIONS).flat().filter(o=>o.kind!=='coast'&&Math.hypot(o.from[0]-o.to[0],o.from[1]-o.to[1])>=6);

export const tradeProvince=s=>{const id=s.campaign?.sites.find(v=>v.id===s.siteId)?.provinceId;return TRADE_CONNECTIONS[id]?id:(s.nation||'estern')+'-0';};
export const tradeOptions=s=>TRADE_CONNECTIONS[tradeProvince(s)];
/** The connection this site sells through: the player's choice if it still applies, else the best
 *  one. A choice saved before the map changed simply falls back. */
export function tradeConnection(s){const list=tradeOptions(s);return list.find(o=>o.id===s.tradeRoute)||list[0];}
export function chooseTradeRoute(s,id){if(!tradeOptions(s).some(o=>o.id===id))return {ok:false,error:'이 지역에서 닿지 않는 무역로입니다'};s.tradeRoute=id;s.revision++;return {ok:true};}
/** Largest lot one shipment can carry, and the smallest lot auto-sale waits for. */
export const tradeCapacity=s=>tradeConnection(s).capacity;
export const autoSaleLot=s=>Math.min(10,tradeCapacity(s));
