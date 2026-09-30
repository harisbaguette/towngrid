// Authored standing, four walk poses and three feeding poses. Coordinates
// are on the packed 192px building cell, in SE / NE / NW / SW view order.
export const FARM_MOTION_ASSETS = Object.fromEntries(['Sheep','Cow','Duck','Bee'].map(name=>['farm'+name,{
 cutout:true,sheet:'/assets/pixel-environment/farm'+name+'.png',frames:name==='Bee'?4:8,
 directions:name==='Bee'?1:4,anchor:[.5,176/192],size:.3,
}]));

export const FARM_ANIMALS = {
 sheeppen:{atlas:'farmSheep',size:.27,animals:[
  {centers:[[81,128],[76,133],[76,123],[124,129]],phase:0},
  {centers:[[113,122],[96,119],[96,109],[107,111]],phase:4.4},
 ]},
 milkbarn:{atlas:'farmCow',size:.34,animals:[
  {centers:[[134,131],[78,146],[89,157],[122,145]],phase:1.2},
 ]},
 duckhouse:{atlas:'farmDuck',size:.19,animals:[
  {centers:[[75,150],[87,153],[62,131],[139,138]],phase:0},
  {centers:[[120,151],[133,135],[129,108],[108,107]],phase:5.5},
 ]},
};
const directions=[[1,.5],[1,-.5],[-1,-.5],[-1,.5]];
const feeding=[5,6,6,7,6,7,6,5];
export function farmAnimalPose(clock,phase=0,working=true){
 const t=((Math.max(0,clock)+phase)%12+12)%12;
 // Walk out, graze, walk back, graze.
 const outbound=t<3,returning=t>=6&&t<9,walking=outbound||returning;
 const travel=outbound?t/3:returning?1-(t-6)/3:t<6?1:0;
 const frame=!working?0:walking?1+Math.floor((t%3)*8)%4:feeding[Math.min(7,Math.floor((t%3)/3*8))];
 return {travel,frame,heading:t<6?0:2,action:!working?'idle':walking?'walk':'feed'};
}

export function attachFarmAnimals(type,{part,position,setFrame}){
 const config=FARM_ANIMALS[type];
 if(!config&&type!=='apiary')return null;
 const layers=config?config.animals.map((animal,i)=>{
  const layer=part('animal-'+i,0,config.size,config.atlas);
  layer.userData.farmAnimal=true;
  return {layer,animal};
 }):Array.from({length:4},(_,i)=>({layer:part('bee-'+i,0,.095,'farmBee'),phase:i*Math.PI/2}));
 let clock=0;
 return (time,b,sim,view,state)=>{
  const alive=(b.health??100)>0,working=alive&&b.enabled!==false&&!!state?.working;
  if(working)clock=Math.max(0,b.animationTime??sim?.time??time);
  for(const [i,entry] of layers.entries()){
   const {layer}=entry;
   layer.visible=alive&&(!!config||working);
   if(config){
    const pose=farmAnimalPose(clock,entry.animal.phase,working);
    const [cx,cy]=entry.animal.centers[view],[dx,dy]=directions[view];
    const offset=(pose.travel-.5)*12;
    position(layer,cx+offset*dx,cy+offset*dy);
    setFrame(layer,pose.frame,(view+pose.heading)%4);
    layer.userData.action=pose.action;
    // Walking out/back uses authored opposite-facing drawings, not a flipped
    // picture sliding along a route. Feet remain on the same ground plane.
   }else{
    const angle=clock*1.8+entry.phase,radius=20+(i%2)*8;
    position(layer,96+Math.cos(angle)*radius,94+Math.sin(angle)*11-i*3);
    layer.userData.flipX=Math.sin(angle)>0;
    setFrame(layer,Math.floor(clock*12+i)%4);
   }
  }
 };
}
