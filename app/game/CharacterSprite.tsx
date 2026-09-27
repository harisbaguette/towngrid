'use client';
import type { CSSProperties } from 'react';
import { pixelIdentity, pixelAtlasFrame } from './pixel-character-data';
import { pixelMetadata } from './pixel-character-meta';

export default function CharacterSprite({ race, appearance, index = 0, action = 'idle', direction = 3, className = '', label }: { race: string; appearance?: string; index?: number; action?: string; direction?: number; className?: string; label?: string }) {
 const identity = pixelIdentity(race, index, appearance);
 const metadata = pixelMetadata.get(identity.id);
 const atlas = pixelAtlasFrame(direction, 0, metadata);
 const anchors = metadata?.anchors?.[atlas.row];
 const offsets = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`--pixel-anchor-${i}`, `${(.5 - (anchors?.[i]?.[0] ?? .5)) * 100}%`]));
 return <span role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={`pixel-character pixel-action-${action} ${className}`} style={{ ...offsets, backgroundImage: `url("${identity.sheet}")`, backgroundSize: `${atlas.columns * 100}% ${atlas.rows * 100}%`, '--pixel-direction': `${atlas.row / (atlas.rows - 1) * 100}%` } as CSSProperties} />;
}
