import * as THREE from 'three';
// A vertical disc turns in its own plane before projection into the quarter view.
// Rotating the already projected ellipse makes its axle wobble on screen.
export function discProjection(view,axis='x') {
 const azimuth=Math.PI/4+view*Math.PI/2+(axis==='z'?Math.PI/2:0);
 return [Math.cos(azimuth),-Math.sin(azimuth)/Math.sqrt(3),0,Math.sqrt(2/3)];
}
export function projectPart(layer,view,axis='x') {
 const u=layer.userData;
 if(!u.discUniform) {
  u.discUniform={value:discProjection(view,axis)};
  const material=u.sprite.material;
  material.onBeforeCompile=shader=>{
   shader.uniforms.discBasis=u.discUniform;
   shader.vertexShader='uniform vec4 discBasis;\n'+shader.vertexShader.replace('mvPosition.xy += rotatedPosition;',
    'mvPosition.xy += mat2(discBasis.xy, discBasis.zw) * rotatedPosition;');
  };
  material.customProgramCacheKey=()=> 'pixel-disc-projection-v1';
  // Views that see the disc from behind have a negative basis determinant;
  // without two-sided drawing the flipped sprite is culled and vanishes.
  material.side=THREE.DoubleSide;
  material.needsUpdate=true;
 }
 u.projection=discProjection(view,axis);u.discUniform.value=u.projection;
}
