// Pack generated miniature sprites and bake authoritative terrain once, not 1,550 DOM images.
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {WORLD_CELLS,COLS,ROWS,layoutOf} from '../src/app/game/world-grid.js';
import {ATLAS_SPRITES,ATLAS_DIRECTIONS,ATLAS_BIOME_COLORS,atlasEcology,atlasCell,isWater,terrainConnections,atlasVariant} from '../src/app/game/atlas-terrain.js';
import {LAND_COLORS,WATER_COLORS,landscapeNoise,landscapeHash,mixColor} from '../src/app/game/landscape-colors.js';
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
const palette={...LAND_COLORS,...WATER_COLORS};
const pixel=(x,y,color)=>{if(x<0||y<0||x>=W||y>=H)return;const p=(y*W+x)*4;raw[p]=color[0];raw[p+1]=color[1];raw[p+2]=color[2];};
const hash=(x,y)=>{let h=Math.imul(x,374761393)^Math.imul(y,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};
const stamp=(index,x,y,size=60)=>{const buf=sprites[index];for(let dz=0;dz<size;dz++)for(let dx=0;dx<size;dx++){
 const px=x+dx,py=y+dz;if(px<0||py<0||px>=W||py>=H||isWater(atlasCell(Math.floor(px/S),Math.floor(py/S)).terrain))continue;
 const p=(Math.floor(dz/size*60)*60+Math.floor(dx/size*60))*4,a=buf[p+3]/255;if(!a)continue;const q=(py*W+px)*4;for(let c=0;c<3;c++)raw[q+c]=Math.round(buf[p+c]*a+raw[q+c]*(1-a));}};
const groundPalette=cell=>ATLAS_BIOME_COLORS[atlasEcology(cell)]||palette[cell?.terrain];
const landColor=(x,z,fallback)=>{const cell=atlasCell(x,z),t=cell?.terrain;return !t||isWater(t)?fallback:groundPalette(cell);};
for(const cell of WORLD_CELLS){
 const {cx,cz,terrain}=cell,base=groundPalette(cell),water=isWater(terrain),ox=cx*S,oy=cz*S;
 for(let y=0;y<S;y++)for(let x=0;x<S;x++){
  const jitter=(Math.floor(hash(Math.floor((ox+x)/3),Math.floor((oy+y)/3))*3)-1);
  let color=base;
  // Broad continuous colour fields, with water occupying its actual world squares.
  const gx=(ox+x)/S,gz=(oy+y)/S;
  if(!water){
   const ax=Math.floor(gx-.5),az=Math.floor(gz-.5),u=gx-.5-ax,v=gz-.5-az;
   color=mixColor(mixColor(landColor(ax,az,base),landColor(ax+1,az,base),u),mixColor(landColor(ax,az+1,base),landColor(ax+1,az+1,base),u),v);
   const shade=Math.round((landscapeNoise(gx*.7,gz*.7)-.5)*16+(landscapeNoise(gx*3,gz*3)-.5)*4);
   color=color.map(c=>c+shade);
  }else{
   let depth=S*3;
   for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){
    const near=atlasCell(cx+dx,cz+dz);if(!near||isWater(near.terrain))continue;
    const nx=Math.max(dx*S,Math.min((dx+1)*S,x)),ny=Math.max(dz*S,Math.min((dz+1)*S,y));depth=Math.min(depth,Math.hypot(nx-x,ny-y));
   }
   color=depth<2?[225,214,161]:depth<5?[173,210,188]:depth<10?[117,186,180]:depth<18?mixColor(base,[114,186,179],.42):depth<29?mixColor(base,[94,168,171],.2):base;
  }
  pixel(ox+x,oy+y,color.map(v=>Math.max(0,Math.min(255,Math.round(v+jitter*.3)))));
 }
}
// The isometric renderer projects only the ground; objects stay upright in a separate depth-sorted layer.
await sharp(raw,{raw:{width:W,height:H,channels:4}}).webp({lossless:true}).toFile(out+'/ground.webp');
for(const {cx,cz,terrain,site} of WORLD_CELLS){
 const v=atlasVariant(cx,cz);let sprite=null;
 if(terrain==='forest')sprite=v;
 if(terrain==='mountain')sprite=4+v;
 if(terrain==='desert'&&v===0)sprite=8;
 if(terrain==='ice'&&v===0&&terrainConnections(atlasCell(cx,cz)).same!==15)sprite=7;
 if(terrain==='desert'&&ATLAS_DIRECTIONS.some(([dx,dz])=>['river','lake','stream','canal'].includes(atlasCell(cx+dx,cz+dz)?.terrain)))sprite=9;
 const ecology=site?layoutOf(site)?.ecology:null;
 if(ecology==='basin')sprite=6;
 if(ecology==='marsh')sprite=10;
 if(ecology==='volcanic')sprite=11;
 if(sprite!==null){const size=terrain==='forest'?64+v*5:terrain==='mountain'?62+v*4:44;
  stamp(sprite,cx*S+Math.floor((S-size)/2)+(Math.floor(landscapeHash(cx,cz)*13)-6),cz*S+Math.floor((S-size)/2)+(Math.floor(landscapeHash(cz,cx)*11)-5),size);}
 // Sparse meadow detail does not invent a new forest biome or an oasis water source.
 if(terrain==='plain'&&v===0){const x=cx*S+17,y=cz*S+33;pixel(x,y,[141,167,88]);pixel(x+1,y-1,[182,197,120]);}
}
await sharp(raw,{raw:{width:W,height:H,channels:4}}).webp({lossless:true}).toFile(out+'/terrain.webp');
const ground=await readFile(out+'/ground.webp');
const manifest={version:5,source,markerSource,width:W,height:H,cellPixels:S,grid:[COLS,ROWS],sprites:ATLAS_SPRITES,worldHash:createHash('sha256').update(JSON.stringify(WORLD_CELLS)).digest('hex'),sourceHash:createHash('sha256').update(await readFile(source)).digest('hex'),markerSourceHash:createHash('sha256').update(await readFile(markerSource)).digest('hex'),terrainBytes:(await readFile(out+'/terrain.webp')).length,ground:{path:out+'/ground.webp',bytes:ground.length,hash:createHash('sha256').update(ground).digest('hex')},directions:out+'/iso/manifest.json'};
await writeFile(out+'/manifest.json',JSON.stringify(manifest,null,2));
await writeFile('art-source/world-atlas/pack-manifest.json',JSON.stringify(manifest,null,2));
console.log(JSON.stringify({size:[W,H],sprites:ATLAS_SPRITES.length,terrainBytes:manifest.terrainBytes}));
await import('./pack-atlas-directions.mjs');
