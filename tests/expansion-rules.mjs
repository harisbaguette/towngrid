// Regression checks for the five terrain rules and the three terrain facilities of 2026-09-29
// (docs/EXPANSION_20260929.md 3, docs/BALANCE_PATCH_20260928.md 14), and the shallow mine and wind pump of 2026-09-30
// (the same spec 6, balance doc 17). Headless; real ticks where production is claimed.
// Land ownership, stock and ranks are set directly so each case can be placed where the rule acts; comments say so.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Simulation,BUILDINGS,RESOURCES} from '../src/app/game/simulation.js';
import {Campaign} from '../src/app/game/campaign.js';
import {PROVINCES} from '../src/app/game/territory.js';
import {layoutOf,legacyLayout} from '../src/app/game/world-grid.js';
import {encodeSave,decodeSave} from '../src/app/game/persistence.js';
import {EMISSIONS,HEIGHTS,MINES,HERDS,WATER_RING,OPEN_WATER,CLUSTER_STEP,CLUSTER_MAX,terrainRules,effectNotes,productionDiagnosis,operationHint} from '../src/app/game/proximity.js';
import {blockHint} from '../src/app/game/ui-rules.js';

const run=(s,t)=>{for(let i=0;i<t*4;i++)s.tick(.25);};
const cheb=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.z-b.z));
const reload=s=>new Simulation(s.region,decodeSave(encodeSave(s.save())));
/** The placement rule as it stood before 2026-09-29 (commit bc700b2), kept verbatim as the reference for old maps. */
function oldEffects(sim,type,x,z){
 let pollution=0,shade=0,windBlock=0,water=0;const crop=!!BUILDINGS[type]?.irrigable;
 for(const b of sim.buildings){if(b.x===x&&b.z===z)continue;const distance=Math.max(Math.abs(b.x-x),Math.abs(b.z-z));
  const dirty=EMISSIONS[b.type]||0,height=HEIGHTS[b.type]||0;
  if(b.health>0&&b.enabled!==false&&dirty&&distance<=dirty)pollution+=dirty+1-distance;
  if(height&&distance<=height){shade=Math.max(shade,height+1-distance);windBlock=Math.max(windBlock,height+1-distance);}
  if(crop&&b.type==='reservoir'&&b.health>0&&b.enabled!==false&&b.activeUntil>sim.time&&distance<=2)water=1;}
 if(crop)for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){const t=sim.tile(x+dx,z+dz);if(t?.terrain==='water'&&t.water!=='coast')water=1;}
 pollution=Math.min(6,pollution);shade=Math.min(3,shade);windBlock=Math.min(3,windBlock);
 const sensitive=crop||['stable','dock','henhouse','sheeppen','milkbarn','duckhouse','apiary'].includes(type),wind=['mill','windturbine'].includes(type);
 const speed=(sensitive?Math.max(.4,1-pollution*.1-(crop?shade*.1:0)):1)*(wind?Math.max(.4,1-windBlock*.2):1)*(type==='solarpanel'?Math.max(.4,1-shade*.2):1);
 return {water,pollution,shade,windBlock,speed};
}
/** A site of the world grid (new rules) whose layout passes `test`, with every tile owned, a warehouse and three houses. */
function site(test){
 const p=PROVINCES.find(p=>{const s=new Simulation('river',null,{provinceId:p.id,nation:p.nation});return test(s);});assert.ok(p,'a province for the case');
 const s=new Simulation('river',null,{provinceId:p.id,nation:p.nation});s.nextEvent=1e9;s.autoSell={};s.money=1e7;s.debt=0;s.rank=32;
 for(const t of s.tiles)s.owned.add(t.x+','+t.z);/* land owned directly */
 s.build('warehouse',11,12,true);for(const [x,z] of [[11,14],[9,12],[13,12]])s.build('house',x,z,true);
 for(const b of s.buildings)if(BUILDINGS[b.type].home)b.level=3;s.syncWorkers();for(const r of Object.keys(RESOURCES))s.stock[r]=150;/* stock set directly */
 return s;
}
const dryAt=(s,t)=>t&&t.terrain!=='water'&&!s.at(t.x,t.z)&&!s.roads.has(t.x+','+t.z);
const nearest=(s,t,pred)=>Math.min(99,...s.tiles.filter(pred).map(u=>cheb(t,u)));
const isMountain=u=>u.ground==='mountain',isFresh=u=>u.terrain==='water'&&u.water!=='coast',isSea=u=>u.water==='coast',isWater=u=>u.terrain==='water';
/** A free tile with no other rule acting on it: no water or sea within 2, no mountain within 5, nothing built within 3. */
const quiet=(s,extra=()=>true)=>s.tiles.find(t=>dryAt(s,t)&&t.x>2&&t.z>2&&t.x<21&&t.z<21&&nearest(s,t,isWater)>3&&nearest(s,t,isMountain)>5&&s.buildings.every(b=>cheb(b,t)>3)&&extra(t));
const ok=[];

