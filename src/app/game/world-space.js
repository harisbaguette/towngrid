import {MAP,COLS,ROWS,WORLD_CELLS,SIDES,layoutOf,terrainOfCell,WATER_KINDS,waterAt,groundOf,forestAt} from './world-grid.js';
import {PLOT_INDEX} from './territory.js';
import {ecologyOf} from './biome-data.js';
import {LAND_COLORS,mixColor} from './landscape-colors.js';
import {generateTerrainTiles} from './terrain-tiles.js';
import {oilConcentration,oasisAt} from './biome-terrain.js';
import {surfaceLandform,landformOf,landformColor,mountainHeight,mountainWater,waterCellShape,clamp} from './landform-data.js';

export const WORLD_SIZE={width:COLS*MAP,height:ROWS*MAP};
export const worldOrigin=sim=>(sim?.layout?.cell||layoutOf(sim?.provinceId)?.cell||[0,0]).map(n=>n*MAP);
export function localToWorld(sim,x,z){const [ox,oz]=worldOrigin(sim);return [x+ox,z+oz];}
export function worldToLocal(sim,x,z){const [ox,oz]=worldOrigin(sim);return [x-ox,z-oz];}
export function worldCellAt(x,z){const cx=Math.floor((x+.5)/MAP),cz=Math.floor((z+.5)/MAP);return cx>=0&&cz>=0&&cx<COLS&&cz<ROWS?WORLD_CELLS[cz*COLS+cx]:null;}
export const plotCenter=id=>PLOT_INDEX.get(id)?.cell.map(n=>n*MAP+(MAP-1)/2)||null;
const layouts=new Map();
export function cellLayout(cx,cz){
 const key=cx+','+cz;if(layouts.has(key))return layouts.get(key);
 const cell=worldCellAt(cx*MAP,cz*MAP),layout=cell?.site?layoutOf(cell.site):{province:null,cell:[cx,cz],biome:terrainOfCell(cx,cz),edges:Object.fromEntries(SIDES.map(([s,dx,dz])=>[s,terrainOfCell(cx+dx,cz+dz)]))};
 if(!layout.ecology)layout.ecology=ecologyOf(layout);layouts.set(key,layout);return layout;
}
export function terrainColor(layout,x,z,ground){
 let color=ground==='mountain'?LAND_COLORS.mountain:ground==='ice'?LAND_COLORS.ice:ground==='sand'?LAND_COLORS.sand:LAND_COLORS.plain;
 if(ground==='plain'){
  if(layout.ecology==='volcanic')color=LAND_COLORS.volcanic;
  else if(layout.ecology==='marsh')color=LAND_COLORS.marsh;
  else if(forestAt(layout,x,z))color=LAND_COLORS.forest;
  else if(layout.ecology==='coast')color=mixColor(LAND_COLORS.plain,LAND_COLORS.sand,.34);
 }
 return color;
}
export class WorldTerrainData{
 constructor(sim=null){this.setSimulation(sim);this.generated=new Map();}
 setSimulation(sim){this.sim=sim;this.sites=new Map((sim?.campaign?.sites||[]).map(s=>[s.provinceId,s.sim]));if(sim?.provinceId)this.sites.set(sim.provinceId,sim);}
 sample(x,z){
  x=Math.round(x);z=Math.round(z);const cell=worldCellAt(x,z),cx=Math.floor((x+.5)/MAP),cz=Math.floor((z+.5)/MAP),lx=x-cx*MAP,lz=z-cz*MAP;
  const saved=this.sites.get(cell?.site),layout=saved?.layout||cellLayout(cx,cz),tile=saved?.tile(lx,lz);
  const kind=cell?.terrain||terrainOfCell(cx,cz),shape=cell&&WATER_KINDS.includes(kind)?waterCellShape(cell,x,z):null,runoff=kind==='mountain'?mountainWater(x,z):null;
  const water=tile?tile.water:shape?shape.water:WATER_KINDS.includes(kind)?kind:kind==='mountain'?(runoff?.distance<.64?'stream':null):waterAt(layout,lx,lz);
  const ground=tile?.ground||(kind==='mountain'?'mountain':shape&&!water?'sand':groundOf(layout,lx,lz));
  const surface=tile||{water,ground,oil:layout.ecology?oilConcentration(layout,lx,lz):0,oasis:oasisAt(layout,lx,lz)};
  const landform=shape&&!water?(kind==='canal'?'shingle':shape.bank> -1.8?'beach':'marsh'):surfaceLandform(layout,surface),height=kind==='mountain'?mountainHeight(x,z):0;
  let color=landformColor(landform,x,z,height);
  if(landform==='oilfield')color=mixColor(landformColor(landformOf(layout).id,x,z),color,.48);
  if(!water&&!height&&!['oilfield','oasis'].includes(landform)){
   for(const [i,d]of [lz+.5,23.5-lx,23.5-lz,lx+.5].entries())if(d<4){
    const [,dx,dz]=SIDES[i],other=cellLayout(cx+dx,cz+dz),id=landformOf(other).id;
    if(!WATER_KINDS.includes(other.biome)&&other.biome!=='mountain')color=mixColor(color,landformColor(id,x,z),.5*(1-clamp(d/4)));
   }
  }
  return {water,color,ground,layout,tile,cell,landform,height,depth:shape?.depth,flow:shape?.flow||runoff?.flow};
 }
 tiles(cell){
  const saved=this.sites.get(cell.site);if(saved)return saved.tiles;
  const key=cell.cx+','+cell.cz;if(!this.generated.has(key)){
   this.generated.set(key,generateTerrainTiles(cellLayout(cell.cx,cell.cz),0));
   if(this.generated.size>64)this.generated.delete(this.generated.keys().next().value);
  }
  return this.generated.get(key);
 }
}
