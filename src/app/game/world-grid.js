// World terrain grid. The world map (world-map.js) is one big grid of CELL×CELL squares and every
// square is one kind of terrain. A province's site is one square, and that square is one 24×24 local
// map: each side of the local map takes the terrain of the square beside it, so a site next to the
// sea has a sea shore along that side, a site next to a mountain square a mountain band, and so on
// (Town Star's world plots work the same way). The seas, rivers, lakes, canals and streams are read
// from the same grid, so what the atlas shows, what a side is and where a port trades always agree.
import {WORLD_MAP,WATERWAY_CHARS,SEAS,FERRIES,MAP_COLS,MAP_ROWS} from './world-map.js';
import {WORLD_PLOTS} from './territory.js';
import {BIOMES,ecologyOf} from './biome-data.js';

export const CELL=26,COLS=MAP_COLS,ROWS=MAP_ROWS,MAP=24;
/** Water kinds in order of precedence where two meet. A local map may also hold a small 'pond'. */
export const WATER_KINDS=['coast','lake','river','canal','stream'];
export const TERRAIN_NAMES={coast:'바다',lake:'호수',river:'큰 강',canal:'운하',stream:'하천',pond:'연못',mountain:'산',forest:'숲',desert:'사막',ice:'얼음',plain:'평지'};
export const SIDES=[['n',0,-1],['e',1,0],['s',0,1],['w',-1,0]];
export const SIDE_NAMES={n:'북쪽',e:'동쪽',s:'남쪽',w:'서쪽'};
const GROUND={'~':'coast','^':'mountain',f:'forest',d:'desert','*':'ice','.':'plain'};
const charAt=(cx,cz)=>WORLD_MAP[Math.max(0,Math.min(ROWS-1,cz))][Math.max(0,Math.min(COLS-1,cx))];
const kindOf=c=>{const k=GROUND[c]||WATERWAY_CHARS[c]?.kind;if(!k)throw new Error('unknown map square '+c);return k;};
const px=([cx,cz])=>[(cx+.5)*CELL,(cz+.5)*CELL];
const NEAR=[[1,0],[-1,0],[0,1],[0,-1]];
const squaresOf=c=>{const out=[];for(let z=0;z<ROWS;z++)for(let x=0;x<COLS;x++)if(WORLD_MAP[z][x]===c)out.push([x,z]);return out;};
const touchesSea=([x,z])=>NEAR.some(([dx,dz])=>x+dx>=0&&z+dz>=0&&x+dx<COLS&&z+dz<ROWS&&WORLD_MAP[z+dz][x+dx]==='~');
// A river, canal or stream is a single chain of squares; tracing it gives its course, source to end.
function chain(c,from){
 const all=squaresOf(c),seen=new Set([from.join(',')]),out=[from];
 for(let at=from;;){const next=NEAR.map(([dx,dz])=>[at[0]+dx,at[1]+dz]).filter(q=>charAt(...q)===c&&q[0]>=0&&q[1]>=0&&q[0]<COLS&&q[1]<ROWS&&!seen.has(q.join(',')));
  if(next.length>1)throw new Error(c+' branches at '+at);if(!next.length)break;at=next[0];seen.add(at.join(','));out.push(at);}
 if(out.length!==all.length||charAt(...from)!==c)throw new Error(c+' is not one chain from '+from);
 return out;
}
function flood(seed){const out=[],seen=new Set([seed.join(',')]),stack=[seed];
 while(stack.length){const q=stack.pop();out.push(q);for(const [dx,dz] of NEAR){const n=[q[0]+dx,q[1]+dz],k=n.join(',');if(n[0]>=0&&n[1]>=0&&n[0]<COLS&&n[1]<ROWS&&WORLD_MAP[n[1]][n[0]]==='~'&&!seen.has(k)){seen.add(k);stack.push(n);}}}
 return out;}
const bounds=cells=>{const xs=cells.map(c=>c[0]),zs=cells.map(c=>c[1]),[x0,x1,z0,z1]=[Math.min(...xs),Math.max(...xs)+1,Math.min(...zs),Math.max(...zs)+1].map(v=>v*CELL);return [[x0,z0],[x1,z0],[x1,z1],[x0,z1],[x0,z0]];};

/** Water a port can stand on, read from the map. `cells` are its squares; `line` its course in atlas
 *  px (a lake's outline); `lane` the shipping lane drawn for a sea. Small waterways (ferry routes) run
 *  inside a square, so they are lines only. */