// 0. Which maps play the new rules: a map with land.ecology does; a map from before the biomes keeps the old rules.
{const legacy=new Simulation('river'),grid=site(s=>!!s.layout.ecology);assert.equal(terrainRules(legacy),false);assert.equal(terrainRules(grid),true);
 const back=reload(grid);assert.equal(terrainRules(back),true,'the flag lives in the saved land');
 const raw=grid.save();delete raw.land.ecology;assert.equal(terrainRules(new Simulation('river',raw)),false,'a grid save without ecology keeps the old rules');ok.push('rule gate');}

// 1. Mountains cast shade and shelter wind up to five tiles, in steps 3,2,2,1,1.
{const s=site(s=>s.tiles.some(isMountain));const steps=[];
 for(let r=1;r<=6;r++){const t=s.tiles.find(t=>dryAt(s,t)&&t.ground!=='mountain'&&nearest(s,t,isMountain)===r&&s.buildings.every(b=>cheb(b,t)>3));assert.ok(t,'a tile '+r+' from the mountain');
  const e=s.placementEffects('solarpanel',t.x,t.z);steps.push(e.mountain);assert.equal(e.shade,e.mountain);
  assert.equal(e.speed,Math.max(.4,1-e.shade*.2),'solar loses 20% a step');assert.equal(s.placementEffects('windturbine',t.x,t.z).windBlock,e.mountain,'the mountain blocks wind the same');
  if(r===1)assert.ok(s.placementEffects('field',t.x,t.z).speed<=.7+1e-9,'a crop at the foot loses 30%');}
 assert.deepEqual(steps,[3,2,2,1,1,0],'staircase to five tiles, none at six');
 // Off on an old map: the same terrain question never reaches the rule.
 const hill=PROVINCES.find(p=>Object.values(layoutOf(p.id).edges).includes('mountain')),old=new Simulation('highland',null,{land:legacyLayout('highland',hill.id)});const peak=old.tiles.find(isMountain);assert.ok(peak,'the old map has mountain ground');
 const n=old.tiles.find(u=>u.terrain!=='water'&&!isMountain(u)&&nearest(old,u,isMountain)===1);assert.equal(terrainRules(old),false);assert.equal(old.placementEffects('solarpanel',n.x,n.z).shade,0,'no mountain shade on an old map');
 // A real panel at the foot of the mountain makes power more slowly than one in the open (ticks).
 const foot=s.tiles.find(t=>dryAt(s,t)&&t.ground!=='mountain'&&nearest(s,t,isMountain)===1&&s.buildings.every(b=>cheb(b,t)>3)),open=quiet(s);
 s.build('solarpanel',foot.x,foot.z,true);s.build('solarpanel',open.x,open.z,true);const a=s.at(foot.x,foot.z),b=s.at(open.x,open.z);run(s,1);
 const pa=a.progress,pb=b.progress;run(s,2);assert.ok((a.progress-pa)<(b.progress-pb)*.5,'three shade steps slow the panel to 40%');ok.push('mountain shade 3,2,2,1,1');}

