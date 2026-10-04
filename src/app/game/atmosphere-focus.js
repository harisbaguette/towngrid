// Screen coordinates are normalized to -1..1 in both rendering paths.
export const ATMOSPHERE_FOCUS = { clear: .22, edge: .62 };
export function atmosphereVisibility(x,y){
 const t=Math.max(0,Math.min(1,(Math.max(Math.abs(x),Math.abs(y))-ATMOSPHERE_FOCUS.clear)/(ATMOSPHERE_FOCUS.edge-ATMOSPHERE_FOCUS.clear)));
 return t*t*(3-2*t);
}
