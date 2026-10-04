import {useState} from 'react';
import {practiceTrials,weeklyTrial,trialState,readTrialRecords,TRIAL_SAVE_KEY} from './industry-trials';
import {RESOURCES} from './simulation';
import {Button} from '@/components/ui/button';
import ResourceIcon from './ResourceIcon';
const hasTrial=()=>{try{return typeof window!=='undefined'&&!!localStorage.getItem(TRIAL_SAVE_KEY);}catch{return false;}};
export function IndustryTrials({onStart,onContinue}:any){
 const [records]=useState<any>(()=>{try{return readTrialRecords(localStorage);}catch{return {};}});
 return <div className="industry-trials"><p>같은 땅과 시작 물자로 생산 효율에 도전합니다. 시간은 게임을 진행할 때만 흐르며 캠페인 저장과 별도로 보관합니다. 주간 도전은 월요일 09시(한국 시간)에 바뀌며 이전 회차도 이어서 진행할 수 있습니다. 기록은 이 브라우저에 보관하며, 완료 후 온라인 메뉴에서 검증된 순위에 제출할 수 있습니다.</p>{hasTrial()&&<Button onClick={onContinue}>산업 도전 이어하기</Button>}{[weeklyTrial(),...practiceTrials().map(t=>({...t,location:''}))].filter(t=>t!==null).map(t=><article key={t.id}><ResourceIcon name={t.item} size={38}/><h3>{t.name}</h3><p>{t.text}</p>{t.condition&&<p>{t.condition.text}</p>}{t.location&&<p>{t.location} · 같은 회차는 같은 부지·물자·점수 규칙</p>}<p>제한 {(t.duration/80).toLocaleString('ko-KR',{maximumFractionDigits:1})}게임일 · 시작 {t.money.toLocaleString()}G</p>{records[t.id]&&<p>최고 {records[t.id].score}점 · 납품 {records[t.id].delivered}개</p>}<Button onClick={()=>onStart(t.id)}>{t.name} 시작</Button></article>)}</div>;
}
export function IndustryTrialStatus({campaign,onRetry,onList}:any){const t=trialState(campaign);if(!t)return null;return <section className="industry-trial-status" aria-label="산업 도전 현황"><strong>{t.name} · {t.status==='won'?'성공':t.status==='expired'?'시간 종료':'진행 중'}</strong><span>{(RESOURCES as any)[t.item].name} {t.delivered}/{t.target}개 · 남은 {(t.left/80).toFixed(1)}일{t.status!=='playing'&&' · '+t.score+'점'}</span><div>{t.status!=='playing'&&<Button size="sm" onClick={()=>onRetry(t.id)}>같은 도전 다시 시작</Button>}<Button size="sm" variant="outline" onClick={onList}>산업 도전 목록</Button></div></section>;}
