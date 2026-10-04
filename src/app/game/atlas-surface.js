import {exteriorCell,exteriorColor} from './atlas-outskirts.js';
import {WATER_KINDS} from './world-grid.js';
import {landscapeNoise,landscapeHash,mixColor} from './landscape-colors.js';

// The detailed map and its surrounding scenery sample one continuous surface.
export function atlasGroundColor(gx,gz){
 const cx=Math.floor(gx),cz=Math.floor(gz),cell=exteriorCell(cx,cz),base=exteriorColor(cx,cz),water=c=>WATER_KINDS.includes(c.terrain);
 let color=base;
 if(!water(cell)){
  const ax=Math.floor(gx-.5),az=Math.floor(gz-.5),u=gx-.5-ax,v=gz-.5-az;
  const land=(x,z)=>water(exteriorCell(x,z))?base:exteriorColor(x,z);
  color=mixColor(mixColor(land(ax,az),land(ax+1,az),u),mixColor(land(ax,az+1),land(ax+1,az+1),u),v);
  const shade=(landscapeNoise(gx*1.2,gz*1.2)-.5)*21+(landscapeNoise(gx*8,gz*8)-.5)*11;
  color=color.map(c=>c+shade);
  const patch=landscapeNoise(Math.floor(gx*22)/5,Math.floor(gz*22)/5);
  if(patch>.7)color=mixColor(color,[204,191,115],.25);
  else if(patch<.27)color=mixColor(color,[94,141,60],.14);
 }else{
  let depth=3;
  for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){
   if(water(exteriorCell(cx+dx,cz+dz)))continue;
   const nx=Math.max(cx+dx,Math.min(cx+dx+1,gx)),nz=Math.max(cz+dz,Math.min(cz+dz+1,gz));depth=Math.min(depth,Math.hypot(nx-gx,nz-gz));
  }
  const ripple=landscapeNoise(Math.floor(gx*32)/3,Math.floor(gz*32)/3),blue=cell.terrain==='coast'?[25,136,174]:[38,151,180];
  const edge=depth+(landscapeNoise(gx*11,gz*11)-.5)*.065;
  color=edge<2/64?[228,215,154]:edge<4/64?[192,222,185]:edge<8/64?[102,198,189]:edge<16/64?mixColor(blue,[103,207,203],.5):blue.map((c,i)=>c+(ripple-.5)*(i===0?16:22));
  if(depth>.12&&landscapeHash(Math.floor(gx*32),Math.floor(gz*32))>.986)color=mixColor(color,[198,234,214],.65);
 }
 const grain=(landscapeHash(Math.floor(gx*32),Math.floor(gz*32))-.5)*5;
 return color.map(c=>Math.max(0,Math.min(255,Math.round(c+grain))));
}
