'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArtworkGallery, HomeScreen, LoadingScreen, ScreenTransition, TitleScreen, ScreenError } from '../game/StartScreens';
import { createArtworkPicker, transitionArtwork, WORK_ART } from '../game/screen-art';
import { GameAudio } from '../game/audio';
import { interfaceAudio } from '../game/interface-audio';
import { screenAmbience } from '../game/screen-motion';

// The same components as the game, without initializing or saving a simulation.
export default function ScreenPreview() {
  const [mode, setMode] = useState('gallery'), [muted, setMuted] = useState(true);
  const [homeVisit, setHomeVisit] = useState(0);
  const [homeGallery, setHomeGallery] = useState(false);
  const audio = useRef<any>(null), [ambience,setAmbience] = useState('river');
  const onArtChange = useCallback((src:string)=>setAmbience(screenAmbience(src)),[]);
  useEffect(()=>{const a=audio.current=new GameAudio();a.muted=true;a.paused=true;const hide=()=>{if(document.hidden)a.suspend();};document.addEventListener('visibilitychange',hide);return()=>{document.removeEventListener('visibilitychange',hide);a.dispose();};},[]);
  const toggleSound=()=>{const value=!muted;setMuted(value);audio.current?.setMuted(value);audio.current?.start();};
  const [art, setArt] = useState<typeof WORK_ART[number]>(transitionArtwork('restore'));
  useEffect(()=>{audio.current?.setPresentation(mode==='title'?'evening':mode==='loading'||mode==='transition'?screenAmbience(art.src):ambience);},[mode,art.src,ambience]);
  useEffect(()=>{audio.current?.setInterface(mode==='transition'?'loading':mode==='home'&&homeGallery?'gallery':mode);},[mode,homeGallery]);
  const picker = useRef<ReturnType<typeof createArtworkPicker> | null>(null);
  const next = useCallback(() => {
    if (!picker.current) picker.current = createArtworkPicker(null);
    setArt(picker.current()!);
  }, []);
  const load = () => { setArt(transitionArtwork('restore'));setMode('loading'); };
  const transition = () => { setArt(transitionArtwork('world'));setMode('transition'); };
  return <div {...interfaceAudio(audio)}>
    <nav aria-label="화면 미리보기" style={{ position: 'fixed', inset: '0 0 auto', height: 44, zIndex: 1005, display: 'flex', alignItems: 'center', gap: 16, overflowX: 'auto', whiteSpace: 'nowrap', padding: '0 16px', background: '#fff3d2', color: '#143b40', fontSize: 12 }}>
      <strong>화면 미리보기 · 게임 저장 안 함</strong>
      <button onClick={() => setMode('gallery')}>일상 그림</button><button onClick={() => { setHomeVisit(value => value + 1);setMode('home'); }}>홈 화면</button>
      <button onClick={() => setMode('title')}>대기 화면</button><button onClick={load}>로딩 화면</button><button onClick={transition}>전환 그림</button><button onClick={() => setMode('error')}>복구 화면</button><a href="/">게임으로</a>
    </nav>
    <main style={{ position: 'fixed', inset: '44px 0 0' }}>
      {mode === 'gallery' && <ArtworkGallery onArtChange={onArtChange} onBack={() => setMode('home')} />}
      {mode === 'home' && <HomeScreen onGalleryChange={setHomeGallery} key={homeVisit} saved={false} busy={false} muted={muted} onArtChange={onArtChange} onContinue={load} onNew={transition} onImport={load} onSettings={() => setMode('gallery')} onStarter={load} onDemo={load} onSound={toggleSound} onTitle={() => setMode('title')} />}
      {mode === 'title' && <TitleScreen muted={muted} onSound={toggleSound} onEnter={() => setMode('home')} />}
      {mode === 'loading' && <LoadingScreen art={art} onNext={next} label="로딩 화면 미리보기" />}
      {mode === 'transition' && <ScreenTransition art={art} label="시작할 땅을 고르는 중" onDone={() => setMode('gallery')} />}
      {mode === 'error' && <ScreenError title="화면 연결이 끊겼습니다" message="게임을 일시 정지했습니다. 잠시 뒤 복구를 시도합니다." onRetry={() => setMode('home')} onExport={() => JSON.stringify({ preview: true })} />}
    </main>
  </div>;
}
