'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Volume2, VolumeX } from 'lucide-react';
import { SCREEN_BACKGROUNDS, WORK_ART, TRANSITION_ART, createHomeArtworkPicker, artworkThumbnail, warmArtwork } from './screen-art';
import { RESIDENT_LOOKS } from './resident-roster';
import ScreenMotion, { MotionToggle } from './ScreenMotion';

type Art = typeof WORK_ART[number];
const logo = '/assets/brand/towngrid-title.png';
const castNames = Object.fromEntries(Object.values(RESIDENT_LOOKS).flat().map(person => [person.id, person.name]));

function SceneImage({ src, className = '', fallback = SCREEN_BACKGROUNDS.loading }: { src: string; className?: string; fallback?: string }) {
  const imageRef = useRef<HTMLImageElement>(null);
  return <div className="screen-scene"><img key={'image:' + src} ref={imageRef} className={'screen-scenery ' + className} src={src} alt="" draggable={false}
    onError={event => { const image = event.currentTarget; if (!image.dataset.fallback) { image.dataset.fallback = 'true'; image.src = fallback; } else image.style.opacity = '0'; }} /><ScreenMotion key={'motion:' + src} imageRef={imageRef} src={src} /></div>;
}

export function ArtworkGallery({ onBack, initialId, onArtChange }: { onBack: () => void; initialId?: string; onArtChange?: (src: string) => void }) {
  const thumbnails = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState('전체'), [selected, setSelected] = useState(initialId || WORK_ART[0].id);
  const pool = filter === '화면 전환' ? TRANSITION_ART : WORK_ART.filter(art => filter === '전체' || art.category === filter);
  const art = pool.find(item => item.id === selected) || pool[0], index = pool.indexOf(art);
  useEffect(() => { onArtChange?.(art.src); }, [art.src, onArtChange]);
  const step = (delta: number) => setSelected(pool[(index + delta + pool.length) % pool.length].id);
  useEffect(() => { void warmArtwork(pool[(index + 1) % pool.length].src); }, [art.id, filter]);
  useEffect(() => { thumbnails.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [art.id]);
  return <section className="front-screen art-gallery" aria-label="마을의 하루" onKeyDown={event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault();event.currentTarget.querySelector<HTMLButtonElement>(`[data-gallery-step="${event.key === 'ArrowRight' ? 1 : -1}"]`)?.click(); }
    if (event.key === 'Escape') event.currentTarget.querySelector<HTMLButtonElement>('.screen-back')?.click();
  }}>
    <div className="gallery-top"><button autoFocus data-sound="close" className="screen-back" onClick={onBack}><ArrowLeft size={18} /> 홈으로</button>
      <nav className="gallery-filters" aria-label="그림 주제">{['전체', '생활', '자연', '산업', '화면 전환'].map(value => <button data-sound="tab" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}<span>{value === '화면 전환' ? TRANSITION_ART.length : WORK_ART.filter(item => value === '전체' || item.category === value).length}</span></button>)}</nav>
    </div>
    <div className="gallery-stage"><SceneImage src={art.src} /><MotionToggle /></div>
    <div className="gallery-controls"><button data-sound="tab" data-gallery-step="-1" aria-label="이전 그림" onClick={() => step(-1)}><ChevronLeft /></button>
      <div aria-live="polite"><strong>{art.title}</strong><span>{art.characters.map((id: string) => castNames[id]).filter(Boolean).join(' · ')}{art.characters.length > 0 ? '　' : ''}{index + 1} / {pool.length}</span></div>
      <button data-sound="tab" data-gallery-step="1" aria-label="다음 그림" onClick={() => step(1)}><ChevronRight /></button></div>
    <div ref={thumbnails} className="gallery-thumbnails" aria-label="그림 목록">{pool.map(item => <button data-sound="select" key={item.id} aria-label={item.title + ' 보기'} aria-pressed={item.id === art.id} onClick={() => setSelected(item.id)}>
      <img src={artworkThumbnail(item)} alt="" loading="lazy" draggable={false} /><span>{item.title}</span>
    </button>)}</div>
  </section>;
}

