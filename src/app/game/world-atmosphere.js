import {FogLayer} from './fog-layer.js';
import {CloudLayer} from './cloud-layer.js';
import {worldOrigin} from './world-space.js';

export class WorldAtmosphere {
 constructor(owner){
  this.owner=owner;this.time=0;this.fog=new FogLayer();this.clouds=new CloudLayer();
  owner.scene.add(this.fog.group,this.clouds.group);
  this.motion=window.matchMedia('(prefers-reduced-motion: reduce)');
 }
 update(delta){
  if(this.disposed)return;
  const s=this.owner,origin=worldOrigin(s.sim),camera=s.camera;
  // Start previews are paused simulations; weather has its own unsaved clock.
  // Reduced motion freezes drift while retaining the same fog/cloud artwork.
  if(!this.motion.matches&&!this.paused)this.time+=Math.min(delta,.1);
  const frame={camera,origin,focus:[s.controls.target.x+origin[0],s.controls.target.z+origin[1]],span:s.worldSpan(),height:(camera.top-camera.bottom)/camera.zoom,time:this.time,delta:this.motion.matches?0:delta,building:!!s.mode,low:s.quality==='low'||s.renderer.isSoftware};
  this.fog.update(frame);this.clouds.update(frame);
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.fog.dispose();this.clouds.dispose();}
}
