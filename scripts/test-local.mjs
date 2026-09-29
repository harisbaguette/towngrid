// Run existing headless regressions without a hosted preview or browser.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const suites = [
  'tests/simulation.mjs',
  'tests/export-route.mjs',
  'tests/trade-routes.mjs',
  'tests/trade-terminals.mjs',
  'tests/world-grid.mjs',
  'tests/map-edges.mjs',
  'tests/biomes.mjs',
  'tests/residents.mjs',
  'tests/facility-staff.mjs',
  'tests/character-movement.mjs',
  'tests/character-motion.mjs',
  'tests/campaign.mjs',
  'tests/balance-20260928.mjs',
  'tests/second-pass-20260928.mjs',
  'tests/expansion-chains.mjs',
  'tests/release.mjs',
  'tests/pixel-environment.mjs',
  'tests/pixel-industry.mjs',
  'tests/pixel-world.mjs',
  'tests/art-completion.mjs',
  'tests/quarter-camera.mjs',
  'tests/screen-art.mjs',
  'scripts/check-pixel-characters.mjs',
  // 2026-09-28 audit probes whose simulation-side defects are fixed; --regression fails if one comes back.
  ...['export-chokepoint','raid-gated-trial','events-early','progression-and-docs','stock-ledger','save-edges','debt-spiral','branch-site','sapling-timer'].map(p=>['tests/audit/'+p+'.mjs','--regression']),
];
for (const entry of suites) {
  const [suite, ...args] = [].concat(entry);
  console.log(`\n[${suite}]`);
  const result = spawnSync(process.execPath, [suite, ...args], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('\nTownGrid local regression checks passed.');
