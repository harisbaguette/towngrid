import type { RefObject, MouseEvent, PointerEvent, KeyboardEvent, FormEvent } from 'react';

const controls = 'button,a[href],summary,select,[role="button"],[role="tab"],[role="switch"]';
function control(target: EventTarget | null) {
 const el = target instanceof Element ? target.closest(controls) : null;
 return el && !el.matches(':disabled,[aria-disabled="true"]') ? el : null;
}

// Click fires for pointer AND keyboard activation, and React portals bubble here too.
// Pointer down only unlocks audio: a drag or a disabled control does not click audibly.
export function interfaceAudio(audio: RefObject<any>) {
 const unlock = (target: EventTarget | null) => {
  // The sound toggle reads the playback state itself; unlocking first would turn its first click into mute.
  if (control(target)?.getAttribute('data-sound') !== 'toggle') audio.current?.start();
 };
 return {
  onPointerDownCapture: (event: PointerEvent) => { unlock(event.target); },
  onKeyDownCapture: (event: KeyboardEvent) => {
   if (!event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) unlock(event.target);
  },
  onClickCapture: (event: MouseEvent) => {
   const el=control(event.target);if(!el)return;
   const sound=el.getAttribute('data-sound');if(sound==='none'||sound==='toggle')return;
   if(el.tagName==='SELECT')return;
   audio.current?.interact(sound || (el.getAttribute('role')==='tab'?'tab':el.tagName==='SUMMARY'?'tab':'click'));
  },
  onChangeCapture: (event: FormEvent) => {
   const el=event.target;
   if(el instanceof HTMLSelectElement && !el.disabled && !['none','toggle'].includes(el.getAttribute('data-sound')||''))audio.current?.interact('select');
  },
  onPointerOverCapture: (event: PointerEvent) => {
   if(event.pointerType!=='mouse')return;
   const el=control(event.target);if(!el||el===control(event.relatedTarget)||['none','toggle'].includes(el.getAttribute('data-sound')||''))return;
   // Never unlock autoplay from a hover; mute and the effects slider are checked by play().
   audio.current?.play('hover',{volume:.12});
  },
 };
}
