import {useState} from 'react';
import {stores,storageSummary,STORE_MODES} from './storage';
import {BUILDINGS,RESOURCES} from './simulation';
import ResourceIcon from './ResourceIcon';
import {Button} from '@/components/ui/button';

export default function StoragePanel({sim:s,store,onAction}:any){
 const list=store?[store]:stores(s,false);
 const [discard,setDiscard]=useState({store:-1,item:'',armed:false});
 return <div className="storage-list" aria-label="보관 장소별 재고">{list.map((b:any)=>{
  const info=storageSummary(s,b);
  return <details className="storage-card" key={b.id} open={!!store}>
   <summary><strong>{b.type==='starter'?'수출 수단 미니 창고':(BUILDINGS as any)[b.type].name}</strong><span>{Math.ceil(info.used)} / {info.capacity}</span></summary>
   <small>{b.x+1}, {b.z+1} · {b.movingUntil>s.time?'이전 중':b.drain?'다른 창고로 옮기는 중':b.mode?(STORE_MODES as any)[b.mode].name+' · '+(STORE_MODES as any)[b.mode].items.map((r:string)=>(RESOURCES as any)[r].name).join('·'):'상품 전체의 합계 용량'}</small>
   {onAction&&b.type==='depot'&&<label className="store-mode">보관 방식<select aria-label="보관 방식" value={b.mode||''} onChange={e=>onAction(s.setStoreMode(b.id,e.target.value||null))}><option value="">모든 상품 · 240개</option>{Object.entries(STORE_MODES).map(([id,m]:any)=><option key={id} value={id}>{m.name}({m.short}) · {m.capacity.toLocaleString('ko-KR')}개</option>)}</select></label>}
   <div className="storage-items">{info.items.map(([id,n]:any)=><span key={id} title={(RESOURCES as any)[id].name}><ResourceIcon name={id} size={17}/>{Math.floor(n)}</span>)}{!info.items.length&&<span>비어 있음</span>}</div>
   {onAction&&info.items.length>0&&<div className="storage-discard"><select aria-label="폐기할 품목" value={discard.store===b.id?discard.item:''} onChange={e=>setDiscard({store:b.id,item:e.target.value,armed:false})}><option value="">재고 폐기</option>{info.items.map(([id]:any)=><option key={id} value={id}>{(RESOURCES as any)[id].name}</option>)}</select>{discard.store===b.id&&discard.item&&<Button size="sm" variant="outline" onClick={()=>{if(!discard.armed){setDiscard({...discard,armed:true});return;}onAction(s.discardStock(b.id,discard.item,Math.min(10,Math.floor(b.inventory[discard.item]||0))));setDiscard({...discard,armed:false});}}>{discard.armed?'폐기 확인':'최대 10개 폐기'}</Button>}</div>}
   {onAction&&list.length+stores(s).length>2&&<Button size="sm" variant="outline" onClick={()=>onAction(s.setStoreDrain(b.id,!b.drain))}>{b.drain?'옮기기 중지':'주민이 다른 창고로 옮기기'}</Button>}
  </details>;
 })}</div>;
}
