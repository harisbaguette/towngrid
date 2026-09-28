// Promotion requirements checked for (a) a means to satisfy them before the rank is attempted,
// (b) requirements already guaranteed by an earlier rank, and (c) the GAME_DESIGN.md tables vs code.
import {readFileSync} from 'node:fs';
import {RANKS,unlockRank} from '../../src/app/game/world.js';
import {BUILDINGS,RESOURCES} from '../../src/app/game/simulation.js';
import {expectBug,finish} from './_harness.mjs';
const monotonic=k=>/^(produced|sold):/.test(k)||['contracts','expansions','family','revenue','sites','deliveries','railRoutes','defense','investment','recognition'].includes(k);
const redundant=[],unreachable=[];const best={};
for(const r of RANKS.slice(1)){for(const [key,target,name] of r.requirements){
  if(monotonic(key)&&best[key]>=target)redundant.push({rank:r.id+1,name:r.name,req:name+' '+target,alreadyRequired:best[key]});
  const [kind,item]=key.split(':');if(kind==='produced'||kind==='sold'){const producers=Object.keys(BUILDINGS).filter(t=>BUILDINGS[t].output===item);if(!producers.some(t=>unlockRank(t)<r.id))unreachable.push({rank:r.id+1,req:name,producers:producers.map(t=>[t,unlockRank(t)])});}
 }for(const [key,target] of r.requirements)if(monotonic(key))best[key]=Math.max(best[key]||0,target);}
console.log('redundant',JSON.stringify(redundant,null,1));console.log('unreachable',JSON.stringify(unreachable));
expectBug('P1-requirements-already-met-by-earlier-rank',redundant.length>0,{count:redundant.length,items:redundant.map(v=>`${v.rank}.${v.name}: ${v.req} (earlier ${v.alreadyRequired})`)});
expectBug('P2-requirement-without-means',unreachable.length>0,unreachable);
// (c) GAME_DESIGN.md tables vs code.
const doc=readFileSync(new URL('../../docs/GAME_DESIGN.md',import.meta.url),'utf8');
const rankRows=[...doc.matchAll(/^\| (\d+) \| ([^|]+) \| ([^|]+) \| (\d+)G \|$/gm)].map(m=>({n:+m[1],name:m[2].trim(),fee:+m[4]}));
const rankDiff=rankRows.filter(r=>RANKS[r.n-1]?.name!==r.name||RANKS[r.n-1]?.fee!==r.fee);
const facRows=[...doc.matchAll(/^\| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm)].filter(m=>Object.values(BUILDINGS).some(b=>b.name===m[1].trim()));
const byName=Object.fromEntries(Object.entries(BUILDINGS).map(([id,b])=>[b.name,id]));
const facDiff=[];for(const m of facRows){const id=byName[m[1].trim()];if(!id){facDiff.push({doc:m[1].trim(),issue:'코드에 없는 시설명'});continue;}const unlock=m[4].trim(),codeUnlock=unlockRank(id)===0?'시작':RANKS[unlockRank(id)].name;if(unlock!==codeUnlock)facDiff.push({facility:m[1].trim(),doc:unlock,code:codeUnlock});
 const docIn=m[2].trim(),codeIn=Object.entries(BUILDINGS[id].inputs||{}).map(([r,n])=>RESOURCES[r].name+' '+n).join(' · ')||'—';if(docIn!==codeIn)facDiff.push({facility:m[1].trim(),docInputs:docIn,codeInputs:codeIn});}
console.log('doc rank rows',rankRows.length,'of',RANKS.length,'; facility rows',facRows.length,'of',Object.keys(BUILDINGS).length);
expectBug('D1-design-doc-rank-table-drift',rankDiff.length>0,rankDiff);
expectBug('D2-design-doc-facility-table-drift',facDiff.length>0,facDiff);
const missingInDoc=Object.values(BUILDINGS).map(b=>b.name).filter(n=>!facRows.some(m=>m[1].trim()===n));
expectBug('D3-facilities-missing-from-design-doc',missingInDoc.length>0,missingInDoc);
expectBug('D4-design-doc-says-GLB-residents',/관절형 GLB/.test(doc),{line:doc.split('\n').findIndex(l=>/관절형 GLB/.test(l))+1,note:'AGENTS.md: residents are 2D pixel atlases (public/assets/pixel-characters)'});
finish('progression-and-docs');
