'use client';
import {readPlaytests} from './playtest-diary';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
export default function PlaytestResults(){
 const [records]=useState(()=>readPlaytests(localStorage));
 const download=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(records,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='towngrid-playtest.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return <div><p>이 브라우저에서 새로 시작한 게임의 첫 건설·첫 판매·승급·메뉴 발견 시간을 기록합니다. 화면을 떠난 시간은 제외하며 서버에 보내지 않습니다. 한 사람이 여러 번 한 기록을 서로 다른 사람의 결과로 세지 마세요.</p>{!records.length&&<p>새 게임을 시작하면 기록됩니다.</p>}{records.map((r:any)=><details key={r.started}><summary>{new Date(r.started).toLocaleString('ko-KR')} · {(r.visibleMs/60000).toFixed(1)}분 · {r.lastRank+1}단계</summary><ul>{r.milestones.map((m:any,i:number)=><li key={i}>{m.kind==='first-build'?'첫 건설':m.kind==='first-sale'?'첫 판매':m.value+'단계'} · {(m.seconds/60).toFixed(1)}분</li>)}</ul></details>)}<Button disabled={!records.length} onClick={download}>점검 기록 내려받기</Button></div>;
}
