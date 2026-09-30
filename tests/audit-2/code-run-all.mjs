// Code audit (C) probes, headless. `node tests/audit-2/code-run-all.mjs` prints every REPRODUCED/NOT-REPRODUCED line;
// with --regression it exits 1 while any code defect still reproduces. code-perf.mjs (measurements) and
// code-storage-quota.mjs (needs playwright + chrome) run on their own.
import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const probes=['code-sites','code-save','code-fuel','code-demolish','code-raid','code-churn','code-speed'];let hit=0,total=0,errors=0;
for(const p of probes){const r=spawnSync(process.execPath,['tests/audit-2/'+p+'.mjs'],{cwd:root,encoding:'utf8',maxBuffer:1<<26});
 const lines=r.stdout.split('\n').filter(l=>/^(REPRODUCED|NOT-REPRODUCED) /.test(l));if(r.status!==0&&!lines.length){errors++;console.log('['+p+'] ERROR\n'+r.stderr.slice(0,600));continue;}
 for(const l of lines){total++;if(l.startsWith('REPRODUCED'))hit++;console.log(l.slice(0,240));}}
console.log(`\n code audit probes: ${hit} of ${total} checks reproduce a defect; ${errors} probe errors`);
if(errors||process.argv.includes('--regression')&&hit)process.exit(1);
