// Audit 3 (G3, code): save format of the fields added since b3e4c33 (welfareDay, completion, investments[].stake,
// tileState, refundUntil, harvestUntil/merchantUntil, site.provinceId), old-save round trips and corrupt-save refusal.
// node tests/audit-3/code-save.mjs  (--regression exits 1 while a defect reproduces)
import fs from 'node:fs';
import {load,calm,Campaign,expectBug,finish} from '../audit-2/_fixture.mjs';
import {validateSave,decodeSave,encodeSave} from '../../src/app/game/persistence.js';
import {packTiles,unpackTiles} from '../../src/app/game/simulation.js';
const accepts=d=>{try{validateSave(structuredClone(d));return true;}catch{return false;}};
const saveOk=c=>{try{encodeSave(c.save());return true;}catch{return false;}};
// (1) investments[].stake has no type check: a stake that is not a number is accepted, the next world day turns the
//     treasury into NaN and from then on every autosave is refused (campaign.js dividend, persistence.js investments loop).
{const d=load(31).save();d.investments=[...d.investments,{nation:'estern',day:1,stake:'abc'}];/* injected: damaged/edited save */
 const accepted=accepts(d);const c=new Campaign({saved:d});const before=saveOk(c);c.worldDay();
 expectBug('G3-01 stake of the wrong type passes the validator, money becomes NaN after one world day and every later save is refused',accepted&&before&&Number.isNaN(c.treasury.money)&&!saveOk(c),{accepted,savedBefore:before,moneyAfterDay:c.treasury.money,savedAfter:saveOk(c)});}
{const d=load(31).save();d.investments=[...d.investments,{nation:'estern',day:1,stake:-1e9}];
 const accepted=accepts(d);const c=new Campaign({saved:d});const m=c.treasury.money;c.worldDay();
 expectBug('G3-01b a negative stake passes the validator and drains 100,000,000G a day',accepted&&c.treasury.money<m-9e7,{accepted,moneyBefore:Math.round(m),moneyAfter:Math.round(c.treasury.money)});}
// (2) welfareDay and completion are restored with no check at all.
{const d=load(31).save();d.welfareDay='오늘';d.completion={day:{nested:true},revenue:'x'};
 const accepted=accepts(d);const c=new Campaign({saved:d});
 expectBug('G3-02 welfareDay / completion of any type are accepted and restored as is',accepted&&typeof c.welfareDay==='string'&&typeof c.completion.day==='object',{accepted,welfareDay:c.welfareDay,completion:c.completion});}
// (3) site.provinceId is not checked: a duplicate province is accepted and the atlas then treats the real province as free.
{const d=load(31).save();const home=d.sites[0].provinceId;d.sites[1].provinceId=home;const accepted=accepts(d);
 const c=new Campaign({saved:d});const dup=c.sites.filter(s=>s.provinceId===home).length;
 expectBug('G3-03 two sites on one province (or a province id of another type) pass the validator',accepted&&dup===2,{accepted,home,sitesOnHomeProvince:dup,secondSiteOriginal:load(31).save().sites[1].provinceId});}
// (3b) battles is restored with no check: a non-array is accepted and the first finished raid throws inside Campaign.tick
//      (recordBattle unshift), which stops the frame loop (scene.js loop re-arms requestAnimationFrame only at its end).
{const d=load(22).save();d.battles={};/* injected: damaged save */const accepted=accepts(d);const c=new Campaign({saved:d});calm(c);c.active.paused=false;
 const s=c.active;s.pendingEvent={type:'raid',at:s.time};let error=null;try{for(let i=0;i<4*200&&!error;i++)c.tick(.25);}catch(e){error=e.message;}
 const panel=(()=>{try{'abc'.slice(0,8).map(()=>0);return null;}catch(e){return e.message;}})();/* CampaignPanel battle log with battles:'abc' */
 expectBug('G3-03b a save whose battles is not a list passes the validator, then the first finished raid throws inside the game tick',accepted&&!!error,{accepted,tickError:error,battleLogWithString:panel});}
// (4) corrupt tile state and new numeric fields ARE refused (control checks, expected NOT-REPRODUCED).
{const d=load(13).save(),s=d.sites[0].simulation;const bad=[
  ['tileState garbage',x=>x.tileState='t1;zz'],['tileState short',x=>x.tileState=x.tileState.split(';').slice(1).join(';')],
  ['refundUntil string',x=>x.buildings[0].refundUntil='9'],['harvestUntil negative',x=>x.harvestUntil=-5],['merchantUntil NaN-like',x=>x.merchantUntil='NaN'],
  ['good event pending unknown',x=>x.pendingEvent={type:'party',at:1}]];
 const passed=bad.filter(([,f])=>{const v=structuredClone(d);f(v.sites[0].simulation);return accepts(v);}).map(([n])=>n);
 expectBug('G3-04 control: a corrupt tileState / refundUntil / harvestUntil / merchantUntil / pending event is accepted',passed.length>0,{acceptedCorruptions:passed});}
// (5) old saves (tiles objects, no tileState) round-trip without losing tiles, and the new packed form is lossless.
const old=JSON.parse(fs.readFileSync(new URL('../fixtures/save-before-20260928.json',import.meta.url),'utf8'));
for(const [file,raw] of [['save-before-20260928.json#demo',old.demo],['save-before-20260928.json#early',old.early],['browser-roundtrip.json',fs.readFileSync(new URL('../fixtures/browser-roundtrip.json',import.meta.url),'utf8')]]){
 const d=decodeSave(raw),c=new Campaign({saved:d}),again=new Campaign({saved:decodeSave(encodeSave(c.save()))});
 const diff=[];c.sites.forEach((site,i)=>{const a=site.sim.tiles,b=again.sites[i].sim.tiles;for(let k=0;k<a.length;k++)if(a[k].nature!==b[k].nature||a[k].remaining!==b[k].remaining||a[k].growAt!==b[k].growAt)diff.push([i,k]);});
 const oldSims=d.sites?d.sites.map(v=>v.simulation):[d];const lost=oldSims.some((s,i)=>s.tiles&&s.tiles.some((t,k)=>{const sim=c.sites[i].sim,u=sim.tiles[k];if(sim.roads.has(u.x+','+u.z))return false;/* the export road clears its own tiles on load (layExportRoad, intended) */return (t.nature??null)!==u.nature||(t.remaining??0)!==u.remaining;}));
 expectBug('G3-05 control: old save '+file.split('/').pop()+' loses tile data on load or on the packed round trip',diff.length>0||lost,{tileDiffs:diff.length,lostOnLoad:lost});}
{const tiles=[{nature:'tree',remaining:0.1+0.2},{nature:null,remaining:-1},{nature:'sapling',remaining:0,growAt:1234.5678901234},{nature:'rock',remaining:1e-7},{nature:null,remaining:0}];
 const back=unpackTiles(packTiles(tiles));const bad=tiles.filter((t,i)=>t.nature!==back[i].nature||t.remaining!==back[i].remaining||(t.growAt??undefined)!==back[i].growAt);
 expectBug('G3-05b control: packTiles/unpackTiles lose a float, negative or growAt value',bad.length>0,{bad});}
// (6) campaign saves of every fixture rank round-trip to the identical object.
{const {isDeepStrictEqual}=await import('node:util');const bad=[8,13,22,31,32].filter(r=>{const a=load(r).save();return !isDeepStrictEqual(a,new Campaign({saved:decodeSave(encodeSave(a))}).save());});
 expectBug('G3-05c control: a campaign save changes on encode/decode/restore/save',bad.length>0,{changedRanks:bad});}
finish('code-save');