// 2. Same-kind facilities on the eight tiles around (corners count) cut the production time by 10% each, at most by 30%
//    (the cap was 50% until C12 of 2026-09-30: a clustered raw field then out-earned its processing plant).
{const s=site(s=>!!s.layout.ecology);const ring=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
 const c=quiet(s,t=>[[0,0],[2,0],...ring].every(([dx,dz])=>dryAt(s,s.tile(t.x+dx,t.z+dz))));
 s.build('well',c.x,c.z,true);assert.equal(s.placementEffects('well',c.x,c.z).cluster,0);
 const speeds=[];for(const [dx,dz] of ring.slice(0,6)){s.build('well',c.x+dx,c.z+dz,true);speeds.push(+s.placementEffects('well',c.x,c.z).speed.toFixed(4));}
 assert.deepEqual(speeds,[1,2,3,3,3,3].map(n=>+(1/(1-n*CLUSTER_STEP)).toFixed(4)),'time 90%, 80%, 70%, then capped');assert.equal(CLUSTER_MAX,3);assert.ok(Math.abs(CLUSTER_STEP*CLUSTER_MAX-.3)<1e-9,'at most 30% of the time');
 assert.equal(s.placementEffects('well',c.x+2,c.z).cluster,2,'the next tile sees a side and a corner');assert.equal(s.placementEffects('quarry',c.x+2,c.z).cluster,0,'another kind does not count');
 // Placement, not state: a stopped or broken neighbour still counts, and a reload gives the same numbers.
 s.setOperation(s.at(c.x+1,c.z).id,false);s.at(c.x-1,c.z).health=0;/* damage set directly */assert.equal(s.placementEffects('well',c.x,c.z).cluster,CLUSTER_MAX);
 const back=reload(s);assert.deepEqual(back.placementEffects('well',c.x,c.z),s.placementEffects('well',c.x,c.z));
 // Timed-effect plants (power, horses) gain nothing: a faster cycle would only burn more fuel.
 const g=quiet(s,t=>dryAt(s,s.tile(t.x+1,t.z)));s.build('generator',g.x,g.z,true);s.build('generator',g.x+1,g.z,true);assert.equal(s.placementEffects('generator',g.x,g.z).cluster,0);
 assert.equal(new Simulation('river').placementEffects('well',12,12).cluster,0,'off on an old map');
 // Ticks: a wheat field with five wheat neighbours (one side left open as its entrance) grows 1/0.7 times as fast as alone.
 const w=site(s=>!!s.layout.ecology),m=quiet(w,t=>[[0,0],...ring].every(([dx,dz])=>dryAt(w,w.tile(t.x+dx,t.z+dz))));
 w.build('field',m.x,m.z,true);const f=w.at(m.x,m.z);
 /** Progress made in one real tick while the field is mid-cycle (water loaded directly). */
 const rate=()=>{f.inputs={water:5};for(let i=0;i<400&&!(f.working&&f.progress>0&&f.progress<.8);i++)w.tick(.25);const p=f.progress;w.tick(.25);return f.progress-p;};
 const alone=rate();for(const [dx,dz] of ring.slice(0,5))w.build('field',m.x+dx,m.z+dz,true);const ratio=rate()/alone;assert.ok(alone>0&&Math.abs(ratio-1/.7)<1e-6,'1/0.7 speed with five neighbours (ratio '+ratio.toFixed(3)+', '+f.status+')');
 ok.push('same-kind cluster 10%/neighbour incl. corners, max 30%');}

// 3. Salt near the sea: irrigated crops slow 15% a step, a salt pan speeds 20% a step; two steps from the shore.
{const s=site(s=>s.tiles.some(isSea));const got=[];
 for(let r=1;r<=3;r++){const t=s.tiles.find(t=>dryAt(s,t)&&nearest(s,t,isSea)===r&&nearest(s,t,isFresh)>2&&nearest(s,t,isMountain)>5&&s.buildings.every(b=>cheb(b,t)>3));assert.ok(t,'a tile '+r+' from the sea');
  const crop=s.placementEffects('field',t.x,t.z),pan=s.placementEffects('saltfield',t.x,t.z);got.push([crop.salt,+crop.speed.toFixed(2),+pan.speed.toFixed(2)]);
  if(r<=2){assert.equal(pan.water,1,'the salt pan draws sea water');assert.equal(crop.water,0,'sea water does not irrigate wheat');}else assert.equal(pan.water,0);}
 assert.deepEqual(got,[[2,.7,1.4],[1,.85,1.2],[0,1,1]]);
 // Ticks: a salt pan on the shore makes salt without any water stock.
 const t=s.tiles.find(t=>dryAt(s,t)&&nearest(s,t,isSea)===1&&s.buildings.every(b=>cheb(b,t)>3));s.build('saltfield',t.x,t.z,true);const pan=s.at(t.x,t.z);
 assert.deepEqual(s.effectiveInputs(pan),{});s.stock.water=0;/* stock set directly */const salt=s.produced.salt||0;run(s,40);assert.ok((s.produced.salt||0)>salt&&s.stock.water===0,'shore salt without hauled water');
 // Off on an old coast map: no salt, and the salt pan hauls water as before.
 const old=new Simulation('coast'),o=old.tiles.find(t=>t.terrain!=='water'&&nearest(old,t,isSea)===1);assert.equal(old.placementEffects('field',o.x,o.z).salt,0);assert.equal(old.placementEffects('saltfield',o.x,o.z).water,0);
 ok.push('salt 2/1 steps');}

