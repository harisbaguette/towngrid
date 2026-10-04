import * as THREE from 'three';
import {EffectBatch,FX} from './effect-batch.js';
import {daylight} from './effect-state.js';
import {BUILDINGS} from './simulation.js';

export class DayNightLighting{
 constructor(owner,atlas){
  this.owner=owner;this.batch=new EffectBatch(owner.scene,atlas,'window-light',64);
  this.material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,uniforms:{tint:{value:new THREE.Vector3()},strength:{value:0}},vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform vec3 tint;uniform float strength;void main(){gl_FragColor=vec4(tint,strength);}'});
  this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);this.mesh.frustumCulled=false;this.mesh.renderOrder=18;this.mesh.userData.worldTint=true;owner.scene.add(this.mesh);
 }
 update(f){
  const {night,dusk}=daylight(f.sim.time),storm=f.weather.rain*.065,mana=f.weather.mana*.04;
  const color=night>.05?'#20365d':dusk>.05?'#bd7d4a':mana?'#69467f':'#617580',alpha=night*.19+dusk*.055+storm+mana;
  const c=new THREE.Color(color).convertLinearToSRGB();this.material.uniforms.tint.value.set(c.r,c.g,c.b);this.material.uniforms.strength.value=alpha;this.mesh.visible=alpha>.001;
  f.owner.renderer.worldTint={color,alpha};
  const b=this.batch;b.begin();if(f.near&&night>.05)for(const model of f.owner.models.values()){
   const facility=model.userData.building,def=BUILDINGS[facility?.type];if(!facility||facility.health<=0||facility.enabled===false||facility.movingUntil>f.sim.time)continue;
   const lit=def?.home||model.userData.production?.active||model.userData.production?.working;
   if(!lit||def?.terrain||def?.group==='farm')continue;
   b.add(FX.glow,facility.x,.40,facility.z,.58,.46,night*.38,'#ffcf7e');
  }b.end();
 }
 dispose(){this.batch.dispose();this.mesh.removeFromParent();this.mesh.geometry.dispose();this.material.dispose();this.owner.renderer.worldTint=null;}
}
