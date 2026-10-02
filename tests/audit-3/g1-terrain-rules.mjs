// G1 audit (2026-09-30): terrain rules and terrain facilities (pond, pasture, clover) against the damage systems, the
// descriptions and old maps. Storms are triggered directly (pendingEvent) and every other effect comes from real ticks.
// Run: node tests/audit-3/g1-terrain-rules.mjs
import {Simulation,BUILDINGS,RESOURCES,HARVEST_BOOST} from '../../src/app/game/simulation.js';
import {placementEffects,terrainRules} from '../../src/app/game/proximity.js';
import {load,calm,expectBug,finish,Campaign} from '../audit-2/_fixture.mjs';

// T1 storms: a terrain facility is a storm target like a production facility, and the "spare the sole producer" rule of the
// previous audit (E1/J3) always treats it as spare, so one 25G clover draws the hits away from production.
function storms(withClover){
 const c=load(13),s=c.home.sim;calm(c);let clover=null;
 if(withClover){const t=s.tiles.find(t=>s.ownedAt(t.x,t.z)&&!s.at(t.x,t.z)&&!t.nature&&t.terrain!=='water'&&!s.roads.has(t.x+','+t.z)&&s.build('clover',t.x,t.z).ok);clover=s.at(t.x,t.z);}
 const hits={};let productionHits=0;
 for(let k=0;k<40;k++){for(const b of s.buildings)b.health=100;s.protected=false;s.pendingEvent={type:'storm',at:s.time};s.resolveEvent();
  const hit=s.buildings.find(b=>b.health<100);if(!hit)continue;hits[hit.type]=(hits[hit.type]||0)+1;if(BUILDINGS[hit.type].period)productionHits++;}
 return {stage:s.stage,hits,productionHits,clover:clover&&{type:clover.type,cost:BUILDINGS.clover.cost}};
}
{const without=storms(false),with1=storms(true);
 expectBug('G1-T1 one wild clover (25G) takes most storm hits off production facilities',(with1.hits.clover||0)>=20&&with1.productionHits<without.productionHits/2,{storms:40,withoutClover:without,withOneClover:with1});}

// T2 a terrain facility at 0 health shows 수리 필요 but keeps its whole effect, and repairing it costs more than building it.
{const s=new Simulation('river',null,{nation:'estern',provinceId:'estern-5'});s.nextEvent=1e12;s.rank=13;s.money=1e5;for(const r of Object.keys(RESOURCES))s.stock[r]=80;/* set directly */
 s.build('warehouse',11,12);s.build('house',11,14);s.build('house',12,14);
 // field at (13,11) between two ponds (13,10) and (14,11); apiary (9,12) with clover (9,13); sheep pen (10,10) with pasture (10,9)
 const plan=[['pond',13,10],['pond',14,11],['field',13,11],['apiary',9,12],['clover',9,13],['pasture',10,9],['sheeppen',10,10]];
 const built=plan.map(([t,x,z])=>t+':'+(s.build(t,x,z).ok?'ok':s.canBuild(t,x,z)));
 const get=t=>s.buildings.find(b=>b.type===t),all=t=>s.buildings.filter(b=>b.type===t);for(const b of [...all('clover'),...all('pond'),...all('pasture')])b.health=0;/* as a storm leaves them */
 for(let i=0;i<240;i++)s.tick(.25);
 const fx=t=>{const b=get(t);return placementEffects(s,t,b.x,b.z);};
 const detail={built,statuses:Object.fromEntries(['clover','pond','pasture','apiary','field','sheeppen'].map(t=>[t,get(t)?.status])),apiaryHoney:s.produced.honey||0,fieldWaterFromTwoBrokenPonds:fx('field').waterScore+'/'+fx('field').waterNeed,fieldStillHaulsWater:!!s.effectiveInputs(get('field')).water,sheepGrazeFromBrokenPasture:fx('sheeppen').graze,repairCost:{clover:s.repairCost(get('clover')),pond:s.repairCost(get('pond')),pasture:s.repairCost(get('pasture'))},buildCost:{clover:BUILDINGS.clover.cost,pond:BUILDINGS.pond.cost,pasture:BUILDINGS.pasture.cost}};
 expectBug('G1-T2 a broken pond, pasture or clover still waters, grazes and feeds bees while it asks for a repair that costs more than a new clover or pasture',get('clover').status==='수리 필요'&&(s.produced.honey||0)>0&&!s.effectiveInputs(get('field')).water&&fx('sheeppen').graze>0&&s.repairCost(get('clover'))>BUILDINGS.clover.cost,detail);}

// T3 old maps (no land.ecology) keep the old rules; the showcase tour (산업도시 둘러보기, Campaign demo) is one of them, so the
// herd water, pond flooding, salt and clustering the cards describe do nothing there.
{const c=new Campaign({demo:true}),s=c.active;calm(c);
 const spot=(type,x,z)=>s.build(type,x,z,true).ok;
 const built=[['pond',10,18],['pond',12,18],['sheeppen',11,18],['ironmine',10,19],['field',15,18],['field',16,18]].map(([t,x,z])=>t+':'+(spot(t,x,z)||s.canBuild(t,x,z,true)));
 const sheep=s.buildings.find(b=>b.type==='sheeppen'),mine=s.buildings.find(b=>b.type==='ironmine'),f=s.buildings.filter(b=>b.type==='field');
 const e=placementEffects(s,'sheeppen',sheep.x,sheep.z),m=placementEffects(s,'ironmine',mine.x,mine.z),g=f[1]&&placementEffects(s,'field',f[1].x,f[1].z);
 const detail={built,demoUsesNewRules:terrainRules(s),sheepPenBesideTwoPonds:{waterNeed:e.waterNeed,hauls:!!s.effectiveInputs(sheep).water},sheepDescription:BUILDINGS.sheeppen.description.slice(0,60),mineBesidePond:{flooded:m.flooded},pondDescription:BUILDINGS.pond.description.match(/광산[^.]*\./)?.[0],twoAdjacentFields:{cluster:g?.cluster}};
 expectBug('G1-T3 the showcase tour runs on an old-rule map: herd water, pond flooding and clustering described on the cards do nothing there',!terrainRules(s)&&!!s.effectiveInputs(sheep).water&&!m.flooded,detail);}

// T4 the harvest good event speeds every farm-group facility, including the feed mill, which is a processing plant.
{const s=new Simulation('river',null,{nation:'estern',provinceId:'estern-5'});s.nextEvent=1e12;s.rank=13;s.money=1e5;for(const r of Object.keys(RESOURCES))s.stock[r]=80;
 s.build('warehouse',11,12);s.build('feedmill',9,12);s.build('mill',13,12);const fm=s.buildings.find(b=>b.type==='feedmill'),ml=s.buildings.find(b=>b.type==='mill');
 const before=[s.speedOf(fm),s.speedOf(ml)];s.harvestUntil=s.time+80;const after=[s.speedOf(fm),s.speedOf(ml)];
 expectBug('G1-T4 the harvest event (농장 생산 +50%) also speeds the feed mill, a grain-processing plant, but not the flour mill',after[0]/before[0]>1.4&&Math.abs(after[1]/before[1]-1)<1e-9,{feedmill:{group:BUILDINGS.feedmill.group,ratio:+(after[0]/before[0]).toFixed(2)},mill:{group:BUILDINGS.mill.group,ratio:+(after[1]/before[1]).toFixed(2)},boost:HARVEST_BOOST});}
finish('g1-terrain-rules');
