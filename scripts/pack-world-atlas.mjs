// Pack generated miniature sprites and bake authoritative terrain once, not 1,550 DOM images.
import {atlasGroundColor} from '../src/app/game/atlas-surface.js';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {WORLD_CELLS,COLS,ROWS} from '../src/app/game/world-grid.js';
import {ATLAS_SPRITES,ATLAS_DECORATIONS,atlasCell,isWater} from '../src/app/game/atlas-terrain.js';
const wrangler=createRequire(import.meta.resolve('wrangler')),sharp=createRequire(wrangler.resolve('miniflare'))('sharp');
const source='art-source/world-atlas/realms-v4/sprites-source.png',markerSource=source,out='public/assets/world-atlas';
await mkdir(out,{recursive:true});
const meta=await sharp(source).metadata(),cw=Math.floor(meta.width/4),ch=Math.floor(meta.height/4),sprites=[];
for(const [i,name] of ATLAS_SPRITES.entries()){
 const crop={left:i%4*cw,top:Math.floor(i/4)*ch,width:cw,height:ch};
 const {data,info}=await sharp(source).extract(crop).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 // The generator may return either alpha or a chroma-key sheet. Keep alpha and remove key only.
 for(let p=0;p<data.length;p+=4)if(data[p]>170&&data[p+2]>140&&data[p+1]<110)data[p+3]=0;
 const packed=await sharp(data,{raw:info}).resize(96,96,{fit:'contain',kernel:'nearest'}).png().toBuffer();
 await writeFile(out+'/'+name+'.png',packed);
 sprites.push(await sharp(packed).resize(60,60,{kernel:'nearest'}).raw().toBuffer());
}
const S=64,W=COLS*S,H=ROWS*S,raw=Buffer.alloc(W*H*4,255);
const pixel=(x,y,color)=>{if(x<0||y<0||x>=W||y>=H)return;const p=(y*W+x)*4;raw[p]=color[0];raw[p+1]=color[1];raw[p+2]=color[2];};
const stamp=(index,x,y,size=60)=>{const buf=sprites[index];for(let dz=0;dz<size;dz++)for(let dx=0;dx<size;dx++){
 const px=x+dx,py=y+dz;if(px<0||py<0||px>=W||py>=H||isWater(atlasCell(Math.floor(px/S),Math.floor(py/S)).terrain))continue;
 const p=(Math.floor(dz/size*60)*60+Math.floor(dx/size*60))*4,a=buf[p+3]/255;if(!a)continue;const q=(py*W+px)*4;for(let c=0;c<3;c++)raw[q+c]=Math.round(buf[p+c]*a+raw[q+c]*(1-a));}};
for(let y=0;y<H;y++)for(let x=0;x<W;x++)pixel(x,y,atlasGroundColor(x/S,y/S));
// The isometric renderer projects only the ground; objects stay upright in a separate depth-sorted layer.
await sharp(raw,{raw:{width:W,height:H,channels:4}}).webp({lossless:true}).toFile(out+'/ground.webp');
for(const p of ATLAS_DECORATIONS){
 const size=Math.round(p.size/26*S),x=Math.round(p.point[0]/26*S-size/2),y=Math.round(p.point[1]/26*S-size/2);
 stamp(ATLAS_SPRITES.indexOf(p.name),x,y,size);
}
await sharp(raw,{raw:{width:W,height:H,channels:4}}).webp({lossless:true}).toFile(out+'/terrain.webp');
const ground=await readFile(out+'/ground.webp');
const manifest={version:5,source,markerSource,width:W,height:H,cellPixels:S,grid:[COLS,ROWS],sprites:ATLAS_SPRITES,worldHash:createHash('sha256').update(JSON.stringify(WORLD_CELLS)).digest('hex'),sourceHash:createHash('sha256').update(await readFile(source)).digest('hex'),markerSourceHash:createHash('sha256').update(await readFile(markerSource)).digest('hex'),terrainBytes:(await readFile(out+'/terrain.webp')).length,ground:{path:out+'/ground.webp',bytes:ground.length,hash:createHash('sha256').update(ground).digest('hex')},directions:out+'/iso/manifest.json'};
await writeFile(out+'/manifest.json',JSON.stringify(manifest,null,2));
await writeFile('art-source/world-atlas/pack-manifest.json',JSON.stringify(manifest,null,2));
console.log(JSON.stringify({size:[W,H],sprites:ATLAS_SPRITES.length,terrainBytes:manifest.terrainBytes}));
await import('./pack-atlas-directions.mjs');
await import('./pack-atlas-outskirts.mjs');
