'use client';
import {BIOMES} from './biome-data';
import {biomeCandidates} from './settlement-access';
import {layoutOf} from './world-grid';
export default function BiomeLocator({nation,provinceId,sites=[],provinces={},onChoose}:any){
 const current=provinceId?layoutOf(provinceId)?.ecology:'';
 return <label className="biome-locator">지형 찾기<select aria-label="찾을 지형" value={current||''} onChange={e=>{const plot=biomeCandidates(e.target.value,nation,sites,provinces)[0];if(plot)onChoose(plot);}}><option value="" disabled>지형 8종</option>{Object.entries(BIOMES).map(([id,b]:any)=>{const choices=biomeCandidates(id,nation,sites,provinces),local=choices.some((p:any)=>p.nation);return <option key={id} value={id} disabled={!choices.length}>{b.name}{!local?' · 무주지':''}</option>;})}</select></label>;
}
