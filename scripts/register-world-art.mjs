// Preserve generated originals and register atlas cells; no procedural artwork.
import {access,copyFile,readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const wrangler=createRequire(import.meta.resolve('wrangler'));
const sharp=createRequire(wrangler.resolve('miniflare'))('sharp');
const root=new URL('../art-source/pixel-environment/',import.meta.url);
const generation=JSON.parse(await readFile(new URL('world-v5/generation.json',root),'utf8'));
const manifest=JSON.parse(await readFile(new URL('pack-manifest.json',root),'utf8'));
function cuts(counts,n){
 const result=[0],size=counts.length;
 for(let i=1;i<n;i++){
  const expected=size*i/n;let best=-1,distance=Infinity;
  for(let k=Math.floor(expected-size/n*.26);k<Math.ceil(expected+size/n*.26);k++)if(counts[k]===0&&Math.abs(k-expected)<distance){best=k;distance=Math.abs(k-expected);}
  if(best<0)throw Error('No transparent gutter near '+expected);result.push(best);
 }return [...result,size];
}
for(const record of generation.records){
 const source='world-v5/'+record.id+'-source.png',destination=new URL(source,root);
 try{await access(destination);}catch{await copyFile(record.generatedFile,destination);}
 const {data,info}=await sharp(fileURLToPath(destination)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const count=record.rows||record.types.length,rects=[];
 if(record.kind==='surface'){
  for(let row=0;row<count;row++)for(let col=0;col<4;col++)rects.push([Math.floor(col*info.width/4),Math.floor(row*info.height/count),Math.floor((col+1)*info.width/4)-Math.floor(col*info.width/4),Math.floor((row+1)*info.height/count)-Math.floor(row*info.height/count)]);
  if(record.id==='networks')for(let row=0;row<count;row++){
   const ys=[];for(let y=Math.floor(row*info.height/count);y<Math.floor((row+1)*info.height/count);y++){let pixels=0;for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=160)pixels++;if(pixels>info.width*.04)ys.push(y);}
   for(let col=0;col<4;col++){rects[row*4+col][1]=ys[0];rects[row*4+col][3]=ys.at(-1)-ys[0]+1;}
  }
  if(record.id==='waterways')for(const [row,id] of ['creek','river','sea','lake'].entries())manifest.assets[id]={source,rects:rects.slice(row*4,row*4+4),columns:4,opaqueTile:true};
  else manifest.assets[record.id]={source,rects,columns:rects.length,opaqueTile:true};
 }else{
  const ys=Array(info.height).fill(0);
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=160)ys[y]++;
  const rows=cuts(ys,count),columns=[];
  for(let row=0;row<count;row++){
   const xs=Array(info.width).fill(0);
   for(let y=rows[row];y<rows[row+1];y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=160)xs[x]++;
   const cols=cuts(xs,4);columns.push(cols);
   for(let col=0;col<4;col++)rects.push([cols[col],rows[row],cols[col+1]-cols[col],rows[row+1]-rows[row]]);
  }
  record.bounds={rows,columns};
  if(record.kind==='buildings'||record.kind==='objects'||record.kind==='mixed'){
   for(const [row,id] of record.types.entries()){
    const strip=record.kind==='mixed'&&row<2;
    manifest.assets[id]={source,rects:rects.slice(row*4,row*4+4),columns:strip?4:1,...(!strip?{directions:['SE','NE','NW','SW']}:{}),fit:record.kind==='buildings'?[166,165]:[174,170],baseline:181,...(strip?{centered:true}:{}),anchor:record.kind==='buildings'?[.5,.69]:strip?[.5,.5]:[.5,181/192],...(record.kind==='buildings'?{size:1.4,worldFootprint:[1,1],states:{static:[0]}}:{})};
   }
  }else if(record.kind==='animation'){
   // Retain each source cell coordinate so a peck does not move the feet.
   const width=Math.floor(info.width/4);const fixed=Array.from({length:4},(_,i)=>[i*width+Math.floor(width*.06),Math.floor(info.height*.20),Math.floor(width*.87),Math.floor(info.height*.54)]);
   manifest.assets[record.id]={source,rects:fixed,columns:4,opaqueTile:true,anchor:[.5,.85]};
  }else if(record.id==='newCrops'){
   for(const [row,id] of ['cottonGrowth','herbGrowth'].entries())manifest.assets[id]={source,rects:rects.slice(row*4,row*4+4),columns:4,fit:[160,164],baseline:181,anchor:[.5,.94]};
  }else manifest.assets[record.id]={source,rects,columns:rects.length,fit:[164,164],centered:true,independentScale:true,anchor:[.5,.5]};
 }
 console.log(record.id+': '+rects.length+' cells');
}
manifest.version=5;
await writeFile(new URL('pack-manifest.json',root),JSON.stringify(manifest,null,2)+'\n');
await writeFile(new URL('world-v5/generation.json',root),JSON.stringify(generation,null,2)+'\n');
