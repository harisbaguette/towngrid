'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {NATIONS} from './world';
import {WORLD_PLOTS as PROVINCES,sovereignOf,frontierClaimOf} from './territory';
import {PROVINCE_INDEX} from './atlas-geometry';
import WorldAtlas from './WorldAtlas';
import LocalMapPreview from './LocalMapPreview';
import BiomeLocator from './BiomeLocator';
import {blockHint} from './ui-rules';
import {Swords,Hammer,Wrench,CircleAlert,TrendingUp} from 'lucide-react';

// Item 4 (R2 carry-over): each owned site shows why it needs attention - raid, broken or damaged facilities, stalled
// production and the strongest unrest driver - from campaign.siteStatus, so the player sees it before travelling there.
function SiteFlags({campaign:c,site}:any){const st=c.siteStatus(site),blocked=site.sim.buildings.filter((b:any)=>b.health>0&&b.enabled!==false&&blockHint(b.status,site.sim)).length,cause=st.causes.filter((v:any)=>v.delta>0).sort((a:any,b:any)=>b.delta-a.delta)[0];
 const flags=[st.raid&&{k:'raid',icon:Swords,text:'습격 중'},st.broken&&{k:'broken',icon:Hammer,text:'멈춘 시설 '+st.broken},st.damaged&&{k:'damaged',icon:Wrench,text:'손상 '+st.damaged},blocked&&{k:'blocked',icon:CircleAlert,text:'가동 막힘 '+blocked},cause&&{k:'cause',icon:TrendingUp,text:cause.label.split(' · ')[0]+' +'+cause.delta,title:cause.label}].filter(Boolean) as any[];
 return flags.length?<ul className="site-flags" aria-label={site.name+' 확인할 일'}>{flags.map(f=><li key={f.k} className={f.k} title={f.title}><f.icon size={13} aria-hidden="true"/>{f.text}</li>)}</ul>:null;}
