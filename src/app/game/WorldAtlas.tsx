'use client';
import {memo,useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {ChevronRight,Focus,Globe2,MapPin,Minus,Plus,Route} from 'lucide-react';
import {biomeOf} from './biome-data';
import {PROVINCES,cellsPath} from './territory';
import {NATIONS} from './world';
import {MAJOR_ROUTES,WATERWAYS,TRADE_LINKS} from './trade-routes';
import {CELL,TERRAIN_NAMES,layoutOf} from './world-grid';
import {ATLAS_WIDTH,ATLAS_HEIGHT,FULL_VIEW,NATION_SHAPES,CELL_PROVINCES,PROVINCE_INDEX,clampView,viewAround,zoomView,tileAt} from './atlas-geometry';
import {ATLAS_ART,atlasSprite} from './atlas-terrain';
import {startingProvince,defaultStartingProvince} from './starting-sites';
import {placeAtlasLabels} from './atlas-labels';
import '../world-atlas.css';

const EMPTY:any[]=[];
const Terrain=memo(function Terrain({uid}:{uid:string}){return <g className="world-terrain" pointerEvents="none" aria-hidden="true">
 <defs><pattern id={uid+'-grid'} width={CELL} height={CELL} patternUnits="userSpaceOnUse"><path d={'M0 '+CELL+'V0H'+CELL} fill="none" stroke="#fbf2cf" strokeWidth=".55" strokeOpacity=".28"/></pattern></defs>
 <image href={ATLAS_ART+'terrain.webp'} width={ATLAS_WIDTH} height={ATLAS_HEIGHT} preserveAspectRatio="none" style={{imageRendering:'pixelated'}}/>
 <rect width={ATLAS_WIDTH} height={ATLAS_HEIGHT} fill={'url(#'+uid+'-grid)'}/>
</g>;});
const TradeNetwork=memo(function TradeNetwork(){return <g className="trade-network" pointerEvents="none" aria-hidden="true">
 {TRADE_LINKS.map((l:any)=><path key={l.id+l.from} d={'M'+l.from+'L'+l.to} className={'trade-link '+l.kind} vectorEffect="non-scaling-stroke"/>)}
 {WATERWAYS.filter((w:any)=>w.kind==='coast'||w.kind==='river').map((w:any)=><polyline key={w.id} points={(w.lane||w.line).join(' ')} className={'water-lane '+w.kind} vectorEffect="non-scaling-stroke"/>)}
 {MAJOR_ROUTES.map((r:any)=><g key={r.id} className={'trade-route '+r.kind}><polyline points={r.points.join(' ')} className="casing" vectorEffect="non-scaling-stroke"/><polyline points={r.points.join(' ')} vectorEffect="non-scaling-stroke"/></g>)}
</g>;});

export default function WorldAtlas({nation,onNation,sites=EMPTY,routes=EMPTY,states=EMPTY,provinces={},trade=null,activeProvinceId,onVisit,startProvinceId,onStartProvince,campaign,selectedProvinceId,onProvince}:any){
 const uid=useId().replace(/:/g,''),svg=useRef<SVGSVGElement>(null),viewport=useRef<HTMLDivElement>(null);
 const [size,setSize]=useState({width:900,height:600}),[blocked,setBlocked]=useState<any[]>(EMPTY),shell=useRef<HTMLDivElement>(null);
 const [view,setView]=useState(()=>sites.length?viewAround(PROVINCE_INDEX.get(activeProvinceId)?.point||(NATIONS as any)[nation].point):FULL_VIEW);
 const [network,setNetwork]=useState(false),[region,setRegion]=useState(sites.length?'nation':'all');
 const [selection,setSelection]=useState<{nation:string;cx:number;cz:number}|null>(null);
 const drag=useRef<any>(null),pointers=useRef(new Map<number,{x:number;y:number}>()),pinch=useRef<any>(null),previousNation=useRef(nation);
 const externalId=onStartProvince?startProvinceId:selectedProvinceId;
 // Map controls float over the map; measure them so place names never hide underneath.
 useLayoutEffect(()=>{const v=viewport.current,root=shell.current;if(!v||!root)return;const base=v.getBoundingClientRect();const list=[...root.querySelectorAll('.atlas-breadcrumb,.atlas-layer,.atlas-dock,.atlas-zoom,.atlas-minimap')].map(el=>{const r=el.getBoundingClientRect();return {x:Math.round(r.left-base.left),y:Math.round(r.top-base.top),w:Math.round(r.width),h:Math.round(r.height)};}).filter(r=>r.w>0&&r.h>0&&r.y<base.height&&r.y+r.h>0);setBlocked(old=>JSON.stringify(old)===JSON.stringify(list)?old:list);});
 useEffect(()=>{const element=viewport.current;if(!element)return;const observer=new ResizeObserver(([entry])=>setSize({width:Math.max(1,entry.contentRect.width),height:Math.max(1,entry.contentRect.height)}));observer.observe(element);return()=>observer.disconnect();},[]);
 useEffect(()=>{if(previousNation.current!==nation){previousNation.current=nation;setView(current=>current.width===ATLAS_WIDTH?current:viewAround((NATIONS as any)[nation].point,current.width));}},[nation]);
 useEffect(()=>{const p=PROVINCE_INDEX.get(externalId);if(p&&p.nation===nation){setSelection({nation,cx:p.cell[0],cz:p.cell[1]});setView(current=>current.width===ATLAS_WIDTH?current:viewAround(p.point,current.width));}},[nation,externalId]);
 useEffect(()=>{
  const element=svg.current;if(!element)return;
  const wheel=(event:WheelEvent)=>{if(event.ctrlKey||event.metaKey)return;const matrix=element.getScreenCTM();if(!matrix)return;event.preventDefault();const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?400:1);setView(current=>zoomView(current,Math.exp(Math.max(-100,Math.min(100,delta))*.004),[point.x,point.y]));setRegion('custom');};
  element.addEventListener('wheel',wheel,{passive:false});return()=>element.removeEventListener('wheel',wheel);
 },[]);
 const selected=(NATIONS as any)[nation],activeProvince=PROVINCE_INDEX.get(activeProvinceId);
 const focused=PROVINCE_INDEX.get(externalId)||(activeProvince?.nation===nation?activeProvince:null)||(onStartProvince?defaultStartingProvince(nation):null)||PROVINCE_INDEX.get(nation+'-0')!;
 const cell=selection&&selection.nation===nation?selection:{cx:focused.cell[0],cz:focused.cell[1]};
 const tile=tileAt((cell.cx+.5)*CELL,(cell.cz+.5)*CELL)!;
 const province:any=CELL_PROVINCES.get(cell.cx+','+cell.cz),siteProvince:any=tile.site?PROVINCE_INDEX.get(tile.site):null;
 const ownedSite=sites.find((s:any)=>s.provinceId===tile.site),close=view.width<ATLAS_WIDTH*.6,detail=view.width<ATLAS_WIDTH*.32;
 const ecology=siteProvince?biomeOf(layoutOf(tile.site)):null;
 const unit=1/Math.min(size.width/view.width,size.height/view.height);
 const visible=(p:any)=>p.point[0]>=view.x&&p.point[0]<=view.x+view.width&&p.point[1]>=view.y&&p.point[1]<=view.y+view.height;
 const point=(e:{clientX:number;clientY:number})=>{const matrix=svg.current?.getScreenCTM();if(!matrix)return null;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());return [p.x,p.y];};
 const selectCell=(cx:number,cz:number)=>{
  const target=tileAt((cx+.5)*CELL,(cz+.5)*CELL);if(!target)return false;
  const owner:any=CELL_PROVINCES.get(cx+','+cz),id=owner?.nation||nation;
  setSelection({nation:id,cx,cz});if(id!==nation)onNation(id);
  onStartProvince?.(startingProvince(id,target.site)?.id||null);onProvince?.(target.site||null);return true;
 };
 const focusNation=()=>{setView(viewAround(selected.point));setRegion('nation');};
 const focusCell=()=>{setView(viewAround([(cell.cx+.5)*CELL,(cell.cz+.5)*CELL],CELL*8));setRegion('custom');};
 const reset=()=>{setView(FULL_VIEW);setRegion('all');};
 const statusOf=(p:any)=>sites.some((s:any)=>s.provinceId===p.id)?'owned':!(NATIONS as any)[p.nation].playable?'hostile':onStartProvince?(startingProvince(p.nation,p.id)?'available':'capital'):campaign?campaign.siteOffer(p.nation,p.id).status:p.capital?'capital':'locked';
 const markers=PROVINCES.filter((p:any)=>visible(p)&&(p.capital||p.nation===nation||sites.some((s:any)=>s.provinceId===p.id))).map((p:any)=>({...p,status:statusOf(p)}));
 const labels=placeAtlasLabels([
  ...Object.entries(NATIONS).filter(([id,n]:any)=>visible(n)&&(!detail||id===nation)).map(([id,n]:any)=>({id:'nation-'+id,text:n.name,point:n.point,font:id===nation?15:12,priority:id===nation?90:20,kind:'nation'})),
  ...(close?markers.filter((p:any)=>p.nation===nation||p.status==='owned').map((p:any)=>({id:p.id,text:p.capital?'수도 · '+(NATIONS as any)[p.nation].capital:p.name.split(' ').slice(1).join(' '),point:p.point,font:11,priority:p.id===tile.site?100:p.status==='owned'?80:40,kind:'site',offset:20})):[]),
  ...(!close?WATERWAYS.filter((w:any)=>w.kind==='coast').map((w:any)=>({id:w.id,text:w.name,point:w.label,font:13,priority:10,kind:'water',offset:0})):[]),
  ...states.filter((s:any)=>s.point&&s.provinceIds?.length&&close).map((s:any)=>({id:s.id,text:s.name,point:s.point,font:11,priority:35,kind:'state'}))
 ],view,size,blocked);
 const offer=campaign&&tile.site?campaign.siteOffer(siteProvince.nation,tile.site):null;
 const statusText=ownedSite?'내 거점':onStartProvince?(startingProvince(nation,tile.site)?'시작 가능':siteProvince?.capital?'수도권 · 시작 불가':!selected.playable?'적대 세력 · 시작 불가':!siteProvince?'정착 부지 아님 · 시작 불가':'시작 불가'):offer?(offer.ok?'진출 가능':offer.reason):'정착 부지 아님';
 return <div ref={shell} className="atlas-shell atlas-v2" data-detail={detail?'site':close?'region':'continent'}>
  <div className="atlas-toolbar"><nav className="atlas-breadcrumb" aria-label="지도 범위"><button onClick={reset} aria-pressed={view.width===ATLAS_WIDTH}><Globe2 size={16}/>대륙 전체</button><ChevronRight size={14}/><button onClick={focusNation} aria-pressed={region==='nation'}>{selected.name}</button>{detail&&<><ChevronRight size={14}/><span>거점 주변</span></>}</nav><button className={'atlas-layer '+(network?'active':'')} aria-label="무역로 표시" aria-pressed={network} onClick={()=>setNetwork(!network)}><Route size={16}/><span>무역로</span></button></div>
  <div ref={viewport} className="atlas-viewport">
   <svg ref={svg} className={'world-atlas '+(!close?'whole-world':'')} viewBox={[view.x,view.y,view.width,view.height].join(' ')} role="group" tabIndex={0} aria-label="이르데아 격자 지도. 방향키로 칸 선택, Enter로 주변 확대, 더하기와 빼기로 확대·축소"
    onPointerDown={e=>{if(e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.current.size===2){const [a,b]=[...pointers.current.values()];pinch.current={distance:Math.hypot(a.x-b.x,a.y-b.y),view,point:point({clientX:(a.x+b.x)/2,clientY:(a.y+b.y)/2}),center:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};drag.current=null;}else drag.current={x:e.clientX,y:e.clientY,view,moved:false};}}
    onPointerMove={e=>{if(!pointers.current.has(e.pointerId))return;pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const p=pinch.current;if(p&&pointers.current.size===2){const [a,b]=[...pointers.current.values()],distance=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),next=zoomView(p.view,p.distance/distance,p.point);const scale=Math.min(size.width/next.width,size.height/next.height);setView(clampView({...next,x:next.x-((a.x+b.x)/2-p.center.x)/scale,y:next.y-((a.y+b.y)/2-p.center.y)/scale}));setRegion('custom');return;}const d=drag.current;if(!d)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.abs(dx)+Math.abs(dy)>5)d.moved=true;if(d.moved){const scale=svg.current?.getScreenCTM()?.a||1;setView(clampView({...d.view,x:d.view.x-dx/scale,y:d.view.y-dy/scale}));setRegion('custom');}}}
    onPointerUp={e=>{pointers.current.delete(e.pointerId);if(pinch.current){pinch.current=null;drag.current=null;return;}const d=drag.current;drag.current=null;if(!d||d.moved)return;const p=point(e);if(p){const t=tileAt(p[0],p[1]);if(t)selectCell(t.cx,t.cz);}}}
    onPointerCancel={e=>{pointers.current.delete(e.pointerId);drag.current=null;pinch.current=null;}}
    onDoubleClick={e=>{const p=point(e);if(p){setView(viewAround(p,view.width*.55));setRegion('custom');}}}
    onKeyDown={e=>{const dirs:any={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(dirs[e.key]){e.preventDefault();const [dx,dz]=dirs[e.key];if(selectCell(cell.cx+dx,cell.cz+dz)&&close)setView(viewAround([(cell.cx+dx+.5)*CELL,(cell.cz+dz+.5)*CELL],view.width));}else if(e.key==='Enter'){e.preventDefault();focusCell();}else if(['+','=','-','Home'].includes(e.key)){e.preventDefault();if(e.key==='Home')reset();else setView(zoomView(view,e.key==='-'?1.4:1/1.4));}}}>
    <Terrain uid={uid}/>
    <g className="country-borders" pointerEvents="none" aria-hidden="true">{NATION_SHAPES.map((shape:any)=><path key={shape.id} d={shape.boundary} fill="none" stroke={shape.id===nation?'#ffe6a1':'#f4edcc'} strokeWidth={shape.id===nation?2.3:.65} strokeOpacity={shape.id===nation?.95:.5} vectorEffect="non-scaling-stroke"/>)}<path d={NATION_SHAPES.find((shape:any)=>shape.id===nation)?.path} fill="#fff2b1" fillOpacity=".045"/></g>
    {PROVINCES.filter((p:any)=>provinces[p.id]?.owner&&provinces[p.id].owner!==p.nation).map((p:any)=><path key={p.id} d={cellsPath(p.cells)} fill="#bc7b65" fillOpacity=".28" pointerEvents="none"/>)}
    {network&&<TradeNetwork/>}
    {trade&&network&&<g className="trade-network trade-mine" pointerEvents="none"><polyline points={trade.line.join(' ')} vectorEffect="non-scaling-stroke"/><path d={'M'+trade.from+'L'+trade.to} vectorEffect="non-scaling-stroke"/></g>}
    {routes.map((r:any)=>{const a=sites.find((s:any)=>s.id===r.from),b=sites.find((s:any)=>s.id===r.to);if(!a||!b)return null;const p=PROVINCE_INDEX.get(a.provinceId)?.point,q=PROVINCE_INDEX.get(b.provinceId)?.point;if(!p||!q)return null;return <path key={r.id} d={'M'+p+'L'+q} className={'atlas-route '+(r.cargo?'moving':'')} fill="none" stroke="#f7d280" strokeWidth="2" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" pointerEvents="none"/>;})}
    {campaign&&siteProvince&&!ownedSite&&<path d={'M'+(PROVINCE_INDEX.get(activeProvinceId)?.point||selected.point)+'L'+siteProvince.point} stroke={offer?.ok?'#ffe5a0':'#ddd9bf'} strokeWidth="2" strokeDasharray="4 5" fill="none" vectorEffect="non-scaling-stroke" pointerEvents="none"/>}
    <g className="atlas-sites" pointerEvents="none">{markers.map((p:any)=>{const own=p.status==='owned',available=p.status==='available'||p.status==='materials',w=(close?30:22)*unit;return <g key={p.id} data-province={p.id} data-status={p.status} className={'atlas-site '+p.status}>
     {(p.nation===nation||own)&&<rect x={p.cell[0]*CELL+1} y={p.cell[1]*CELL+1} width={CELL-2} height={CELL-2} rx={1.5} fill={own?'#2e6c58':available?'#fff3b9':'#233f39'} fillOpacity={own?.27:available?.12:.16} stroke={own?'#92d5a3':available?'#ffdf8b':'#d2d2b5'} strokeWidth={own||available?1.5:1} strokeDasharray={p.status==='locked'?'3 3':undefined} vectorEffect="non-scaling-stroke"/>}
     <image href={atlasSprite(own?'settlement':p.status==='hostile'?'hostile':p.capital?'capital':'frontier')} x={p.point[0]-w/2} y={p.point[1]-w*.65} width={w} height={w} style={{imageRendering:'pixelated',opacity:p.status==='locked'?.6:1}}/>
     {p.status==='locked'&&<g transform={`translate(${p.point[0]+w*.33} ${p.point[1]+w*.18}) scale(${unit})`}><rect x="-4" y="-2" width="8" height="7" rx="1" fill="#eae0bc" stroke="#4b5e4c"/><path d="M-2-2v-3a2 2 0 014 0v3" fill="none" stroke="#eae0bc" strokeWidth="2"/></g>}
    </g>;})}</g>
    <g className="atlas-screen-labels" pointerEvents="none">{labels.map((label:any)=>{const plate=label.kind==='site'||label.kind==='state',chosen=label.id==='nation-'+nation;return <g key={label.id} className={'atlas-screen-label '+label.kind+(chosen?' chosen':'')} data-label={label.id}>{plate&&<rect x={label.x-label.width/2} y={label.y-label.height/2} width={label.width} height={label.height} rx={3*unit} fill="#f6efd7ed" stroke="#385d4977" strokeWidth=".6" vectorEffect="non-scaling-stroke"/>}<text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="central" style={{fontSize:label.font,strokeWidth:plate?0:(chosen?4:3.2)*unit}}>{label.text}</text></g>;})}</g>
    <rect className="atlas-selection" x={cell.cx*CELL+.5} y={cell.cz*CELL+.5} width={CELL-1} height={CELL-1} rx="1" fill="none" stroke="#fff2be" strokeWidth="3" vectorEffect="non-scaling-stroke" pointerEvents="none"/>
   </svg>
   {close&&<button className="atlas-minimap" onClick={reset} aria-label="대륙 전체로 돌아가기"><svg viewBox={'0 0 '+ATLAS_WIDTH+' '+ATLAS_HEIGHT} aria-hidden="true"><image href={ATLAS_ART+'terrain.webp'} width={ATLAS_WIDTH} height={ATLAS_HEIGHT}/><rect x={view.x} y={view.y} width={view.width} height={view.height} fill="#fff1bb33" stroke="#fff0b5" strokeWidth="12"/></svg></button>}
   <div className="atlas-zoom" aria-label="지도 확대"><button aria-label="세계 지도 확대" onClick={()=>{setView(zoomView(view,1/1.5));setRegion('custom');}} disabled={view.width<=CELL*8}><Plus size={19}/></button><button aria-label="세계 지도 축소" onClick={()=>{setView(zoomView(view,1.5));setRegion('custom');}} disabled={view.width>=ATLAS_WIDTH}><Minus size={19}/></button><button aria-label="선택 국가로 이동" onClick={focusNation}><Focus size={18}/></button></div>
  </div>
  <div className="atlas-dock">
   <div className="atlas-bottom"><div className="atlas-cell-readout" aria-live="polite"><MapPin size={17}/><div><strong>{ecology?.name||(TERRAIN_NAMES as any)[tile.terrain]}<small>{cell.cx+1}, {cell.cz+1}</small></strong><span>{ownedSite?.name||siteProvince?.name||(province?(NATIONS as any)[province.nation].name:'자연 지형')} · {statusText}</span></div></div><button className="atlas-inspect" onClick={()=>ownedSite&&onVisit&&ownedSite.provinceId!==activeProvinceId?onVisit(ownedSite.id):focusCell()}>{ownedSite&&onVisit&&ownedSite.provinceId!==activeProvinceId?'거점 이동':'주변 확대'}<ChevronRight size={15}/></button></div>
   <div className="atlas-legend"><span><img src={atlasSprite('capital')} alt=""/>수도</span><span><img src={atlasSprite('frontier')} alt=""/>{onStartProvince?'시작 후보':'진출 후보'}</span>{sites.length>0&&<span><img src={atlasSprite('settlement')} alt=""/>내 거점</span>}<span><img src={atlasSprite('hostile')} alt=""/>적대</span><em>1칸 = 24×24 마을</em></div>
  </div>
 </div>;
}
