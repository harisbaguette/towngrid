import {ATLAS_WIDTH,ATLAS_HEIGHT} from './atlas-geometry.js';

// Matches the local camera: orthographic, 35.264 degree elevation, four 90 degree views.
const SIDE=Math.SQRT1_2,HEIGHT=1/Math.sqrt(6),PAD=52;
export const ISO_WIDTH=(ATLAS_WIDTH+ATLAS_HEIGHT)*SIDE+PAD*2;
export const ISO_HEIGHT=(ATLAS_WIDTH+ATLAS_HEIGHT)*HEIGHT+PAD*2;
export const ISO_FULL_VIEW={x:0,y:0,width:ISO_WIDTH,height:ISO_HEIGHT};
export const ATLAS_VIEWS=['남동','북동','북서','남서'];
const matrices=[[SIDE,HEIGHT,-SIDE,HEIGHT],[-SIDE,HEIGHT,-SIDE,-HEIGHT],[-SIDE,-HEIGHT,SIDE,-HEIGHT],[SIDE,-HEIGHT,SIDE,HEIGHT]];
export const normalizeView=q=>((q%4)+4)%4;
export function projectionMatrix(quarter=0){
 const [a,b,c,d]=matrices[normalizeView(quarter)];
 return [a,b,c,d,ISO_WIDTH/2-a*ATLAS_WIDTH/2-c*ATLAS_HEIGHT/2,ISO_HEIGHT/2-b*ATLAS_WIDTH/2-d*ATLAS_HEIGHT/2];
}
export const groundTransform=q=>'matrix('+projectionMatrix(q).join(' ')+')';
export function projectAtlas([x,y],quarter=0){const [a,b,c,d,e,f]=projectionMatrix(quarter);return [a*x+c*y+e,b*x+d*y+f];}
export function unprojectDelta([x,y],quarter=0){const [a,b,c,d]=projectionMatrix(quarter),det=a*d-b*c;return [(d*x-c*y)/det,(-b*x+a*y)/det];}
export function unprojectAtlas([x,y],quarter=0){const m=projectionMatrix(quarter);return unprojectDelta([x-m[4],y-m[5]],quarter);}
export function projectView(view,quarter=0){
 const [x,y]=projectAtlas([view.x+view.width/2,view.y+view.height/2],quarter),scale=view.width/ATLAS_WIDTH,width=ISO_WIDTH*scale,height=ISO_HEIGHT*scale;
 return {x:x-width/2,y:y-height/2,width,height};
}
export function minimapFootprint(view,quarter=0){const v=projectView(view,quarter);return [[v.x,v.y],[v.x+v.width,v.y],[v.x+v.width,v.y+v.height],[v.x,v.y+v.height]].map(p=>unprojectAtlas(p,quarter));}
// Arrow keys move toward the corresponding screen edge in every camera view.
export function screenStep(key,quarter=0){
 const directions={ArrowRight:[1,0],ArrowLeft:[-1,0],ArrowDown:[0,1],ArrowUp:[0,-1]},v=directions[key];if(!v)return null;
 return unprojectDelta(v,quarter).map(n=>Math.sign(n));
}
