import {pixelAction,pixelDirection,pixelClip,pixelFrame} from './pixel-character-data.js';

// Animation state stays with the rendered model, never in a saved worker.
export function characterPose(state,worker,time,cameraAzimuth,metadata,distance=0){
 const desired=pixelDirection(worker.dir||0,cameraAzimuth);
 const cameraChanged=state.cameraAzimuth!==undefined&&Math.abs(cameraAzimuth-state.cameraAzimuth)>.01;
 const headingChanged=state.heading!==undefined&&Math.abs((worker.dir||0)-state.heading)>.01;
 const previousDirection=state.desiredDirection??desired;
 if(cameraChanged)state.turnAt=undefined;
 else if(headingChanged&&desired!==previousDirection&&metadata?.clips?.turn){state.turnAt=time;state.turnFrom=previousDirection;}
 if(Number.isFinite(worker.hp)&&Number.isFinite(state.hp)&&worker.hp<state.hp)state.hurtAt=time;
 state.hp=worker.hp;state.heading=worker.dir||0;state.cameraAzimuth=cameraAzimuth;state.desiredDirection=desired;
 let action=pixelAction(worker),direction=desired;
 const hurt=pixelClip('hurt',metadata),turn=pixelClip('turn',metadata);
 if(action!=='defeat'&&state.hurtAt!==undefined&&metadata?.clips?.hurt&&time-state.hurtAt<hurt.frames.length/hurt.fps)action='hurt';
 else if(!['attack','defeat'].includes(action)&&state.turnAt!==undefined&&metadata?.clips?.turn&&time-state.turnAt<turn.frames.length/turn.fps){
  action='turn';direction=(time-state.turnAt)*turn.fps<(metadata.turnMidpoint??2)?state.turnFrom:desired;
 }
 if(action!==state.action){state.action=action;state.actionAt=time;}
 let elapsed=worker.handling?worker.handlingTime||0:time-state.actionAt;
 if(action==='hurt')elapsed=time-state.hurtAt;
 if(action==='turn')elapsed=time-state.turnAt;
 if(action==='walk'||action==='carry'){
  const clip=pixelClip(action,metadata);
  elapsed=clip.strideLength?distance/clip.strideLength*clip.frames.length/clip.fps:distance/1.25;
 }
 return {action,direction,elapsed,frame:pixelFrame(action,elapsed,1,metadata)};
}
