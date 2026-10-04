import {useState} from 'react';
import {stores,storageSummary,STORE_MODES,capacity} from './storage';
import {BUILDINGS,RESOURCES} from './simulation';
import ResourceIcon from './ResourceIcon';
import {Button} from '@/components/ui/button';

export default function StoragePanel({sim:s,store,onAction}:any){
 const list=store?[store]:stores(s,false);
 const [policy,setPolicy]=useState({store:-1,item:'fuel',limit:'',reserve:'0'});
 const [discard,setDiscard]=useState({store:-1,item:'',armed:false});
 return <div className="storage-list" aria-label="보관 장소별 재고">{list.map((b:any)=>{
  const info=storageSummary(s,b);
  return <details className="storage-card" key={b.id} open={!!store}>
   <summary><strong>{b.type==='starter'?'수출 수단 미니 창고':(BUILDINGS as any)[b.type].name}</strong><span>{Math.ceil(info.used)} / {info.capacity}</span></summary>
   <small>{b.x+1}, {b.z+1} · {b.movingUntil>s.time?'이전 중':b.drain?'다른 창고로 옮기는 중':b.mode?(STORE_MODES as any)[b.mode].name+' · '+(STORE_MODES as any)[b.mode].items.map((r:string)=>(RESOURCES as any)[r].name).join('·'):'상품 전체의 합계 용량'}</small>
   {onAction&&b.type==='depot'&&<label className="store-mode">보관 방식<select aria-label="보관 방식" value={b.mode||''} onChange={e=>onAction(s.setStoreMode(b.id,e.target.value||null))}><option value="">모든 상품 · {capacity(s,{...b,mode:null})}개</option>{Object.entries(STORE_MODES).map(([id,m]:any)=><option key={id} value={id}>{m.name}({m.short}) · {m.capacity.toLocaleString('ko-KR')}개</option>)}</select></label>}
   <div className="storage-items">{info.items.map(([id,n]:any)=><span key={id} title={(RESOURCES as any)[id].name}><ResourceIcon name={id} size={17}/>{Math.floor(n)}</span>)}{!info.items.length&&<span>비어 있음</span>}</div>
   {onAction&&info.items.length>0&&<div className="storage-discard"><select aria-label="폐기할 품목" value={discard.store===b.id?discard.item:''} onChange={e=>setDiscard({store:b.id,item:e.target.value,armed:false})}><option value="">재고 폐기</option>{info.items.map(([id]:any)=><option key={id} value={id}>{(RESOURCES as any)[id].name}</option>)}</select>{discard.store===b.id&&discard.item&&<Button size="sm" variant="outline" onClick={()=>{if(!discard.armed){setDiscard({...discard,armed:true});return;}onAction(s.discardStock(b.id,discard.item,Math.min(10,Math.floor(b.inventory[discard.item]||0))));setDiscard({...discard,armed:false});}}>{discard.armed?'폐기 확인':'최대 10개 폐기'}</Button>}</div>}
   {onAction&&<details className="storage-policy"><summary>품목별 보관 설정</summary><div className="storage-policy-fields">
    <label>품목<select aria-label="보관 설정 품목" value={policy.store===b.id?policy.item:'fuel'} onChange={e=>{const r=b.storageRules?.[e.target.value]||{};setPolicy({store:b.id,item:e.target.value,limit:r.limit===undefined?'':String(r.limit),reserve:String(r.reserve||0)});}}>{Object.entries(RESOURCES).map(([id,r]:any)=><option key={id} value={id}>{r.name}</option>)}</select></label>
    <label>보관 상한<input aria-label="보관 상한" placeholder="제한 없음 · 0은 받지 않음" type="number" min="0" value={policy.store===b.id?policy.limit:b.storageRules?.fuel?.limit??''} onChange={e=>setPolicy(p=>({...p,store:b.id,item:p.store===b.id?p.item:'fuel',limit:e.target.value,reserve:p.store===b.id?p.reserve:String(b.storageRules?.fuel?.reserve||0)}))}/></label>
    <label>예약 공간<input aria-label="예약 공간" type="number" min="0" value={policy.store===b.id?policy.reserve:b.storageRules?.fuel?.reserve||0} onChange={e=>setPolicy(p=>({...p,store:b.id,item:p.store===b.id?p.item:'fuel',limit:p.store===b.id?p.limit:String(b.storageRules?.fuel?.limit??''),reserve:e.target.value}))}/></label>
    <Button size="sm" onClick={()=>{const item=policy.store===b.id?policy.item:'fuel',r=b.storageRules?.[item]||{},limit=policy.store===b.id?policy.limit:r.limit===undefined?'':String(r.limit),reserve=policy.store===b.id?policy.reserve:String(r.reserve||0);onAction(s.setStorageRule(b.id,item,limit===''?null:Number(limit),Number(reserve)));}}>보관 설정 적용</Button>
    <small>상한 0은 새 물자를 받지 않습니다. 예약 공간은 다른 품목이 채울 수 없습니다. 기존 재고는 보존합니다.</small>
    {Object.entries(b.storageRules||{}).map(([id,r]:any)=><small key={id}>{(RESOURCES as any)[id].name} · 상한 {r.limit??'없음'} · 예약 {r.reserve||0}</small>)}
   </div></details>}
   {onAction&&list.length+stores(s).length>2&&<Button size="sm" variant="outline" onClick={()=>onAction(s.setStoreDrain(b.id,!b.drain))}>{b.drain?'옮기기 중지':'주민이 다른 창고로 옮기기'}</Button>}
  </details>;
 })}</div>;
}