export function TitleScreen({ onEnter, muted, soundReady = true, onSound }: { onEnter: () => void; muted: boolean; soundReady?: boolean; onSound: () => void }) {
  const enter = useRef<HTMLButtonElement>(null);
  useEffect(() => { enter.current?.focus({ preventScroll: true }); }, []);
  return <section className="front-screen title-screen" aria-label="타운그리드 대기 화면">
    <SceneImage src={SCREEN_BACKGROUNDS.waiting} />
    <MotionToggle />
    <button ref={enter} data-sound="open" className="title-enter" onClick={onEnter} aria-label="화면을 눌러 시작">
      <img className="title-logo" src={logo} alt="타운그리드" />
      <span className="screen-button title-prompt">화면을 눌러 시작 <ArrowRight size={22} /></span>
    </button>
    <button data-sound="toggle" className="screen-sound" aria-label={muted || !soundReady ? '소리 켜기' : '소리 끄기'} title={muted || !soundReady ? '소리 켜기' : '소리 끄기'} onClick={onSound}>{muted || !soundReady ? <VolumeX /> : <Volume2 />}</button>
  </section>;
}

type HomeProps = {
  saved: boolean; busy: boolean; muted: boolean; soundReady?: boolean;
  onContinue: () => void; onNew: () => void; onImport: () => void; onSettings: () => void;
  onTrials?: () => void; onStarter: () => void; onDemo: () => void; onSound: () => void; onTitle: () => void;
  onCommunity?: () => void;
  onArtChange?: (src: string) => void;
  onGalleryChange?: (open: boolean) => void;
};
export function HomeScreen(props: HomeProps) {
  const [gallery, setGallery] = useState(false), [homeArt, setHomeArt] = useState<Art | null>(null);
  useEffect(() => { props.onGalleryChange?.(gallery);return () => props.onGalleryChange?.(false); }, [gallery, props.onGalleryChange]);
  const chosen = useRef<Art | null | undefined>(undefined);
  const primary = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (!gallery) props.onArtChange?.(homeArt?.src || SCREEN_BACKGROUNDS.home); }, [homeArt, gallery, props.onArtChange]);
  useEffect(() => { primary.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    let active = true;
    if (chosen.current === undefined) { let storage;try { storage = window.localStorage; } catch {} chosen.current = createHomeArtworkPicker(storage)() || null; }
    const art = chosen.current;
    if (art) void warmArtwork(art.src).then(loaded => { if (active && loaded) setHomeArt(art); });
    return () => { active = false; };
  }, []);
  if (gallery) return <ArtworkGallery initialId={homeArt?.id} onArtChange={props.onArtChange} onBack={() => { setGallery(false);requestAnimationFrame(() => primary.current?.focus()); }} />;
  return <section className={'front-screen home-screen' + (homeArt ? ' home-daily' : '')} aria-label="타운그리드 홈 화면" data-art={homeArt?.id || 'town'}>
    <SceneImage src={homeArt?.src || SCREEN_BACKGROUNDS.home} fallback={SCREEN_BACKGROUNDS.home} />
    <MotionToggle />
    <div className="home-shade" />
    <div className="home-content">
      <img className="home-logo" src={logo} alt="타운그리드" />
      <nav className="home-menu" aria-label="게임 메뉴">
        {(props.saved ? ['continue', 'new'] : ['new', 'continue']).map((action, index) => <button key={action} data-sound={action === 'continue' ? 'load' : 'open'} ref={index === 0 ? primary : undefined} className={'screen-button' + (index === 0 ? ' primary' : '')} disabled={props.busy || action === 'continue' && !props.saved} onClick={action === 'continue' ? props.onContinue : props.onNew}>{action === 'continue' ? '이어하기' : '새 게임'}{index === 0 && <ArrowRight size={20} />}</button>)}
        {props.onTrials&&<button className="screen-button" disabled={props.busy} onClick={props.onTrials}>산업 도전</button>}
        {props.onCommunity&&<button className="screen-button" disabled={props.busy} onClick={props.onCommunity}>온라인·서버 저장</button>}
        <button data-sound="load" className="screen-button" disabled={props.busy} onClick={props.onImport}>불러오기</button>
        <button data-sound="none" className="screen-button" onClick={props.onSettings}>설정</button>
      </nav>
      <div className="home-secondary"><button className="home-gallery" onClick={() => setGallery(true)}>마을의 하루 <ChevronRight size={15} /></button>
        <details className="home-extras"><summary>체험·점검 <ChevronDown size={15} aria-hidden /></summary>
          <div className="home-extras-list"><button disabled={props.busy} onClick={props.onDemo}>산업도시 둘러보기</button><button disabled={props.busy} onClick={props.onStarter}>초반 마을 테스트</button><a href="/art-preview.html">일러스트 테스트</a><a href="/biome-preview.html">지형 8종 테스트</a><a href="/world-effects-preview.html">환경·효과 컴포넌트</a><a href="/landforms-preview.html">지형 둘러보기</a></div>
        </details>
      </div>
      <button data-sound="close" className="home-to-title" onClick={props.onTitle}><ArrowLeft size={16} /> 대기 화면</button>
    </div>
    {homeArt && <button className="home-art-caption" onClick={() => setGallery(true)}>{homeArt.title} <ChevronRight size={15} /></button>}
    <button data-sound="toggle" className="screen-sound" aria-label={props.muted || props.soundReady === false ? '소리 켜기' : '소리 끄기'} title={props.muted || props.soundReady === false ? '소리 켜기' : '소리 끄기'} onClick={props.onSound}>{props.muted || props.soundReady === false ? <VolumeX /> : <Volume2 />}</button>
  </section>;
}

