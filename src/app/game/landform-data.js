import {MAP,COLS,ROWS,terrainOfCell,WATER_KINDS} from './world-grid.js';
import {landscapeNoise as noise,landscapeHash as hash,mixColor} from './landscape-colors.js';
import {waterInlet} from './landform-patterns.js';

// These describe the landscape, not new production biomes or save-file values.
export const LANDFORMS={
 meadow:{name:'비옥한 평야',color:[155,181,94]},dryGrass:{name:'건조 초원',color:[183,178,104]},flowerMeadow:{name:'꽃 초원',color:[145,176,99]},highlandGrass:{name:'고산 초원',color:[140,163,115]},
 woodland:{name:'활엽수림',color:[104,142,77]},pineForest:{name:'침엽수림',color:[99,136,99]},wetForest:{name:'습윤 숲',color:[102,143,94]},
 dunes:{name:'모래언덕 사막',color:[220,191,133]},gravelDesert:{name:'자갈 사막',color:[183,166,128]},rockDesert:{name:'암석 사막',color:[192,146,110]},oasis:{name:'오아시스',color:[142,169,87]},
 oilfield:{name:'유전 지대',color:[119,109,85]},mountain:{name:'일반 산',color:[138,145,115]},rockMountain:{name:'암산',color:[146,140,124]},snowMountain:{name:'설산',color:[204,220,218]},volcano:{name:'화산',color:[110,110,116]},
 snowfield:{name:'설원',color:[219,233,228]},glacier:{name:'빙하 지대',color:[195,220,224]},marsh:{name:'갈대 습지',color:[126,149,92]},tidalFlat:{name:'갯벌',color:[160,160,117]},
 beach:{name:'모래 해안',color:[220,207,160]},shingle:{name:'자갈 해안',color:[172,177,159]},basin:{name:'광산 분지',color:[156,153,127]},volcanic:{name:'화산 고원',color:[115,117,119]},
 coast:{name:'바다',color:[36,123,156]},lake:{name:'호수',color:[57,143,157]},pond:{name:'연못',color:[95,154,136]},river:{name:'강',color:[56,153,167]},stream:{name:'천',color:[111,172,170]},canal:{name:'운하',color:[82,141,149]}
};
export const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const smooth=(a,b,n)=>{const t=clamp((n-a)/(b-a));return t*t*(3-2*t);};
const inside=(x,z)=>x>=0&&z>=0&&x<COLS&&z<ROWS;
const mountainAt=(x,z)=>inside(x,z)&&terrainOfCell(x,z)==='mountain';
const profiles=new Map();
export function landformOf(layout){
 const [cx,cz]=layout.cell||[0,0],key=[cx,cz,layout.biome,layout.ecology].join(':');
 if(profiles.has(key))return profiles.get(key);
 const n=noise(cx*.64+17,cz*.64+31),edge=Object.values(layout.edges||{}),eco=layout.ecology;
 let id='meadow';
 if(layout.biome==='mountain'){
  const frozen=cz<5||edge.includes('ice');
  id=frozen?'snowMountain':noise(cx*.49+41,cz*.49+8)>.82?'volcano':n<.43?'rockMountain':'mountain';
 }else if(WATER_KINDS.includes(layout.biome))id=layout.biome;
 else if(eco==='snow'||layout.biome==='ice')id=n>.52?'glacier':'snowfield';
 else if(eco==='desert'||layout.biome==='desert')id=n<.38?'gravelDesert':n>.62?'rockDesert':'dunes';
 else if(eco==='forest')id=n<.34?'pineForest':n>.64?'wetForest':'woodland';
 else if(eco==='marsh')id=edge.includes('coast')?'tidalFlat':'marsh';
 else if(eco==='coast')id=edge.some(k=>['river','stream','lake'].includes(k))?'tidalFlat':n>.6?'shingle':'beach';
 else if(eco==='volcanic')id='volcanic';
 else if(eco==='basin')id='basin';
 else id=edge.includes('mountain')||cz<5?'highlandGrass':n<.37?'dryGrass':n>.60?'flowerMeadow':'meadow';
 const result={id,...LANDFORMS[id]};profiles.set(key,result);return result;
}
export function surfaceLandform(layout,t){
 if(t?.water)return t.water;
 if(t?.oasis)return 'oasis';
 if(t?.oil>=85&&!t?.sold)return 'oilfield';
 if(t?.ground==='ice')return 'snowfield';
 if(t?.ground==='mountain'&&layout.biome!=='mountain')return 'basin';
 if(t?.ground==='sand'&&!['desert','coast'].includes(layout.ecology))return 'beach';
 return landformOf(layout).id;
}
export function landformName(layout){return landformOf(layout).name;}

