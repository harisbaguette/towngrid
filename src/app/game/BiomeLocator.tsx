'use client';
import {BIOMES} from './biome-data';
import {biomeCandidates} from './settlement-access';
import {layoutOf} from './world-grid';
import {landformOf,LANDFORMS} from './landform-data';
export default function BiomeLocator({nation,provinceId,sites=[],provinces={},onChoose}:any){
 const current=provinceId?layoutOf(provinceId)?.ecology:'';
 const groups=Object.entries(BIOMES).map(([id,b]:any)=>({id,b,choices:biomeCandidates(id,nation,sites,provinces)}));
 const forms=[...new Set(groups.flatMap(g=>g.choices.map((p:any)=>landformOf(layoutOf(p.id)).id)))];
 return <label className="biome-locator">지형 찾기<select aria-label="찾을 지형" value={current||''} onChange={e=>{
  const value=e.target.value,plot=value.startsWith('form:')?groups.flatMap(g=>g.choices).find((p:any)=>landformOf(layoutOf(p.id)).id===value.slice(5)):biomeCandidates(value,nation,sites,provinces)[0];if(plot)onChoose(plot);
 }}><option value="" disabled>지형 선택</option><optgroup label="생태 지형">{groups.map(({id,b,choices})=><option key={id} value={id} disabled={!choices.length}>{b.name}{!choices.some((p:any)=>p.nation)?' · 무주지':''}</option>)}</optgroup><optgroup label="세부 지형">{forms.map(id=><option key={id} value={'form:'+id}>{(LANDFORMS as any)[id].name}</option>)}</optgroup></select></label>;
}
