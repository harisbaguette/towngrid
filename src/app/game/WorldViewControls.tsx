'use client';
import {useEffect,useRef} from 'react';
import {Globe2,Home,Minus,Plus,RotateCcw,RotateCw} from 'lucide-react';
import {NATIONS} from './world';
import {WORLD_PLOTS,PLOT_INDEX} from './territory';
import {plotCenter} from './world-space';

export default function WorldViewControls({scene,starting=false,selectedId,onCountry,onPlot,onManage}:{scene:any;starting?:boolean;selectedId?:string|null;onCountry?:(id:string)=>void;onPlot?:(id:string)=>void;onManage?:()=>void}){
 const labels=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!scene)return;let frame=0;
  const position=()=>{
   const w=scene.container.clientWidth,h=scene.container.clientHeight,span=scene.worldSpan();
   const occupied:{x:number;y:number;w:number;h:number}[]=Array.from(document.querySelectorAll('.world-view-controls,.start-top,.start-bottom,.start-find,.start-help-button,.world-manage')).map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}).filter(b=>b.w&&b.h);
   for(const el of Array.from(labels.current?.children||[]) as HTMLElement[]){
    const point=plotCenter(el.dataset.plot);if(!point)continue;const p=scene.worldScreenPoint(...point),sx=p.x,sy=el.dataset.country?p.y:Math.min(...[[-12,-12],[12,-12],[12,12],[-12,12]].map(([dx,dz])=>scene.worldScreenPoint(point[0]+dx,point[1]+dz).y))-10;
    let visible=(el.dataset.country?span>180:span<=450)&&sx>55&&sx<w-55&&sy>100&&sy<h-(starting?180:100);
    if(visible){el.hidden=false;const width=el.offsetWidth,height=el.offsetHeight,box={x:sx-width/2,y:sy-height,w:width,h:height};if(occupied.some(b=>box.x<b.x+b.w+6&&box.x+box.w+6>b.x&&box.y<b.y+b.h+4&&box.y+box.h+4>b.y))visible=false;else occupied.push(box);}
    el.hidden=!visible;el.style.transform=`translate(${sx}px,${sy}px) translate(-50%,-100%)`;
   }
   frame=requestAnimationFrame(position);
  };frame=requestAnimationFrame(position);return()=>cancelAnimationFrame(frame);
 },[scene,starting,selectedId]);
 const selected=PLOT_INDEX.get(selectedId||''),sites=scene?.sim?.campaign?.sites||[];
 const plotLabels=[...new Map([...sites.map((s:any)=>PLOT_INDEX.get(s.provinceId)),selected].filter(Boolean).map((p:any)=>[p.id,p])).values()] as any[];
 return <>
  <div className="world-place-labels" ref={labels} aria-label="세계의 장소">
   {WORLD_PLOTS.filter((p:any)=>p.capital).map((p:any)=><button key={p.id} data-plot={p.id} data-country={p.nation} onClick={()=>onCountry?onCountry(p.nation):scene?.focusProvince(p.id,160)}>{(NATIONS as any)[p.nation]?.name}</button>)}
   {plotLabels.map((p:any)=><button key={'plot-'+p.id} className="world-plot-label" data-plot={p.id} onClick={()=>onPlot?onPlot(p.id):scene?.focusProvince(p.id,55)}>{p.id===scene?.sim?.provinceId&&!starting?'내 땅 · ':''}{p.name}</button>)}
  </div>
  <nav className={'world-view-controls'+(starting?' is-starting':'')} aria-label="월드 카메라">
   <button data-sound="world" title="대륙 전체" aria-label="대륙 전체 보기" onClick={()=>scene?.showWorld()}><Globe2 size={20}/></button>
   <button data-sound="enter" title={starting?'선택한 땅':'내 땅으로'} aria-label={starting?'선택한 땅으로':'내 땅으로'} onClick={()=>scene?.focusProvince(selectedId||scene?.sim.provinceId,55)}><Home size={20}/></button>
   <button data-sound="zoom" title="확대" aria-label="월드 확대" onClick={()=>scene?.zoom(1.5)}><Plus size={20}/></button>
   <button data-sound="zoom" title="축소" aria-label="월드 축소" onClick={()=>scene?.zoom(1/1.5)}><Minus size={20}/></button>
   <button data-sound="rotate" title="왼쪽 회전 Q" aria-label="월드 왼쪽 회전" onClick={()=>scene?.rotate(-1)}><RotateCcw size={20}/></button>
   <button data-sound="rotate" title="오른쪽 회전 E" aria-label="월드 오른쪽 회전" onClick={()=>scene?.rotate(1)}><RotateCw size={20}/></button>
  </nav>
  {onManage&&<button className="world-manage" onClick={onManage}>거점·외교</button>}
 </>;
}
