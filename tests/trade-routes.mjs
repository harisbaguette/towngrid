import assert from 'node:assert/strict';
import {Simulation} from '../src/app/game/simulation.js';
import {Campaign} from '../src/app/game/campaign.js';
import {encodeSave,decodeSave} from '../src/app/game/persistence.js';
import {PROVINCES} from '../src/app/game/territory.js';
import {NATIONS} from '../src/app/game/world.js';
import {ROUTE_KINDS,MAJOR_ROUTES,WATERWAYS,TRADE_CONNECTIONS,TRADE_LINKS} from '../src/app/game/trade-routes.js';
const run=(s,t)=>{for(let i=0;i<t*4;i++)s.tick(.25);};
const LAND=['silk','paved','rural','mountain'],WATER=['coast','river','lake','canal','stream','ferry'];
// The first land connection of a province is the one its gate uses.
const provinceWith=kind=>PROVINCES.find(p=>NATIONS[p.nation].playable&&TRADE_CONNECTIONS[p.id].find(o=>ROUTE_KINDS[o.kind].scale!=='port')?.kind===kind);
// A lone site placed in any province, selling through the given kind of land route: the smallest
// stand-in for the campaign record a real site gets.
const fresh=kind=>{const province=provinceWith(kind);assert.ok(province,'a playable province reaches '+kind);const s=new Simulation('river',null,{nation:province.nation});s.campaign={sites:[{id:'t',provinceId:province.id}],homeId:'t',support:50,metric:()=>0,onPromotion(){}};s.siteId='t';s.nextEvent=1e9;s.autoSell={};s.build('warehouse',10,12);assert.equal(s.tradeConnection().kind,TRADE_CONNECTIONS[province.id].find(o=>ROUTE_KINDS[o.kind].scale!=='port').kind);return s;};
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

// Without terminal buildings a site sells through its west gate: 10 a lot, or less on a smaller land route.
// Ports, hubs and their choice are covered by tests/trade-terminals.mjs.
for(const kind of LAND){const s=fresh(kind),cap=Math.min(10,ROUTE_KINDS[kind].capacity);s.stock.wood=240;
 const r=s.sell('wood',240);assert.ok(r.ok);assert.equal(s.shipments[0].amount,cap,kind+' gate ships '+cap);assert.equal(s.stock.wood,240-cap);}

// Auto-sale waits for min(10, lot) and then ships up to one full lot.
{const s=fresh('mountain');s.reserves.wood=0;s.autoSell={wood:true};s.stock.wood=7;s.salesTimer=7.9;run(s,.25);assert.equal(s.shipments.length,0,'7 is below the mountain lot of 8');
 s.stock.wood=9;s.salesTimer=7.9;run(s,.25);assert.equal(s.shipments[0]?.amount,8);}

// A terminal id the site does not have is refused; a chosen id that vanished falls back to the gate;
// a value that is not an id is rejected; old saves still load.
const s=fresh('paved');assert.equal(s.chooseTradeRoute('b:404').ok,false);assert.equal(s.chooseTradeRoute(TRADE_CONNECTIONS[s.campaign.sites[0].provinceId][0].id).ok,false,'route ids are not terminals');
const gone=s.save();gone.tradeRoute='b:404';assert.equal(new Simulation('river',decodeSave(encodeSave(gone))).tradeConnection().id,'gate');
const bad=s.save();bad.tradeRoute=42;assert.throws(()=>encodeSave(bad));bad.tradeRoute='x'.repeat(65);assert.throws(()=>encodeSave(bad));
const old=s.save();delete old.tradeRoute;assert.equal(new Simulation('river',decodeSave(encodeSave(old))).tradeConnection().id,'gate');

// Campaign sites sell through their own province, not the capital's.
const c=new Campaign({demo:true});assert.ok(c.sites.some(v=>!v.provinceId.endsWith('-0')),'the demo has a site away from a capital');
for(const v of c.sites)assert.deepEqual(v.sim.tradeOptions(),TRADE_CONNECTIONS[v.provinceId],v.id+' sells through its own province');
console.log(JSON.stringify({result:'PASS',checked:['port sizes by water','a land route in every province','10 route kinds on the map','estuary and upper river ports','no province inside a lake','gate lot by land route','auto lot min(10,cap)','unknown terminal rejected','vanished terminal falls back','tampered choice rejected','old save loads','campaign sites use their province']}));
