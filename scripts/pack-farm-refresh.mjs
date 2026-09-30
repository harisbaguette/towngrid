// Cut and pack image-model artwork. No replacement shapes are drawn here.
// Run this after the legacy farm-v9 generator when rebuilding all farm art.
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {FARM_PROFILES} from '../src/app/game/pixel-farm-data.js';
import {discProjection} from '../src/app/game/pixel-part-projection.js';

const sharp=createRequire(createRequire(import.meta.resolve('wrangler')).resolve('miniflare'))('sharp');
const root=fileURLToPath(new URL('../',import.meta.url));
const source=path.join(root,'art-source/pixel-environment/farm-v11');
const refreshed=path.join(root,'art-source/pixel-environment/farm-v12');
const layout=JSON.parse(await readFile(path.join(refreshed,'manifest.json'),'utf8'));
const output=path.join(root,'public/assets/pixel-environment');
const manifestPath=path.join(root,'art-source/pixel-environment/pack-manifest.json');
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
const cell=192,views=['SE','NE','NW','SW'];
const transparent={r:0,g:0,b:0,alpha:0};
await mkdir(source,{recursive:true});
const canvas=(width,height)=>sharp({create:{width,height,channels:4,background:transparent}});
function bounds(data,width,height){
 let left=width,top=height,right=-1,bottom=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]){
  left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
 }
 if(right<0)throw new Error('Empty art cell');
 return {left,top,width:right-left+1,height:bottom-top+1};
}
function isolatedTiles(data,width,height,cols,rows){
 const seen=new Uint8Array(width*height),queue=new Int32Array(seen.length),tiles=[];
 for(let p=0;p<seen.length;p++)if(!seen[p]&&data[p*4+3]>=180){
  let start=0,end=1,left=width,top=height,right=0,bottom=0;
  queue[0]=p;seen[p]=1;
  while(start<end){
   const q=queue[start++],x=q%width,y=Math.floor(q/width);
   left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const xx=x+dx,yy=y+dy,n=yy*width+xx;
    if(xx>=0&&xx<width&&yy>=0&&yy<height&&!seen[n]&&data[n*4+3]>=180){seen[n]=1;queue[end++]=n;}
   }
  }
  if(end<1000)continue;
  const w=right-left+1,h=bottom-top+1,pixels=Buffer.alloc(w*h*4);
  for(let i=0;i<end;i++){
   const q=queue[i],at=((Math.floor(q/width)-top)*w+q%width-left)*4;
   data.copy(pixels,at,q*4,q*4+3);pixels[at+3]=255;
  }
  tiles.push({left,bottom,data:pixels,width:w,height:h,box:{left:0,top:0,width:w,height:h}});
 }
 if(tiles.length!==cols*rows)throw new Error('Expected '+cols*rows+' isolated tiles, found '+tiles.length);
 tiles.sort((a,b)=>a.bottom-b.bottom);
 return Array.from({length:rows},(_,row)=>tiles.slice(row*cols,(row+1)*cols).sort((a,b)=>a.left-b.left)).flat();
}
async function cut(file,cols,rows,directory=source,tileSheet=false){
 const image=sharp(path.join(directory,file)),meta=await image.metadata(),cells=[];
 // Generated sheets can put a sprite across the nominal grid line. Snap
 // v12 cell cuts to transparent gutters so no leaf or bottle is clipped.
 const scan=directory===refreshed?await image.clone().ensureAlpha().raw().toBuffer():null;
 if(tileSheet)return isolatedTiles(scan,meta.width,meta.height,cols,rows);
 const occupied=(x,y)=>scan[(y*meta.width+x)*4+3]>=180;
 const gutter=(target,span,isEmpty)=>{
  for(let d=0;d<=Math.floor(span*.22);d++)for(const p of d?[target-d,target+d]:[target])if(isEmpty(p))return p;
  throw new Error('No transparent cell gutter in '+file+' near '+target);
 };
 const rowCuts=[0,...Array.from({length:rows-1},(_,i)=>{
  const nominal=Math.round((i+1)*meta.height/rows);
  return scan?gutter(nominal,meta.height/rows,y=>{for(let x=0;x<meta.width;x++)if(occupied(x,y))return false;return true;}):nominal;
 }),meta.height];
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
  const top=rowCuts[y],height=rowCuts[y+1]-top;
  const colCut=i=>{
   const nominal=Math.round(i*meta.width/cols);
   return scan&&i>0&&i<cols?gutter(nominal,meta.width/cols,px=>{for(let py=top;py<top+height;py++)if(occupied(px,py))return false;return true;}):nominal;
  };
  const left=colCut(x),width=colCut(x+1)-left;
  const {data,info}=await image.clone().extract({left,top,width,height}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(let i=3;i<data.length;i+=4)data[i]=data[i]>=180?255:0;
  cells.push({data,width:info.width,height:info.height,box:bounds(data,width,height)});
 }
 return cells;
}
const png=c=>sharp(c.data,{raw:{width:c.width,height:c.height,channels:4}});
async function fitBuilding(c){
 const scale=Math.min(160/c.box.width,172/c.box.height);
 let width=Math.round(c.box.width*scale),height=Math.round(c.box.height*scale);
 let resized=await png(c).extract(c.box).resize(width,height,{kernel:'nearest'}).raw().toBuffer();
 const actual=bounds(resized,width,height);
 resized=await sharp(resized,{raw:{width,height,channels:4}}).extract(actual).raw().toBuffer();
 width=actual.width;height=actual.height;
 let sum=0,count=0;
 for(let x=0;x<width;x++)if(resized[((height-1)*width+x)*4+3]){sum+=x;count++;}
 const centered=Math.round(96-sum/count),left=Math.max(4,Math.min(188-width,centered));
 if(Math.abs(left-centered)>2)throw new Error('Tile footprint is not centered: '+JSON.stringify({left,centered,width,box:c.box}));
 return canvas(cell,cell).composite([{input:await sharp(resized,{raw:{width,height,channels:4}}).png().toBuffer(),left,top:182-height}]).png().toBuffer();
}
async function saveAtlas(id,frames,columns,options={},directory=source){
 const atlas=await canvas(cell*columns,cell*Math.ceil(frames.length/columns)).composite(frames.map((input,i)=>({input,left:i%columns*cell,top:Math.floor(i/columns)*cell}))).png().toBuffer();
 await writeFile(path.join(directory,id+'.png'),atlas);
 await writeFile(path.join(output,id+'.png'),atlas);
 manifest.assets[id]={source:path.basename(directory)+'/'+id+'.png',prepacked:true,columns,opaqueTile:true,generator:'scripts/pack-farm-refresh.mjs',...options};
 if(options.directions&&options.building)await writeFile(path.join(output,id+'-icon.png'),frames[0]);
 console.log(id+': '+frames.length+' cells');
}
for(const [file,ids] of [['buildings-generated.png',['solarpanel','chocolatier','packshop']],['barns-generated.png',['sheeppen','milkbarn','duckhouse']]]){
 const cells=await cut(file,4,3);
 for(const [row,id] of ids.entries())await saveAtlas(id,await Promise.all(cells.slice(row*4,row*4+4).map(fitBuilding)),1,
  {building:true,prepacked:false,rects:views.map((_,v)=>[0,v*cell,cell,cell]),directions:views,baseline:181,anchor:[.5,.69],size:1.4,worldFootprint:[1,1],states:{static:[0]},original:file});
}

