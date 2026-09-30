import {WORLD_CELLS, CELL, COLS, ROWS} from './world-grid.js';
import {PROVINCES, cellsPath} from './territory.js';
import {NATIONS} from './world.js';

export const ATLAS_WIDTH = COLS * CELL;
export const ATLAS_HEIGHT = ROWS * CELL;
export const FULL_VIEW = {x: 0, y: 0, width: ATLAS_WIDTH, height: ATLAS_HEIGHT};
export const TERRAIN_COLORS = {plain:'#a7b781',forest:'#688b68',mountain:'#a39e8c',desert:'#d6bc85',ice:'#dce8dc',coast:'#639ca7',river:'#78afba',lake:'#78afba',canal:'#79aeba',stream:'#86bac2'};

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

export const PROVINCE_INDEX = new Map(PROVINCES.map(p => [p.id, p]));
export const CELL_PROVINCES = new Map(PROVINCES.flatMap(p => p.cells.map(([x,z]) => [`${x},${z}`, p])));
export const NATION_SHAPES = Object.keys(NATIONS).map(id => {
  const cells=PROVINCES.filter(p => p.nation===id).flatMap(p => p.cells);
  return {id, path:cellsPath(cells), boundary:boundaryPath(cells)};
});

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
