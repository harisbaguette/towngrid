import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {COLS,ROWS} from '../src/app/game/world-grid.js';
import {OUTSKIRT_CELLS,OUTSKIRT_BOUNDS,SURROUND_CELLS,SURROUND_BOUNDS} from '../src/app/game/atlas-outskirts.js';
import {atlasGroundColor} from '../src/app/game/atlas-surface.js';
const wrangler=createRequire(import.meta.resolve('wrangler')),sharp=createRequire(wrangler.resolve('miniflare'))('sharp');
const S=8,W=(COLS+2*OUTSKIRT_CELLS)*S,H=(ROWS+2*OUTSKIRT_CELLS)*S,raw=Buffer.alloc(W*H*3);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const color=atlasGroundColor(x/S-OUTSKIRT_CELLS,y/S-OUTSKIRT_CELLS),p=(y*W+x)*3;
 for(let c=0;c<3;c++)raw[p+c]=color[c];
}
const out='public/assets/world-atlas',path=out+'/outskirts.webp';
await sharp(raw,{raw:{width:W,height:H,channels:3}}).webp({lossless:true}).toFile(path);
const nearS=32,nearW=(COLS+SURROUND_CELLS*2)*nearS,nearH=(ROWS+SURROUND_CELLS*2)*nearS,nearRaw=Buffer.alloc(nearW*nearH*3);
for(let y=0;y<nearH;y++)for(let x=0;x<nearW;x++){
 const color=atlasGroundColor(x/nearS-SURROUND_CELLS,y/nearS-SURROUND_CELLS),p=(y*nearW+x)*3;
 for(let c=0;c<3;c++)nearRaw[p+c]=color[c];
}
await sharp(nearRaw,{raw:{width:nearW,height:nearH,channels:3}}).webp({lossless:true}).toFile(out+'/surrounds.webp');
const manifest=JSON.parse(await readFile(out+'/manifest.json','utf8'));
manifest.outskirts={path,bounds:OUTSKIRT_BOUNDS,cellPixels:S,selectable:false};
manifest.surrounds={path:out+'/surrounds.webp',bounds:SURROUND_BOUNDS,cellPixels:nearS,selectable:false};
for(const file of [out+'/manifest.json','art-source/world-atlas/pack-manifest.json'])await writeFile(file,JSON.stringify(manifest,null,2));
console.log('Atlas outskirts:',W,H);