for(const sheet of layout.buildings){
 const cells=await cut(sheet.file,4,sheet.ids.length,refreshed,true);
 for(const [row,id] of sheet.ids.entries())await saveAtlas(id,await Promise.all(cells.slice(row*4,row*4+4).map(fitBuilding)),1,
  {building:true,prepacked:false,rects:views.map((_,v)=>[0,v*cell,cell,cell]),directions:views,baseline:181,anchor:[.5,.69],size:1.4,worldFootprint:[1,1],states:{static:[0]},original:sheet.file},refreshed);
}

// Every resource slot has model artwork. Keep the two v11 originals and the
// original 35-slot ordering; never restore goods from the legacy generator.
const icons=await cut('icons-generated.png',2,1);
async function fitIcon(c){
 const scale=Math.min(164/c.box.width,164/c.box.height),width=Math.round(c.box.width*scale),height=Math.round(c.box.height*scale);
 const icon=await canvas(cell,cell).composite([{input:await png(c).extract(c.box).resize(width,height,{kernel:'nearest'}).png().toBuffer(),left:Math.floor((cell-width)/2),top:Math.floor((cell-height)/2)}]).png().toBuffer();
 return icon;
}
const goodsCells=Array(35),order=manifest.assets.farmGoods.order;
for(const [i,c] of icons.entries())goodsCells[[23,18][i]]=await fitIcon(c);
for(const sheet of layout.goods){
 const cells=await cut(sheet.file,sheet.columns,sheet.rows,refreshed);
 for(const [i,id] of sheet.ids.entries()){
  const slot=order.indexOf(id);
  if(slot<0||goodsCells[slot])throw new Error('Unknown or duplicate resource: '+id);
  goodsCells[slot]=await fitIcon(cells[i]);
 }
}
if(goodsCells.filter(Boolean).length!==35)throw new Error('Incomplete resource artwork');
await saveAtlas('farmGoods',goodsCells,35,{anchor:[.5,.5],order,original:['../farm-v11/icons-generated.png',...layout.goods.map(s=>s.file)]},refreshed);

