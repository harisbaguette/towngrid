import {biomeOf} from './biome-data.js';
import {biomeHint} from './biome-terrain.js';
import {SIDES,SIDE_NAMES,TERRAIN_NAMES,waterAt,groundOf,forestAt,edgePoint} from './world-grid.js';
import {landscapeHash,landscapeNoise} from './landscape-colors.js';

// These descriptions mirror the local production/placement rules, not the nation's policy.
export const EDGE_USES={
 mountain:{short:'석재 · 철 · 석탄 · 구리',detail:'산 타일은 광물량이 높고 채석장·광산 생산이 25% 빨라집니다. 산 다섯 칸 안은 그늘과 바람막이가 져 밭·태양광·풍차가 느려집니다. 광물 컨베이어를 이용할 수 있습니다.',overlay:'ore'},
 forest:{short:'목재 · 벌목',detail:'이쪽에는 나무가 밀집합니다. 땅을 확보하고 나무 네 칸 안에 벌목장을 지으세요.'},
 coast:{short:'어업 · 바다 연안항',detail:'물가 세 칸 안에서 어업을 하고, 바닷물 위에 연안항을 짓습니다. 바닷물은 밭을 관개하지 않고, 바다 두 칸 안은 소금기로 밭이 느려지고 소금밭이 빨라집니다.'},
 river:{short:'담수 · 어업 · 강 항구',detail:'담수 두 칸 안의 밀밭은 물 운반 없이 자랍니다. 물을 많이 먹는 작물은 물가에 붙이세요. 물레방아·어항과 강 항구를 이용할 수 있습니다.',overlay:'moisture'},
 lake:{short:'담수 · 어업 · 호수 항',detail:'물가에서 농업·어업·물레방아를 운영하고 호수 위에 호수 항을 짓습니다.',overlay:'moisture'},
 canal:{short:'담수 · 운하 선착장',detail:'물가의 농업·어업을 지원하며 운하 위에 운하 선착장을 지을 수 있습니다.',overlay:'moisture'},
 stream:{short:'담수 · 하천 선착장',detail:'물가의 농업·어업을 지원하며 하천 위에 하천 선착장을 지을 수 있습니다.',overlay:'moisture'},
 ice:{short:'얼음 지면',detail:'얼음 타일은 밭과 우물의 생산이 느립니다. 거점 자체가 얼음 지대이면 극지 항·스노모빌을 이용할 수 있습니다.'},
 desert:{short:'유정에 유리한 모래',detail:'모래 타일의 유정은 생산이 25% 빠르고 밭과 우물은 느립니다.',overlay:'oil'},
 plain:{short:'건설 · 농업 공간',detail:'넓은 땅에 시설과 운송망을 배치하세요. 생산 효율은 각 타일의 토질을 따릅니다.',overlay:'fertility'},
 pond:{short:'담수 · 작은 나룻터',detail:'주변 밭을 관개할 수 있습니다. 작은 물에는 대형 항구를 지을 수 없습니다.'}
};
export function mapEdges(layout){return SIDES.map(([side])=>({side,direction:SIDE_NAMES[side],kind:layout.edges[side],name:TERRAIN_NAMES[layout.edges[side]],...EDGE_USES[layout.edges[side]]}));}
/** Classify background by the nearest side, so a mountain never appears on a sea/forest side. */
export function outsideSide(x,z){
 const candidates=[['n',-z-.5],['e',x-23.5],['s',z-23.5],['w',-x-.5]].filter(([,d])=>d>=0);
 return candidates.sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
}
/** Deterministic side-specific props. Reuses the authored four-direction pixel sprites. */
export function edgeScenery(layout){
 const ecology=layout.ecology,profile=biomeOf(layout),mountain=ecology==='snow'?'snowMountain':ecology==='volcanic'?'volcanicMountain':'mountain';
 const props=[],add=(id,side,depth,u,scale)=>{const [x,z]=edgePoint(side,depth,u);if(waterAt(layout,Math.round(x),Math.round(z))||outsideSide(x,z)!==side)return;props.push({id,side,x,z,scale});};
 for(const {side,kind} of mapEdges(layout)){
  const seed='nesw'.indexOf(side)*29;
  if(kind==='mountain')for(let i=0;i<8;i++){
   const u=-2+i*4.1+landscapeHash(i,seed)*2,depth=-3-landscapeHash(seed,i)*5;
   add(mountain,side,depth,u,1.05+landscapeHash(i,seed+8)*.6);
   if(i%2)add('oreRock',side,-1.2-landscapeHash(i,seed+3)*2,u+1,.7+landscapeHash(i,seed+5)*.25);
  }
  for(let row=0;row<7;row++)for(let i=0;i<22;i++){
   const h=landscapeHash(i+seed,row),u=-4+i*2+landscapeHash(i,row+seed)*1.3,depth=-1.4-row*1.9-landscapeHash(i+4,row+seed)*1.4;
   const density=kind==='forest'?.72+landscapeNoise(i/3,row/2)*.25:kind==='plain'?.22:kind==='mountain'?.12:kind==='ice'?.20:kind==='desert'?.09:.25;
   if(h>density)continue;
   const id=ecology==='snow'||kind==='ice'?'snowPine':ecology==='desert'||kind==='desert'?'cactus':kind==='coast'?'palm':kind==='mountain'?'pine':kind==='forest'?(profile?'forestTree':i%3?'pine':'willow'):['river','lake','stream','canal'].includes(kind)?i%3?'reeds':'willow':i%3?'bush':'willow';
   add(id,side,depth,u,(kind==='forest'?.95:.62)+landscapeHash(row+seed,i+8)*.4);
  }
 }
 return props;
}
export function tileLandscape(sim,t){
 if(t.water)return {name:TERRAIN_NAMES[t.water],detail:EDGE_USES[t.water]?.detail};
 const profile=biomeOf(sim.layout);if(profile)return {name:biomeHint(sim.layout,t),detail:profile.detail};
 const ground=t.ground||groundOf(sim.layout,t.x,t.z),kind=ground==='sand'?'desert':ground==='plain'?(forestAt(sim.layout,t.x,t.z)?'forest':'plain'):ground;
 return {name:TERRAIN_NAMES[kind],detail:EDGE_USES[kind]?.detail};
}
