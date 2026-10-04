import {GameScene} from './scene.js';
import {loadAssets} from './assets.js';
import {biomePreview} from './biome-preview.js';
import {BIOMES} from './biome-data.js';
import {BUILDINGS} from './simulation.js';
import {EFFECT_COMPONENTS} from './world-effects.js';

await Promise.all(['human','dwarf','titan'].map(loadAssets));
const params=new URLSearchParams(location.search),effect=document.querySelector('#effect'),biome=document.querySelector('#biome');
const catalog=[['all','전체','환경과 시설의 상태 효과를 함께 표시합니다.'],['fog','안개','지면 가까이 흐르는 반투명 안개'],['clouds','구름','기존 픽셀 원화 4종의 구름'],...EFFECT_COMPONENTS];
for(const [id,label]of catalog)effect.add(new Option(label,id));for(const [id,p]of Object.entries(BIOMES))biome.add(new Option(p.name,id));
const defaults={snow:'snow',wind:'forest',geology:'volcanic',ripples:'coast',shore:'coast',birds:'coast',chimneys:'meadow',work:'basin',magic:'volcanic'};
effect.value=catalog.some(c=>c[0]===params.get('effect'))?params.get('effect'):'all';biome.value=Object.hasOwn(BIOMES,params.get('biome'))?params.get('biome'):defaults[effect.value]||'meadow';
let paused=false,last=performance.now(),sampleBuilding=null,manualClock=true;
const game=new GameScene(document.querySelector('#map'),biomePreview(biome.value),{}, {forceSoftware:params.get('renderer')==='canvas'});
function add(sim,type){
 const tile=sim.tiles.filter(t=>t.x>=7&&t.x<=17&&t.z>=7&&t.z<=17).sort((a,b)=>Math.hypot(a.x-12,a.z-11)-Math.hypot(b.x-12,b.z-11)).find(t=>!sim.canBuild(type,t.x,t.z,true));
 if(!tile)return null;const result=sim.build(type,tile.x,tile.z,true);return result.ok?sim.buildings.find(b=>b.id===result.id):null;
}
function button(label,fn){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{fn();game.lastPaint=null;};document.querySelector('#actions').append(b);}
function reset(){
 const id=effect.value,sim=biomePreview(biome.value);manualClock=id!=='vehicles';
 for(const type of id==='chimneys'?['bakery','smelter','distillery']:id==='magic'?['magetower','arcanepower']:id==='work'?['sawmill','smelter']:id==='all'?['bakery','smelter','sawmill']:[])add(sim,type);
 sim.paused=manualClock||paused;sim.nextEvent=1e9;sim.time=id==='lighting'?44:0;
 if(id==='rain')sim.events=[{type:'storm',time:sim.time}];if(id==='magic')sim.wardUntil=9999;
 for(const b of sim.buildings){if(BUILDINGS[b.type].period){b.working=true;b.progress=.4;b.activeUntil=9999;b.inputs=Object.fromEntries(Object.entries(sim.effectiveInputs(b)).map(([r,n])=>[r,n*5]));}}
 // Explicit display fixtures, isolated from campaigns and never persisted.
 if(manualClock)sim.poweredAt=()=>true;
 game.setSimulation(sim);game.effects.only=id==='all'?null:id;
 game.atmosphere.fog.group.visible=['all','fog'].includes(id);game.atmosphere.clouds.group.visible=['all','clouds'].includes(id);
 const [ox,oz]=sim.layout.cell.map(v=>v*24);game.flyToWorld(ox+11.5,oz+11.5,['chimneys','work','actions','magic','lighting','vehicles'].includes(id)?22:52,{animate:false});
 document.querySelector('#actions').replaceChildren();sampleBuilding=sim.buildings.find(b=>b.type==='well');
 if(id==='actions'){
  button('건설',()=>{sampleBuilding=add(sim,'well')||sampleBuilding;});
  button('피해',()=>{if(sampleBuilding){sampleBuilding.health=Math.max(0,sampleBuilding.health-35);sim.sound('impact',sampleBuilding.x,sampleBuilding.z);sim.revision++;}});
  button('수리',()=>{if(sampleBuilding)sim.repair(sampleBuilding.id);});
  button('철거',()=>{if(sampleBuilding){sim.demolish(sampleBuilding.x,sampleBuilding.z);sampleBuilding=null;}});
  button('생산 완료',()=>{const b=sim.buildings.find(b=>BUILDINGS[b.type].period);if(b){b.cycles=(b.cycles||0)+1;sim.sound('delivery',b.x,b.z);}});
 }
 if(id==='vehicles')button('화물 출발',()=>{sim.paused=false;sim.stock.grain=100;const result=sim.sell('grain',6);document.querySelector('#description').textContent=result.ok?'실제 수출 경로를 따라 이동합니다.':result.error;});
 if(id==='magic')button('정전 / 복구',()=>{sim.outageUntil=sim.outageUntil>sim.time?0:sim.time+9999;});
 if(id==='lighting')for(const [label,t]of [['낮',8],['해질녘',24],['밤',44]])button(label,()=>{sim.time=t;});
 const [,label,description]=catalog.find(c=>c[0]===id);document.querySelector('#name').textContent=label;document.querySelector('#description').textContent=description;
 const url=new URL(location);url.searchParams.set('effect',id);url.searchParams.set('biome',biome.value);history.replaceState(null,'',url);
 const alternate=new URL(url);if(game.renderer.isSoftware){alternate.searchParams.delete('renderer');document.querySelector('#renderer').textContent='WebGL 비교';}else alternate.searchParams.set('renderer','canvas');document.querySelector('#renderer').href=alternate.pathname+alternate.search;
 game.effects.update();
}
effect.onchange=()=>{biome.value=defaults[effect.value]||biome.value;reset();};biome.onchange=reset;
document.querySelector('#rotate').onclick=()=>game.rotate(1);
document.querySelector('#pause').onclick=e=>{paused=!paused;game.atmosphere.paused=paused;if(!manualClock)game.sim.paused=paused;e.target.textContent=paused?'동작 재개':'동작 멈추기';};
function tick(now){const dt=Math.min((now-last)/1000,.1);last=now;
 if(!paused&&!document.hidden&&!game.atmosphere.motion.matches&&manualClock){
  const sim=game.sim;if(effect.value!=='lighting')sim.time+=dt;
  for(const b of sim.buildings)b.animationTime=sim.time;
  if(effect.value==='rain')sim.events[0].time=sim.time;
 }requestAnimationFrame(tick);
}
reset();requestAnimationFrame(tick);window.effectsPreview={isRunning:()=>!paused&&!game.atmosphere.motion.matches,game,reset,catalog};
addEventListener('pagehide',()=>game.dispose(),{once:true});
