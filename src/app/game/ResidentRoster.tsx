'use client';
import { useState } from 'react';
import { RACES } from './world';
import { genderLabel } from './resident-roster';
import { pixelIdentity } from './pixel-character-data';
import CharacterSprite from './CharacterSprite';
import { pixelMetadata } from './pixel-character-meta';

export default function ResidentRoster({ workers, resources }: { workers: any[]; resources: Record<string, any> }) {
 const [selected, setSelected] = useState<number | null>(null);
 const [action, setAction] = useState('idle');
 const [playback, setPlayback] = useState(0);
 const [direction, setDirection] = useState(3);
 const worker = workers.find(w => w.id === selected) || workers[0];
 if (!worker) return null;
 const identity = pixelIdentity(worker.race, worker.id, worker.appearance);
 const portraitAnimation = pixelMetadata.get(identity.id)?.portraitAnimation;
 const portraitSource = portraitAnimation ? identity.portrait.replace('portrait.png',portraitAnimation.file) : identity.portrait;
 const duty = (w: any) => w.staff ? `${w.workplaceName || ''} · ${w.jobTitle} · ${w.duty}` : w.attacking ? '경비 중' : w.task ? `${resources[w.task.item]?.name || ''} 운반` : w.atHome ? '집에서 휴식' : w.phase==='home' ? '집으로 돌아가는 중' : '일반 일꾼 · 대기';
 const description = (race: string, gender: string) => (RACES as any)[race].name + (gender === 'neutral' ? '' : ` · ${genderLabel(gender)}`);
 return <>
  <div className="resident-profile">
   <picture>
    <source media="(prefers-reduced-motion: reduce)" srcSet={identity.portrait} />
    <img className="resident-illustration" src={portraitSource} alt={`${worker.name || identity.name} 일러스트`} />
   </picture>
   <div className="resident-profile-info">
    <strong>{worker.name || identity.name}</strong>
    <span>{description(worker.race, identity.gender)}</span>
    <span className="resident-current-duty">{duty(worker)}</span>
    <CharacterSprite key={`${identity.id}-${playback}`} race={worker.race} appearance={identity.id} action={action} direction={direction} label={`${worker.name || identity.name} 동작`} className="resident-preview" />
    <div className="resident-directions" aria-label="바라보는 방향">
     {[{ i: 1, text: '↖', name: '왼쪽 뒤' }, { i: 2, text: '↗', name: '오른쪽 뒤' }, { i: 0, text: '↙', name: '왼쪽 앞' }, { i: 3, text: '↘', name: '오른쪽 앞' }].map(d => <button key={d.i} aria-label={d.name} aria-pressed={direction === d.i} onClick={() => setDirection(d.i)}>{d.text}</button>)}
    </div>
   </div>
  </div>
  <div className="resident-actions" aria-label="캐릭터 동작">
   {[['idle', '대기'], ['walk', '걷기'], ['carry', '운반'], ['work', '작업'], ['attack', '공격'], ...(pixelMetadata.get(identity.id)?.clips?.greet ? [['pickup', '들기'], ['drop', '놓기'], ['greet', '인사']] : []), ...(pixelMetadata.get(identity.id)?.clips?.hurt ? [['hurt','피격'],['defeat','쓰러짐'],['turn','회전']] : [])].map(([id, name]) => <button key={id} aria-pressed={action === id} onClick={() => { setAction(id); setPlayback(n => n + 1); }}>{name}</button>)}
  </div>
  <div className="resident-list pixel-resident-list">{workers.map(w => {
   const look = pixelIdentity(w.race, w.id, w.appearance);
   return <button key={w.id} className="resident-choice" aria-pressed={worker.id === w.id} onClick={() => setSelected(w.id)}>
    <img className="resident-portrait" src={look.portrait} alt="" />
    <span><strong>{w.name || look.name}</strong><small>{description(w.race, look.gender)}<span className="resident-duty">{duty(w)}</span></small></span>
   </button>;
  })}</div>
 </>;
}
