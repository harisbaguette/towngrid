import {COLS,ROWS,CELL,WORLD_CELLS,layoutOf,WATER_KINDS} from './world-grid.js';
import {landscapeNoise,LAND_COLORS,WATER_COLORS,mixColor} from './landscape-colors.js';
import {ATLAS_BIOME_COLORS,atlasDecorations} from './atlas-terrain.js';

// Covers the inverse-projected viewport at maximum zoom-out, four rotations,
// and portrait/ultrawide aspect ratios. These cells are scenery, never plots.
export const OUTSKIRT_CELLS=128;
export const OUTSKIRT_BOUNDS={x:-OUTSKIRT_CELLS*CELL,y:-OUTSKIRT_CELLS*CELL,width:(COLS+OUTSKIRT_CELLS*2)*CELL,height:(ROWS+OUTSKIRT_CELLS*2)*CELL};
export const SURROUND_CELLS=16;
export const SURROUND_BOUNDS={x:-SURROUND_CELLS*CELL,y:-SURROUND_CELLS*CELL,width:(COLS+SURROUND_CELLS*2)*CELL,height:(ROWS+SURROUND_CELLS*2)*CELL};
const palettes={...LAND_COLORS,...WATER_COLORS},cache=new Map(),colorCache=new Map();
export const outsideDistance=(x,z)=>Math.max(0,-x,-z,x-COLS+1,z-ROWS+1);
export function exteriorCell(x,z){
 const key=x+','+z;if(cache.has(key))return cache.get(key);
 const distance=outsideDistance(x,z),cx=Math.max(0,Math.min(COLS-1,x)),cz=Math.max(0,Math.min(ROWS-1,z)),edge=WORLD_CELLS[cz*COLS+cx];
 if(!distance){const cell={...edge,ecology:edge.site?layoutOf(edge.site)?.ecology:null,distance:0};cache.set(key,cell);return cell;}
 const field=landscapeNoise(x*.17+21,z*.17+9),ridge=landscapeNoise(x*.12+61,z*.12+43);
 let terrain=field>.58?'forest':ridge>.77?'mountain':'plain';
 const reach=4+landscapeNoise(x*.21+7,z*.21+5)*8;
 if(distance<reach&&WATER_KINDS.includes(edge.terrain))terrain=edge.terrain;
 else if(distance<reach*.65&&['ice','desert','forest'].includes(edge.terrain))terrain=edge.terrain;
 const cell={cx:x,cz:z,terrain,ecology:null,distance};cache.set(key,cell);return cell;
}
export function exteriorColor(x,z){
 const key=x+','+z;if(colorCache.has(key))return colorCache.get(key);
 const c=exteriorCell(x,z),water=WATER_KINDS.includes(c.terrain);
 let color=ATLAS_BIOME_COLORS[c.ecology]||palettes[c.terrain]||LAND_COLORS.plain;
 if(c.distance&&!water){
  const edge=exteriorCell(Math.max(0,Math.min(COLS-1,x)),Math.max(0,Math.min(ROWS-1,z)));
  if(!WATER_KINDS.includes(edge.terrain))color=mixColor(ATLAS_BIOME_COLORS[edge.ecology]||palettes[edge.terrain],color,Math.min(1,c.distance/9));
 }
 color=mixColor(color,[156,176,143],Math.min(.55,Math.max(0,c.distance-12)/55));colorCache.set(key,color);return color;
}
export const OUTSKIRT_DECORATIONS=[];
for(let z=-64;z<ROWS+64;z++)for(let x=-64;x<COLS+64;x++){
 const c=exteriorCell(x,z);if(!c.distance||c.distance>60)continue;
 for(const decoration of atlasDecorations(c,null))OUTSKIRT_DECORATIONS.push({...decoration,id:'outskirts-'+decoration.id,opacity:Math.max(.16,1-Math.max(0,c.distance-6)/60),kind:'outskirts'});
}
