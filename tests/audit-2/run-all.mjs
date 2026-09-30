// Runs every audit-2 probe (mid/late game, 2026-09-29). Default: report only. --regression: exit 1 while any finding reproduces.
// The probes load real bot saves from tests/audit-2/fixtures (regenerate: node tests/audit-2/campaign-trace.mjs).
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const probes=['pacing','money-sink','crisis-impact','diplomacy-unrest','labels-vs-rules','recipe-choice','upgrade-value','power-plants','late-facility-use','endgame'];
const regression=process.argv.includes('--regression');let total=0,hit=0,errors=0;
for(const p of probes){const r=spawnSync(process.execPath,['tests/audit-2/'+p+'.mjs'],{cwd:root,encoding:'utf8',env:process.env});
 if(r.status!==0){errors++;console.log('['+p+'] ERROR\n'+r.stderr.slice(0,800));continue;}
 for(const l of r.stdout.split('\n').filter(l=>/^(REPRODUCED|NOT-REPRODUCED) /.test(l))){total++;if(l.startsWith('REPRODUCED'))hit++;console.log(l.slice(0,260));}}
console.log(`\n audit-2 probes: ${hit} of ${total} checks reproduce a finding; ${errors} probe run errors`);
if(errors||(regression&&hit))process.exit(1);
