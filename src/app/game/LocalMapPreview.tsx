'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Simulation} from './simulation';
import {NATIONS} from './world';
import {PROVINCE_INDEX} from './atlas-geometry';
import {TERRAIN_NAMES} from './world-grid';
import {BIOMES} from './biome-data';

export default function LocalMapPreview({provinceId,seed=0,simulation,title}:any){
 const canvas=useRef<HTMLCanvasElement>(null),[layer,setLayer]=useState('terrain');
 const sim=useMemo(()=>{
  if(simulation)return simulation;
  const p=PROVINCE_INDEX.get(provinceId);if(!p)return null;
  return new Simulation((NATIONS as any)[p.nation].region,null,{nation:p.nation,provinceId,seed});
 },[provinceId,seed,simulation]);
 useEffect(()=>{
  const ctx=canvas.current?.getContext('2d');if(!ctx||!sim)return;
  const colors:any={coast:'#377e92',lake:'#569daa',river:'#65a8b8',stream:'#65a8b8',canal:'#4d929e',pond:'#71b8be'};
  ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,192,192);
  for(const t of sim.tiles){
   const x=t.x*8,y=t.z*8;
   ctx.fillStyle=t.water?colors[t.water]||colors.pond:layer!=='terrain'?`hsl(${28+(t[layer]||0)*.95} 40% ${43+(t[layer]||0)*.13}%)`:t.ground==='mountain'?'#929484':t.ground==='ice'?'#dce7db':t.oasis?'#91b972':t.ground==='sand'?'#d5bb85':(BIOMES as any)[sim.layout.ecology]?.color||'#a0b378';
   ctx.fillRect(x,y,8,8);
   if(layer==='terrain'&&t.nature){ctx.fillStyle=t.nature==='tree'?'#365f45':'#666e63';ctx.fillRect(x+2,y+2,4,4);ctx.fillStyle=t.nature==='tree'?'#719153':'#c1bc9d';ctx.fillRect(x+2,y+1,3,2);}
   if(layer==='terrain'&&sim.roads.has(t.x+','+t.z)){ctx.fillStyle='#c2a76b';ctx.fillRect(x,y+3,8,3);}
   if(!sim.owned.has(t.x+','+t.z)){ctx.fillStyle='#223b2d23';ctx.fillRect(x,y,8,8);}
  }
  for(const b of sim.buildings){ctx.fillStyle='#fff2c5';ctx.fillRect(b.x*8+1,b.z*8+1,6,6);ctx.fillStyle='#715b37';ctx.fillRect(b.x*8+1,b.z*8+1,6,2);}
  ctx.strokeStyle='#f9e4a1';ctx.lineWidth=1;
  for(const key of sim.owned){const [x,z]=key.split(',').map(Number);for(const [dx,dz] of [[0,-1],[1,0],[0,1],[-1,0]])if(!sim.owned.has((x+dx)+','+(z+dz))){ctx.beginPath();if(dx===0){ctx.moveTo(x*8,(z+(dz>0?1:0))*8);ctx.lineTo((x+1)*8,(z+(dz>0?1:0))*8);}else{ctx.moveTo((x+(dx>0?1:0))*8,z*8);ctx.lineTo((x+(dx>0?1:0))*8,(z+1)*8);}ctx.stroke();}}
 },[sim,sim?.revision,layer]);
 if(!sim)return null;
 const initial=sim.tiles.filter((t:any)=>sim.owned.has(t.x+','+t.z)&&!t.water);
 const average=(key:string)=>Math.round(initial.reduce((n:number,t:any)=>n+(t[key]||0),0)/Math.max(1,initial.length));
 return <section className="local-map-preview" aria-label="실제 거점 지형 미리보기" data-province={provinceId} data-seed={seed}>
  <header><strong>{title||(simulation?'현재 거점':'시작할 땅')}</strong><span>24 × 24</span></header>
  <div className="local-preview-map"><canvas ref={canvas} width={192} height={192} role="img" aria-label="실제 생성 규칙으로 그린 거점 지도. 밝은 테두리는 확보한 땅입니다."/>{[['n','북'],['e','동'],['s','남'],['w','서']].map(([side,name])=><span key={side} className={'preview-edge '+side}>{name} · {(TERRAIN_NAMES as any)[sim.layout.edges[side]]}</span>)}</div>
  <div className="local-preview-info"><span>확보한 땅<b>{sim.owned.size}칸</b></span><span>평균 비옥도<b>{average('fertility')}%</b></span><span>평균 광물량<b>{average('ore')}%</b></span></div>
  <div className="local-preview-layers" role="group" aria-label="미리보기 자원">{[['terrain','지형'],['fertility','비옥도'],['ore','광물'],['oil','원유']].map(([id,label])=><button key={id} onClick={()=>setLayer(id)} aria-pressed={layer===id}>{label}</button>)}</div>
 </section>;
}
