import {WORLD_CELLS,COLS,ROWS,WATER_KINDS,layoutOf} from './world-grid.js';

export const ATLAS_ART='/assets/world-atlas/';
export const ATLAS_SPRITES=['woodland','pines','grove','elderwood','peak','ridge','crags','snowpeak','dunes','oasis','reeds','volcano','capital','frontier','settlement','hostile'];
export const atlasSprite=name=>ATLAS_ART+name+'.png';
export const atlasQuarterSprite=(name,quarter=0)=>ATLAS_ART+'iso/'+name+'-'+((quarter%4+4)%4)+'.png';
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

export const ATLAS_BIOME_COLORS={snow:[217,233,228],meadow:[157,181,98],forest:[119,153,80],basin:[152,145,118],desert:[216,188,125],coast:[192,190,133],marsh:[135,157,94],volcanic:[114,119,121]};
export const atlasEcology=cell=>cell?.site?layoutOf(cell.site)?.ecology:null;

export const ATLAS_DECORATIONS=WORLD_CELLS.flatMap(cell=>{
 const {cx,cz,terrain,site}=cell,v=atlasVariant(cx,cz);let index=null;
 if(terrain==='forest')index=v;
 if(terrain==='mountain')index=4+v;
 if(terrain==='desert'&&v===0)index=8;
 if(terrain==='ice'&&v===0&&terrainConnections(cell).same!==15)index=7;
 if(terrain==='desert'&&ATLAS_DIRECTIONS.some(([dx,dz])=>['river','lake','stream','canal'].includes(atlasCell(cx+dx,cz+dz)?.terrain)))index=9;
 const ecology=site?layoutOf(site)?.ecology:null;
 if(ecology==='basin')index=6;
 if(ecology==='marsh')index=10;if(ecology==='volcanic')index=11;
 return index===null?[]:[{id:'terrain-'+cx+'-'+cz,name:ATLAS_SPRITES[index],point:[(cx+.5)*26,(cz+.5)*26],size:terrain==='mountain'?43:terrain==='forest'?37:30}];
});
