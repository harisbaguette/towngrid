'use client';
import {tradeDestinations,tradeJourney,chooseTradeDestination,MODE_NAMES,worldLegMode} from './trade-journey';
import {RESOURCES} from './simulation';
import {remainingSeconds} from './game-time';
const art:any={road:'cargoTruckEmpty',ship:'cargoShip',rail:'cargoTrainEmpty',air:'cargoPlane'};
function position(route:number[][],progress:number){const n=Math.max(0,Math.min(route.length-1,progress*(route.length-1))),i=Math.floor(n),a=route[i],b=route[Math.min(i+1,route.length-1)];return [(a[0]+(b[0]-a[0])*(n-i)+.5)*26,(a[1]+(b[1]-a[1])*(n-i)+.5)*26];}
export default function TradeJourneyPanel({sim:s,onAction}:any){
 const t=s.tradeConnection(),journey=tradeJourney(s,t),options=tradeDestinations(s,t),route=journey.worldRoute as number[][];
 if(!route.length)return <p role="status">교역 도시로 연결되는 경로가 없습니다.</p>;
 const vehicles=s.shipments.filter((sh:any)=>sh.away&&sh.worldRoute?.length),points=route.map(p=>[(p[0]+.5)*26,(p[1]+.5)*26]);
 return <div className="trade-journey"><label>교역 도시<select aria-label="교역 도시" value={journey.destinationId} onChange={e=>onAction(chooseTradeDestination(s,e.target.value))}>{options.map((o:any)=><option key={o.destinationId} value={o.destinationId}>{o.destination} · 편도 {remainingSeconds(o.duration,s)}초 · {o.fuel}개</option>)}</select></label>
  <p>{(MODE_NAMES as any)[journey.mode]} · {journey.distance}칸 · 왕복 {(RESOURCES as any)[journey.fuelItem].name} {journey.fuel}개</p>
  <p>도시별 품목 수요는 5일마다 바뀝니다. 원거리 운송 보너스는 최대 30%이며 출발할 때 가격이 확정됩니다.</p>
  <details><summary>운송 경로 보기</summary><svg viewBox="0 0 1300 806" role="img" aria-label={journey.destination+'까지의 운송 경로'} style={{width:'100%',maxHeight:210,background:'#c8ddc3',borderRadius:8}}><image href="/assets/world-atlas/terrain.webp" width="1300" height="806"/><polyline points={points.map(p=>p.join(',')).join(' ')} fill="none" stroke="#fff" strokeWidth="12"/><polyline points={points.map(p=>p.join(',')).join(' ')} fill="none" stroke="#ab572a" strokeWidth="5"/><circle cx={points[0][0]} cy={points[0][1]} r="12" fill="#f4c55a"/><circle cx={points.at(-1)![0]} cy={points.at(-1)![1]} r="12" fill="#ab572a"/>{vehicles.map((sh:any)=>{const progress=sh.away==='out'?1-sh.remaining/sh.duration:sh.remaining/sh.duration,[x,y]=position(sh.worldRoute,progress);return <image key={sh.id} href={'/assets/pixel-environment/'+art[worldLegMode(sh,progress)]+'-icon.png'} x={x-30} y={y-45} width="60" height="60"><title>{sh.destination} · {sh.amount}개</title></image>;})}</svg></details>
 </div>;
}
