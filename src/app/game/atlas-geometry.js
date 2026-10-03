import {WORLD_CELLS, CELL, COLS, ROWS, WATER_KINDS} from './world-grid.js';
import {PROVINCES, PLOT_INDEX, cellsPath,sovereignOf,frontierPlots} from './territory.js';
import {NATIONS} from './world.js';

export const ATLAS_WIDTH = COLS * CELL;
export const ATLAS_HEIGHT = ROWS * CELL;
export const FULL_VIEW = {x: 0, y: 0, width: ATLAS_WIDTH, height: ATLAS_HEIGHT};
export const TERRAIN_COLORS = {plain:'#a7b781',forest:'#688b68',mountain:'#a39e8c',desert:'#d6bc85',ice:'#dce8dc',coast:'#639ca7',river:'#78afba',lake:'#78afba',canal:'#79aeba',stream:'#86bac2'};
export const terrainBlockReason=terrain=>terrain==='mountain'?'산악 · 정착 불가':WATER_KINDS.includes(terrain)?'수역 · 정착 불가':null;
export const UNSETTLEABLE_CELLS=WORLD_CELLS.filter(c=>terrainBlockReason(c.terrain));

// Immutable terrain: one path per terrain, built once, instead of one React element per tile.
export const TERRAIN_PATHS = Object.entries(TERRAIN_COLORS).map(([terrain, color]) => ({
  terrain, color, path: cellsPath(WORLD_CELLS.filter(c => c.terrain === terrain).map(c => [c.cx, c.cz])),
})).filter(group => group.path);

/** Trace exposed edges only; never draw country borders inside their tiles. */
export function boundaryPath(cells) {
  const occupied = new Set(cells.map(([x,z]) => `${x},${z}`));
  return cells.flatMap(([x,z]) => {
    const px=x*CELL, py=z*CELL, edges=[];
    if(!occupied.has(`${x},${z-1}`)) edges.push(`M${px} ${py}h${CELL}`);
    if(!occupied.has(`${x+1},${z}`)) edges.push(`M${px+CELL} ${py}v${CELL}`);
    if(!occupied.has(`${x},${z+1}`)) edges.push(`M${px+CELL} ${py+CELL}h-${CELL}`);
    if(!occupied.has(`${x-1},${z}`)) edges.push(`M${px} ${py+CELL}v-${CELL}`);
    return edges;
  }).join('');
}

export const PROVINCE_INDEX = PLOT_INDEX;
export const CELL_PROVINCES = new Map(PROVINCES.flatMap(p => p.cells.map(([x,z]) => [`${x},${z}`, p])));
export const UNCLAIMED_CELLS=PROVINCES.filter(p=>p.nation===null).flatMap(p=>p.cells);
export const UNCLAIMED_AREA={name:'무주지',point:PROVINCES.find(p=>p.nation===null).point,playable:true};
export function wildernessCells(owners={},sites=[]){const held=new Set(frontierPlots(sites).map(p=>p.cell.join(',')));return PROVINCES.filter(p=>sovereignOf(p.id,owners)===null).flatMap(p=>p.cells).filter(c=>!held.has(c.join(',')));}
export function frontierShape(sites=[]){const cells=frontierPlots(sites).map(p=>p.cell);return {id:'player',name:'내 변경 영지',cells,path:cellsPath(cells),boundary:boundaryPath(cells)};}
// Large connected wilderness gets a geographic label, not an invented country's border.
const wildKeys=new Set(UNCLAIMED_CELLS.map(c=>c.join(','))),wildGroups=[];
while(wildKeys.size){const seed=[...wildKeys][0].split(',').map(Number),group=[],stack=[seed];wildKeys.delete(seed.join(','));
 while(stack.length){const [x,z]=stack.pop();group.push([x,z]);for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const next=[x+dx,z+dz],key=next.join(',');if(wildKeys.delete(key))stack.push(next);}}
 if(group.length>=35)wildGroups.push(group);
}
export const WILDERNESS_LABELS=wildGroups.map((cells,i)=>{const center=cells.reduce((s,c)=>[s[0]+c[0]/cells.length,s[1]+c[1]/cells.length],[0,0]),cell=cells.reduce((a,b)=>Math.hypot(...a.map((v,k)=>v-center[k]))<Math.hypot(...b.map((v,k)=>v-center[k]))?a:b);return {id:'wilderness-'+i,text:'무주지',point:cell.map(v=>(v+.5)*CELL),province:CELL_PROVINCES.get(cell.join(',')).id};});
export const NATION_SHAPES = Object.keys(NATIONS).map(id => {
  const cells=PROVINCES.filter(p => p.nation===id).flatMap(p => p.cells);
  return {id, color:NATIONS[id].border, tier:NATIONS[id].tier, path:cellsPath(cells), boundary:boundaryPath(cells)};
});

/** New states inherit real region cells, including their own closed national outline. */
export function politicalShapes(owners={}){
 if(!PROVINCES.some(p=>sovereignOf(p.id,owners)!==p.nation))return NATION_SHAPES;
 const groups=new Map();
 for(const p of PROVINCES){const id=sovereignOf(p.id,owners);if(id===null)continue;if(!groups.has(id))groups.set(id,[]);groups.get(id).push(...p.cells);}
 return [...groups].map(([id,cells])=>({id,color:NATIONS[id]?.border||'#9b5142',tier:NATIONS[id]?.tier||'minor',path:cellsPath(cells),boundary:boundaryPath(cells)}));
}

export function clampView(view) {
  const width=Math.max(CELL*8,Math.min(ATLAS_WIDTH,view.width));
  const height=width*ATLAS_HEIGHT/ATLAS_WIDTH;
  return {x:Math.max(0,Math.min(ATLAS_WIDTH-width,view.x)),y:Math.max(0,Math.min(ATLAS_HEIGHT-height,view.y)),width,height};
}
export function viewAround(point, width= CELL*18) {
  return clampView({x:point[0]-width/2,y:point[1]-width*ATLAS_HEIGHT/ATLAS_WIDTH/2,width});
}
export function zoomView(view, factor, point=[view.x+view.width/2,view.y+view.height/2]) {
  const width=Math.max(CELL*8,Math.min(ATLAS_WIDTH,view.width*factor));
  const scale=width/view.width;
  return clampView({x:point[0]-(point[0]-view.x)*scale,y:point[1]-(point[1]-view.y)*scale,width});
}
export function tileAt(x,y) {
  if(x<0||y<0||x>=ATLAS_WIDTH||y>=ATLAS_HEIGHT) return null;
  return WORLD_CELLS[Math.floor(y/CELL)*COLS+Math.floor(x/CELL)];
}
