// audit-2: price tags on the council / diplomacy buttons vs what the rule actually charges.
// Since the 2026-09-29 fix (A2-L1) the buttons print campaign.councilTerms(), built from the same COUNCIL table the rules pay
// from. So the check is twofold: (a) no button in the TSX carries a hand-typed price, (b) every act, run on a real save,
// takes exactly councilPrice() in money and goods.
import fs from 'node:fs';
import {load,run,calm,expectBug,finish} from './_fixture.mjs';
import {BUILDINGS} from '../../src/app/game/simulation.js';
import {NATIONS} from '../../src/app/game/world.js';
const panel=fs.readFileSync(new URL('../../src/app/game/CampaignPanel.tsx',import.meta.url),'utf8');
const states=fs.readFileSync(new URL('../../src/app/game/QualityPanels.tsx',import.meta.url),'utf8');
// (a) A literal "<digits>G" right after an onClick of a council/state act, before the button closes.
const typed=[];for(const [src,file] of [[panel,'CampaignPanel'],[states,'QualityPanels']])for(const m of src.matchAll(/(council|stateAction)\('(\w+)'[^]*?<\/Button>/g)){const hit=m[0].match(/[>·\s]\d[\d,]*G/);if(hit)typed.push(file+' '+m[2]+': '+hit[0].trim());}
// (b) Charge of each act on a rich rank-29 save.
const c=load(29);calm(c);const s=c.home.sim;c.treasury.money=1e6;c.welfareDay=0;for(const r of ['bread','steel','workwear','canned','car'])s.stock[r]=500;
const charged=(act,price)=>{const m0=c.treasury.money,st0={...s.stock};const r=act();const goods=Object.fromEntries(Object.keys(price.items||{}).map(k=>[k,st0[k]-s.stock[k]]));return {ok:r.ok,error:r.error,paid:m0-c.treasury.money,goods,price};};
c.treasury.rank=Math.max(c.treasury.rank,31);c.defense=Math.min(c.defense,5);
const nation=Object.keys(NATIONS).find(id=>NATIONS[id].playable&&id!==c.home.nation&&!c.recognition.includes(id));c.recognition=c.recognition.slice(0,2);
const branch=c.sites.find(v=>v.id!==c.homeId);branch.territory=false;for(const v of c.sites)if(v!==branch&&v.id!==c.homeId)v.territory=false;c.support=90;
const st=c.newStates.find(v=>!v.dissolved&&!c.recognition.includes(v.id));st.relation=80;st.pact=false;
const rows={welfare:charged(()=>c.council('welfare'),c.councilPrice('welfare')),defense:charged(()=>c.council('defense'),c.councilPrice('defense')),invest:charged(()=>c.council('invest',c.home.nation),c.councilPrice('invest')),
 territory:charged(()=>c.council('territory',branch.id),c.councilPrice('territory')),recognition:charged(()=>c.council('recognition',nation),c.councilPrice('recognition')),
 aid:charged(()=>c.stateAction('aid',st.id),c.councilPrice('aid')),pact:charged(()=>c.stateAction('pact',st.id),c.councilPrice('pact')),stateRecognition:charged(()=>c.stateAction('recognition',st.id),c.councilPrice('stateRecognition'))};
const wrong=Object.entries(rows).filter(([,v])=>!v.ok||v.paid!==v.price.money||Object.entries(v.price.items||{}).some(([k,n])=>v.goods[k]!==n));
for(const [k,v] of Object.entries(rows))console.log(JSON.stringify({action:k,label:c.councilTerms(k),...v}));
expectBug('L1 council/diplomacy button prices differ from the rule',typed.length>0||wrong.length>0,{handTypedPrices:typed,chargeMismatches:wrong.map(([k,v])=>({action:k,...v}))});
// Hospital text vs rule: illness still strikes (no prevention) and support is not raised directly.
{const c=load(29);calm(c);const s=c.home.sim;const h=s.buildings.find(b=>b.type==='hospital');
 run(c,40);const active=h&&h.activeUntil>s.time;s.pendingEvent={type:'illness',at:s.time+.1};run(c,1);const jump=s.health.infection;const text=BUILDINGS.hospital.description;
 expectBug('L2 hospital text says it prevents disease and raises support; illness still hits and support does not move',active&&jump>=30&&/예방|지지를 높/.test(text),{text,hospitalRunning:active,infectionRightAfterIllness:Math.round(jump),stateInjection:'illness event triggered'});}
finish('labels-vs-rules');
