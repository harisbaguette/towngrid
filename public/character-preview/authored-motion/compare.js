import {characterTravelSpeed} from '/src/app/game/character-movement.js';
import {BASE_TIME_SCALE} from '/src/app/game/game-time.js';
const $=id=>document.getElementById(id);
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const state={time:0,paused:reduced.matches,direction:'SW',action:'walk',scale:1.8,speed:1,travel:true};
const image=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error(src));img.src=src;});
async function load(sheet,metadata){
 const [atlas,response]=await Promise.all([image(sheet),fetch(metadata)]);
 if(!response.ok)throw Error(metadata);
 return {atlas,meta:await response.json()};
}
async function main(){
 const [before,after]=await Promise.all([
  load('/assets/pixel-characters/mira/sprites.png','/assets/pixel-characters/mira/frames.json'),
  load('mira/sprites.png','mira/frames.json'),
 ]);
 const currentClip=()=>after.meta.clips[state.action];
 const count=()=>currentClip().frames.length;
 const speed=BASE_TIME_SCALE*characterTravelSpeed({time:0,money:1,roads:new Set()},{x:0,z:0,race:'human'});
 const phase=()=>state.time*speed/currentClip().strideLength%1;
 for(const direction of after.meta.directions){const option=document.createElement('option');option.value=direction;option.textContent=direction;$('direction').append(option);}
 function floor(ctx,distance){
  const {width:w,height:h}=ctx.canvas,scale=state.scale,unit=128*scale/1.05;
  const point=[w/2,h*.78],sign=state.direction.endsWith('W')?-1:1,vertical=state.direction.startsWith('S')?1:-1;
  const shift=state.travel?distance:0;
  ctx.fillStyle='#e8eee2';ctx.fillRect(0,0,w,h);ctx.imageSmoothingEnabled=false;
  ctx.strokeStyle='#c2cebb';ctx.lineWidth=1;
  for(let i=-12;i<=12;i++)for(const slope of [-1,1]){
   const x=point[0]+i*.25*unit*Math.SQRT2-sign*Math.SQRT1_2*shift*unit,y=point[1]-vertical*Math.sqrt(1/6)*shift*unit;
   ctx.beginPath();ctx.moveTo(x-w,y-slope*w/Math.sqrt(3));ctx.lineTo(x+w,y+slope*w/Math.sqrt(3));ctx.stroke();
  }
  ctx.fillStyle='#30453d24';ctx.beginPath();ctx.ellipse(...point,11*scale,3.6*scale,0,0,Math.PI*2);ctx.fill();
  return point;
 }
 function drawOne(ctx,asset,authored){
  const {atlas,meta}=asset,p=phase(),distance=state.time*speed,scale=state.scale,size=128*scale;
  const point=floor(ctx,distance%1);
  let column,row,anchor;
  if(authored){
   column=currentClip().frames[Math.min(count()-1,Math.floor(p*count()+1e-8))];row=meta.directions.indexOf(state.direction);
   anchor=[...meta.anchor];if(meta.mirroredDirections?.[state.direction])anchor[0]=128-anchor[0];
  }else{
   const direction=meta.directions.indexOf(state.direction),clip=meta.clips[state.action];
   const frame=clip.frames[Math.floor((distance/clip.strideLength%1)*clip.frames.length)];
   column=frame%meta.atlasColumns;row=direction+Math.floor(frame/meta.atlasColumns)*4;
   anchor=meta.anchors[direction][frame].map(value=>value*128);
  }
  ctx.drawImage(atlas,column*128,row*128,128,128,Math.round(point[0]-anchor[0]*scale),Math.round(point[1]-anchor[1]*scale),size,size);
 }
 const contexts=[$('before').getContext('2d'),$('after').getContext('2d')];
 function draw(){
  drawOne(contexts[0],before,false);drawOne(contexts[1],after,true);
  const p=phase(),index=Math.min(count()-1,Math.floor(p*count()+1e-8));
  $('timeline').value=String(Math.floor(p*1000));$('phase').textContent=`${index+1} / ${count()}`;
  const ctx=$('views').getContext('2d'),size=160,frame=currentClip().frames[index];
  ctx.fillStyle='#e8eee2';ctx.fillRect(0,0,1040,260);ctx.imageSmoothingEnabled=false;
  after.meta.directions.forEach((direction,row)=>{
   const anchor=[...after.meta.anchor];if(after.meta.mirroredDirections[direction])anchor[0]=128-anchor[0];
   ctx.drawImage(after.atlas,frame*128,row*128,128,128,row*260+130-anchor[0]/128*size,220-anchor[1]/128*size,size,size);
   ctx.fillStyle='#284333';ctx.font='16px sans-serif';ctx.fillText(direction,row*260+115,34);
  });
 }
 function playLabel(){$('play').textContent=state.paused?'재생':'일시정지';}
 function seek(index){const n=count();state.paused=true;state.time=((index%n+n)%n)/n*currentClip().strideLength/speed;playLabel();draw();}
 $('play').onclick=()=>{state.paused=!state.paused;playLabel();};
 $('direction').onchange=()=>{state.direction=$('direction').value;draw();};
 $('action').onchange=()=>{state.action=$('action').value;draw();};
 $('size').onchange=()=>{state.scale=Number($('size').value);draw();};
 $('speed').onchange=()=>{state.speed=Number($('speed').value);};
 $('travel').onchange=()=>{state.travel=$('travel').checked;draw();};
 $('timeline').oninput=()=>{state.paused=true;state.time=Number($('timeline').value)/1000*currentClip().strideLength/speed;playLabel();draw();};
 $('previous').onclick=()=>seek(Math.floor(phase()*count()+1e-8)-1);
 $('next').onclick=()=>seek(Math.floor(phase()*count()+1e-8)+1);
 reduced.addEventListener('change',event=>{if(event.matches){state.paused=true;playLabel();}});
 let previous;
 function tick(now){
  if(previous!==undefined&&!state.paused&&!document.hidden)state.time+=Math.min((now-previous)/1000,.05)*state.speed;
  previous=now;draw();requestAnimationFrame(tick);
 }
 window.authoredMotionReview={state,before,after,draw,seek};$('status').textContent='';playLabel();requestAnimationFrame(tick);
}
main().catch(error=>{$('status').textContent='불러오지 못했습니다: '+error.message;console.error(error);});
