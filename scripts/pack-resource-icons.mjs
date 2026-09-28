// Extract authored cutouts only. This file never draws replacement artwork.
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {RESOURCE_SOURCES,SERVICE_ART} from '../src/app/game/resource-art.js';
const wrangler=createRequire(import.meta.resolve('wrangler'));
const sharp=createRequire(wrangler.resolve('miniflare'))('sharp');
const folder=new URL('../public/assets/pixel-environment/',import.meta.url);
const icons=new URL('resources/',folder);await mkdir(icons,{recursive:true});
const layers=[];
for(const [i,[id,[atlas,frame]]] of Object.entries(RESOURCE_SOURCES).entries()){
 const input=await sharp(fileURLToPath(new URL(atlas+'.png',folder))).extract({left:frame*192,top:0,width:192,height:192}).png().toBuffer();
 layers.push({input,left:i*192,top:0});
 await writeFile(new URL(id+'.png',icons),await sharp(input).resize(96,96,{kernel:'nearest'}).png().toBuffer());
}
const atlas=await sharp({create:{width:layers.length*192,height:192,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer();
await writeFile(new URL('resourceGoods.png',folder),atlas);
await writeFile(new URL('../art-source/pixel-environment/completion-v8/resourceGoods-source.png',import.meta.url),atlas);
const manifestUrl=new URL('../art-source/pixel-environment/pack-manifest.json',import.meta.url),manifest=JSON.parse(await readFile(manifestUrl,'utf8'));
manifest.assets.resourceGoods={source:'completion-v8/resourceGoods-source.png',grid:[layers.length,1],columns:layers.length,opaqueTile:true,anchor:[.5,.5],derivedFrom:RESOURCE_SOURCES};
await writeFile(manifestUrl,JSON.stringify(manifest,null,2)+'\n');
await writeFile(new URL('frames.json',folder),JSON.stringify(manifest,null,2)+'\n');
for(const [id,frame] of Object.entries(SERVICE_ART))await writeFile(new URL(id+'.png',icons),await sharp(fileURLToPath(new URL('supportArt.png',folder))).extract({left:frame*192,top:0,width:192,height:192}).resize(96,96,{kernel:'nearest'}).png().toBuffer());
console.log(`${layers.length} resource cutouts + ${Object.keys(SERVICE_ART).length} service icons packed.`);
