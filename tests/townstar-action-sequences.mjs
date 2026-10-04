import assert from 'node:assert/strict';
import {Campaign} from '../src/app/game/campaign.js';
import {BUILDINGS,RESOURCES} from '../src/app/game/simulation.js';
import {stores} from '../src/app/game/storage.js';
import {encodeSave,decodeSave} from '../src/app/game/persistence.js';
// A developed, two-site fixture followed only by paid/player-accessible actions.
// Fixed seeds reproduce interleaved hauling, recipe switches, relocation and saves.
const totals={actions:0,accepted:0,restores:0,sites:0};
for(const seed of [1,7,29,89,211,701]){
 let c=new Campaign({demo:true}),rng=seed;const next=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;},pick=a=>a[Math.floor(next()*a.length)];
 const recent=[];
 for(let step=0;step<180;step++){
  const s=c.active,b=pick(s.buildings),item=pick(Object.keys(RESOURCES)),store=pick(stores(s,false));let result;
  const kind=Math.floor(next()*12);recent.push([step,kind,b?.id,item]);if(recent.length>10)recent.shift();
  try{
   if(kind===0){const type=pick(Object.keys(BUILDINGS)),t=pick(s.tiles.filter(t=>s.ownedAt(t.x,t.z)&&!s.canBuild(type,t.x,t.z)));if(t)result=s.build(type,t.x,t.z);}
   if(kind===1&&b)result=s.upgrade(b.id);
   if(kind===2&&b)result=s.setOperation(b.id,next()>.3,Math.floor(next()*3));
   if(kind===3&&b){const r=pick(BUILDINGS[b.type].recipes||[]);if(r)result=s.setRecipe(b.id,r.id);}
   if(kind===4&&b){const t=pick(s.tiles.filter(t=>s.ownedAt(t.x,t.z)&&!s.canBuild(b.type,t.x,t.z,true)));if(t)result=s.relocate(b.id,t.x,t.z);}
   if(kind===5&&b&&!BUILDINGS[b.type].home)result=s.demolish(b.x,b.z);
   if(kind===6&&store)result=s.setStorageRule(store.id,item,pick([null,0,10,50]),pick([0,5,10]));
   if(kind===7)result=s.buy(item,1+Math.floor(next()*10));
   if(kind===8)result=s.sell(item,1+Math.floor(next()*10));
   if(kind===9)result=s.repairAll();
   if(kind===10)result=s.setStockCap(item,pick([0,10,20,50]));
   if(kind===11)result=c.switchSite(pick(c.sites).id);
   totals.actions++;if(result?.ok)totals.accepted++;
   c.active.paused=false;c.active.speed=pick([1,2,4]);for(let j=0;j<24;j++)c.tick(.25);
   for(const {sim} of c.sites){assert.ok(Number.isFinite(sim.money));for(const [id,n]of Object.entries(sim.stock))assert.ok(Number.isFinite(n)&&n>=0,id+' stock');}
   const saved=c.save(),encoded=encodeSave(saved),back=new Campaign({saved:decodeSave(encoded)});
   const beforeTreasury={...c.treasury},afterTreasury={...back.treasury};
   // Removing the last producer legitimately redraws an unshipped, stale order on load.
   if(c.active.contractStale()){delete beforeTreasury.contractOrder;delete afterTreasury.contractOrder;}
   assert.deepEqual(afterTreasury,beforeTreasury,'shared economy survives');
   for(let i=0;i<c.sites.length;i++)assert.deepEqual({...back.sites[i].sim.stock},{...c.sites[i].sim.stock},'inventory survives');
   if(step%5===0){c=back;totals.restores++;}
  }catch(error){console.error(JSON.stringify({seed,step,recent}));throw error;}
 }
 totals.sites+=c.sites.length;
}
assert.ok(totals.accepted>100);console.log('PASS player action/save sequences '+JSON.stringify(totals));
