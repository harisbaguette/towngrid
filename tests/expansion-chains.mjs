// Regression checks for the 2026-09-29 expansion chains (docs/EXPANSION_20260929.md, docs/BALANCE_PATCH_20260928.md 13).
// Headless; only public game APIs and real ticks. Where a check sets state directly it says so.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Simulation,BUILDINGS,RESOURCES,CONTRACT_POOLS} from '../src/app/game/simulation.js';
import {Campaign} from '../src/app/game/campaign.js';
import {RANKS,unlockRank} from '../src/app/game/world.js';
import {encodeSave,decodeSave} from '../src/app/game/persistence.js';
import {EXPANSION_RESOURCES,EXPANSION_BUILDINGS,EXPANSION_RECIPES,EXPANSION_RANKS} from '../src/app/game/industry.js';
import {INFRA_BUILDINGS} from '../src/app/game/infrastructure.js';
import {permitted,itemGate} from '../src/app/game/ui-rules.js';
import {facilityStaff} from '../src/app/game/facility-staff.js';
import {crewFor} from '../src/app/game/logistics.js';

const run=(s,t)=>{for(let i=0;i<t*4;i++)s.tick(.25);};
const until=(s,cond,limit=150)=>{for(let i=0;i<limit*4&&!cond();i++)s.tick(.25);return cond();};
const reload=s=>new Simulation(s.region,decodeSave(encodeSave(s.save())));
/** A river town at the last rank with a warehouse, three houses and plenty of every resource (stock set directly). */
const town=()=>{const s=new Simulation('river');s.nextEvent=1e9;s.autoSell={};s.money=1e7;s.debt=0;s.rank=32;
 for(let x=0;x<6;x++)for(let z=0;z<6;z++)if(s.canExpand(x,z))s.expand(x,z);
 s.build('warehouse',11,12,true);for(const [x,z] of [[11,14],[9,12],[13,12]])s.build('house',x,z,true);
 for(const b of s.buildings)if(BUILDINGS[b.type].home)b.level=3;s.syncWorkers();for(const r of Object.keys(RESOURCES))s.stock[r]=150;return s;};
/** Free-build a facility on the nearest tile that passes every placement rule and is reachable from the warehouse. */
function place(s,type){
 const w=s.warehouse,tiles=s.tiles.filter(t=>s.canBuild(type,t.x,t.z,true)===null).sort((a,b)=>Math.abs(a.x-w.x)+Math.abs(a.z-w.z)-Math.abs(b.x-w.x)-Math.abs(b.z-w.z));
 for(const t of tiles){if(!s.routeTo(s.entries(w)[0],{x:t.x,z:t.z,size:1}))continue;if(s.build(type,t.x,t.z,true).ok)return s.at(t.x,t.z);}
 throw new Error('no tile for '+type);
}
/** Power, a road and the crew race for facilities that need them: a steam plant, a dirt road beside it, the crew's house,
 *  and wild clover beside an apiary (tests/expansion-rules.mjs covers the clover rule itself). */
function support(s,b){const d=BUILDINGS[b.type],crew=crewFor(s,b.type),house=crew&&Object.keys(BUILDINGS).find(t=>BUILDINGS[t].resident===crew);
 if(house&&!s.buildings.some(v=>v.type===house))place(s,house);
 if(b.type==='apiary')for(const [dx,dz] of [[1,1],[-1,1],[1,-1],[-1,-1],[2,0],[-2,0],[0,2],[0,-2]])if(s.canBuild('clover',b.x+dx,b.z+dz,true)===null&&s.build('clover',b.x+dx,b.z+dz,true).ok)break;
 if(d.power&&!s.buildings.some(v=>v.type==='generator'))place(s,'generator');
 if(d.road)for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=b.x+dx,z=b.z+dz;if(s.canBuild('road',x,z,true)===null&&s.build('road',x,z,true).ok)break;}
}

