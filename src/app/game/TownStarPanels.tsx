'use client';
// Panels for the Town Star layer (docs/TOWNSTAR_RULES.md 2026-10-03): the daily star goal, the weekly league, the festival
// season and gifts to neighbours (league.js), and hauling gear with stock caps (logistics.js) on the 운반·보관 page.
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Progress} from '@/components/ui/progress';
import {Gift,PartyPopper,Star,Trophy,Truck,Warehouse} from 'lucide-react';
import ResourceIcon from './ResourceIcon';
import {RESOURCES} from './simulation';
import {NATIONS} from './world';
import {DAILY,LEAGUE_PRIZE,LEAGUE_BASE,LEAGUE_PER_RANK,WEEK_DAYS,GIFT,seasonOf,standings,giftShort} from './league';
import {HAUL_GEAR,haulLoad} from './logistics';
import '../townstar.css';

const R=RESOURCES as any,N=NATIONS as any;
const num=(n:number)=>Math.round(n).toLocaleString('ko-KR');

export function LeaguePanel({campaign:c,onAction}:any){
 const l=c?.league;const s=c?.active;
 const neighbours=Object.keys(N).filter(id=>id!==s?.nation&&(c?.relations?.[id]??0)>0);
 const goods=s?Object.keys(R).filter(id=>s.availableStock(id)>=1).sort((a,b)=>R[b].price-R[a].price):[];
 const [nation,setNation]=useState(neighbours[0]||'');const [item,setItem]=useState(goods[0]||'');
 if(!l||!s)return <p>캠페인에서만 열립니다.</p>;
 const d=l.daily,done=Math.max(0,l.total-d.from),table=standings(c),place=table.findIndex((v:any)=>v.player)+1;
 const left=WEEK_DAYS-((c.lastWorldDay-1)%WEEK_DAYS),season=seasonOf(c.lastWorldDay),base=LEAGUE_BASE+LEAGUE_PER_RANK*c.rank;
 const target=neighbours.includes(nation)?nation:neighbours[0],good=goods.includes(item)?item:goods[0];
 const why=target&&good?giftShort(c,target,good):'보낼 이웃 나라나 물건이 없습니다';
 return <div className="league-panel">
  <section className="league-card daily" aria-label="오늘의 도전">
   <header><Star size={17}/><strong>오늘의 도전</strong><span>{d.done?'달성':'별 '+num(Math.min(done,d.goal))+' / '+num(d.goal)}</span></header>
   <Progress value={Math.min(100,done/d.goal*100)}/>
   <small>상품을 팔거나 납품하면 별을 받습니다(목록가 10G마다 1개, 납품은 1.5배). 달성하면 {num(Math.round(d.goal*DAILY.pay))}G를 받습니다. 연속으로 달성하면 다음 목표가 하루 8%씩(최대 6일) 오르고, 놓치면 다시 낮아집니다.{d.streak>1?' · 연속 '+d.streak+'일':''}</small>
  </section>
  <section className="league-card season" aria-label="계절 축제">
   <header><PartyPopper size={17}/><strong>{season.name}</strong><span>{left}일 남음</span></header>
   <div className="season-goods">{Object.entries(season.goods).map(([id,f]:any)=><span key={id}><ResourceIcon name={id} size={16}/>{R[id].name} <b>+{Math.round((f-1)*100)}%</b></span>)}</div>
  </section>
  <section className="league-card" aria-label="주간 교역 순위">
   <header><Trophy size={17}/><strong>{l.week}주차 교역 순위</strong><span>{place}위 · {left}일 남음</span></header>
   <table className="league-table"><thead><tr><th>순위</th><th>상회</th><th>별</th><th>상금</th></tr></thead><tbody>{table.map((v:any,i:number)=><tr key={v.id} className={v.player?'player':''}><td>{i+1}</td><td>{v.name}</td><td>{num(v.score)}</td><td>{LEAGUE_PRIZE[i]?num(LEAGUE_PRIZE[i]*base)+'G':'—'}</td></tr>)}</tbody></table>
   {l.history.length>0&&<small>지난 주: {l.history.slice(-4).reverse().map((h:any)=>h.week+'주차 '+h.place+'위'+(h.prize?' +'+num(h.prize)+'G':'')).join(' · ')}</small>}
  </section>
  <section className="league-card gift" aria-label="이웃 나라 선물">
   <header><Gift size={17}/><strong>이웃 나라 선물</strong><span>{GIFT.wait}초마다 1개</span></header>
   <div className="gift-form">
    <select aria-label="받을 나라" value={target||''} onChange={e=>setNation(e.target.value)}>{neighbours.map(id=><option key={id} value={id}>{N[id].name} · 관계 {Math.round(c.relations[id])}</option>)}</select>
    <select aria-label="보낼 물건" value={good||''} onChange={e=>setItem(e.target.value)}>{goods.slice(0,40).map(id=><option key={id} value={id}>{R[id].name} · {num(s.availableStock(id))}개</option>)}</select>
    <Button size="sm" disabled={!!why} onClick={()=>onAction(c.giftNeighbor(target,good))}>선물 보내기</Button>
   </div>
   <small>{why||'관계가 오르고 별을 받습니다. 관계 60·75·90에 처음 닿으면 답례금을 받습니다.'}</small>
  </section>
 </div>;
}

const CAPS=[0,50,100,200,400];
export function HaulPanel({sim:s,onAction}:any){
 const offer=s.haulGearOffer?.(),load=haulLoad(s)*(s.automatic?2:1);
 // The cap is this site's (Simulation.stockCap) and only stops this site's pickups: its own products, and any good still
 // capped here so the cap can be lifted.
 const made=[...new Set([...s.buildings.map((b:any)=>s.recipeOf(b)?.output),...Object.keys(s.stockCap||{})])].filter((id:any)=>R[id]).sort((a:any,b:any)=>R[a].price-R[b].price);
 return <div className="haul-panel">
  <section className="league-card" aria-label="운반 장비">
   <header><Truck size={17}/><strong>운반 장비</strong><span>한 번에 {load}개</span></header>
   <ol className="gear-steps">{HAUL_GEAR.map((g,i)=><li key={g.id} className={(s.haulGear||0)>i?'owned':''}><b>{g.name}</b><small>{g.load}개씩 · {g.money.toLocaleString('ko-KR')}G · {Object.entries(g.items).map(([r,n]:any)=>R[r].name+' '+n).join(' · ')}</small></li>)}</ol>
   {offer?<Button size="sm" disabled={!!offer.error} onClick={()=>onAction(s.buyHaulGear())}>{offer.name} 들이기{offer.error?' · '+offer.error:''}</Button>:<small>모든 장비를 갖췄습니다.</small>}
  </section>
  <section className="league-card" aria-label="보관 상한">
   <header><Warehouse size={17}/><strong>보관 상한</strong><span>넘으면 시설에 둡니다</span></header>
   <small>창고 재고가 상한에 닿은 상품은 주민이 더 나르지 않습니다. 생산 시설은 완성품이 차면 쉽니다.</small>
   <div className="cap-list">{made.map((id:any)=><label key={id}><ResourceIcon name={id} size={16}/><span>{R[id].name}<small> · {num(s.stock[id]||0)}개</small></span><select aria-label={R[id].name+' 보관 상한'} value={s.stockCap?.[id]||0} onChange={e=>onAction(s.setStockCap(id,+e.target.value))}>{CAPS.map(n=><option key={n} value={n}>{n?n+'개':'제한 없음'}</option>)}</select></label>)}{!made.length&&<span>아직 만드는 상품이 없습니다.</span>}</div>
  </section>
 </div>;
}
