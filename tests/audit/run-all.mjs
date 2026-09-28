// Runs every headless audit probe. Default: report only (exit 0). With --regression: exit 1 while any
// audited defect still reproduces, so the fix owner can turn this into a gate once the fixes land.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const probes=['first-ten-minutes','export-chokepoint','hints-vs-rules','events-early','progression-and-docs','raid-gated-trial','stock-ledger','save-edges','debt-spiral','branch-site','sapling-timer'];
const regression=process.argv.includes('--regression');let total=0,hit=0,failedRuns=0;
for(const p of probes){const r=spawnSync(process.execPath,['tests/audit/'+p+'.mjs'],{cwd:root,encoding:'utf8'});
 // A non-zero exit is a defect report only when the probe printed a REPRODUCED line; anything else is a crash.
 if(r.status!==0&&(!regression||!/^REPRODUCED /m.test(r.stdout))){failedRuns++;console.log('['+p+'] ERROR\n'+r.stderr.slice(0,800));continue;}
 const lines=r.stdout.split('\n').filter(l=>/^(REPRODUCED|NOT-REPRODUCED) /.test(l));for(const l of lines){total++;if(l.startsWith('REPRODUCED'))hit++;console.log(l.slice(0,220));}}
console.log(`\n audit probes: ${hit} of ${total} checks reproduce a defect; ${failedRuns} probe run errors`);
if(failedRuns||(regression&&hit))process.exit(1);
