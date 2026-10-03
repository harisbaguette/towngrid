'use client';
import { useEffect, useRef, type CSSProperties } from 'react';
import { pixelIdentity, pixelAtlasFrame, pixelClip } from './pixel-character-data';
import { pixelMetadata } from './pixel-character-meta';

export default function CharacterSprite({ race, appearance, index = 0, action = 'idle', direction = 3, className = '', label }: { race: string; appearance?: string; index?: number; action?: string; direction?: number; className?: string; label?: string }) {
 const identity = pixelIdentity(race, index, appearance);
 const element = useRef<HTMLSpanElement>(null);
 const metadata = pixelMetadata.get(identity.id);
 const atlas = pixelAtlasFrame(direction, 0, metadata);
 const anchors = metadata?.anchors?.[atlas.row];
 const offsets = Object.fromEntries(Array.from({ length: atlas.columns }, (_, i) => [`--pixel-anchor-${i}`, `${(.5 - (anchors?.[i]?.[0] ?? .5)) * 100}%`]));
 useEffect(() => {
  if (!element.current || !metadata?.clips) return;
  const clip = pixelClip(action, metadata), frames = clip.frames;
  const pose = (frame: number, offset: number) => {
   const row=action==='turn'&&offset>=.5?(atlas.row+1)%atlas.rows:atlas.row;
   const anchor=metadata.anchors?.[row]?.[frame]??[.5,116/128];
   const scale=metadata.frameScales?.[frame]??1;
   const baseline=metadata.anchors?.[row]?.[0]?.[1]??116/128;
   return ({
   offset, easing: 'steps(1,end)',
   backgroundPosition: `${frame / Math.max(1, atlas.columns - 1) * 100}% ${row / Math.max(1, atlas.rows - 1) * 100}%`,
   transformOrigin: `50% ${baseline*100}%`,
   transform: `translate(${(.5-anchor[0])*scale*100}%, ${(baseline-anchor[1])*scale*100}%) scale(${scale})`,
  });};
  const keyframes = frames.map((frame: number, index: number) => pose(frame, index / frames.length));
  keyframes.push(pose(clip.once ? frames[frames.length - 1] : frames[0], 1));
  const animation = element.current.animate(keyframes, { duration: frames.length / clip.fps * 1000, iterations: clip.once ? 1 : Infinity, fill: 'both' });
  return () => animation.cancel();
 }, [action, metadata, atlas.columns, atlas.row, atlas.rows]);
 return <span ref={element} data-character={identity.id} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={`pixel-character pixel-action-${action} ${className}`} style={{ ...offsets, ...(metadata?.clips ? { animation: 'none' } : {}), backgroundImage: `url("${identity.sheet}")`, backgroundSize: `${atlas.columns * 100}% ${atlas.rows * 100}%`, '--pixel-direction': `${atlas.row / (atlas.rows - 1) * 100}%` } as CSSProperties} />;
}
