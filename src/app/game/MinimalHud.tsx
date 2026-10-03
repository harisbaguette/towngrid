'use client';

import { useState } from 'react';
import { ArrowRight, ChevronDown, Coins, Menu, MoreHorizontal, Pause, Play, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import ResourceIcon from './ResourceIcon';
import type { Simulation } from './simulation';
import type { productionVisualState } from './production-visuals';
import { RESOURCES } from './simulation';
import { blockHint, hudResources } from './ui-rules';

const resources = RESOURCES as Record<string, {name: string}>;
type Building = {id: number; type: string; health: number; status: string; enabled?: boolean};
type Definition = {name: string; period?: number; home?: boolean};
type Production = ReturnType<typeof productionVisualState>;
type LiveSimulation = Omit<Simulation, 'stock'> & {stock: Record<string, number>};
const number = (value: number) => Math.floor(value || 0).toLocaleString('ko-KR');

export function MinimalHud({ sim: s, urgent, onDialog, onPause, onSpeed }: {
  sim: LiveSimulation; urgent: boolean; onDialog: (name: string) => void;
  onPause: () => void; onSpeed: (value: number) => void;
}) {
  const [open, setOpen] = useState<'stock' | 'speed' | null>(null);
  const show = (name: string) => { setOpen(null); onDialog(name); };
  return <header className="minimal-hud" aria-label="마을 상태">
    <div className="minimal-resources" aria-label="보유 자원">
      <button className="minimal-money" aria-label={'자금 ' + number(s.money) + 'G · 장부 열기'} title="장부" onClick={() => show('ledger')}><Coins size={22}/><strong>{number(s.money)}</strong></button>
      {['wood', 'stone'].map(id => <button key={id} aria-label={resources[id].name + ' ' + number(s.stock[id])} title={resources[id].name + ' · 시장'} onClick={() => show('trade')}><ResourceIcon name={id} size={23}/><strong>{number(s.stock[id])}</strong></button>)}
      <Popover open={open === 'stock'} onOpenChange={v => setOpen(v ? 'stock' : null)}>
        <PopoverTrigger asChild><button className="minimal-icon" aria-label="자원 펼치기"><ChevronDown size={20}/></button></PopoverTrigger>
        <PopoverContent className="minimal-popover stock-popover" align="start" onEscapeKeyDown={e => e.stopPropagation()}>
          <strong>주요 재고</strong><div className="minimal-stock-list">{hudResources(s.rank).map((id: string) => <button key={id} onClick={() => show('trade')}><ResourceIcon name={id} size={21}/><span>{resources[id].name}</span><b>{number(s.stock[id])}</b></button>)}</div>
          <button className="minimal-popover-link" onClick={() => show('trade')}>전체 재고·판매 <ArrowRight size={15}/></button>
        </PopoverContent>
      </Popover>
    </div>
    <div className="minimal-time" aria-label="시간과 메뉴">
      <span className="minimal-day" title="1배속에서 하루 2분 40초">{s.day}일째</span>
      <button className={'minimal-icon' + (s.paused ? ' is-paused' : '')} data-sound="none" aria-label={s.paused ? '재개' : '일시정지'} aria-pressed={s.paused} onClick={onPause}>{s.paused ? <Play size={18}/> : <Pause size={18}/>}</button>
      <Popover open={open === 'speed'} onOpenChange={v => setOpen(v ? 'speed' : null)}>
        <PopoverTrigger asChild><button className="minimal-speed" aria-label={'배속 선택 · 현재 ' + s.speed + '배속'}>{s.speed}×</button></PopoverTrigger>
        <PopoverContent className="minimal-popover speed-popover" align="end" onEscapeKeyDown={e => e.stopPropagation()}><div role="group" aria-label="게임 배속">{[1, 2, 4].map(speed => <button key={speed} aria-pressed={s.speed === speed} onClick={() => { onSpeed(speed); setOpen(null); }}>{speed}×</button>)}</div></PopoverContent>
      </Popover>
      <button className={'minimal-icon menu-trigger' + (urgent ? ' has-notice' : '')} aria-label="게임 메뉴" title={urgent ? '확인할 소식이 있습니다' : '게임 메뉴'} onClick={() => show('menu')}><Menu size={23}/>{urgent && <i aria-hidden/>}</button>
    </div>
  </header>;
}

export function MinimalFacilityDock({ sim: s, building: b, definition: d, production, onOperation, onDetails, onClose }: {
  sim: LiveSimulation; building: Building; definition: Definition; production: Production;
  onOperation: () => void; onDetails: () => void; onClose: () => void;
}) {
  const warning = b.health <= 0 || !!blockHint(b.status, s);
  const inputs = Object.keys(s.effectiveInputs(b));
  const canOperate = d.period || ['logistics', 'station', 'battery', 'clinic'].includes(b.type);
  return <aside className="minimal-facility minimal-bottom" aria-label={d.name + ' 운영'}>
    <div className="minimal-facility-name"><strong>{d.name}</strong><span className={warning ? 'is-warning' : b.enabled === false ? 'is-stopped' : ''}><i/>{b.enabled === false ? '가동 중지' : b.status}</span></div>
    {production ? <div className="minimal-production">
      <div className="minimal-recipe" aria-label={'생산품 ' + production.outputName}>{inputs.slice(0, 2).map(id => <ResourceIcon key={id} name={id} size={25}/>)}{inputs.length > 0 && <ArrowRight size={17}/>}<ResourceIcon name={production.output} size={27}/></div>
      <div className="minimal-meter"><Progress value={production.displayProgress * 100} aria-label="생산 진행"/><span><b>{Math.floor(production.displayProgress * 100)}%</b><small>{production.service ? production.outputName + ' ' + production.displayValue : '완성품 ' + production.displayValue + '개'}</small></span></div>
    </div> : <span className="minimal-facility-note">{['warehouse', 'depot'].includes(b.type) ? '재고와 운반 설정' : d.home ? '주민과 주택 정보' : '시설 정보'}</span>}
    <div className="minimal-facility-actions">{canOperate && <button aria-label={b.enabled === false ? '시설 가동' : '시설 가동 중지'} onClick={onOperation}>{b.enabled === false ? <Play size={17}/> : <Pause size={17}/>}<span>{b.enabled === false ? '가동' : '중지'}</span></button>}<button aria-label="시설 상세 정보" onClick={onDetails}><MoreHorizontal size={22}/><span>상세</span></button><button className="minimal-close" aria-label="시설 정보 닫기" onClick={onClose}><X size={21}/><kbd>Esc</kbd></button></div>
  </aside>;
}
