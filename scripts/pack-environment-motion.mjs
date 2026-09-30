// Bake articulated poses from the approved original pixels. No replacement bodies.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
const wrangler=createRequire(import.meta.resolve('wrangler'));
const sharp=createRequire(wrangler.resolve('miniflare'))('sharp');
const folder='art-source/pixel-environment/motion-v10',out='public/assets/pixel-environment';
const rig=JSON.parse(await readFile(folder+'/rig.json','utf8')),N=rig.cell;
const pixel=(x,y)=>(y*N+x)*4;
const inside=(x,y)=>x>=0&&x<N&&y>=0&&y<N;
const write=(dst,x,y,src,sx,sy)=>{sx=Math.floor(sx);sy=Math.floor(sy);if(inside(x,y)&&inside(sx,sy)){const i=pixel(sx,sy);if(src[i+3])dst.set(src.subarray(i,i+4),pixel(x,y));}};
function spinFace(dst,src,[cx,cy,rx,ry],angle) {
 const cs=Math.cos(angle),sn=Math.sin(angle);
 for(let y=Math.floor(cy-ry);y<=cy+ry;y++)for(let x=Math.floor(cx-rx);x<=cx+rx;x++){
  if(!inside(x,y))continue;const u=(x+.5-cx)/rx,v=(y+.5-cy)/ry;
  if(u*u+v*v<.68)write(dst,x,y,src,cx+(u*cs+v*sn)*rx,cy+(-u*sn+v*cs)*ry);
 }
}
function movingPart(dst,src,mask,pivot,angle,offset=[0,0],trail=false){
 const cut=new Uint8Array(src.length);
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=pixel(x,y);if(mask(x,y,src.subarray(i,i+4))){cut.set(src.subarray(i,i+4),i);if(trail)dst[i+3]=Math.round(dst[i+3]*.7);else dst.fill(0,i,i+4);}}
 const cs=Math.cos(angle),sn=Math.sin(angle);
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  const dx=x+.5-pivot[0]-offset[0],dy=y+.5-pivot[1]-offset[1];
  write(dst,x,y,cut,pivot[0]+dx*cs+dy*sn,pivot[1]-dx*sn+dy*cs);
 }
}
function leg(dst,src,[left,top,width,height,phase],time){
 const p=(time+phase)%1,angle=Math.sin(p*Math.PI*2)*.14,lift=p>.55?Math.sin((p-.55)/.45*Math.PI)*3:0;
 const mask=(x,y)=>x>=left&&x<left+width&&y>=top&&y<top+height;
 movingPart(dst,src,mask,[left+width/2,top],angle,[0,-lift]);
}
await mkdir(folder,{recursive:true});
const registered={};
async function publish(id,raw,frames,base){
 const png=await sharp(raw,{raw:{width:N*frames,height:N*4,channels:4}}).png().toBuffer();
 await writeFile(folder+'/'+id+'.png',png);await writeFile(out+'/'+id+'.png',png);
 registered[id]={source:'motion-v10/'+id+'.png',prepacked:true,columns:frames,directions:['SE','NE','NW','SW'],anchor:base==='building'?[.5,.69]:[.5,181/192],revision:rig.revision};
}
for(const [id,spec] of Object.entries(rig.vehicles)){
 const raw=await sharp(out+'/'+id+'.png').ensureAlpha().raw().toBuffer();
 const atlas=new Uint8Array(N*N*4*4*rig.frames);
 for(let row=0;row<4;row++)for(let f=0;f<rig.frames;f++){
  const src=raw.subarray(row*N*N*4,(row+1)*N*N*4),dst=new Uint8Array(src),phase=f/rig.frames,angle=phase*Math.PI*2;
  for(const wheel of spec.wheels?.[row]||[])spinFace(dst,src,wheel,angle);
  for(const limb of spec.legs?.[row]||[])leg(dst,src,limb,phase);
  for(const [index,[cx,cy]] of (spec.propellers?.[row]||[]).entries()) {
   // Authored blade envelopes exclude the engine struts and wing outlines.
   const tips=spec.blades[row][index],width=6;
   const mask=(x,y,p)=>{
    if(p[0]>150&&p[2]>100)return false;
    const px=x-cx,py=y-cy;
    return tips.some(([dx,dy])=>{const t=Math.max(0,Math.min(1,(px*dx+py*dy)/(dx*dx+dy*dy)));return Math.hypot(px-t*dx,py-t*dy)<=width;});
   };
   // A short blade trail also preserves the body concealed in the original
   // flattened art; turning a propeller must never punch holes into a wing.
   movingPart(dst,src,mask,[cx+.5,cy+.5],angle,[0,0],true);
   for(let y=cy-6;y<=cy+6;y++)for(let x=cx-6;x<=cx+6;x++)if(Math.hypot(x-cx,y-cy)<6)write(dst,x,y,src,x,y);
  }
  for(const [x1,y1,x2,y2] of spec.oars?.[row]||[]) {
   const dx=x2-x1,dy=y2-y1,length=dx*dx+dy*dy;
   movingPart(dst,src,(x,y,p)=>{const t=((x-x1)*dx+(y-y1)*dy)/length;return t>=0&&t<=1&&Math.abs((x-x1)*dy-(y-y1)*dx)/Math.sqrt(length)<5&&p[0]>100&&p[0]>p[1]*1.2;},[x1,y1],Math.sin(angle)*.16);
  }
  for(let y=0;y<N;y++)atlas.set(dst.subarray(y*N*4,(y+1)*N*4),((row*N+y)*N*rig.frames+f*N)*4);
 }
 await publish(id+'Motion',atlas,rig.frames,'vehicle');console.log(id+' motion');
}
for(const [id,views] of Object.entries(rig.cranes)){
 const raw=new Uint8Array(await sharp(out+'/'+id+'.png').ensureAlpha().raw().toBuffer()),body=new Uint8Array(raw),load=new Uint8Array(raw.length);
 for(const [row,[l,t,r,b,ax,ay]] of views.entries()){
  for(let y=t;y<b;y++)for(let x=l;x<r;x++){
   const i=((row*N+y)*N+x)*4;load.set(raw.subarray(i,i+4),i);body.fill(0,i,i+4);
  }
  // Preserve the occluded polar load in its rest pose; no roof pixels move.
  if(id==='polarport'&&row===2)continue;
  for(let y=ay+3;y<t;y++)for(let x=ax-2;x<=ax+2;x++)body.fill(0,((row*N+y)*N+x)*4,((row*N+y)*N+x)*4+4);
 }
 await publish(id+'Body',body,1,'building');await publish(id+'Hoist',load,1,'building');console.log(id+' hoist');
}
const path='art-source/pixel-environment/pack-manifest.json',manifest=JSON.parse(await readFile(path,'utf8'));
delete manifest.assets.lakeportBody;delete manifest.assets.lakeportHoist;
Object.assign(manifest.assets,registered);await writeFile(path,JSON.stringify(manifest,null,2)+'\n');
await writeFile(out+'/frames.json',JSON.stringify(manifest,null,2)+'\n');
