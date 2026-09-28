'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Switch} from '@/components/ui/switch';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {Progress} from '@/components/ui/progress';
import {RESOURCES,BUILDINGS} from './simulation';
import {NATIONS,FACTIONS} from './world';
import {permitted,tutorialStep} from './ui-rules';
import {ROUTE_KINDS} from './trade-routes';

export function MarketPanel({sim:s,onAction,refresh}:any){
 const [mode,setMode]=useState('sell'),[everything,setEverything]=useState(false);
 const ids=Object.keys(RESOURCES),relevant=(id:string)=>permitted(s,id)||Math.floor(s.stock[id]||0)>0||!!s.autoSell[id],shown=ids.filter(id=>everything||relevant(id)),rest=ids.length-shown.length;
 // A sale ships at most one route-sized lot; imports keep the fixed 10-unit order.
 const lot=mode==='sell'?s.tradeConnection().capacity:10;
 return <div className="market-panel"><Tabs value={mode} onValueChange={setMode}><TabsList><TabsTrigger value="sell">판매</TabsTrigger><TabsTrigger value="buy">수입</TabsTrigger></TabsList></Tabs>
 <p className="market-note">{mode==='sell'?'판 물건은 수출 마차가 서쪽 관문까지 싣고 가서 이 지역이 닿은 무역로나 항구로 넘깁니다. 한 번에 보낼 수 있는 양과 값은 무역로·항구마다 다릅니다. 같은 품목을 계속 팔면 가격이 내려가고, 수요는 시간이 지나면 회복됩니다.':'생산 허가를 얻은 자원을 수입합니다. 수입품은 생산 실적으로 인정되지 않습니다.'}</p>
 {mode==='sell'&&(()=>{const t=s.tradeConnection(),options=s.tradeOptions(),bonus=Math.round((t.price-1)*100);return <div className="trade-route-card"><div><strong>{t.name}</strong><small>{(ROUTE_KINDS as any)[t.kind].name} · {t.scale==='port'?t.terrain:t.scale==='major'?'대형':'소형'}{t.name.startsWith(t.joins)?'':` → ${t.joins}`} · {(ROUTE_KINDS as any)[t.kind].note}</small></div><dl><div><dt>한 번에</dt><dd>{t.capacity}개</dd></div><div><dt>값</dt><dd>{bonus>0?'+':''}{bonus}%</dd></div></dl>{options.length>1&&<label>무역로<select aria-label="판매할 무역로" value={t.id} onChange={e=>onAction(s.chooseTradeRoute(e.target.value))}>{options.map((o:any)=><option key={o.id} value={o.id}>{o.name} · {o.capacity}개 · {Math.round((o.price-1)*100)>0?'+':''}{Math.round((o.price-1)*100)}%</option>)}</select></label>}</div>;})()}
 {mode==='sell'&&(()=>{const e=s.exportStatus();return <p className={'export-status'+(e.connected?'':' blocked')} role="status">{e.connected?`수출길 연결됨 · 마차 ${e.busy}/${e.carts}대 운행 중${e.inTransit?` · 도착 대기 ${e.inTransit}G`:''}`:e.error}</p>;})()}
 <div className="market-rows">{shown.map(id=>[id,(RESOURCES as any)[id]]).map(([id,r]:any)=>{const price=mode==='buy'?Math.ceil(r.price*1.85):s.saleQuote(id,1);return <div className="market-row" key={id}>
 <span className="resource-dot" style={{background:r.color}}/>
 <div><strong>{r.name}</strong><small>1개 {price}G{mode==='sell'&&<em className={s.marketFactor(id)<.85?'market-low':'market-high'}> · 수요 {Math.round(s.marketFactor(id)*100)}%</em>}</small></div><b aria-label={r.name+' 재고'}>{Math.floor(s.stock[id])}</b>
 <Button variant="outline" size="sm" aria-label={r.name+' 1개 '+(mode==='buy'?'수입':'판매')} disabled={mode==='sell'?s.stock[id]<1:s.money<price||!permitted(s,id)} onClick={()=>onAction(mode==='buy'?s.buy(id,1):s.sell(id,1))}>1개</Button>
 <Button variant="outline" size="sm" aria-label={r.name+' '+lot+'개 '+(mode==='buy'?'수입':'판매')} disabled={mode==='sell'?s.stock[id]<1:s.money<price*lot||!permitted(s,id)} onClick={()=>onAction(mode==='buy'?s.buy(id,lot):s.sell(id,lot))}>{lot}개</Button>
 {mode==='sell'&&<label className="auto-switch"><Switch checked={!!s.autoSell[id]} onCheckedChange={v=>{s.autoSell[id]=v;refresh();}} aria-label={r.name+' 자동 판매'}/><span>자동</span></label>}
 {mode==='sell'&&s.autoSell[id]&&<div className="reserve-line"><label>최소 보관 <input aria-label={r.name+' 최소 보관'} type="number" min="0" max="999" value={s.reserves[id]||0} onChange={e=>{s.reserves[id]=Math.max(0,Math.min(999,Math.floor(+e.target.value)));refresh();}}/></label><span>현재 보호 {s.minimumStock(id)}개</span></div>}
 </div>;})}</div>{rest>0&&<button className="market-more" onClick={()=>setEverything(true)}>잠긴 품목 {rest}개 보기</button>}</div>;
}

