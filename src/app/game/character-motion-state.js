import {pixelAction,pixelDirection,pixelClip,pixelFrame} from './pixel-character-data.js';

// Animation state stays with the rendered model, never in a saved worker.
export function characterPose(state,worker,time,cameraAzimuth,metadata,distance=0){
 let action=pixelAction(worker);
 const hurt=pixelClip('hurt',metadata),turn=pixelClip('turn',metadata);
 const desired=pixelDirection(worker.dir||0,cameraAzimuth);
 const cameraChanged=state.cameraAzimuth!==undefined&&Math.abs(cameraAzimuth-state.cameraAzimuth)>.01;
 const headingChanged=state.heading!==undefined&&Math.abs((worker.dir||0)-state.heading)>.01;
 const previousDirection=state.desiredDirection??desired;
 // A planted pivot belongs to an empty-handed, stationary actor. Replacing a
 // moving/loaded/handling pose with it makes feet slide and cargo disappear.
 if(cameraChanged||action!=='idle')state.turnAt=undefined;
 else if(headingChanged&&desired!==previousDirection&&metadata?.clips?.turn){state.turnAt=time;state.turnFrom=previousDirection;}
 const hurting=state.hurtAt!==undefined&&time-state.hurtAt<hurt.frames.length/hurt.fps;
 if(Number.isFinite(worker.hp)&&Number.isFinite(state.hp)&&worker.hp<state.hp&&!hurting)state.hurtAt=time;
 state.hp=worker.hp;state.heading=worker.dir||0;state.cameraAzimuth=cameraAzimuth;state.desiredDirection=desired;
 let direction=desired;
 if(action!=='defeat'&&state.hurtAt!==undefined&&metadata?.clips?.hurt&&time-state.hurtAt<hurt.frames.length/hurt.fps)action='hurt';
 else if(action==='idle'&&state.turnAt!==undefined&&metadata?.clips?.turn&&time-state.turnAt<turn.frames.length/turn.fps){
  action='turn';direction=(time-state.turnAt)*turn.fps<(metadata.turnMidpoint??2)?state.turnFrom:desired;
 }
 if(action!==state.action){state.action=action;state.actionAt=time;}
 let elapsed=['pickup','drop'].includes(action)?worker.handlingTime||0:time-state.actionAt;
 if(action==='hurt')elapsed=time-state.hurtAt;
 if(action==='turn')elapsed=time-state.turnAt;
 if(action==='walk'||action==='carry'){
  const clip=pixelClip(action,metadata);
  elapsed=clip.strideLength?distance/clip.strideLength*clip.frames.length/clip.fps:distance/1.25;
 }
 // The final lift pose has planted feet and the box held at carrying height.
 // Keep it between pickup and the first moving tick, or while a carrier waits.
 const holding=action==='carry'&&!worker.walking&&metadata?.clips?.pickup;
 const frame=holding?metadata.clips.pickup.frames.at(-1):pixelFrame(action,elapsed,1,metadata);
 return {action,direction,elapsed,frame};
}
