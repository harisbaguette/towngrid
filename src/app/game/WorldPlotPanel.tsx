'use client';
import {X,ArrowRight,Lock} from 'lucide-react';
import {PLOT_INDEX} from './territory';
import {NATIONS} from './world';
import {landformName} from './landform-data';
import {layoutOf} from './world-grid';
export default function WorldPlotPanel({id,campaign,scene,onVisit,onAction,onClose}:{id:string;campaign:any;scene:any;onVisit:(id:string)=>void;onAction:(r:any)=>void;onClose:()=>void}){
 const p=PLOT_INDEX.get(id);if(!p)return null;const nation=p.nation||'unclaimed',offer=campaign.siteOffer(nation,id),owned=campaign.sites.find((s:any)=>s.provinceId===id),layout=layoutOf(id);
 return <aside className="world-plot-panel" aria-label="선택한 월드 부지" data-province={id}>
  <div><small>{p.nation?(NATIONS as any)[p.nation]?.name:'무주지'}</small><strong>{p.name}</strong><span>{landformName(owned?.sim.layout||layout)} · 24 × 24</span></div>
  <button onClick={()=>scene.focusProvince(id,55)}>가까이 보기</button>
  {owned?<button disabled={owned.id===campaign.activeId} onClick={()=>onVisit(owned.id)}>{owned.id===campaign.activeId?'현재 내 땅':'이 거점 운영'}<ArrowRight size={16}/></button>:<button disabled={!offer.ok} title={offer.reason||''} onClick={()=>onAction(campaign.foundSite(nation,undefined,id))}>{offer.ok?'거점 세우기 · '+offer.cost.toLocaleString()+'G':<><Lock size={15}/>{offer.reason}</>}</button>}
  <button className="world-plot-close" aria-label="부지 정보 닫기" onClick={onClose}><X size={18}/></button>
 </aside>;
}
