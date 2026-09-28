import { BUILDINGS, RESOURCES } from './simulation.js';

export const SERVICE_OUTPUTS = {
 horse: { name: '운반 지원', label: '운반 지원 중', duration: 65 },
 power: { name: '전력', label: '전력 공급 중', duration: 60 },
 irrigation: { name: '관개', label: '관개 공급 중', duration: 60 },
 ward: { name: '결계', label: '결계 유지 중', duration: 65 },
 transit: { name: '운송 지원', label: '운송 가속 중', duration: 65 },
 health: { name: '의료', label: '의료 지원 중', duration: 65 },
};

// Output on the pad and work in progress are independent: a facility can keep
// producing while a carrier is on the way. Never infer inventory from a timer.
export function productionVisualState(type, building = {}, sim) {
 const def = BUILDINGS[type];
 if (!def?.period || !def.output) return null;
 // The product a live facility is set to make (simulation.js recipeOf); a plain context shows the default product.
 const made = building.type && typeof sim?.recipeOf === 'function' ? sim.recipeOf(building) : def;
 const progress = Math.min(1, Math.max(0, building.progress || 0));
 const count = Math.max(0, Math.floor(building.out || 0));
 const enabled = building.enabled !== false && !(building.health <= 0);
 const service = SERVICE_OUTPUTS[made.output];
 const remaining = service ? Math.max(0, (building.activeUntil || 0) - (sim?.time || 0)) : 0;
 // A live simulation answers per building (local grid, trade-terminals.js); a plain context only has a global flag.
 const powerBlocked = !!(def.power && (typeof sim?.poweredAt === 'function' && building.type ? !sim.poweredAt(building) : sim?.power === false));
 const outage = made.output === 'power' && sim?.outageUntil > sim?.time;
 const working = enabled && !powerBlocked && !outage && !!building.working;
 const active = !!(service && enabled && remaining > 0 && !powerBlocked && !outage);
 const facility = building.type ? building : { ...building, type };
 const inputs = sim?.effectiveInputs?.(facility) ?? def.inputs ?? {};
 // Ingredients are consumed at the START of a cycle. Empty inputs during a
 // cycle must not hide the workpiece or falsely report a shortage.
 const missing = progress === 0 && !working
  ? Object.entries(inputs).find(([id, amount]) => (building.inputs?.[id] || 0) < amount)?.[0]
  : undefined;
 const exhausted = !!(def.natural && sim?.closestNatural && !sim.closestNatural(facility, def.natural));
 const phase = building.health <= 0 ? 'broken' : !enabled ? 'disabled'
  : active ? 'supplying' : working ? 'working' : missing || exhausted || powerBlocked || outage ? 'blocked' : count ? 'ready' : 'empty';
 const label = phase === 'broken' ? '파손' : phase === 'disabled' ? '중지'
  : active ? service.label : working ? service ? '공급 준비' : '생산 중'
  : outage ? '공급 중단' : powerBlocked ? '전력 부족' : missing ? '재료 부족' : exhausted ? '자원 고갈' : count ? '완료' : building.status || '대기';
 return { phase, label, working, count, ready: service ? active : count > 0, progress, output: made.output,
  service: !!service, active, remaining, displayValue: service ? Math.ceil(remaining) + '초' : String(count),
  displayProgress: active ? Math.min(1, remaining / service.duration) : progress,
  outputName: service?.name || RESOURCES[made.output]?.name || made.output, missing, exhausted,
  workpiece: progress > 0 || working || Object.entries(inputs).some(([id, amount]) => (building.inputs?.[id] || 0) >= amount),
  clock: Math.max(0, building.animationTime ?? sim?.time ?? 0) };
}