export function ScreenTransition({ art, label, onDone }: { art: Art; label: string; onDone: () => void }) {
  const done = useRef(onDone), surface = useRef<HTMLElement>(null);
  done.current = onDone;
  useEffect(() => {
    surface.current?.focus({ preventScroll: true });
    const timer = window.setTimeout(() => done.current(), 520);
    return () => window.clearTimeout(timer);
  }, []);
  return <section ref={surface} tabIndex={-1} className="front-screen screen-transition" aria-label="화면 전환" data-art={art.id} onClick={() => done.current()} onKeyDown={event => {
    event.stopPropagation();event.preventDefault();if (['Enter', 'Escape', ' '].includes(event.key)) done.current();
  }}>
    <SceneImage src={art.src} /><div className="loading-shade" /><p role="status">{label}</p>
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

export function ScreenError({ title, message, onRetry, onExport }: { title: string; message: string; onRetry: () => void; onExport?: () => string }) {
  const surface = useRef<HTMLElement>(null);
  const [download, setDownload] = useState<string | null>(null), [exportError, setExportError] = useState('');
  useEffect(() => { const previous = document.activeElement;surface.current?.focus({ preventScroll: true });return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }); }; }, []);
  useEffect(() => { if (!download) return;surface.current?.querySelector<HTMLAnchorElement>('a[download]')?.focus();return () => URL.revokeObjectURL(download); }, [download]);
  const prepareBackup = () => {
    try { const raw = onExport?.();if (!raw) throw new Error('저장할 진행이 없습니다.');setDownload(URL.createObjectURL(new Blob([raw], { type: 'application/json' })));setExportError(''); }
    catch (error) { setExportError(error instanceof Error ? error.message : '진행 파일을 만들지 못했습니다. 다시 시도해 주세요.'); }
  };
  return <section ref={surface} tabIndex={-1} className="front-screen screen-error" aria-label={title} onKeyDown={event => {
    event.stopPropagation();
    if (event.key === 'Tab') {
      const buttons = [...event.currentTarget.querySelectorAll<HTMLElement>('button,a[href]')];
      if (event.shiftKey && (document.activeElement === buttons[0] || document.activeElement === surface.current)) { event.preventDefault();buttons.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault();buttons[0]?.focus(); }
    }
  }}>
    <img className="error-logo" src={logo} alt="타운그리드" />
    <div className="screen-error-content"><div role="alert"><h1>{title}</h1><p>{message}</p></div>
      <div className="screen-error-actions">{onExport && (download ? <a className="screen-button" href={download} download={'towngrid-recovery-' + new Date().toISOString().slice(0, 10) + '.json'}>파일 저장 · JSON</a> : <button className="screen-button" onClick={prepareBackup}>진행 파일로 보관</button>)}<button className="screen-button primary" onClick={onRetry}>화면 다시 열기</button></div>
      {exportError && <p role="alert">{exportError}</p>}
    </div>
  </section>;
}
