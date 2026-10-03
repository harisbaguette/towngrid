import {BASE_TIME_SCALE, realSeconds} from '../src/app/game/game-time.js';
// Balance report: reads the live game tables (RESOURCES, BUILDINGS, RANKS) and prints
// per-building economics, resource sinks, the unlock ladder and pass/fail checks.
//
//   node scripts/balance-report.mjs                      # current code
//   node scripts/balance-report.mjs --patch docs/balance/patch-20260928.json   # preview a patch in memory
//   node scripts/balance-report.mjs --json               # machine-readable output
//   node scripts/balance-report.mjs --strict             # exit 1 when a check fails
//
// All figures are at base speed (level 1, tile/nation/race multipliers = 1) and base market price.
// "Tile-seconds" = seconds of one 1x1 building needed, summed over the whole supply chain.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RESOURCES, BUILDINGS, Simulation, CONTRACT_PREMIUM, CONTRACT_WAIT } from '../src/app/game/simulation.js';
import { RANKS, unlockRank } from '../src/app/game/world.js';
import { COUNCIL } from '../src/app/game/campaign.js';
import { CLUSTER_STEP, CLUSTER_MAX, EXTRACT_MAX, clusterMax } from '../src/app/game/proximity.js';
import { EXPANSION_BUILDINGS, EXPANSION2_BUILDINGS, EXPANSION_RECIPES, EXPANSION2_RECIPES } from '../src/app/game/industry.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const flag = name => args.includes(name);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

// Thresholds shared with docs/BALANCE_PATCH_20260928.md.
const LIMITS = { resources: 32, buildings: 60, premium: 1.15, marginRatio: 1.25, earlyGap: 2, earlyLastRank: 6, lateFromRank: 23, recipeFacilities: 10, contractPremium: 1.35, contractWait: 60, earlyPeriod: 15, earlyPeriodRank: 6 };
const SPECIAL = new Set(['power', 'irrigation', 'horse', 'ward', 'health', 'transit']);

// ---------- patch preview (in-memory only; game files are never written) ----------
let patch = null;
const patchFile = option('--patch');
if (patchFile) {
  patch = JSON.parse(fs.readFileSync(path.resolve(root, patchFile), 'utf8'));
  for (const [id, def] of Object.entries(patch.resources?.add || {})) RESOURCES[id] = { ...def };
  for (const [id, def] of Object.entries(patch.resources?.change || {})) {
    if (!RESOURCES[id]) throw new Error('patch changes unknown resource ' + id);
    Object.assign(RESOURCES[id], def);
  }
  for (const [id, def] of Object.entries(patch.buildings?.add || {})) {
    if (BUILDINGS[id]) throw new Error('patch adds existing building ' + id);
    BUILDINGS[id] = { size: 1, ...def };
  }
  for (const [id, def] of Object.entries(patch.buildings?.change || {})) {
    if (!BUILDINGS[id]) throw new Error('patch changes unknown building ' + id);
    // Object-valued fields (inputs, materials) are replaced whole, never merged.
    for (const [k, v] of Object.entries(def)) { if (v === null) delete BUILDINGS[id][k]; else BUILDINGS[id][k] = v; }
  }
  if (patch.ranks?.table) {
    if (patch.ranks.table.length !== RANKS.length) throw new Error('rank count must stay ' + RANKS.length + ' (save validation)');
    patch.ranks.table.forEach((r, i) => { RANKS[i] = { id: i, name: r.name, fee: r.fee, requirements: r.requirements, unlocks: r.unlocks }; });
  }
}

