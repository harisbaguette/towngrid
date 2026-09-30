'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {NATIONS} from './world';
import {PROVINCES} from './territory';
import {PROVINCE_INDEX} from './atlas-geometry';
import WorldAtlas from './WorldAtlas';
import LocalMapPreview from './LocalMapPreview';

const statusNames:any={owned:'내 거점',available:'진출 가능',materials:'자금·자재 준비',locked:'승급 후 해금',hostile:'적대 지역',unavailable:'선택 불가'};
export default function CampaignWorld({campaign:c,nation,onNation,onVisit,onAction}:any){
 const [provinceId,setProvinceId]=useState<string|null>(c.sites.find((s:any)=>s.id===c.activeId)?.provinceId||null);
 const changeNation=(id:string)=>{onNation(id);setProvinceId(c.siteOffer(id).provinceId||id+'-0');};
 const province=PROVINCE_INDEX.get(provinceId||''),valid=province?.nation===nation;
 const offer=valid?c.siteOffer(nation,provinceId):null;
 const owned=offer?.ownedId?c.sites.find((s:any)=>s.id===offer.ownedId):null;
 return <div className="campaign-world-layout"><WorldAtlas nation={nation} onNation={changeNation} selectedProvinceId={valid?provinceId:null} onProvince={setProvinceId} campaign={c} sites={c.sites} routes={c.routes} states={c.newStates} provinces={c.provinces} trade={c.active.tradeConnection()} activeProvinceId={c.active.provinceId} onVisit={onVisit}/>
  <aside className="campaign-site-panel">
   <label className="campaign-nation-picker">살펴볼 국가<select aria-label="세계 지도 국가" value={nation} onChange={e=>changeNation(e.target.value)}>{Object.entries(NATIONS).map(([id,v]:any)=><option key={id} value={id}>{v.name}{!v.playable?' · 적대 세력':''}</option>)}</select></label>
   <label className="campaign-province-picker">거점 부지<select aria-label="진출할 거점 부지" value={valid?provinceId||'':''} onChange={e=>setProvinceId(e.target.value)}><option value="" disabled>지도에서 부지를 고르세요</option>{PROVINCES.filter((p:any)=>p.nation===nation).map((p:any)=>{const state=c.siteOffer(nation,p.id);return <option key={p.id} value={p.id}>{p.name} · {statusNames[state.status]}</option>;})}</select></label>
   <section className="expansion-offer" aria-label="거점 진출 조건" data-province={valid?provinceId:undefined} data-status={offer?.status||'unavailable'}>
    <header><strong>{valid?province?.name:'진출할 부지를 선택하세요'}</strong><span className={'expansion-status '+(offer?.status||'unavailable')}>{offer?statusNames[offer.status]:'정착 부지 아님'}</span></header>
    {!offer?<p>수도·깃발·마을 표식이 있는 칸을 선택하세요. 산과 수역에는 거점을 세울 수 없습니다.</p>:owned?<><p>{owned.sim.buildings.length}개 시설 · 확보한 땅 {owned.sim.owned.size}칸</p><Button disabled={owned.id===c.activeId} onClick={()=>onVisit(owned.id)}>{owned.id===c.activeId?'현재 거점':'이 거점으로 이동'}</Button></>:<>
     <div className="expansion-requirements">{offer.requirements.map((r:any)=><span key={r.id} className={r.have<r.need?'missing':''}>{r.label}<b>{Math.floor(r.have).toLocaleString()} / {r.need.toLocaleString()}{r.id==='money'?'G':''}</b></span>)}</div>
     <p>{offer.ok?'선택한 칸에 새로운 마을을 엽니다.':offer.reason}</p>
     <Button disabled={!offer.ok} onClick={()=>onAction(c.foundSite(nation,undefined,provinceId))}>이 땅에 거점 세우기</Button>
     <p className="offer-help">{nation===c.home.nation?'국내 진출 · 법인 대표':'해외 진출 · 광역 투자자'}부터 · 자재는 현재 거점에서 가져옵니다.</p>
    </>}
   </section>
   {valid&&<LocalMapPreview provinceId={provinceId} seed={owned?.sim.seed??offer.seed} simulation={owned?.sim} title={owned?'보유 거점':'새 거점 부지'}/>}
   <h3 className="campaign-site-list-title">내 거점 · {c.sites.length} / 24</h3>
   <div className="site-list">{c.sites.map((s:any)=><div key={s.id} className={c.activeId===s.id?'active':''}><div><strong>{s.name}</strong><span>{(NATIONS as any)[s.nation].name} · {s.sim.buildings.length}개 시설 · {s.territory?'자치권 확보':'사업권'} · 불만 {Math.round(s.unrest)}%{s.unrest>=65?' · 독립 위험':''}</span></div><Button variant="outline" onClick={()=>onVisit(s.id)}>{c.activeId===s.id?'현재 거점':'이동'}</Button></div>)}</div>
   {c.newStates.length>0&&<div className="world-news"><strong>새로운 국가</strong>{c.newStates.slice(-4).map((s:any)=><p key={s.id}>{s.name}<small>{c.stateOrigin(s)}에서 독립 · 산업 {s.industry}단계</small></p>)}</div>}
  </aside>
 </div>;
}
