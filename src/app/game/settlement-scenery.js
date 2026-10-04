import {landscapeHash as hash} from './landscape-colors.js';

// Existing NPC places expand into streets and real building art at their fixed
// world location. This is scenery, not an extra production simulation.
export function settlementPlan(plot,tiles,hostile=false){
 const buildings=[],roads=new Set(),occupied=new Set(),tile=(x,z)=>x>=0&&z>=0&&x<24&&z<24?tiles[z*24+x]:null;
 const road=(x,z)=>{if(tile(x,z)&&!tile(x,z).water&&!occupied.has(x+','+z))roads.add(x+','+z);};
 const add=(type,x,z)=>{const t=tile(x,z),key=x+','+z;if(!t||t.water||roads.has(key)||occupied.has(key))return false;occupied.add(key);buildings.push({type,x,z,health:100,working:false,enabled:true,inputs:{},inventory:{}});return true;};
 const r=plot.capital?7:4;
 for(let n=12-r;n<=12+r;n++){road(n,12);road(12,n);if(plot.capital){road(n,8);road(n,16);}}
 add(hostile?'fortress':'marketplace',11,11);add('warehouse',13,11);add('well',11,13);
 const sites=[];
 for(let z=12-r;z<=12+r;z++)for(let x=12-r;x<=12+r;x++)if(!roads.has(x+','+z)&&[[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>roads.has((x+a)+','+(z+b))))sites.push([x,z]);
 sites.sort((a,b)=>hash(a[0]+plot.cell[0]*24,a[1]+plot.cell[1]*24)-hash(b[0]+plot.cell[0]*24,b[1]+plot.cell[1]*24));
 const types=hostile?['house','house','magetower','fortress','smelter']:['house','house','house','bakery','sawmill','depot','house'];
 for(const [i,[x,z]]of sites.slice(0,plot.capital?29:13).entries())add(types[i%types.length],x,z);
 const water=tiles.find(t=>['coast','river','lake'].includes(t.water)&&[[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>tile(t.x+a,t.z+b)&&!tile(t.x+a,t.z+b).water));
 if(water){const type={coast:'coastport',river:'riverport',lake:'lakeport'}[water.water];buildings.push({type,x:water.x,z:water.z,health:100,working:false,inputs:{},inventory:{}});occupied.add(water.x+','+water.z);}
 return {buildings,roads,occupied};
}
