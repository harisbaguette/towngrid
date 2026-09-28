'use client';
import {ArrowRight,Check,Flag,Heart,Package,Truck,TriangleAlert} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Progress} from '@/components/ui/progress';
import {BUILDINGS,RESOURCES} from './simulation';
import {CHARTERS} from './progression';
import {productionDiagnosis} from './proximity';
import {unlockRank} from './world';
import {blockHint,crewHouse,exportBlocked,objectOf,promotionParts} from './ui-rules';

const B:any=BUILDINGS,R:any=RESOURCES;

export function Operations({sim:s,onAction,onFocus,onGoals,onTool,hidden}:any){
 const failures=s.buildings.filter((b:any)=>b.enabled!==false&&(b.health<100||blockHint(b.status)));
 const urgent=failures.find((b:any)=>b.health<=0||/경로|출입구|전력/.test(b.status))||failures[0];
 const house=urgent&&urgent.health>=100?crewHouse(urgent.status):null;
 const diagnostic=house?{text:objectOf(B[house].name)+' 지어 전담 주민을 맞이하세요.',tool:unlockRank(house)<=s.rank?house:null,focus:urgent.id}:urgent?productionDiagnosis(s,urgent,BUILDINGS,RESOURCES):null;const c=s.contract(),ready=s.availableStock(c.item)>=c.amount;
 const promotion=s.promotion(),exported=exportBlocked(s),blocker=promotionParts(s,promotion).find((v:any)=>!v.done);
 return <>
 {s.health.infection>0&&<aside className="health-alert panel" role="status"><Heart size={18}/><div><strong>감염 {Math.ceil(s.health.infection)}%</strong><span>{s.health.sanitationUntil>s.time?'방역 중 · '+Math.ceil(s.health.sanitationUntil-s.time)+'초':s.stage>=15?'병원에 의약품 공급':s.rank>=unlockRank('clinic')?'진료소를 가동하세요':'방역으로 확산을 늦추세요'}</span></div><button onClick={()=>onAction(s.sanitize())}>방역</button></aside>}
 {!hidden&&s.warehouse&&<aside className="operations-card panel">
 {exported?<button className="bottleneck export-blocked" onClick={()=>onFocus(s.warehouse.id)}><TriangleAlert size={17}/><span><strong>수출길 막힘{exported.auto?' · 자동 판매 멈춤':''}</strong><small>{exported.error}</small></span><ArrowRight size={15}/></button>
 :urgent?<button className="bottleneck" onClick={()=>diagnostic?.tool?onTool(diagnostic.tool):onFocus(diagnostic?.focus||urgent.id)}><TriangleAlert size={17}/><span><strong>{B[urgent.type].name} · {urgent.status}</strong><small>{diagnostic?.text||'시설을 수리하세요.'}</small></span><ArrowRight size={15}/></button>:<div className="network-ok"><Check size={16}/>생산망 연결됨<span><Truck size={14}/>{s.workers.filter((w:any)=>w.task).length}명 운반</span></div>}
 <div className="quick-contract"><Package size={18}/><div><strong>{R[c.item]?.name} 납품</strong><span>{Math.floor(s.availableStock(c.item))} / {c.amount} · {c.reward}G</span></div><Button size="sm" disabled={!ready} onClick={()=>onAction(s.fulfill())}>납품</Button></div>
 {promotion?.ready?<button className="promotion-ready" onClick={onGoals}><Flag size={16}/>{promotion.name} 승급 가능<ArrowRight size={14}/></button>
 :promotion&&<button className="next-goal" onClick={onGoals} aria-label={'다음 승급 '+promotion.name}><Flag size={15}/><span><strong>{promotion.name}</strong>{blocker&&<small>{blocker.label} {blocker.current.toLocaleString('ko-KR')}/{blocker.target.toLocaleString('ko-KR')}{blocker.unit||''}</small>}</span><ArrowRight size={14}/></button>}
 </aside>}
 </>;
}


export function RescuePanel({sim:s,onAction}:any){const q=s.rescueInfo();return <section className="rescue-chapter"><div className="chapter-heading"><Heart size={19}/><strong>집으로 오는 길</strong><span>{Math.min(q.step+1,5)} / 5</span></div><Progress value={q.step*20}/><h3>{q.title}</h3><p>{q.text}</p><div className="rescue-actions"><Button disabled={!q.ready} onClick={()=>onAction(s.rescue())}>{q.label}</Button>{q.step===3&&<Button variant="outline" onClick={()=>onAction(s.rescue('river'))}>강변 우회 · 밀 16 · 100초</Button>}</div>{q.step===4&&q.remaining<=0&&!s.workerCount&&<small>건설 → 주거 → 주민 주택을 지으세요.</small>}</section>;}

export function CharterPanel({sim:s,onAction}:any){if(s.rank<5)return null;return <section className="charter-panel"><strong>사업 헌장</strong>{s.charter?<p>{(CHARTERS as any)[s.charter].name} · {(CHARTERS as any)[s.charter].text}</p>:<><p>이번 사업의 운영 원칙을 하나 채택합니다.</p><div>{Object.entries(CHARTERS).map(([id,v]:any)=><Button key={id} variant="outline" onClick={()=>onAction(s.chooseCharter(id))}><strong>{v.name}</strong><small>{v.text}</small></Button>)}</div></>}</section>;}
