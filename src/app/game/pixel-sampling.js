import * as THREE from 'three';

// Pixel art drawn at any zoom. Nearest sampling without mipmaps drops whole
// art pixels when a 128px cel covers 30-70 screen pixels, so moving bodies
// shimmer, and at 1.3x-1.8x some art pixels become one screen pixel wider
// than their neighbours. Mipmaps cover reduction; the shader keeps each art
// pixel square when enlarged and blends only across its one-screen-pixel edge.
export function configurePixelTexture(texture) {
 texture.magFilter = THREE.LinearFilter;
 texture.minFilter = THREE.LinearMipmapLinearFilter;
 texture.generateMipmaps = true;
 // Filter premultiplied colour, so transparent black never darkens outlines.
 texture.premultiplyAlpha = true;
 return texture;
}

const SAMPLE = /* glsl */`
#ifdef USE_MAP
 vec2 pixelArtSize = vec2( textureSize( map, 0 ) );
 vec2 pixelArtTexel = vMapUv * pixelArtSize;
 vec2 pixelArtBox = clamp( fwidth( pixelArtTexel ), 1e-5, 1.0 );
 vec2 pixelArtShift = pixelArtTexel - .5 * pixelArtBox;
 vec2 pixelArtBlend = smoothstep( 1. - pixelArtBox, vec2( 1. ), fract( pixelArtShift ) );
 vec2 pixelArtUv = ( floor( pixelArtShift ) + .5 + pixelArtBlend ) / pixelArtSize;
 // One level sharper than a plain box filter: a reduced cel keeps its dark
 // outline and colour blocks instead of fading into the ground behind it.
 vec4 sampledDiffuseColor = textureGrad( map, pixelArtUv, dFdx( vMapUv ) * .5, dFdy( vMapUv ) * .5 );
 sampledDiffuseColor.rgb /= max( sampledDiffuseColor.a, 1e-4 );
 sampledDiffuseColor.rgb = mix( sampledDiffuseColor.rgb, vec3( 1. ), pixelArtFlash );
 diffuseColor *= sampledDiffuseColor;
#endif
`;

/** Sharp pixel sampling plus a per-material white hit flash (0..1). */
export function sharpPixelMaterial(material) {
 const flash = { value: 0 };
 material.userData.pixelFlash = flash;
 material.onBeforeCompile = shader => {
  shader.uniforms.pixelArtFlash = flash;
  shader.fragmentShader = 'uniform float pixelArtFlash;\n' + shader.fragmentShader.replace('#include <map_fragment>', SAMPLE);
 };
 material.customProgramCacheKey = () => 'sharp-pixel-art-1';
 return material;
}