export const WATERWAYS=[
 ...SEAS.map(s=>{const cells=flood(s.seed),lane=s.lane.map(p=>p.map(v=>(v+.5)*CELL));return {id:s.id,kind:'coast',name:s.name,port:s.port,joins:s.joins,cells,line:lane,lane,label:px(s.label)};}),
 ...Object.entries(WATERWAY_CHARS).map(([c,w])=>{
  if(w.kind==='lake'){const cells=squaresOf(c),center=px(cells.reduce((a,q)=>[a[0]+q[0]/cells.length,a[1]+q[1]/cells.length],[0,0]));return {id:w.id,kind:w.kind,name:w.name,cells,line:bounds(cells),center};}
  const cells=chain(c,w.from);return {id:w.id,kind:w.kind,name:w.name,cells,line:cells.map(px),...(w.kind==='river'?{mouths:[touchesSea(cells[0]),touchesSea(cells.at(-1))]}:{})};
 }),
 ...FERRIES.map(f=>({...f,kind:'ferry',line:f.line.map(p=>p.map(v=>(v+.5)*CELL))}))
];
{const seas=WATERWAYS.filter(w=>w.kind==='coast').reduce((n,w)=>n+w.cells.length,0);if(seas!==squaresOf('~').length)throw new Error('a sea square belongs to no sea');}
const WATER_SQUARE=new Map();
for(const w of WATERWAYS)w.cells?.forEach((q,i)=>WATER_SQUARE.set(q.join(','),{w,s:i*CELL,length:(w.cells.length-1)*CELL}));
/** The waterway a water square belongs to, with how far along its course the square is. */
export const waterwayAt=(cx,cz)=>WATER_SQUARE.get(cx+','+cz)||null;
export function nearestOnLine(p,line){let best={d:Infinity,at:line[0],s:0},s=0;for(let i=0;i+1<line.length;i++){const a=line[i],b=line[i+1],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/((dx*dx+dy*dy)||1))),q=[a[0]+dx*t,a[1]+dy*t],d=Math.hypot(p[0]-q[0],p[1]-q[1]);if(d<best.d)best={d,at:q.map(Math.round),s:s+len*t};s+=len;}return {...best,length:s};}
/** How close (atlas px) a province point must be to a small waterway to use it. */
export const TOUCH={ferry:20};

const PROVINCE_BY_ID=new Map(WORLD_PLOTS.map(p=>[p.id,p])),SITE_CELLS=new Map(WORLD_PLOTS.map(p=>[p.cell.join(','),p]));
/** Every square of the atlas: {cx, cz, terrain, site} where site is the province whose site it holds. */
export const WORLD_CELLS=[];
for(let cz=0;cz<ROWS;cz++)for(let cx=0;cx<COLS;cx++){const site=SITE_CELLS.get(cx+','+cz),terrain=kindOf(WORLD_MAP[cz][cx]);
 if(site&&(WATER_KINDS.includes(terrain)||terrain==='mountain'))throw new Error(site.id+' sits on '+terrain);
 WORLD_CELLS.push({cx,cz,terrain,site:site?.id||null});}
/** Terrain of a square; beyond the map edge the edge square goes on. */
export const terrainOfCell=(cx,cz)=>kindOf(charAt(cx,cz));
const edgesOf=(cx,cz)=>Object.fromEntries(SIDES.map(([side,dx,dz])=>[side,terrainOfCell(cx+dx,cz+dz)]));

const LAYOUTS=new Map();
/** The local map of a province: {province, cell, biome, edges:{n,e,s,w}}. Each edge is the terrain of
 *  the square beside the site's square. */
export function layoutOf(id){
 if(LAYOUTS.has(id))return LAYOUTS.get(id);
 const p=PROVINCE_BY_ID.get(id);if(!p)return null;
 const [cx,cz]=p.cell,layout={province:id,cell:[cx,cz],biome:terrainOfCell(cx,cz),edges:edgesOf(cx,cz)};
 layout.ecology=ecologyOf(layout);LAYOUTS.set(id,layout);return layout;
}
/** The layout of a map made before the grid: the old water of its region template, and the ground of
 *  its province. Saved tiles hold no terrain, so old saves keep this water under their buildings. */
export function legacyLayout(region,province){
 const g=layoutOf(province)||{cell:null,biome:'plain',edges:{n:'plain',e:'plain',s:'plain',w:'plain'}},edges={...g.edges};
 for(const [side] of SIDES)if(WATER_KINDS.includes(edges[side]))edges[side]='plain';
 if(region==='coast'){edges.e='coast';edges.n='coast';}else edges.e=region==='highland'?'stream':'river';
 return {legacy:region,province:province||null,cell:g.cell,biome:g.biome,edges};
}
/** The old region a layout plays like (sound, weather, scenery). */
export const regionOf=layout=>layout.legacy||(Object.values(layout.edges).includes('coast')?'coast':Object.values(layout.edges).includes('mountain')?'highland':'river');

