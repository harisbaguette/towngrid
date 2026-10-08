// Presentation distance is transient: saves keep their existing worker schema.
const distances = new WeakMap();
export const characterDistance = actor => distances.get(actor) || 0;

// Tiles per game second. The live clock applies BASE_TIME_SCALE separately.
export const CHARACTER_TRAVEL = Object.freeze({
 base: .8, road: 1.25, paved: 1.5, horse: 1.1, automatic: 1.1,
 guardReturn: .72, guardChase: .84, raider: .336, beastRaider: .48,
});

// Shared with previews and the trip home as well as loaded transport.
export function characterTravelSpeed(sim, actor) {
 const tile = `${Math.round(actor.x)},${Math.round(actor.z)}`;
 const surface = sim.paved?.has(tile) ? CHARACTER_TRAVEL.paved : sim.roads.has(tile) ? CHARACTER_TRAVEL.road : 1;
 return CHARACTER_TRAVEL.base * (actor.race === 'centaur' ? 1.15 : 1)
  * (sim.time < sim.strikeUntil ? .55 : 1) * surface
  * (sim.horse ? CHARACTER_TRAVEL.horse : 1) * (sim.automatic ? CHARACTER_TRAVEL.automatic : 1)
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
