import {remainingSeconds} from './game-time';
'use client';
import {ArrowRight,Caravan,Check,Coins,Flag,Grid2X2Plus,Hammer,Heart,LifeBuoy,Package,Sailboat,Ship,Sprout,Truck,TriangleAlert,Wrench} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Progress} from '@/components/ui/progress';
import {BUILDINGS,RESOURCES} from './simulation';
import {CHARTERS} from './progression';
import {productionDiagnosis} from './proximity';
import {unlockRank} from './world';
import {blockHint,contractConflict,contractState,crewHouse,exportBlocked,fleetState,nextBuild,objectOf,outputOf,plantSpot,promotionParts,quickSaleLot,recoveryState,repairPlan,sellableStock,subjectOf} from './ui-rules';

const B:any=BUILDINGS,R:any=RESOURCES;
const VEHICLE_ICONS:Record<string,typeof Truck>={wagon:Caravan,raft:Sailboat,truck:Truck,steamer:Ship};
type Fleet={vehicles:{kind:string,busy:boolean,name:string,fuel:boolean}[],busy:number,total:number,fuelNote:string,waiting:string};

/** Export vehicles as icons (filled while out), with the count or the fuel note when fuel holds shipments back. */
export function FleetLine({fleet:f,detail}:{fleet:Fleet,detail?:boolean}){
 return <div className={'fleet-line'+(f.fuelNote?' fuel-short':'')}>
  <span className="fleet-icons" aria-hidden="true">{f.vehicles.map((v,i)=>{const Icon=VEHICLE_ICONS[v.kind]||Truck;return <i key={i} className={(v.busy?'busy':'')+(v.fuel?' fuel':'')} title={v.name}><Icon size={14}/></i>;})}</span>
  <span><span className="sr-only">운송 </span>{f.fuelNote?f.fuelNote+(detail?' · '+f.waiting:''):<><b>{f.busy}/{f.total}</b><span className="fleet-unit">대 운행</span></>}</span>
 </div>;
}

/** Money short for an action: how much is missing and the way out right there (emergency fund, else the market). */
export function ShortFunds({sim:s,need,onAction,onMarket}:any){
 const lack=Math.ceil(need-s.money);if(lack<=0)return null;const r=recoveryState(s);
 return <span className="short-funds" role="note"><b>{lack.toLocaleString('ko-KR')}G 부족</b>{r.ready?<button onClick={()=>onAction(s.recover(),'success')}><LifeBuoy size={13}/>회생 자금</button>:<>{r.reason&&<small>{r.reason}</small>}<button onClick={onMarket}><Coins size={13}/>재고 팔기</button></>}</span>;
}
const autoSellOn=(s:any,item:string)=>{if(!RESOURCES[item as keyof typeof RESOURCES])return {ok:false,error:'판매할 수 없는 품목입니다'};s.autoSell[item]=true;return {ok:true};};

/** Fix buttons right under a stalled facility: sell a full store, replant or expand a depleted gatherer, repair. */
function FixActions({sim:s,b,onAction,onTool,onMarket,repairs}:any){
 if(b.status==='창고 가득 참'){const item=outputOf(s,b),lot=item?quickSaleLot(s,item):0;if(!item)return null;
  return <div className="fix-actions"><Button size="sm" disabled={lot<1} onClick={()=>onAction(s.sell(item,lot),'')}><Coins size={14}/>{R[item].name} {lot}개 팔기</Button>{!s.autoSell[item]&&<Button size="sm" variant="outline" onClick={()=>onAction(autoSellOn(s,item))}>자동 판매 켜기</Button>}</div>;}
 if(b.status==='자원 고갈'&&b.health>=100){const spot=plantSpot(s,b);
  return <div className="fix-actions">{spot&&<Button size="sm" onClick={()=>onAction(s.plant(spot.x,spot.z),'build')}><Sprout size={14}/>묘목 심기 · 15G + 물 2</Button>}<Button size="sm" variant="outline" onClick={()=>onTool('expand')}><Grid2X2Plus size={14}/>영토 확장</Button></div>;}
 if(b.health<100&&repairs.list.length<2){const cost=s.repairCost(b);
  return <div className="fix-actions"><Button size="sm" disabled={s.money<cost} onClick={()=>onAction(s.repair(b.id),'build')}><Wrench size={14}/>수리 · {cost}G</Button><ShortFunds sim={s} need={cost} onAction={onAction} onMarket={onMarket}/></div>;}
 return null;
}

