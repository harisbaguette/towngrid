const $=id=>document.getElementById(id);
const state={action:'walk',time:0,paused:matchMedia('(prefers-reduced-motion: reduce)').matches,scale:1,speed:1,travel:true};
const image=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error(src));img.src=src;});
async function load(sheet,metadata){
 const [atlas,response]=await Promise.all([image(sheet),fetch(metadata)]);
 if(!response.ok)throw Error(metadata);
 return {atlas,meta:await response.json()};
}
const [before,after]=await Promise.all([
 load('before.png','before.json'),
 load('/assets/pixel-characters/bron/sprites.png','/assets/pixel-characters/bron/frames.json'),
]);
const contexts=[$('before').getContext('2d'),$('after').getContext('2d')];
const stepSpeed=.36;
function drawOne(ctx,asset){
 const {meta,atlas}=asset,clip=meta.clips[state.action];
 const moving=state.action==='walk'||state.action==='carry';
 const distance=state.time*stepSpeed;
 const elapsed=moving?distance/clip.strideLength*clip.frames.length/clip.fps:state.time;
 const frame=clip.frames[Math.floor(elapsed*clip.fps)%clip.frames.length];
 ctx.fillStyle='#e9efe3';ctx.fillRect(0,0,520,550);ctx.imageSmoothingEnabled=false;
 ctx.font='14px system-ui';ctx.textAlign='center';
 for(let direction=0;direction<4;direction++){
  const pose={row:direction,anchor:meta.anchors[direction][frame],scale:meta.frameScales?.[frame]??1};
  const x=130+(direction%2)*260,y=225+Math.floor(direction/2)*255;
  const travel=moving&&state.travel?(distance%.48-.24)*128/.84*state.scale:0;
  const forward=[direction<2?-.707:.707,[0,3].includes(direction)?.408:-.408];
  const ground=[x+forward[0]*travel,y+forward[1]*travel];
  ctx.strokeStyle='#bdcbb5';ctx.beginPath();ctx.moveTo(x-58,y);ctx.lineTo(x,y-33);ctx.lineTo(x+58,y);ctx.lineTo(x,y+33);ctx.closePath();ctx.stroke();
  ctx.fillStyle='#43584323';ctx.beginPath();ctx.ellipse(...ground,17*state.scale,6*state.scale,0,0,Math.PI*2);ctx.fill();
  const size=128*state.scale*pose.scale;
  ctx.drawImage(atlas,frame*128,pose.row*128,128,128,Math.round(ground[0]-pose.anchor[0]*size),Math.round(ground[1]-pose.anchor[1]*size),size,size);
  ctx.fillStyle='#405744';ctx.fillText(['↙ 앞·왼쪽','↖ 뒤·왼쪽','↗ 뒤·오른쪽','↘ 앞·오른쪽'][direction],x,y+47);
 }
}
function draw(){drawOne(contexts[0],before);drawOne(contexts[1],after);}
function updatePlay(){$('play').textContent=state.paused?'재생':'일시정지';}
document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>{
 state.action=button.dataset.action;state.time=0;
 document.querySelectorAll('[data-action]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));draw();
}));
$('play').onclick=()=>{state.paused=!state.paused;updatePlay();};
$('size').onchange=()=>{state.scale=Number($('size').value);draw();};
$('speed').onchange=()=>state.speed=Number($('speed').value);
$('travel').onchange=()=>{state.travel=$('travel').checked;draw();};
$('timeline').oninput=()=>{
 state.paused=true;updatePlay();
 const clip=after.meta.clips[state.action];
 const duration=['walk','carry'].includes(state.action)?clip.strideLength/stepSpeed:clip.frames.length/clip.fps;
 state.time=Number($('timeline').value)/120*duration;
 $('phase').value=Math.round(Number($('timeline').value)/120*100)+'%';draw();
};
let previous;
function tick(now){
 if(previous!==undefined&&!state.paused)state.time+=Math.min((now-previous)/1000,.05)*state.speed;
 previous=now;draw();requestAnimationFrame(tick);
}
updatePlay();$('status').textContent='';
window.bronComparison={state,before,after,draw};
requestAnimationFrame(tick);
