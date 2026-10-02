// Audit 3 (G3, code) probes, headless. `node tests/audit-3/code-run-all.mjs` prints every REPRODUCED/NOT-REPRODUCED
// line; with --regression it exits 1 while any code defect (not a control check) still reproduces.
import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const probes=['code-save','code-ledger','code-time','code-ui-gates','code-home-split','code-wiring'];let hit=0,total=0,errors=0;
for(const p of probes){const r=spawnSync(process.execPath,['tests/audit-3/'+p+'.mjs'],{cwd:root,encoding:'utf8',maxBuffer:1<<26});
 const lines=r.stdout.split('\n').filter(l=>/^(REPRODUCED|NOT-REPRODUCED) /.test(l));if(r.status!==0&&!lines.length){errors++;console.log('['+p+'] ERROR\n'+r.stderr.slice(0,600));continue;}
 for(const l of lines){total++;const control=/ control: /.test(l);if(l.startsWith('REPRODUCED'))hit++;console.log((control?'[control] ':'')+l.slice(0,260));}}
console.log(`\n G3 code probes: ${hit} of ${total} checks reproduce; ${errors} probe errors`);
if(errors||process.argv.includes('--regression')&&hit)process.exit(1);