// 4. Flooding: a mine touching water (fresh, sea or a pond) runs at 70%; one tile further it is dry.
{const s=site(s=>s.tiles.some(isWater));
 const far=t=>s.buildings.every(b=>cheb(b,t)>1),at1=s.tiles.find(t=>dryAt(s,t)&&far(t)&&nearest(s,t,isWater)===1),at2=s.tiles.find(t=>dryAt(s,t)&&far(t)&&nearest(s,t,isWater)===2);
 for(const type of MINES){const wet=s.placementEffects(type,at1.x,at1.z),dry=s.placementEffects(type,at2.x,at2.z);assert.equal(wet.flooded,true,type+' floods');assert.equal(dry.flooded,false,type+' two tiles off');
  assert.deepEqual([wet.speed,dry.speed],[.7,1],type+' at 70%');}
 assert.equal(s.placementEffects('quarry',at1.x,at1.z).flooded,false,'a quarry is not a mine');
 const q=quiet(s,t=>dryAt(s,s.tile(t.x+1,t.z)));assert.equal(s.placementEffects('ironmine',q.x,q.z).flooded,false);s.build('pond',q.x+1,q.z,true);assert.equal(s.placementEffects('ironmine',q.x,q.z).flooded,true,'a dug pond floods the mine beside it');
 s.demolish(q.x+1,q.z);assert.equal(s.placementEffects('ironmine',q.x,q.z).flooded,false,'filling the pond drains it');
 const old=new Simulation('river'),w=old.tiles.find(t=>t.terrain!=='water'&&nearest(old,t,isWater)===1);assert.equal(old.placementEffects('ironmine',w.x,w.z).flooded,false,'off on an old map');ok.push('mine flooding 70%');}

// 5a. Tiered water keeps the old wheat rule: on all 180 grid maps, a wheat field (need 3) is watered exactly where the
//     old rule watered it (fresh water within two tiles), tile by tile.
{let tiles=0,watered=0;for(const p of PROVINCES){const s=new Simulation('river',null,{provinceId:p.id,nation:p.nation});
  for(const t of s.tiles){if(t.terrain==='water')continue;tiles++;const now=s.placementEffects('field',t.x,t.z),then=oldEffects(s,'field',t.x,t.z);assert.equal(now.water,then.water,p.id+' '+t.x+','+t.z);watered+=now.water;}}
 assert.ok(tiles>90000&&watered>10000);ok.push('wheat parity on '+tiles+' tiles ('+watered+' watered)');}
