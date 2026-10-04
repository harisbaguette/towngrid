import {landscapeNoise} from './landscape-colors.js';

// Land cover varies across political borders. Water, mountains and the set of
// habitable cells stay fixed, retaining every plot ID and transport connection.
export function mixedLandcover(rows) {
 const dry='.fd*',fresh='ABDEGKMNabceghjk123456',nearWater=(x,z)=>{
  for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++)if(fresh.includes(rows[z+dz]?.[x+dx]||' '))return true;
  return false;
 };
 return rows.map((row,z)=>[...row].map((c,x)=>{
  if(!dry.includes(c))return c;
  const cover=landscapeNoise(x*.48+3,z*.48+11)*.65+landscapeNoise(x*.9+31,z*.9+6)*.35,climate=landscapeNoise(x*.16+47,z*.16+19),wet=nearWater(x,z);
  if(c==='*'&&z<4&&climate>.30&&!wet)return '*';
  if(c==='d'&&climate>.51&&cover<.67)return 'd';
  const clearing=landscapeNoise(x*1.7+3,z*1.7+14)<.45;
  return !clearing&&cover>(c==='f'?.50:.57)?'f':'.';
 }).join(''));
}
