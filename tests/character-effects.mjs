import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {footStrikes,workImpact} from '../src/app/game/character-effects.js';

// Every packed resident must give the motion effects real cues, whatever rig
// produced the cels: jointed feet, Bron's authored support side, or hover.
const people=readdirSync('public/assets/pixel-characters',{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name);
let strikes=0,impacts=0;
for(const id of people){
 const meta=JSON.parse(readFileSync(`public/assets/pixel-characters/${id}/frames.json`));
 for(let direction=0;direction<4;direction++){
  const audit=meta.rigAudit?.[direction]||[];
  for(const action of ['walk','carry']){
   const frames=meta.clips?.[action]?.frames||[];let previous=null,count=0;
   // Two loops, so the strike at the cycle seam is counted once per cycle.
   for(const frame of [...frames,...frames]){
    const cel=audit[frame],found=previous?footStrikes(previous,cel):[];
    for(const sole of found)assert.ok(sole.every(Number.isFinite),`${id} ${action} sole`);
    count+=found.length;
    previous={contacts:cel?.feet?.map(foot=>foot.contact&&!(foot.lift>.001))||[],support:cel?.support};
   }
   if(meta.locomotionMode==='hover')continue;
   assert.ok(count>=2,`${id} ${action} facing ${direction}: ${count} foot strikes in two cycles`);
   strikes+=count;
  }
  const impact=workImpact(meta,direction);
  assert.ok(impact&&meta.clips.work.frames.includes(impact.frame)&&impact.point.every(Number.isFinite),`${id} work impact facing ${direction}`);
  impacts++;
 }
}
// Sheets packed before tool pivots existed still land a swing on the wrist.
const legacy=JSON.parse(readFileSync('public/assets/pixel-characters/ael/frames.json'));
for(const cel of legacy.rigAudit.flat())delete cel?.tool;
assert.ok(workImpact(legacy,0)?.frame!==undefined,'tool-less sheet still has an impact frame');
assert.deepEqual(footStrikes({contacts:[]},{action:'work',feet:[]}),[],'an empty cel never strikes');
console.log(`Character effects: ${people.length} residents, ${strikes} foot strikes and ${impacts} work impacts across four facings.`);