// One absolute height field shared by every mountain cell and every zoom level.
// The boundary with a playable plot is exactly level; saved buildings stay put.
function mountainBaseHeight(x,z){
 const cx=Math.floor((x+.5)/MAP),cz=Math.floor((z+.5)/MAP);
 if(!mountainAt(cx,cz))return 0;
 let boundary=24,peak=0;
 for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
  const a=cx+dx,b=cz+dz;
  if(!mountainAt(a,b)){
   const ex=Math.max(a*MAP-.5-x,0,x-((a+1)*MAP-.5)),ez=Math.max(b*MAP-.5-z,0,z-((b+1)*MAP-.5));boundary=Math.min(boundary,Math.hypot(ex,ez));
  }else{
   const h=hash(a,b),px=a*MAP+8+h*7,pz=b*MAP+8+hash(b,a)*7;
   const r=Math.hypot((x-px)/9,(z-pz)/11);peak=Math.max(peak,(12+h*5)*Math.max(0,1-r/1.8)**1.25);
  }
 }
 const ridge=1-Math.abs(noise(x*.095+8,z*.095+41)*2-1);
 let height=(peak+ridge*3+noise(x*.27,z*.27)*1.3)*smooth(0,5,boundary);
 const layout={cell:[cx,cz],biome:'mountain',edges:{n:terrainOfCell(cx,cz-1),e:terrainOfCell(cx+1,cz),s:terrainOfCell(cx,cz+1),w:terrainOfCell(cx-1,cz)}};
 if(landformOf(layout).id==='volcano'){
  const h=hash(cx,cz),r=Math.hypot(x-(cx*MAP+8+h*7),z-(cz*MAP+8+hash(cz,cx)*7));
  height-=5*Math.exp(-((r/2.4)**2));
 }
 return Math.max(0,height);
}
const courses=new Map();
export function mountainCourse(cell){
 const key=cell.cx+','+cell.cz;if(courses.has(key))return courses.get(key);
 if(!mountainAt(cell.cx,cell.cz))return null;
 const sides=[['n',0,-1],['e',1,0],['s',0,1],['w',-1,0]],edge=sides.find(([,dx,dz])=>['river','stream'].includes(terrainOfCell(cell.cx+dx,cell.cz+dz)));
 if(!edge){courses.set(key,null);return null;}
 const [side,dx,dz]=edge,h=hash(cell.cx,cell.cz),u=waterInlet(cell.cx,cell.cz,side),a=[cell.cx*24+8+h*7,cell.cz*24+8+hash(cell.cz,cell.cx)*7];
 const b=[cell.cx*24+(dx===1?23.5:dx===-1?-.5:u),cell.cz*24+(dz===1?23.5:dz===-1?-.5:u)],points=[];
 let level=mountainBaseHeight(...a);
 for(let i=0;i<=24;i++){const t=i/24,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;level=Math.min(level,mountainBaseHeight(x,z));points.push({x,z,height:Math.max(0,Math.floor(level*2)/2-.18)});}
 const course={side,a,b,points};courses.set(key,course);return course;
}
export function mountainWater(x,z){
 const cx=Math.floor((x+.5)/24),cz=Math.floor((z+.5)/24),course=mountainCourse({cx,cz});if(!course)return null;
 const {a,b,points}=course,dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)),distance=Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t),index=Math.min(23,Math.floor(t*24)),f=t*24-index;
 if(distance>1.25)return null;
 return {distance,height:points[index].height*(1-f)+points[index+1].height*f,flow:[dx/Math.hypot(dx,dz),dz/Math.hypot(dx,dz)]};
}
export function mountainHeight(x,z){
 const base=mountainBaseHeight(x,z);if(!base)return 0;const water=mountainWater(x,z);
 return water?base+(Math.min(base,water.height)-base)*(1-smooth(.4,1.25,water.distance)):base;
}
export function reliefHeight(x,z){
 const x0=Math.floor((x+.5)/2)*2-.5,z0=Math.floor((z+.5)/2)*2-.5,u=(x-x0)/2,v=(z-z0)/2;
 const a=mountainHeight(x0,z0),b=mountainHeight(x0+2,z0),c=mountainHeight(x0,z0+2),d=mountainHeight(x0+2,z0+2);
 return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
}

