'use client';
import {destinationMarket} from './trade-journey';
import {starsOf} from './league';
import {scoreEvent} from './competition-rules';
import {useState} from 'react';
import {Search,Truck} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Switch} from '@/components/ui/switch';
import {Tabs,TabsContent,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {RESOURCES} from './simulation';
import {exportableStock} from './export-route';
import {terminalVehicleCapacity} from './trade-terminals';
import {importCost,purchaseShort} from './economy';
import {remainingSeconds} from './game-time';
import {fleetState,permitted} from './ui-rules';
import {FleetLine} from './Operations';
import ResourceIcon from './ResourceIcon';
import StoragePanel from './StoragePanel';
import TradeJourneyPanel from './TradeJourneyPanel';

export default function MarketPanel({sim:s,onAction,refresh}:any){
 const [mode,setMode]=useState('sell'),[everything,setEverything]=useState(false),[quantity,setQuantity]=useState(10),[query,setQuery]=useState(''),[owned,setOwned]=useState(false);
 const ids=Object.keys(RESOURCES),relevant=(id:string)=>permitted(s,id)||Math.floor(s.stock[id]||0)>0||!!s.autoSell[id];
 const available=ids.filter(id=>everything||relevant(id)),shown=available.filter(id=>(!owned||mode==='buy'||s.stock[id]>0)&&RESOURCES[id as keyof typeof RESOURCES].name.includes(query.trim())),rest=ids.length-available.length;
 const transport=s.exportStatus(),capacity=transport.capacity,canSend=transport.connected&&transport.vehicles.some((v:any)=>v.selected&&!v.busy),canSell=canSend&&transport.fuelReady,lot=Math.max(1,Math.min(capacity,Math.floor(quantity)||1));
 const fleet=fleetState(s),terminal=s.tradeConnection(),terminals=s.tradeTerminals();
 return <div className="market-panel market-focused"><Tabs value={mode} onValueChange={setMode}>
  <TabsList aria-label="거래 종류"><TabsTrigger value="sell">판매</TabsTrigger><TabsTrigger value="buy">수입</TabsTrigger></TabsList>
  <TabsContent value={mode}>
   <details className="market-logistics ui-disclosure"><summary><Truck size={17}/><span>운송·보관</span><small>{fleet?.busy??transport.busy}/{fleet?.total??transport.carts}대 운행 · 최대 {capacity}개</small></summary>
    <div className="disclosure-body">
     {fleet&&<FleetLine fleet={fleet} detail/>}
     {terminals.length>1?<label className="setting-row">터미널<select aria-label="수출 터미널" value={terminal.id} onChange={e=>onAction(s.chooseTradeRoute(e.target.value))}>{terminals.map((o:any)=><option key={o.id} value={o.id} disabled={!o.usable}>{o.name} · {o.usable?`${terminalVehicleCapacity(o)}개 · ${Math.round((o.price-1)*100)}%`:o.error}</option>)}</select></label>:<p>{terminal.name} · 판매가 {Math.round((terminal.price-1)*100)}%</p>}
     <TradeJourneyPanel sim={s} onAction={onAction}/><StoragePanel sim={s} onAction={onAction}/>
     <p className="market-note">{mode==='sell'?'대금은 거래 도시에 도착하면 들어옵니다. 자동 판매는 출하 금액이 큰 품목부터 보내며, 같은 품목을 계속 팔면 값이 내려갑니다.':'수입품은 생산 실적에 포함되지 않습니다. 연료가 없을 때 연료 수입은 왕복 연료값을 함께 지불합니다.'}</p>
    </div>
   </details>
   {mode==='sell'&&(!transport.connected||!canSell)&&<p className="market-warning" role="status">{!transport.connected?transport.error:!transport.fuelReady?fleet?.fuelNote||'운송 연료가 부족합니다.':`운송 ${transport.busy}대가 돌아오면 판매할 수 있습니다.`}</p>}
   {s.shipments.length>0&&<details className="ui-disclosure"><summary>운송 중 {s.shipments.length}건{transport.inTransit>0&&<small>도착 예정 +{transport.inTransit}G</small>}</summary><div className="shipping-list" aria-label="운송 현황">{s.shipments.map((sh:any)=><div key={sh.id}><ResourceIcon name={sh.item} size={18}/><span>{(RESOURCES as any)[sh.item].name} {sh.amount}개 · {sh.destination||'거래 도시'}</span><b>{sh.blocked||(sh.away?`${sh.away==='out'?'도시로 운송':'귀환'} ${remainingSeconds(sh.remaining,s)}초`:sh.phase==='out'?'출하 중':'마을로 복귀')}</b></div>)}</div></details>}
   {mode==='sell'&&s.campaign?.league&&<p className="market-note">{scoreEvent(s.campaign.lastWorldDay).name} · 판매 대금과 별 점수는 따로 계산합니다.</p>}
   <div className="market-filters"><label className="market-search"><Search size={17}/><input type="search" aria-label="상품 검색" placeholder="상품 검색" value={query} onChange={e=>setQuery(e.target.value)}/></label>{mode==='sell'&&<button className="market-owned" aria-pressed={owned} onClick={()=>setOwned(!owned)}>보유만</button>}</div>
   <div className="market-order"><label htmlFor="market-quantity">주문 수량</label><input id="market-quantity" aria-label="주문 수량" type="number" min="1" max={capacity} value={lot} onChange={e=>setQuantity(+e.target.value)}/><button onClick={()=>setQuantity(capacity)}>최대 {capacity}</button><span>재고</span></div>
   <div className="market-rows">{shown.map(id=>{const r=(RESOURCES as any)[id],qty=mode==='buy'?lot:Math.max(0,Math.min(lot,Math.floor(s.availableStock(id)),Math.floor(exportableStock(s,id)))),price=mode==='buy'?Math.ceil(r.price*1.85):s.saleQuote(id,1);return <div className="market-row" key={id} data-item={id}>
    <ResourceIcon name={id} size={30}/><div className="market-item"><strong>{r.name}</strong><small>1개 {price}G{mode==='sell'&&<em className={s.marketFactor(id)<.85?'market-low':'market-high'}> · ★{starsOf(id,1,s.campaign?.lastWorldDay??s.day)} · 수요 {Math.round(s.marketFactor(id)*100)}% · 도시 {Math.round(destinationMarket(s,id).factor*100)}%</em>}{mode==='buy'&&importCost(s,id,1)>price&&<em> · 운송비 별도</em>}</small></div><b className="market-stock" aria-label={r.name+' 재고'}>{Math.floor(s.stock[id])}</b>
    <div className="market-actions">
     <Button variant="outline" size="sm" aria-label={r.name+' 1개 '+(mode==='buy'?'수입':'판매')} disabled={mode==='sell'?!canSell||s.availableStock(id)<1:!!purchaseShort(s,id,1)} title={mode==='buy'?purchaseShort(s,id,1)||undefined:undefined} onClick={()=>onAction(mode==='buy'?s.buy(id,1):s.sell(id,1))}>{mode==='buy'?`1개 · ${importCost(s,id,1)}G`:'1개'}</Button>
     {qty!==1&&<Button size="sm" aria-label={r.name+' '+qty+'개 '+(mode==='buy'?'수입':'판매')} disabled={mode==='sell'?!canSell||qty<1:!!purchaseShort(s,id,qty)} onClick={()=>onAction(mode==='buy'?s.buy(id,qty):s.sell(id,qty))}>{mode==='buy'?`${qty}개 · ${importCost(s,id,qty)}G`:`${qty}개 · +${s.saleQuote(id,qty)}G`}</Button>}
     {mode==='sell'&&<label className="auto-switch"><Switch checked={!!s.autoSell[id]} onCheckedChange={v=>{s.autoSell[id]=v;refresh();}} aria-label={r.name+' 자동 판매'}/><span>자동</span></label>}
    </div>
    {mode==='sell'&&s.autoSell[id]&&<div className="reserve-line"><label>최소 보관 <input aria-label={r.name+' 최소 보관'} type="number" min="0" max="999" value={s.reserves[id]||0} onChange={e=>{s.reserves[id]=Math.max(0,Math.min(999,Math.floor(+e.target.value)));refresh();}}/></label><span>현재 보호 {s.minimumStock(id)}개</span></div>}
   </div>;})}</div>
   {!shown.length&&<p className="empty-state" role="status">{query?'검색한 상품이 없습니다.':'보유한 상품이 없습니다.'}</p>}
   {rest>0&&<button className="market-more" onClick={()=>setEverything(true)}>해금 전 품목 {rest}개 보기</button>}
  </TabsContent></Tabs></div>;
}
