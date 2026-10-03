import {importCost} from './economy';
import StoragePanel from './StoragePanel';
import {remainingSeconds} from './game-time';
import ResourceIcon from './ResourceIcon';
'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Home} from 'lucide-react';
import {Switch} from '@/components/ui/switch';
import {Tabs,TabsContent,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {Progress} from '@/components/ui/progress';
import {RESOURCES,BUILDINGS} from './simulation';
import {FACTIONS} from './world';
import {contractState,fleetState,permitted,tutorialStep} from './ui-rules';
import {FleetLine} from './Operations';
import {ROUTE_KINDS} from './trade-routes';
import {COUNCIL} from './campaign';

export function MarketPanel({sim:s,onAction,refresh}:any){
 const [mode,setMode]=useState('sell'),[everything,setEverything]=useState(false);
 const ids=Object.keys(RESOURCES),relevant=(id:string)=>permitted(s,id)||Math.floor(s.stock[id]||0)>0||!!s.autoSell[id],shown=ids.filter(id=>everything||relevant(id)),rest=ids.length-shown.length;
 // A sale ships at most one route-sized lot; imports keep the fixed 10-unit order.
 const lot=10;
 return <div className="market-panel"><Tabs value={mode} onValueChange={setMode}><TabsList><TabsTrigger value="sell">판매</TabsTrigger><TabsTrigger value="buy">수입</TabsTrigger></TabsList><TabsContent value={mode}>
 <p className="market-note">{mode==='sell'?'대금은 외부 거래 도시에 도착하면 들어옵니다. 자동 판매는 출하 금액이 큰 품목을 먼저 보냅니다. 같은 품목을 계속 팔면 값이 내려갑니다.':'수입품은 생산 실적에 포함되지 않습니다. 연료가 없을 때 연료 수입은 왕복 연료값을 함께 지불합니다.'}</p>
 {mode==='sell'&&(()=>{const t=s.tradeConnection(),options=s.tradeTerminals(),bonus=Math.round((t.price-1)*100);return <div className="trade-route-card"><div><strong>{t.name}</strong><small>{t.label} · {(ROUTE_KINDS as any)[t.kind].name} · {t.scale==='port'?t.terrain:t.scale==='major'?'대형':'소형'}{t.label.startsWith(t.joins)?'':` → ${t.joins}`}</small></div><dl><div><dt>한 번에</dt><dd>{t.capacity}개</dd></div><div><dt>값</dt><dd>{bonus>0?'+':''}{bonus}%</dd></div></dl>{options.length>1&&<label>터미널<select aria-label="수출 터미널" value={t.id} onChange={e=>onAction(s.chooseTradeRoute(e.target.value))}>{options.map((o:any)=><option key={o.id} value={o.id} disabled={!o.usable}>{o.name} · {o.usable?`${o.capacity}개 · ${Math.round((o.price-1)*100)>0?'+':''}${Math.round((o.price-1)*100)}%`:o.error}</option>)}</select></label>}</div>;})()}
 {mode==='sell'&&(()=>{const e=s.exportStatus(),fleet=fleetState(s);return <div className={'export-status'+(e.connected?'':' blocked')} role="status">{e.connected?<>{fleet?<FleetLine fleet={fleet} detail/>:<span>운송 {e.busy}/{e.carts}대 운행</span>}{e.inTransit>0&&<span className="export-pending">도착 대기 {e.inTransit}G</span>}</>:e.error}</div>;})()}
 <StoragePanel sim={s} onAction={onAction}/>
 {s.shipments.length>0&&<div className="shipping-list" aria-label="운송 현황">{s.shipments.map((sh:any)=><div key={sh.id}><ResourceIcon name={sh.item} size={18}/><span>{(RESOURCES as any)[sh.item].name} {sh.amount}개 · {sh.destination||'거래 도시'}</span><b>{sh.away?`${sh.away==='out'?'도시로 운송':'귀환'} ${remainingSeconds(sh.remaining,s)}초`:sh.phase==='out'?'출하 중':'마을로 복귀'}</b></div>)}</div>}
 <div className="market-rows">{shown.map(id=>[id,(RESOURCES as any)[id]]).map(([id,r]:any)=>{const price=mode==='buy'?Math.ceil(r.price*1.85):s.saleQuote(id,1);return <div className="market-row" key={id}>
 <ResourceIcon name={id} size={24}/>
 <div><strong>{r.name}</strong><small>1개 {price}G{mode==='buy'&&importCost(s,id,1)>price&&<em> · 왕복 연료 {importCost(s,id,1)-price}G 추가</em>}{mode==='sell'&&<em className={s.marketFactor(id)<.85?'market-low':'market-high'}> · 수요 {Math.round(s.marketFactor(id)*100)}%</em>}</small></div><b aria-label={r.name+' 재고'}>{Math.floor(s.stock[id])}</b>
 <Button variant="outline" size="sm" aria-label={r.name+' 1개 '+(mode==='buy'?'수입':'판매')} disabled={mode==='sell'?s.availableStock(id)<1:s.money<importCost(s,id,1)||!permitted(s,id)} title={mode==='buy'?importCost(s,id,1)+'G':undefined} onClick={()=>onAction(mode==='buy'?s.buy(id,1):s.sell(id,1))}>1개</Button>
 <Button variant="outline" size="sm" aria-label={r.name+' '+lot+'개 '+(mode==='buy'?'수입':'판매')} disabled={mode==='sell'?s.availableStock(id)<1:s.money<importCost(s,id,lot)||!permitted(s,id)} title={mode==='buy'?importCost(s,id,lot)+'G':undefined} onClick={()=>onAction(mode==='buy'?s.buy(id,lot):s.sell(id,lot))}>{lot}개</Button>
 {mode==='sell'&&<label className="auto-switch"><Switch checked={!!s.autoSell[id]} onCheckedChange={v=>{s.autoSell[id]=v;refresh();}} aria-label={r.name+' 자동 판매'}/><span>자동</span></label>}
 {mode==='sell'&&s.autoSell[id]&&<div className="reserve-line"><label>최소 보관 <input aria-label={r.name+' 최소 보관'} type="number" min="0" max="999" value={s.reserves[id]||0} onChange={e=>{s.reserves[id]=Math.max(0,Math.min(999,Math.floor(+e.target.value)));refresh();}}/></label><span>현재 보호 {s.minimumStock(id)}개</span></div>}
 </div>;})}</div>{rest>0&&<button className="market-more" onClick={()=>setEverything(true)}>잠긴 품목 {rest}개 보기</button>}</TabsContent></Tabs></div>;
}

export function Tutorial({sim:s,onTool,onGoals,onDismiss,onAction}:any){
 const step=tutorialStep(s);if(!step)return null;const index=step.index,steps={length:step.total};
 // The contract step sends the order from the guide itself; the same button state as the operations card.
 const deal=step.action==='contract'?contractState(s):null;
 return <aside className="tutorial-card panel"><button className="tutorial-dismiss" aria-label="안내 닫기" onClick={onDismiss}>×</button><small>{index+1} / {steps.length}</small><strong>{step.title}</strong><p>{step.text}</p>
 {deal?<Button size="sm" disabled={!deal.ready} onClick={()=>onAction(s.fulfill())}>{deal.label==='납품'?(deal.ready?'납품 +'+deal.contract.reward+'G':(RESOURCES as Record<string,{name:string}>)[deal.contract.item].name+' '+deal.have+' / '+deal.contract.amount):deal.label}</Button>
 :<Button size="sm" onClick={()=>step.tool?onTool(step.tool):onGoals()}>{step.tool?(BUILDINGS as any)[step.tool].name+' 선택':'신분과 권한 열기'}</Button>}
 {(deal?!deal.ready:!!step.waiting)&&<div className="tutorial-wait" role="group" aria-label="기다리는 동안 할 일"><small>모이는 동안</small><Button size="sm" variant="outline" onClick={()=>onTool('house')}><Home size={14}/>주택 하나 더</Button></div>}</aside>;
}

export function RaidPanel({sim:s,onAction}:any){const r=s.raid;if(!r||r.finished)return null;return <aside className="raid-panel panel" role="status"><div><strong>{(FACTIONS as any)[r.faction].name} 습격</strong><span>{remainingSeconds(r.ends-s.time,s)}초 · 적 {s.attackers.filter((a:any)=>a.hp>0).length}명</span></div><Progress value={Math.max(0,100*(r.ends-s.time)/65)}/><Button size="sm" disabled={r.boosted||!!s.mobilizeShort?.()} onClick={()=>onAction(s.mobilize())}>{r.boosted?'경계 강화 중':'경비 2명 · 80G + 밀 6'}</Button>{!r.boosted&&s.mobilizeShort?.()&&<small className="action-short" role="note">{s.mobilizeShort()}</small>}</aside>;}

export function EmergingStates({campaign:c,onAction}:any){
 const [selected,setSelected]=useState('');const live=c.newStates.filter((s:any)=>!s.dissolved),state=live.find((s:any)=>s.id===selected)||live.at(-1);
 if(!state)return <div className="empty-state"><strong>아직 신생 국가가 없습니다.</strong><p>산업이 성장하고 불만이 쌓이면 기존 국가에서 새로운 나라가 독립합니다.</p></div>;
 // A2-U4: every open order in one table, best paid first, with one button for all that can leave now. Prices and conditions
 // of aid, pacts and recognition come from campaign.js councilTerms, the text the rules refuse with (A2-L1).
 const orders=c.stateOrders(),ready=orders.filter((o:any)=>o.ready).length,open=orders.filter((o:any)=>!o.done).length,terms=(a:string)=>c.councilTerms(a);
 return <section className="state-diplomacy">
 <div className="state-orders-head"><strong>신생국 주문 {open}건</strong><small>{c.airFreight()?'비공정 특송 중 · 대금 +20%':'나라마다 하루 한 건 · 목록가의 1.45배'}</small><Button size="sm" disabled={!ready} onClick={()=>onAction(c.tradeAll())}>보낼 수 있는 {ready}건 모두 보내기</Button></div>
 <div className="state-orders" style={{maxHeight:'16rem',overflow:'auto'}}><table><thead><tr><th>국가</th><th>주문</th><th>대금</th><th>보내기</th></tr></thead><tbody>{orders.map((o:any)=><tr key={o.state.id} className={o.state.id===state.id?'active':''}><td><button type="button" onClick={()=>setSelected(o.state.id)}>{o.state.name}</button></td><td>{(RESOURCES as any)[o.order.item].name} {o.order.amount}<small> · 보유 {o.have}</small></td><td>{o.order.reward.toLocaleString()}G</td><td><Button size="sm" variant="outline" disabled={!o.ready} onClick={()=>onAction(c.stateAction('trade',o.state.id))}>{o.ready?'보내기':o.reason}</Button></td></tr>)}</tbody></table></div>
 <label>외교 대상<select value={state.id} onChange={e=>setSelected(e.target.value)}>{[...live].reverse().map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><div className="state-profile"><strong>{state.name}</strong><p>{c.stateOrigin(state)}에서 독립 · 산업 {state.industry}단계 · {state.provinceIds?.length||0}개 영토</p><p>{state.pact?'국경 자유 통행':state.relation<15?'국경 봉쇄':state.relation>=55?'우호 통행세 3G':'통행세 12G'} · 관계가 현지 시장과 운송에 영향을 줍니다.</p><div className="council-stats"><span>외교 관계 <b>{Math.round(state.relation)} / 100</b></span><span>내부 불만 <b>{Math.round(state.unrest)}%</b></span></div></div>
 <div className="council-actions"><Button variant="outline" onClick={()=>onAction(c.stateAction('aid',state.id))}>민생 지원<small>{terms('aid')} · 관계 +{COUNCIL.aid.relation}</small></Button><Button variant="outline" disabled={state.pact} onClick={()=>onAction(c.stateAction('pact',state.id))}>{state.pact?'방위 협정 체결됨':'상호 방위 협정'}<small>{terms('pact')}</small></Button><Button variant="outline" disabled={c.recognition.includes(state.id)} onClick={()=>onAction(c.stateAction('recognition',state.id))}>독립 지지 요청<small>{terms('stateRecognition')}{c.stage>=COUNCIL.stateRecognition.stage?' · 사절 '+c.allowance('recognition')+'명':''}</small></Button></div></section>;
}

// G3-13: the endless goals after 패권국 (campaign.legacy()). Each record shows its level and the way to the next target.
export function LegacyGoals({campaign:c,compact=false}:any){const l=c?.legacy?.();if(!l?.active)return null;
 return <section className={'legacy-goals'+(compact?' compact':'')} aria-label="대륙 기록"><header><strong>대륙 기록</strong><b aria-label={'기록 점수 '+l.score}>{l.score}<small>점</small></b></header>
  <ul>{l.goals.map((g:any)=>{const pct=Math.max(0,Math.min(100,Math.floor(g.current/g.target*100)));return <li key={g.id} data-goal={g.id}><span className="legacy-level" aria-label={g.level+'단계'}>{g.level}</span><div><strong>{g.name}</strong><small>{g.text}</small><i role="progressbar" aria-label={g.name+' 다음 단계'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><em style={{width:pct+'%'}}/></i></div><b>{Math.floor(g.current).toLocaleString('ko-KR')}<small> / {g.target.toLocaleString('ko-KR')}</small></b></li>;})}</ul></section>;}