// 1. The spec's id table is the source: every id is registered under its Korean name (counted from the document).
const spec=fs.readFileSync(new URL('../docs/EXPANSION_20260929.md',import.meta.url),'utf8');
const section=(from,to)=>spec.slice(spec.indexOf(from),spec.indexOf(to));
const idsOf=text=>[...text.matchAll(/^\| [^|]+\| (.+) \|$/gm)].flatMap(m=>[...m[1].matchAll(/`([a-z]+)` ([^·`(]+?)(?:\([^)]*\))?\s*(?:·|$)/g)].map(v=>[v[1],v[2].trim()]));
const specResources=idsOf(section('## 1.','사슬(입력')),specBuildings=idsOf(section('## 2.','## 3.'));
assert.equal(specResources.length,35,'35 resource ids in the spec');assert.equal(specBuildings.length,22,'22 facility ids in the spec');
for(const [id,name] of specResources)assert.equal(RESOURCES[id]?.name,name,'resource '+id);
for(const [id,name] of specBuildings)assert.equal(BUILDINGS[id]?.name,name,'facility '+id);
assert.deepEqual(Object.keys(EXPANSION_RESOURCES).sort(),specResources.map(v=>v[0]).sort());assert.deepEqual(Object.keys(EXPANSION_BUILDINGS).sort(),specBuildings.map(v=>v[0]).sort());
assert.equal(Object.keys(RESOURCES).length,71);assert.equal(Object.keys(BUILDINGS).length,109);
for(const [id,r] of Object.entries(EXPANSION_RESOURCES))assert.ok(r.price>0&&/^#[0-9a-f]{6}$/.test(r.color),id+' has a price and an icon colour');
for(const [id,d] of Object.entries(EXPANSION_BUILDINGS)){assert.equal(d.size,1,id+' is one tile');assert.ok(d.description.length>20,id+' describes its rule');assert.equal(unlockRank(id),EXPANSION_RANKS[id],id+' unlock');}
for(const id of ['sugarfield','vineyard','cocoafarm','berryfield','mintfield','pumpkinpatch','oakfarm','saltfield','field','cottonfield','herbgarden'])assert.ok(BUILDINGS[id].waterNeed>0,id+' has a water demand');
assert.deepEqual([BUILDINGS.field.waterNeed,BUILDINGS.saltfield.waterNeed,BUILDINGS.cottonfield.waterNeed,BUILDINGS.oakfarm.waterNeed,BUILDINGS.sugarfield.waterNeed],[3,3,4,7,8],'the documented demands');
// The chains are optional: no promotion asks for a new resource or facility.
for(const r of RANKS)for(const [key] of r.requirements)assert.ok(!EXPANSION_RESOURCES[key.split(':')[1]]&&!EXPANSION_BUILDINGS[key.split(':')[1]],r.name+' asks only for old goods');
// Every new resource is made by some product line and used by another or sold as a finished good.
const lines=Object.entries(BUILDINGS).flatMap(([type,d])=>(d.recipes||[]).map(r=>({type,r})));
for(const id of Object.keys(EXPANSION_RESOURCES)){assert.ok(lines.some(l=>l.r.output===id),id+' has a producer');assert.ok(RESOURCES[id].final||lines.some(l=>l.r.inputs[id]),id+' is used or final');}

// 2. Balance data and docs match the code (docs/balance/patch-20260928.json, expansion20260929).
const patch=JSON.parse(fs.readFileSync(new URL('../docs/balance/patch-20260928.json',import.meta.url),'utf8')).expansion20260929;
assert.deepEqual(patch.resources.add,EXPANSION_RESOURCES);assert.deepEqual(patch.unlocks,EXPANSION_RANKS);assert.deepEqual(patch.recipes,EXPANSION_RECIPES);assert.deepEqual(patch.contract.pools,CONTRACT_POOLS.map(([below,base,extra])=>[below===Infinity?null:below,base,extra]));
for(const [id,d] of Object.entries(patch.buildings.add))for(const [k,v] of Object.entries(d))assert.deepEqual(BUILDINGS[id][k],v,id+'.'+k);
for(const [id,d] of Object.entries(patch.buildings.change))for(const [k,v] of Object.entries(d))assert.deepEqual(BUILDINGS[id][k],v,id+'.'+k);
assert.deepEqual([patch.counts.resources.after,patch.counts.buildings.after],[Object.keys(RESOURCES).length,Object.keys(BUILDINGS).length]);

// 3. Every product line that makes or uses a new resource really turns its inputs into its output.
const chainLines=lines.filter(({type,r})=>RESOURCES[r.output]&&(EXPANSION_BUILDINGS[type]||EXPANSION_RESOURCES[r.output]||Object.keys(r.inputs).some(k=>EXPANSION_RESOURCES[k])));
let checked=0;
for(const {type,r} of chainLines){
 const s=town(),b=place(s,type);support(s,b);if(r.id!==BUILDINGS[type].recipes[0].id)assert.ok(s.setRecipe(b.id,r.id).ok,type+' switches to '+r.id);
 const need=s.effectiveInputs(b),total=k=>s.stock[k]+(b.inputs[k]||0)+(b.batch?.[k]||0)+s.workers.reduce((n,w)=>n+(w.task?.item===k&&w.task.carried?w.task.amount:0),0);
 const before=Object.fromEntries(Object.keys(need).map(k=>[k,total(k)])),made=s.produced[r.output]||0;
 assert.ok(until(s,()=>(s.produced[r.output]||0)>made),type+':'+r.id+' produces '+r.output+' (status '+b.status+')');
 assert.equal((s.produced[r.output]||0)-made,r.amount*b.cycles,type+':'+r.id+' makes its amount per cycle');
 // Inputs the support plant also burns (water, wood) are left out of the ledger.
 for(const [k,n] of Object.entries(need))if(!s.buildings.some(v=>v!==b&&s.recipeOf(v).inputs?.[k]))assert.equal(before[k]-total(k),n*(b.cycles+(b.progress>0?1:0)),type+':'+r.id+' consumes '+k);
 checked++;
}
assert.equal(checked,chainLines.length);

// 4. Switching to a new product loses nothing: the running batch, loaded inputs and finished goods return to the warehouse.
for(const [type,from,to] of [['bakery','bread','jam'],['sawmill','plank','barrel'],['packshop','foodparcel','giftparcel'],['smelter','steel','bluesteel']]){
 const s=town(),b=place(s,type);support(s,b);if(s.recipeOf(b).id!==from)s.setRecipe(b.id,from);
 assert.ok(until(s,()=>b.progress>0.2),type+' is mid-cycle');b.out+=2;/* pad set directly */
 const carried=k=>s.workers.reduce((n,w)=>n+(w.task?.carried&&w.task.item===k?w.task.amount:0),0);
 const items=[...new Set([...Object.keys(BUILDINGS[type].recipes.find(r=>r.id===from).inputs),s.recipeOf(b).output])];
 const before=Object.fromEntries(items.map(k=>[k,s.stock[k]+(b.inputs[k]||0)+(b.batch?.[k]||0)+(k===s.recipeOf(b).output?b.out:0)+carried(k)]));
 assert.ok(s.setRecipe(b.id,to).ok);assert.equal(b.progress,0);assert.equal(b.out,0);
 for(const k of items)assert.equal(s.stock[k]+(b.inputs[k]||0)+carried(k),before[k],type+' keeps '+k);
 assert.equal(s.recipeOf(reload(s).at(b.x,b.z)).id,to,'the chosen product survives a save');
}

// 5. Locks: each facility and each alternative waits for its rank; the market opens with the first product line.
for(const [id,rank] of Object.entries(EXPANSION_RANKS)){const s=town();s.rank=rank-1;const t=s.tiles.find(t=>s.canBuild(id,t.x,t.z,true)===null);assert.ok(t,id+' has a tile');assert.equal(s.canBuild(id,t.x,t.z),RANKS[rank].name+' 승급이 필요합니다',id+' is locked');s.rank=rank;assert.notEqual(s.canBuild(id,t.x,t.z),RANKS[rank].name+' 승급이 필요합니다');}
for(const [type,list] of Object.entries(EXPANSION_RECIPES))for(const r of list){const s=town(),b=place(s,type);s.rank=r.unlock-1;assert.match(s.setRecipe(b.id,r.id).error,/승급이 필요합니다/,type+':'+r.id+' is locked');s.rank=r.unlock;assert.ok(s.setRecipe(b.id,r.id).ok,type+':'+r.id+' opens');}
{const s=town();s.rank=2;assert.equal(permitted(s,'sugar'),false);assert.equal(itemGate(s,'sugar',999),RANKS[3].name+' 승급 후');assert.equal(s.buy('sugar',5).ok,false,'sugar cannot be imported before it may be made');
 s.rank=3;assert.equal(permitted(s,'sugar'),true,'an alternative product counts for the market');assert.equal(itemGate(s,'sugar',999),'');assert.ok(s.buy('sugar',5).ok);}

// 6. Terrain facilities are one-tile ground with no production and no staff; demolition refunds 40% and frees the tile.
for(const id of ['pond','pasture','clover']){const s=town(),b=place(s,id);assert.equal(BUILDINGS[id].period,undefined);assert.equal(facilityStaff(s,b),null);run(s,2);assert.equal(b.status,'정상 운영');
 const money=s.money;assert.ok(s.demolish(b.x,b.z).ok);assert.equal(s.money-money,Math.floor(BUILDINGS[id].cost*.4));assert.equal(s.at(b.x,b.z),undefined);assert.equal(s.canBuild('house',b.x,b.z,true),null,'the tile is free again');}
// Placement rules of the new raw facilities: clay by the water, sand faster on sand ground.
{const s=town();const far=s.tiles.find(t=>s.ownedAt(t.x,t.z)&&t.terrain!=='water'&&!s.at(t.x,t.z)&&!s.nearWater(t.x,t.z,1,2));assert.equal(s.canBuild('clayfield',far.x,far.z,true),'강이나 바다에서 2칸 이내에 놓으세요');
 const t=s.tiles.find(t=>t.terrain!=='water');const old=t.ground;t.ground='sand';/* ground set directly */assert.equal(s.tileMultiplier('sandpit',t.x,t.z),1.25);t.ground=old;}
// Solar power runs with no fuel and loses 20% per shade step.
{const s=town(),b=place(s,'solarpanel');assert.ok(until(s,()=>s.power,60),'the panel powers the town');const before=s.placementEffects('solarpanel',b.x,b.z);assert.equal(before.speed,Math.max(.4,1-before.shade*.2));
 for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])if(s.canBuild('refinery',b.x+dx,b.z+dz,true)===null){s.build('refinery',b.x+dx,b.z+dz,true);break;}/* a tall refinery casts three shade steps */
 const shaded=s.placementEffects('solarpanel',b.x,b.z);assert.equal(shaded.shade,3);assert.equal(shaded.speed,.4,'three shade steps: 40%');assert.ok(shaded.speed<before.speed||before.shade===3);}
// Livestock suffers pollution like the hen house.
{const s=town(),b=place(s,'sheeppen');for(const [dx,dz] of [[2,0],[-2,0],[0,2],[0,-2]])if(s.canBuild('smelter',b.x+dx,b.z+dz,true)===null){s.build('smelter',b.x+dx,b.z+dz,true);break;}assert.ok(s.placementEffects('sheeppen',b.x,b.z).speed<1,'a smelter nearby slows the sheep pen');}

// 7. Contracts: the lord orders a new good only while a facility of the campaign is set to make it.
{const s=town();s.rank=4;const items=()=>{const seen=new Set();for(let n=0;n<12;n++){s.contracts=n;seen.add(s.contract().item);}s.contracts=0;return seen;};/* contract counter set directly */
 assert.ok(![...items()].some(i=>EXPANSION_RESOURCES[i]),'no new good without a producer');place(s,'berryfield');assert.ok(items().has('strawberry'),'a strawberry field brings strawberry orders');}
for(let rank=0;rank<RANKS.length;rank++){const s=new Simulation();s.rank=rank;for(let n=0;n<8;n++){s.contracts=n;assert.ok(!EXPANSION_RESOURCES[s.contract().item],'rank '+rank+' asks only for old goods on a new map');}}
{const s=town();s.rank=32;const b=place(s,'packshop');s.setRecipe(b.id,'giftparcel');let found=false;for(let n=0;n<12&&!found;n++){s.contracts=n;const c=s.contract();if(c.item==='giftparcel'){found=true;assert.equal(c.amount,2,'a costly parcel is ordered two at a time');}}assert.ok(found);}

// 8. Saves: new stock, facilities and recipes survive; saves from before the expansion load with the new goods at zero.
{const s=town();for(const t of ['vineyard','winery','sheeppen','apiary','pond'])place(s,t);const v=s.buildings.find(b=>b.type==='vineyard');s.setRecipe(v.id,'grapewhite');s.stock.giftparcel=3;/* stock set directly */run(s,20);
 const back=reload(s);assert.deepEqual(back.buildings.map(b=>[b.type,b.recipe]),s.buildings.map(b=>[b.type,b.recipe]));for(const r of Object.keys(EXPANSION_RESOURCES))assert.equal(back.stock[r],s.stock[r],r);run(back,10);}
{const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/save-before-20260928.json',import.meta.url),'utf8'));
 for(const key of ['demo','early']){const raw=JSON.parse(fixture[key]).game;assert.ok(raw.sites.every(v=>Object.keys(EXPANSION_RESOURCES).every(r=>v.simulation.stock[r]===undefined)),'the fixture predates the new goods');
  const c=new Campaign({saved:decodeSave(fixture[key])});for(const site of c.sites)for(const r of Object.keys(EXPANSION_RESOURCES))assert.equal(site.sim.stock[r],0,key+' '+r+' starts at zero');
  for(let i=0;i<4*60;i++)c.tick(.25);const again=decodeSave(encodeSave(c.save()));assert.ok(again.sites.every(v=>v.simulation.version===8&&Object.keys(EXPANSION_RESOURCES).every(r=>Number.isFinite(v.simulation.stock[r]))));}}
// Infrastructure and expansion never overlap, and every new facility is in exactly one rank's unlock list.
assert.ok(Object.keys(EXPANSION_BUILDINGS).every(id=>!INFRA_BUILDINGS[id]&&RANKS.filter(r=>r.unlocks.includes(id)).length===1));

console.log(`PASS expansion chains: ${specResources.length} resources, ${specBuildings.length} facilities from the spec; ${checked} product lines produce; switches lose nothing; locks, market, terrain, solar, contracts, saves and old saves.`);
