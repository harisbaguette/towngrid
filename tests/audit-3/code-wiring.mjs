// Audit 3 (G3, code): rules added by 563bcc9 that no screen reaches. A2-E1 added endless goals after 패권국
// (campaign.js LEGACY_GOALS / legacy()) and the completion log tells the player "이제 대륙 기록에 도전합니다", but no
// component calls legacy(), so after the last rank the goals dialog only says the competition continues.
// node tests/audit-3/code-wiring.mjs
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {load,expectBug,finish} from '../audit-2/_fixture.mjs';
const root=fileURLToPath(new URL('../../src/app/',import.meta.url));const files=[];
const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(/\.(tsx?|jsx?)$/.test(e.name))files.push(p);}};walk(root);
const users=files.filter(f=>!f.endsWith('campaign.js')&&/\.legacy\(|LEGACY_GOALS/.test(fs.readFileSync(f,'utf8'))).map(f=>path.relative(root,f));
const c=load(32);/* the bot fixture at 패권국 */const promise=(c.history.find(h=>h.text.includes('대륙 기록'))||{}).text||'(onPromotion log text) 이제 대륙 기록에 도전합니다';
const goals=c.legacy();
expectBug('G3-13 endless goals after 패권국 exist in the rules but no screen shows them',users.length===0&&goals.goals.length>0,{uiFilesUsingLegacy:users,rank:c.rank,completion:!!c.completion,legacy:goals,log:promise});
finish('code-wiring');
