import {WORLD_PLOTS,PROVINCES} from './territory.js';
import {NATIONS} from './world.js';
import {WORLD_CELLS,COLS,ROWS,WATER_KINDS} from './world-grid.js';
import {MAJOR_ROUTES,tradeProvince} from './trade-routes.js';

export const transportMode=t=>t?.type==='airterminal'?'air':t?.type==='railterminal'?'rail':t?.scale==='port'?'ship':'road';
export const MODE_NAMES={road:'도로 운송',ship:'수운·육상 환적',rail:'간선 철도·육상 환적',air:'항공 운송'};
export const MODE_FUEL={road:'fuel',ship:'fuel',rail:'coal',air:'jetfuel'};
const key=(x,z)=>z*COLS+x,terrain=new Map(WORLD_CELLS.map(c=>[key(c.cx,c.cz),c.terrain])),corridor=new Set(),cache=new Map();
for(const r of MAJOR_ROUTES)for(let i=1;i<r.points.length;i++){
 const a=r.points[i-1].map(v=>v/26-.5),b=r.points[i].map(v=>v/26-.5),steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*4);
 for(let j=0;j<=steps;j++)corridor.add(key(Math.round(a[0]+(b[0]-a[0])*j/steps),Math.round(a[1]+(b[1]-a[1])*j/steps)));
}
function routeTree(from,mode){
 const start=key(...from.cell),dist=new Map([[start,0]]),prev=new Map(),open=new Set([start]);
 while(open.size){let at=null,best=Infinity;for(const n of open)if(dist.get(n)<best){at=n;best=dist.get(n);}open.delete(at);
  const x=at%COLS,z=Math.floor(at/COLS);
  for(const [a,b] of [[x+1,z],[x-1,z],[x,z+1],[x,z-1]]){if(a<0||b<0||a>=COLS||b>=ROWS)continue;const n=key(a,b),t=terrain.get(n),wet=WATER_KINDS.includes(t);
   if(mode!=='ship'&&(t==='coast'||t==='lake'))continue;
   // Rivers have bridge crossings; mountains use slower passes. Sea and lake crossings require shipping.
   const cost=mode==='ship'?(wet?.65:3):mode==='rail'?(corridor.has(n)?.5:t==='mountain'?4:wet?3:1.7):t==='mountain'?3:wet?2:corridor.has(n)?.8:1;
   const next=best+cost;if(next<(dist.get(n)??Infinity)){dist.set(n,next);prev.set(n,at);open.add(n);}
  }
 }
 return {start,dist,prev};
}
const trees=new Map();
export function tradeJourneyTo(s,terminal,destinationId){
 const from=WORLD_PLOTS.find(p=>p.id===tradeProvince(s))||PROVINCES.find(p=>p.nation===s.nation),city=PROVINCES.find(p=>p.id===destinationId)||WORLD_PLOTS.find(p=>p.id===destinationId),mode=transportMode(terminal);
 if(!city)return null;const id=from.id+':'+mode;if(mode!=='air'&&!trees.has(id))trees.set(id,routeTree(from,mode));
 const tree=trees.get(id),end=key(...city.cell),worldRoute=[];let cost;
 if(mode==='air'){worldRoute.push([...from.cell],[...city.cell]);cost=Math.hypot(from.cell[0]-city.cell[0],from.cell[1]-city.cell[1])*.45;}
 else{cost=tree.dist.get(end);if(cost===undefined)return null;for(let n=end;n!==undefined;n=tree.prev.get(n))worldRoute.unshift([n%COLS,Math.floor(n/COLS)]);}
 return {destinationId:city.id,destination:city.name,distance:mode==='air'?Math.ceil(cost/.45):worldRoute.length-1,worldRoute,mode,fuelItem:MODE_FUEL[mode],duration:Math.max(2,Math.ceil(1+cost*.5)),fuel:Math.max(1,Math.ceil(cost/12))};
}
export function tradeDestinations(s,terminal){
 const from=WORLD_PLOTS.find(p=>p.id===tradeProvince(s))||PROVINCES.find(p=>p.nation===s.nation),mode=transportMode(terminal),id=from.id+':'+mode;
 if(cache.has(id))return cache.get(id);
 const tree=mode==='air'?null:routeTree(from,mode),cities=[];
 for(const city of PROVINCES.filter(p=>p.developed&&NATIONS[p.nation]?.playable&&p.id!==from.id)){
  const end=key(...city.cell),worldRoute=[];let cost;
  if(mode==='air'){worldRoute.push([...from.cell],[...city.cell]);cost=Math.hypot(from.cell[0]-city.cell[0],from.cell[1]-city.cell[1])*.45;}
  else{cost=tree.dist.get(end);if(cost===undefined)continue;for(let n=end;n!==undefined;n=tree.prev.get(n))worldRoute.unshift([n%COLS,Math.floor(n/COLS)]);}
  const distance=mode==='air'?Math.ceil(cost/.45):worldRoute.length-1;
  cities.push({destinationId:city.id,destination:city.name,distance,worldRoute,mode,fuelItem:MODE_FUEL[mode],duration:Math.max(2,Math.ceil(1+cost*.5)),fuel:Math.max(1,Math.ceil(cost/12))});
 }
 cities.sort((a,b)=>a.duration-b.duration||a.distance-b.distance);cache.set(id,cities);return cities;
}
export function tradeJourney(s,terminal){const cities=tradeDestinations(s,terminal);return cities.find(c=>c.destinationId===s.tradeDestination)||cities[0]||{destination:'교역 도시 연결 없음',distance:0,duration:0,fuel:1,fuelItem:MODE_FUEL[transportMode(terminal)],mode:transportMode(terminal),worldRoute:[]};}
export function chooseTradeDestination(s,id){if(!PROVINCES.some(p=>p.id===id&&p.developed&&NATIONS[p.nation]?.playable))return {ok:false,error:'교역할 수 없는 도시입니다'};s.tradeDestination=id;s.revision++;return {ok:true};}

export function worldLegMode(journey,progress){if(journey.mode==='air')return 'air';const route=journey.worldRoute||[],p=route[Math.min(route.length-1,Math.max(0,Math.floor(progress*(route.length-1))))];if(!p)return 'road';const k=key(...p);return journey.mode==='ship'&&WATER_KINDS.includes(terrain.get(k))?'ship':journey.mode==='rail'&&corridor.has(k)?'rail':'road';}

// City demand is stable for a town/day; quotes and dispatched payments use this same factor.
const hash=text=>[...text].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0);
export function destinationMarket(s,item,journey=tradeJourney(s,s.tradeConnection())){
 const cities=tradeDestinations(s,s.tradeConnection()),base=cities[0];if(!base||journey.destinationId===base.destinationId)return {factor:1,demand:1,distanceBonus:0};
 const demand=.9+(hash(journey.destinationId+':'+item+':'+Math.floor(s.day/5))%7)*.05;
 const distanceBonus=Math.min(.3,Math.max(0,journey.distance-base.distance)*.008);
 return {factor:demand+distanceBonus,demand,distanceBonus};
}
