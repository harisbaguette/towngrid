// World terrain grid (world-grid.js): the atlas is cut into squares, each province's site is one square,
// and each side of its 24×24 local map is the terrain of the square beside it. Headless.
import assert from 'node:assert/strict';
import {Simulation,RESOURCES} from '../src/app/game/simulation.js';
import {Campaign} from '../src/app/game/campaign.js';
import {encodeSave,decodeSave} from '../src/app/game/persistence.js';
import {PROVINCES} from '../src/app/game/territory.js';
import {NATIONS} from '../src/app/game/world.js';
import {TRADE_CONNECTIONS} from '../src/app/game/trade-routes.js';
import {provinceZone} from '../src/app/game/infrastructure.js';
import {WORLD_CELLS,SIDES,WATER_KINDS,WATERWAYS,COLS,ROWS,layoutOf,legacyLayout,terrainOfCell,waterAt,groundOf,validLayout,regionOf} from '../src/app/game/world-grid.js';
import {ecologyOf} from '../src/app/game/biome-data.js';
const K=(x,z)=>x+','+z;

// Every province has a site square, and each side of its map is the square beside it.
for(const p of PROVINCES){
 const l=layoutOf(p.id);assert.ok(validLayout(l),p.id);
 for(const [side,dx,dz] of SIDES)assert.equal(l.edges[side],terrainOfCell(l.cell[0]+dx,l.cell[1]+dz),p.id+' '+side);
 // The water a province trades on is exactly the water on its sides (small waterways go by distance).
 const water=TRADE_CONNECTIONS[p.id].map(o=>o.kind).filter(k=>WATER_KINDS.includes(k)).sort();
 assert.deepEqual(water,[...new Set(Object.values(l.edges).filter(k=>WATER_KINDS.includes(k)))].sort(),p.id);
 assert.ok(WORLD_CELLS.some(c=>c.site&&c.cx===l.cell[0]&&c.cz===l.cell[1]),p.id+' sits on a site square');
}
// No two provinces share a site square.
assert.equal(new Set(PROVINCES.map(p=>layoutOf(p.id).cell.join(','))).size,PROVINCES.length,'one site square per province');
assert.equal(WORLD_CELLS.filter(c=>c.site).length,PROVINCES.length);
const count=kind=>PROVINCES.filter(p=>Object.values(layoutOf(p.id).edges).includes(kind)).length;
for(const kind of ['coast','river','lake','canal','stream','mountain','forest','ice','desert'])assert.ok(count(kind)>0,'some site borders '+kind);
// Every nation's capital plays like its nation (coast, river or highland), as before the grid.
for(const [id,n] of Object.entries(NATIONS))assert.equal(regionOf(layoutOf(id+'-0')),n.region,id+' capital plays like its nation');
// The map is built for play: seas are gulfs and an inland sea, not an empty ocean, and every one of the
// eight ecologies can be started by a playable nation.
{const sea=WATERWAYS.filter(w=>w.kind==='coast').reduce((n,w)=>n+w.cells.length,0);assert.ok(sea/(COLS*ROWS)<.2,'sea under a fifth of the map');
 const eco=new Set(PROVINCES.filter(p=>NATIONS[p.nation].playable).map(p=>ecologyOf(layoutOf(p.id))));
 for(const e of ['meadow','forest','coast','marsh','basin','volcanic','snow','desert'])assert.ok(eco.has(e),'a playable site in '+e);
 assert.ok(PROVINCES.some(p=>TRADE_CONNECTIONS[p.id].some(o=>o.kind==='ferry')),'some site on a ferry route');}

