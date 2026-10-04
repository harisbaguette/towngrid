// Read-only gameplay audit: isolated simulations, no player saves or production code edits.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {Simulation,RESOURCES,BUILDINGS} from '../../src/app/game/simulation.js';
import {Campaign} from '../../src/app/game/campaign.js';
import {deposit,capacity,freeSpace} from '../../src/app/game/storage.js';
import {purchaseShort} from '../../src/app/game/economy.js';
import {vehicleLoad,exportableStock} from '../../src/app/game/export-route.js';
import {tradeDestinations,chooseTradeDestination,tradeJourney} from '../../src/app/game/trade-journey.js';
const findings=[];
const report=(id,reproduced,details)=>findings.push({id,reproduced,...details});
const empty=s=>{for(const k of Object.keys(RESOURCES))s.stock[k]=0;s.autoSell={};s.nextEvent=1e9;};
const put=(s,type,x,z)=>{const p=x===undefined?s.tiles.find(p=>!s.canBuild(type,p.x,p.z,true)):{x,z};assert.ok(p,type);const r=s.build(type,p.x,p.z,true);assert.ok(r.ok,r.error);return s.at(p.x,p.z);};
{
 const s=new Simulation('river');empty(s);s.contracts=1;s.contractOrder={n:1,item:'grain'};s.stock.grain=10;s.stock.fuel=20;
 const contract=s.contract(),load=vehicleLoad(s),result=s.fulfill();
 report('partial_contract_requires_whole_order',!result.ok&&s.stock.grain>=load&&contract.amount>load,{contract,load,stock:s.stock.grain,result});
}
{
 const c=new Campaign(),a=c.active,b=new Simulation('river');c.attach({id:'site-2',name:'audit branch',nation:a.nation,unrest:0,sim:b});c.treasury.money=10000;
 for(const s of [a,b])empty(s);const w=put(a,'warehouse');put(b,'warehouse');deposit(a,'wood',20,w);deposit(a,'fuel',10,a.starterStore);
 assert.ok(c.createRoute('site-1','site-2','wood',12,'truck').ok);const p=a.tiles.find(t=>!a.canRelocate(w.id,t.x,t.z));assert.ok(a.relocate(w.id,p.x,p.z).ok);
 const before=w.inventory.wood,available=exportableStock(a,'wood');c.tickRoute(c.routes[0],.25);
 report('freight_withdraws_from_moving_store',w.inventory.wood<before&&w.movingUntil>a.time,{before,after:w.inventory.wood,exportableBefore:available,cargo:c.routes[0].cargo,time:a.time,movingUntil:w.movingUntil});
}
{
 const s=new Simulation('river');s.rank=1;empty(s);put(s,'house',10,14);const m=put(s,'sawmill',12,12);s.stock.wood=10;let w;
 for(let i=0;i<300;i++){s.tick(.25);w=s.workers.find(w=>w.task?.carried&&w.task.targetId===m.id&&Math.hypot(w.x-7,w.z-11)>2);if(w)break;}
 assert.ok(w,'a resident must actually collect and carry the lumber');const amount=w.task.amount,position={x:w.x,z:w.z};
 // A full inventory fixture models storage filled by another producer/import while this load is in transit.
 s.stock.stone=s.storageCapacity-s.storageUsed;const before={used:s.storageUsed,wood:s.stock.wood};assert.ok(s.setOperation(m.id,false).ok);
 report('cancel_haul_teleports_into_full_store',s.stock.wood===before.wood+amount&&s.storageUsed>s.storageCapacity,{amount,position,store:{x:7,z:11},before,after:{used:s.storageUsed,capacity:s.storageCapacity,wood:s.stock.wood},task:w.task});
}
{
 const s=new Simulation('river');empty(s);s.money=1e5;const w=put(s,'warehouse',11,12);deposit(s,'fuel',40,s.starterStore);deposit(s,'wood',117,s.starterStore);deposit(s,'wood',476,w);
 const buttonReason=purchaseShort(s,'water',5),result=s.buy('water',5);
 report('import_button_ignores_per_store_space',buttonReason===null&&!result.ok,{totalFree:s.storageCapacity-s.storageUsed,storeFree:[freeSpace(s,s.starterStore),freeSpace(s,w)],quantity:5,buttonReason,result});
 const actual=capacity(s,{type:'depot',level:1});
 report('depot_description_wrong',BUILDINGS.depot.description.includes('240')&&actual===1200,{description:BUILDINGS.depot.description,actual});
}
{
 const s=new Simulation('river'),terminal=s.tradeConnection(),cities=tradeDestinations(s,terminal);
 const sample=c=>{assert.ok(chooseTradeDestination(s,c.destinationId).ok);const j=tradeJourney(s,terminal);return {name:j.destination,distance:j.distance,fuel:j.fuel,duration:j.duration,revenue:s.saleQuote('bread',10)};};
 const near=sample(cities[0]),far=sample(cities.at(-1));
 report('far_destination_no_price_incentive',far.fuel>near.fuel&&far.duration>near.duration&&near.revenue===far.revenue,{near,far});
}
mkdirSync('docs/verification',{recursive:true});
writeFileSync('docs/verification/townstar-followup-20261003.json',JSON.stringify(findings,null,2)+'\n');
for(const f of findings)console.log((f.reproduced?'REPRODUCED ':'NOT-REPRODUCED ')+f.id+' '+JSON.stringify(f));
