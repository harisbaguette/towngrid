'use client';
import {NATIONS,RACES,BRAND,FACTIONS,factionOf} from './world';
import {Button} from '@/components/ui/button';
import {ArrowRight,ChevronDown,Shield,Leaf,Compass,MapPin} from 'lucide-react';
import WorldAtlas from './WorldAtlas';
import {MapEdgeList,BiomeSummary} from './MapEdges';
import {layoutOf} from './world-grid';
import {pixelIdentity} from './pixel-character-data';
import {HOME_LOOKS} from './resident-roster';
import {startingProvinces,startingProvince} from './starting-sites';
import LocalMapPreview from './LocalMapPreview';

export default function WorldMap({nation,race,startProvinceId,onStartProvince,onNation,onRace,onBegin,saved,busy,onImport,onBackup}:any){
 const n=(NATIONS as any)[nation],faction=factionOf(race),f=(FACTIONS as any)[n.playable?faction:n.faction],start=startingProvince(nation,startProvinceId),layout=start?layoutOf(start.id):null;
 return <section className="world-map-screen">
  <header className="world-map-head"><img className="world-brand-title" src="/assets/brand/towngrid-title.png" alt={BRAND.name}/><span className="atlas-title"><Compass size={18}/>{BRAND.world} 대륙<b>시작 지역 고르기</b></span></header>
  <div className="world-map-layout">
   <div className="atlas"><WorldAtlas nation={nation} onNation={onNation} startProvinceId={startProvinceId} onStartProvince={onStartProvince}/></div>
   <aside className="realm-card" aria-label="시작 지역 설정">
    <div className="realm-heading"><MapPin size={17}/><strong>시작 지역</strong><span>{!n.playable?'적대 지역':start?'정착 가능':'지역 선택 필요'}</span></div>
    <div className="realm-sheet">
     <div className="realm-selector"><label htmlFor="realm">국가</label><select id="realm" value={nation} onChange={e=>onNation(e.target.value)}>{Object.entries(FACTIONS).map(([fid,v]:any)=><optgroup key={fid} label={v.name+(v.playable?'':' · 적대 세력')}>{Object.entries(NATIONS).filter(([,v]:any)=>v.faction===fid).map(([id,v]:any)=><option key={id} value={id}>{v.name}</option>)}</optgroup>)}</select><ChevronDown size={16}/></div>
     {n.playable&&<div className="realm-selector"><label htmlFor="start-province">지역</label><select id="start-province" value={start?.id||''} onChange={e=>onStartProvince(e.target.value)}><option value="" disabled>비수도권 지역을 선택하세요</option>{startingProvinces(nation).map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}</select><ChevronDown size={16}/></div>}
     <div className="realm-place"><span>{n.name}</span><h2>{start?.name||'시작할 지역을 선택하세요'}</h2>{layout&&<BiomeSummary layout={layout}/>}</div>
     {start&&<LocalMapPreview provinceId={start.id}/>}
     <div className="realm-policy"><strong>{n.policy}</strong><span>{n.effect}</span></div>
     <div className="realm-section-title">함께할 종족</div>
     {n.playable&&<div className="faction-choices" role="group" aria-label="플레이 종족">{Object.entries(FACTIONS).filter(([,v]:any)=>v.playable).map(([id,v]:any)=>{const Icon=id==='human'?Shield:Leaf;return <button key={id} className={faction===id?'chosen':''} aria-pressed={faction===id} onClick={()=>onRace(id)}><Icon size={20}/><strong>{v.name}</strong></button>;})}</div>}
     <div className="alliance-residents" aria-label={f.name+' 구성원'}>{f.members.map((id:string)=>{const look=pixelIdentity(id,0,(HOME_LOOKS as any)[id]);return <div key={id}><img src={look.portrait} alt={look.name+' · '+(RACES as any)[id].name}/><strong>{(RACES as any)[id].name}</strong></div>;})}</div>
     {layout&&<details className="realm-edges"><summary>이 땅의 네 방향<ChevronDown size={15}/></summary><MapEdgeList layout={layout}/></details>}
     <details className="origin-details"><summary>영지와 소속</summary><div className="origin-chain"><span>{n.sovereign}</span><span>{n.name}</span><span>{n.fief}</span><span>{n.manor}</span><strong>농노 개간지</strong></div></details>
     <details className="world-test-options"><summary>불러오기·테스트</summary><div className="world-secondary">{saved&&<button disabled={busy} onClick={()=>onBegin('continue')}>계속하기</button>}<button disabled={busy||!n.playable} onClick={()=>onBegin('starter')}>초반 마을 테스트</button><button disabled={busy||!n.playable} onClick={()=>onBegin('demo')}>산업도시 둘러보기</button><button disabled={busy} onClick={onImport}>파일 불러오기</button>{saved&&<button disabled={busy} onClick={onBackup}>이전 백업 복구</button>}<a href="/biome-preview.html">지형 8종 테스트</a></div></details>
    </div>
    <div className="realm-start"><Button className="start-button" onClick={()=>onBegin('new')} disabled={busy||!start}>{!n.playable?'적대 세력 · 시작 불가':busy?'준비 중…':!start?'시작할 지역을 선택하세요':'이 땅에서 시작'}<ArrowRight size={19}/></Button><small>{!n.playable?'인족·엘프족 국가에서 시작할 수 있습니다.':start?n.name+' · '+start.name:'수도권·산·수역에서는 시작할 수 없습니다.'}</small></div>
   </aside>
  </div>
 </section>;
}
