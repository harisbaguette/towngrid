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
import { RESOURCES, BUILDINGS, Simulation } from '../src/app/game/simulation.js';
import { RANKS, unlockRank } from '../src/app/game/world.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const flag = name => args.includes(name);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

// Thresholds shared with docs/BALANCE_PATCH_20260928.md.
const LIMITS = { resources: 32, buildings: 60, premium: 1.15, marginRatio: 1.25, earlyGap: 2, earlyLastRank: 6, lateFromRank: 23 };
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
const producers = r => Object.keys(BUILDINGS).filter(id => BUILDINGS[id].output === r && BUILDINGS[id].period);
const isProducer = id => { const d = BUILDINGS[id]; return !!(d.period && RESOURCES[d.output]); };

// Cheapest chain (tile-seconds per unit) for each resource, across all its producers.
const tileMemo = new Map();
function tileSec(r, seen = new Set()) {
  if (tileMemo.has(r)) return tileMemo.get(r);
  if (seen.has(r)) return Infinity;
  seen.add(r);
  let best = Infinity;
  for (const id of producers(r)) best = Math.min(best, chainSec(id, seen));
  seen.delete(r);
  tileMemo.set(r, best);
  return best;
}
function chainSec(id, seen = new Set()) {
  const d = BUILDINGS[id];
  const inputs = Object.entries(d.inputs || {}).reduce((n, [r, k]) => n + k * tileSec(r, seen), 0);
  return (d.period + inputs) / d.amount;
}
const density = r => price(r) * 60 / tileSec(r);            // G per tile-minute, best chain
const buildingDensity = id => price(BUILDINGS[id].output) * 60 / chainSec(id);