// 5b. Each crop has its own demand: touching tiles give 2, the next ring 1, open water within two tiles a base of 3.
{const s=site(s=>s.tiles.some(isFresh));
 const t=s.tiles.find(t=>dryAt(s,t)&&nearest(s,t,isFresh)===2&&nearest(s,t,isSea)>2);const e=s.placementEffects('sugarfield',t.x,t.z),ring=s.tiles.filter(u=>isFresh(u)&&cheb(u,t)===2).length;
 assert.equal(e.waterScore,OPEN_WATER+ring*WATER_RING[2],'base 3 plus one a tile two away');assert.equal(e.water,e.waterScore>=8?1:0);
 for(const type of Object.keys(BUILDINGS).filter(k=>BUILDINGS[k].waterNeed)){const f=s.placementEffects(type,t.x,t.z);assert.equal(f.waterNeed,BUILDINGS[type].waterNeed);assert.equal(f.water,f.waterScore>=f.waterNeed?1:0,type);}
 // Ponds on dry land: one touching pond gives 2 (not enough for wheat), two give 4; a pond two tiles away gives 1.
 const q=quiet(s,t=>[[0,0],[1,0],[-1,0],[2,0],[0,2]].every(([dx,dz])=>dryAt(s,s.tile(t.x+dx,t.z+dz))));const field=()=>s.placementEffects('field',q.x,q.z),vine=()=>s.placementEffects('vineyard',q.x,q.z);
 assert.deepEqual([field().waterScore,field().water],[0,0]);s.build('pond',q.x+1,q.z,true);assert.deepEqual([field().waterScore,field().water],[2,0],'one pond: 2 < 3');
 s.build('pond',q.x-1,q.z,true);assert.deepEqual([field().waterScore,field().water],[4,1],'two ponds: 4 ≥ 3');assert.equal(vine().water,0,'vineyard needs 5');
 s.build('pond',q.x+2,q.z,true);assert.deepEqual([vine().waterScore,vine().water],[5,1],'a third pond two tiles away: 5');
 // Ticks: the vineyard grows with no water stock, then hauls again once a pond is filled in.
 s.build('vineyard',q.x,q.z,true);const v=s.at(q.x,q.z);assert.deepEqual(s.effectiveInputs(v),{});s.stock.water=0;/* stock set directly */const made=s.produced.grapered||0;run(s,40);assert.ok((s.produced.grapered||0)>made,'vineyard on pond water');
 s.demolish(q.x+2,q.z);assert.deepEqual(s.effectiveInputs(v),{water:1},'below its demand it hauls water again');
 // An active water tower meets every demand within two tiles; a stopped one does not.
 const r=quiet(s,t=>dryAt(s,s.tile(t.x+2,t.z)));s.build('reservoir',r.x+2,r.z,true);const tower=s.at(r.x+2,r.z);tower.activeUntil=s.time+60;/* supply window set directly */
 assert.equal(s.placementEffects('sugarfield',r.x,r.z).water,1,'the tower waters sugarcane (need 8)');assert.ok(s.setOperation(tower.id,false).ok);assert.equal(s.placementEffects('sugarfield',r.x,r.z).water,0,'a stopped tower does not');
 // Livestock: a duck house (need 2) beside one pond drinks from it; a sheep pen (need 3) needs more.
 const d=quiet(s,t=>[[0,0],[1,0],[0,1]].every(([dx,dz])=>dryAt(s,s.tile(t.x+dx,t.z+dz))));s.build('pond',d.x+1,d.z,true);
 assert.equal(s.placementEffects('duckhouse',d.x,d.z).water,1);assert.equal(s.placementEffects('sheeppen',d.x,d.z).water,0);
 s.build('duckhouse',d.x,d.z,true);assert.deepEqual(s.effectiveInputs(s.at(d.x,d.z)),{feed:1});
 ok.push('crop demands and ponds 2/1');}
// 5c. Old maps keep the old binary rule; a dug pond counts as fresh water within two tiles for irrigated crops only.
{const s=new Simulation('river');s.rank=32;const q=s.tiles.find(t=>t.terrain!=='water'&&nearest(s,t,isWater)>4&&t.x>3&&t.z>3&&t.x<20&&t.z<20);for(const t of s.tiles)s.owned.add(t.x+','+t.z);/* land owned directly */
 for(const type of ['field','sugarfield','sheeppen','saltfield'])assert.deepEqual(s.placementEffects(type,q.x,q.z).water,oldEffects(s,type,q.x,q.z).water);
assert.ok(s.build('pond',q.x+2,q.z,true).ok);assert.equal(s.placementEffects('sugarfield',q.x,q.z).water,1,'pond within two tiles waters a crop on an old map');assert.equal(s.placementEffects('sheeppen',q.x,q.z).water,0,'livestock still hauls on an old map');
 assert.equal(s.placementEffects('sugarfield',q.x,q.z).waterNeed,0,'no demand numbers on an old map');ok.push('old maps binary water');}

// 6. Pasture: a touching pasture speeds a sheep pen or dairy barn 20%, the next ring 10%, at most 40%; on every map.
{for(const s of [site(s=>!!s.layout.ecology),new Simulation('river')]){for(const t of s.tiles)s.owned.add(t.x+','+t.z);/* land owned directly */
  const q=quiet(s,t=>[[0,0],[1,0],[-1,0],[0,1],[2,0]].every(([dx,dz])=>dryAt(s,s.tile(t.x+dx,t.z+dz))))||s.tiles.find(t=>[[0,0],[1,0],[-1,0],[0,1],[2,0]].every(([dx,dz])=>dryAt(s,s.tile(t.x+dx,t.z+dz)))&&s.buildings.every(b=>cheb(b,t)>3));
  const base=HERDS.map(h=>s.placementEffects(h,q.x,q.z).speed),duck=s.placementEffects('duckhouse',q.x,q.z).speed;const gain=()=>HERDS.map((h,i)=>+(s.placementEffects(h,q.x,q.z).speed/base[i]).toFixed(4));
  s.build('pasture',q.x+2,q.z,true);assert.deepEqual(gain(),[1.1,1.1],'two tiles away +10%');s.build('pasture',q.x+1,q.z,true);assert.deepEqual(gain(),[1.3,1.3],'plus a touching one +20%');
  s.build('pasture',q.x-1,q.z,true);s.build('pasture',q.x,q.z+1,true);assert.deepEqual(gain(),[1.4,1.4],'capped at +40%');assert.equal(s.placementEffects('duckhouse',q.x,q.z).speed,duck,'ducks do not graze');
  assert.ok(effectNotes('sheeppen',s.placementEffects('sheeppen',q.x,q.z)).some(n=>n.text==='목초지 +40%'));
  s.demolish(q.x-1,q.z);s.demolish(q.x,q.z+1);s.demolish(q.x+2,q.z);assert.deepEqual(gain(),[1.2,1.2],'demolished pastures stop counting');}
 ok.push('pasture +20/+10, max 40%');}

