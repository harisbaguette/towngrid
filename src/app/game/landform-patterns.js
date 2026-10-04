import {landscapeHash as hash,landscapeNoise as noise} from './landscape-colors.js';

// Both sides of an interface derive the same inlet from its absolute grid edge.
export function waterInlet(cx,cz,side){
 const vertical=side==='e'||side==='w',a=cx+(side==='e'?1:0),b=cz+(side==='s'?1:0);
 return hash(a*3+(vertical?1:0),b*3)>.5?18:5;
}
export function branchWater(layout,side,kind,d,u){
 if(d<0||d>6)return false;
 const [cx,cz]=layout.cell||[0,0],center=waterInlet(cx,cz,side)+Math.sin(d*.65)*.6;
 const radius=kind==='river'?1.7:kind==='canal'?1.2:1.05;
 if(d>3.5&&kind!=='canal')return ((d-4.5)/2.5)**2+((u-center)/(radius+.65))**2<1;
 return Math.abs(u-center)<radius;
}
export function pondAt(layout,x,z){
 const [cx,cz]=layout.cell||[0,0],h=hash(cx+7,cz+23),a=h<.5?3+Math.floor(h*5):18+Math.floor(h*5)%3,b=3+Math.floor(hash(cz+13,cx)*3);
 return ((x-a)/1.4)**2+((z-b)/1.15)**2<1;
}
export function treeCluster(layout,x,z){
 const [cx,cz]=layout.cell||[0,0];return noise((cx*24+x)*.18+11,(cz*24+z)*.18+29);
}
export function oilPockets(layout){
 if(!layout.surfaceVersion)return [[17,7],[18,17],[6,19]];
 const [cx,cz]=layout.cell||[0,0];return [[17,7],[18,17],[6,19]].map(([x,z],i)=>[x+(hash(cx+i*4,cz+31)-.5)*5,z+(hash(cx+19,cz+i*7)-.5)*5]);
}
