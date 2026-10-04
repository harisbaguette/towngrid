'use client';
import { useEffect, useRef, useState } from 'react';
import { mountPreviewAudio } from '@/app/game/preview-audio.js';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, Coins, Factory, Hammer, Lock, Minus, Pause, Play, Plus, RotateCcw, RotateCw, Settings2, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { BuildingCard, GamePanel, ResourceCounter, StatusBadge } from '@/components/game-ui/industrial-kit';
import ResourceIcon from '@/app/game/ResourceIcon';

const palette = [
  ['에나멜', '--ui-metal', '#235F63'], ['강철', '--ui-metal-dark', '#153D42'],
  ['바탕', '--ui-paper', '#F1EDDF'], ['주 행동', '--ui-action', '#EE701B'],
  ['생산', '--ui-progress', '#1BB8A4'], ['위험', '--ui-danger', '#AD3D2C'],
];
export default function DesignSystemPage() {
  const previewSound=useRef<ReturnType<typeof mountPreviewAudio>|null>(null);
  useEffect(()=>{const p=mountPreviewAudio();previewSound.current=p;setSound(p.audio.volumes.effects>0);return ()=>{p.dispose();previewSound.current=null;};},[]);
  const [category, setCategory] = useState('production'), [selected, setSelected] = useState('lumber');
  const [running, setRunning] = useState(true), [sound, setSound] = useState(true), [speed, setSpeed] = useState('1×');
  const [dialog, setDialog] = useState(false);
  return <TooltipProvider><main className="design-system-page"><div className="ds-content">
    <header className="ds-header"><div><span className="ds-label">TOWNGRID · COMPONENTS</span><h1>산업 제어반</h1><p>타운그리드 디자인 시스템 · 버튼을 눌러 상태를 비교하세요.</p></div><Button asChild variant="secondary"><Link href="/"><ArrowLeft size={16}/>게임으로</Link></Button></header>
    <div className="ds-grid">
      <GamePanel title="버튼과 조작" icon={<Hammer size={19}/>}>
        <div className="ds-row"><Button onClick={()=>setDialog(true)}><Hammer/>건설</Button><Button variant="secondary" onClick={()=>setDialog(true)}><ShoppingBag/>판매</Button><Button variant="outline" onClick={()=>setDialog(true)}>상세 보기</Button></div>
        <div className="ds-row"><Button aria-pressed={running} variant="secondary" onClick={()=>setRunning(!running)}><Check/>{running?'선택됨':'선택'}</Button><Button disabled><Lock/>잠김</Button><Button variant="destructive" onClick={()=>setDialog(true)}>철거</Button></div>
        <div className="ds-row"><Button size="icon" variant="secondary" aria-label="왼쪽 회전"><RotateCcw/></Button><Button size="icon" variant="secondary" aria-label="오른쪽 회전"><RotateCw/></Button><Button size="icon" variant="secondary" aria-label="확대"><Plus/></Button><Button size="icon" variant="secondary" aria-label="축소"><Minus/></Button><Tooltip><TooltipTrigger asChild><Button size="icon" variant="outline" aria-label="도움말"><Settings2/></Button></TooltipTrigger><TooltipContent>목재가 부족합니다</TooltipContent></Tooltip></div>
        <p className="ds-note">주황색은 주 행동과 선택, 청록색은 보조 조작, 적색은 철거처럼 주의가 필요한 행동입니다.</p>
      </GamePanel>
      <GamePanel title="자원과 상태" icon={<Factory size={19}/>}>
        <div className="ds-row"><ResourceCounter icon={<Coins color="var(--ui-gold)" size={24}/>} label="골드" value="1,250" onClick={()=>setDialog(true)}/><ResourceCounter icon={<ResourceIcon name="wood" size={25}/>} label="목재" value={48} onClick={()=>setDialog(true)}/><ResourceCounter icon={<ResourceIcon name="stone" size={25}/>} label="석재" value={32} onClick={()=>setDialog(true)}/></div>
        <div className="ds-row"><StatusBadge>생산 중</StatusBadge><StatusBadge tone="warning">재료 부족</StatusBadge><StatusBadge tone="info">운반 대기</StatusBadge><StatusBadge tone="danger">수리 필요</StatusBadge></div>
        <div className="ds-row" role="group" aria-label="시간 조절">{['정지','1×','2×','4×'].map(s=><Button key={s} variant="secondary" aria-pressed={speed===s} onClick={()=>setSpeed(s)}>{s==='정지'?<Pause size={15}/>:s}</Button>)}</div>
        <div className="ds-row"><Switch id="sample-sound" checked={sound} onCheckedChange={v=>{setSound(v);previewSound.current?.audio.setVolume('effects',v?.85:0);}}/><label htmlFor="sample-sound">효과음 {sound?'켜짐':'꺼짐'}</label></div>
      </GamePanel>
      <GamePanel title="건설 목록" icon={<Hammer size={19}/>}>
        <Tabs value={category} onValueChange={setCategory}><TabsList aria-label="건설 분류"><TabsTrigger value="basic">기초</TabsTrigger><TabsTrigger value="production">생산</TabsTrigger><TabsTrigger value="transport">운송</TabsTrigger></TabsList></Tabs>
        <div className="ds-building-cards">
          <BuildingCard name="우물" image="/assets/pixel-environment/well-icon.png" price={<><Coins size={14}/>60</>} selected={selected==='well'} onClick={()=>setSelected('well')}/>
          <BuildingCard name="벌목장" image="/assets/pixel-environment/lumber-icon.png" price={<><Coins size={14}/>90</>} selected={selected==='lumber'} onClick={()=>setSelected('lumber')}/>
          <BuildingCard name="제재소" image="/assets/pixel-environment/sawmill-icon.png" price={null} locked lockReason="승급 시 열림"/>
        </div><p className="ds-selected-note" aria-live="polite">{selected==='well'?'우물':'벌목장'} 선택됨 · 견본 수치는 게임 진행에 영향을 주지 않습니다.</p>
      </GamePanel>
      <GamePanel title="시설 운영" icon={<Factory size={19}/>}>
        <div className="ds-production"><img src="/assets/pixel-environment/sawmill-icon.png" alt="제재소"/><div><h3>제재소</h3><StatusBadge tone={running?'success':'neutral'}>{running?'생산 중':'가동 중지'}</StatusBadge></div></div>
        <div className="ds-recipe"><ResourceIcon name="wood" size={32}/><b>목재 12</b><ArrowRight size={20}/><ResourceIcon name="plank" size={32}/><b>판재 8</b></div>
        <Progress value={65} aria-label="생산 진행"/><div className="ds-progress-label"><span>65%</span><span>00:18</span></div>
        <Button variant={running?'secondary':'default'} onClick={()=>setRunning(!running)}>{running?<Pause size={16}/>:<Play size={16}/>} {running?'가동 중지':'생산 재개'}</Button>
      </GamePanel>
    </div>
    <div className="ds-colors">{palette.map(([label,token,hex])=><div className="ds-swatch" key={token}><i style={{background:'var('+token+')'}}/><strong>{label}</strong><small>{hex}</small></div>)}</div>
    <p className="ds-note">기본 간격 4px · 테두리 2px · 모서리 3px · 기본 조작 높이 40px · 키보드 Tab으로 이동 · 동작 줄이기 지원</p>
    <Dialog open={dialog} onOpenChange={setDialog}><DialogContent className="game-dialog town-dialog"><DialogTitle>시설 건설</DialogTitle><DialogDescription>재료를 확인한 뒤 건설을 시작하세요. 이 창은 디자인 확인용입니다.</DialogDescription><div className="ds-row"><ResourceCounter icon={<Coins size={22}/>} label="건설 비용" value={90}/><StatusBadge>건설 가능</StatusBadge></div><div className="ds-row"><Button onClick={()=>setDialog(false)}><Hammer size={16}/>건설</Button><Button variant="outline" onClick={()=>setDialog(false)}>취소</Button></div></DialogContent></Dialog>
  </div></main></TooltipProvider>;
}
