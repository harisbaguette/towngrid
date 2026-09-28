import { BUILDINGS } from './simulation.js';
import { INDUSTRY_PROFILES } from './pixel-industry-data.js';
import { EXPANSION_PROFILES } from './pixel-expansion-data.js';
import { RESOURCE_FRAMES } from './resource-art.js';

export function attachIndustryAnimation(type, {part, position, setFrame, rope, screenPoint}) {
 const profile = INDUSTRY_PROFILES[type] || EXPANSION_PROFILES[type];
 if (!profile) return null;
 const layers = profile.parts.map((spec,index) => {
  const layer = part(spec.name + '-' + index, spec.frame, spec.size, spec.atlas || 'industrialTools');
  if (spec.motion === 'strike') layer.userData.sprite.center.set(.27,.13);
  if (spec.motion === 'arm') layer.userData.sprite.center.set(.5,.12);
  return {layer,spec,line:spec.tether?rope():null};
 });
 const products = BUILDINGS[type].recipes || [BUILDINGS[type]];
 const hasStock = products.some(r=>RESOURCE_FRAMES[r.output]!==undefined);
 const stock = !hasStock ? [] : Array.from({length:profile.maxPiles || 3},(_,i)=>part('output-'+i,0,profile.outputSize||.24,'resourceGoods'));
 const crops=profile.crop?Array.from({length:4},(_,i)=>part('crop-'+i,0,.38,profile.crop)):[];
 return (time,b,sim,view,state) => {
  const enabled = b.enabled !== false && !(b.health <= 0);
  const work = enabled && (state ? state.working || state.active : b.working);
  const clock = state?.active ? sim?.time ?? time : b.animationTime ?? time;
  const beat = Math.floor(Math.max(0,clock)*8)%16, wave=Math.sin(beat/16*Math.PI*2);
  for(const {layer,spec,line} of layers){
   const point = Array.isArray(spec.pos[0]) || spec.pos[0] === null ? spec.pos[view] : spec.pos;
   const show = spec.show === 'always' ? true : spec.show === 'work' ? work
    : spec.show === 'supply' ? enabled && state?.active
    : spec.show === 'input' ? state?.workpiece
    : spec.show === 'charge' ? enabled && (sim?.batteryCharge || 0) > spec.threshold
    : spec.show === 'care' ? enabled && sim?.stage < 15 && (sim?.health?.nextCare || 0) > (sim?.time || 0)
    : spec.show === 'grid' ? enabled && !!sim?.poweredAt?.(b) : false;
   layer.visible = !!point && !!show;
   if(line)line.visible=layer.visible;
   if (!point) continue;
   let [x,y]=point,angle=0;
   if(work){
    if(spec.motion==='spin')angle=beat*Math.PI/8;
    if(spec.motion==='press')y+=Math.round((1-wave)*5);
    if(spec.motion==='rock')angle=wave*.18;
    if(spec.motion==='lift')y-=Math.round((1-wave)*8);
    if(spec.motion==='strike'){x-=21;y-=8;angle=[.35,.35,.1,-.35,-.8,-1.1,-1.1,-.5][beat%8];}
    if(spec.motion==='arm')angle=wave*.18;
    if(spec.motion==='feed'||spec.motion==='conveyor')x+=Math.round(wave*(spec.motion==='feed'?4:12));
    if(spec.motion==='float'||spec.motion==='bubble')y-=Math.round(wave*3);
    if(spec.motion==='steam')y-=beat;
    if(spec.motion==='flow')y+=beat%3;
   }else if(spec.motion==='strike'){x+=12;y-=29;angle=Math.PI;}
   // Heat is a small flame pose, never a scale change of the architecture.
   if(spec.motion==='flicker')layer.userData.sprite.scale.set(spec.size,spec.size*(beat%3===0? .88:1),1);
   layer.userData.flipX = !!spec.flip?.[view];
   position(layer,x,y,angle);setFrame(layer,spec.motion==='peck'&&work?Math.floor(clock*4)%4:spec.frame,spec.directional?view:0);
   if(line){
    const from=spec.tether[view],points=line.geometry.attributes.position;
    for(const [i,p] of [screenPoint(...from),screenPoint(x,y-10)].entries())points.setXYZ(i,p.x,p.y,p.z);
    points.needsUpdate=true;line.geometry.computeBoundingSphere();
   }
  }
  for(const [i,pile] of stock.entries()){
   pile.visible = !!state && !state.service && RESOURCE_FRAMES[state.output]!==undefined && state.count > i*4;
   setFrame(pile,RESOURCE_FRAMES[state?.output]??0);
   const point=(profile.outputPos||[[76,153],[96,163],[117,153]])[i];
   position(pile,...point);
  }
  for(const [i,crop] of crops.entries()){
   crop.visible=!!state&&(state.progress>0||state.working);
   position(crop,...[[96,108],[73,125],[119,125],[96,143]][i]);
   setFrame(crop,Math.min(3,Math.floor((state?.progress||0)*4)));
  }
 };
}