// 7. Wild clover is the apiary's condition: without clover within two tiles it cannot run and says why (ticks).
{for(const s of [site(s=>!!s.layout.ecology),new Simulation('river')]){s.nextEvent=1e9;s.rank=32;s.money=1e7;for(const t of s.tiles)s.owned.add(t.x+','+t.z);/* land owned directly */
  if(!s.warehouse){s.build('warehouse',11,12,true);s.build('house',11,14,true);}
  const q=s.tiles.find(t=>[[0,0],[2,0],[3,0]].every(([dx,dz])=>dryAt(s,s.tile(t.x+dx,t.z+dz)))&&t.x>3&&t.x<18&&t.z>4&&t.z<20&&s.buildings.every(b=>cheb(b,t)>2)&&nearest(s,t,isWater)>1);
  s.build('apiary',q.x,q.z,true);const a=s.at(q.x,q.z);run(s,15);assert.equal(a.status,'야생 클로버 필요');assert.equal(s.produced.honey||0,0,'no honey without clover');
  const hint=productionDiagnosis(s,a,BUILDINGS,RESOURCES);assert.equal(hint.tool,'clover');assert.equal(hint.text,operationHint('야생 클로버 필요',s));assert.ok(blockHint(a.status),'the operations card lists it');
  s.build('clover',q.x+3,q.z,true);run(s,2);assert.equal(a.status,'야생 클로버 필요','three tiles is too far');
  s.build('clover',q.x+2,q.z,true);assert.ok(effectNotes('apiary',s.placementEffects('apiary',q.x,q.z)).some(n=>n.text==='야생 클로버 1'));
  run(s,30);assert.ok((s.produced.honey||0)>0,'honey once clover grows two tiles away ('+a.status+')');
  const back=reload(s);run(back,2);assert.notEqual(back.at(q.x,q.z).status,'야생 클로버 필요','the clover survives a save');
  s.demolish(q.x+2,q.z);run(s,15);assert.equal(a.status,'야생 클로버 필요','removing the clover stops the hives');}
 ok.push('apiary needs clover within 2');}

// 8. Terrain facilities: build cost, the empty-land rule, 40% refund, and honest cards (no "not yet" sentence left).
for(const id of ['pond','pasture','clover']){const d=BUILDINGS[id];assert.ok(!/아직/.test(d.description),id+' card is current');assert.ok(d.description.includes('40%'));}
assert.ok(BUILDINGS.apiary.description.includes('야생 클로버'));assert.ok(!/강 옆이어도/.test(BUILDINGS.saltfield.description));
{const s=site(s=>s.tiles.some(isFresh));const w=s.tiles.find(t=>t.terrain==='water'&&s.ownedAt(t.x,t.z));assert.equal(s.canBuild('pond',w.x,w.z,true),'물 위에는 건설할 수 없습니다','a pond is dug in dry land');
 const q=quiet(s);const rich=s.money;assert.ok(s.build('pond',q.x,q.z).ok);assert.equal(rich-s.money,s.buildCost('pond'));s.nextEvent=1e9;run(s,35);/* past the early-demolition grace */const kept=s.money;assert.ok(s.demolish(q.x,q.z).ok);assert.equal(s.money-kept,Math.floor(BUILDINGS.pond.cost*.4));ok.push('terrain cards and refunds');}