// ---------- helpers ----------
const price = r => RESOURCES[r]?.price ?? 0;
const value = items => Object.entries(items || {}).reduce((n, [r, k]) => n + price(r) * k, 0);
const name = id => BUILDINGS[id]?.name || RESOURCES[id]?.name || id;
const round = (n, d = 1) => Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : null;
// ---------- product lines ----------
// Every facility product is a line [building, recipe] (simulation.js BUILDINGS[type].recipes). recipes[0] is rebuilt
// from the definition so a patch preview that changes a facility's inputs or period stays exact. A line's rank is the
// later of the facility's unlock and the recipe's own unlock.
const recipesOf = id => { const d = BUILDINGS[id]; if (!d.period) return []; return [{ id: d.output, name: RESOURCES[d.output]?.name || d.name, inputs: d.inputs || {}, output: d.output, amount: d.amount, period: d.period }, ...(d.recipes || []).slice(1)]; };
const lines = Object.keys(BUILDINGS).flatMap(id => recipesOf(id).map((r, i) => ({ id, r, alt: i > 0, key: i ? id + ':' + r.id : id, rank: Math.max(unlockRank(id), r.unlock || 0) })));
const lineName = l => l.alt ? BUILDINGS[l.id].name + ' · ' + l.r.name : BUILDINGS[l.id].name;
const producerLines = r => lines.filter(l => l.r.output === r && RESOURCES[r]);
const producers = r => [...new Set(producerLines(r).map(l => l.id))];
const firstProducerRank = r => Math.min(Infinity, ...producerLines(r).map(l => l.rank));
const isProducer = id => recipesOf(id).some(r => RESOURCES[r.output]);
const hasInputs = r => Object.keys(r.inputs || {}).length > 0;

// Cheapest chain (tile-seconds per unit) for each resource, across all its product lines.
const tileMemo = new Map();
function tileSec(r, seen = new Set()) {
  if (tileMemo.has(r)) return tileMemo.get(r);
  if (seen.has(r)) return Infinity;
  seen.add(r);
  let best = Infinity;
  for (const l of producerLines(r)) best = Math.min(best, chainSec(l.r, seen));
  seen.delete(r);
  tileMemo.set(r, best);
  return best;
}
function chainSec(r, seen = new Set()) {
  const inputs = Object.entries(r.inputs || {}).reduce((n, [x, k]) => n + k * tileSec(x, seen), 0);
  return (r.period + inputs) / r.amount;
}
const density = r => price(r) * 60 * BASE_TIME_SCALE / tileSec(r);            // G per tile-minute, best chain
const lineDensity = r => price(r.output) * 60 * BASE_TIME_SCALE / chainSec(r);
// Processing depth: raw lines are 0, a line is one more than its deepest input's shallowest producer.
const depthMemo = new Map();
function depthOf(res, seen = new Set()) {
  if (depthMemo.has(res)) return depthMemo.get(res);
  if (seen.has(res)) return 0;
  seen.add(res);
  const d = Math.min(Infinity, ...producerLines(res).map(l => lineDepth(l.r, seen)));
  seen.delete(res); depthMemo.set(res, d); return d;
}
const lineDepth = (r, seen = new Set()) => hasInputs(r) ? 1 + Math.max(...Object.keys(r.inputs).map(x => depthOf(x, seen))) : 0;

// ---------- 1. building economics ----------
const economy = lines.filter(l => RESOURCES[l.r.output]).map(l => {
  const d = BUILDINGS[l.id], r = l.r, perMin = 60 * BASE_TIME_SCALE / r.period;
  const out = price(r.output) * r.amount, inp = value(r.inputs);
  const net = (out - inp) * perMin, cost = d.cost + value(d.materials);
  const inputDensity = Math.max(0, ...Object.keys(r.inputs || {}).map(density));
  return {
    id: l.key, building: l.id, recipe: r.id, alt: l.alt, name: lineName(l), group: d.group, rank: l.rank, period: r.period, realPeriod: realSeconds(r.period), depth: lineDepth(r),
    inputs: r.inputs || {}, output: r.output, amount: r.amount,
    outPerMin: round(out * perMin), inPerMin: round(inp * perMin), netPerMin: round(net),
    netPerSec: round(net / 60, 2), buildValue: cost, paybackMin: round(cost / net, 1),
    tileValuePerMin: round(lineDensity(r)),
    premium: hasInputs(r) ? round(lineDensity(r) / inputDensity, 2) : null,
    margin: hasInputs(r) ? round(out / inp, 2) : null,
  };
}).sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));

const support = Object.keys(BUILDINGS).filter(id => !isProducer(id)).map(id => {
  const d = BUILDINGS[id];
  return { id, name: d.name, group: d.group, rank: unlockRank(id), effect: SPECIAL.has(d.output) ? d.output : d.home ? 'home' : 'support', inputs: d.inputs || {}, buildValue: d.cost + value(d.materials) };
}).sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));

