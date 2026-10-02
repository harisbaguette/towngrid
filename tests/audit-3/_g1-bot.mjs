// G1 audit helper: the reference player of tests/full-campaign.mjs, run from any start province for a limited time.
// Like tests/audit-2/campaign-trace.mjs the bot source is read and instrumented at fixed anchors (never copied), so the
// probe always plays the current bot. The instrumented copy never writes docs/FULL_CAMPAIGN_RESULT.json or asserts.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';
const root=new URL('../../',import.meta.url);
let seq=0;
/** Plays the bot for `gameSeconds` from `nation`/`provinceId`; returns rank timeline and totals (times in game seconds). */
export async function runBot({nation='estern',provinceId,gameSeconds=600,setup=''}={}){
 let src=fs.readFileSync(new URL('tests/full-campaign.mjs',root),'utf8').replace(/\r\n/g,'\n');
 const swap=(from,to,label)=>{if(!src.includes(from))throw new Error('full-campaign.mjs anchor moved: '+label);src=src.replace(from,to);};
 src=src.replaceAll("'../src/","'"+new URL('src/',root).href);
 swap("let c=new Campaign(),","let c=new Campaign({nation:"+JSON.stringify(nation)+",provinceId:"+JSON.stringify(provinceId??null)+"});"+setup+"let ","campaign");
 swap("for(let i=0;i<240000&&c.rank<32;i++){","const __ranks=[];let __r=c.rank;for(let i=0;i<"+Math.round(gameSeconds*4)+";i++){if(c.rank!==__r){__r=c.rank;__ranks.push({rank:c.rank,t:Math.round(c.active.time)});}","main loop");
 const cut=src.indexOf('\ndays.push({day:dayMark');if(cut<0)throw new Error('full-campaign.mjs anchor moved: tail');
 src=src.slice(0,cut)+`
const __s=c.home.sim;globalThis.__G1_RESULT={rank:c.rank,ranks:__ranks,time:Math.round(__s.time),money:Math.round(c.treasury.money),debt:__s.debt,revenue:Math.round(c.treasury.totalRevenue),contracts:c.treasury.contracts,produced:{...c.treasury.produced},buildings:__s.buildings.map(b=>b.type),statuses:__s.buildings.map(b=>b.type+':'+b.status),expansions:__s.expansions,events:__s.events.map(e=>e.type)};
`;
 const tmp=path.join(os.tmpdir(),'tg-g1-bot-'+process.pid+'-'+(seq++)+'.mjs');fs.writeFileSync(tmp,src);
 const log=console.log;console.log=()=>{};
 try{await import(pathToFileURL(tmp).href);}finally{console.log=log;fs.rmSync(tmp,{force:true});}
 return globalThis.__G1_RESULT;
}
