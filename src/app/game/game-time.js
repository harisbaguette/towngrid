// Saved times and simulation ticks remain in game seconds. Only the live
// frame clock converts real seconds, keeping every site's economy in sync.
export const BASE_TIME_SCALE = 0.5;
const suspendedClocks = new WeakSet();

// Offline processing owns this clock until its final state has been restored.
export function suspendLiveClock(campaign) {
 suspendedClocks.add(campaign);
 return () => suspendedClocks.delete(campaign);
}

export function realSeconds(gameSeconds, sim) {
 const speed = Number.isFinite(sim?.speed) && sim.speed > 0 ? sim.speed : 1;
 return Math.max(0, gameSeconds) / (BASE_TIME_SCALE * speed);
}

// Pausing freezes the value; it still describes time needed after resuming.
export const remainingSeconds = (gameSeconds, sim) => Math.max(0, Math.ceil(realSeconds(gameSeconds, sim) - 1e-9));

export function advanceGame(sim, realDt) {
 if (!sim || sim.paused || !Number.isFinite(realDt) || realDt <= 0) return;
 if (suspendedClocks.has(sim.campaign || sim)) return;
 // Do not catch up a hidden tab in one burst. Keep camera/UI timing outside
 // this clock and retain fine ticks for walking, hauling and production.
 let remaining = Math.min(realDt, 0.5);
 const clock = sim.campaign || sim;
 while (remaining > 1e-9) {
  const step = Math.min(0.05, remaining);
  clock.tick(step * BASE_TIME_SCALE);
  remaining -= step;
 }
}
