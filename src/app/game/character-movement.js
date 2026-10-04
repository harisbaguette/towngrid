// Presentation distance is transient: saves keep their existing worker schema.
const distances = new WeakMap();
export const characterDistance = actor => distances.get(actor) || 0;

// Shared with the animation preview, so road/upgrade speeds are not hidden by
// a slower presentation-only walk. This does not alter simulation timing.
export function characterTravelSpeed(sim, actor) {
 const tile = `${Math.round(actor.x)},${Math.round(actor.z)}`;
 const surface = sim.paved?.has(tile) ? 2.2 : sim.roads.has(tile) ? 1.7 : 1;
 return 1.25 * (actor.race === 'centaur' ? 1.15 : 1)
  * (sim.time < sim.strikeUntil ? .55 : 1) * surface
  * (sim.horse ? 1.35 : 1) * (sim.automatic ? 1.65 : 1)
  * (1 - (sim.health?.infection || 0) * .005) * (sim.money < 0 ? .65 : 1);
}

// Spend the whole movement budget along the route, including around corners.
// A waypoint is removed only after reaching it, never by a proximity shortcut.
export function advanceCharacterRoute(actor, dt, speed, canEnter = () => true) {
 let remaining = Math.max(0, dt * speed), moved = 0;
 actor.walking = false;
 actor.moveSpeed = 0;
 if (!Number.isFinite(remaining)) return 0;
 while (actor.route.length && remaining > 0) {
  const point = actor.route[0];
  if (!canEnter(point.x, point.z)) break;
  const dx = point.x - actor.x, dz = point.z - actor.z, distance = Math.hypot(dx, dz);
  if (distance === 0) { actor.route.shift(); continue; }
  const step = Math.min(distance, remaining);
  actor.dir = Math.atan2(dx, dz);
  if (step === distance) {
   actor.x = point.x; actor.z = point.z; actor.route.shift();
  } else {
   actor.x += dx / distance * step; actor.z += dz / distance * step;
  }
  remaining -= step;
  moved += step;
 }
 actor.walking = moved > 0;
 actor.moveSpeed = actor.walking ? speed : 0;
 distances.set(actor, characterDistance(actor) + moved);
 return moved;
}
