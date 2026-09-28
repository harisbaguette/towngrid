'use client';
import {useId,useState} from 'react';
import {biomeOf} from './biome-data';
import {PROVINCES,cellsPath} from './territory';
import {NATIONS,ATLAS_REGIONS,FACTIONS} from './world';
import {MAJOR_ROUTES,WATERWAYS,TRADE_LINKS} from './trade-routes';
import {WORLD_CELLS,CELL,COLS,ROWS,TERRAIN_NAMES,SIDES,SIDE_NAMES,layoutOf} from './world-grid';
import {MAP_LABELS} from './world-map';
// The continent is a grid of squares (world-grid.js). Each site is one square, and each side of its
// map is the square beside it, so the atlas tints every square that is not plain land or open sea.
const TERRAIN_FILL:any={mountain:['#8a7a66',.35],forest:['#4f7d45',.3],desert:['#f1cf7c',.4],ice:['#f4fbff',.55],lake:['#5fa8d3',.45],river:['#5fa8d3',.45],canal:['#5fa8d3',.45],stream:['#5fa8d3',.4]};
// Geometry and labels follow the authoritative world squares.
const LAND_PATH=(WORLD_CELLS as any[]).filter(c=>c.terrain!=='coast').map(c=>`M${c.cx*CELL} ${c.cz*CELL}h${CELL}v${CELL}h-${CELL}Z`).join('');
const GREAT_RIVERS=(WATERWAYS as any[]).filter(w=>w.kind==='river').map(w=>({...w,label:w.line[Math.floor(w.line.length/2)]}));
const BASE_FILL:any={plain:'#a4b873',forest:'#688c58',mountain:'#978d7c',desert:'#dcb878',ice:'#e5f0ee',coast:'#75b6c9',river:'#69abc4',lake:'#69abc4',canal:'#6faec3',stream:'#78b9cd'};
const TINTED=(WORLD_CELLS as any[]).filter(c=>TERRAIN_FILL[c.terrain]&&!c.site);
const SITE_CELLS=(WORLD_CELLS as any[]).filter(c=>c.site).map(c=>{const p:any=PROVINCES.find((p:any)=>p.id===c.site),l:any=layoutOf(c.site);return {...c,p,ecology:biomeOf(l),label:p.name+' · '+biomeOf(l)?.name+' · '+SIDES.map(([side]:any)=>(SIDE_NAMES as any)[side]+' '+(TERRAIN_NAMES as any)[l.edges[side]]).join(' · ')};});
const paths=Object.keys(NATIONS).map(id=>cellsPath((PROVINCES as any[]).filter(p=>p.nation===id).flatMap(p=>p.cells)));
const colors:any={human:['#e8d599','#e3c48d','#d5bb89'],elf:['#b9d3ac','#a6c9b4','#c8d7ae'],demon:['#c7afc8','#baa8c1'],orc:['#d9af9b','#cda889'],beast:['#b1c8c9','#9cbdc8']};
// trade: the connection the current site sells through (sim.tradeConnection()), highlighted on the map.
export default function WorldAtlas({nation,onNation,sites=[],routes=[],states=[],provinces={},trade=null}:any){const [focus,setFocus]=useState('all'),uid=useId().replace(/:/g,''),selected=(NATIONS as any)[nation];return <div className="atlas-shell">
 <nav className="atlas-controls" aria-label="세계 지도 확대"><button onClick={()=>setFocus('all')} className={focus==='all'?'active':''}>대륙 전체</button>{ATLAS_REGIONS.map((r:any)=><button key={r.id} onClick={()=>setFocus(r.id)} className={focus===r.id?'active':''}>{r.name}</button>)}</nav>
 <svg className={'world-atlas '+(focus==='all'?'whole-world':'')} viewBox={ATLAS_REGIONS.find((r:any)=>r.id===focus)?.view||`0 0 ${COLS*CELL} ${ROWS*CELL}`} role="group" aria-label="이르데아 대륙. 가운데 세 잎 내해와 북쪽·남동쪽 두 만, 다섯 큰 강으로 나뉜 30개 국가">
 <defs><clipPath id={'land-'+uid}><path d={LAND_PATH} clipRule="evenodd"/></clipPath><pattern id={'grid-'+uid} width={CELL} height={CELL} patternUnits="userSpaceOnUse"><path d={`M${CELL} 0H0V${CELL}`} fill="none" stroke="#fff" strokeWidth=".6" opacity=".35"/></pattern><pattern id={'enemy-'+uid} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0V8" stroke="#795c73" strokeWidth="1" opacity=".17"/></pattern><linearGradient id={'water-'+uid} x2="0" y2="1"><stop stopColor="#a5d5e6"/><stop offset="1" stopColor="#72b4d1"/></linearGradient></defs>
 <g className="world-terrain" aria-hidden="true" pointerEvents="none">{(WORLD_CELLS as any[]).map(c=><rect key={c.cx+','+c.cz} x={c.cx*CELL} y={c.cz*CELL} width={CELL} height={CELL} fill={BASE_FILL[c.terrain]}/>)}</g>

 <g clipPath={`url(#land-${uid})`}>
 {Object.entries(NATIONS).map(([id,n]:any,i:number)=><g key={id} className={'country '+(id===nation?'chosen':'')}><path d={paths[i]} fill={id===nation?"#ffe599":colors[n.faction][i%colors[n.faction].length]} fillOpacity={id===nation?.25:.075} stroke={id===nation?"#fff0a9":"#f9f6da"} strokeOpacity={id===nation?1:.4} strokeWidth={id===nation?3:1.1} strokeDasharray={id===nation?undefined:"4 5"} tabIndex={0} role="button" aria-label={n.name+' 선택'+(!n.playable?' · 적대국':'')} aria-pressed={id===nation} onClick={()=>onNation(id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onNation(id);}}}/>{!n.playable&&<path d={paths[i]} fill={`url(#enemy-${uid})`} pointerEvents="none"/>}</g>)}

 {PROVINCES.filter((p:any)=>provinces[p.id]?.owner&&provinces[p.id].owner!==p.nation).map((p:any)=>{const state=states.find((s:any)=>s.id===provinces[p.id].owner);return <path key={p.id} d={cellsPath(p.cells)} fill={state?.pact?'#86b5c8':'#d59360'} fillOpacity=".45" stroke="#ffecd2" strokeWidth="1.6"><title>{state?.name} · {p.name} · {p.resource}</title></path>;})}
 <g className="terrain-grid" pointerEvents="none">{TINTED.map((c:any)=><rect key={c.cx+','+c.cz} className={'cell-'+c.terrain} x={c.cx*CELL} y={c.cz*CELL} width={CELL} height={CELL} fill={TERRAIN_FILL[c.terrain][0]} fillOpacity={TERRAIN_FILL[c.terrain][1]}/>)}<rect width="1300" height="806" fill={`url(#grid-${uid})`}/></g>
 {SITE_CELLS.map((c:any)=><rect key={'site-'+c.site} className="site-cell" x={c.cx*CELL+1} y={c.cz*CELL+1} width={CELL-2} height={CELL-2} fill={c.ecology?.color||TERRAIN_FILL[c.terrain]?.[0]||'#fff8dd'} fillOpacity=".3" stroke={c.p.nation===nation?'#fff0a9':'#fffbe8'} strokeOpacity=".9" strokeWidth="1.4" onClick={()=>onNation(c.p.nation)}><title>{c.label}</title></rect>)}
 {GREAT_RIVERS.map((r:any)=><g key={r.name} pointerEvents="none"><text className="river-label" x={r.label[0]} y={r.label[1]}>{r.name}</text></g>)}
 </g>
 <g className="waterways" pointerEvents="none" aria-hidden="true">
 {WATERWAYS.filter((w:any)=>w.kind==='lake').map((w:any)=><g key={w.id} className="waterway lake"><path d={'M'+w.line.join('L')+'Z'}/><text x={w.center[0]} y={w.center[1]+3} textAnchor="middle">{w.name}</text></g>)}
 {WATERWAYS.filter((w:any)=>['canal','stream','ferry'].includes(w.kind)).map((w:any)=><g key={w.id} className={'waterway '+w.kind}><polyline points={w.line.join(' ')} className="bank"/><polyline points={w.line.join(' ')}/></g>)}
 </g>
 <g className="trade-network" pointerEvents="none" aria-hidden="true">
 {TRADE_LINKS.map((l:any)=><path key={l.id+l.from} d={`M${l.from}L${l.to}`} className={'trade-link '+l.kind}/>)}
 {WATERWAYS.filter((w:any)=>w.kind==='coast'||w.kind==='river').map((w:any)=><polyline key={w.id} points={(w.lane||w.line).join(' ')} className={'water-lane '+w.kind}/>)}
 {MAJOR_ROUTES.map((r:any)=><g key={r.id} className={'trade-route '+r.kind}><polyline points={r.points.join(' ')} className="casing"/><polyline points={r.points.join(' ')}/></g>)}
 {trade&&<g className="trade-mine"><polyline points={trade.line.join(' ')}/><path d={`M${trade.from}L${trade.to}`}/><circle cx={trade.from[0]} cy={trade.from[1]} r="7"/></g>}
 </g>
 <g pointerEvents="none" aria-hidden="true">{WATERWAYS.filter((w:any)=>w.kind==='coast').map((w:any)=><text key={w.id} x={w.label[0]} y={w.label[1]} className="sea-label" textAnchor="middle">{w.name}</text>)}{(MAP_LABELS as any[]).map(l=>{const x=(l.at[0]+.5)*CELL,y=(l.at[1]+.5)*CELL;return <text key={l.name} x={x} y={y} className="range-label" textAnchor="middle" transform={l.vertical?`rotate(90 ${x} ${y})`:undefined}>{l.name}</text>;})}</g>
 {routes.map((r:any)=>{const a=sites.find((s:any)=>s.id===r.from),b=sites.find((s:any)=>s.id===r.to);if(!a||!b||a.nation===b.nation)return null;const p=(NATIONS as any)[a.nation].point,q=(NATIONS as any)[b.nation].point;return <path key={r.id} d={`M${p}Q${(p[0]+q[0])/2} ${Math.min(p[1],q[1])-65} ${q}`} className={'atlas-route '+(r.cargo?'moving':'')} fill="none" stroke={r.mode==='rail'?'#a66a32':'#397dba'} strokeWidth="3"/>;})}
 {Object.entries(NATIONS).map(([id,n]:any)=><g key={id} transform={`translate(${n.point})`} onClick={()=>onNation(id)} className={'atlas-label '+(nation===id?'selected':'')} role="presentation"><circle r={nation===id?15:9} fill={nation===id?'#2c86b4':'#fff8dd'} stroke={n.playable?'#487655':'#886076'} strokeWidth="2"/>{n.playable?<path d="M-4 1 0-4 4 1V5H-4Z" fill={nation===id?'#fff':'#537354'}/>:<path d="m-3-3 6 6m0-6-6 6" stroke="#886076" strokeWidth="2"/>}<text y="-21" textAnchor="middle">{focus==='all'?n.capital:n.name}</text>{sites.some((s:any)=>s.nation===id)&&<path d="M15-9v23m0-23h13l-3 5 3 5H15" fill="#f4c75e" stroke="#4e7453" strokeWidth="1"/>}{states.some((s:any)=>(s.rootNation||s.parent)===id)&&<circle cx="-16" cy="10" r="5" fill="#e67c5c"/>}</g>)}
 {states.filter((s:any)=>s.point&&s.provinceIds?.length).map((s:any)=><g key={s.id} className="new-state-label" transform={`translate(${s.point})`}><circle r="5" fill="#f8edbb" stroke="#685743"/><text y="15" textAnchor="middle">{s.name}</text></g>)}
 </svg><div className="atlas-legend"><span><i className="legend-start"/>시작 가능</span><span><i className="legend-enemy"/>적대 세력</span><span className="legend-trade"><i className="silk"/>비단길</span><span className="legend-trade"><i className="paved"/>포장 무역로</span><span className="legend-trade"><i className="minor"/>시골·산길</span><span className="legend-trade"><i className="sea"/>항로</span><span className="legend-trade"><i className="river"/>강·운하·하천</span><span className="legend-trade"><i className="lake"/>호수</span><span><i className="legend-site"/>거점 칸</span><span><i className="legend-mountain"/>산</span><span><i className="legend-forest"/>숲</span><span><i className="legend-ice"/>얼음 지대</span><span><i className="legend-desert"/>사막</span><strong>{selected?.name} · {(FACTIONS as any)[selected?.faction]?.name}</strong></div>
 </div>}
