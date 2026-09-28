import assert from 'node:assert/strict';
import {Simulation} from '../src/app/game/simulation.js';
import {Campaign} from '../src/app/game/campaign.js';
import {encodeSave,decodeSave} from '../src/app/game/persistence.js';
import {PROVINCES} from '../src/app/game/territory.js';
import {NATIONS} from '../src/app/game/world.js';
import {ROUTE_KINDS,MAJOR_ROUTES,WATERWAYS,TRADE_CONNECTIONS,TRADE_LINKS} from '../src/app/game/trade-routes.js';
const run=(s,t)=>{for(let i=0;i<t*4;i++)s.tick(.25);};
const LAND=['silk','paved','rural','mountain'],WATER=['coast','river','lake','canal','stream','ferry'];
const provinceWith=kind=>PROVINCES.find(p=>NATIONS[p.nation].playable&&TRADE_CONNECTIONS[p.id].some(o=>o.kind===kind));
// A lone site placed in any province, selling through the given kind of route: the smallest
// stand-in for the campaign record a real site gets.
const fresh=kind=>{const province=provinceWith(kind);assert.ok(province,'a playable province reaches '+kind);const s=new Simulation('river',null,{nation:province.nation});s.campaign={sites:[{id:'t',provinceId:province.id}],homeId:'t',support:50,metric:()=>0,onPromotion(){}};s.siteId='t';s.nextEvent=1e9;s.autoSell={};s.build('warehouse',10,12);assert.ok(s.chooseTradeRoute(TRADE_CONNECTIONS[province.id].find(o=>o.kind===kind).id).ok);return s;};
const inside=(p,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i],[xj,yj]=poly[j];if((yi>p[1])!==(yj>p[1])&&p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi)c=!c;}return c;};

// Port sizes follow the water they stand on.
assert.deepEqual(Object.fromEntries(WATER.map(k=>[k,ROUTE_KINDS[k].capacity])),{coast:200,river:100,lake:100,canal:30,stream:30,ferry:10});
// Every province has a land connection (two where roads cross) and may add each kind of water it touches.
const all=Object.values(TRADE_CONNECTIONS).flat();
assert.equal(Object.keys(TRADE_CONNECTIONS).length,PROVINCES.length);
for(const p of PROVINCES){const list=TRADE_CONNECTIONS[p.id];assert.ok(list.some(o=>LAND.includes(o.kind)),p.id+' has a land route');assert.equal(new Set(list.map(o=>o.kind)).size,list.length,p.id+' lists each kind once');}
for(const kind of Object.keys(ROUTE_KINDS))assert.ok(all.some(o=>o.kind===kind),kind+' is used somewhere');
for(const o of all){assert.equal(o.capacity,ROUTE_KINDS[o.kind].capacity);assert.ok(o.line.length>=2,'the atlas can highlight '+o.id);assert.equal(o.scale==='minor',o.id.startsWith('minor:'));}
const terrains=new Set(all.filter(o=>o.kind==='river').map(o=>o.terrain));assert.ok(terrains.has('강 하구')&&terrains.has('강 중상류'),'river ports sit on both estuaries and upper reaches');
assert.deepEqual([...new Set(all.filter(o=>o.kind==='coast').map(o=>o.terrain))],['바다 해안']);
for(const kind of ['silk','paved'])assert.ok(MAJOR_ROUTES.some(r=>r.kind===kind),kind+' road is drawn');
for(const kind of WATER)assert.ok(WATERWAYS.some(w=>w.kind===kind),kind+' water is on the map');
for(const w of WATERWAYS.filter(w=>w.kind==='lake'))for(const p of PROVINCES)assert.ok(!inside(p.point,w.line),p.id+' does not sit in '+w.name);
assert.ok(TRADE_LINKS.length>50,'links are drawn across the map');

// One shipment never carries more than the route or port allows.
for(const kind of ['coast','lake','canal','ferry','mountain']){const s=fresh(kind),cap=ROUTE_KINDS[kind].capacity;s.stock.wood=240;
 const r=s.sell('wood',240);assert.ok(r.ok);assert.equal(s.shipments[0].amount,cap,kind+' ships '+cap);assert.equal(s.stock.wood,240-cap);}

// Auto-sale waits for min(10, capacity) and then ships up to one full lot.
{const s=fresh('mountain');s.reserves.wood=0;s.autoSell={wood:true};s.stock.wood=7;s.salesTimer=7.9;run(s,.25);assert.equal(s.shipments.length,0,'7 is below the mountain lot of 8');
 s.stock.wood=9;s.salesTimer=7.9;run(s,.25);assert.equal(s.shipments[0]?.amount,8);}
{const s=fresh('coast');s.reserves.wood=0;s.autoSell={wood:true};s.stock.wood=230;s.salesTimer=7.9;run(s,.25);assert.equal(s.shipments[0]?.amount,200,'a sea port takes a big auto lot');}

// A province on several routes can switch; the route changes lot size and price.
const multi=PROVINCES.find(p=>p.id.endsWith('-0')&&NATIONS[p.nation].playable&&TRADE_CONNECTIONS[p.id].length>1&&new Set(TRADE_CONNECTIONS[p.id].map(o=>o.price)).size>1);
assert.ok(multi,'some capital has a choice of routes');
const s=new Simulation('river',null,{nation:multi.nation}),[a,b]=TRADE_CONNECTIONS[multi.id];assert.equal(s.tradeConnection().id,a.id,'best route by default');
const quoteA=s.saleQuote('bread',10);assert.ok(s.chooseTradeRoute(b.id).ok);assert.equal(s.tradeConnection().id,b.id);
const quoteB=s.saleQuote('bread',10);assert.ok(Math.abs(quoteA/quoteB-a.price/b.price)<.03,'price follows the route');
assert.equal(s.chooseTradeRoute('ocean-lane-nope').ok,false);const far=all.find(o=>!TRADE_CONNECTIONS[multi.id].some(v=>v.id===o.id));assert.equal(s.chooseTradeRoute(far.id).ok,false,'a route this province does not touch');assert.equal(s.tradeConnection().id,b.id);

// The choice survives save/load. A route id the map no longer has falls back to the best route;
// a value that is not an id at all is rejected; old saves still load.
const back=new Simulation('river',decodeSave(encodeSave(s.save())));assert.equal(back.tradeConnection().id,b.id);
const gone=s.save();gone.tradeRoute='minor:vanished-province';assert.equal(new Simulation('river',decodeSave(encodeSave(gone))).tradeConnection().id,a.id);
const bad=s.save();bad.tradeRoute=42;assert.throws(()=>encodeSave(bad));bad.tradeRoute='x'.repeat(65);assert.throws(()=>encodeSave(bad));
const old=s.save();delete old.tradeRoute;const upgraded=new Simulation('river',decodeSave(encodeSave(old)));assert.equal(upgraded.tradeConnection().id,a.id);

// Campaign sites sell through their own province, not the capital's.
const c=new Campaign({demo:true});assert.ok(c.sites.some(v=>!v.provinceId.endsWith('-0')),'the demo has a site away from a capital');
for(const v of c.sites)assert.deepEqual(v.sim.tradeOptions(),TRADE_CONNECTIONS[v.provinceId],v.id+' sells through its own province');
console.log(JSON.stringify({result:'PASS',checked:['port sizes by water','a land route in every province','10 route kinds on the map','estuary and upper river ports','no province inside a lake','lot capped by route','auto lot min(10,cap)','route choice changes lot and price','foreign route rejected','save/load keeps choice','vanished route falls back','tampered route rejected','old save loads','campaign sites use their province']}));