// ---------- 2. resource sinks ----------
// Code sinks: literal `stock.<id>-=` / `stock.<id>--` in game modules, plus upgrade materials read from the code.
function scanCodeSinks() {
  const dir = path.join(root, 'src/app/game');
  const found = {};
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of text.matchAll(/stock(?:\.([a-z]+)|\[['"]([a-z]+)['"]\])\s*(?:-=|--)/g)) {
      const r = m[1] || m[2];
      (found[r] ??= new Set()).add(f.replace('.js', ''));
    }
  }
  for (const id of Object.keys(BUILDINGS)) {
    const d = BUILDINGS[id];
    if (!(d.period || d.home)) continue;
    const item = Simulation.prototype.upgradeItem.call({}, { type: id, level: 1 });
    if (item) (found[item] ??= new Set()).add('upgrade');
  }
  // Council and diplomacy prices are paid through one table (campaign.js COUNCIL), not literal stock lines.
  for (const a of Object.values(COUNCIL)) for (const r of Object.keys(a.items || {})) (found[r] ??= new Set()).add('campaign');
  for (const s of patch?.codeSinks || []) (found[s.resource] ??= new Set()).add(s.where);
  return found;
}
const codeSinks = scanCodeSinks();
const sinks = Object.keys(RESOURCES).map(r => {
  const inputs = [...new Set(lines.filter(l => l.r.inputs?.[r]).map(l => l.id))];
  const materials = Object.keys(BUILDINGS).filter(id => BUILDINGS[id].materials?.[r]);
  const code = [...(codeSinks[r] || [])];
  const made = producers(r);
  const final = !!RESOURCES[r].final;
  return {
    id: r, name: RESOURCES[r].name, price: price(r), producers: made, inputs, materials, code, final,
    orphan: !inputs.length && !materials.length && !code.length && !final,
    thin: !inputs.length && !final, // no running consumer: only one-off materials or scripted costs
    tileValuePerMin: round(density(r)),
  };
});

// ---------- 3. unlock ladder ----------
const startSet = Object.keys(BUILDINGS).filter(id => unlockRank(id) === 0 && !RANKS[0].unlocks.includes(id));
const ladder = RANKS.map(r => ({ id: r.id, name: r.name, fee: r.fee, requirements: r.requirements.map(q => q[2] + ' ' + q[1]), unlocks: r.unlocks.map(name) }));
const unlockRanks = RANKS.filter(r => r.unlocks.length).map(r => r.id);
const emptyRanks = RANKS.filter(r => r.id > 0 && !r.unlocks.length).map(r => r.id);
function longestGap(from, to) { let best = 0, run = 0; for (let i = from; i <= to; i++) { run = RANKS[i].unlocks.length || (i === 0 && startSet.length) ? 0 : run + 1; best = Math.max(best, run); } return best; }

// ---------- 4. checks ----------
const problems = [];
const listed = RANKS.flatMap(r => r.unlocks);
for (const id of listed) if (!BUILDINGS[id]) problems.push('unlocks unknown building ' + id);
for (const id of new Set(listed)) if (listed.filter(x => x === id).length > 1) problems.push(id + ' unlocked twice');
for (const r of RANKS) for (const [key] of r.requirements) {
  const [kind, item] = key.split(':');
  if (['produced', 'sold'].includes(kind) && !(firstProducerRank(item) < r.id)) problems.push(`${r.id} ${r.name}: ${key} has no producer unlocked before this rank`);
  if (kind === 'building' && !(unlockRank(item) < r.id)) problems.push(`${r.id} ${r.name}: ${key} is not unlocked before this rank`);
}
for (const id of Object.keys(BUILDINGS)) {
  const d = BUILDINGS[id], at = unlockRank(id);
  for (const r of Object.keys(d.materials || {})) {
    if (!RESOURCES[r] && !SPECIAL.has(r)) problems.push(`${id}: unknown resource ${r}`);
    else if (RESOURCES[r] && !(firstProducerRank(r) <= at)) problems.push(`${id} (rank ${at}) needs ${r}, first producer unlocks later`);
  }
}
// Each product line needs its inputs made by then, and an alternative may not open before its facility.
for (const l of lines) {
  if ((l.r.unlock || 0) && l.r.unlock < unlockRank(l.id)) problems.push(`${lineName(l)}: recipe unlock ${l.r.unlock} is before its facility (${unlockRank(l.id)})`);
  if (!RESOURCES[l.r.output] && !SPECIAL.has(l.r.output)) problems.push(`${lineName(l)}: unknown output ${l.r.output}`);
  for (const r of Object.keys(l.r.inputs || {})) {
    if (!RESOURCES[r] && !SPECIAL.has(r)) problems.push(`${lineName(l)}: unknown resource ${r}`);
    else if (RESOURCES[r] && !(firstProducerRank(r) <= l.rank)) problems.push(`${lineName(l)} (rank ${l.rank}) needs ${r}, first producer unlocks later`);
  }
}
// A contract keeps asking for the same item until it is delivered, so every item in a pool
// must already have a producer unlocked at the pool's first rank. Current code derives pools from
// Simulation.contract(); a patch may declare them explicitly.
const contractPools = patch?.constants?.['simulation.contract.pools']?.next
  ?? RANKS.map((r, i) => { const s = Object.create(Simulation.prototype); s.rank = i; s.contracts = 0; const items = new Set(); for (let c = 0; c < 6; c++) { s.contracts = c; items.add(s.contract().item); } return { from: i, items: [...items] }; });
let poolStart = 0;
for (const pool of contractPools) {
  const from = pool.from ?? poolStart;
  for (const item of pool.items) if (!(firstProducerRank(item) <= from)) problems.push(`contract pool from rank ${from}: ${item} has no producer unlocked yet`);
  if (pool.rankBelow !== undefined) poolStart = pool.rankBelow;
}
const processing = economy.filter(e => e.premium !== null);
// Alternative products: each must feed another chain (a different output) or change which chains it draws on (a
// different input set), otherwise it is only a copy of the default line.
const sameInputs = (a, b) => Object.keys(a || {}).sort().join() === Object.keys(b || {}).sort().join();
const alternatives = lines.filter(l => l.alt).map(l => { const base = recipesOf(l.id)[0]; return { line: l, distinct: l.r.output !== base.output || !sameInputs(l.r.inputs, base.inputs) }; });
const recipeFacilities = new Set(alternatives.map(a => a.line.id)).size;
// An alternative is a trap when another line of the same product, open no later, uses only inputs the alternative also uses,
// needs no more of each per unit made and makes at least as many per second (audit A2-R1). Each alternative needs an edge.
const perUnit = (r, k) => (r.inputs?.[k] || 0) / r.amount, rate = r => r.amount / r.period;
const dominated = alternatives.map(a => ({ a, by: lines.filter(l => l !== a.line && l.r.output === a.line.r.output && l.rank <= a.line.rank && Object.keys(l.r.inputs || {}).every(k => k in (a.line.r.inputs || {}) && perUnit(l.r, k) <= perUnit(a.line.r, k)) && rate(l.r) >= rate(a.line.r)) })).filter(v => v.by.length);
// Production time: early lines show results quickly, and the average period grows with processing depth.
const earlySlow = economy.filter(e => e.rank <= LIMITS.earlyPeriodRank && e.period > LIMITS.earlyPeriod);
const byDepth = Object.entries(economy.filter(e => !e.alt).reduce((m, e) => ((m[e.depth] ??= []).push(e.period), m), {})).map(([d, p]) => [+d, p.reduce((n, v) => n + v, 0) / p.length]).sort((a, b) => a[0] - b[0]);
const depthRises = byDepth.every(([, p], i) => !i || p > byDepth[i - 1][1]);
// C12/C13: raw lines built in a full same-kind cluster run at their capped time cut (proximity.js clusterMax); every other
// line, the processing plant included, runs at base speed. Each processing line must still out-earn its best input per
// tile-minute by LIMITS.premium. C12 clusters the raw fields only (a farm facility that draws nothing but water); C13
// clusters every raw line (nothing but water in): fields, wells, lumber camps, quarries, mines, pumps and extractors.
const rawLine = l => Object.keys(l.r.inputs || {}).every(k => k === 'water');
function clusterPremiums(fast) {
  const cut = new Map(lines.filter(fast).map(l => [l.r, 1 - CLUSTER_STEP * clusterMax(l.id)]));
  const memo = new Map();
  const tile = (res, seen = new Set()) => {
    if (memo.has(res)) return memo.get(res);
    if (seen.has(res)) return Infinity;
    seen.add(res);
    const best = Math.min(Infinity, ...producerLines(res).map(l => chain(l.r, seen)));
    seen.delete(res); memo.set(res, best); return best;
  };
  const chain = (r, seen = new Set()) => ((cut.get(r) ?? 1) * r.period + Object.entries(r.inputs || {}).reduce((n, [x, k]) => n + k * tile(x, seen), 0)) / r.amount;
  return lines.filter(l => RESOURCES[l.r.output] && hasInputs(l.r) && !cut.has(l.r)).map(l => ({ line: l,
    premium: round(price(l.r.output) / chain(l.r) / Math.max(...Object.keys(l.r.inputs).map(x => price(x) / tile(x))), 2) }));
}
const clustered = clusterPremiums(l => BUILDINGS[l.id].group === 'farm' && rawLine(l));
const clusteredAll = clusterPremiums(rawLine);
// C14 (G1-E1, docs/BALANCE_PATCH_20260928.md 19): a final good of the optional expansion chains earns at least
// LIMITS.expansionFloor of the median existing processing line open at its rank per tile-minute (else nobody runs the
// chain for money) and no more than the best of them (else it makes a base chain obsolete).
const expansionFacility = new Set(Object.keys({ ...EXPANSION_BUILDINGS, ...EXPANSION2_BUILDINGS }));
const expansionRecipe = new Set([...Object.entries(EXPANSION_RECIPES), ...Object.entries(EXPANSION2_RECIPES)].flatMap(([t, list]) => list.map(r => t + ':' + r.id)));
const isExpansionLine = e => expansionFacility.has(e.building) || expansionRecipe.has(e.id);
const median = list => { const s = [...list].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN; };
const expansionFinals = economy.filter(e => isExpansionLine(e) && RESOURCES[e.output]?.final).map(e => {
  const pool = economy.filter(o => !isExpansionLine(o) && o.rank <= e.rank && Object.keys(o.inputs).some(k => k !== 'water')).map(o => o.tileValuePerMin);
  return { e, ratio: round(e.tileValuePerMin / median(pool), 2), best: Math.max(...pool) };
});
LIMITS.expansionFloor = 0.8;
const clusterCheck = (list, id, name) => ({ id, name, value: list.filter(c => c.premium < LIMITS.premium).map(c => lineName(c.line) + ' ' + c.premium).join(', ') || '전부 충족 · 최저 ' + Math.min(...list.map(c => c.premium)), pass: list.every(c => c.premium >= LIMITS.premium) });
const checks = [
  { id: 'C1', name: `자원 ${LIMITS.resources}종 이상`, value: Object.keys(RESOURCES).length, pass: Object.keys(RESOURCES).length >= LIMITS.resources },
  { id: 'C2', name: `시설 ${LIMITS.buildings}종 이상`, value: Object.keys(BUILDINGS).length, pass: Object.keys(BUILDINGS).length >= LIMITS.buildings },
  { id: 'C3', name: '판매 외 소비처가 없는 고아 자원 0', value: sinks.filter(s => s.orphan).map(s => s.name).join(', ') || '없음', pass: !sinks.some(s => s.orphan) },
  { id: 'C4', name: `0~${LIMITS.earlyLastRank}단계 해금 공백 ${LIMITS.earlyGap - 1}단계 이하`, value: '최장 공백 ' + longestGap(0, LIMITS.earlyLastRank) + '단계', pass: longestGap(0, LIMITS.earlyLastRank) <= LIMITS.earlyGap - 1 },
  { id: 'C5', name: `${LIMITS.lateFromRank}단계 이후 해금 존재`, value: RANKS.filter(r => r.id >= LIMITS.lateFromRank).reduce((n, r) => n + r.unlocks.length, 0) + '종', pass: RANKS.some(r => r.id >= LIMITS.lateFromRank && r.unlocks.length) },
  { id: 'C6', name: `가공 시설이 원료 사슬보다 타일당 분당 가치 ${LIMITS.premium}배 이상`, value: processing.filter(e => e.premium < LIMITS.premium).map(e => `${e.name} ${e.premium}`).join(', ') || '전부 충족', pass: processing.every(e => e.premium >= LIMITS.premium) },
  { id: 'C7', name: `가공 시설 산출가/투입가 ${LIMITS.marginRatio}배 이상`, value: processing.filter(e => e.margin < LIMITS.marginRatio).map(e => `${e.name} ${e.margin}`).join(', ') || '전부 충족', pass: processing.every(e => e.margin >= LIMITS.marginRatio) },
  { id: 'C8', name: '해금 순서 모순 없음(요구 실적·투입·자재·계약·대안 제품)', value: problems.length ? problems.length + '건' : '없음', pass: !problems.length },
  { id: 'C9', name: `대안 제품 시설 ${LIMITS.recipeFacilities}곳 이상 · 모든 대안이 다른 사슬을 공급하거나 다른 원료를 씀 · 같은 단계에 더 적은 원료로 같거나 빠르게 만드는 줄이 없음`, value: recipeFacilities + '곳 · ' + (alternatives.filter(a => !a.distinct).map(a => lineName(a.line)).join(', ') || '모두 구별됨') + ' · ' + (dominated.map(v => lineName(v.a.line) + ' < ' + v.by.map(lineName).join('/')).join(', ') || '밀리는 대안 없음'), pass: recipeFacilities >= LIMITS.recipeFacilities && alternatives.every(a => a.distinct) && !dominated.length },
  { id: 'C10', name: `계약 보상 목록가의 ${LIMITS.contractPremium}배 이하 · 다음 계약 대기 ${LIMITS.contractWait}초 이상`, value: '최대 ' + Math.max(...CONTRACT_PREMIUM) + '배 · ' + CONTRACT_WAIT + '초', pass: Math.max(...CONTRACT_PREMIUM) <= LIMITS.contractPremium && CONTRACT_WAIT >= LIMITS.contractWait },
  { id: 'C11', name: `${LIMITS.earlyPeriodRank}단계까지 열리는 생산 주기 ${LIMITS.earlyPeriod}게임초 이하 · 가공 깊이별 평균 주기가 깊을수록 김`, value: (earlySlow.map(e => e.name + ' ' + e.period + 's').join(', ') || '초반 전부 충족') + ' · ' + byDepth.map(([d, p]) => d + '단 ' + round(p) + 's').join(' < '), pass: !earlySlow.length && depthRises },
  clusterCheck(clustered, 'C12', `원료 밭을 같은 시설 모으기 최대(시간 -${round(CLUSTER_STEP * CLUSTER_MAX * 100, 0)}%)로 지어도 가공 시설이 타일당 분당 가치 ${LIMITS.premium}배 이상`),
  clusterCheck(clusteredAll, 'C13', `원료 밭(시간 -${round(CLUSTER_STEP * CLUSTER_MAX * 100, 0)}%)과 우물·벌목장·채석장·광산 등 채취 시설(시간 -${round(CLUSTER_STEP * EXTRACT_MAX * 100, 0)}%)을 모두 같은 시설 모으기 최대로 지어도 가공 시설이 타일당 분당 가치 ${LIMITS.premium}배 이상`),
  { id: 'C14', name: `확장 사슬 최종재의 타일당 분당 가치가 같은 단계 기존 가공 줄 중앙값의 ${LIMITS.expansionFloor}배 이상 · 그 단계 기존 최고값 이하`, value: (expansionFinals.filter(v => v.ratio < LIMITS.expansionFloor || v.e.tileValuePerMin > v.best).map(v => v.e.name + ' ' + v.ratio).join(', ') || expansionFinals.length + '줄 충족') + ' · 최저 ' + Math.min(...expansionFinals.map(v => v.ratio)), pass: expansionFinals.length > 0 && expansionFinals.every(v => v.ratio >= LIMITS.expansionFloor && v.e.tileValuePerMin <= v.best) },
];

// ---------- output ----------
const report = { source: patchFile ? 'patch:' + patchFile : 'code', pacing: {baseTimeScale: BASE_TIME_SCALE, dayRealSeconds: realSeconds(80)}, counts: { resources: Object.keys(RESOURCES).length, buildings: Object.keys(BUILDINGS).length, producers: economy.filter(e => !e.alt).length, alternatives: alternatives.length, recipeFacilities, ranks: RANKS.length }, startSet, economy, support, sinks, ladder, emptyRanks, unlockRanks, problems, checks };
// Per-line premiums under C12 (fields clustered) and C13 (every raw line clustered), keyed like economy[].id.
report.clusterPremium = { fields: Object.fromEntries(clustered.map(c => [c.line.key, c.premium])), all: Object.fromEntries(clusteredAll.map(c => [c.line.key, c.premium])) };
if (flag('--json')) { console.log(JSON.stringify(report, null, 1)); }
else {
  const table = (rows, cols) => { console.log('| ' + cols.map(c => c[0]).join(' | ') + ' |'); console.log('|' + cols.map(() => '---').join('|') + '|'); for (const r of rows) console.log('| ' + cols.map(c => { const v = c[1](r); return v === null || v === undefined ? '—' : String(v); }).join(' | ') + ' |'); console.log(''); };
  const fmt = o => Object.entries(o).map(([r, n]) => name(r) + ' ' + n).join(' · ') || '—';
  console.log(`# 밸런스 보고서 (${report.source})\n`);
  console.log(`자원 ${report.counts.resources}종 · 시설 ${report.counts.buildings}종(생산 ${report.counts.producers}, 대안 제품 ${report.counts.alternatives}개 · ${report.counts.recipeFacilities}곳) · 승급 ${report.counts.ranks}단계 · 시작 시설: ${startSet.map(name).join(', ')}\n`);
  console.log('## 1. 생산 시설 경제 (1배속 실제 시간·기준 가격)\n');
  table(economy, [['단계', e => e.rank], ['시설', e => e.name], ['그룹', e => e.group], ['깊이', e => e.depth], ['주기(실제 초)', e => e.realPeriod], ['투입', e => fmt(e.inputs)], ['산출', e => name(e.output) + ' ' + e.amount], ['산출/분', e => e.outPerMin], ['원가/분', e => e.inPerMin], ['순이익/분', e => e.netPerMin], ['건설가치', e => e.buildValue], ['회수(분)', e => e.paybackMin], ['타일당/분', e => e.tileValuePerMin], ['가공우위', e => e.premium], ['산출/투입', e => e.margin]]);
  console.log('## 2. 지원·특수 시설\n');
  table(support, [['단계', e => e.rank], ['시설', e => e.name], ['그룹', e => e.group], ['효과', e => e.effect], ['투입', e => fmt(e.inputs)], ['건설가치', e => e.buildValue]]);
  console.log('## 3. 자원 소비처\n');
  table(sinks, [['자원', s => s.name], ['가격', s => s.price], ['생산', s => s.producers.map(name).join(', ') || '없음'], ['투입처', s => s.inputs.map(name).join(', ') || '—'], ['자재처', s => s.materials.length + '곳'], ['코드 소모', s => s.code.join(', ') || '—'], ['최종재', s => s.final ? '예' : ''], ['타일당/분', s => s.tileValuePerMin], ['판정', s => s.orphan ? '고아' : s.thin ? '약함' : '']]);
  console.log('## 4. 승급 사다리\n');
  table(ladder, [['단계', r => r.id], ['신분', r => r.name], ['수수료', r => r.fee], ['요구 실적', r => r.requirements.join(' · ') || '—'], ['해금', r => r.unlocks.join(', ') || '없음']]);
  console.log(`해금 없는 단계: ${emptyRanks.join(', ') || '없음'}\n`);
  if (problems.length) { console.log('## 5. 해금 순서 모순\n'); for (const p of problems) console.log('- ' + p); console.log(''); }
  console.log('## 판정\n');
  table(checks, [['항목', c => c.id], ['기준', c => c.name], ['값', c => c.value], ['결과', c => c.pass ? 'PASS' : 'FAIL']]);
}
if (flag('--strict') && checks.some(c => !c.pass)) process.exit(1);
