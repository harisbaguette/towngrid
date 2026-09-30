// audit-2 (2026-09-29): static economics of every product recipe at list price.
// value added per second = (output price x amount - inputs at list price) / period. Negative = processing destroys value
// compared with selling the inputs raw. Also lists, per resource, every consumer (facility input, build material, council,
// contract pool, rank requirement), so dead-end goods show up.
import {BUILDINGS,RESOURCES} from '../../src/app/game/simulation.js';
import {RANKS,unlockRank} from '../../src/app/game/world.js';
const rows=[];
for(const [type,d] of Object.entries(BUILDINGS)){if(!d.recipes)continue;for(const r of d.recipes){if(!RESOURCES[r.output])continue;
 const out=RESOURCES[r.output].price*r.amount,inp=Object.entries(r.inputs||{}).reduce((n,[k,v])=>n+RESOURCES[k].price*v,0);
 rows.push({type,recipe:r.id,alt:r!==d.recipes[0],unlock:Math.max(unlockRank(type),r.unlock||0),out:r.output,amount:r.amount,period:r.period,gross:+(out/r.period).toFixed(2),added:+((out-inp)/r.period).toFixed(2),inputCost:inp,build:d.cost});}}
rows.sort((a,b)=>a.unlock-b.unlock);
console.log('type/recipe unlock out amt period gross/s added/s build');
for(const r of rows)console.log(`${r.type}/${r.recipe}${r.alt?'*':''} r${r.unlock} ${r.out} x${r.amount} ${r.period}s gross ${r.gross} added ${r.added} build ${r.build}`);
// consumers of each resource
const uses={};const add=(r,w)=>{(uses[r]??=[]).push(w);};
for(const [type,d] of Object.entries(BUILDINGS)){for(const r of d.recipes||[])for(const k of Object.keys(r.inputs||{}))add(k,'input:'+type+'/'+r.id);for(const k of Object.keys(d.materials||{}))add(k,'material:'+type);}
for(const rk of RANKS)for(const [key] of rk.requirements){const [kind,item]=key.split(':');if(item&&RESOURCES[item])add(item,kind+'@r'+rk.id);}
console.log('\nresource price consumers');
for(const r of Object.keys(RESOURCES))console.log(r,RESOURCES[r].price,RESOURCES[r].final?'final':'',(uses[r]||[]).length,JSON.stringify(uses[r]||[]));
export {rows,uses};
