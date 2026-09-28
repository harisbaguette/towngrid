// Project the authored straight strip along connected tile paths, retaining
// both railway rails and the same gauge at every tile edge.
export const CORNER_CENTRES={3:[1,1],6:[1,0],12:[0,0],9:[0,1]};
export function networkSamples(mask,u,v){
 const corner=CORNER_CENTRES[mask];
 if(corner){const x=Math.abs(u-corner[0]),y=Math.abs(v-corner[1]),r=Math.hypot(x,y);return r>1?[]:[[r,Math.atan2(y,x)*.5]];}
 const samples=[];
 if((mask&5)&&((mask&1)||v<.64)&&((mask&4)||v>.36))samples.push([u,v]);
 if((mask&10)&&((mask&2)||u<.64)&&((mask&8)||u>.36))samples.push([v,u]);
 if(mask===0&&v>.25&&v<.75)samples.push([u,v]);
 return samples;
}
export function networkShader(mask){
 const corner=CORNER_CENTRES[mask];
 if(corner)return `vec2 d=abs(vMapUv-vec2(${corner[0]}.0,${corner[1]}.0));float r=length(d);if(r>1.0)discard;vec4 sampledDiffuseColor=surfaceSample(vec2(r,atan(d.y,d.x)*.5));`;
 let code='vec4 sampledDiffuseColor=vec4(0.0);';
 if(mask&5)code+=`if(${mask&1?'true':'vMapUv.y<.64'}&&${mask&4?'true':'vMapUv.y>.36'})sampledDiffuseColor=surfaceSample(vMapUv);`;
 if(mask&10)code+=`if(${mask&2?'true':'vMapUv.x<.64'}&&${mask&8?'true':'vMapUv.x>.36'}){vec4 h=surfaceSample(vMapUv.yx);sampledDiffuseColor=mix(sampledDiffuseColor,h,h.a);}`;
 if(mask===0)code+='if(vMapUv.y>.25&&vMapUv.y<.75)sampledDiffuseColor=surfaceSample(vMapUv);';
 return code;
}
