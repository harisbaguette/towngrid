import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const req=createRequire(import.meta.resolve('wrangler')),sharp=createRequire(req.resolve('miniflare'))('sharp');
const folder='art-source/pixel-environment/distillery-v1',source=folder+'/source.png';
const meta=await sharp(source).metadata(),w=Math.floor(meta.width/2),h=Math.floor(meta.height/2),layers=[];
for(let i=0;i<4;i++){
 const crop=await sharp(source).extract({left:(i%2)*w,top:Math.floor(i/2)*h,width:w,height:h}).png().toBuffer();
 const image=await sharp(crop).trim().resize({width:144,height:155,fit:'inside',kernel:'nearest'}).png().toBuffer(),m=await sharp(image).metadata();
 layers.push({input:image,left:Math.floor((192-m.width)/2),top:i*192+174-m.height});
}
await sharp({create:{width:192,height:768,channels:4,background:'#00000000'}}).composite(layers).png().toFile('public/assets/pixel-environment/distillery.png');
await writeFile(folder+'/manifest.json',JSON.stringify({source:'source.png',directions:['SE','NE','NW','SW'],cell:192,anchor:[.5,.69],footprint:[1,1],runtime:'public/assets/pixel-environment/distillery.png',pack:'node scripts/pack-distillery.mjs'},null,2));
