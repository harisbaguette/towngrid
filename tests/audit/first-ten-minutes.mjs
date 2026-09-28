// A new player's first 10 minutes, following the in-game tutorial order:
// warehouse -> house -> well -> field -> lumber -> contract -> first promotion.
// Only player actions and real ticks. Prints a timeline and the blocking points.
import {Campaign,run,home,snapshot,status,expectBug,finish} from './_harness.mjs';
import {readFileSync} from 'node:fs';
import {tutorialStep} from '../../src/app/game/ui-rules.js';
// Game.tsx shows the tutorial below rank 2 and hides the operations card only while the tutorial is up.
const gameSource=readFileSync(new URL('../../src/app/game/Game.tsx',import.meta.url),'utf8'),opsHiddenByGuide=/<Operations[^>]*hidden={!!guide}/.test(gameSource);
const c=new Campaign({nation:'estern',race:'human'}),s=home(c);
const log=[];const note=(what,extra)=>log.push({t:Math.round(s.time),what,...extra});
const must=(r,what)=>{if(!r.ok)note('FAIL '+what,{error:r.error});else note(what);return r.ok;};
must(s.build('warehouse',11,12),'창고');
must(s.build('house',11,14),'주민 주택');
must(s.build('well',13,12),'우물');
must(s.build('field',13,13),'밀밭');
must(s.build('lumber',9,10),'벌목장');
note('초기 자원',snapshot(s));
let lastRank=s.rank,lastContracts=0,lastEvents=0,firstStorm=null,rank1Window=0;
const seen=new Set();
run(c,600,()=>{
 const t=Math.round(s.time);{const guide=s.rank<2?tutorialStep(s):null,ops=!!s.warehouse&&(opsHiddenByGuide?!guide:s.rank>=2);if(!guide&&!ops)rank1Window+=.25;}
 const k=s.contract();if(s.availableStock(k.item)>=k.amount){const r=s.fulfill();if(r.ok)note('납품 완료',{item:k.item,amount:k.amount,reward:k.reward});}
 const p=s.promotion();if(p?.ready){const r=s.promote();if(r.ok)note('승급 → '+p.name,{fee:p.fee});}
 if(s.events.length>lastEvents){lastEvents=s.events.length;const e=s.events.at(-1);note('사건 발생: '+e.type,{broken:s.buildings.filter(b=>b.health<=0).map(b=>b.type)});if(e.type==='storm'&&!firstStorm)firstStorm={t,broken:s.buildings.filter(b=>b.health<=0).map(b=>b.type)};}
 for(const b of s.buildings){const key=b.type+':'+b.status;if(!seen.has(key)&&/대기|필요|막힘|고갈|가득/.test(b.status)){seen.add(key);note('상태 '+b.type+' = '+b.status);}}
});
for(const e of log)console.log(JSON.stringify(e));
console.log('10분 후',JSON.stringify(snapshot(s)));
console.log('시설',JSON.stringify(status(s)));
const p=s.promotion();
console.log('다음 승급',JSON.stringify({name:p.name,trial:p.trial,req:p.requirements,fee:p.fee}));
// Finding: the only water source is the storm's first target, and nothing restarts it without a 50G repair.
expectBug('E1-storm-kills-sole-well',firstStorm&&firstStorm.broken.includes('well'),firstStorm);
// Finding: after the first promotion the tutorial card disappears and the operations card is still hidden (rank<2).
expectBug('U1-rank1-guidance-gap',rank1Window>0,{secondsWithNoGuidanceCard:rank1Window,bot:'optimal bot; a human stays longer',note:'neither the tutorial (ui-rules tutorialStep) nor the operations card (Game.tsx <Operations hidden>) is on screen'});
finish('first-ten-minutes');
