import assert from 'node:assert/strict';
import {createIndustryTrial,INDUSTRY_TRIALS,weeklyTrial,practiceTrials} from '../src/app/game/industry-trials.js';
import {BUILDINGS} from '../src/app/game/simulation.js';
import {encodeSave,decodeSave} from '../src/app/game/persistence.js';
import {Campaign} from '../src/app/game/campaign.js';
import {attachTrialReplay,verifyTrialReplay} from '../src/app/game/trial-replay.js';
// Use paid construction, ordinary residents, imports of construction materials and actual timed exports.
// Never grant inventory, money, production, sold totals or free buildings.
const plans={
 bread:[['warehouse',1],['house',6],['well',2],['lumber',1],['field',2],['mill',1],['bakery',1]],
 cloth:[['warehouse',1],['house',6],['well',2],['cottonfield',3],['weaver',2]],
 steel:[['warehouse',1],['house',3],['dwarfhouse',3],['well',2],['windturbine',1],['ironmine',1],['coalpit',1],['smelter',1]]
};
const reports=[];
for(const rule of [...INDUSTRY_TRIALS,...practiceTrials(),...[38,39,40].map(weeklyTrial)]){let c=createIndustryTrial(rule.id),restored=false,orders=0,builds=0;
 for(let step=0;step<rule.duration*4+4&&c.trial.status==='playing';step++){
  const s=c.active;
  if(step%8===0){
   // UI reads can pin an order; save/resume must reproduce that choice as well.
   s.contract();s.promotion();
   for(const store of[s.starterStore,...s.buildings.filter(b=>b.type==='warehouse')])if(!store.storageRules?.[rule.item]){s.setStorageRule(store.id,rule.item,null,80);for(const item of['water','grain','wood','flour','cotton','iron','coal'])if(item!==rule.item)s.setStorageRule(store.id,item,60);}
   for(const [type,n]of rule.plan?[['warehouse',1],...rule.plan]:plans[rule.item])if(s.buildings.filter(b=>b.type===type).length<n){
    const d=BUILDINGS[type],missing=Object.entries(d.materials||{}).find(([item,q])=>s.availableStock(item)<q);
    if(missing){const [item,q]=missing;if(!s.shipments.some(sh=>sh.kind==='import'&&sh.item===item)){const r=s.buy(item,Math.min(10,Math.ceil(q-s.availableStock(item))));if(r.ok)orders++;}break;}
    const candidates=s.tiles.filter(t=>t.z%2===0&&s.ownedAt(t.x,t.z)&&!s.canBuild(type,t.x,t.z));
    const score=t=>{const fx=s.placementEffects(type,t.x,t.z);return (d.irrigable?fx.water*20:0)-(Math.abs(t.x-11)+Math.abs(t.z-12));};
    candidates.sort((a,b)=>score(b)-score(a));if(candidates[0]){const t=candidates[0];assert.ok(s.build(type,t.x,t.z).ok);builds++;break;}
    if(d.road){for(let x=8;x<16;x++)s.build('road',x,11);for(let z=12;z<16;z++)s.build('road',9,z);for(let x=10;x<16;x++)s.build('road',x,13);}
    break;
   }
   for(const b of s.buildings)if(BUILDINGS[b.type].road&&!s.placementEffects(b.type,b.x,b.z).road){for(let x=8;x<16;x++)s.build('road',x,11);for(let z=12;z<16;z++)s.build('road',9,z);for(let x=8;x<16;x++){s.build('road',x,13);s.build('road',x,15);}}
   for(const [type,recipes]of Object.entries(rule.recipes||{}))s.buildings.filter(b=>b.type===type).forEach((b,i)=>{if(b.recipe!==recipes[i%recipes.length])s.setRecipe(b.id,recipes[i%recipes.length]);});
   if(s.stock[rule.item]>=1)s.sell(rule.item,Math.min(10,Math.floor(s.stock[rule.item])));
  }
  c.tick(.25);
  if(!restored&&c.trial.elapsed>rule.duration/3){c=new Campaign({saved:decodeSave(encodeSave(c.save()))});attachTrialReplay(c);restored=true;}
 }
 const s=c.active;reports.push({id:rule.id,status:c.trial.status,elapsed:c.trial.elapsed,delivered:c.trial.delivered,produced:s.produced[rule.item],score:c.trial.score,money:s.money,orders,builds});
 if(c.trial.status!=='won')console.log(JSON.stringify({report:reports.at(-1),buildings:s.buildings.map(b=>[b.type,b.status,b.inputs,b.out]),stock:{...s.stock}}));
 assert.equal(c.trial.status,'won',rule.id+' must be achievable through real production and transport');assert.ok(s.money>=0);assert.ok(c.trial.elapsed<=rule.duration);
 assert.equal(s.soundEvents.filter(e=>e.type==='trial-won').length,1,'successful trial has one result cue');
 if(rule.version===2){const verified=verifyTrialReplay(JSON.parse(JSON.stringify(c.trial.replay)));assert.equal(verified.score,c.trial.score,rule.id+' replay reproduces score');assert.equal(verified.delivered,c.trial.delivered);}
}
console.log('PASS industry trial playthroughs '+JSON.stringify(reports));
