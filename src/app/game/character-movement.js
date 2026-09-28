// Presentation distance is transient: saves keep their existing worker schema.
const distances = new WeakMap();
export const characterDistance = actor => distances.get(actor) || 0;

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
