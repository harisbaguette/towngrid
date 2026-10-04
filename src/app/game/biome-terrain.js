import {BIOMES,biomeOf,biomeHash} from './biome-data.js';
import {waterAt,groundOf,forestAt} from './world-grid.js';
import {treeCluster,oilPockets} from './landform-patterns.js';
import {landformOf} from './landform-data.js';

const mix=(range,v)=>Math.round(range[0]+(range[1]-range[0])*v);
const fresh=(layout,x,z,radius)=>{for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){const w=waterAt(layout,x+dx,z+dz);if(w&&w!=='coast')return true;}return false;};
export const oasisAt=(layout,x,z)=>layout.ecology==='desert'&&fresh(layout,x,z,2);
export function oilConcentration(layout,x,z,seed=0){
 const field=layout.ecology==='desert'&&oilPockets(layout).some(([a,b])=>((x-a)/3.5)**2+((z-b)/2.5)**2<1);
 return mix(layout.ecology==='desert'?(field?[85,100]:[30,55]):[25,60],biomeHash(x+53,z+17,seed));
}
export function biomeTile(layout,t,seed=0){
 const p=biomeOf(layout);if(!p)return t;
 const {x,z}=t,id=layout.ecology,h=(dx,dz)=>biomeHash(x+dx,z+dz,seed);
 t.fertility=mix(p.fertility,h(17,4));t.moisture=mix(p.moisture,h(8,22));t.ore=mix(p.ore,h(31,7));t.mana=mix(p.mana,h(43,51));t.oil=oilConcentration(layout,x,z,seed);
 if(t.ground==='mountain')t.ore=Math.max(t.ore,mix([80,100],h(31,7)));
 // Petroleum has its own spatial field; iron and coal no longer stand in for oil in new maps.
 if(id==='desert'){
  if(fresh(layout,x,z,2)){t.fertility=mix([70,90],h(17,4));t.moisture=mix([75,100],h(8,22));t.oasis=true;}
 }
 const forest=forestAt(layout,x,z),cluster=layout.surfaceVersion?.1+treeCluster(layout,x,z)*1.8:1;
 const trees=(forest?Math.max(id==='desert'?.22:id==='snow'?.35:.48,p.tree):t.oasis?Math.max(.18,p.tree):p.tree)*cluster;
 const rocks=t.ground==='mountain'?Math.max(.35,p.rock):p.rock;
 const n=h(0,0),choice=h(3,9);
 t.nature=t.water?null:n<Math.min(.82,trees+rocks)?(choice<trees/(trees+rocks)?'tree':'rock'):null;
 if(x>=9&&x<=14&&z>=10&&z<=15)t.nature=null;
 if((x===8&&z===8)||(x===8&&z===9)||(x===9&&z===8))t.nature='tree';
 if((x===15&&z===8)||(x===15&&z===9)||(x===14&&z===8))t.nature='rock';
 t.remaining=t.nature==='tree'?p.wood:t.nature==='rock'?(t.ground==='mountain'?180:p.stone):0;
 return t;
}
/** Authored ground, shared by playable cells and the surrounding landscape. */
export function biomeSurface(layout,x,z,ground=groundOf(layout,x,z)){
 const p=biomeOf(layout);if(!p)return null;
 if(ground==='ice'||layout.ecology==='snow')return 0;
 if(layout.ecology==='desert'&&fresh(layout,x,z,2))return 1;
 if(ground==='mountain')return layout.ecology==='volcanic'?7:3;
 if(ground==='sand')return 4;
 if(layout.ecology==='coast')return fresh(layout,x,z,1)?1:5;
 if(layout.ecology==='meadow'&&forestAt(layout,x,z))return 2;
 return p.frame;
}
export function biomeTree(layout,t){
 if(!biomeOf(layout))return null;
 if(t.ground==='ice'||layout.ecology==='snow')return 'snowPine';
 if(t.oasis||layout.ecology==='desert'||layout.ecology==='coast')return 'palm';
 if(layout.ecology==='marsh')return 'willow';
 if(layout.ecology==='forest'||forestAt(layout,t.x,t.z)){const id=landformOf(layout).id;return id==='pineForest'?'pine':id==='wetForest'?'willow':'forestTree';}
 return layout.ecology==='basin'||layout.ecology==='volcanic'?'pine':'forestTree';
}
export function biomeDecoration(layout,t){
 if(!biomeOf(layout))return null;
 const n=biomeHash(t.x+5,t.z);
 // A feature sold off (land-sale.js) is gone; a sold seep keeps no cactus either.
 if(t.sold)return null;
 if(layout.ecology==='desert'){if(t.oil>=85&&n>.60)return 'oilSeep';if(!t.oasis&&n>.93)return 'cactus';}
 if(layout.ecology==='snow')return null;
 if(n>.64&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>['pond','lake','river','stream'].includes(waterAt(layout,t.x+dx,t.z+dz))))return 'reeds';
 if(layout.ecology==='marsh'&&n>.68)return 'reeds';
 return n>.95&&layout.ecology!=='volcanic'?'bush':null;
}
export function biomeHint(layout,t){
 if(!biomeOf(layout))return null;
 if(t.oasis)return '오아시스 주변 · 비옥도와 수분이 높은 땅';
 if(layout.ecology==='desert'&&t.oil>=85)return '유전 · 원유 농도 '+t.oil+'%';
 if(t.ground==='mountain')return '산악 광맥 · 광물량 '+t.ore+'%';
 return BIOMES[layout.ecology].name;
}

