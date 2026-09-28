import {NATIONS,ATLAS_POINTS} from './world.js';
export function clipHalf(poly,nx,ny,limit){const out=[];for(let k=0;k<poly.length;k++){const p=poly[k],q=poly[(k+1)%poly.length],a=p[0]*nx+p[1]*ny-limit,b=q[0]*nx+q[1]*ny-limit;if(a<=.0001)out.push(p);if((a<=0)!==(b<=0)){const t=a/(a-b);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}}return out;}
export function voronoi(points,index,boundary=[[45,25],[1255,25],[1255,760],[45,760]]){let poly=boundary;const a=points[index];for(let j=0;j<points.length;j++){if(j===index)continue;const b=points[j];poly=clipHalf(poly,b[0]-a[0],b[1]-a[1],(b[0]**2+b[1]**2-a[0]**2-a[1]**2)/2);}return poly;}
const names=['수도권','북부 구릉','동부 유역','남부 평원','서부 산림','외곽 개척지'];
export const PROVINCES=Object.entries(NATIONS).flatMap(([nation,n],i)=>{
 const boundary=voronoi(ATLAS_POINTS,i),points=[n.point,...Array.from({length:5},(_,j)=>[n.point[0]+Math.cos(j*Math.PI*2/5)*38,n.point[1]+Math.sin(j*Math.PI*2/5)*38])];
 return points.map((point,j)=>({id:nation+'-'+j,nation,name:n.capital+' '+names[j],point,polygon:voronoi(points,j,boundary),capital:j===0,resource:['grain','iron','water','wood','mana','oil'][(i+j)%6]}));
});
export const polygonPath=poly=>'M'+poly.map(p=>p.join(',')).join('L')+'Z';
export function initializeTerritory(c){c.provinces??=Object.fromEntries(PROVINCES.map(p=>[p.id,{owner:p.nation}]));for(const site of c.sites)site.provinceId??=site.nation+'-'+((+site.id.split('-')[1]-1)%6);}
export function tradeConditions(c,siteId){
 const site=c.sites.find(v=>v.id===siteId);if(!site)return {market:1,toll:0,owner:null};
 const owner=c.provinces?.[site.provinceId]?.owner||site.nation,state=c.newStates.find(v=>v.id===owner);
 if(!state)return {market:1,toll:0,owner};
 return {market:state.pact?1.12:state.relation>=55?1.06:state.relation<20?.8:.93,toll:state.pact?0:state.relation>=55?3:12,owner,name:state.name,closed:state.relation<15};
}
export function splitTerritory(c,parent,state){
 initializeTerritory(c);const owned=PROVINCES.filter(p=>c.provinces[p.id].owner===parent&&!p.capital);
 if(!owned.length)return false;
 const start=owned[(c.nextState-1)%owned.length];const selected=owned.sort((a,b)=>Math.hypot(a.point[0]-start.point[0],a.point[1]-start.point[1])-Math.hypot(b.point[0]-start.point[0],b.point[1]-start.point[1])).slice(0,Math.max(1,Math.floor(owned.length/2)));
 for(const p of selected)c.provinces[p.id].owner=state.id;
 const ancestor=c.newStates.find(v=>v.id===parent);if(ancestor){ancestor.provinceIds=PROVINCES.filter(p=>c.provinces[p.id].owner===parent).map(p=>p.id);ancestor.dissolved=ancestor.provinceIds.length===0;if(ancestor.dissolved)c.recognition=c.recognition.filter(id=>id!==parent);}
 state.provinceIds=selected.map(p=>p.id);state.point=start.point;state.capitalProvince=start.id;
 for(const site of c.sites)if(state.provinceIds.includes(site.provinceId)){site.territory=false;site.unrest=Math.max(30,site.unrest);}
 return true;
}
