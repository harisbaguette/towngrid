'use client';
import { useCallback, useRef, useState } from 'react';
import { ArtworkGallery, HomeScreen, LoadingScreen, ScreenTransition, TitleScreen } from '../game/StartScreens';
import { createArtworkPicker, transitionArtwork, WORK_ART } from '../game/screen-art';

// The same components as the game, without initializing or saving a simulation.
export default function ScreenPreview() {
  const [mode, setMode] = useState('gallery'), [muted, setMuted] = useState(true);
  const [homeVisit, setHomeVisit] = useState(0);
  const [art, setArt] = useState<typeof WORK_ART[number]>(transitionArtwork('restore'));
  const picker = useRef<ReturnType<typeof createArtworkPicker> | null>(null);
  const next = useCallback(() => {
    if (!picker.current) picker.current = createArtworkPicker(null);
    setArt(picker.current()!);
  }, []);
  const load = () => { setArt(transitionArtwork('restore'));setMode('loading'); };
  const transition = () => { setArt(transitionArtwork('world'));setMode('transition'); };
  return <>
    <nav aria-label="화면 미리보기" style={{ position: 'fixed', inset: '0 0 auto', height: 44, zIndex: 1005, display: 'flex', alignItems: 'center', gap: 16, overflowX: 'auto', whiteSpace: 'nowrap', padding: '0 16px', background: '#fff3d2', color: '#143b40', fontSize: 12 }}>
      <strong>화면 미리보기 · 게임 저장 안 함</strong>
      <button onClick={() => setMode('gallery')}>일상 그림</button><button onClick={() => { setHomeVisit(value => value + 1);setMode('home'); }}>홈 화면</button>
      <button onClick={() => setMode('title')}>대기 화면</button><button onClick={load}>로딩 화면</button><button onClick={transition}>전환 그림</button><a href="/">게임으로</a>
    </nav>
    <main style={{ position: 'fixed', inset: '44px 0 0' }}>
      {mode === 'gallery' && <ArtworkGallery onBack={() => setMode('home')} />}
      {mode === 'home' && <HomeScreen key={homeVisit} saved={false} busy={false} muted={muted} onContinue={load} onNew={transition} onImport={load} onSettings={() => setMode('gallery')} onStarter={load} onDemo={load} onSound={() => setMuted(value => !value)} onTitle={() => setMode('title')} />}
      {mode === 'title' && <TitleScreen muted={muted} onSound={() => setMuted(value => !value)} onEnter={() => setMode('home')} />}
      {mode === 'loading' && <LoadingScreen art={art} onNext={next} label="로딩 화면 미리보기" />}
      {mode === 'transition' && <ScreenTransition art={art} label="시작할 땅을 고르는 중" onDone={() => setMode('gallery')} />}
    </main>
  </>;
}
