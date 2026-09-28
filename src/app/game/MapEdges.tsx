'use client';
import {useState} from 'react';
import {Mountain,Trees,Waves,Snowflake,Sun,Leaf,Compass,X} from 'lucide-react';
import {biomeOf} from './biome-data';
import {mapEdges} from './map-edges';

export function BiomeSummary({layout}:any){const biome=biomeOf(layout);return biome?<div className="biome-summary"><strong>{biome.name}</strong><span>{biome.summary}</span></div>:null;}
const icons:any={mountain:Mountain,forest:Trees,ice:Snowflake,desert:Sun,plain:Leaf};
export function MapEdgeList({layout,onFocus}:any){
 if(!layout)return null;
 return <div className="map-edge-list" aria-label="네 방향 주변 지형">{mapEdges(layout).map((edge:any)=>{const Icon=icons[edge.kind]||Waves;const content=<><Icon size={23}/><span><strong>{edge.direction} · {edge.name}</strong><small>{edge.short}</small></span></>;return onFocus?<button key={edge.side} data-side={edge.side} title={edge.detail} onClick={()=>onFocus(edge)}>{content}</button>:<div key={edge.side} title={edge.detail}>{content}</div>;})}</div>;
}
export default function MapEdges({layout,onFocus}:any){
 const [open,setOpen]=useState(false);
 return <div className="map-edges">{open&&<section className="map-edges-card"><header><strong>주변 지형과 자원</strong><button aria-label="주변 지형 닫기" onClick={()=>setOpen(false)}><X size={18}/></button></header><BiomeSummary layout={layout}/><MapEdgeList layout={layout} onFocus={(edge:any)=>{onFocus(edge);setOpen(false);}}/><p>방향을 누르면 해당 지형으로 이동합니다.</p></section>}<button className="map-edges-toggle" aria-expanded={open} onClick={()=>setOpen(!open)}><Compass size={18}/>주변 지형</button></div>;
}
