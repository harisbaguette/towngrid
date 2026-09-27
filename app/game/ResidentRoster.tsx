'use client';
import { useState } from 'react';
import { RACES } from './world';
import { genderLabel } from './resident-roster';
import { pixelIdentity } from './pixel-character-data';
import CharacterSprite from './CharacterSprite';

export default function ResidentRoster({ workers, resources }: { workers: any[]; resources: Record<string, any> }) {
 const [selected, setSelected] = useState<number | null>(null);
 const [action, setAction] = useState('idle');
 const [direction, setDirection] = useState(3);
 const worker = workers.find(w => w.id === selected) || workers[0];
 if (!worker) return null;
 const identity = pixelIdentity(worker.race, worker.id, worker.appearance);
 const duty = (w: any) => w.attacking ? '경비 중' : w.task ? `${resources[w.task.item]?.name || ''} 운반` : '대기';
 const description = (race: string, gender: string) => (RACES as any)[race].name + (gender === 'neutral' ? '' : ` · ${genderLabel(gender)}`);
 return <>
  <div className="resident-profile">
   <img className="resident-illustration" src={identity.portrait} alt={`${worker.name || identity.name} 일러스트`} />
   <div className="resident-profile-info">
    <strong>{worker.name || identity.name}</strong>
    <span>{description(worker.race, identity.gender)}</span>
    <span className="resident-current-duty">{duty(worker)}</span>
    <CharacterSprite race={worker.race} appearance={identity.id} action={action} direction={direction} label={`${worker.name || identity.name} 동작`} className="resident-preview" />
    <div className="resident-directions" aria-label="바라보는 방향">
     {[{ i: 1, text: '↖', name: '왼쪽 뒤' }, { i: 2, text: '↗', name: '오른쪽 뒤' }, { i: 0, text: '↙', name: '왼쪽 앞' }, { i: 3, text: '↘', name: '오른쪽 앞' }].map(d => <button key={d.i} aria-label={d.name} aria-pressed={direction === d.i} onClick={() => setDirection(d.i)}>{d.text}</button>)}
    </div>
   </div>
  </div>
  <div className="resident-actions" aria-label="캐릭터 동작">
   {[['idle', '대기'], ['walk', '걷기'], ['carry', '운반'], ['work', '작업'], ['attack', '공격']].map(([id, name]) => <button key={id} aria-pressed={action === id} onClick={() => setAction(id)}>{name}</button>)}
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