export function Operations({sim:s,onAction,onFocus,onGoals,onTool,onMarket,falling,hidden}:any){
 const failures=s.buildings.filter((b:any)=>b.enabled!==false&&(b.health<100||blockHint(b.status)));
 const urgent=failures.find((b:any)=>b.health<=0||/경로|출입구|전력/.test(b.status))||failures[0];
 const house=urgent&&urgent.health>=100?crewHouse(urgent.status):null;
 const diagnostic=house?{text:objectOf(B[house].name)+' 지어 전담 주민을 맞이하세요.',tool:unlockRank(house)<=s.rank?house:null,focus:urgent.id}:urgent?productionDiagnosis(s,urgent,BUILDINGS,RESOURCES):null;const deal=contractState(s),c=deal.contract,next=nextBuild(s),fleet=fleetState(s);
 const promotion=s.promotion(),exported=exportBlocked(s),blocker=promotionParts(s,promotion).find((v:any)=>!v.done);
 const repairs=repairPlan(s),conflict=contractConflict(s),sale=falling?sellableStock(s):null;
 const conflictText=conflict&&('납품하면 승급 목표 '+R[conflict.goal].name+(conflict.goal===conflict.item?' 판매분':'의 재료 '+subjectOf(R[conflict.item].name))+' '+conflict.short+'개 모자랍니다');
 return <>
 {s.health.infection>0&&<aside className="health-alert panel" role="status"><Heart size={18}/><div><strong>감염 {Math.ceil(s.health.infection)}%</strong><span>{s.health.sanitationUntil>s.time?'방역 중 · '+remainingSeconds(s.health.sanitationUntil-s.time,s)+'초':s.stage>=15?'병원에 의약품 공급':s.rank>=unlockRank('clinic')?'진료소를 가동하세요':'방역으로 확산을 늦추세요'}</span></div><button onClick={()=>onAction(s.sanitize())}>방역</button></aside>}
 {!hidden&&s.warehouse&&<aside className="operations-card panel">
 {exported?<button className="bottleneck export-blocked" onClick={()=>onFocus(s.warehouse.id)}><TriangleAlert size={17}/><span><strong>수출길 막힘{exported.auto?' · 자동 판매 멈춤':''}</strong><small>{exported.error}</small></span><ArrowRight size={15}/></button>
 :urgent?<div className="bottleneck-block"><button className="bottleneck" onClick={()=>diagnostic?.tool?onTool(diagnostic.tool):onFocus(diagnostic?.focus||urgent.id)}><TriangleAlert size={17}/><span><strong>{B[urgent.type].name} · {urgent.status}</strong><small>{diagnostic?.text||'시설을 수리하세요.'}</small></span><ArrowRight size={15}/></button><FixActions sim={s} b={urgent} onAction={onAction} onTool={onTool} onMarket={onMarket} repairs={repairs}/></div>
 :!next&&<div className="network-ok"><Check size={16}/>생산망 연결됨<span><Truck size={14}/>{s.workers.filter((w:any)=>w.task).length}명 운반</span></div>}
 {repairs.list.length>1&&<div className="repair-all"><Button size="sm" disabled={s.money<repairs.cheapest} title={s.money<repairs.total?'자금이 닿는 만큼 싼 곳부터 고칩니다':undefined} onClick={()=>onAction(s.repairAll(),'build')}><Wrench size={14}/>모두 수리 · {repairs.list.length}곳 · 합계 {repairs.total.toLocaleString('ko-KR')}G</Button><ShortFunds sim={s} need={repairs.total} onAction={onAction} onMarket={onMarket}/></div>}
 {next&&<button className="next-build" onClick={()=>onTool(next.type)} aria-label={next.name+' 짓기 · '+next.chain}><Hammer size={16}/><span><strong>{next.name} 짓기</strong><small>{next.chain}</small></span><ArrowRight size={15}/></button>}
 {sale&&sale.value>0&&<button className="sell-hint" onClick={onMarket} aria-label={'자금이 줄고 있습니다 · 팔 수 있는 재고 '+sale.value.toLocaleString('ko-KR')+'G어치 · 시장 열기'}><Coins size={16}/><span><strong>팔 수 있는 재고 {sale.value.toLocaleString('ko-KR')}G어치</strong><small>자금이 줄고 있습니다 · {sale.items.slice(0,3).map((v:any)=>R[v.id].name+' '+v.n).join(' · ')}</small></span><ArrowRight size={15}/></button>}
 <div className="quick-contract"><Package size={18}/><div><strong>{R[c.item]?.name} 납품</strong><span>{deal.have} / {c.amount} · {c.reward}G</span></div><Button size="sm" disabled={!deal.ready} title={conflictText||deal.note||undefined} onClick={()=>onAction(s.fulfill())}>{deal.label}</Button></div>
 {conflictText&&<p className="contract-warning" role="note"><TriangleAlert size={13}/>{conflictText}</p>}
 {fleet&&<FleetLine fleet={fleet}/>}
 {promotion?.ready?<button className="promotion-ready" onClick={onGoals}><Flag size={16}/>{promotion.name} 승급 가능<ArrowRight size={14}/></button>
 :promotion&&<button className="next-goal" onClick={onGoals} aria-label={'다음 승급 '+promotion.name}><Flag size={15}/><span><strong>{promotion.name}</strong>{blocker&&<small>{blocker.label} {blocker.current.toLocaleString('ko-KR')}/{blocker.target.toLocaleString('ko-KR')}{blocker.unit||''}</small>}</span><ArrowRight size={14}/></button>}
 </aside>}
 </>;
}


export function RescuePanel({sim:s,onAction}:any){const q=s.rescueInfo();return <section className="rescue-chapter"><div className="chapter-heading"><Heart size={19}/><strong>집으로 오는 길</strong><span>{Math.min(q.step+1,5)} / 5</span></div><Progress value={q.step*20} aria-label="구출 진행"/><h3>{q.title}</h3><p>{q.text}</p><div className="rescue-actions"><Button disabled={!q.ready} onClick={()=>onAction(s.rescue())}>{q.label}</Button>{q.step===3&&<Button variant="outline" onClick={()=>onAction(s.rescue('river'))}>강변 우회 · 밀 16 · {remainingSeconds(100,s)}초</Button>}</div>{q.step===4&&q.remaining<=0&&!s.workerCount&&<small>건설 → 주거 → 주민 주택을 지으세요.</small>}</section>;}

export function CharterPanel({sim:s,onAction}:any){if(s.rank<5)return null;return <section className="charter-panel"><strong>사업 헌장</strong>{s.charter?<p>{(CHARTERS as any)[s.charter].name} · {(CHARTERS as any)[s.charter].text}</p>:<><p>이번 사업의 운영 원칙을 하나 채택합니다.</p><div>{Object.entries(CHARTERS).map(([id,v]:any)=><Button key={id} variant="outline" onClick={()=>onAction(s.chooseCharter(id))}><strong>{v.name}</strong><small>{v.text}</small></Button>)}</div></>}</section>;}