// 9. Saves. A new-rule save reloads with every facility's effects unchanged; the saves from before 2026-09-28 (no land)
//    keep the old rule for every building, run, and save again.
{const s=site(s=>s.tiles.some(isFresh)&&s.tiles.some(isMountain));for(const type of ['field','vineyard','ironmine','sheeppen','apiary','solarpanel','pond','pasture','clover']){const t=quiet(s)||s.tiles.find(t=>dryAt(s,t)&&s.buildings.every(b=>cheb(b,t)>1));s.build(type,t.x,t.z,true);}
 run(s,10);const back=reload(s);for(const b of s.buildings)assert.deepEqual(back.placementEffects(b.type,b.x,b.z),s.placementEffects(b.type,b.x,b.z),b.type+' effects survive a save');
 assert.deepEqual(Object.keys(s.save()).sort(),Object.keys(new Simulation('river').save()).sort(),'no new save keys');assert.ok(s.save().buildings.every(b=>!('cluster' in b)&&!('waterScore' in b)),'effects are not stored on buildings');}
{const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/save-before-20260928.json',import.meta.url),'utf8'));let checked=0;
 for(const key of ['demo','early']){const c=new Campaign({saved:decodeSave(fixture[key])});
  for(const site of c.sites){const s=site.sim;assert.equal(terrainRules(s),false,key+' is an old map');
   for(const b of s.buildings){const now=s.placementEffects(b.type,b.x,b.z),then=oldEffects(s,b.type,b.x,b.z);for(const k of ['water','pollution','shade','windBlock','speed'])assert.equal(now[k],then[k],key+' '+b.type+' '+k);checked++;}}
  for(let i=0;i<4*60;i++)c.tick(.25);const again=decodeSave(encodeSave(c.save()));assert.ok(again.sites.every(v=>v.simulation.version===8));}
 assert.ok(checked>20);ok.push('old saves: '+checked+' buildings match the old rule');}

// 10. The balance record carries the same numbers as the code.
{const rules=JSON.parse(fs.readFileSync(new URL('../docs/balance/patch-20260928.json',import.meta.url),'utf8')).expansion20260929.terrainRules;
 assert.deepEqual(rules.numbers,{waterRing:WATER_RING.slice(1),openWater:OPEN_WATER,clusterStep:CLUSTER_STEP,clusterMax:CLUSTER_MAX,mountainSteps:[3,2,2,1,1],saltSteps:[2,1],saltCrop:.15,saltPan:.2,flood:.7,mines:MINES,herds:HERDS,grazeStep:.1,grazeMax:.4,cloverReach:2});
 assert.deepEqual(rules.waterNeed,Object.fromEntries(Object.entries(BUILDINGS).filter(([,d])=>d.waterNeed).map(([k,d])=>[k,d.waterNeed])));ok.push('balance record');}

/** The speed a facility runs at, read from real ticks: progress over one step while it is mid-cycle, times its period. */
const speedOf=(s,b)=>{const period=s.recipeOf?s.recipeOf(b).period:BUILDINGS[b.type].period;for(let i=0;i<800&&!(b.working&&b.progress>0&&b.progress<.8);i++)s.tick(.25);const p=b.progress;s.tick(.25);return (b.progress-p)/.25*period;};
// 11. Shallow mine: builds anywhere, half the iron mine's output, no ore or mountain bonus, floods like a mine (ticks).
{const s=site(s=>s.tiles.some(isMountain)&&s.tiles.some(isWater));
 assert.deepEqual([BUILDINGS.shallowmine.amount*2,BUILDINGS.shallowmine.period],[BUILDINGS.ironmine.amount,BUILDINGS.ironmine.period],'half the iron mine');assert.ok(MINES.includes('shallowmine'));
 const hill=s.tiles.find(t=>dryAt(s,t)&&isMountain(t)),flat=quiet(s);assert.equal(s.canBuild('shallowmine',flat.x,flat.z,true),null,'no mountain or ore needed');
 assert.deepEqual([s.tileMultiplier('shallowmine',hill.x,hill.z),s.tileMultiplier('shallowmine',flat.x,flat.z)],[1,1],'ore and mountain ground do not count');assert.ok(s.tileMultiplier('ironmine',hill.x,hill.z)>1.2,'the iron mine does gain on the mountain');
 s.build('shallowmine',flat.x,flat.z,true);const m=s.at(flat.x,flat.z),sp=speedOf(s,m),iron=s.produced.iron||0,cycles=m.cycles;run(s,Math.ceil(32/sp)+1);
 assert.ok(m.cycles-cycles>=2&&m.cycles-cycles<=3,'about two cycles of 16 s');assert.equal((s.produced.iron||0)-iron,2*(m.cycles-cycles),'2 iron a cycle');
 assert.ok(s.setRecipe(m.id,'copper').ok);const copper=s.produced.copper||0;run(s,Math.ceil(24/sp)+1);assert.equal((s.produced.copper||0)-copper,2,'copper 2 in 24 s');
 const wet=s.tiles.find(t=>dryAt(s,t)&&nearest(s,t,isWater)===1&&s.buildings.every(b=>cheb(b,t)>1));assert.equal(s.placementEffects('shallowmine',wet.x,wet.z).speed,.7,'floods at 70%');
 ok.push('shallow mine: half speed anywhere, flat tile factor, floods');}
