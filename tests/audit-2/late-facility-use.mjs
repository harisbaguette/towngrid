// audit-2: what a late facility can still change once it is unlocked. Transit facilities (output 'transit') only shorten
// campaign routes between sites (campaign.js tickRoute). Routes earn nothing themselves; they matter to ranks that count
// 'deliveries' or 'railRoutes'. List, for each transit facility, the rank requirements left after it unlocks.
import {BUILDINGS} from '../../src/app/game/simulation.js';
import {RANKS,unlockRank} from '../../src/app/game/world.js';
import {expectBug,finish} from './_fixture.mjs';
const rows=Object.entries(BUILDINGS).filter(([,d])=>d.output==='transit').map(([type,d])=>{const u=unlockRank(type);const left=RANKS.filter(r=>r.id>u).flatMap(r=>r.requirements.filter(q=>['deliveries','railRoutes'].includes(q[0])).map(q=>r.id+' '+r.name+': '+q[2]+' '+q[1]));return {type,name:d.name,unlocks:u+' '+RANKS[u].name,cost:d.cost,materials:d.materials,burns:d.inputs,routeRequirementsLeft:left};});
for(const r of rows)console.log(JSON.stringify(r));
const air=rows.find(r=>r.type==='airdock');
expectBug('F1 비공정 선착장 opens after the last rank that counts routes, so it speeds up trips that no longer matter',air&&air.routeRequirementsLeft.length===0,{airdock:air,note:'routes pay nothing themselves (campaign.js tickRoute moves stock between sites); after rank 28 no rank counts deliveries or railRoutes'});
finish('late-facility-use');