const supplement=layout.goods2;
const extraCells=await cut(supplement.file,supplement.columns,supplement.rows,refreshed);
await saveAtlas('farmGoods2',await Promise.all(extraCells.slice(0,9).map(fitIcon)),9,
 {anchor:[.5,.5],order:supplement.ids,original:supplement.file},refreshed);
const workParts=await Promise.all(extraCells.slice(9).map(fitIcon));
await saveAtlas('farmWorkParts',workParts,3,{anchor:[.5,.5],order:supplement.parts,original:supplement.file},refreshed);
const oldBees=await sharp(path.join(root,'art-source/pixel-environment/farm-v9/parts-source.png')).extract({left:0,top:0,width:cell,height:cell}).png().toBuffer();
await saveAtlas('farmParts',[oldBees,workParts[0]],2,{anchor:[.5,.5],order:['bees','rotor'],original:supplement.file},refreshed);

for(const sheet of layout.crops){
 const cells=await cut(sheet.file,4,sheet.ids.length,refreshed);
 for(const [row,id] of sheet.ids.entries()){
  const stages=cells.slice(row*4,row*4+4);
  // A common scale preserves the authored growth progression. Roots share
  // a fixed baseline; stage size is not independently normalised.
  const scale=Math.min(150/Math.max(...stages.map(c=>c.box.width)),166/Math.max(...stages.map(c=>c.box.height)));
  const frames=await Promise.all(stages.map(async c=>{
   const width=Math.max(1,Math.round(c.box.width*scale)),height=Math.max(1,Math.round(c.box.height*scale));
   return canvas(cell,cell).composite([{input:await png(c).extract(c.box).resize(width,height,{kernel:'nearest'}).png().toBuffer(),left:Math.round((cell-width)/2),top:182-height}]).png().toBuffer();
  }));
  await saveAtlas(id,frames,4,{anchor:[.5,.94],states:{growth:[0,1,2,3]},original:sheet.file},refreshed);
 }
}

