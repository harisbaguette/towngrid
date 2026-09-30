import { DAILY_ART, TRANSITION_ART } from './daily-art.js';
export { TRANSITION_ART };
export const SCREEN_ART_KEY = 'towngrid-screen-art-v1';
export const SCREEN_BACKGROUNDS = {
  waiting: '/assets/screens/pixel-v2/waiting-background.webp',
  home: '/assets/screens/pixel-v2/home-background.webp',
  loading: '/assets/screens/pixel-v2/loading-background.webp',
};
export const WORK_ART = [
  { id: 'mira', category: '산업', src: '/assets/screens/pixel-v2/mira-workshop.webp', title: '미라의 정비소', tip: '완성품은 시설 옆에 쌓이고, 운반되면 줄어듭니다.' },
  { id: 'marna', category: '산업', src: '/assets/screens/pixel-v2/marna-workshop.webp', title: '마르나의 광산 공방', tip: '주변 지형에서 산 쪽 경계의 자원과 시설 조건을 확인하세요.' },
  { id: 'silen', category: '자연', src: '/assets/screens/pixel-v2/silen-greenhouse.webp', title: '실렌의 관개 온실', tip: '농장을 놓기 전에 땅의 비옥도와 담수 위치를 살펴보세요.' },
  { id: 'rowan', category: '산업', src: '/assets/screens/pixel-v2/rowan-rail.webp', title: '로웬의 설원 철도', tip: '여러 거점을 연결하면 생산물을 서로 운송할 수 있습니다.' },
  { id: 'hana', category: '생활', src: '/assets/screens/pixel-v2/hana-dispatch.webp', title: '하나의 항구 배송', tip: '항구는 지도 가장자리의 수역과 시설 조건에 맞춰 지으세요.' },
  { id: 'bron', category: '생활', src: '/assets/screens/pixel-v2/bron-carpentry.webp', title: '브론의 숲속 목공소', tip: 'Q·E로 시점을 90°씩 돌려 건물 뒤쪽과 도로 연결을 확인하세요.' },
  ...DAILY_ART,
].map(art => ({ ...art, characters: art.characters || [art.id] }));

export const HOME_ART_KEY = 'towngrid-home-art-v1';
export const HOME_ART_CHANCE = 0.35;
export const artworkThumbnail = art => art.src.replace(/\.webp$/, '-thumb.webp');
export function transitionArtwork(context = 'village') {
 const id = { world: 'map-table', village: 'village-arrival', site: 'river-crossing', restore: 'records-room', home: 'village-arrival' }[context];
 return TRANSITION_ART.find(art => art.id === id) || TRANSITION_ART[0];
}

// Presentation-only decks. Catalog changes refresh the deck without changing save keys.
function createDeck(storage, random, key) {
 const ids = WORK_ART.map(art => art.id), catalog = ids.join('|');
 let queue = [], last = null;
 try {
  const saved = JSON.parse(storage?.getItem(key) || 'null');
  if (saved && ids.includes(saved.last)) last = saved.last;
  if (saved?.catalog === catalog && Array.isArray(saved.queue) && saved.queue.every(id => ids.includes(id)) && !saved.queue.includes(last) && new Set(saved.queue).size === saved.queue.length) queue = [...saved.queue];
 } catch { /* Storage is optional. */ }
 const prepare = () => {
  if (!queue.length) {
   queue = [...ids];
   for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
   }
  }
  if (queue[0] === last && queue.length > 1) [queue[0], queue[1]] = [queue[1], queue[0]];
 };
 const pick = () => {
  prepare();last = queue.shift();
  try { storage?.setItem(key, JSON.stringify({ catalog, queue, last })); } catch { /* Keep the in-memory deck. */ }
  return WORK_ART.find(art => art.id === last);
 };
 pick.peek = () => { prepare();return WORK_ART.find(art => art.id === queue[0]); };
 return pick;
}
export const createArtworkPicker = (storage, random = Math.random) => createDeck(storage, random, SCREEN_ART_KEY);
export function createHomeArtworkPicker(storage, random = Math.random) {
 const pick = createDeck(storage, random, HOME_ART_KEY);
 return () => random() < HOME_ART_CHANCE ? pick() : null;
}

// Warm only the next needed picture. Never preload the entire gallery at startup.
export function warmArtwork(src) {
 if (!src || typeof Image === 'undefined') return Promise.resolve(false);
 return new Promise(resolve => {
  const image = new Image();
  const finish = ok => { clearTimeout(timer);image.onload = image.onerror = null;resolve(ok); };
  const timer = setTimeout(() => finish(false), 1500);
  image.onload = () => finish(true);image.onerror = () => finish(false);image.src = src;
 });
}
