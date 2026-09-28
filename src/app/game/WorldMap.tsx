'use client';
import {NATIONS,RACES,BRAND,FACTIONS,factionOf} from './world';
import {Button} from '@/components/ui/button';
import {Compass,Play,ArrowRight,ChevronDown,Shield,Leaf} from 'lucide-react';
import WorldAtlas from './WorldAtlas';
import {genderLabel} from './resident-roster';
import CharacterSprite from './CharacterSprite';
import {MapEdgeList,BiomeSummary} from './MapEdges';
import {layoutOf} from './world-grid';
import {pixelIdentity,pixelRoster} from './pixel-character-data';
export default function WorldMap({nation,race,onNation,onRace,onBegin,saved,busy,icons,onImport,onBackup}:any){const n=(NATIONS as any)[nation],faction=factionOf(race),f=(FACTIONS as any)[n.playable?faction:n.faction];return <section className="world-map-screen">
 <header className="world-map-head"><img className="world-brand-title" src="/assets/brand/towngrid-title.png" alt={BRAND.name}/><span className="atlas-title"><Compass size={19}/>{BRAND.world} 대륙</span></header>
 <div className="world-map-layout"><div className="atlas"><WorldAtlas nation={nation} onNation={onNation}/></div>
 <aside className="realm-card"><div className="realm-heading"><Compass size={22}/><strong>시작 지역</strong></div><div className="shop-awning" aria-hidden="true"/><div className="realm-sheet"><div className="paper-ribbon">시작할 땅</div><div className="realm-selector"><label htmlFor="realm">국가</label><select id="realm" value={nation} onChange={e=>onNation(e.target.value)}>{Object.entries(FACTIONS).map(([fid,f]:any)=><optgroup key={fid} label={f.name+(f.playable?'':' · 적대 세력')}>{Object.entries(NATIONS).filter(([,v]:any)=>v.faction===fid).map(([id,v]:any)=><option key={id} value={id}>{v.name}</option>)}</optgroup>)}</select><ChevronDown size={18}/></div>
 <h1>{n.district}</h1><details className="origin-details"><summary>{n.overlord} 영향권 · 농노 개간지</summary><div className="origin-chain"><span>{n.sovereign}</span><span>{n.name}</span><span>{n.dependency}</span><span>{n.capitalDomain}</span><span>{n.fief}</span><span>{n.manor}</span><strong>농노 개간지</strong></div></details><div className="realm-policy"><strong>{n.policy}</strong><span>{n.effect}</span></div>
 <div className="realm-edges"><BiomeSummary layout={layoutOf(nation+'-0')}/><strong>이 땅의 네 방향</strong><MapEdgeList layout={layoutOf(nation+'-0')}/></div>
 <div className="paper-ribbon second">{n.playable?'함께할 종족':'적대 세력'}</div>{n.playable&&<div className="faction-choices" role="group" aria-label="플레이 종족">{Object.entries(FACTIONS).filter(([,v]:any)=>v.playable).map(([id,v]:any)=>{const Icon=id==='human'?Shield:Leaf;return <button key={id} className={faction===id?'chosen':''} aria-pressed={faction===id} onClick={()=>onRace(id)}><Icon size={22}/><strong>{v.name}</strong><span>{v.trait}</span></button>})}</div>}
 <div className="alliance-residents" aria-label={f.name+' 구성원'}>{f.members.map((id:string)=><div key={id}><div className="resident-pair">{pixelRoster(id).slice(0,2).map((look:any)=><div className="resident-mini" key={look.id}><img src={pixelIdentity(id,0,look.id).portrait} alt={(RACES as any)[id].name+(look.gender!=='neutral'?' '+genderLabel(look.gender):'')}/><CharacterSprite race={id} appearance={look.id} action="walk" direction={look.gender==='male'?0:3}/></div>)}</div><strong>{(RACES as any)[id].name}</strong><span>{(RACES as any)[id].specialty.name}</span></div>)}</div>
 <Button className="start-button" onClick={()=>onBegin('new')} disabled={busy||!n.playable}>{!n.playable?'적대 세력 · 시작 불가':busy?'준비 중…':'이 땅에서 시작'}<ArrowRight size={19}/></Button>
 <div className="world-secondary"><a href="/biome-preview.html">지형 8종 테스트</a>{saved&&<button disabled={busy} onClick={()=>onBegin('continue')}><Play size={15}/>계속하기</button>}<button disabled={busy||!n.playable} onClick={()=>onBegin('starter')}>초반 마을 테스트</button><button disabled={busy||!n.playable} onClick={()=>onBegin('demo')}>산업도시 둘러보기</button><button disabled={busy} onClick={onImport}>파일 불러오기</button>{saved&&<button disabled={busy} onClick={onBackup}>이전 백업 복구</button>}</div>
 </div></aside></div></section>}
