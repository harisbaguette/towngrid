import {WORLD_CELLS,COLS,ROWS,WATER_KINDS} from './world-grid.js';

export const ATLAS_ART='/assets/world-atlas/';
export const ATLAS_SPRITES=['woodland','pines','grove','elderwood','peak','ridge','crags','snowpeak','dunes','oasis','reeds','volcano','capital','frontier','settlement','hostile'];
export const atlasSprite=name=>ATLAS_ART+name+'.png';
export const atlasCell=(x,z)=>x<0||z<0||x>=COLS||z>=ROWS?null:WORLD_CELLS[z*COLS+x];
export const isWater=kind=>WATER_KINDS.includes(kind);
export const ATLAS_DIRECTIONS=[[0,-1],[1,0],[0,1],[-1,0]];
/** The same NESW adjacency drives river arms, shoreline and continuous land cover. */
export function terrainConnections(cell){
 let water=0,same=0,shore=0;
 ATLAS_DIRECTIONS.forEach(([dx,dz],i)=>{
  const neighbor=atlasCell(cell.cx+dx,cell.cz+dz);if(!neighbor)return;
  if(isWater(neighbor.terrain))water|=1<<i;
  if(neighbor.terrain===cell.terrain)same|=1<<i;
  if(isWater(cell.terrain)!==isWater(neighbor.terrain))shore|=1<<i;
 });
 return {water,same,shore};
}
export const atlasVariant=(x,z,count=4)=>{
 let h=Math.imul(x+31,374761393)^Math.imul(z+19,668265263);
 h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)%count;
};
