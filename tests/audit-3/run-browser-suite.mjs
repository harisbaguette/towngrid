// Audit 2026-09-30 (G2): runs every browser test and browser audit probe once, in an isolated copy of tests/ + src/app/game
// (work/audit3-sandbox, gitignored) so their hard-coded screenshot folders never overwrite tracked evidence of other windows.
// Usage: node tests/audit-3/run-browser-suite.mjs <playwright/index.mjs> <chrome.exe> [concurrency=3] [filter-substring]
// Output: work/audit3-sandbox/logs/<name>.log and docs/verification/audit-20260930/browser-suite.json
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(new URL('../../', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const sandbox = join(root, 'work/audit3-sandbox');
const [pw, chrome, conc = '3', filter = ''] = process.argv.slice(2);
const logs = join(sandbox, 'logs'); await mkdir(logs, { recursive: true });
const tests = (await readdir(join(sandbox, 'tests'))).filter(f => f.endsWith('-browser.mjs')).map(f => 'tests/' + f);
tests.push('tests/art-completion-game.mjs');
for (const [dir, re] of [['tests/audit', /^browser-.*\.mjs$/], ['tests/audit-2', /^browser-.*\.mjs$/], ['tests/fix-20260929', /^probe-.*\.mjs$/], ['tests/fix-20260930', /\.mjs$/]])
  for (const f of await readdir(join(sandbox, dir))) if (re.test(f)) tests.push(dir + '/' + f);
const list = tests.filter(t => t.includes(filter));
const results = [];
const run = t => new Promise(done => {
  const name = t.replace(/[\\/]/g, '__'), t0 = Date.now(), chunks = [];
  const env = { ...process.env, TOWNGRID_URL: 'http://localhost:5173', TG_OUT: 'docs/verification/audit-3-out/' + name.replace('.mjs', ''), TOWNGRID_PLAYWRIGHT: pw, TOWNGRID_CHROME: chrome };
  const child = spawn(process.execPath, [t, pw, chrome], { cwd: sandbox, env });
  const limit = setTimeout(() => { chunks.push('\n[runner] TIMEOUT 25 min, killed\n'); child.kill(); }, 25 * 60 * 1000);
  child.stdout.on('data', d => chunks.push(d.toString())); child.stderr.on('data', d => chunks.push(d.toString()));
  child.on('close', async code => {
    clearTimeout(limit); const text = chunks.join('');
    await writeFile(join(logs, name + '.log'), text);
    const r = { test: t, exit: code, seconds: Math.round((Date.now() - t0) / 1000), tail: text.trim().split('\n').slice(-12).join('\n') };
    results.push(r); console.log((code === 0 ? 'PASS ' : 'FAIL ') + t + ' ' + r.seconds + 's'); done();
  });
});
const queue = [...list];
await Promise.all(Array.from({ length: +conc }, async () => { while (queue.length) await run(queue.shift()); }));
results.sort((a, b) => a.test.localeCompare(b.test));
const out = join(root, 'docs/verification/audit-20260930'); await mkdir(out, { recursive: true });
await writeFile(join(out, 'browser-suite' + (filter ? '-' + filter.replace(/\W/g, '_') : '') + '.json'), JSON.stringify({ at: new Date().toISOString(), count: results.length, pass: results.filter(r => r.exit === 0).length, results }, null, 1));
console.log('done', results.filter(r => r.exit === 0).length, 'of', results.length);
