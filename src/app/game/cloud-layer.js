import * as THREE from 'three';
import {AtmosphereLayer} from './atmosphere-layer.js';
import {pixelTexture,pixelImage} from './pixel-environment.js';

/** Four authored pixel cloud silhouettes, moving above the terrain. */
export class CloudLayer extends AtmosphereLayer {
 constructor({count=14,opacity=.52,speed=.14}={}){
  const textures=Array.from({length:4},(_,i)=>{
   const texture=pixelTexture('clouds');texture.offset.x=i/4;texture.minFilter=THREE.LinearFilter;return texture;
  });
  super({name:'drifting-clouds',textures,count,spacing:30,width:.36,aspect:1,altitude:.16,speed,opacity,order:31,seed:227});
 }
 update(frame){
  const image=pixelImage('clouds');
  for(const texture of this.textures)if(image&&texture.image!==image){texture.image=image;texture.needsUpdate=true;}
  super.update(frame);
 }
}
