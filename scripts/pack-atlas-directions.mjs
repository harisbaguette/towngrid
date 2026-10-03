import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ATLAS_SPRITES} from '../src/app/game/atlas-terrain.js';
const wrangler=createRequire(import.meta.resolve('wrangler')),sharp=createRequire(wrangler.resolve('miniflare'))('sharp');
const source='art-source/world-atlas/isometric-v5',out='public/assets/world-atlas/iso',sources=[],sprites=[];
await mkdir(out,{recursive:true});
for(const [group,file] of ['woodland','mountains','habitats','settlements'].entries()){
 const path=source+'/'+file+'.png',meta=await sharp(path).metadata(),cw=Math.floor(meta.width/4),ch=Math.floor(meta.height/4);
 sources.push({path,hash:createHash('sha256').update(await readFile(path)).digest('hex')});
 for(let row=0;row<4;row++){
  const frames=[];
  for(let q=0;q<4;q++){
   const {data,info}=await sharp(path).extract({left:q*cw,top:row*ch,width:cw,height:ch}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   let x0=cw,y0=ch,x1=0,y1=0;
   for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){const k=(y*cw+x)*4;
    if(data[k]>170&&data[k+2]>140&&data[k+1]<110)data[k+3]=0;
    if(data[k+3]>=128){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
   }
   frames.push({data,info,bounds:{left:x0,top:y0,width:x1-x0+1,height:y1-y0+1}});
  }
  const scale=Math.min(144/Math.max(...frames.map(f=>f.bounds.width)),144/Math.max(...frames.map(f=>f.bounds.height)));
  for(const [q,f] of frames.entries()){
   const name=ATLAS_SPRITES[group*4+row],w=Math.round(f.bounds.width*scale),h=Math.round(f.bounds.height*scale),left=Math.round((160-w)/2),top=152-h;
   const image=await sharp(f.data,{raw:f.info}).extract(f.bounds).resize(w,h,{kernel:'nearest'}).png().toBuffer();
   const path=out+'/'+name+'-'+q+'.png';
   await sharp({create:{width:160,height:160,channels:4,background:'#00000000'}}).composite([{input:image,left,top}]).png().toFile(path);
   sprites.push({name,quarter:q,path,anchor:[.5,.82],hash:createHash('sha256').update(await readFile(path)).digest('hex')});
  }
 }
}
await writeFile(out+'/manifest.json',JSON.stringify({version:5,projection:'orthographic-isometric',elevation:35.264389682754654,views:['SE','NE','NW','SW'],cell:160,sources,sprites},null,2));
console.log('Packed '+sprites.length+' authored isometric views');