for(const animal of ['sheep','cow','duck','bee']){
 const columns=animal==='bee'?4:8,rows=animal==='bee'?1:4;
 const cells=await cut(animal+'-generated.png',columns,rows),frames=[];
 // One scale for the complete strip; per-row registration preserves all
 // authored leg/head poses without resizing each frame independently.
 const boxes=Array.from({length:rows},(_,row)=>{
  const strip=cells.slice(row*columns,(row+1)*columns);
  const left=Math.min(...strip.map(c=>c.box.left)),top=Math.min(...strip.map(c=>c.box.top));
  const right=Math.max(...strip.map(c=>c.box.left+c.box.width)),bottom=Math.max(...strip.map(c=>c.box.top+c.box.height));
  return {left,top,width:right-left,height:bottom-top};
 });
 const scale=Math.min(154/Math.max(...boxes.map(b=>b.width)),154/Math.max(...boxes.map(b=>b.height)));
 for(let row=0;row<rows;row++){
  const strip=cells.slice(row*columns,(row+1)*columns);
  const box=boxes[row];
  for(const c of strip){
   const width=Math.round(box.width*scale),height=Math.round(box.height*scale);
   const frame=await canvas(cell,cell).composite([{input:await png(c).extract(box).resize(width,height,{kernel:'nearest'}).png().toBuffer(),left:Math.round((cell-width)/2),top:176-height}]).png().toBuffer();
   frames.push(frame);
  }
 }
 await saveAtlas('farm'+animal[0].toUpperCase()+animal.slice(1),frames,columns,{directions:animal==='bee'?undefined:views,anchor:[.5,176/192],original:animal+'-generated.png'});
}
// Build-menu thumbnails show mature crops; map bodies remain empty.
for(const [id,profile] of Object.entries(FARM_PROFILES))if(profile.crop){
 const crop=typeof profile.crop==='string'?profile.crop:Object.values(profile.crop)[0];
 const size=Math.round(cell*(profile.cropSize||.38)/1.4);
 const plant=await sharp(path.join(output,crop+'.png')).extract({left:3*cell,top:0,width:cell,height:cell}).resize(size,size,{kernel:'nearest'}).png().toBuffer();
 const body=await sharp(path.join(output,id+'.png')).extract({left:0,top:0,width:cell,height:cell}).png().toBuffer();
 const icon=await sharp(body).composite(profile.cropPos.map(([x,y])=>({input:plant,left:Math.round(x-size*.5),top:Math.round(y-size*.94)}))).png().toBuffer();
 await writeFile(path.join(refreshed,id+'-icon.png'),icon);
 await writeFile(path.join(output,id+'-icon.png'),icon);
 manifest.assets[id].iconSource='farm-v12/'+id+'-icon.png';
}
for(const id of ['shallowmine','windpump']){
 const spec=FARM_PROFILES[id].parts[0],size=Math.round(cell*spec.size/1.4);
 const [a,b,,d]=discProjection(0,spec.axis);
 let part=sharp(path.join(output,spec.atlas+'.png')).extract({left:spec.frame*cell,top:0,width:cell,height:cell}).resize(size,size,{kernel:'nearest'});
 if(a<0)part=part.flop();
 const projected=await part.affine([[Math.abs(a),0],[b*Math.sign(a),d]],{background:transparent,interpolator:sharp.interpolators.nearest}).png().toBuffer();
 const {width,height}=await sharp(projected).metadata(),[x,y]=spec.pos[0];
 const icon=await sharp(path.join(output,id+'.png')).extract({left:0,top:0,width:cell,height:cell}).composite([{input:projected,left:Math.round(x-width/2),top:Math.round(y-height/2)}]).png().toBuffer();
 await writeFile(path.join(refreshed,id+'-icon.png'),icon);
 await writeFile(path.join(output,id+'-icon.png'),icon);
 manifest.assets[id].iconSource='farm-v12/'+id+'-icon.png';
}
await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
await writeFile(path.join(output,'frames.json'),JSON.stringify(manifest,null,2)+'\n');
