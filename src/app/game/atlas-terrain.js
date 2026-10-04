import {WORLD_CELLS,COLS,ROWS,WATER_KINDS,layoutOf} from './world-grid.js';
import {landscapeHash} from './landscape-colors.js';

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

export const ATLAS_BIOME_COLORS={snow:[217,233,228],meadow:[157,181,98],forest:[119,153,80],basin:[152,145,118],desert:[216,188,125],coast:[192,190,133],marsh:[135,157,94],volcanic:[114,119,121]};
export const atlasEcology=cell=>cell?.site?layoutOf(cell.site)?.ecology:null;

/** Overlapping canopies and ridges form continuous scenery, instead of one isolated icon per cell. */
export function atlasDecorations(cell,ecology=atlasEcology(cell)){
 const {cx:x,cz:z,terrain}=cell;if(isWater(terrain))return [];
 const h=landscapeHash(x,z),forest=terrain==='forest'||ecology==='forest';
 const mountain=terrain==='mountain',snow=terrain==='ice'||ecology==='snow',desert=terrain==='desert'||ecology==='desert';
 const oasis=desert&&ATLAS_DIRECTIONS.some(([dx,dz])=>['river','lake','stream','canal'].includes(atlasCell(x+dx,z+dz)?.terrain));
 const names=mountain?['peak','ridge','crags']:snow?['snowpeak','pines']:forest?['woodland','pines','grove']:ecology==='volcanic'?['volcano','crags']:oasis?['oasis']:desert?['dunes','crags']:ecology==='marsh'?['reeds','grove']:ecology==='basin'?['crags','ridge']:['grove','woodland'];
 const count=mountain?1+Math.floor(h*3):forest?4:snow?2:ecology==='volcanic'?2:oasis?1:desert?(h<.58?1:0):ecology==='marsh'?2:ecology==='basin'?(h<.7?1:0):h<.48?1:0;
 return Array.from({length:count},(_,i)=>{
  const a=landscapeHash(x*7+i*31,z*9+4),b=landscapeHash(x*11+5,z*13+i*29);
  const px=count===1?.5:(i%2)*.44+.28,pz=count===1?.5:Math.floor(i/2)*.44+.26;
  return {id:'terrain-'+x+'-'+z+'-'+i,name:names[Math.floor(a*names.length)],point:[(x+px+(a-.5)*.58)*26,(z+pz+(b-.5)*.54)*26],size:mountain?27+a*14:forest?22+a*8:snow?24+a*9:17+a*9};
 });
}
export const ATLAS_DECORATIONS=WORLD_CELLS.flatMap(cell=>atlasDecorations(cell));
