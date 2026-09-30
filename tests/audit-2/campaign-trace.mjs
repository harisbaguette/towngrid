// audit-2: the full-campaign bot (tests/full-campaign.mjs) with a per-rank ledger and fixture snapshots. The bot is not copied:
// its source is read and instrumented at fixed anchors, so the trace always plays exactly the current bot (a copy had drifted
// and kept an old investment sink). An anchor that no longer matches stops the trace with an error instead of guessing.
//   TRACE_OUT=<file>  where the ledger goes (default trace.json)   NO_SNAP=1  skip writing fixtures/rank*.json
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';
const here=new URL('./',import.meta.url),root=new URL('../../',import.meta.url);
let src=fs.readFileSync(new URL('tests/full-campaign.mjs',root),'utf8').replace(/\r\n/g,'\n');
const cut=(from,label)=>{const i=src.indexOf(from);if(i<0)throw new Error('full-campaign.mjs anchor moved: '+label);const end=src.indexOf('\n',i);src=src.slice(0,i)+src.slice(end<0?src.length:end+1);};
const put=(at,text,label,after=true)=>{const i=src.indexOf(at);if(i<0)throw new Error('full-campaign.mjs anchor moved: '+label);const k=after?i+at.length:i;src=src.slice(0,k)+text+src.slice(k);};
src=src.replaceAll("'../src/","'"+new URL('src/',root).href);
const loop="for(let i=0;i<240000&&c.rank<32;i++){if(i%40===0)operate();c.tick(.25);if(c.active.day!==dayMark)operate();record();";
put(loop,`
const trace={ranks:[],invest:0,investSpent:0,sinks:{}};const OUT=process.env.TRACE_OUT||'trace.json';
let doneAt={},rankStart=0,readyNoFee=null,prevRank=c.rank;const SNAP=[8,13,18,22,26,29,31,32];
const council=Campaign.prototype.council;
Campaign.prototype.council=function(a,t){const before=this.treasury.money;const r=council.call(this,a,t);if(r.ok){trace.sinks[a]=(trace.sinks[a]||0)+(before-this.treasury.money);if(a==='invest')trace.invest++;}return r;};
function watch(){const s=c.home.sim,p=s.promotion();if(!p)return;const now=s.time;for(const q of p.requirements)if(q.done&&doneAt[q.key]===undefined)doneAt[q.key]=now;if(p.trial&&p.trial.done&&doneAt.trial===undefined)doneAt.trial=now;
 if(p.requirements.every(q=>q.done)&&(!p.trial||p.trial.done)&&readyNoFee===null)readyNoFee={t:now,money:s.money};}
function traceRank(){if(c.rank===prevRank)return;const s=c.home.sim;const entries=Object.entries(doneAt).sort((a,b)=>b[1]-a[1]);
 trace.ranks.push({rank:c.rank,day:s.day,took:Math.round(s.time-rankStart),last:entries[0]?.[0],lastAt:Math.round((entries[0]?.[1]??s.time)-rankStart),reqDoneAt:Object.fromEntries(entries.map(([k,v])=>[k,Math.round(v-rankStart)])),feeWait:readyNoFee?Math.round(s.time-readyNoFee.t):null,moneyWhenReady:readyNoFee?Math.round(readyNoFee.money):null,fee:RANKS[c.rank].fee});
 if(SNAP.includes(c.rank)&&!process.env.NO_SNAP){fs.mkdirSync(new URL('fixtures/',${JSON.stringify(here.href)}),{recursive:true});fs.writeFileSync(new URL('fixtures/rank'+c.rank+'.json',${JSON.stringify(here.href)}),encodeSave(c.save()));}
 prevRank=c.rank;rankStart=s.time;doneAt={};readyNoFee=null;}
`,'main loop',false);
put(loop,'traceRank();watch();','main loop body');
// The trace reports instead of asserting, and never touches docs/FULL_CAMPAIGN_RESULT.json.
cut("assert.equal(c.rank,32,","rank asserts");cut("assert.ok(recipeSwitches>0","recipe assert");cut("fs.writeFileSync(new URL('../docs/FULL_CAMPAIGN_RESULT.json'","result file");
cut("for(const [id,a] of Object.entries(acceptance))assert.ok(","acceptance asserts");cut("console.log('FULL CAMPAIGN PASS'","pass line");cut("console.log(JSON.stringify({segments,acceptance},null,1));","summary");
src+=`
trace.battles=c.battles;trace.investments=c.investments.length;trace.result=result;trace.acceptance=acceptance;trace.segments=segments;trace.days=days;trace.promotions=milestones;trace.sold=c.treasury.sold;
fs.writeFileSync(OUT,JSON.stringify(trace,null,1));console.log('TRACE WRITTEN',OUT,'investments',c.investments.length,'sinks',JSON.stringify(trace.sinks));
`;
const tmp=path.join(os.tmpdir(),'tg-campaign-trace-'+process.pid+'.mjs');fs.writeFileSync(tmp,src);
try{await import(pathToFileURL(tmp).href);}finally{fs.rmSync(tmp,{force:true});}
