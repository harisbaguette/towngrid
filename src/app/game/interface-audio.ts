import type { RefObject, MouseEvent, PointerEvent } from 'react';

const controls = 'button,a[href],summary,select,[role="button"],[role="tab"],[role="switch"]';
function control(target: EventTarget | null) {
 const el = target instanceof Element ? target.closest(controls) : null;
 return el && !el.matches(':disabled,[aria-disabled="true"]') ? el : null;
}

// Click fires for pointer AND keyboard activation, and React portals bubble here too.
// Pointer down only unlocks audio: a drag or a disabled control does not click audibly.
export function interfaceAudio(audio: RefObject<any>) {
 return {
  onPointerDownCapture: () => { audio.current?.start(); },
  onClickCapture: (event: MouseEvent) => {
   const el=control(event.target);if(!el)return;
   const sound=el.getAttribute('data-sound');if(sound==='none')return;
   audio.current?.interact(sound || (el.getAttribute('role')==='tab'?'tab':el.tagName==='SUMMARY'?'tab':'click'));
  },
  onPointerOverCapture: (event: PointerEvent) => {
   if(event.pointerType!=='mouse')return;
   const el=control(event.target);if(!el||el===control(event.relatedTarget)||el.getAttribute('data-sound')==='none')return;
   // Never unlock autoplay from a hover; mute and the effects slider are checked by play().
   audio.current?.play('hover',{volume:.12});
  },
 };
}
