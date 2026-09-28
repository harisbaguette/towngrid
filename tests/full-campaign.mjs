import assert from 'node:assert/strict';
import {Campaign} from '../src/app/game/campaign.js';
import {BUILDINGS,RESOURCES} from '../src/app/game/simulation.js';
import {RANKS,NATIONS,unlockRank} from '../src/app/game/world.js';
import {encodeSave,decodeSave} from '../src/app/game/persistence.js';
// This driver uses only player actions and elapsed time. It never grants money,
// stock, production totals, rank or contract completions.
let c=new Campaign(),lastRank=-1,lastAction=0;const milestones=[];
const count=(s,t)=>s.buildings.filter(b=>b.type===t).length;
function buyMissing(s,cost,items){let budget=cost;for(const [r,n] of Object.entries(items||{}))budget+=Math.max(0,n-s.stock[r])*Math.ceil(RESOURCES[r].price*1.85);if(s.money<budget+120)return false;for(const [r,n] of Object.entries(items||{}))if(s.stock[r]<n&&!s.buy(r,Math.ceil(n-s.stock[r])).ok)return false;return true;}
function build(s,type,desired=1){if(s.rank<unlockRank(type)||count(s,type)>=desired)return;
 const def=BUILDINGS[type];if(!buyMissing(s,s.buildCost(type),def.materials))return;
 const tiles=s.tiles.filter(t=>t.terrain!=='water'&&s.ownedAt(t.x,t.z)&&!s.at(t.x,t.z)&&!s.roads.has(t.x+','+t.z));
 tiles.sort((a,b)=>Math.abs(a.x-11)+Math.abs(a.z-12)-Math.abs(b.x-11)-Math.abs(b.z-12));
 for(const t of tiles){if(type!=='warehouse'&&(t.z%2!==0||t.x===13))continue;if(type!=='warehouse'&&!s.routeTo(s.entries(s.warehouse)[0],{x:t.x,z:t.z,size:1}))continue;if(s.build(type,t.x,t.z).ok)return;}
 if(s.money>s.expansionCost()+400){for(let z=1;z<5;z++)for(let x=1;x<5;x++)if(s.canExpand(x,z)){s.expand(x,z);return;}}
}
function operate(){const s=c.home.sim;c.activeId=c.homeId;
 if(!s.warehouse){assert.ok(s.build('warehouse',11,12).ok);}
 for(const [type,n] of [['house',4],['dwarfhouse',2],['titanhouse',1],['clinic',1],['well',3],['field',3],['lumber',2],['dock',2],['quarry',1],['sawmill',1],['mill',1],['bakery',1],['stable',1],['generator',1],['workshop',1],['logistics',1],['ironmine',1],['coalpit',1],['smelter',1],['steamworks',1],['oilpump',1],['refinery',1],['chemical',1],['manaextractor',1],['electronics',1],['station',1],['automotive',1],['laboratory',1],['hospital',1],['arcanepower',1],['battery',1],['leyrelay',1],['magetower',1],['bank',1],['barracks',1]])build(s,type,n);
 for(const site of c.sites){const sim=site.sim;for(const b of sim.buildings){if(b.health<100&&sim.money>sim.repairCost(b)+100)sim.repair(b.id);if(b.level<3&&BUILDINGS[b.type].home&&sim.money>200&&sim.stock.wood>=6)sim.upgrade(b.id);if(b.level<3&&BUILDINGS[b.type].period&&sim.money>1200&&sim.stock.plank>=3)sim.upgrade(b.id);}
  if(sim.money>300)for(const t of sim.tiles)if(sim.ownedAt(t.x,t.z)&&t.z%2===1&&!sim.at(t.x,t.z)&&!sim.roads.has(t.x+','+t.z)&&sim.money>220)sim.build('road',t.x,t.z);
  if(sim.health.infection>15&&sim.health.sanitationUntil<sim.time&&sim.money>100)sim.sanitize();if(sim.pendingEvent?.type==='storm')sim.reinforce();if(sim.raid&&!sim.raid.finished)sim.mobilize();
  if(site.id!==c.homeId){build(sim,'warehouse');build(sim,'house');build(sim,'generator');build(sim,'station');for(const r of ['wood','water'])if(sim.stock[r]<12&&sim.money>1200)sim.buy(r,30);}
  const st=sim.buildings.find(b=>b.type==='station');if(st&&!sim.rails.size&&buyMissing(sim,sim.buildCost('rail'),BUILDINGS.rail.materials))for(const[dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]])if(sim.build('rail',st.x+dx,st.z+dz).ok)break;
 }
 for(const r of Object.keys(RESOURCES)){s.autoSell[r]=!['water','wood','stone','iron','coal','oil','mana','steel','fuel','polymer','circuit'].includes(r);s.reserves[r]=({grain:35,plank:25,gear:30,bread:35,car:8,medicine:20}[r]||12);}
 // Import only resources whose unlocked producer is genuinely short of supply.
 if(s.money>2400)for(const r of ['wood','stone','water','grain','iron','coal','oil','mana','steel','gear','fuel','polymer','circuit'])if(s.stock[r]<12)s.buy(r,20);
 if(s.stock[s.contract().item]>=s.contract().amount)s.fulfill();
 if(s.debt&&s.money>1400)s.repay();if(!s.family&&s.rank>=2&&s.money>1000)s.rescue();if(s.rank>=5&&!s.charter)s.chooseCharter('commons');
 if(s.rank>=2&&s.expansions<2&&s.money>s.expansionCost()+300){for(const [x,z]of [[4,3],[3,4],[2,4]])if(s.expand(x,z).ok)break;}
 const p=s.promotion();if(p?.ready){assert.equal(s.promote().ok,true);milestones.push({rank:s.rank+1,name:RANKS[s.rank].name,day:s.day,money:Math.floor(s.money)});console.log(JSON.stringify(milestones.at(-1)));}
 const neededSites=Math.max(s.rank>=20?3:2,...(s.promotion()?.requirements||[]).filter(r=>r.key==='sites').map(r=>r.target));
 if(s.rank>=13&&c.sites.length<neededSites&&s.money>2600){buyMissing(s,1400,{wood:24,stone:16,water:8});c.foundSite('estern','highland');}
 if(c.sites.length>1&&s.stock.steel>15&&!c.routes.length)c.createRoute(c.homeId,c.sites[1].id,'steel',6,'truck');
 if(s.rank>=18){for(const site of c.sites.slice(1,3))if(c.stationReady(s)&&c.stationReady(site.sim)&&!c.routes.some(r=>r.to===site.id&&r.mode==='rail'))c.createRoute(c.homeId,site.id,'grain',6,'rail');}
 if(s.rank>=22&&s.money>2200&&c.defense<12)c.council('defense');
 if(s.rank>=23&&s.money>3000&&c.investments.length<4)c.council('invest','estern');
 if(s.rank>=24&&c.support<87&&s.money>1000)c.council('welfare');
 if(s.rank>=25&&s.money>2400){for(const id of Object.keys(NATIONS).filter(id=>NATIONS[id].playable&&id!=='estern'&&!c.recognition.includes(id))){if(c.recognition.length>=8)break;if(!c.council('recognition',id).ok)break;}for(const site of c.sites)if(!site.territory&&s.money>2200)c.council('territory',site.id);}
 // Plant after local timber runs low; actions have normal material/cash costs.
 if(s.buildings.some(b=>b.type==='lumber'&&!s.closestNatural(b,'tree'))&&s.money>200){for(const t of s.tiles){if(t.x<8||t.x>15||t.z<8||t.z>15||t.z%2===1)continue;if(s.plant(t.x,t.z).ok)break;}}
 if(s.money<100)s.recover();
 if(s.rank!==lastRank){lastRank=s.rank;lastAction=s.time;}
 if(s.time-lastAction>3600){console.error('BLOCKED',s.rank,s.promotion(),s.stock,s.buildings.map(b=>[b.type,b.x,b.z,b.status]),s.money,c.routes,c.sites.map(site=>({id:site.id,power:site.sim.power,rail:[...site.sim.rails],buildings:site.sim.buildings.map(b=>[b.type,b.x,b.z,b.status]),stock:site.sim.stock})));process.exit(1);}
}
for(let i=0;i<240000&&c.rank<32;i++){if(i%40===0)operate();c.tick(.25);if(i>0&&i%8000===0){const before=c.save();c=new Campaign({saved:decodeSave(encodeSave(before))});assert.deepEqual(c.save(),before,'periodic save recovery preserves full campaign');}}
assert.equal(c.rank,32,'all 33 ranks must be reachable through player actions');assert.equal(milestones.length,32);assert.ok(c.treasury.produced.car>=80);assert.ok(c.metric('territories')>=5);assert.ok(c.routes.filter(r=>r.mode==='rail'&&r.completed>0).length>=2);console.log('FULL CAMPAIGN PASS',JSON.stringify({day:c.active.day,sites:c.sites.length,revenue:Math.round(c.treasury.totalRevenue),produced:c.treasury.produced,milestones:milestones.length}));
