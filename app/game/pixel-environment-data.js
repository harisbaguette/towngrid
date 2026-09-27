// Building rows follow the four fixed camera views: SE, NE, NW, SW.
// Foliage reuses its radial silhouette; water lies on the world ground plane.
export const ENVIRONMENT_CELL = 192;
export const ENVIRONMENT_ASSETS = {
 sawmill: { building: true, sheet: '/assets/pixel-environment/sawmill.png', frames: 4, directions: 4, anchor: [.5, .81], size: 1.48 },
 warehouse: { building: true, sheet: '/assets/pixel-environment/warehouse.png', frames: 4, directions: 4, anchor: [.5, .83], size: 1.48 },
 house: { building: true, sheet: '/assets/pixel-environment/house.png', frames: 4, directions: 4, anchor: [.5, .83], size: 1.48 },
 well: { building: true, sheet: '/assets/pixel-environment/well.png', frames: 4, directions: 4, anchor: [.5, .82], size: 1.38 },
 lumber: { building: true, sheet: '/assets/pixel-environment/lumber.png', frames: 4, directions: 4, anchor: [.5, .81], size: 1.48 },
 field: { building: true, sheet: '/assets/pixel-environment/field.png', frames: 4, directions: 4, anchor: [.5, .72], size: 1.48 },
 oak: { sheet: '/assets/pixel-environment/oak.png', frames: 7, anchor: [.5, .91], size: 1.68 },
 water: { sheet: '/assets/pixel-environment/water.png', frames: 4 },
};
export const PLANK_ICON = '/assets/pixel-environment/plank.png';
export const PIXEL_BUILDINGS = Object.keys(ENVIRONMENT_ASSETS).filter(id => ENVIRONMENT_ASSETS[id].building);

export function pixelBuildingFrame(type, building, time, sim) {
 const b = building || {};
 // Crop age is production progress, not a looping decorative animation. A
 // stopped or starved field keeps its actual growth stage until it can resume.
 if (type === 'field') return Math.min(3, Math.max(0, Math.floor((b.progress || 0) * 4)));
 if (b.enabled === false || b.health <= 0) return 0;
 if (type === 'house') {
  const occupied = sim?.workers?.some(worker => worker.homeId === b.id);
  return occupied ? [1, 2, 3, 2][Math.floor(Math.max(0, time) * 2) % 4] : 0;
 }
 if (type === 'warehouse') {
  const handling = sim?.workers?.some(worker => worker.handling && worker.task &&
   (worker.phase === 'source' ? worker.task.sourceId == null : worker.task.targetId == null) &&
   Math.hypot(worker.x - b.x, worker.z - b.z) < 1.6);
  return handling ? [1, 2, 3, 2][Math.floor(Math.max(0, time) * 4) % 4] : 0;
 }
 if (!b.working) return 0;
 const speed = type === 'well' || type === 'lumber' ? 2.5 : 5;
 return [1, 2, 3, 2][Math.floor(Math.max(0, b.animationTime ?? time) * speed) % 4];
}

export function sawmillFrame(building, time) {
 return pixelBuildingFrame('sawmill', building, time);
}

export function oakFrame(tile, time, harvesting = false, phase = 0) {
 if (tile?.nature === 'sapling') return (tile.growAt ?? time + 160) - time > 80 ? 5 : 6;
 if (tile?.nature === null) return 4;
 const sequence = harvesting ? [0, 3, 1, 3] : [0, 1, 2, 1];
 return sequence[Math.floor(Math.max(0, time + phase) * (harvesting ? 6 : 2)) % sequence.length];
}

export function waterFrame(time) { return Math.floor(Math.max(0, time) * 3) % 4; }