// Local geometry. depth counts tiles in from a side (negative beyond the map edge); u runs along it.
const along=(side,x,z)=>side==='n'?[z,x]:side==='s'?[MAP-1-z,x]:side==='w'?[x,z]:[MAP-1-x,z];
const phaseOf=(layout,side)=>{const [cx,cz]=layout.cell||[0,0];return (cx*7+cz*13+'nesw'.indexOf(side)*5)%11*.57;};
const wiggle=(u,ph)=>Math.round(Math.sin(u*.45+ph));
const between=(d,a,b)=>d>=Math.min(a,b)&&d<=Math.max(a,b);
function wetAlong(kind,d,u,ph){
 if(kind==='coast')return d<4+wiggle(u,ph);
 if(kind==='lake')return d<1+Math.round(3.2*Math.sin(Math.PI*(u+.5)/MAP));
 if(kind==='canal')return d===3||d===4;
 if(kind==='river'){const bank=4-Math.floor(Math.sin(u*.35+ph)*1.3);return d===bank||d===bank+1;}
 if(kind==='stream'){const bed=v=>4+Math.round(Math.sin(v*.5+ph));return between(d,bed(u),bed(u-1));}
 return false;
}
const legacyWater=(region,x,z)=>{
 if(region==='coast')return x>=18||z<3?'coast':null;
 if(region==='river'){const bank=18+Math.floor(Math.sin(z*.35)*1.3);return x>=bank&&x<bank+2?'river':null;}
 return x===19&&z>3&&z<21?'stream':null;
};
/** The kind of water on tile (x,z) of a layout, or null. Works beyond the 24×24 map for the scenery. */
export function waterAt(layout,x,z){
 const pond=x>=3&&x<=4&&z>=5&&z<=6;
 if(layout.legacy)return legacyWater(layout.legacy,x,z)||(pond?'pond':null);
 // The starting land and the export road into it stay dry on every map.
 if(x>=8&&x<=15&&z>=8&&z<=15||z===11&&x>=0&&x<8)return null;
 let best=null;
 for(const [side] of SIDES){
  const kind=layout.edges[side];if(!WATER_KINDS.includes(kind)||best&&WATER_KINDS.indexOf(best)<=WATER_KINDS.indexOf(kind))continue;
  const [d,u]=along(side,x,z);if(wetAlong(kind,d,u,phaseOf(layout,side)))best=kind;
 }
 const marsh=layout.ecology==='marsh'&&([[6,18,2.4,1.6],[18,7,1.6,2.5],[20,19,1.8,1.8]].some(([a,b,rx,rz])=>((x-a)/rx)**2+((z-b)/rz)**2<=1));
 return best||(pond||marsh?'pond':null);
}
/** Ground under a dry tile: 'mountain' | 'ice' | 'sand' | 'plain'. A mountain, ice or desert
 *  neighbour lays a band of its ground along that side. */
export function groundOf(layout,x,z){
 let band=null;
 for(const [side] of SIDES){
  const kind=layout.edges[side],ground=kind==='mountain'?'mountain':kind==='ice'?'ice':kind==='desert'?'sand':null;if(!ground)continue;
  const [d,u]=along(side,x,z);if(d<3+wiggle(u,phaseOf(layout,side)+2)&&(ground==='mountain'||!band))band=ground;
 }
 if(band==='mountain')return band;
 return layout.biome==='ice'?'ice':layout.biome==='desert'?'sand':band||'plain';
}
/** Woods thicken near a forest neighbour and all over a forest site. */
export const forestAt=(layout,x,z)=>layout.biome==='forest'||SIDES.some(([side])=>layout.edges[side]==='forest'&&along(side,x,z)[0]<5);
/** A point `depth` tiles in from `side`, `u` along it, in map coordinates. */
export const edgePoint=(side,depth,u)=>side==='n'?[u,depth]:side==='s'?[u,MAP-1-depth]:side==='w'?[depth,u]:[MAP-1-depth,u];
/** The river's middle `u` along a side, for boats. */
export const riverMiddle=(layout,side,u)=>layout.legacy==='river'?4.5-Math.floor(Math.sin(Math.round(u)*.35)*1.3):4.5-Math.floor(Math.sin(Math.round(u)*.35+phaseOf(layout,side))*1.3);
/** Check a saved layout before trusting it. */
export function validLayout(v){
 const terrains=Object.keys(TERRAIN_NAMES);
 return !!v&&typeof v==='object'&&(v.ecology===undefined||Object.hasOwn(BIOMES,v.ecology))&&(v.legacy===undefined||['river','coast','highland'].includes(v.legacy))&&(v.province===null||v.province===undefined||typeof v.province==='string')&&
  (v.cell===null||Array.isArray(v.cell)&&v.cell.length===2&&v.cell.every(Number.isInteger))&&terrains.includes(v.biome)&&!!v.edges&&SIDES.every(([s])=>terrains.includes(v.edges[s]));
}
