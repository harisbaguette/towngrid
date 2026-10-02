import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {NEW_VEHICLE_SIZES,VEHICLE_ANCHORS} from '../src/app/game/vehicle-art.js';
const wrangler=createRequire(import.meta.resolve('wrangler'));
const sharp=createRequire(wrangler.resolve('miniflare'))('sharp');
const path='art-source/pixel-environment/pack-manifest.json';
const manifest=JSON.parse(await readFile(path,'utf8'));
const sources=[
 ['land-corrected.png',['cargoWagon','cargoSled','cargoPlane','cargoAirship'],[0,330,615,906,1254]],
 ['water-corrected.png',['cargoRaft','cargoSteamer','cargoShip','cargoFerry'],[0,360,649,933,1254]],
 ['freight-source.png',['cargoTruckEmpty','cargoTrainEmpty'],[0,400,760,1120,1536]],
 ['steamer-source.png',['cargoSteamer'],[0,565,1100,1650,2172]],
];
for(const [file,ids,rows] of sources){
 const source='completion-v8/'+file,{width}=await sharp('art-source/pixel-environment/'+source).metadata();
 for(const [column,id] of ids.entries()){
  const left=Math.floor(width*column/ids.length),right=Math.floor(width*(column+1)/ids.length);
  manifest.assets[id]={source,rects:rows.slice(0,-1).map((top,row)=>[left,top,right-left,rows[row+1]-top]),columns:1,fit:[174,170],baseline:181,directions:['SE','NE','NW','SW'],anchor:VEHICLE_ANCHORS[id]||[.5,181/192],size:NEW_VEHICLE_SIZES[id]};
 }
}
const supportRows=[0,530,860,1254],rects=[];
for(let y=0;y<3;y++)for(let x=0;x<4;x++){const left=Math.floor(x*1254/4);rects.push([left,supportRows[y],Math.floor((x+1)*1254/4)-left,supportRows[y+1]-supportRows[y]]);}
manifest.assets.supportArt={source:'completion-v8/support-source.png',rects,columns:12,fit:[164,164],centered:true,independentScale:true,anchor:[.5,.5],states:{power:[0],horse:[1],irrigation:[2],ward:[3],transit:[4],health:[5],lightDamage:[6],heavyDamage:[7],rubble:[8],repairNeeded:[9],impact:[10],repaired:[11]}};
await writeFile(path,JSON.stringify(manifest,null,2)+'\n');
console.log('Registered 10 four-view vehicles and 12 support cutouts.');