// ---------- 1. building economics ----------
const economy = Object.keys(BUILDINGS).filter(isProducer).map(id => {
  const d = BUILDINGS[id], perMin = 60 / d.period;
  const out = price(d.output) * d.amount, inp = value(d.inputs);
  const net = (out - inp) * perMin, cost = d.cost + value(d.materials);
  const inputDensity = Math.max(0, ...Object.keys(d.inputs || {}).map(density));
  return {
    id, name: d.name, group: d.group, rank: unlockRank(id), period: d.period,
    inputs: d.inputs || {}, output: d.output, amount: d.amount,
    outPerMin: round(out * perMin), inPerMin: round(inp * perMin), netPerMin: round(net),
    netPerSec: round(net / 60, 2), buildValue: cost, paybackMin: round(cost / net, 1),
    tileValuePerMin: round(buildingDensity(id)),
    premium: d.inputs ? round(buildingDensity(id) / inputDensity, 2) : null,
    margin: d.inputs ? round(out / inp, 2) : null,
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
  for (const s of patch?.codeSinks || []) (found[s.resource] ??= new Set()).add(s.where);
  return found;
}
const codeSinks = scanCodeSinks();
const sinks = Object.keys(RESOURCES).map(r => {
  const inputs = Object.keys(BUILDINGS).filter(id => BUILDINGS[id].inputs?.[r]);
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
  if (['produced', 'sold'].includes(kind) && !producers(item).some(id => unlockRank(id) < r.id)) problems.push(`${r.id} ${r.name}: ${key} has no producer unlocked before this rank`);
  if (kind === 'building' && !(unlockRank(item) < r.id)) problems.push(`${r.id} ${r.name}: ${key} is not unlocked before this rank`);
}
for (const id of Object.keys(BUILDINGS)) {
  const d = BUILDINGS[id], at = unlockRank(id);
  for (const r of Object.keys({ ...(d.inputs || {}), ...(d.materials || {}) })) {
    if (!RESOURCES[r] && !SPECIAL.has(r)) problems.push(`${id}: unknown resource ${r}`);
    else if (RESOURCES[r] && !producers(r).some(p => unlockRank(p) <= at)) problems.push(`${id} (rank ${at}) needs ${r}, first producer unlocks later`);
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
  for (const item of pool.items) if (!producers(item).some(id => unlockRank(id) <= from)) problems.push(`contract pool from rank ${from}: ${item} has no producer unlocked yet`);
  if (pool.rankBelow !== undefined) poolStart = pool.rankBelow;
}
const processing = economy.filter(e => e.premium !== null);
const checks = [
  { id: 'C1', name: `자원 ${LIMITS.resources}종 이상`, value: Object.keys(RESOURCES).length, pass: Object.keys(RESOURCES).length >= LIMITS.resources },
  { id: 'C2', name: `시설 ${LIMITS.buildings}종 이상`, value: Object.keys(BUILDINGS).length, pass: Object.keys(BUILDINGS).length >= LIMITS.buildings },
  { id: 'C3', name: '판매 외 소비처가 없는 고아 자원 0', value: sinks.filter(s => s.orphan).map(s => s.name).join(', ') || '없음', pass: !sinks.some(s => s.orphan) },
  { id: 'C4', name: `0~${LIMITS.earlyLastRank}단계 해금 공백 ${LIMITS.earlyGap - 1}단계 이하`, value: '최장 공백 ' + longestGap(0, LIMITS.earlyLastRank) + '단계', pass: longestGap(0, LIMITS.earlyLastRank) <= LIMITS.earlyGap - 1 },
  { id: 'C5', name: `${LIMITS.lateFromRank}단계 이후 해금 존재`, value: RANKS.filter(r => r.id >= LIMITS.lateFromRank).reduce((n, r) => n + r.unlocks.length, 0) + '종', pass: RANKS.some(r => r.id >= LIMITS.lateFromRank && r.unlocks.length) },
  { id: 'C6', name: `가공 시설이 원료 사슬보다 타일당 분당 가치 ${LIMITS.premium}배 이상`, value: processing.filter(e => e.premium < LIMITS.premium).map(e => `${e.name} ${e.premium}`).join(', ') || '전부 충족', pass: processing.every(e => e.premium >= LIMITS.premium) },
  { id: 'C7', name: `가공 시설 산출가/투입가 ${LIMITS.marginRatio}배 이상`, value: processing.filter(e => e.margin < LIMITS.marginRatio).map(e => `${e.name} ${e.margin}`).join(', ') || '전부 충족', pass: processing.every(e => e.margin >= LIMITS.marginRatio) },
  { id: 'C8', name: '해금 순서 모순 없음(요구 실적·투입·자재·계약)', value: problems.length ? problems.length + '건' : '없음', pass: !problems.length },
];

// ---------- output ----------
const report = { source: patchFile ? 'patch:' + patchFile : 'code', counts: { resources: Object.keys(RESOURCES).length, buildings: Object.keys(BUILDINGS).length, producers: economy.length, ranks: RANKS.length }, startSet, economy, support, sinks, ladder, emptyRanks, unlockRanks, problems, checks };
if (flag('--json')) { console.log(JSON.stringify(report, null, 1)); }
else {
  const table = (rows, cols) => { console.log('| ' + cols.map(c => c[0]).join(' | ') + ' |'); console.log('|' + cols.map(() => '---').join('|') + '|'); for (const r of rows) console.log('| ' + cols.map(c => { const v = c[1](r); return v === null || v === undefined ? '—' : String(v); }).join(' | ') + ' |'); console.log(''); };
  const fmt = o => Object.entries(o).map(([r, n]) => name(r) + ' ' + n).join(' · ') || '—';
  console.log(`# 밸런스 보고서 (${report.source})\n`);
  console.log(`자원 ${report.counts.resources}종 · 시설 ${report.counts.buildings}종(생산 ${report.counts.producers}) · 승급 ${report.counts.ranks}단계 · 시작 시설: ${startSet.map(name).join(', ')}\n`);
  console.log('## 1. 생산 시설 경제 (기준 속도·기준 가격)\n');
  table(economy, [['단계', e => e.rank], ['시설', e => e.name], ['그룹', e => e.group], ['주기s', e => e.period], ['투입', e => fmt(e.inputs)], ['산출', e => name(e.output) + ' ' + e.amount], ['산출/분', e => e.outPerMin], ['원가/분', e => e.inPerMin], ['순이익/분', e => e.netPerMin], ['건설가치', e => e.buildValue], ['회수(분)', e => e.paybackMin], ['타일당/분', e => e.tileValuePerMin], ['가공우위', e => e.premium], ['산출/투입', e => e.margin]]);
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
