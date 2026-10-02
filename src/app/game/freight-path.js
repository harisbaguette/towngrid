const directions = [[0,-1],[1,0],[0,1],[-1,0]];
const key = p => p.x + ',' + p.z;

// Presentation only: use the rails connected to this site's station. Never
// interpolate through unbuilt land or change the campaign's delivery clock.
export function stationRailPath(sim) {
 const station = sim.buildings.find(b => b.type === 'station' && b.health > 0 && b.enabled !== false);
 if (!station) return [];
 const queue = [], parents = new Map();
 const enqueue = (x,z,parent) => {
  const id = x + ',' + z;
  if (parents.has(id) || !sim.rails?.has(id) || sim.tile(x,z)?.terrain === 'water' || sim.at(x,z)) return;
  const point = {x,z}; parents.set(id,parent); queue.push(point);
 };
 for (const [dx,dz] of directions) enqueue(station.x+dx,station.z+dz,null);
 for (let i=0;i<queue.length;i++) {
  const point = queue[i];
  for (const [dx,dz] of directions) enqueue(point.x+dx,point.z+dz,point);
 }
 if (!queue.length) return [];
 const tiles = [];
 for (let point=queue.at(-1);point;point=parents.get(key(point))) tiles.push(point);
 tiles.reverse();
 if (tiles.length === 1) return [{...tiles[0],dir:Math.atan2(tiles[0].x-station.x,tiles[0].z-station.z)}];
 const points = [{x:(station.x+tiles[0].x)/2,z:(station.z+tiles[0].z)/2}];
 for (let i=0;i<tiles.length-1;i++) {
  const p=tiles[i],a=tiles[i-1]||station,b=tiles[i+1];
  const ax=a.x-p.x,az=a.z-p.z,bx=b.x-p.x,bz=b.z-p.z;
  if (ax*bx+az*bz === -1) { points.push(p); continue; }
  // The renderer bends a corner around the shared outer tile corner (r=.5).
  const cx=p.x+(ax+bx)/2,cz=p.z+(az+bz)/2;
  const start=Math.atan2(-bz,-bx),end=Math.atan2(-az,-ax);
  const turn=Math.atan2(Math.sin(end-start),Math.cos(end-start));
  for (let step=0;step<=8;step++) {
   const angle=start+turn*step/8;
   points.push({x:cx+Math.cos(angle)/2,z:cz+Math.sin(angle)/2});
  }
 }
 points.push(tiles.at(-1));
 return points;
}

export function railPathPose(path, progress, inbound = false) {
 if (!path.length) return null;
 if (path.length === 1) return {...path[0],dir:path[0].dir+(inbound?Math.PI:0)};
 const lengths = path.slice(1).map((p,i)=>Math.hypot(p.x-path[i].x,p.z-path[i].z));
 const p = Math.max(0,Math.min(1,Number.isFinite(progress)?progress:0));
 let distance = lengths.reduce((a,b)=>a+b,0)*(inbound?1-p:p);
 for (let i=0;i<lengths.length;i++) {
  if (distance>lengths[i] && i<lengths.length-1) { distance-=lengths[i]; continue; }
  const a=path[i],b=path[i+1],t=lengths[i]?Math.min(1,distance/lengths[i]):0;
  return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,dir:Math.atan2(b.x-a.x,b.z-a.z)+(inbound?Math.PI:0)};
 }
}
