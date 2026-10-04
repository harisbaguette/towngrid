// Export terminals, pipe and conveyor networks, local power and special ground (infrastructure.js,
// trade-terminals.js). Headless; real builds, sales and ticks.
import assert from 'node:assert/strict';
import {Simulation,RESOURCES,BUILDINGS,createShowcase} from '../src/app/game/simulation.js';
import {encodeSave,decodeSave} from '../src/app/game/persistence.js';
import {PROVINCES} from '../src/app/game/territory.js';
import {TRADE_CONNECTIONS} from '../src/app/game/trade-routes.js';
import {INFRA_BUILDINGS,zoneOf,groundAt} from '../src/app/game/infrastructure.js';
import {legacyLayout} from '../src/app/game/world-grid.js';
import {POWER_REACH} from '../src/app/game/trade-terminals.js';
const run=(s,t)=>{for(let i=0;i<t*4;i++)s.tick(.25);};
const province=test=>PROVINCES.find(p=>test(zoneOf(p.id),TRADE_CONNECTIONS[p.id].map(o=>o.kind)));
// A rich site with the ground of the given province (default: plain) on the old river template, with the
// start land plus the river chunk east of it (x 16–19, z 12–15), so both land and water can be built on.
const town=(provinceId=null,region='river')=>{const s=new Simulation(region,null,{land:legacyLayout(region,provinceId)});
 s.nextEvent=1e9;s.autoSell={};s.money=1e7;s.debt=0;s.rank=32;for(const r of Object.keys(RESOURCES))s.stock[r]=200;s.build('warehouse',11,12);assert.ok(s.expand(4,3).ok);s.revision++;return s;};
const place=(s,type,x,z)=>{assert.equal(s.canBuild(type,x,z),null,type+' at '+x+','+z);s.build(type,x,z);return s.at(x,z);};
const ship=(s,n=200)=>{s.stock.wood=n;const r=s.sell('wood',n);assert.ok(r.ok,r.error);return s.shipments.at(-1).amount;};

// Lot sizes the user set.
assert.deepEqual(Object.fromEntries(Object.entries(INFRA_BUILDINGS).filter(([,d])=>d.terminal).map(([t,d])=>[t,d.terminal.capacity])),
 {roadhub:10,pavedhub:30,snowmobile:10,ferrydock:10,canaldock:30,streamdock:30,riverport:100,lakeport:100,coastport:200,polarferry:10,polarport:30,railterminal:100,airterminal:100});

// The west gate is a built-in 10-lot road terminal.
{const s=town();assert.deepEqual(s.tradeTerminals().map(t=>[t.id,t.capacity]),[['gate',10]]);assert.equal(ship(s),20);}

// Ports stand on water only, on their own kind of water; a big port needs wide water.
{const s=town();
 assert.equal(s.canBuild('ferrydock',15,13),'항구는 물 위에만 지을 수 있습니다');
 assert.equal(s.canBuild('warehouse',16,13)!==null,true,'land buildings stay off the water');
 assert.equal(s.canBuild('coastport',16,13),'바다 위에만 지을 수 있습니다');
 assert.equal(s.canBuild('canaldock',16,13),'운하 위에만 지을 수 있습니다');
 assert.equal(s.canBuild('polarport',16,13),'얼음 지역에서만 지을 수 있습니다');
 const port=place(s,'riverport',16,13),t=s.tradeTerminals().find(t=>t.building===port.id);
 assert.ok(t.usable);assert.equal(t.capacity,100);assert.equal(s.tradeConnection().id,t.id,'the biggest reachable terminal is used by default');
 assert.equal(ship(s),100);run(s,60);assert.equal(s.shipments.length,0,'the cart reaches the port and returns');
 assert.equal(s.canBuild('streamdock',16,14),'하천 위에만 지을 수 있습니다');place(s,'ferrydock',16,14);}
{const s=town(null,'highland');assert.equal(place(s,'streamdock',19,14)&&s.tradeTerminals().find(t=>t.type==='streamdock').capacity,30);}
{const s=town();assert.equal(s.canBuild('ferrydock',4,6),'먼저 이 구역을 확보하세요');}

// Road terminals: next to a road joined to the export road; the paved hub only next to paving.
{const s=town();
 assert.equal(s.canBuild('roadhub',12,14),'무역로와 이어진 도로 옆에 지으세요');
 place(s,'road',8,11);const hub=place(s,'roadhub',8,10);
 assert.equal(s.canBuild('pavedhub',8,12),'무역로와 이어진 포장 도로 옆에만 지을 수 있습니다');
 place(s,'pavedroad',8,11);assert.ok(s.paved.has('8,11')&&s.roads.has('8,11'),'paving keeps the road');
 const paved=place(s,'pavedhub',8,12);const [gate,a,b]=s.tradeTerminals();
 assert.deepEqual([gate.capacity,a.capacity,b.capacity],[10,10,30]);assert.equal(s.tradeConnection().building,paved.id);assert.equal(ship(s),60);
 // A choice holds, survives save/load, and falls back when the terminal is gone.
 run(s,90);assert.ok(s.chooseTradeRoute('b:'+hub.id).ok);assert.equal(ship(s),20);
 const back=new Simulation('river',decodeSave(encodeSave(s.save())));assert.equal(back.tradeConnection().building,hub.id);assert.ok(back.paved.has('8,11'));
 assert.equal(s.chooseTradeRoute('b:9999').ok,false);
 run(s,90);assert.ok(s.demolish(8,10).ok);assert.equal(s.tradeConnection().building,paved.id,'a demolished choice falls back');
 paved.health=0;s.revision++;assert.equal(s.tradeConnection().id,'gate','a broken terminal is skipped');
 assert.match(s.chooseTradeRoute('b:'+paved.id).error,/파손됨/);}

