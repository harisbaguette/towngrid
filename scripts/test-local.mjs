// Run existing headless regressions without a hosted preview or browser.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const suites = [
  'tests/simulation.mjs',
  'tests/residents.mjs',
  'tests/character-movement.mjs',
  'tests/campaign.mjs',
  'tests/release.mjs',
  'tests/pixel-environment.mjs',
  'tests/quarter-camera.mjs',
  'scripts/check-pixel-characters.mjs',
];
for (const suite of suites) {
  console.log(`\n[${suite}]`);
  const result = spawnSync(process.execPath, [suite], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('\nTownGrid local regression checks passed.');
