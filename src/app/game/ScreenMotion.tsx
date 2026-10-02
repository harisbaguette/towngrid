'use client';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Pause, Play } from 'lucide-react';
import { drawScreenMotion, motionId, sceneryRect, SCREEN_MOTION } from './screen-motion';

const KEY = 'towngrid-screen-motion', CHANGE = 'towngrid-screen-motion-change';
let memoryPreference = true;
const preference = () => { try { const stored=localStorage.getItem(KEY);return stored===null?memoryPreference:stored!=='off'; } catch { return memoryPreference; } };
function watch(change: () => void) {
 const media = matchMedia('(prefers-reduced-motion: reduce)');
 window.addEventListener(CHANGE, change);window.addEventListener('storage', change);media.addEventListener('change', change);
 return () => { window.removeEventListener(CHANGE, change);window.removeEventListener('storage', change);media.removeEventListener('change', change); };
}
const enabled = () => preference() && !matchMedia('(prefers-reduced-motion: reduce)').matches;
export function MotionToggle() {
 const active = useSyncExternalStore(watch, enabled, () => false);
 const reduced = useSyncExternalStore(watch, () => matchMedia('(prefers-reduced-motion: reduce)').matches, () => false);
 return <button className="screen-motion-toggle" aria-label={active ? '배경 움직임 멈추기' : '배경 움직임 재생'} disabled={reduced} title={reduced ? '기기의 동작 줄이기 설정이 켜져 있습니다' : undefined} onClick={() => {
  memoryPreference=!active;try { localStorage.setItem(KEY, active ? 'off' : 'on'); } catch { /* Still usable without storage. */ }
  window.dispatchEvent(new Event(CHANGE));
 }}>{active ? <Pause size={19} /> : <Play size={19} />}</button>;
}

export default function ScreenMotion({ imageRef, src }: { imageRef: React.RefObject<HTMLImageElement | null>; src: string }) {
 const canvasRef = useRef<HTMLCanvasElement>(null);
 const active = useSyncExternalStore(watch, enabled, () => false);
 useEffect(() => {
  const canvas=canvasRef.current, image=imageRef.current, config=SCREEN_MOTION[motionId(src) as keyof typeof SCREEN_MOTION];
  if(!canvas||!image||!active||!config)return;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  let frame=0,last=0,elapsed=0,previous=0,rect={x:0,y:0,w:1,h:1},scale=1;
  const resize=()=>{
   const {width,height}=canvas.getBoundingClientRect();if(!width||!height||!image.naturalWidth)return;
   scale=Math.min(1,960/width,720/height);canvas.width=Math.ceil(width*scale);canvas.height=Math.ceil(height*scale);
   const style=getComputedStyle(image);rect=sceneryRect(width,height,image.naturalWidth,image.naturalHeight,style.objectFit,style.objectPosition);
  };
  const paint=(now:number)=>{
   frame=0;if(document.hidden)return;
   if(previous)elapsed+=Math.min(100,now-previous)/1000;previous=now;
   if(now-last>=1000/24&&image.complete&&image.naturalWidth&&!image.dataset.fallback){
    last=now;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.imageSmoothingEnabled=false;ctx.setTransform(rect.w/image.naturalWidth*scale,0,0,rect.h/image.naturalHeight*scale,rect.x*scale,rect.y*scale);
    drawScreenMotion(ctx,image,config,elapsed);canvas.dataset.frame=String(Math.floor(elapsed*24));
   }
   frame=requestAnimationFrame(paint);
  };
  const visibility=()=>{cancelAnimationFrame(frame);previous=0;canvas.dataset.running=String(!document.hidden);if(!document.hidden)frame=requestAnimationFrame(paint);};
  const observer=new ResizeObserver(resize);observer.observe(canvas);image.addEventListener('load',resize);
  document.addEventListener('visibilitychange',visibility);resize();visibility();
  return()=>{cancelAnimationFrame(frame);observer.disconnect();image.removeEventListener('load',resize);document.removeEventListener('visibilitychange',visibility);ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);};
 },[src,active,imageRef]);
 return <canvas ref={canvasRef} className="screen-motion" aria-hidden="true" data-active={active} data-scene={motionId(src)} />;
}
