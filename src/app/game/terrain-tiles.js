import {waterAt,groundOf,forestAt} from './world-grid.js';
import {biomeTile} from './biome-terrain.js';

export const terrainNoise=(x,z)=>{const a=Math.sin(x*127.1+z*311.7+37)*43758.5453;return a-Math.floor(a);};
// One generator for saved settlements and the unoccupied land visible around them.
export function generateTerrainTiles(layout,seed=0){
 const tiles=[],noise=terrainNoise,grid=!layout.legacy;
 for(let z=0;z<24;z++)for(let x=0;x<24;x++){
  const water=waterAt(layout,x,z),ground=water?null:groundOf(layout,x,z),terrain=water?'water':'grass';
  const rugged=grid&&ground==='mountain',limit=grid&&forestAt(layout,x,z)?.5:rugged?.58:.72;
  let nature=null;if(terrain==='grass'&&noise(x,z)>limit)nature=noise(z,x)>(rugged?.75:.3)?'tree':'rock';
  if(x>=9&&x<=14&&z>=10&&z<=15)nature=null;
  if((x===8&&z===8)||(x===8&&z===9)||(x===9&&z===8))nature='tree';
  if((x===15&&z===8)||(x===15&&z===9)||(x===14&&z===8))nature='rock';
  tiles.push(biomeTile(layout,{x,z,terrain,water,ground,nature,remaining:nature?(rugged&&nature==='rock'?180:90):0,
   fertility:Math.round(35+noise(x+17+seed,z+4)*65),moisture:Math.round(30+noise(x+8,z+22+seed)*70),
   ore:Math.round((rugged?80:30)+noise(x+31+seed,z+7)*(rugged?20:70)),mana:Math.round(25+noise(x+43+seed,z+51)*75)},seed));
 }
 return tiles;
}
