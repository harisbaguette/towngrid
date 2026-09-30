import {NEW_VEHICLE_SIZES} from './vehicle-art.js';
export const MOTION_FRAMES=8;
export const CRANE_RIGS={
 coastport:[[143,66,179,108,160,54,160,89],[28,64,63,107,45,49,45,87],[129,65,162,102,144,48,145,84],[13,65,48,108,29,55,30,88]],
 riverport:[[153,84,180,117,166,73,166,102],[27,77,52,109,39,60,39,95],[138,75,161,102,148,59,149,88],[15,84,41,114,27,72,28,101]],
 polarport:[[154,78,179,106,167,64,167,94],[21,70,45,97,32,57,33,84],[141,72,158,90,146,59,148,80],[13,77,38,106,24,61,25,95]],
};
export const MOTION_ASSETS={
 ...Object.fromEntries(Object.entries(NEW_VEHICLE_SIZES).map(([id,size])=>[id+'Motion',{scenery:true,sheet:`/assets/pixel-environment/${id}Motion.png`,frames:MOTION_FRAMES,directions:4,anchor:[.5,181/192],size}])),
 ...Object.fromEntries(Object.keys(CRANE_RIGS).flatMap(id=>['Body','Hoist'].map(kind=>[id+kind,{cutout:true,structure:kind==='Body',sheet:`/assets/pixel-environment/${id+kind}.png`,frames:1,directions:4,anchor:[.5,.69],size:1.4}]))),
};
// Distance, not wall-clock time, advances legs and wheels. Camera changes and
// pauses therefore preserve the pose, while a moved/rebuilt model starts cleanly.
export function vehicleMotion(u,time,position){
 const previous=u.motionPosition;
 if(previous&&time>previous.time){const distance=Math.hypot(position.x-previous.x,position.z-previous.z);u.motionMoving=distance>.00001&&distance<4;if(u.motionMoving)u.motionDistance=(u.motionDistance||0)+distance;}
 else if(previous&&time===previous.time)return Math.floor((u.motionDistance||0)*12)%MOTION_FRAMES;
 else u.motionMoving=false;
 u.motionPosition={x:position.x,z:position.z,time};
 return Math.floor((u.motionDistance||0)*12)%MOTION_FRAMES;
}
