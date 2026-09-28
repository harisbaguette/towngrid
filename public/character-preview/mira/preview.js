/* The preview reads the exact runtime atlas and clips. */
(async () => {
 'use strict';
 const $ = id => document.getElementById(id);
 const canvas = $('stage'), ctx = canvas.getContext('2d');
 const state = { action: 'walk', direction: 0, elapsed: 0, paused: false, speed: 1, scale: 2, last: null };
 const base = '/assets/pixel-characters/mira/';
 const load = src => new Promise((resolve,reject) => { const image = new Image(); image.onload=()=>resolve(image); image.onerror=reject; image.src=src; });
 try {
  const [meta, atlas] = await Promise.all([fetch(base+'frames.json').then(r=>r.json()), load(base+'sprites.png')]);
  $('portrait').src=base+(meta.portraitAnimation?.file || 'portrait.png');
  const colors = { SW: [-.70710678,.40824829], NW: [-.70710678,-.40824829], NE: [.70710678,-.40824829], SE: [.70710678,.40824829] };
  const cell=meta.cell[0], baseline=meta.anchors[0][0][1]*cell;
  const descriptions={walk:'좌우 발이 교대하는 12프레임 보행',carry:'같은 보행 주기로 상자 운반',idle:'동일한 체형을 유지하는 대기',rotation:'Q·E로 네 방향 전환',work:'도구를 들고 내리는 작업',greet:'팔을 들어 인사',cargo:'무릎을 굽혀 상자를 들고 내려놓기'};
  function clip() {
   if(state.action==='rotation')return {frames:[0,0,0,0],fps:2};
   if(state.action==='cargo')return {frames:[...meta.clips.pickup.frames,...meta.clips.drop.frames],fps:10};
   return meta.clips[state.action];
  }
  function index() {const c=clip();return Math.floor(state.elapsed*c.fps)%c.frames.length;}
  function drawSprite(context,col,row,x,y,scale) {
   context.imageSmoothingEnabled=false;
   context.drawImage(atlas,col*cell,row*cell,cell,cell,x-cell/2*scale,y-baseline*scale,cell*scale,cell*scale);
  }
  function thumbnails() {
   $('frames').replaceChildren();
   clip().frames.forEach((col,i)=>{
    const b=document.createElement('button'), c=document.createElement('canvas'), label=document.createElement('span');
    c.width=c.height=96;const context=c.getContext('2d');context.fillStyle='#eeeae0';context.fillRect(0,0,96,96);
    drawSprite(context,col,state.action==='rotation'?i:state.direction,48,87,.72);
    label.textContent=state.action==='rotation'?meta.directions[i]:String(i+1).padStart(2,'0');
    b.setAttribute('aria-label',`${i+1}번째 프레임 보기`);b.append(c,label);
    b.onclick=()=>{state.paused=true;state.elapsed=(i+.01)/clip().fps;update();};$('frames').append(b);
   });
  }
  function update() {
   document.querySelectorAll('[data-action]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.action===state.action)));
   document.querySelectorAll('[data-direction]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.direction===meta.directions[state.direction])));
   $('play').textContent=state.paused?'재생':'일시정지';$('play').setAttribute('aria-label',$('play').textContent);
   $('action-description').textContent=descriptions[state.action];
  }
  function draw() {
   ctx.fillStyle='#eeeae0';ctx.fillRect(0,0,canvas.width,canvas.height);
   const c=clip(), frame=index(), all=$('view-all').checked;
   const row=state.action==='rotation'?frame:state.direction;
   const rows=all?[0,1,2,3]:[row];
   const scale=all?Math.min(state.scale,1.65):state.scale;
   for(const [i,r] of rows.entries()){
    let x=all?135+i*210:450, y=310;
    if(!all && $('travel').checked && ['walk','carry'].includes(state.action)) {
     const progress=(state.elapsed*c.fps/c.frames.length*c.strideLength % 2)-1, f=colors[meta.directions[r]];
     x+=f[0]*progress*128/1.05*scale; y+=f[1]*progress*128/1.05*scale;
    }
    ctx.strokeStyle='#c5cbbb';ctx.lineWidth=1;ctx.beginPath();
    ctx.moveTo(x-64*scale,y);ctx.lineTo(x,y-37*scale);ctx.lineTo(x+64*scale,y);ctx.lineTo(x,y+37*scale);ctx.closePath();ctx.stroke();
    ctx.fillStyle='#4b5b4526';ctx.beginPath();ctx.ellipse(x,y,13*scale,6*scale,0,0,Math.PI*2);ctx.fill();
    drawSprite(ctx,c.frames[frame],r,x,y,scale);
    if($('anchor').checked){ctx.strokeStyle='#b25945';ctx.beginPath();ctx.moveTo(x-8,y);ctx.lineTo(x+8,y);ctx.moveTo(x,y-8);ctx.lineTo(x,y+8);ctx.stroke();}
    if(all){ctx.fillStyle='#516957';ctx.font='14px sans-serif';ctx.fillText(meta.directions[r],x-10,380);}
   }
   $('frame-label').textContent=`${meta.directions[row]} · ${frame+1} / ${c.frames.length} 프레임`;
   [...$('frames').children].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===frame)));
  }
  function setDirection(i){state.direction=(i+4)%4;thumbnails();update();}
  document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{state.action=b.dataset.action;state.elapsed=0;thumbnails();update();});
  document.querySelectorAll('[data-direction]').forEach(b=>b.onclick=()=>setDirection(meta.directions.indexOf(b.dataset.direction)));
  document.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(e.key.toLowerCase()==='q')setDirection(state.direction-1);if(e.key.toLowerCase()==='e')setDirection(state.direction+1);});
  $('play').onclick=()=>{state.paused=!state.paused;update();};
  $('step').onclick=()=>{state.paused=true;state.elapsed=(index()+1+.01)/clip().fps;update();};
  $('speed').onchange=e=>state.speed=Number(e.target.value);
  $('scale').onchange=e=>state.scale=Number(e.target.value);
  $('loading').hidden=true;thumbnails();update();
  function loop(now){
   const dt=state.last===null?0:Math.min(.1,(now-state.last)/1000);state.last=now;
   if(!state.paused){const c=clip();const pace=c.strideLength?1.25/c.strideLength*c.frames.length/c.fps:1;state.elapsed+=dt*state.speed*pace;}
   draw();requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  window.miraPreview={state,meta};
 } catch(error) {$('loading').textContent='이미지를 불러오지 못했습니다. 새로고침해 주세요.';console.error(error);}
})();