export function Tutorial({sim:s,onTool,onGoals,onDismiss}:any){
 const step=tutorialStep(s);if(!step)return null;const index=step.index,steps={length:step.total};
 return <aside className="tutorial-card panel"><button className="tutorial-dismiss" aria-label="안내 닫기" onClick={onDismiss}>×</button><small>{index+1} / {steps.length}</small><strong>{step.title}</strong><p>{step.text}</p><Button size="sm" onClick={()=>step.tool?onTool(step.tool):onGoals()}>{step.tool?(BUILDINGS as any)[step.tool].name+' 선택':'신분과 권한 열기'}</Button></aside>;
}

export function RaidPanel({sim:s,onAction}:any){const r=s.raid;if(!r||r.finished)return null;return <aside className="raid-panel panel" role="status"><div><strong>{(FACTIONS as any)[r.faction].name} 습격</strong><span>{Math.max(0,Math.ceil(r.ends-s.time))}초 · 적 {s.attackers.filter((a:any)=>a.hp>0).length}명</span></div><Progress value={Math.max(0,100*(r.ends-s.time)/65)}/><Button size="sm" disabled={r.boosted} onClick={()=>onAction(s.mobilize())}>{r.boosted?'경계 강화 중':'경비 2명 · 80G + 밀 6'}</Button></aside>;}

export function EmergingStates({campaign:c,onAction}:any){
 const [selected,setSelected]=useState('');const state=c.newStates.find((s:any)=>s.id===selected&&!s.dissolved)||c.newStates.filter((s:any)=>!s.dissolved).at(-1);
 if(!state)return <div className="empty-state"><strong>아직 신생 국가가 없습니다.</strong><p>산업이 성장하고 불만이 쌓이면 기존 국가에서 새로운 나라가 독립합니다.</p></div>;
 const order=c.stateOrder(state);
 return <section className="state-diplomacy"><label>신생 국가<select value={state.id} onChange={e=>setSelected(e.target.value)}>{[...c.newStates].filter((s:any)=>!s.dissolved).reverse().map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><div className="state-profile"><strong>{state.name}</strong><p>{c.stateOrigin(state)}에서 독립 · 산업 {state.industry}단계 · {state.provinceIds?.length||0}개 영토</p><p>{state.pact?'국경 자유 통행':state.relation<15?'국경 봉쇄':state.relation>=55?'우호 통행세 3G':'통행세 12G'} · 관계가 현지 시장과 운송에 영향을 줍니다.</p><div className="council-stats"><span>외교 관계 <b>{Math.round(state.relation)} / 100</b></span><span>내부 불만 <b>{Math.round(state.unrest)}%</b></span></div></div><div className="state-contract"><strong>{(RESOURCES as any)[order.item].name} {order.amount}개</strong><span>대금 {order.reward}G · 관계 +10</span><Button disabled={state.lastTradeDay===c.lastWorldDay} onClick={()=>onAction(c.stateAction('trade',state.id))}>{state.lastTradeDay===c.lastWorldDay?'오늘 교역 완료':'교역 계약 이행'}</Button></div><div className="council-actions"><Button variant="outline" onClick={()=>onAction(c.stateAction('aid',state.id))}>민생 지원<small>180G · 빵 8 · 관계 +12</small></Button><Button variant="outline" disabled={state.pact} onClick={()=>onAction(c.stateAction('pact',state.id))}>{state.pact?'방위 협정 체결됨':'상호 방위 협정'}<small>관계 55 · 750G</small></Button><Button variant="outline" disabled={c.recognition.includes(state.id)} onClick={()=>onAction(c.stateAction('recognition',state.id))}>독립 지지 요청<small>관계 55 · 650G · 자동차 1</small></Button></div></section>;
}
