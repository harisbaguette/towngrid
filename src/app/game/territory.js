import {NATIONS} from './world.js';
import {WORLD_MAP,MAP_COLS,MAP_ROWS,CAPITALS} from './world-map.js';
// Provinces are squares of the world map (world-map.js). Each nation has a capital square and five more
// around it — north, east, south, west, and one outward toward the rim — and holds the land squares
// nearer to one of its provinces than to any other, up to TERRITORY_REACH squares away.
const CELL=26,TERRITORY_REACH=4.5;
const names=['수도권','북부 구릉','동부 유역','남부 평원','서부 산림','외곽 개척지'];
const at=(x,z)=>x>=0&&z>=0&&x<MAP_COLS&&z<MAP_ROWS?WORLD_MAP[z][x]:'~';
const SITE_GROUND='.fd*',siteGround=(x,z)=>SITE_GROUND.includes(at(x,z));
// Landmasses: squares joined by anything but the sea.
const MASS=new Map();
for(let z=0,id=0;z<MAP_ROWS;z++)for(let x=0;x<MAP_COLS;x++){if(at(x,z)==='~'||MASS.has(x+','+z))continue;const stack=[[x,z]];MASS.set(x+','+z,++id);
 while(stack.length){const [a,b]=stack.pop();for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const k=(a+dx)+','+(b+dz);if(at(a+dx,b+dz)!=='~'&&!MASS.has(k)){MASS.set(k,id);stack.push([a+dx,b+dz]);}}}}
const NATION_IDS=Object.keys(NATIONS),CENTER=[MAP_COLS/2,MAP_ROWS/2];
const DIRS=[null,[0,-1],[1,0],[0,1],[-1,0]];
const taken=new Map(),cells=NATION_IDS.map(()=>[]);
for(const [i,id] of NATION_IDS.entries()){const [x,z]=CAPITALS[id];if(!siteGround(x,z)||taken.has(x+','+z))throw new Error('bad capital square for '+id);taken.set(x+','+z,i);cells[i][0]=[x,z];}
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
// Provinces are handed out in turns so neighbouring nations share the land between them fairly.
for(let j=1;j<6;j++)for(const [i,id] of NATION_IDS.entries()){
 const cap=CAPITALS[id],out=[cap[0]-CENTER[0],cap[1]-CENTER[1]],len=Math.hypot(...out)||1;
 const target=j<5?[cap[0]+DIRS[j][0]*2.5,cap[1]+DIRS[j][1]*2.5]:[cap[0]+out[0]/len*3.5,cap[1]+out[1]/len*3.5];
 let best=null,score=Infinity;
 for(let z=0;z<MAP_ROWS;z++)for(let x=0;x<MAP_COLS;x++){
  if(!siteGround(x,z)||taken.has(x+','+z)||Math.max(Math.abs(x-cap[0]),Math.abs(z-cap[1]))>5)continue;
  const c=[x,z],own=dist(c,cap),foreign=NATION_IDS.some((o,k)=>k!==i&&dist(c,CAPITALS[o])<own);
  const v=dist(c,target)+(foreign?3:0)+(MASS.get(x+','+z)===MASS.get(cap.join(','))?0:4)+own*.01;
  if(v<score){score=v;best=c;}
 }
 if(!best)throw new Error('no square for '+id+'-'+j);
 taken.set(best.join(','),i);cells[i][j]=best;
}
export const PROVINCES=NATION_IDS.flatMap((nation,i)=>cells[i].map((cell,j)=>({id:nation+'-'+j,nation,name:NATIONS[nation].capital+' '+names[j],cell,point:[(cell[0]+.5)*CELL,(cell[1]+.5)*CELL],cells:[],capital:j===0,resource:['grain','iron','water','wood','mana','oil'][(i+j)%6]})));
// Territory: every land square goes to the nearest province within reach; farther land is wild.
for(let z=0;z<MAP_ROWS;z++)for(let x=0;x<MAP_COLS;x++){if(at(x,z)==='~')continue;let best=null,d=TERRITORY_REACH;
 for(const p of PROVINCES){const v=dist([x,z],p.cell);if(v<=d&&(v<d||!best)){best=p;d=v;}}
 best?.cells.push([x,z]);}
/** An SVG path covering a list of squares. */
export const cellsPath=list=>list.map(([x,z])=>`M${x*CELL} ${z*CELL}h${CELL}v${CELL}h-${CELL}Z`).join('');
export function initializeTerritory(c){c.provinces??=Object.fromEntries(PROVINCES.map(p=>[p.id,{owner:p.nation}]));for(const site of c.sites)site.provinceId??=site.nation+'-'+((+site.id.split('-')[1]-1)%6);}
export function tradeConditions(c,siteId){
 const site=c.sites.find(v=>v.id===siteId);if(!site)return {market:1,toll:0,owner:null};
 const owner=c.provinces?.[site.provinceId]?.owner||site.nation,state=c.newStates.find(v=>v.id===owner);
 if(!state)return {market:1,toll:0,owner};
 return {market:state.pact?1.12:state.relation>=55?1.06:state.relation<20?.8:.93,toll:state.pact?0:state.relation>=55?3:12,owner,name:state.name,closed:state.relation<15};
}
export function splitTerritory(c,parent,state){
 initializeTerritory(c);const owned=PROVINCES.filter(p=>c.provinces[p.id].owner===parent&&!p.capital);
 if(!owned.length)return false;
 const start=owned[(c.nextState-1)%owned.length];const selected=owned.sort((a,b)=>Math.hypot(a.point[0]-start.point[0],a.point[1]-start.point[1])-Math.hypot(b.point[0]-start.point[0],b.point[1]-start.point[1])).slice(0,Math.max(1,Math.floor(owned.length/2)));
 for(const p of selected)c.provinces[p.id].owner=state.id;
 const ancestor=c.newStates.find(v=>v.id===parent);if(ancestor){ancestor.provinceIds=PROVINCES.filter(p=>c.provinces[p.id].owner===parent).map(p=>p.id);ancestor.dissolved=ancestor.provinceIds.length===0;if(ancestor.dissolved)c.recognition=c.recognition.filter(id=>id!==parent);}
 state.provinceIds=selected.map(p=>p.id);state.point=start.point;state.capitalProvince=start.id;
 for(const site of c.sites)if(state.provinceIds.includes(site.provinceId)){site.territory=false;site.unrest=Math.max(30,site.unrest);}
 return true;
}
