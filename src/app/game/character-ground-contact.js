import {QUARTER_POLAR} from './quarter-camera.js';

// A billboard's lower edge is not its contact point. Convert the planted sole
// recorded in the cel back to the horizontal ground plane before sampling it.
export function characterSupportPoints(worker, metadata, direction, frame, atlas, height, azimuth) {
 const audit=metadata?.rigAudit?.[direction]?.[frame];
 const feet=audit?.feet?.filter(foot=>foot.contact&&(foot.lift||0)<.001) || [];
 const soles=feet.map(foot=>foot.supportPoint||foot.sole).filter(Boolean);
 if(!soles.length&&audit?.sole)soles.push(audit.sole);
 const cell=Array.isArray(metadata?.cell)?metadata.cell:[metadata?.cell||128,metadata?.cell||128];
 const scale=height*atlas.scale,cos=Math.cos(azimuth),sin=Math.sin(azimuth);
 return soles.map(([x,y])=>{
  const right=(x/cell[0]-atlas.anchor[0])*scale;
  const back=(y/cell[1]-atlas.anchor[1])*scale/Math.cos(QUARTER_POLAR);
  return {x:worker.x+cos*right+sin*back,z:worker.z-sin*right+cos*back};
 });
}

export function characterGroundHeight(worker, metadata, direction, frame, atlas, height, azimuth, surface) {
 if(typeof surface!=='function')return Number.isFinite(surface)?surface:.026;
 const points=metadata?.locomotionMode==='hover'?[]:characterSupportPoints(worker,metadata,direction,frame,atlas,height,azimuth);
 if(!points.length)return surface(worker.x,worker.z);
 // A whole drawn cel cannot bend one leg for a step. Keep every planted foot
 // above the surface; separate stepped-ground poses are needed for larger rises.
 return Math.max(...points.map(point=>surface(point.x,point.z)));
}