const statusNames:any={owned:'내 거점',available:'진출 가능',materials:'자금·자재 준비',locked:'승급 후 해금',hostile:'적대 지역',restricted:'정착 제한',unavailable:'선택 불가'};
export default function CampaignWorld({campaign:c,nation,onNation,onVisit,onAction}:any){
 // Historical citizens can keep operating a saved town now enclosed by a hostile border.
 // The atlas picker still shows the current country containing that exact town.
 const [provinceId,setProvinceId]=useState<string|null>(c.sites.find((s:any)=>s.id===c.activeId)?.provinceId||null);
 if(!['unclaimed','player'].includes(nation)&&(!(NATIONS as any)[nation]?.tier||nation===c.active.nation&&provinceId===c.active.provinceId))nation=frontierClaimOf(c.active.provinceId,c.sites)?'player':PROVINCE_INDEX.get(c.active.provinceId)?.nation||'unclaimed';
 const changeNation=(id:string)=>{onNation(id);setProvinceId(c.siteOffer(id).provinceId||id+'-0');};
 const inArea=(p:any)=>nation==='player'?!!frontierClaimOf(p.id,c.sites):nation==='unclaimed'?sovereignOf(p.id,c.provinces)===null&&!frontierClaimOf(p.id,c.sites):p.nation===nation;
 const province=PROVINCE_INDEX.get(provinceId||''),valid=!!province&&inArea(province);
 const offer=valid?c.siteOffer(nation,provinceId):null;
 const owned=offer?.ownedId?c.sites.find((s:any)=>s.id===offer.ownedId):null;
 return <div className="campaign-world-layout"><WorldAtlas nation={nation} onNation={changeNation} selectedProvinceId={valid?provinceId:null} onProvince={setProvinceId} campaign={c} sites={c.sites} routes={c.routes} states={c.newStates} provinces={c.provinces} trade={c.active.tradeConnection()} activeProvinceId={c.active.provinceId} onVisit={onVisit}/>
  <aside className="campaign-site-panel">
   <label className="campaign-nation-picker">살펴볼 지역<select aria-label="세계 지도 국가" value={nation} onChange={e=>changeNation(e.target.value)}><option value="player">내 변경 영지</option><option value="unclaimed">무주지 · 소유자 없음</option>{Object.entries(NATIONS).map(([id,v]:any)=><option key={id} value={id}>{v.name}{!v.playable?' · 적대 세력':''}</option>)}</select></label>
   <BiomeLocator nation={c.home.nation} provinceId={provinceId} sites={c.sites} provinces={c.provinces} onChoose={(p:any)=>{onNation(p.nation||'unclaimed');setProvinceId(p.id);}}/>
   <label className="campaign-province-picker">거점 부지<select aria-label="진출할 거점 부지" value={valid?provinceId||'':''} onChange={e=>setProvinceId(e.target.value)}><option value="" disabled>지도에서 부지를 고르세요</option>{PROVINCES.filter(inArea).map((p:any)=>{const state=c.siteOffer(nation,p.id);return <option key={p.id} value={p.id}>{p.name} · {statusNames[state.status]}</option>;})}</select></label>
   <section className="expansion-offer" aria-label="거점 진출 조건" data-province={valid?provinceId:undefined} data-status={offer?.status||'unavailable'}>
    <header><strong>{valid?province?.name:'진출할 부지를 선택하세요'}</strong><span className={'expansion-status '+(offer?.status||'unavailable')}>{offer?statusNames[offer.status]:'정착 부지 아님'}</span></header>
    {!offer?<p>지도에서 네모 칸을 선택하세요. ×는 산·수역, 자물쇠는 정착 허가가 없는 땅입니다.</p>:owned?<><p>{frontierClaimOf(owned.provinceId,c.sites)?'내 변경 영지 24×24 · ':''}{owned.sim.buildings.length}개 시설 · 개발구 {owned.sim.owned.size}칸</p><Button disabled={owned.id===c.activeId} onClick={()=>onVisit(owned.id)}>{owned.id===c.activeId?'현재 거점':'이 거점으로 이동'}</Button></>:<>
     <div className="expansion-requirements">{offer.requirements.map((r:any)=><span key={r.id} className={r.have<r.need?'missing':''}>{r.label}<b>{Math.floor(r.have).toLocaleString()} / {r.need.toLocaleString()}{r.id==='money'?'G':''}</b></span>)}</div>
     <p>{offer.ok?(nation==='unclaimed'?'선택한 24×24 땅을 내 변경 영지로 확보합니다.':'선택한 칸에 새로운 마을을 엽니다.'):offer.reason}</p>
     <Button disabled={!offer.ok} onClick={()=>{const result=c.foundSite(nation,undefined,provinceId);if(result.ok&&nation==='unclaimed')onNation('player');onAction(result);}}>{nation==='unclaimed'?'이 땅을 내 영지로 확보':'이 땅에 거점 세우기'}</Button>
     <p className="offer-help">{nation==='unclaimed'?'무주지 개척 · 광역 투자자':nation===c.home.nation?'국내 진출 · 법인 대표':'해외 진출 · 광역 투자자'}부터 · 자재는 현재 거점에서 가져옵니다.</p>
    </>}
   </section>
   {valid&&<LocalMapPreview provinceId={provinceId} nation={offer.nation} seed={owned?.sim.seed??offer.seed} simulation={owned?.sim} title={owned?'보유 거점':nation==='unclaimed'?'미개척지':'새 거점 부지'}/>}
   <h3 className="campaign-site-list-title">내 거점 · {c.sites.length} / 24</h3>
   <div className="site-list">{c.sites.map((s:any)=><div key={s.id} className={c.activeId===s.id?'active':''}><div><strong>{s.name}</strong><span>{(NATIONS as any)[s.nation].name} · {s.sim.buildings.length}개 시설 · {frontierClaimOf(s.provinceId,c.sites)?'내 변경 영지':s.territory?'자치권 확보':'사업권'} · 불만 {Math.round(s.unrest)}%{s.unrest>=65&&s.id!==c.homeId?' · 독립 위험':''}</span><SiteFlags campaign={c} site={s}/></div><Button variant="outline" onClick={()=>onVisit(s.id)}>{c.activeId===s.id?'현재 거점':'이동'}</Button></div>)}</div>
   {c.newStates.length>0&&<div className="world-news"><strong>새로운 국가</strong>{c.newStates.slice(-4).map((s:any)=><p key={s.id}>{s.name}<small>{c.stateOrigin(s)}에서 독립 · 산업 {s.industry}단계</small></p>)}</div>}
  </aside>
 </div>;
}
