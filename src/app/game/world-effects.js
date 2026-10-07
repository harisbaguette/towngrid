import * as THREE from 'three';
import {createEffectAtlas} from './effect-batch.js';
import {RainLayer,SnowLayer,WindParticles,TerrainVapor} from './weather-effects.js';
import {WaterRipples,ShoreFoam,BirdFlock} from './nature-effects.js';
import {ChimneyPlumes,WorkParticles,MagicField} from './industry-effects.js';
import {ActionBursts,VehicleTrails} from './action-effects.js';
import {CharacterMotion} from './character-effects.js';
import {DayNightLighting} from './day-night-lighting.js';
import {WorldTerrainData,worldOrigin} from './world-space.js';
import {localWeatherState} from './effect-state.js';
import {waterAt,groundOf} from './world-grid.js';

export const EFFECT_COMPONENTS=[
 ['rain','비','폭풍 예고와 실제 폭풍'],['snow','눈','설원 위의 눈발'],['wind','바람','지형에 따른 낙엽·모래·꽃가루'],
 ['geology','지형 효과','화산 증기·계류 포말'],
 ['ripples','수면','실제 수역의 잔물결·반짝임'],['shore','물가','육지와 맞닿은 수역의 포말'],['birds','새 떼','숲·평야·물가 위 비행'],
 ['chimneys','굴뚝','가동 중인 설비의 연기·증기'],['work','작업','채굴 분진·나무 조각·불티'],['vehicles','차량','이동 중인 육상 수출·화물 차량의 먼지·눈가루'],['characters','인물 동작','발걸음 먼지·작업 타격·짐 내려놓기·피격·쓰러짐'],
 ['actions','시설 변화','건설·철거·이전·수리·피해·생산 완료'],['magic','마력','가동 중인 마법 시설·결계·정전'],['lighting','낮과 밤','게임 시간에 맞는 색조·가동 시설과 주택의 불빛']
];

export class WorldEffects{
 constructor(owner){
  this.owner=owner;this.atlas=createEffectAtlas();this.data=new WorldTerrainData(owner.sim);this.vector=new THREE.Vector3();
  const constructors={rain:RainLayer,snow:SnowLayer,wind:WindParticles,geology:TerrainVapor,ripples:WaterRipples,shore:ShoreFoam,birds:BirdFlock,chimneys:ChimneyPlumes,work:WorkParticles,vehicles:VehicleTrails,characters:CharacterMotion,actions:ActionBursts,magic:MagicField};
  this.components=Object.fromEntries(Object.entries(constructors).map(([key,Type])=>[key,new Type(owner.scene,this.atlas)]));
  this.components.lighting=new DayNightLighting(owner,this.atlas);
 }
 update(){
  if(this.disposed)return;
  const s=this.owner,sim=s.sim,origin=worldOrigin(sim),span=s.worldSpan(),height=(s.camera.top-s.camera.bottom)/s.camera.zoom;
  if(this.data.sim!==sim)this.data.setSimulation(sim);
  const source=s.landscape?.data||this.data,reduced=s.atmosphere.motion.matches;
  const sample=(x,z)=>{
   if(sim.layout.cell)return source.sample(x,z);
   const lx=Math.round(x-origin[0]),lz=Math.round(z-origin[1]),tile=sim.tile(lx,lz);
   return {water:tile?tile.water:waterAt(sim.layout,lx,lz),ground:tile?.ground||groundOf(sim.layout,lx,lz),layout:sim.layout,tile};
  };
  const f={owner:s,sim,origin,span,height,reach:Math.hypot(span,height*1.74)*.5,focus:[s.controls.target.x+origin[0],s.controls.target.z+origin[1]],time:s.atmosphere.time,productionTime:reduced?0:sim.time,near:span<180,low:s.quality==='low'||s.renderer.isSoftware||s.container.clientWidth<700,reduced,weather:localWeatherState(sim,s.controls.target),sample,
   visible:(x,z,y=0)=>{const p=this.vector.set(x-origin[0],y,z-origin[1]).project(s.camera);return Math.abs(p.x)<1.1&&Math.abs(p.y)<1.1;}};
  for(const [id,component]of Object.entries(this.components)){
   component.update(f);
   if(this.only&&id!==this.only){component.batch.mesh.visible=false;if(component.mesh)component.mesh.visible=false;if(id==='lighting')s.renderer.worldTint=null;}
  }
  s.renderer.domElement.dataset.effectParticles=String(Object.values(this.components).reduce((n,c)=>n+(c.batch.mesh.visible?c.batch.items.length:0),0));
 }
 dispose(){if(this.disposed)return;this.disposed=true;for(const c of Object.values(this.components))c.dispose();this.atlas.dispose();this.data.generated.clear();this.owner.renderer.effectSprites?.clear();}
}
