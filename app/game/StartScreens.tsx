'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Volume2, VolumeX } from 'lucide-react';
import { SCREEN_BACKGROUNDS, WORK_ART } from './screen-art';

type Art = typeof WORK_ART[number];
const logo = '/assets/brand/towngrid-title.png';

function SceneImage({ src, className = '', fallback = SCREEN_BACKGROUNDS.loading }: { src: string; className?: string; fallback?: string }) {
  return <img className={'screen-scenery ' + className} src={src} alt="" draggable={false}
    onError={event => { const image = event.currentTarget; if (!image.dataset.fallback) { image.dataset.fallback = 'true'; image.src = fallback; } else image.style.opacity = '0'; }} />;
}

export function TitleScreen({ onEnter, muted, onSound }: { onEnter: () => void; muted: boolean; onSound: () => void }) {
  const enter = useRef<HTMLButtonElement>(null);
  useEffect(() => { enter.current?.focus({ preventScroll: true }); }, []);
  return <section className="front-screen title-screen" aria-label="타운그리드 대기 화면">
    <SceneImage src={SCREEN_BACKGROUNDS.waiting} />
    <button ref={enter} className="title-enter" onClick={onEnter} aria-label="화면을 눌러 시작">
      <img className="title-logo" src={logo} alt="타운그리드" />
      <span className="screen-button title-prompt">화면을 눌러 시작 <ArrowRight size={22} /></span>
    </button>
    <button className="screen-sound" aria-label={muted ? '소리 켜기' : '소리 끄기'} onClick={onSound}>{muted ? <VolumeX /> : <Volume2 />}</button>
  </section>;
}

type HomeProps = {
  saved: boolean; busy: boolean; muted: boolean;
  onContinue: () => void; onNew: () => void; onImport: () => void; onSettings: () => void;
  onStarter: () => void; onDemo: () => void; onSound: () => void; onTitle: () => void;
};
export function HomeScreen(props: HomeProps) {
  const [gallery, setGallery] = useState(false), [index, setIndex] = useState(0);
  const primary = useRef<HTMLButtonElement>(null);
  useEffect(() => { primary.current?.focus({ preventScroll: true }); }, []);
  if (gallery) return <section className="front-screen art-gallery" aria-label="마을의 하루">
    <SceneImage key={WORK_ART[index].id} src={WORK_ART[index].src} />
    <button autoFocus className="screen-back" onClick={() => setGallery(false)}><ArrowLeft size={18} /> 홈으로</button>
    <div className="gallery-controls"><button aria-label="이전 그림" onClick={() => setIndex((index + WORK_ART.length - 1) % WORK_ART.length)}><ChevronLeft /></button>
      <div aria-live="polite"><strong>{WORK_ART[index].title}</strong><span>{index + 1} / {WORK_ART.length}</span></div>
      <button aria-label="다음 그림" onClick={() => setIndex((index + 1) % WORK_ART.length)}><ChevronRight /></button></div>
  </section>;
  return <section className="front-screen home-screen" aria-label="타운그리드 홈 화면">
    <SceneImage src={SCREEN_BACKGROUNDS.home} />
    <div className="home-shade" />
    <div className="home-content">
      <img className="home-logo" src={logo} alt="타운그리드" />
      <nav className="home-menu" aria-label="게임 메뉴">
        <button ref={props.saved ? primary : undefined} className={'screen-button ' + (props.saved ? 'primary' : '')} disabled={!props.saved || props.busy} onClick={props.onContinue}>이어하기 <ArrowRight size={23} /></button>
        <button ref={!props.saved ? primary : undefined} className={'screen-button ' + (!props.saved ? 'primary' : '')} disabled={props.busy} onClick={props.onNew}>새 게임</button>
        <button className="screen-button" disabled={props.busy} onClick={props.onImport}>불러오기</button>
        <button className="screen-button" onClick={props.onSettings}>설정</button>
      </nav>
      <div className="home-extras"><button disabled={props.busy} onClick={props.onStarter}>초반 마을 테스트</button><button disabled={props.busy} onClick={props.onDemo}>산업도시 둘러보기</button><button onClick={() => setGallery(true)}>마을의 하루</button></div>
      <button className="home-to-title" onClick={props.onTitle}><ArrowLeft size={16} /> 대기 화면</button>
    </div>
    <button className="screen-sound" aria-label={props.muted ? '소리 켜기' : '소리 끄기'} onClick={props.onSound}>{props.muted ? <VolumeX /> : <Volume2 />}</button>
  </section>;
}

export function LoadingScreen({ art, onNext, label = '마을을 불러오는 중' }: { art?: Art | null; onNext?: () => void; label?: string }) {
  const surface = useRef<HTMLElement>(null);
  useEffect(() => { const previous = document.activeElement; surface.current?.focus({ preventScroll: true }); return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }); }; }, []);
  // Advance only when there really is a long load. Never delay gameplay to show art.
  useEffect(() => { if (!onNext) return; const timer = window.setInterval(onNext, 8000); return () => window.clearInterval(timer); }, [onNext]);
  return <section ref={surface} tabIndex={-1} onKeyDown={event => { if (event.key === 'Tab') event.preventDefault(); event.stopPropagation(); }} className="front-screen screen-loading" aria-label="로딩 화면" aria-busy="true" data-art={art?.id || 'town'}>
    <SceneImage key={art?.id || 'town'} src={art?.src || SCREEN_BACKGROUNDS.loading} />
    <img className="loading-emblem" src="/assets/brand/towngrid-icon-128.png" alt="" />
    <div className="loading-shade" />
    <div className="screen-loading-content">
      {art && <span className="loading-art-title">{art.title}</span>}
      <h1 role="status">{label}</h1>
      <div className="screen-loading-track" role="progressbar" aria-label={label}><span /></div>
      <p>{art?.tip || '생산 시설을 도로로 연결해 보세요.'}</p>
    </div>
  </section>;
}