// Rail terminal next to a joined railway; airport next to a joined road, air terminal next to the airport.
{const s=town();
 assert.equal(s.canBuild('railterminal',8,10),'무역로와 이어진 철로 옆에만 지을 수 있습니다');
 place(s,'rail',8,11);const rail=place(s,'railterminal',8,10);assert.equal(s.tradeTerminals().find(t=>t.building===rail.id).capacity,100,'rail is not held to the land route lot');
 const gate=s.tradeTerminals()[0],quote=s.saleQuote('bread',10);assert.ok(s.chooseTradeRoute('b:'+rail.id).ok);assert.ok(Math.abs(s.saleQuote('bread',10)/quote-1.03/gate.price)<.03,'price follows the terminal');
 assert.equal(s.canBuild('airterminal',9,12),'공항 바로 옆에만 지을 수 있습니다');
 place(s,'airport',8,12);assert.notEqual(s.canBuild('airport',9,10),null,'one airport per site');
 place(s,'road',9,11);const air=place(s,'airterminal',9,12);const t=s.tradeTerminals().find(t=>t.building===air.id);
 assert.equal(t.capacity,100);assert.ok(t.price>s.tradeTerminals().find(t=>t.building===rail.id).price,'air pays more');}

// Ice: snowmobile hubs anywhere, only polar ports on the water; ice slows farms and wells.
{const ice=province(z=>z.ice);const s=town(ice.id);
 const sled=place(s,'snowmobile',13,14);assert.equal(s.tradeTerminals().find(t=>t.building===sled.id).capacity,10);
 assert.equal(s.canBuild('riverport',16,13),'얼음 지역에서는 극지 항과 극지 나룻터만 지을 수 있습니다');
 const port=place(s,'polarport',16,13);assert.equal(s.tradeTerminals().find(t=>t.building===port.id).capacity,30);place(s,'polarferry',16,14);
 assert.equal(groundAt(s,12,14),'ice');assert.ok(s.tileMultiplier('well',12,14)<new Simulation('river').tileMultiplier('well',12,14));}
{const s=town();assert.equal(s.canBuild('snowmobile',13,14),'얼음 지역에서만 지을 수 있습니다');}

// Desert: sand slows wells and helps oil. Mountain: a ridge of mountain tiles, conveyors allowed.
{const desert=province(z=>z.desert&&!z.ice),s=town(desert.id);assert.equal(groundAt(s,12,14),'sand');
 assert.ok(s.tileMultiplier('well',12,14)<new Simulation('river').tileMultiplier('well',12,14));assert.equal(town().canBuild('conveyor',12,14),'산악 지역에서만 깔 수 있습니다');}
{const high=province(z=>z.mountain&&!z.ice),s=town(high.id);assert.ok(s.tiles.some(t=>t.ground==='mountain'),'a mountain side lays mountain ground');assert.notEqual(groundAt(s,12,14),'mountain');
 place(s,'conveyor',12,14);assert.ok(s.conveyors.has('12,14'));}

// Pipes move water from a well into the warehouse without residents; demolishing a pipe keeps the ground.
{const s=town();s.workers=[];const well=place(s,'well',9,14);place(s,'pipe',10,14);place(s,'pipe',10,13);place(s,'pipe',10,12);for(const r of Object.keys(RESOURCES))s.stock[r]=0;
 well.out=6;s.revision++;run(s,3);assert.ok(s.stock.water>=3,'water reached the warehouse through the pipe');assert.ok(s.logisticsStats.direct>=3);
 assert.equal(s.canBuild('road',10,13),'관을 먼저 철거하세요');s.demolish(10,13);assert.ok(!s.pipes.has('10,13'));
 const back=new Simulation('river',decodeSave(encodeSave(s.save())));assert.deepEqual([...back.pipes].sort(),['10,12','10,14']);}

// Power reaches POWER_REACH tiles from a running plant; a substation in reach carries it further.
{const s=town();const plant=place(s,'generator',8,8),shop=place(s,'workshop',15,15);plant.activeUntil=1e9;s.revision++;
 assert.ok(!s.poweredAt(shop),'7 tiles is out of reach');assert.equal(POWER_REACH,6);
 place(s,'substation',12,10);assert.ok(s.poweredAt(shop));
 plant.activeUntil=0;s.revision++;assert.ok(!s.poweredAt(shop),'no running plant, no power');}
{const s=createShowcase();run(s,10);assert.ok(s.automatic,'the showcase logistics hub is on the grid');
 for(const b of s.buildings.filter(b=>BUILDINGS[b.type].power))assert.ok(s.poweredAt(b),b.type+' is powered in the showcase');}

// Old saves without the new sets still load.
{const s=town();const old=s.save();delete old.paved;delete old.pipes;delete old.conveyors;const back=new Simulation('river',decodeSave(encodeSave(old)));assert.equal(back.paved.size+back.pipes.size+back.conveyors.size,0);
 const bad=s.save();bad.pipes=['x'];assert.throws(()=>encodeSave(bad));}

console.log(JSON.stringify({result:'PASS',checked:['user lot sizes','gate lot 10','ports on water only','port kind by tile water','river port ships 100','road hub needs joined road','paved hub needs paving','choice save/load/fallback','broken terminal skipped','rail terminal and its price','airport and air terminal','ice snowmobile and polar ports','desert sand','mountain side and conveyor','pipe moves water','power reach and substation','showcase powered','old saves']}));
