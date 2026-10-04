'use client';
import {memo,useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {ChevronRight,Focus,Globe2,MapPin,Minus,Plus,Route,RotateCcw,RotateCw} from 'lucide-react';
import {biomeOf} from './biome-data';
import {PROVINCES,WORLD_PLOTS,cellsPath,sovereignOf,developmentOf,frontierClaimOf,landOwnerOf} from './territory';
import {NATIONS} from './world';
import {MAJOR_ROUTES,WATERWAYS,TRADE_LINKS} from './trade-routes';
import {CELL,TERRAIN_NAMES,layoutOf} from './world-grid';
import {ATLAS_WIDTH,ATLAS_HEIGHT,FULL_VIEW,CELL_PROVINCES,PROVINCE_INDEX,UNSETTLEABLE_CELLS,UNCLAIMED_AREA,WILDERNESS_LABELS,wildernessCells,frontierShape,terrainBlockReason,politicalShapes,clampView,viewAround,zoomView,tileAt} from './atlas-geometry';
import {ATLAS_ART,ATLAS_DECORATIONS,ATLAS_SPRITES,atlasSprite,atlasQuarterSprite} from './atlas-terrain';
import {ATLAS_VIEWS,groundTransform,projectAtlas,unprojectAtlas,unprojectDelta,projectView,minimapFootprint,normalizeView,screenStep} from './atlas-projection';
import {startingProvince,defaultStartingProvince} from './starting-sites';
import {PLOT_RESTRICTIONS,restrictionOf,startBlockReason} from './settlement-access';
import {placeAtlasLabels} from './atlas-labels';
import {OUTSKIRT_BOUNDS,OUTSKIRT_DECORATIONS,SURROUND_BOUNDS} from './atlas-outskirts';
import '../world-atlas.css';

const EMPTY:any[]=[];
const Terrain=memo(function Terrain({uid}:{uid:string}){return <g className="world-terrain" pointerEvents="none" aria-hidden="true">
 <defs><pattern id={uid+'-grid'} width={CELL} height={CELL} patternUnits="userSpaceOnUse"><path d={'M0 '+CELL+'V0H'+CELL} fill="none" stroke="#3d603a" strokeWidth=".4" strokeOpacity=".2"/></pattern></defs>
 <image className="atlas-outskirts-ground" href={ATLAS_ART+'outskirts.webp'} {...OUTSKIRT_BOUNDS} preserveAspectRatio="none"/>
 <image className="atlas-surround-ground" href={ATLAS_ART+'surrounds.webp'} {...SURROUND_BOUNDS} preserveAspectRatio="none" style={{imageRendering:'pixelated'}}/>
 <image href={ATLAS_ART+'ground.webp'} width={ATLAS_WIDTH} height={ATLAS_HEIGHT} preserveAspectRatio="none" style={{imageRendering:'pixelated'}}/>
 <rect width={ATLAS_WIDTH} height={ATLAS_HEIGHT} fill={'url(#'+uid+'-grid)'}/>
</g>;});
const TerrainBlocks=memo(function TerrainBlocks({quarter,focus}:{quarter:number;focus?:{cx:number;cz:number}}){return <g className="atlas-terrain-blocks" pointerEvents="none" aria-hidden="true">{UNSETTLEABLE_CELLS.filter((c:any)=>!focus||c.cx===focus.cx&&c.cz===focus.cz).map((c:any)=>{const [x,y]=projectAtlas([(c.cx+.5)*CELL,(c.cz+.5)*CELL],quarter);return <g key={c.cx+','+c.cz} data-blocked-terrain={c.terrain} transform={`translate(${x+3} ${y+1})`}><rect width="7" height="7" rx="1" fill={c.terrain==='mountain'?'#614f3b':'#235a6b'} fillOpacity=".85"/><path d="M2 2l3 3m0-3l-3 3" fill="none" stroke="#fff1cb" strokeWidth="1.15"/></g>;})}</g>;});
const TradeNetwork=memo(function TradeNetwork(){return <g className="trade-network" pointerEvents="none" aria-hidden="true">
 {TRADE_LINKS.map((l:any)=><path key={l.id+l.from} d={'M'+l.from+'L'+l.to} className={'trade-link '+l.kind} vectorEffect="non-scaling-stroke"/>)}
 {WATERWAYS.filter((w:any)=>w.kind==='coast'||w.kind==='river').map((w:any)=><polyline key={w.id} points={(w.lane||w.line).join(' ')} className={'water-lane '+w.kind} vectorEffect="non-scaling-stroke"/>)}
 {MAJOR_ROUTES.map((r:any)=><g key={r.id} className={'trade-route '+r.kind}><polyline points={r.points.join(' ')} className="casing" vectorEffect="non-scaling-stroke"/><polyline points={r.points.join(' ')} vectorEffect="non-scaling-stroke"/></g>)}
</g>;});

export default function WorldAtlas({nation,onNation,sites=EMPTY,routes=EMPTY,states=EMPTY,provinces={},trade=null,activeProvinceId,onVisit,startProvinceId,onStartProvince,campaign,selectedProvinceId,onProvince,startStage,onInspectTerrain}:any){
 const startMode=!!startStage;
 const uid=useId().replace(/:/g,''),svg=useRef<SVGSVGElement>(null),viewport=useRef<HTMLDivElement>(null);
 const [size,setSize]=useState({width:900,height:600}),[blocked,setBlocked]=useState<any[]>(EMPTY),shell=useRef<HTMLDivElement>(null);
 const [view,setView]=useState(()=>sites.length?viewAround(PROVINCE_INDEX.get(activeProvinceId)?.point||((NATIONS as any)[nation]||UNCLAIMED_AREA).point):FULL_VIEW);
 const portrait=size.width<600;
 useEffect(()=>{if(!startStage)return;const p=PROVINCE_INDEX.get(externalId)?.point||((NATIONS as any)[nation]||UNCLAIMED_AREA).point;setView(viewAround(p,CELL*(startStage==='country'?(portrait?23:36):8)));setRegion(startStage==='country'?'all':'nation');},[startStage,portrait]);
 const [network,setNetwork]=useState(false),[region,setRegion]=useState(sites.length?'nation':'all');
 const [quarter,setQuarter]=useState(0),projected=projectView(view,quarter);
 const [selection,setSelection]=useState<{nation:string;cx:number;cz:number}|null>(null),[hover,setHover]=useState<{cx:number;cz:number}|null>(null);
 const drag=useRef<any>(null),pointers=useRef(new Map<number,{x:number;y:number}>()),pinch=useRef<any>(null),previousNation=useRef(nation);
 const externalId=onStartProvince?startProvinceId:selectedProvinceId;
 // Map controls float over the map; measure them so place names never hide underneath.
 useLayoutEffect(()=>{const v=viewport.current,root=shell.current;if(!v||!root)return;const base=v.getBoundingClientRect();const list=[...(root.closest('.start-world')||root).querySelectorAll('.atlas-breadcrumb,.atlas-layer,.atlas-rotation,.atlas-dock,.atlas-zoom,.atlas-minimap,.start-top,.start-bottom,.start-find,.start-plot-find,.start-help-button')].map(el=>{const r=el.getBoundingClientRect();return {x:Math.round(r.left-base.left),y:Math.round(r.top-base.top),w:Math.round(r.width),h:Math.round(r.height)};}).filter(r=>r.w>0&&r.h>0&&r.y<base.height&&r.y+r.h>0);setBlocked(old=>JSON.stringify(old)===JSON.stringify(list)?old:list);});
 useEffect(()=>{const element=viewport.current;if(!element)return;const observer=new ResizeObserver(([entry])=>setSize({width:Math.max(1,entry.contentRect.width),height:Math.max(1,entry.contentRect.height)}));observer.observe(element);return()=>observer.disconnect();},[]);
 useEffect(()=>{if(previousNation.current!==nation){previousNation.current=nation;setView(current=>current.width===ATLAS_WIDTH?current:viewAround(((NATIONS as any)[nation]||UNCLAIMED_AREA).point,current.width));}},[nation]);
 useEffect(()=>{const p=PROVINCE_INDEX.get(externalId);if(p&&(p.nation===nation||p.nation===null)){setSelection({nation,cx:p.cell[0],cz:p.cell[1]});setView(current=>current.width===ATLAS_WIDTH?current:viewAround(p.point,current.width));}},[nation,externalId]);
 useEffect(()=>{
  const element=svg.current;if(!element)return;
  const wheel=(event:WheelEvent)=>{if(event.ctrlKey||event.metaKey)return;const matrix=element.getScreenCTM();if(!matrix)return;event.preventDefault();const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse()),world=unprojectAtlas([point.x,point.y],quarter);const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?400:1);setView(current=>zoomView(current,Math.exp(Math.max(-100,Math.min(100,delta))*.004),world));setRegion('custom');};
  element.addEventListener('wheel',wheel,{passive:false});return()=>element.removeEventListener('wheel',wheel);
 },[quarter]);
 useEffect(()=>{for(const q of [normalizeView(quarter+1),normalizeView(quarter-1)])for(const name of ATLAS_SPRITES){const img=new Image();img.src=atlasQuarterSprite(name,q);}},[quarter]);
 const selected=(NATIONS as any)[nation]||(nation==='player'?{...UNCLAIMED_AREA,name:'내 변경 영지'}:UNCLAIMED_AREA),activeProvince=PROVINCE_INDEX.get(activeProvinceId),borders=politicalShapes(provinces),wildCells=wildernessCells(provinces,sites),claims=frontierShape(sites);
 const focused=PROVINCE_INDEX.get(externalId)||(activeProvince?.nation===nation?activeProvince:null)||(onStartProvince?defaultStartingProvince(nation):null)||PROVINCE_INDEX.get(nation+'-0')||WORLD_PLOTS.find((p:any)=>p.nation===null)!;
 const cell=selection&&selection.nation===nation?selection:{cx:focused.cell[0],cz:focused.cell[1]};
 const tile=tileAt((cell.cx+.5)*CELL,(cell.cz+.5)*CELL)!;
 const province:any=CELL_PROVINCES.get(cell.cx+','+cell.cz),siteProvince:any=tile.site?PROVINCE_INDEX.get(tile.site):null;
 const landOwner=tile.site?landOwnerOf(tile.site,provinces,sites):province?sovereignOf(province.id,provinces):null;
 const viewingWilderness=landOwner!=='player'&&(nation==='unclaimed'||!!province&&sovereignOf(province.id,provinces)===null);
 const ownedSite=sites.find((s:any)=>s.provinceId===tile.site),close=(!startMode||startStage==='plot')&&view.width<ATLAS_WIDTH*.6,detail=(!startMode||startStage==='plot')&&view.width<ATLAS_WIDTH*.32;
 const ecology=siteProvince?biomeOf(layoutOf(tile.site)):null;
 const unit=1/Math.min(size.width/projected.width,size.height/projected.height);
 const visible=(p:any)=>{const [x,y]=projectAtlas(p.point,quarter),cx=projected.x+projected.width/2,cy=projected.y+projected.height/2;return Math.abs(x-cx)<=size.width*unit/2+45&&y>=cy-size.height*unit/2&&y<=cy+size.height*unit/2+45;};
 const point=(e:{clientX:number;clientY:number})=>{const matrix=svg.current?.getScreenCTM();if(!matrix)return null;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());return unprojectAtlas([p.x,p.y],quarter);};
 const rotate=(by:number)=>{setQuarter(q=>normalizeView(q+by));setHover(null);};
 const selectCell=(cx:number,cz:number)=>{
  const target=tileAt((cx+.5)*CELL,(cz+.5)*CELL);if(!target)return false;
  const owner:any=CELL_PROVINCES.get(cx+','+cz),id=frontierClaimOf(target.site,sites)?'player':owner?.nation||(campaign?'unclaimed':nation);
  if(startStage==='country'){if(owner?.nation)onNation(owner.nation);return !!owner?.nation;}
  setSelection({nation:id,cx,cz});if(id!==nation)onNation(id);
  onInspectTerrain?.(target);
  onStartProvince?.(target.site||null);onProvince?.(target.site||null);return true;
 };
 const focusNation=()=>{setView(viewAround(viewingWilderness||landOwner==='player'?[(cell.cx+.5)*CELL,(cell.cz+.5)*CELL]:selected.point));setRegion('nation');};
 const focusCell=()=>{setView(viewAround([(cell.cx+.5)*CELL,(cell.cz+.5)*CELL],CELL*8));setRegion('custom');};
 const reset=()=>{setView(FULL_VIEW);setRegion('all');};
 const statusOf=(p:any)=>sites.some((s:any)=>s.provinceId===p.id)?'owned':p.nation&&!(NATIONS as any)[p.nation].playable?'hostile':onStartProvince?(startingProvince(p.nation,p.id)?'available':p.developed?'capital':'unclaimed'):campaign?campaign.siteOffer(p.nation||'unclaimed',p.id).status:p.capital?'capital':'locked';
 const markers=WORLD_PLOTS.filter((p:any)=>visible(p)&&developmentOf(p.id,sites)==='settlement').map((p:any)=>({...p,status:statusOf(p)}));
 const plots=WORLD_PLOTS.filter((p:any)=>visible(p)&&(viewingWilderness?landOwnerOf(p.id,provinces,sites)===null:p.nation===nation)&&!p.developed&&!sites.some((s:any)=>s.provinceId===p.id));
 const restrictedPlots=WORLD_PLOTS.filter((p:any)=>PLOT_RESTRICTIONS.has(p.id)&&visible(p)&&!sites.some((s:any)=>s.provinceId===p.id));
 const markedRestrictions=startMode?restrictedPlots.filter((p:any)=>p.cell[0]===(hover||cell).cx&&p.cell[1]===(hover||cell).cz):restrictedPlots;
 const labels=placeAtlasLabels([
  ...Object.entries(NATIONS).filter(([,n]:any)=>visible(n)&&(!detail||startMode)).map(([id,n]:any)=>({id:'nation-'+id,text:n.name,point:n.point,font:startMode?(id===nation?(portrait?18:24):n.tier==='major'?(portrait?16:20):(portrait?13:17)):(id===nation?15:n.tier==='major'?14:11),priority:id===nation?90:n.tier==='major'?60:25,kind:'nation',offset:20})),
  ...WILDERNESS_LABELS.filter((p:any)=>visible(p)&&!detail&&sovereignOf(p.province,provinces)===null).map((p:any)=>({...p,font:12,priority:30,kind:'wilderness',offset:0})),
  ...(close?markers.filter((p:any)=>p.nation===nation||p.status==='owned').map((p:any)=>({id:p.id,text:p.capital?'수도 · '+(NATIONS as any)[p.nation].capital:p.name.split(' ').slice(1).join(' '),point:p.point,font:11,priority:p.id===tile.site?100:p.status==='owned'?80:40,kind:'site',offset:Math.max(24,CELL*1.4*.82/unit)+4})):[]),
  ...(!close?WATERWAYS.filter((w:any)=>w.kind==='coast').map((w:any)=>({id:w.id,text:w.name,point:w.label,font:13,priority:10,kind:'water',offset:0})):[]),
  ...states.filter((s:any)=>s.point&&s.provinceIds?.length&&close).map((s:any)=>({id:s.id,text:s.name,point:s.point,font:11,priority:35,kind:'state'}))
 ].map(item=>({...item,point:projectAtlas(item.point,quarter)})),projected,size,blocked);
 const occupied=new Set(markers.map((p:any)=>p.cell.join(',')));
 const objects=[
  ...OUTSKIRT_DECORATIONS.filter((p:any)=>visible(p)),
  ...ATLAS_DECORATIONS.filter((p:any)=>visible(p)&&!occupied.has([Math.floor(p.point[0]/CELL),Math.floor(p.point[1]/CELL)].join(','))).map((p:any)=>({...p,kind:'terrain'})),
  ...markers.map((p:any)=>({...p,name:p.status==='owned'?'settlement':p.status==='hostile'?'hostile':p.capital?'capital':'frontier',size:Math.max((close?28:20)*unit,CELL*(p.capital?2:1.4)),kind:'site'}))
 ].map((p:any)=>({...p,screen:projectAtlas(p.point,quarter)})).sort((a,b)=>a.screen[1]-b.screen[1]||a.screen[0]-b.screen[0]);
 const sovereign=province?sovereignOf(province.id,provinces):null,ownerName=landOwner==='player'?'내 변경 영지':(NATIONS as any)[sovereign]?.name||states.find((s:any)=>s.id===sovereign)?.name||'무주지';
 const development=tile.site?developmentOf(tile.site,sites):'undeveloped';
 const landStatus=ownedSite?(development==='settlement'?'내 거점 · 개발 중':'내 거점 · 미개발'):development==='settlement'?'기존 정착지':sovereign===null?'미개척지':'미개발지';
 const offer=campaign&&tile.site?campaign.siteOffer(landOwner==='player'?'player':sovereign===null?'unclaimed':siteProvince.nation,tile.site):null;
 const statusText=terrainBlockReason(tile.terrain)||(ownedSite?landStatus:restrictionOf(tile.site)?.reason|| (onStartProvince?(startBlockReason(nation,tile.site)||'미개발지 · 시작 가능'):offer?(landStatus+' · '+(offer.ok?'진출 가능':offer.reason)):landStatus));
 return <div ref={shell} className={'atlas-shell atlas-v2 atlas-isometric'+(startMode?' atlas-start':'')} data-start-stage={startStage} data-quarter={quarter} data-detail={detail?'site':close?'region':'continent'}>
  {!startMode&&<div className="atlas-toolbar"><nav className="atlas-breadcrumb" aria-label="지도 범위"><button onClick={reset} aria-pressed={view.width===ATLAS_WIDTH}><Globe2 size={16}/>대륙 전체</button><ChevronRight size={14}/><button onClick={focusNation} aria-pressed={region==='nation'}>{viewingWilderness?'무주지':selected.name}</button>{detail&&<><ChevronRight size={14}/><span>거점 주변</span></>}</nav><button className={'atlas-layer '+(network?'active':'')} aria-label="무역로 표시" aria-pressed={network} onClick={()=>setNetwork(!network)}><Route size={16}/><span>무역로</span></button></div>}
  <div ref={viewport} className="atlas-viewport">
   <svg ref={svg} className={'world-atlas '+(!close?'whole-world':'')} viewBox={[projected.x,projected.y,projected.width,projected.height].join(' ')} data-world-width={view.width} data-quarter={quarter} role="group" tabIndex={0} aria-label="이르데아 아이소메트릭 지도. Q와 E로 90도 회전, 방향키로 칸 선택, Enter로 주변 확대, 더하기와 빼기로 확대·축소"
    onPointerDown={e=>{if(e.button!==0)return;e.currentTarget.focus();e.currentTarget.setPointerCapture(e.pointerId);pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.current.size===2){const [a,b]=[...pointers.current.values()];pinch.current={distance:Math.hypot(a.x-b.x,a.y-b.y),view,point:point({clientX:(a.x+b.x)/2,clientY:(a.y+b.y)/2}),center:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};drag.current=null;}else drag.current={x:e.clientX,y:e.clientY,view,moved:false};}}
    onPointerLeave={()=>setHover(null)}
    onPointerMove={e=>{if(!pointers.current.has(e.pointerId)){const p=point(e),t=p&&tileAt(p[0],p[1]);setHover(old=>old?.cx===t?.cx&&old?.cz===t?.cz?old:t?{cx:t.cx,cz:t.cz}:null);return;}pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const p=pinch.current;if(p&&pointers.current.size===2){const [a,b]=[...pointers.current.values()],distance=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),next=zoomView(p.view,p.distance/distance,p.point),iso=projectView(next,quarter),scale=Math.min(size.width/iso.width,size.height/iso.height),[dx,dz]=unprojectDelta([((a.x+b.x)/2-p.center.x)/scale,((a.y+b.y)/2-p.center.y)/scale],quarter);setView(clampView({...next,x:next.x-dx,y:next.y-dz}));setRegion('custom');return;}const d=drag.current;if(!d)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.abs(dx)+Math.abs(dy)>5)d.moved=true;if(d.moved){const scale=svg.current?.getScreenCTM()?.a||1,[wx,wz]=unprojectDelta([dx/scale,dy/scale],quarter);setView(clampView({...d.view,x:d.view.x-wx,y:d.view.y-wz}));setRegion('custom');}}}
    onPointerUp={e=>{pointers.current.delete(e.pointerId);if(pinch.current){pinch.current=null;drag.current=null;return;}const d=drag.current;drag.current=null;if(!d||d.moved)return;const p=point(e);if(p){const t=tileAt(p[0],p[1]);if(t)selectCell(t.cx,t.cz);}}}
    onPointerCancel={e=>{pointers.current.delete(e.pointerId);drag.current=null;pinch.current=null;}}
    onDoubleClick={e=>{const p=point(e);if(p){setView(viewAround(p,view.width*.55));setRegion('custom');}}}
    onKeyDown={e=>{const step=screenStep(e.key,quarter);if(step){e.preventDefault();e.stopPropagation();const [dx,dz]=step;if(selectCell(cell.cx+dx,cell.cz+dz)&&close)setView(viewAround([(cell.cx+dx+.5)*CELL,(cell.cz+dz+.5)*CELL],view.width));}else if(['q','e'].includes(e.key.toLowerCase())){e.preventDefault();e.stopPropagation();rotate(e.key.toLowerCase()==='q'?-1:1);}else if(e.key==='Enter'){e.preventDefault();focusCell();}else if(['+','=','-','Home'].includes(e.key)){e.preventDefault();if(e.key==='Home')reset();else setView(zoomView(view,e.key==='-'?1.4:1/1.4));}}}>
    <g className="atlas-ground" transform={groundTransform(quarter)}>
    <Terrain uid={uid}/>
    <path className="atlas-wilderness" d={cellsPath(wildCells)} data-unclaimed-cells={wildCells.length} fill="#ddd8b3" fillOpacity=".14" pointerEvents="none"/>
    <g className="country-borders" pointerEvents="none" aria-hidden="true">{borders.map((shape:any)=><g key={shape.id} data-country={shape.id} data-tier={shape.tier}><path d={shape.path} fill={shape.id===nation?'#fff0b0':shape.color} fillOpacity={shape.id===nation?.14:.018}/><path d={shape.boundary} fill="none" stroke="#fff0c8" strokeWidth={shape.id===nation?5:3.4} strokeLinejoin="round" vectorEffect="non-scaling-stroke"/><path d={shape.boundary} fill="none" stroke={shape.id===nation?'#edc565':shape.color} strokeWidth={shape.id===nation?2.6:1.6} strokeLinejoin="round" vectorEffect="non-scaling-stroke"/></g>)}</g>
    {(!startMode||startStage==='plot')&&<g className="atlas-plots" pointerEvents="none" aria-hidden="true">{plots.map((p:any)=><rect key={p.id} data-plot={p.id} x={p.cell[0]*CELL+1} y={p.cell[1]*CELL+1} width={CELL-2} height={CELL-2} fill="#f8f5c2" fillOpacity={selected.playable?.06:0} stroke={selected.playable?'#f4edbc':'#6b4540'} strokeOpacity={close?.44:.22} strokeWidth=".7" vectorEffect="non-scaling-stroke"/>)}</g>}
    {close&&<g className="atlas-restricted-land" pointerEvents="none">{restrictedPlots.map((p:any)=><rect key={p.id} x={p.cell[0]*CELL+1} y={p.cell[1]*CELL+1} width={CELL-2} height={CELL-2} fill="#8d623e" fillOpacity=".13" stroke="#8d623e" strokeWidth=".8" strokeDasharray="2 2" vectorEffect="non-scaling-stroke"/>)}</g>}
    {PROVINCES.filter((p:any)=>provinces[p.id]?.owner&&provinces[p.id].owner!==p.nation).map((p:any)=><path key={p.id} d={cellsPath(p.cells)} fill="#bc7b65" fillOpacity=".28" pointerEvents="none"/>)}
    {network&&<TradeNetwork/>}
    {trade&&network&&<g className="trade-network trade-mine" pointerEvents="none"><polyline points={trade.line.join(' ')} vectorEffect="non-scaling-stroke"/><path d={'M'+trade.from+'L'+trade.to} vectorEffect="non-scaling-stroke"/></g>}
    {routes.map((r:any)=>{const a=sites.find((s:any)=>s.id===r.from),b=sites.find((s:any)=>s.id===r.to);if(!a||!b)return null;const p=PROVINCE_INDEX.get(a.provinceId)?.point,q=PROVINCE_INDEX.get(b.provinceId)?.point;if(!p||!q)return null;return <path key={r.id} d={'M'+p+'L'+q} className={'atlas-route '+(r.cargo?'moving':'')} fill="none" stroke="#f7d280" strokeWidth="2" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" pointerEvents="none"/>;})}
    {campaign&&siteProvince&&!ownedSite&&<path d={'M'+(PROVINCE_INDEX.get(activeProvinceId)?.point||selected.point)+'L'+siteProvince.point} stroke={offer?.ok?'#ffe5a0':'#ddd9bf'} strokeWidth="2" strokeDasharray="4 5" fill="none" vectorEffect="non-scaling-stroke" pointerEvents="none"/>}
    <g className="atlas-site-bases" pointerEvents="none">{markers.map((p:any)=>{const own=p.status==='owned',available=p.status==='available'||p.status==='materials';return <g key={p.id}>
     {(p.nation===nation||own)&&<rect x={p.cell[0]*CELL+1} y={p.cell[1]*CELL+1} width={CELL-2} height={CELL-2} rx={1.5} fill={own?'#2e6c58':available?'#fff3b9':'#233f39'} fillOpacity={own?.27:available?.12:.16} stroke={own?'#92d5a3':available?'#ffdf8b':'#d2d2b5'} strokeWidth={own||available?1.5:1} strokeDasharray={p.status==='locked'?'3 3':undefined} vectorEffect="non-scaling-stroke"/>}
    </g>;})}</g>
    <g className="atlas-outposts" pointerEvents="none">{sites.filter((s:any)=>developmentOf(s.provinceId,sites)==='outpost').map((s:any)=>{const p=PROVINCE_INDEX.get(s.provinceId);return p&&<rect key={s.id} data-outpost={p.id} x={p.cell[0]*CELL+1} y={p.cell[1]*CELL+1} width={CELL-2} height={CELL-2} fill="#92d5a3" fillOpacity=".18" stroke="#92d5a3" strokeWidth="2" vectorEffect="non-scaling-stroke"/>;})}</g>
    {claims.cells.length>0&&<g className="atlas-frontier-land" data-owner="player" data-cells={claims.cells.length} pointerEvents="none"><path d={claims.path} fill="#e9b957" fillOpacity=".24"/><path d={claims.boundary} fill="none" stroke="#493c21" strokeWidth="6" vectorEffect="non-scaling-stroke"/><path d={claims.boundary} fill="none" stroke="#ffe29a" strokeWidth="3" vectorEffect="non-scaling-stroke"/></g>}
    </g>
    <g className="atlas-objects" pointerEvents="none" aria-hidden="true">{objects.map((p:any)=>{const [x,y]=p.screen,w=p.size;return <g key={p.id} data-sprite={p.name} data-depth={y} data-quarter={quarter} data-province={p.kind==='site'?p.id:undefined} data-status={p.status} className={p.kind==='site'?'atlas-site '+p.status:'atlas-object '+p.kind}>
     <ellipse cx={x} cy={y+1} rx={w*.28} ry={w*.1} fill="#203927" opacity=".17"/>
     <image href={atlasQuarterSprite(p.name,quarter)} x={x-w/2} y={y-w*.82} width={w} height={w} style={{imageRendering:'pixelated',opacity:p.opacity??(p.status==='locked'?.65:1)}}/>
     {p.status==='locked'&&<g transform={`translate(${x+w*.3} ${y-w*.15}) scale(${unit})`}><rect x="-4" y="-2" width="8" height="7" rx="1" fill="#eae0bc" stroke="#4b5e4c"/><path d="M-2-2v-3a2 2 0 014 0v3" fill="none" stroke="#eae0bc" strokeWidth="2"/></g>}
    </g>;})}</g>
    {close&&<TerrainBlocks quarter={quarter} focus={startMode?(hover||cell):undefined}/>}
    {close&&<g className="atlas-restrictions" pointerEvents="none">{markedRestrictions.map((p:any)=>{const [x,y]=projectAtlas(p.point,quarter);return <g key={p.id} data-restricted-plot={p.id} data-restriction={PLOT_RESTRICTIONS.get(p.id)} transform={`translate(${x+4} ${y+1})`}><title>{restrictionOf(p.id)?.reason}</title><rect x="-1" y="-2" width="9" height="10" rx="1" fill="#765332"/><rect x="1" y="2" width="5" height="4" rx=".6" fill="#ffebbb"/><path d="M2 2V.5a1.5 1.5 0 013 0V2" fill="none" stroke="#ffebbb" strokeWidth="1.2"/></g>;})}</g>}
    <g className="atlas-screen-labels" pointerEvents="none">{labels.map((label:any)=>{const plate=label.kind==='site'||label.kind==='state',chosen=label.id==='nation-'+nation;return <g key={label.id} className={'atlas-screen-label '+label.kind+(chosen?' chosen':'')} data-label={label.id} onPointerDown={e=>{if(startMode&&label.kind==='nation')e.stopPropagation();}} onPointerUp={e=>{if(startMode&&label.kind==='nation')e.stopPropagation();}} role={startMode&&label.kind==='nation'?'button':undefined} tabIndex={startMode&&label.kind==='nation'?0:undefined} aria-label={startMode&&label.kind==='nation'?label.text+' 선택':undefined} onClick={startMode&&label.kind==='nation'?()=>onNation(label.id.slice(7)):undefined} onKeyDown={e=>{if(startMode&&label.kind==='nation'&&['Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();onNation(label.id.slice(7));}}}>{plate&&<rect x={label.x-label.width/2} y={label.y-label.height/2} width={label.width} height={label.height} rx={3*unit} fill="#f6efd7ed" stroke="#385d4977" strokeWidth=".6" vectorEffect="non-scaling-stroke"/>}<text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="central" style={{fontSize:label.font,strokeWidth:plate?0:(chosen?4:3.2)*unit}}>{label.text}</text></g>;})}</g>
    {hover&&(!startMode||startStage==='plot')&&<rect className="atlas-hover" transform={groundTransform(quarter)} x={hover.cx*CELL+.5} y={hover.cz*CELL+.5} width={CELL-1} height={CELL-1} fill="#fff7c7" fillOpacity=".16" stroke="#fff9da" strokeWidth="1.5" vectorEffect="non-scaling-stroke" pointerEvents="none"/>}
    {(!startMode||startStage==='plot')&&<rect className="atlas-selection" transform={groundTransform(quarter)} x={cell.cx*CELL+.5} y={cell.cz*CELL+.5} width={CELL-1} height={CELL-1} rx="1" fill="#fff2be" fillOpacity=".08" stroke="#fff2be" strokeWidth="3" vectorEffect="non-scaling-stroke" pointerEvents="none"/>}
    {startStage==='plot'&&province&&<g className="atlas-selection-pin" transform={`translate(${projectAtlas([(cell.cx+.5)*CELL,(cell.cz+.5)*CELL],quarter).join(' ')}) scale(${unit})`} pointerEvents="none"><path d="M0-12C-5-21-14-30-14-39a14 14 0 0 1 28 0C14-30 5-21 0-12Z" fill="#fff1b8" stroke="#917d35" strokeWidth="2"/><circle cy="-39" r="4.5" fill="#8e9f59"/></g>}
   </svg>
   {close&&!startMode&&<button className="atlas-minimap" onClick={reset} aria-label="대륙 전체로 돌아가기"><svg viewBox={'0 0 '+ATLAS_WIDTH+' '+ATLAS_HEIGHT} aria-hidden="true"><image href={ATLAS_ART+'terrain.webp'} width={ATLAS_WIDTH} height={ATLAS_HEIGHT}/>{borders.map((s:any)=><path key={s.id} d={s.boundary} fill="none" stroke="#fff0c8" strokeWidth="7"/>)}<path d={claims.path} fill="#ffd274"/><path d={claims.boundary} fill="none" stroke="#ffd274" strokeWidth="7"/><polygon points={minimapFootprint(view,quarter).map((p:any)=>p.join(',')).join(' ')} fill="#fff1bb33" stroke="#fff0b5" strokeWidth="12"/></svg></button>}
   <div className="atlas-rotation" aria-label="지도 시점"><button aria-label="세계 지도 왼쪽으로 90도 회전" title="Q · 왼쪽으로 90°" onClick={()=>rotate(-1)}><RotateCcw size={17}/></button><span>{ATLAS_VIEWS[quarter]}</span><button aria-label="세계 지도 오른쪽으로 90도 회전" title="E · 오른쪽으로 90°" onClick={()=>rotate(1)}><RotateCw size={17}/></button></div>
   <div className="atlas-zoom" aria-label="지도 확대"><button aria-label="세계 지도 확대" onClick={()=>{setView(zoomView(view,1/1.5));setRegion('custom');}} disabled={view.width<=CELL*8}><Plus size={19}/></button><button aria-label="세계 지도 축소" onClick={()=>{setView(zoomView(view,1.5));setRegion('custom');}} disabled={view.width>=ATLAS_WIDTH}><Minus size={19}/></button><button aria-label="선택 국가로 이동" onClick={focusNation}><Focus size={18}/></button></div>
  </div>
  {!startMode&&<div className="atlas-dock">
   <div className="atlas-bottom"><div className="atlas-cell-readout" aria-live="polite" data-sovereign={sovereign||'unclaimed'} data-owner={landOwner||'unclaimed'} data-development={development}><MapPin size={17}/><div><strong>{ownedSite?.name||siteProvince?.name||ecology?.name||(TERRAIN_NAMES as any)[tile.terrain]}<small>{cell.cx+1}, {cell.cz+1}</small></strong><span>{ownerName} · {statusText}</span></div></div><button className="atlas-inspect" onClick={()=>ownedSite&&onVisit&&ownedSite.provinceId!==activeProvinceId?onVisit(ownedSite.id):focusCell()}>{ownedSite&&onVisit&&ownedSite.provinceId!==activeProvinceId?'거점 이동':'주변 확대'}<ChevronRight size={15}/></button></div>
   <details className="atlas-key"><summary>지도 기호</summary><div className="atlas-legend"><span><img src={atlasSprite('capital')} alt=""/>수도</span><span><img src={atlasSprite('frontier')} alt=""/>정착지</span>{sites.length>0&&<span><i className="frontier-key"/>내 변경 영지</span>}<span><i className="wilderness-key"/>무주지</span><span><b className="terrain-block-key">×</b>산·수역</span><span><svg width="11" height="13" viewBox="0 0 11 13" aria-hidden="true"><rect x="1" y="5" width="9" height="7" rx="1" fill="#765332"/><path d="M3 5V3a2.5 2.5 0 015 0v2" fill="none" stroke="#765332" strokeWidth="1.5"/></svg>정착 제한</span><span><i className="border-key"/>국경</span><em>빈 땅은 미개발 · 1칸 = 24×24</em></div></details>
  </div>}
 </div>;
}
