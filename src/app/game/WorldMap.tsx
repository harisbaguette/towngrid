'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,ChevronDown,Shield,Leaf,Search,Lock,Sprout,Trees,Waves,Mountain,Snowflake,Sun,Flame,HelpCircle,X} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {NATIONS,FACTIONS,factionOf} from './world';
import {WORLD_PLOTS} from './territory';
import WorldViewControls from './WorldViewControls';
import {Simulation} from './simulation';
import {MapEdgeList,BiomeSummary} from './MapEdges';
import {layoutOf} from './world-grid';
import {BIOMES} from './biome-data';
import {landformName} from './landform-data';
import {mapEdges} from './map-edges';
import {startingProvinces,startingProvince} from './starting-sites';
import {PROVINCE_INDEX,terrainBlockReason} from './atlas-geometry';
import {startBlockReason} from './settlement-access';
import BiomeLocator from './BiomeLocator';
import LocalMapPreview from './LocalMapPreview';

type Props={scene:any;nation:string;race:string;startProvinceId:string|null;onStartProvince:(id:string|null)=>void;onNation:(id:string)=>void;onRace:(id:string)=>void;onBegin:(kind:'new'|'continue'|'starter'|'demo')=>void;saved:boolean;busy:boolean;icons?:unknown;onImport?:()=>void;onBackup?:()=>void;onHome?:()=>void;onStageChange?:(stage:'country'|'plot'|'preview')=>void;onSound?:(type:string)=>void};
const SHORT:Record<string,string>={snow:'설원',meadow:'평야',forest:'숲',basin:'광산 분지',desert:'사막',coast:'해안',marsh:'습지',volcanic:'화산 고원'};
const TERRAIN_ICONS:Record<string,typeof Leaf>={snow:Snowflake,ice:Snowflake,meadow:Sprout,plain:Sprout,forest:Trees,basin:Mountain,mountain:Mountain,desert:Sun,coast:Waves,marsh:Waves,volcanic:Flame};
export default function WorldMap({scene,nation,race,startProvinceId,onStartProvince,onNation,onRace,onBegin,saved,busy,onImport,onBackup,onHome,onStageChange,onSound}:Props){
 const [stage,setStage]=useState<'country'|'plot'|'preview'>('country'),[panel,setPanel]=useState<'find'|'details'|null>(null),[blockedTerrain,setBlockedTerrain]=useState<string|null>(null),[previewReady,setPreviewReady]=useState(false);
 useEffect(()=>{onStageChange?.(stage);},[stage,onStageChange]);
 const n=(NATIONS as any)[nation],plot=PROVINCE_INDEX.get(startProvinceId||''),start=startingProvince(nation,startProvinceId),layout=plot?layoutOf(plot.id):null,faction=factionOf(race),reason=blockedTerrain||startBlockReason(nation,startProvinceId),biome=layout?(BIOMES as any)[layout.ecology]:null;
 const summary=useMemo(()=>{const counts:Record<string,number>={};WORLD_PLOTS.filter((p:any)=>p.nation===nation).forEach((p:any)=>{const key=layoutOf(p.id).ecology;counts[key]=(counts[key]||0)+1;});return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([id])=>SHORT[id]).join(' · ');},[nation]);
 const wilderness=stage!=='country'&&plot?.nation===null;
 const terrainIcons=layout?[...new Set([layout.ecology,...mapEdges(layout).map((edge:any)=>edge.kind)])].map(id=>TERRAIN_ICONS[id]||Waves).filter((Icon,i,all)=>all.indexOf(Icon)===i).slice(0,3):[];
 const initialized=useRef(false),previousStage=useRef(stage);
 useEffect(()=>{
  if(!scene||!plot)return;const preview=new Simulation(n.region,null,{nation,race,provinceId:plot.id,seed:0});preview.paused=true;
  scene.setSimulation(preview,{preserveCamera:initialized.current});scene.worldPicking=true;scene.active=true;initialized.current=true;setPreviewReady(true);
 },[scene,plot?.id,nation,race]);
 useEffect(()=>{
  if(!scene)return;const id=startProvinceId||nation+'-0',span=stage==='country'?620:stage==='plot'?150:scene.container.clientWidth<600?56:58;
  if(previousStage.current!==stage||stage==='country')scene.focusProvince(id,span);
  previousStage.current=stage;scene.landscape?.select(startProvinceId);
 },[scene,stage,nation,startProvinceId]);
 useEffect(()=>{
  if(!scene)return;scene.worldPicking=true;const previous=scene.callbacks.onWorldPick;
  scene.callbacks.onWorldPick=(cell:any)=>{const p=PROVINCE_INDEX.get(cell.site);if(!p){setBlockedTerrain(terrainBlockReason(cell.terrain));onSound?.('invalid');return;}
   setBlockedTerrain(null);if(stage==='country'&&p.nation){onNation(p.nation);return;}if(p.nation&&p.nation!==nation)onNation(p.nation);onStartProvince(p.id);scene.landscape?.select(p.id);
  };
  const key=(e:KeyboardEvent)=>{if(e.defaultPrevented||document.querySelector('[role=dialog]')||(e.target as HTMLElement)?.closest('input,select,textarea'))return;if(!e.repeat&&['q','e'].includes(e.key.toLowerCase())){e.preventDefault();scene.rotate(e.key.toLowerCase()==='q'?-1:1);onSound?.('rotate');}};
  window.addEventListener('keydown',key);return()=>{scene.callbacks.onWorldPick=previous;scene.worldPicking=false;window.removeEventListener('keydown',key);};
 },[scene,stage,nation,onNation,onStartProvince,onSound]);
 const back=()=>{if(busy)return;if(stage==='preview')setStage('plot');else if(stage==='plot')setStage('country');else onHome?.();};
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!e.defaultPrevented&&!panel&&!document.querySelector('[role=dialog]')){e.preventDefault();back();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);});
 const chooseNation=(id:string)=>{setBlockedTerrain(null);onNation(id);};
 const choosePlot=(id:string|null)=>{setBlockedTerrain(null);onStartProvince(id);};
 const next=()=>{if(stage==='country')setStage('plot');else if(stage==='plot')setStage('preview');else onBegin('new');};
 return <section className="world-map-screen start-world" data-stage={stage} data-nation={nation} data-province={startProvinceId} aria-label="시작 지역 선택">
  <WorldViewControls scene={scene} starting selectedId={startProvinceId} onCountry={chooseNation} onPlot={choosePlot}/>
  <header className={'start-top'+(stage==='country'?'':' start-breadcrumb')}><button disabled={busy} aria-label={stage==='country'?'홈으로':stage==='plot'?'국가 선택으로':'부지 선택으로'} onClick={back}><ArrowLeft size={26}/></button>{stage==='country'?<div><h1>어디에서 시작할까요?</h1><p>지도에서 나라를 고르세요</p></div>:<><h1>{stage==='plot'?'시작 지역':'지도'}</h1><span>{stage==='plot'?'대륙 / '+n.name:plot?.name||'빈 땅'}</span></>}</header>
  {stage==='country'?<button className="start-find" onClick={()=>setPanel('find')}><Search size={24}/><span>지형으로 찾기</span></button>:<button className="start-help-button" aria-label="지역 자세히 보기" title="지역 자세히 보기" onClick={()=>setPanel('details')}><HelpCircle size={32}/></button>}
  {stage==='plot'&&<button className="start-plot-find" onClick={()=>setPanel('find')}><Search size={18}/><span>지형으로 찾기</span></button>}
  <div className={'start-bottom start-'+(stage==='preview'?'confirm':stage)}>
   <div className="start-place">{stage==='country'&&<Shield size={36}/>}<div>{stage!=='country'&&<small>{plot?.nation?(NATIONS as any)[plot.nation].name:plot?'무주지':n.name}</small>}<strong>{stage==='country'?n.name:plot?.name||'빈 땅을 선택하세요'}</strong>{stage!=='plot'&&<span>{stage==='country'?summary:plot?(layout?landformName(layout):'미개발지')+' · 24 × 24':blockedTerrain||'지도에서 정착 가능한 칸을 고르세요'}</span>}{stage==='preview'&&<button className="start-more" onClick={()=>setPanel('details')}>자세히 <ChevronDown size={16}/></button>}</div></div>
   {stage==='plot'&&<><div className="start-biome"><div aria-hidden="true">{terrainIcons.map((Icon,i)=><Icon key={i} size={26}/>)}</div><span>{layout?landformName(layout):blockedTerrain||'미개발지'}</span></div><span className="start-dimensions">24 × 24</span></>}
   {stage==='preview'&&<div className="start-race" role="group" aria-label="함께할 종족"><span>함께할 종족</span><div>{Object.entries(FACTIONS).filter(([,v]:any)=>v.playable).map(([id,v]:any)=>{const Icon=id==='human'?Shield:Leaf;return <button key={id} aria-pressed={faction===id} onClick={()=>onRace(id)}><Icon size={32}/>{v.name}</button>;})}</div></div>}
   <div className="start-next"><button className="start-primary" disabled={busy||(stage==='country'?!n.playable:!start||!!reason)||(stage==='preview'&&!previewReady)} onClick={next}>{busy?'준비 중…':stage==='country'?'지역 살펴보기':stage==='plot'?'땅 미리보기':'이 땅에서 시작'}<ArrowRight size={18}/></button>{(!n.playable||stage!=='country'&&reason)&&<small role="status"><Lock size={12}/>{!n.playable?'적대 세력 · 시작 불가':reason}</small>}</div>
   {stage==='plot'&&<button className="start-cancel-plot" aria-label="부지 선택 취소" onClick={back}><X size={24}/></button>}
  </div>
  <Dialog open={!!panel} onOpenChange={open=>{if(!open)setPanel(null);}}><DialogContent className="start-options"><DialogTitle>{panel==='find'?'시작할 땅 찾기':'지역 정보'}</DialogTitle><DialogDescription className="sr-only">{panel==='find'?'국가와 지형을 골라 정착 가능한 부지를 찾습니다.':'정책과 주변 지형을 확인합니다.'}</DialogDescription>
   {panel==='find'?<><label className="start-select">국가<select id="realm" aria-label="시작 국가" value={nation} onChange={e=>chooseNation(e.target.value)}>{Object.entries(NATIONS).map(([id,v]:any)=><option key={id} value={id}>{v.name}{v.playable?'':' · 적대'}</option>)}</select></label><label className="start-select">시작 부지<select id="start-province" aria-label="시작 부지" value={start?.id||''} disabled={!n.playable} onChange={e=>{choosePlot(e.target.value);setStage('plot');setPanel(null);}}><option value="" disabled>부지를 선택하세요</option>{startingProvinces(nation).map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><BiomeLocator nation={nation} provinceId={startProvinceId} onChoose={(p:any)=>{if(p.nation&&p.nation!==nation)chooseNation(p.nation);choosePlot(p.id);setStage('plot');setPanel(null);}}/><p className="start-help">지도에서도 빈 땅을 직접 선택할 수 있습니다.</p></>:<><div className="start-policy"><strong>{wilderness?'무주지':n.name+' · '+n.policy}</strong><p>{wilderness?'광역 투자자부터 확보할 수 있는 미개척지입니다. 확보한 부지는 내 변경 영지가 됩니다.':n.effect}</p></div>{stage!=='country'&&layout&&<><BiomeSummary layout={layout}/><MapEdgeList layout={layout}/><LocalMapPreview provinceId={plot!.id} nation={nation} title="선택한 부지" starting={!!start}/></>}<details className="start-test-options"><summary>불러오기·테스트</summary><div>{saved&&<button disabled={busy} onClick={()=>onBegin('continue')}>계속하기</button>}<button disabled={busy||!n.playable} onClick={()=>onBegin('starter')}>초반 마을 테스트</button><button disabled={busy||!n.playable} onClick={()=>onBegin('demo')}>산업도시 둘러보기</button><button disabled={busy} onClick={onImport}>파일 불러오기</button>{saved&&<button disabled={busy} onClick={onBackup}>이전 백업 복구</button>}<a href="/biome-preview.html">지형 8종 테스트</a></div></details></>}
  </DialogContent></Dialog>
 </section>;
}
