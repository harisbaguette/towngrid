// Register generated cutouts and their transparent gutters, without drawing art.
import {readFile,writeFile,copyFile,access} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const wrangler=createRequire(import.meta.resolve('wrangler'));
const sharp=createRequire(wrangler.resolve('miniflare'))('sharp');
const root=new URL('../art-source/pixel-environment/',import.meta.url);
const generation=JSON.parse(await readFile(new URL('industry-v4/generation.json',root),'utf8'));
const manifest=JSON.parse(await readFile(new URL('pack-manifest.json',root),'utf8'));
function cuts(counts,n){
 const size=counts.length,result=[0];
 for(let i=1;i<n;i++){
  const expected=size*i/n,lo=Math.floor(expected-size/n*.24),hi=Math.ceil(expected+size/n*.24);
  let best=Math.floor(expected),distance=Infinity;
  for(let k=lo;k<=hi;k++)if(counts[k]===0&&Math.abs(k-expected)<distance){best=k;distance=Math.abs(k-expected);}
  if(!Number.isFinite(distance))throw Error('No transparent gutter near '+expected);
  result.push(best);
 }
 return [...result,size];
}
for(const record of generation.records){
 const source='industry-v4/'+record.id+'-source.png',destination=new URL(source,root);
 try{await access(destination);}catch{await copyFile(record.generatedFile,destination);}
 const {data,info}=await sharp(fileURLToPath(destination)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const ys=Array(info.height).fill(0);
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=160)ys[y]++;
 const rows=cuts(ys,record.types.length||4);
 const columns=rows.slice(0,-1).map((top,row)=>{
  const counts=Array(info.width).fill(0);
  for(let y=top;y<rows[row+1];y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=160)counts[x]++;
  return cuts(counts,4);
 });
 const rectangle=(x,y)=>[columns[y][x],rows[y],columns[y][x+1]-columns[y][x],rows[y+1]-rows[y]];
 record.bounds={columns,rows};
 if(record.types.length){
  for(const [row,id] of record.types.entries())manifest.assets[id]={source,rects:[0,1,2,3].map(col=>rectangle(col,row)),columns:1,directions:['SE','NE','NW','SW'],fit:[166,165],baseline:181,anchor:[.5,.69],size:1.4,worldFootprint:[1,1],states:{static:[0]}};
 }else{
  const id=record.id==='goods'?'industrialGoods':'industrialTools';
  manifest.assets[id]={source,rects:Array.from({length:16},(_,i)=>rectangle(i%4,Math.floor(i/4))),columns:16,fit:[164,164],centered:true,independentScale:true,anchor:[.5,.5]};
 }
 console.log(record.id,info.width+'x'+info.height,JSON.stringify(record.bounds));
}
manifest.version=4;
await writeFile(new URL('pack-manifest.json',root),JSON.stringify(manifest,null,2)+'\n');
await writeFile(new URL('industry-v4/generation.json',root),JSON.stringify(generation,null,2)+'\n');
