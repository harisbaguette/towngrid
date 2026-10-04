import * as THREE from 'three';
import {GameScene} from './scene.js';
import {Simulation} from './simulation.js';
import {loadAssets} from './assets.js';
import {WORLD_CELLS} from './world-grid.js';
import {cellLayout,worldOrigin,WorldTerrainData} from './world-space.js';
import {landformOf,LANDFORMS,mountainCourse} from './landform-data.js';
import {WORLD_PLOTS} from './territory.js';
import {NATIONS} from './world.js';

await loadAssets('human');
const params=new URLSearchParams(location.search),examples={},data=new WorldTerrainData();
for(const cell of WORLD_CELLS){const id=landformOf(cellLayout(cell.cx,cell.cz)).id;if(!examples[id])examples[id]={cell,x:cell.cx*24+11.5,z:cell.cz*24+11.5};}
for(const cell of WORLD_CELLS.filter(c=>c.site&&cellLayout(c.cx,c.cz).ecology==='desert'))for(const t of data.tiles(cell)){
 if(t.water)continue;for(const id of [t.oasis?'oasis':null,t.oil>=85?'oilfield':null])if(id&&!examples[id])examples[id]={cell,x:cell.cx*24+t.x,z:cell.cz*24+t.z};
}
const pond=WORLD_CELLS.find(c=>c.site&&cellLayout(c.cx,c.cz).ecology==='meadow'),pondTile=data.tiles(pond).find(t=>t.water==='pond');examples.pond={cell:pond,x:pond.cx*24+pondTile.x,z:pond.cz*24+pondTile.z};
const catalog={...LANDFORMS,valley:{name:'계곡·계류'},capital:{name:'수도'},town:{name:'기존 마을'},fortress:{name:'적대 요새'}};
const valley=WORLD_CELLS.find(c=>c.terrain==='mountain'&&mountainCourse(c));if(valley)examples.valley={cell:valley,x:valley.cx*24+11.5,z:valley.cz*24+11.5};
for(const [id,plot]of [['capital',WORLD_PLOTS.find(p=>p.capital&&NATIONS[p.nation]?.playable)],['town',WORLD_PLOTS.find(p=>p.developed&&!p.capital)],['fortress',WORLD_PLOTS.find(p=>p.developed&&!NATIONS[p.nation]?.playable)]])if(plot){const cell=WORLD_CELLS.find(c=>c.site===plot.id);examples[id]={cell,x:cell.cx*24+11.5,z:cell.cz*24+11.5};}
const select=document.querySelector('#landform');
for(const [id,form]of Object.entries(catalog))if(examples[id])select.add(new Option(form.name,id));
select.value=examples[params.get('landform')]?params.get('landform'):'mountain';
const sim=new Simulation('river',null,{nation:'estern',provinceId:'estern-3',seed:0});sim.paused=true;
const game=new GameScene(document.querySelector('#map'),sim,{}, {forceSoftware:params.get('renderer')==='canvas'});game.worldPicking=true;
let wide=false,boundary;
function show(){
 const id=select.value,e=examples[id];game.flyToWorld(e.x,e.z,wide?135:['pond','oilfield','oasis'].includes(id)?24:68,{animate:false});
 document.querySelector('#name').textContent=catalog[id].name;
 document.querySelector('#description').textContent=['mountain','rockMountain','snowMountain','volcano'].includes(id)?'산기슭·경사면·능선·봉우리가 한 지역을 채웁니다.':id==='oilfield'?'실제 원유 농도가 높은 지표입니다.':id==='oasis'?'실제 담수 주변의 비옥한 땅입니다.':'같은 좌표의 지형을 확대해 살펴봅니다.';
 if(boundary){game.scene.remove(boundary);boundary.geometry.dispose();boundary.material.dispose();}
 const [ox,oz]=worldOrigin(game.sim),x=e.cell.cx*24-.5-ox,z=e.cell.cz*24-.5-oz;
 boundary=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[x,z],[x+24,z],[x+24,z+24],[x,z+24]].map(([a,b])=>new THREE.Vector3(a,.1,b))),new THREE.LineBasicMaterial({color:'#ffe293',depthTest:false}));boundary.renderOrder=30;boundary.visible=document.querySelector('#grid').getAttribute('aria-pressed')==='true';game.scene.add(boundary);
 const url=new URL(location);url.searchParams.set('landform',id);history.replaceState(null,'',url);if(game.renderer.isSoftware){url.searchParams.delete('renderer');document.querySelector('#renderer').textContent='WebGL 비교';}else url.searchParams.set('renderer','canvas');document.querySelector('#renderer').href=url.pathname+url.search;
 game.lastPaint=null;
}
select.onchange=show;document.querySelector('#rotate').onclick=()=>game.rotate(1);
document.querySelector('#zoom').onclick=e=>{wide=!wide;e.target.textContent=wide?'가까이 보기':'주변까지 보기';show();};
document.querySelector('#grid').onclick=e=>{boundary.visible=!boundary.visible;e.target.setAttribute('aria-pressed',String(boundary.visible));game.lastPaint=null;};
show();window.landformsPreview={game,examples,show};addEventListener('pagehide',()=>{boundary.geometry.dispose();boundary.material.dispose();game.dispose();},{once:true});
