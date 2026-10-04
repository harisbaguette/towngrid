import {PROVINCES,PLOT_INDEX,sovereignOf,successorOf} from './territory.js';
import {worldCellAt,localToWorld,cellLayout} from './world-space.js';
import {WORLD_REALMS} from './world-politics.js';

const provincesByCell=new Map(PROVINCES.flatMap(p=>p.cells.map(c=>[c.join(','),p.id])));
export function musicNation(id,campaign){
 if(id===null||id===undefined)return null;
 const root=campaign?.newStates?.find(s=>s.id===id)?.rootNation||id;
 return WORLD_REALMS[root]?root:WORLD_REALMS[successorOf(root)]?successorOf(root):null;
}
// Uses the place under the camera, not the citizenship of the active settlement.
export function musicLocation(sim,camera,view={}){
 if(!sim?.provinceId)return null;
 const cell=worldCellAt(...localToWorld(sim,camera?.x??11.5,camera?.z??11.5));
 if(!cell)return {world:true,nation:null,ecology:null};
 const id=cell.site||provincesByCell.get(cell.cx+','+cell.cz),p=PLOT_INDEX.get(id);
 const owner=sovereignOf(id,sim.campaign?.provinces||{});
 const nation=musicNation(owner,sim.campaign),ecology=cellLayout(cell.cx,cell.cz).ecology;
 return {nation,ecology,provinceId:p?.id||null,world:(view.span??55)>850,country:(view.span??55)>240};
}