// A navigable world-water cell has one connected bed, not 576 identical stamps.
// Only uninhabitable cells use this geometry; local/saved water tiles are authoritative.
export function waterCellShape(cell,x,z){
 const kind=cell.terrain,lx=x-cell.cx*MAP,lz=z-cell.cz*MAP;
 const neighbors=[[0,-1],[1,0],[0,1],[-1,0]].map(([dx,dz])=>terrainOfCell(cell.cx+dx,cell.cz+dz));
 if(kind==='coast'||kind==='lake'){
  let bank=100;
  for(const [i,d]of [lz+.5,23.5-lx,23.5-lz,lx+.5].entries())if(!WATER_KINDS.includes(neighbors[i]))bank=Math.min(bank,d);
  // Taper each corner inside the water footprint; a complete wet edge stays joined.
  const shore=kind==='coast'?.45:.3;
  return {water:kind,depth:clamp((bank-shore)/6),bank:Math.max(0,bank)};
 }
 const center=[11.5,11.5],segments=[],inlets=[];
 for(const [i,p]of [[11.5,-.5],[23.5,11.5],[11.5,23.5],[-.5,11.5]].entries())if(WATER_KINDS.includes(neighbors[i]))segments.push([center,p]);
 for(const [i,side]of ['n','e','s','w'].entries())if(!WATER_KINDS.includes(neighbors[i])&&(neighbors[i]!=='mountain'||['river','stream'].includes(kind)&&mountainCourse({cx:cell.cx+[0,1,0,-1][i],cz:cell.cz+[-1,0,1,0][i]})?.side===['s','w','n','e'][i])){
  const u=waterInlet(cell.cx,cell.cz,side),p=i===0?[u,-.5]:i===1?[23.5,u]:i===2?[u,23.5]:[-.5,u];inlets.push([center,p]);
 }
 if(!segments.length)segments.push([[11.5,-.5],[11.5,23.5]]);
 let distance=Infinity,flow=[0,1];
 for(const [a,b]of segments){const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((lx-a[0])*dx+(lz-a[1])*dz)/(dx*dx+dz*dz)),d=Math.hypot(lx-a[0]-dx*t,lz-a[1]-dz*t);if(d<distance){distance=d;flow=[dx/12,dz/12];}}
 const width=kind==='river'?7:kind==='canal'?2.7:2.2;
 // Endpoints keep a fixed width so bends and confluences share exactly the same edge.
 const edge=Math.min(lx+.5,lz+.5,23.5-lx,23.5-lz),bend=kind==='canal'?0:(noise(x*.19+2,z*.19+7)-.5)*1.7*smooth(0,4,edge);
 let bank=width+bend-distance;
 for(const [a,b]of inlets){const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((lx-a[0])*dx+(lz-a[1])*dz)/(dx*dx+dz*dz)),d=Math.hypot(lx-a[0]-dx*t,lz-a[1]-dz*t),w=kind==='river'?1.7:kind==='canal'?1.2:1.05;bank=Math.max(bank,w-d);}
 return {water:bank>=0?kind:null,depth:clamp(bank/(kind==='river'?5:2.5)),bank,flow};
}

export function landformColor(id,x,z,height=0){
 let color=LANDFORMS[id]?.color||LANDFORMS.meadow.color;
 const broad=noise(x*.11+5,z*.11+17),grain=hash(Math.floor(x*5),Math.floor(z*5));
 if(['mountain','rockMountain','snowMountain','volcano'].includes(id)){
  const snow=id!=='volcano'&&height>clamp(7+(z/24-1)*1.5,7,23)+noise(x*.3,z*.3)*1.4;
  color=snow?[220,235,232]:height>5?[145,148,143]:id==='volcano'?[100,108,112]:mixColor(LANDFORMS.meadow.color,[143,145,122],clamp(height/5));
  if(id==='rockMountain')color=mixColor(color,[161,141,115],.35);
  if(id==='volcano'&&height>7)color=mixColor(color,[113,92,82],.35);
 }else if(id==='dunes'){
  const phase=x*.46+z*.22+noise(x*.085,z*.085)*5,wave=Math.sin(phase),lee=wave>.6?(wave-.6)*-42:wave*16;color=color.map(c=>c+Math.round(lee/3)*3);
 }else if(id==='rockDesert'){
  const band=Math.sin(z*.7+noise(x*.18,z*.12)*3);color=mixColor(color,[161,110,85],band>.4?.25:0);
 }else if(id==='gravelDesert')color=color.map(c=>c+(grain>.78?-20:grain<.13?12:0));
 else if(id==='oilfield')color=mixColor(color,[67,68,65],broad>.5?.42:.15);
 else if(id==='glacier')color=mixColor(color,[139,187,205],Math.abs(Math.sin(x*.61+z*.22+noise(x*.2,z*.2)*3))>.985?.55:0);
 else if(id==='volcanic')color=color.map(c=>c+(grain>.82?-16:5));
 else if(id==='marsh'||id==='wetForest')color=mixColor(color,[102,119,78],broad>.55?.35:0);
 else if(['meadow','dryGrass','flowerMeadow','highlandGrass','woodland','pineForest'].includes(id))color=mixColor(color,[192,181,114],broad>.62?(broad-.62)*1.1:0);
 return color.map(c=>c+Math.round((broad-.5)*12)+(grain-.5)*7);
}
