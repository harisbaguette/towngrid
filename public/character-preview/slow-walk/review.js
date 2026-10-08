import {characterTravelSpeed} from '/src/app/game/character-movement.js';
import {BASE_TIME_SCALE} from '/src/app/game/game-time.js';
const $=id=>document.getElementById(id),reduced=matchMedia('(prefers-reduced-motion: reduce)');
const state={elapsed:0,paused:reduced.matches,speed:1,direction:'SW'};
const image=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error(src));im.src=src;});
async function asset(sheet,json){const [atlas,response]=await Promise.all([image(sheet),fetch(json)]);if(!response.ok)throw Error(json);return {atlas,meta:await response.json()};}
async function main(){
 const [before,after]=await Promise.all([asset('./mira/rig-before.png','./mira/rig-before.json'),asset('./mira/sprites.png','./mira/frames.json')]);
 const velocity=BASE_TIME_SCALE*characterTravelSpeed({time:0,money:1,roads:new Set()},{x:0,z:0,race:'human'});
 const period=after.meta.strideLength/velocity,sequence=after.meta.sequence,count=sequence.length;
 // Screen pixels per world unit in the drawn SW view at the game's 100px body:
 // one step carries a planted boot 16.1px right and 10.9px up.
 const perWorld=[16.1/(after.meta.strideLength/2),-10.9/(after.meta.strideLength/2)];
 function ground(ctx,scale,mirror){
  // Marks fixed to the ground drift under the walker at the game speed; a
  // planted boot should drift with them.
  const shift=state.elapsed*velocity;ctx.fillStyle='#9fb397';
  for(let k=-8;k<9;k++){const t=((k*.1+shift)%1.7+1.7)%1.7-.85;ctx.fillRect(Math.round(160+t*perWorld[0]*scale*mirror),Math.round(250+t*perWorld[1]*scale),6,2);}
 }
 function draw(){
  const phase=state.elapsed/period%1,index=Math.floor(phase*count+1e-7)%count,mirror=state.direction==='SE'?-1:1;
  for(const [id,a,authored]of [['before',before,false],['after',after,true]]){
   const ctx=$(id).getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#e4ebdd';ctx.fillRect(0,0,320,280);
   const row=a.meta.directions.indexOf(state.direction),scale=2;
   ctx.fillStyle='#789073';ctx.fillRect(45,251,230,1);ground(ctx,scale,mirror);
   if(authored){
    const cell=a.meta.cell,col=sequence[index];
    // The review sheet is drawn at twice the game size.
    ctx.drawImage(a.atlas,col*cell,row*cell,cell,cell,Math.round(160-a.meta.anchor[0]),Math.round(250-a.meta.anchor[1]),cell,cell);
   }else{
    const cell=a.meta.cell,rigPhase=state.elapsed/(a.meta.strideLength/velocity)%1,col=Math.floor(rigPhase*a.meta.columns)%a.meta.columns,anchor=a.meta.anchors[row][col];
    ctx.drawImage(a.atlas,col*cell,row*cell,cell,cell,Math.round(160-anchor[0]*cell*scale),Math.round(250-anchor[1]*cell*scale),cell*scale,cell*scale);
   }
  }
  $('frame').textContent=`${index+1} / ${count}`;$('timeline').value=index;
 }
 function seek(index){state.paused=true;state.elapsed=((index%count+count)%count)/count*period;$('play').textContent='재생';draw();}
 $('play').onclick=()=>{state.paused=!state.paused;$('play').textContent=state.paused?'재생':'일시정지';};
 $('previous').onclick=()=>seek(Math.floor(state.elapsed/period*count+1e-7)-1);
 $('next').onclick=()=>seek(Math.floor(state.elapsed/period*count+1e-7)+1);
 $('timeline').oninput=()=>seek(Number($('timeline').value));$('direction').onchange=()=>{state.direction=$('direction').value;draw();};$('speed').onchange=()=>state.speed=Number($('speed').value);
 reduced.addEventListener('change',event=>{if(event.matches){state.paused=true;$('play').textContent='재생';}});
 $('play').textContent=state.paused?'재생':'일시정지';$('status').textContent=`맨땅에서 두 걸음 주기 ${period.toFixed(2)}초 · 원화 ${after.meta.usedDrawings}장을 걸음 순서대로 재생`;
 window.slowWalkReview={state,before,after,period,draw,seek};let previous;
 function tick(now){if(previous!==undefined&&!state.paused&&!document.hidden)state.elapsed+=Math.min(.05,(now-previous)/1000)*state.speed;previous=now;draw();requestAnimationFrame(tick);}requestAnimationFrame(tick);
}
main().catch(error=>{$('status').textContent='불러오기 실패: '+error.message;console.error(error);});
