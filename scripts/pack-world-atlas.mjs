// Pack generated miniature sprites and bake authoritative terrain once, not 1,550 DOM images.
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {WORLD_CELLS,COLS,ROWS,layoutOf} from '../src/app/game/world-grid.js';
import {ATLAS_SPRITES,ATLAS_DIRECTIONS,atlasCell,isWater,terrainConnections,atlasVariant} from '../src/app/game/atlas-terrain.js';
const wrangler=createRequire(import.meta.resolve('wrangler')),sharp=createRequire(wrangler.resolve('miniflare'))('sharp');
const source='art-source/world-atlas/atlas-source.png',markerSource='art-source/world-atlas/markers-source.png',out='public/assets/world-atlas';
await mkdir(out,{recursive:true});
const meta=await sharp(source).metadata(),cw=Math.floor(meta.width/4),ch=Math.floor(meta.height/4),sprites=[];
const markerMeta=await sharp(markerSource).metadata(),mw=Math.floor(markerMeta.width/2),mh=Math.floor(markerMeta.height/2);
for(const [i,name] of ATLAS_SPRITES.entries()){
 const marker=i>=12,j=i-12;
 const crop=marker?{left:j%2*mw,top:Math.floor(j/2)*mh,width:mw,height:mh}:{left:i%4*cw,top:Math.floor(i/4)*ch,width:cw,height:ch};
 const {data,info}=await sharp(marker?markerSource:source).extract(crop).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 // The generator may return either alpha or a chroma-key sheet. Keep alpha and remove key only.
 for(let p=0;p<data.length;p+=4)if(data[p]>170&&data[p+2]>140&&data[p+1]<110)data[p+3]=0;
 const packed=await sharp(data,{raw:info}).resize(96,96,{fit:'contain',kernel:'nearest'}).png().toBuffer();
 await writeFile(out+'/'+name+'.png',packed);
 sprites.push(await sharp(packed).resize(60,60,{kernel:'nearest'}).raw().toBuffer());
}
const S=64,W=COLS*S,H=ROWS*S,raw=Buffer.alloc(W*H*4,255);
const palette={plain:[152,172,103],forest:[84,123,78],mountain:[135,137,115],desert:[216,187,126],ice:[218,231,220],coast:[49,116,131],lake:[61,137,149],river:[75,149,163],canal:[82,143,151],stream:[92,157,165]};
const pixel=(x,y,color)=>{if(x<0||y<0||x>=W||y>=H)return;const p=(y*W+x)*4;raw[p]=color[0];raw[p+1]=color[1];raw[p+2]=color[2];};
const hash=(x,y)=>{let h=Math.imul(x,374761393)^Math.imul(y,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};
const stamp=(index,x,y)=>{const buf=sprites[index];for(let dz=0;dz<60;dz++)for(let dx=0;dx<60;dx++){const p=(dz*60+dx)*4,a=buf[p+3]/255;if(!a)continue;const q=((y+dz)*W+x+dx)*4;for(let c=0;c<3;c++)raw[q+c]=Math.round(buf[p+c]*a+raw[q+c]*(1-a));}};
for(const cell of WORLD_CELLS){
 const {cx,cz,terrain}=cell,base=palette[terrain],water=isWater(terrain),flow=water&&!['coast','lake'].includes(terrain),links=terrainConnections(cell),ox=cx*S,oy=cz*S;
 const bank=atlasCell(cx-1,cz)?.terrain==='desert'||atlasCell(cx+1,cz)?.terrain==='desert'?palette.desert:palette.plain;
 for(let y=0;y<S;y++)for(let x=0;x<S;x++){
  const jitter=(Math.floor(hash(Math.floor((ox+x)/3),Math.floor((oy+y)/3))*3)-1)*(water?1:2);
  let color=base;
  if(flow){
   const bend=Math.round(Math.sin((y+cz*8)*Math.PI/32)*2),width=terrain==='stream'?8:terrain==='canal'?13:20,half=width/2;
   const center=Math.abs(x-32-bend)<=half&&Math.abs(y-32)<=half;
   const wet=center||((links.water&1)&&y<=32&&Math.abs(x-32-bend)<=half)||((links.water&4)&&y>=32&&Math.abs(x-32-bend)<=half)||((links.water&8)&&x<=32&&Math.abs(y-32)<=half)||((links.water&2)&&x>=32&&Math.abs(y-32)<=half);
   color=wet?base:bank;
   if(!wet&&((Math.abs(x-32-bend)<half+3&&((links.water&1)&&y<32||(links.water&4)&&y>32))||(Math.abs(y-32)<half+3&&((links.water&8)&&x<32||(links.water&2)&&x>32))))color=[194,186,135];
  }else if(water){
   const depth=Math.min(...ATLAS_DIRECTIONS.map(([dx,dz],i)=>(links.shore&(1<<i))?[y,S-1-x,S-1-y,x][i]:S));
   const wiggle=1+Math.floor((Math.sin((ox+x+oy+y)*.3)+1)*1.5);
   if(depth<wiggle)color=[207,198,147];else if(depth<wiggle+3)color=[117,173,169];else if(depth<wiggle+7)color=[72,145,155];
   else if(y%19===((cx*3+cz*7)%19)&&x>12&&x<31)color=[88,153,163];
  }else if(terrain==='forest'&&links.same){
   if(x<6&&(links.same&8)||x>57&&(links.same&2)||y<6&&(links.same&1)||y>57&&(links.same&4))color=[92,130,80];
  }else if(terrain==='mountain'&&((links.same&5)&&Math.abs(x-32)<10||(links.same&10)&&Math.abs(y-32)<10))color=[116,125,105];
  pixel(ox+x,oy+y,color.map(v=>Math.max(0,Math.min(255,Math.round(v+jitter)))));
 }
}
for(const {cx,cz,terrain,site} of WORLD_CELLS){
 const v=atlasVariant(cx,cz);let sprite=null;
 if(terrain==='forest')sprite=v;
 if(terrain==='mountain')sprite=4+v;
 if(terrain==='desert'&&v!==3)sprite=8;
 if(terrain==='ice'&&v===0)sprite=7;
 if(terrain==='desert'&&ATLAS_DIRECTIONS.some(([dx,dz])=>['river','lake','stream','canal'].includes(atlasCell(cx+dx,cz+dz)?.terrain)))sprite=9;
 const ecology=site?layoutOf(site)?.ecology:null;
 if(ecology==='marsh')sprite=10;
 if(ecology==='volcanic')sprite=11;
 if(sprite!==null)stamp(sprite,cx*S+2,cz*S+2);
 // Sparse meadow detail does not invent a new forest biome or an oasis water source.
 if(terrain==='plain')for(let i=0;i<4;i++){const x=cx*S+9+(i*17+cz*7)%45,y=cz*S+10+(i*13+cx*5)%42;pixel(x,y,[124,152,84]);pixel(x+1,y-1,[183,194,118]);}
}
await sharp(raw,{raw:{width:W,height:H,channels:4}}).webp({lossless:true}).toFile(out+'/terrain.webp');
const manifest={version:2,source,markerSource,width:W,height:H,cellPixels:S,grid:[COLS,ROWS],sprites:ATLAS_SPRITES,worldHash:createHash('sha256').update(JSON.stringify(WORLD_CELLS)).digest('hex'),sourceHash:createHash('sha256').update(await readFile(source)).digest('hex'),markerSourceHash:createHash('sha256').update(await readFile(markerSource)).digest('hex'),terrainBytes:(await readFile(out+'/terrain.webp')).length};
await writeFile(out+'/manifest.json',JSON.stringify(manifest,null,2));
await writeFile('art-source/world-atlas/pack-manifest.json',JSON.stringify(manifest,null,2));
console.log(JSON.stringify({size:[W,H],sprites:ATLAS_SPRITES.length,terrainBytes:manifest.terrainBytes}));
