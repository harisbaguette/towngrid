export const SCREEN_ART_KEY = 'towngrid-screen-art-v1';
export const SCREEN_BACKGROUNDS = {
  waiting: '/assets/screens/waiting-background.webp',
  home: '/assets/screens/home-background.webp',
  loading: '/assets/screens/loading-background.webp',
};
export const WORK_ART = [
  { id: 'mira', src: '/assets/screens/mira-workshop.webp', title: '미라의 정비소', tip: '도로를 연결하면 주민과 운송 차량이 이동할 수 있습니다.' },
  { id: 'marna', src: '/assets/screens/marna-workshop.webp', title: '마르나의 공방', tip: '생산이 멈췄다면 필요한 재료가 도착했는지 확인하세요.' },
  { id: 'silen', src: '/assets/screens/silen-greenhouse.webp', title: '실렌의 온실', tip: '시설을 놓기 전에 주변 환경과 배치 효율을 살펴보세요.' },
  { id: 'rowan', src: '/assets/screens/rowan-rail.webp', title: '로웬의 철도 정비', tip: '여러 거점을 연결하면 생산물을 서로 운송할 수 있습니다.' },
  { id: 'hana', src: '/assets/screens/hana-dispatch.webp', title: '하나의 배송 준비', tip: '시장에서는 재고와 납품 계약을 확인할 수 있습니다.' },
  { id: 'bron', src: '/assets/screens/bron-carpentry.webp', title: '브론의 목공소', tip: '목재를 가공한 판재는 마을을 키우는 데 쓰입니다.' },
];

// Presentation history only: never read or write campaign save keys.
export function createArtworkPicker(storage, random = Math.random) {
  const ids = WORK_ART.map(art => art.id);
  let queue = [], last = null;
  try {
    const saved = JSON.parse(storage?.getItem(SCREEN_ART_KEY) || 'null');
    if (saved && Array.isArray(saved.queue) && saved.queue.every(id => ids.includes(id)) &&
        new Set(saved.queue).size === saved.queue.length && (saved.last === null || ids.includes(saved.last))) {
      queue = saved.queue; last = saved.last;
    }
  } catch { /* Private browsing or damaged presentation history: start a fresh deck. */ }
  return () => {
    if (!queue.length) {
      queue = [...ids];
      for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]];
      }
    }
    if (queue[0] === last && queue.length > 1) [queue[0], queue[1]] = [queue[1], queue[0]];
    last = queue.shift();
    try { storage?.setItem(SCREEN_ART_KEY, JSON.stringify({ queue, last })); } catch { /* Keep the in-memory deck. */ }
    return WORK_ART.find(art => art.id === last);
  };
}
