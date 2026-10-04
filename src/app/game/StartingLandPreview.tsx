'use client';
import {useEffect,useRef,useState} from 'react';
import {RotateCcw,RotateCw,Plus,Minus} from 'lucide-react';
import {Simulation} from './simulation';
import {NATIONS} from './world';
import type {GameScene} from './scene';

export default function StartingLandPreview({provinceId,nation,race,onReady}:{provinceId:string;nation:string;race:string;onReady:(ready:boolean)=>void}){
 const mount=useRef<HTMLDivElement>(null),scene=useRef<GameScene|null>(null);
 const [error,setError]=useState(''),[attempt,setAttempt]=useState(0),[ready,setReady]=useState(false);
 useEffect(()=>{
  let disposed=false,resize:ResizeObserver|undefined;onReady(false);setReady(false);setError('');
  Promise.all([import('./scene'),import('./assets')]).then(async([{GameScene},{loadAssets}])=>{
   await loadAssets(race);if(disposed||!mount.current)return;
   const sim=new Simulation((NATIONS as any)[nation].region,null,{nation,race,provinceId,seed:0});sim.paused=true;
   const current=new GameScene(mount.current,sim);scene.current=current;
   // Orthographic portrait views include ground behind the fixed camera position.
   current.camera.near=-200;current.camera.far=500;
   const backdrop='#98ac82';(current.scene.background as any)?.set(backdrop);
   current.scenery?.group.traverse((node:any)=>{if(!node.name?.startsWith('landscape-'))return;const image=node.userData.image,ctx=image?.getContext('2d');if(!ctx)return;const w=image.width,h=image.height,band=160;ctx.save();ctx.globalCompositeOperation='source-atop';for(const [x1,y1,x2,y2,x,y,bw,bh] of [[0,0,band,0,0,0,band,h],[w,0,w-band,0,w-band,0,band,h],[0,0,0,band,0,0,w,band],[0,h,0,h-band,0,h-band,w,band]]){const gradient=ctx.createLinearGradient(x1,y1,x2,y2);gradient.addColorStop(0,backdrop);gradient.addColorStop(1,backdrop+'00');ctx.fillStyle=gradient;ctx.fillRect(x,y,bw,bh);}ctx.restore();node.userData.texture.needsUpdate=true;});
   current.renderer.surfacePatterns?.clear();
   const fit=()=>{const w=mount.current?.clientWidth||1,h=mount.current?.clientHeight||1,q=current.viewIndex,top=w<600?90:100,bottom=w<600?280:h<540?110:190;current.resetCamera();current.camera.zoom=Math.min((current.camera.right-current.camera.left)*(w-32)/w/36,(current.camera.top-current.camera.bottom)*Math.max(130,h-top-bottom)/h/21);current.controls.minZoom=current.camera.zoom;current.camera.setViewOffset(w,h,0,(bottom-top)/2,w,h);current.camera.updateProjectionMatrix();current.setQuarterView(q);};
   resize=new ResizeObserver(fit);resize.observe(mount.current);fit();
   current.renderer.domElement.setAttribute('aria-label','선택한 부지 미리보기. 드래그로 이동하고 휠로 확대합니다.');
   await current.warmUp();if(disposed)return;setReady(true);onReady(true);
  }).catch(()=>{if(!disposed)setError('지형을 불러오지 못했습니다. 다시 시도하세요.');});
  const key=(e:KeyboardEvent)=>{if(document.querySelector('[role=dialog]')||e.ctrlKey||e.altKey||e.metaKey)return;if(['q','e'].includes(e.key.toLowerCase())){e.preventDefault();scene.current?.rotate(e.key.toLowerCase()==='q'?-1:1);}};
  window.addEventListener('keydown',key);
  return()=>{disposed=true;resize?.disconnect();window.removeEventListener('keydown',key);scene.current?.dispose();scene.current=null;};
 },[provinceId,nation,race,attempt,onReady]);
 return <div className="starting-land-preview" data-province={provinceId} data-ready={ready}>
  <div className="starting-land-canvas" ref={mount}/>
  {!ready&&<div className="start-preview-status" role="status">{error?<><span>{error}</span><button onClick={()=>setAttempt(v=>v+1)}>다시 시도</button></>:'땅을 살펴보는 중…'}</div>}
  <div className="start-preview-tools" aria-label="미리보기 시점">
   <button aria-label="미리보기 왼쪽으로 90도 회전" onClick={()=>scene.current?.rotate(-1)}><RotateCcw size={18}/></button>
   <button aria-label="미리보기 오른쪽으로 90도 회전" onClick={()=>scene.current?.rotate(1)}><RotateCw size={18}/></button>
   <button aria-label="미리보기 축소" onClick={()=>scene.current?.zoom(1/1.2)}><Minus size={18}/></button>
   <button aria-label="미리보기 확대" onClick={()=>scene.current?.zoom(1.2)}><Plus size={18}/></button>
  </div>
 </div>;
}