// A new site takes its province's map: the start land and the export road stay dry, the water on a side
// is that side's kind, and a port stands only on its own kind of water.
const site=(provinceId,nation=provinceId.split('-')[0])=>{const s=new Simulation(NATIONS[nation].region,null,{nation,provinceId});s.nextEvent=1e9;s.money=1e7;s.debt=0;s.rank=32;for(const r of Object.keys(RESOURCES))s.stock[r]=200;return s;};
const seaSite=PROVINCES.find(p=>NATIONS[p.nation].playable&&Object.values(layoutOf(p.id).edges).includes('coast'));
{const s=site(seaSite.id);assert.equal(s.provinceId,seaSite.id);assert.equal(s.region,'coast');
 for(const t of s.tiles){
  assert.equal(t.water,waterAt(s.layout,t.x,t.z));assert.equal(t.terrain==='water',!!t.water);
  if(t.x>=8&&t.x<=15&&t.z>=8&&t.z<=15||t.z===11&&t.x<8)assert.equal(t.terrain,'grass','start land and road stay dry');
 }
 const sea=s.tiles.find(t=>t.water==='coast'&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>s.tile(t.x+dx,t.z+dz)?.terrain==='grass'));
 assert.ok(sea,'the sea side has a shore');
 for(const [dx,dz] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]])if(s.tile(sea.x+dx,sea.z+dz))s.owned.add(K(sea.x+dx,sea.z+dz));
 assert.equal(s.canBuild('riverport',sea.x,sea.z),'큰 강 위에만 지을 수 있습니다');
 assert.equal(s.canBuild('coastport',sea.x,sea.z),null);
 // The layout is saved with the map and comes back as it was.
 s.build('warehouse',11,12);const back=new Simulation('river',decodeSave(encodeSave(s.save())));
 assert.deepEqual(back.layout,s.layout);assert.deepEqual(back.tiles.map(t=>t.water),s.tiles.map(t=>t.water));
 const bad=s.save();bad.land={...bad.land,edges:{...bad.land.edges,n:'lava'}};assert.throws(()=>encodeSave(bad));}

// Mountain, ice and desert sides lay their ground; a mountain side allows conveyors.
{const p=PROVINCES.find(p=>NATIONS[p.nation].playable&&layoutOf(p.id).edges.n==='mountain');const s=site(p.id);
 assert.ok(provinceZone(s).mountain);assert.equal(groundOf(s.layout,12,0),'mountain');assert.equal(s.tile(12,0).ground,'mountain');assert.equal(s.tile(12,12).ground,layoutOf(p.id).biome==='ice'?'ice':layoutOf(p.id).biome==='desert'?'sand':'plain');}
{const p=PROVINCES.find(p=>layoutOf(p.id).biome==='plain'&&!Object.values(layoutOf(p.id).edges).includes('mountain'));assert.equal(provinceZone(site(p.id,'estern')).mountain,false);}

// Saves from before the grid keep their old region water under their buildings.
{const old=new Simulation('coast',null,{land:legacyLayout('coast','rivente-0')}).save();delete old.land;
 const back=new Simulation('coast',decodeSave(encodeSave(old)));assert.equal(back.layout.legacy,'coast');
 assert.ok(back.tiles.every(t=>(t.terrain==='water')===(t.x>=18||t.z<3||t.x>=3&&t.x<=4&&t.z>=5&&t.z<=6)));}
// A bare map (previews) is the old template too.
assert.equal(new Simulation('highland').layout.legacy,'highland');

// Campaign sites are built on their own province's square, and keep it through a save.
{const c=new Campaign({nation:'estern'});assert.equal(c.active.provinceId,'estern-0');assert.deepEqual(c.active.layout,layoutOf('estern-0'));
 c.addDemoBranch();const branch=c.sites.find(v=>v.id==='site-2');assert.equal(branch.sim.provinceId,branch.provinceId);}

console.log(JSON.stringify({result:'PASS',checked:['one site square per province','sides are neighbour squares','trade water = side water','every terrain on some side','capitals play like their nation','sea under a fifth','all ecologies playable','ferry routes','start land and road dry','port on its own water','layout saved','bad layout rejected','mountain side ground and conveyors','old saves keep region water','bare map legacy','campaign sites on their square']}));