// 12. Wind pump: no inputs or power; while its 60 s window runs it meets every water demand of the crops within two tiles
//     (the water tower's reach); wind shelter slows it and, from two steps, leaves gaps. Ticks throughout.
{const s=site(s=>!!s.layout.ecology);const q=quiet(s,t=>[[0,0],[2,0],[3,0]].every(([dx,dz])=>dryAt(s,s.tile(t.x+dx,t.z+dz))));
 assert.deepEqual([BUILDINGS.windpump.inputs,BUILDINGS.windpump.power,BUILDINGS.windpump.output],[undefined,undefined,'irrigation']);
 s.build('sugarfield',q.x,q.z,true);const cane=s.at(q.x,q.z);assert.deepEqual(s.effectiveInputs(cane),{water:1},'dry sugarcane hauls water');
 s.build('windpump',q.x+3,q.z,true);const far=s.at(q.x+3,q.z);s.stock.water=0;/* stock set directly */run(s,45);assert.equal(far.status,'관개 공급 중');assert.equal(s.placementEffects('sugarfield',q.x,q.z).water,0,'three tiles is too far');
 s.demolish(q.x+3,q.z);s.build('windpump',q.x+2,q.z,true);const pump=s.at(q.x+2,q.z);run(s,45);
 assert.ok(pump.activeUntil>s.time,'the pump runs on no water or power ('+pump.status+')');assert.equal(s.stock.water,0,'it hauls no water');assert.deepEqual(s.effectiveInputs(cane),{},'sugarcane (need 8) is watered two tiles away');
 const cane0=s.produced.sugarcane||0;run(s,40);assert.ok((s.produced.sugarcane||0)>cane0,'sugarcane grows with no water stock');
 const samples=()=>{let on=0,n=0;for(let i=0;i<300;i++){run(s,1);n++;on+=s.placementEffects('sugarfield',q.x,q.z).water;}return on/n;};
 assert.equal(samples(),1,'open wind: no gap');
 assert.ok(s.setOperation(pump.id,false).ok);assert.equal(s.placementEffects('sugarfield',q.x,q.z).water,0,'a stopped pump stops watering');assert.ok(s.setOperation(pump.id,true).ok);
 // A tall refinery beside it blocks three wind steps: 40% speed, a 100 s cycle for a 60 s window.
 for(const [dx,dz] of [[1,1],[1,-1],[0,1],[0,-1]])if(s.canBuild('refinery',pump.x+dx,pump.z+dz,true)===null){s.build('refinery',pump.x+dx,pump.z+dz,true);break;}
 const e=s.placementEffects('windpump',pump.x,pump.z);assert.deepEqual([e.windBlock,e.speed],[3,.4]);const cycle=BUILDINGS.windpump.period/speedOf(s,pump),share=samples();
 assert.ok(cycle>60&&share>.3&&share<.75,'sheltered: a '+cycle.toFixed(0)+' s cycle waters '+share.toFixed(2)+' of the time');
 // Old maps: the pump waters crops the same way (the old binary rule counts it like the water tower).
 const old=new Simulation('river');for(const t of old.tiles)old.owned.add(t.x+','+t.z);/* land owned directly */const o=old.tiles.find(t=>t.terrain!=='water'&&nearest(old,t,isWater)>4&&t.x>3&&t.z>3&&t.x<20&&dryAt(old,old.tile(t.x+2,t.z)));
 old.build('windpump',o.x+2,o.z,true);old.at(o.x+2,o.z).activeUntil=old.time+60;/* supply window set directly */assert.equal(old.placementEffects('sugarfield',o.x,o.z).water,1);
 ok.push('wind pump: waters crops within 2 without inputs, gaps when sheltered, '+(share*100).toFixed(0)+'% under 3 steps');}

console.log('PASS expansion rules 5/5, terrain facilities 3/3, shallow mine and wind pump: '+ok.join('; '));
