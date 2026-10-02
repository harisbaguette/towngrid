import { QUARTER_POLAR, quarterAzimuth } from './quarter-camera.js';

// All world billboards share the same depth offset. Different per-body lifts
// would let a building's floor cover a resident standing in front of it.
export const SPRITE_DEPTH_OFFSET = .75;
export function groundSprite(sprite, { azimuth = quarterAzimuth(0), heading = 0, height = 0, scale = 1, clearance = .01 } = {}) {
 const sin = Math.sin(sprite.material.rotation), cos = Math.cos(sprite.material.rotation);
 const below = (sin >= 0 ? sprite.center.x : 1 - sprite.center.x) * Math.abs(sin) * sprite.scale.x
  + (cos >= 0 ? sprite.center.y : 1 - sprite.center.y) * Math.abs(cos) * sprite.scale.y;
 const required = (below * Math.sin(QUARTER_POLAR) + clearance - height) / Math.cos(QUARTER_POLAR);
 const depth = Math.max(SPRITE_DEPTH_OFFSET / scale, required);
 sprite.position.setFromSphericalCoords(depth, QUARTER_POLAR, azimuth - heading);
 sprite.position.y += height;
}
