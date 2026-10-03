// Runs every headless audit-3 probe in this folder: every *.mjs except helpers (_*), browser probes (browser-*) and
// runners (run-*, *-run-all), so a probe added by any team is picked up without editing this file.
//   node tests/audit-3/run-all.mjs                 report every REPRODUCED / NOT-REPRODUCED line
//   node tests/audit-3/run-all.mjs --regression    exit 1 while any finding (not a [control] check) still reproduces
//   node tests/audit-3/run-all.mjs --only=G1       count only findings whose ID starts with G1 (G3, ...)
// A finding handed to another owner carries the owner in brackets after its ID, e.g. "G1-E4 [R simulation.js ...]".
import {spawnSync} from 'node:child_process';import fs from 'node:fs';import {fileURLToPath} from 'node:url';
const here=fileURLToPath(new URL('./',import.meta.url)),root=fileURLToPath(new URL('../../',import.meta.url));
const only=(process.argv.find(a=>a.startsWith('--only='))||'').slice(7);
const probes=fs.readdirSync(here).filter(f=>f.endsWith('.mjs')&&!/^(_|browser-|run-)/.test(f)&&!/-run-all\.mjs$/.test(f)).sort();
let hit=0,total=0,errors=0;const byOwner={};
for(const f of probes){const r=spawnSync(process.execPath,['tests/audit-3/'+f],{cwd:root,encoding:'utf8',maxBuffer:1<<27,env:process.env});
 const lines=r.stdout.split('\n').filter(l=>/^(REPRODUCED|NOT-REPRODUCED) /.test(l));
 if(r.status!==0&&!lines.length){errors++;console.log('['+f+'] ERROR\n'+(r.stderr||r.stdout).slice(0,800));continue;}
 for(const l of lines){const id=l.replace(/^(NOT-)?REPRODUCED /,''),control=/^\[control\]| control: /.test(id);if(only&&!id.replace(/^\[control\] /,'').startsWith(only))continue;
  total++;const owner=(/^\S+ \[([^\]\s]+)/.exec(id)||[])[1]||'-';if(l.startsWith('REPRODUCED')&&!control){hit++;byOwner[owner]=(byOwner[owner]||0)+1;}
  console.log(f.padEnd(26)+' '+l.slice(0,240));}}
console.log(`\n audit-3 probes (${probes.length} files${only?', only '+only:''}): ${hit} of ${total} checks reproduce a finding; ${errors} probe errors`+(hit?' · open by owner '+JSON.stringify(byOwner):''));
if(errors||(process.argv.includes('--regression')&&hit))process.exit(1);
