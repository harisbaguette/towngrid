// Rule and save fixes of the 2026-10-02 code audit (docs/audit-20260930/audit-G3-code.md, R team): every saved field is
// checked on load, the home province is never split off, each site keeps its own books, and the upgrade/specialise
// buttons read the rule the action uses. Run by tests/simulation.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Campaign} from '../src/app/game/campaign.js';
import {Simulation,BUILDINGS,RESOURCES,BOOKED,HARVEST_TIME,MERCHANT_TIME,createShowcase,ACTION_PRICES} from '../src/app/game/simulation.js';
import {fleet,shipmentError,VEHICLES} from '../src/app/game/export-route.js';
import {unlockRank} from '../src/app/game/world.js';
import * as ui from '../src/app/game/ui-rules.js';
import {validateSave,encodeSave,decodeSave} from '../src/app/game/persistence.js';
import {startRaid} from '../src/app/game/encounters.js';
import {remainingSeconds} from '../src/app/game/game-time.js';
import {PROVINCES} from '../src/app/game/territory.js';
const fixture=r=>decodeSave(fs.readFileSync(new URL('./audit-2/fixtures/rank'+r+'.json',import.meta.url),'utf8'));
const load=r=>new Campaign({saved:fixture(r)});
const run=(c,secs)=>{for(let i=0;i<secs*4;i++)c.tick(.25);};
const refused=d=>{try{validateSave(d);return false;}catch{return true;}};
const calm=c=>{for(const v of c.sites){v.sim.nextEvent=1e12;v.sim.pendingEvent=null;}};

// G3-01/02/03/03b and the same root: every field a save holds is checked. Each saved path of three real saves (6 sites
// at 패권국 with the completion record, battles and stakes; a raid in progress with guards and attackers) gets a value
// of a wrong type; the validator must refuse it. A field added to a save without a check fails here.
{const raid=(()=>{const c=load(26),s=c.home.sim;calm(c);c.defense=2;startRaid(s);run(c,2);assert.ok(s.attackers.length&&s.guards.length,'a raid with guards and attackers on the map');return c.save();})();
 const samples=[fixture(31),fixture(32),raid],maps=/\.(stock|produced|sold|inputs|batch|pressure|autoSell|reserves|relations|provinces)$/,paths=new Map();
 const walk=(v,keys,pat,save)=>{const type=v===null?'null':Array.isArray(v)?'array':typeof v;if(keys.length&&!paths.has(pat))paths.set(pat,{keys,type,save});
  if(type==='array')v.forEach((x,i)=>walk(x,[...keys,i],pat+'[]',save));else if(type==='object')for(const[k,x]of Object.entries(v))walk(x,[...keys,k],pat+(maps.test(pat)?'.*':'.'+k),save);};
 for(const d of samples)walk(d,[],'',d);
 // Recomputed on load, so any value is harmless: the races from the site's race, a facility's size (always one tile).
 const ignored=['.sites[].simulation.availableRaces','.sites[].simulation.availableRaces[]','.sites[].simulation.buildings[].size'];
 const wrong={number:'x',string:7,boolean:'x',null:{},object:'x',array:{}},accepted=[];
 for(const [pat,{keys,type,save}] of paths){if(ignored.includes(pat))continue;const d=structuredClone(save);let o=d;for(const k of keys.slice(0,-1))o=o[k];o[keys.at(-1)]=wrong[type];if(!refused(d))accepted.push(pat+' '+type);}
 assert.ok(paths.size>300,'every saved path is visited: '+paths.size);
 assert.deepEqual(accepted,[],'a save with a wrong-typed field is refused');
 for(const d of samples)assert.ok(!refused(d),'real saves still load');}
// The defects as found: a stake of the wrong type or sign, welfareDay text, a completion record of objects, battles that are
// not a list or hold a wrong entry, a province of another nation or none at all.
{const d=fixture(31),bad=[
  ['stake text',x=>x.investments.push({nation:'estern',day:1,stake:'abc'})],['stake negative',x=>x.investments.push({nation:'estern',day:1,stake:-1e9})],
  ['welfareDay text',x=>x.welfareDay='오늘'],['completion day object',x=>x.completion={...x.completion,day:{nested:true}}],['completion without day',x=>{x.completion={...x.completion};delete x.completion.day;}],
  ['battles object',x=>x.battles={}],['battles text',x=>x.battles='abc'],['battle damage text',x=>x.battles=[{day:1,site:'site-1',faction:'orc',damage:'x',defeated:0}]],['battle faction unknown',x=>x.battles=[{day:1,site:'site-1',faction:'party',damage:0,defeated:0}]],
  ['province unknown',x=>x.sites[1].provinceId='nowhere-9'],['province of another nation',x=>x.sites[1].provinceId=PROVINCES.find(p=>p.nation!==x.sites[1].nation).id],['province number',x=>x.sites[1].provinceId=3],
  ['treasury charter',x=>x.treasury.charter='tyranny'],['state provinces',x=>x.newStates[0].provinceIds=['nowhere']],['route status',x=>x.routes.push({...x.routes[0],id:'route-x',status:{}})],
  ['site health text',x=>x.sites[0].simulation.health='x'],['site challenge number',x=>x.sites[0].simulation.challenge=0]];
 for(const [name,f] of bad){const v=structuredClone(d);f(v);assert.ok(refused(v),name+' is refused');assert.throws(()=>decodeSave(JSON.stringify(v)),/유효한 타운그리드 저장 파일이 아닙니다/);}
 assert.ok(!refused(structuredClone(d)));const old=structuredClone(d);for(const i of old.investments)delete i.stake;old.completion=null;delete old.welfareDay;delete old.battles;assert.ok(!refused(old),'saves from before stakes, completion and battles load');}

// G3-03: one site per plot. Saves from before provinces put every branch on the capital province; on load the branch moves
// to the province its number meant (site-2 -> nation-1), and the move survives saving. An edited duplicate is moved the same way.
{const old=new Campaign({saved:decodeSave(fs.readFileSync(new URL('./fixtures/browser-roundtrip.json',import.meta.url),'utf8'))});
 const ids=old.sites.map(v=>v.provinceId);assert.equal(new Set(ids).size,ids.length,'old branches no longer share the capital province: '+ids);assert.equal(old.sites.find(v=>v.id==='site-2').provinceId,'estern-1');
 assert.deepEqual(new Campaign({saved:decodeSave(encodeSave(old.save()))}).save(),old.save(),'the move is kept');
 const d=fixture(31),home=d.sites[0].provinceId,second=d.sites[1].provinceId;d.sites[1].provinceId=home;const c=new Campaign({saved:decodeSave(encodeSave(d))});
 assert.equal(c.sites.filter(v=>v.provinceId===home).length,1);assert.equal(c.sites[1].provinceId,second,'the duplicate returns to its own province');}

// G3-12: the home province (a non-capital start) is never split off; other provinces still are. A save in which a split
// had already taken it gets the province and the home autonomy back, and keeps the state's other province.
{const c=new Campaign({nation:'estern',race:'human'}),h=c.home;assert.ok(!PROVINCES.find(p=>p.id===h.provinceId).capital,'a new game starts off the capital');
 for(let i=0;i<8;i++)c.spawnState('estern','시험 연방');assert.equal(c.provinces[h.provinceId].owner,'estern','the home province stays');
 assert.ok(PROVINCES.some(p=>p.nation==='estern'&&!p.capital&&c.provinces[p.id].owner!=='estern'),'other provinces still split');assert.equal(c.tradeConditions(h.id).market,1);
 const raw=fixture(29);assert.equal(raw.provinces[raw.sites[0].provinceId].owner,'new-34','the stored save had lost the home province');
 const late=new Campaign({saved:raw}),lh=late.home,state=late.newStates.find(v=>v.id==='new-34');
 assert.equal(late.provinces[lh.provinceId].owner,'estern');assert.ok(lh.territory,'home autonomy restored at stage '+(late.rank-5));
 assert.deepEqual(state.provinceIds,['estern-4']);assert.equal(state.capitalProvince,'estern-4');assert.deepEqual(state.point,PROVINCES.find(p=>p.id==='estern-4').point);
 const again=late.save();assert.deepEqual(new Campaign({saved:decodeSave(encodeSave(again))}).save(),again,'the return is stable over save and load');
 const branches=load(22);for(let i=0;i<8;i++)branches.spawnState('estern','시험 연방');assert.ok(branches.sites.some(v=>v.id!==branches.homeId&&branches.provinces[v.provinceId]?.owner!=='estern'),'a branch can still end up in an emerging state');}

// G3-06: each site's own books. With other sites working, a branch with everything off records no production, use or
// other money; all sites' books add up to the campaign's money, also across days, raids and storms.
{const c=load(31);c.treasury.money=100000;c.switchSite('site-2');c.active.paused=false;for(const v of c.sites)v.sim.speed=1;
 const s=c.active;for(const b of s.buildings)s.setOperation(b.id,false);for(const k of Object.keys(s.autoSell))s.autoSell[k]=false;calm(c);
 const total=r=>r.items.reduce((n,v)=>n+v.made+v.used,0),a=s.ledger().today,own0=c.sites.map(v=>v.sim.ownMoney()),m0=c.treasury.money;run(c,40);const b=s.ledger().today;
 assert.equal(total(b)-total(a),0,'nothing made or used by a stopped branch');assert.equal(b.other-a.other,0,'no other site\'s money in this ledger');
 const books=()=>Math.round(c.sites.reduce((n,v,i)=>n+v.sim.ownMoney()-own0[i],0));assert.equal(books(),Math.round(c.treasury.money-m0));
 for(const v of c.sites)v.sim.nextEvent=v.sim.time+5;run(c,200);assert.equal(books(),Math.round(c.treasury.money-m0),'books add up over days and events');
 // a paid action on the branch is the branch's; a council act and a freight fee belong to no site and land with the home
 const home=c.home.sim,f0=s.books.flow,h0=home.ownMoney(),t=s.tiles.find(t=>s.canBuild('road',t.x,t.z)===null),fee=s.clearCost(t.x,t.z,'road');assert.ok(s.build('road',t.x,t.z).ok);
 assert.equal(s.books.flow-f0,-s.buildCost('road')-fee,'the build and its clearing fee (simulation.js clearCost)');assert.equal(home.ownMoney(),h0);
 s.stock.bread+=99;const g0=home.ownMoney(),b0=s.books.flow,w=c.council('welfare');assert.ok(w.ok,w.error);
 assert.equal(Math.round(home.ownMoney()-g0),-c.councilPrice('welfare').money);assert.equal(s.books.flow,b0,'paid on the branch screen, booked with the home');}
{const c=load(13);calm(c);c.active.paused=false;const s=c.active;const d0=s.day;while(s.day===d0)c.tick(.25);
 const day=s.ledger();assert.equal(day.today.partial,false,'a day begun while running is whole');assert.equal(day.last.day,d0);
 assert.equal(day.last.income,Math.round(s.budget.lastIncome));assert.equal(day.last.expenses,Math.round(s.budget.lastExpenses));
 const before=s.ledger().today;s.sanctionUntil=s.time+100;const r=s.negotiateSanction();assert.ok(r.ok);const after=s.ledger().today;
 assert.deepEqual({net:after.net-before.net,expenses:after.expenses-before.expenses,other:after.other-before.other},{net:-r.cost,expenses:r.cost,other:0},'G3-06b: a negotiation counts once');
 run(c,10);const loaded=new Campaign({saved:decodeSave(encodeSave(c.save()))}).active.ledger();assert.equal(loaded.today.partial,true,'after loading, the day is recorded from that moment');assert.equal(loaded.last,null);}
{const s=new Simulation('river');s.nextEvent=1e12;const m0=s.money;s.build('warehouse',11,12);s.build('house',11,14);for(let i=0;i<4*30;i++)s.tick(.25);const t=s.ledger().today;
 assert.equal(t.net,Math.round(s.money-m0),'a site alone books its whole money');}
// Every Simulation method that moves money is measured (BOOKED); a method outside the list must not move money itself or
// through the helper modules, except resolveEvent, which only tick calls.
{const src=fs.readFileSync(new URL('../src/app/game/simulation.js',import.meta.url),'utf8'),body=src.slice(src.indexOf('export class Simulation'),src.indexOf('export const BOOKED'));
 const movers=[];for(const file of ['economy','living-economy','encounters','export-route']){const text=fs.readFileSync(new URL('../src/app/game/'+file+'.js',import.meta.url),'utf8');
  for(const part of text.split(/\n(?=export (?:async )?function )|\nfunction /)){const name=/^(?:export (?:async )?function |)([A-Za-z]+)\(/.exec(part)?.[1];if(name&&/\.money\s*[-+]?=[^=]/.test(part))movers.push(name);}}
 const pays=new RegExp('\\.money\\s*[-+]?=[^=]|\\b('+movers.join('|')+')\\(');
 const methods=body.split(/\n (?=(?:get )?[A-Za-z]+\()/).map(m=>[/^(?:get )?([A-Za-z]+)\(/.exec(m)?.[1],m]).filter(([n])=>n&&n!=='constructor');
 const unmeasured=methods.filter(([n,m])=>pays.test(m)&&!BOOKED.includes(n)&&n!=='resolveEvent').map(([n])=>n);assert.deepEqual(unmeasured,[],'money-moving methods outside BOOKED');
 assert.ok(movers.length>=4,'helpers that move money were found: '+movers);assert.ok(methods.filter(([,m])=>/this\.resolveEvent\(/.test(m)).every(([n])=>n==='tick'),'only tick resolves events');}

// G3-11: the gate the buttons read is the rule the action uses, also when a resident has reserved part of the stock.
{const c=load(13);calm(c);const s=c.active,b=s.buildings.find(v=>BUILDINGS[v.type].period&&(v.level||1)<3&&v.health>=100),item=s.upgradeItem(b),w=s.workers.find(v=>!v.task),target=s.buildings.find(v=>v!==b&&BUILDINGS[v.type].period);
 s.money=Math.max(s.money,s.upgradeCost(b)+500);const reserve=n=>{w.task=n?{kind:'supply',item,amount:n,building:target.id,targetId:target.id,carried:false}:null;};
 for(const [stock,held] of [[3,2],[5,2],[3,0]]){s.stock[item]=stock;reserve(held);const gate=s.upgradeShort(b),level=b.level||1,r=s.upgrade(b.id);assert.equal(!gate,r.ok,'upgrade gate '+stock+'/'+held+': '+gate);if(r.ok)b.level=level;}
 const raceOf=s.availableRaces[0];reserve(0);for(const [planks,held] of [[2,1],[2,0]]){s.stock.plank=planks;w.task=held?{kind:'supply',item:'plank',amount:held,building:target.id,targetId:target.id,carried:false}:null;const gate=s.specializeShort(b,raceOf),r=s.specialize(b.id,raceOf);assert.equal(!gate,r.ok,'specialise gate '+planks+'/'+held+': '+gate);}
 assert.equal(s.specialize(b.id).ok,false,'a crew needs a race');}

// Time rules added since 563bcc9 quote real seconds at the speed played (game-time.js): event warnings, harvest, merchant,
// sanction and mana storm notices. The refund window and timers stay in game seconds; screens convert with remainingSeconds.
for(const speed of [1,2,4]){const s=new Simulation('river');s.build('warehouse',11,12,true);s.speed=speed;
 for(const [type,seconds] of [['harvest',HARVEST_TIME],['merchant',MERCHANT_TIME],['sanction',100],['manaStorm',45]]){s.notices=[];s.pendingEvent={type,at:s.time};s.resolveEvent();
  const shown=+/(\d+)초/.exec(s.notices.at(-1).text)?.[1];assert.equal(shown,remainingSeconds(seconds,s),type+' at '+speed+'x');}
 s.nextEvent=s.time;s.pendingEvent=null;s.notices=[];s.tick(.01);assert.equal(+/(\d+)초 뒤/.exec(s.notices.at(-1).text)?.[1],40,'an event is announced 40 real seconds ahead at '+speed+'x');}
// G1-E4: the open lord's order keeps its item when a facility switches to an optional product; the next order is drawn
// from the pool as it is when that order opens. In a campaign the order is one for every site and survives save and load.
{const s=new Simulation('river',null,{nation:'estern'});s.nextEvent=1e12;s.rank=5;s.contracts=5;s.money=1e5;for(const r of Object.keys(RESOURCES))s.stock[r]=60;/* set directly */
 s.build('warehouse',11,12);const a=s.build('bakery',9,12).id,b=s.build('bakery',13,12).id;const open=s.contract();
 for(const [id,recipe] of [[a,'jam'],[b,'baguette'],[a,'bread'],[b,'jam']]){assert.ok(s.setRecipe(id,recipe).ok,recipe);assert.deepEqual(s.contract(),open,'the open order stays after switching to '+recipe);}
 assert.deepEqual(new Simulation(s.region,decodeSave(encodeSave(s.save()))).contract(),open,'a site alone keeps it over save and load');
 s.contracts++;/* the order was delivered (export-route.js arrive) */const next=s.contract();assert.equal(s.contractOrder.n,6);assert.ok(next.item,'the next order is drawn');
 const c=load(22);calm(c);const item=c.sites[0].sim.contract().item;assert.ok(c.sites.every(v=>v.sim.contract().item===item),'one order for every site');
 const site=c.sites[1].sim,maker=site.buildings.find(v=>(BUILDINGS[v.type].recipes||[]).length>1);if(maker){const alt=BUILDINGS[maker.type].recipes.find(r=>r.id!==site.recipeOf(maker).id&&!(r.unlock>site.rank));if(alt)site.setRecipe(maker.id,alt.id);}
 assert.equal(c.sites[0].sim.contract().item,item);assert.equal(new Campaign({saved:decodeSave(encodeSave(c.save()))}).active.contract().item,item,'the campaign keeps it over save and load');
 const bad=c.save();bad.treasury.contractOrder={n:'x',item:'grain'};assert.ok(refused(bad),'a damaged order is refused');bad.treasury.contractOrder={n:1,item:'gold'};assert.ok(refused(bad));}

// G1-T2b: a full repair never costs more than half the price (less than demolishing and building again), 100G and up as
// before; storms and raids leave the terrain facilities (pond, pasture, clover) alone, so a 25G clover draws no hits.
{for(const [type,d] of Object.entries(BUILDINGS)){if(d.tile)continue;const full=new Simulation('river').repairCost({type,health:0});assert.ok(full<=Math.max(5,Math.ceil(Math.max(d.cost*.1,d.cost*.5))),type+' full repair '+full+' for '+d.cost+'G');if(d.cost>=100)assert.equal(full,Math.ceil(Math.max(50,d.cost*.1)),type+' unchanged');}
 const s=new Simulation('river',null,{nation:'estern'});s.nextEvent=1e12;s.rank=13;s.money=1e5;for(const r of Object.keys(RESOURCES))s.stock[r]=80;/* set directly */
 s.build('warehouse',11,12);s.build('house',11,14);s.build('well',13,12);s.build('field',13,13);const terrain=['clover','pasture','pond'].map(t=>{const at=s.tiles.find(v=>s.canBuild(t,v.x,v.z)===null);assert.ok(at,t);s.build(t,at.x,at.z);return s.at(at.x,at.z);});
 for(let k=0;k<40;k++){for(const b of s.buildings)b.health=100;s.protected=false;s.pendingEvent={type:'storm',at:s.time};s.resolveEvent();}
 assert.ok(terrain.every(b=>b.health===100),'storms leave terrain facilities alone');assert.ok(s.buildings.some(b=>!BUILDINGS[b.type].terrain&&b.health<100),'storms still hit facilities');
 for(const b of s.buildings)if(!BUILDINGS[b.type].terrain&&b.type!=='warehouse')b.health=0;s.raid=null;startRaid(s);for(let i=0;i<4*60;i++)s.tick(.25);/* only the warehouse and terrain stand */
 assert.ok(terrain.every(b=>b.health===100),'raiders leave terrain facilities alone');}

// G1-S1/S2: on a map with an ecology the biome's fertility and moisture already hold snow and sand, so the ground penalty
// of farms and wells is not applied again; a map without an ecology keeps it. Tutorial order, first promotion at 1x.
{const tutorial=s=>{s.nextEvent=1e12;for(const [t,x,z] of [['warehouse',11,12],['house',11,14],['well',13,12],['field',13,13],['lumber',9,10]])assert.ok(s.build(t,x,z).ok,t);
  for(let i=0;i<4*900;i++){s.tick(.25);if(s.contractStatus().ready)s.fulfill();if(s.promotion()?.ready){s.promote();return s.time/.5;}}return Infinity;};
 const site=(id,ecology)=>{const s=new Simulation('river',null,{nation:id.split('-')[0],provinceId:id});return s.layout.ecology===ecology?s:null;};
 const meadow=PROVINCES.map(p=>site(p.id,'meadow')).find(Boolean),snow=PROVINCES.map(p=>site(p.id,'snow')).find(Boolean),desert=PROVINCES.map(p=>site(p.id,'desert')).find(Boolean);
 for(const [s,ground] of [[snow,'ice'],[desert,'sand']]){const t=s.tiles.find(v=>v.ground===ground);assert.ok(t,ground+' tiles on a '+s.layout.ecology+' map');
  assert.equal(s.tileMultiplier('field',t.x,t.z),.7+t.fertility*.008,'no second penalty for a field on '+ground);assert.equal(s.tileMultiplier('well',t.x,t.z),.7+t.moisture*.008,'nor for a well');}
 const old=new Simulation('river',{...snow.save(),land:{...snow.layout,ecology:undefined}});const ice=old.tiles.find(v=>v.ground==='ice');assert.ok(ice&&!old.layout.ecology,'an old map with ice');
 assert.ok(Math.abs(old.tileMultiplier('field',ice.x,ice.z)-(.7+ice.fertility*.008)*.6)<1e-9,'an old map keeps the ice penalty');
 const base=tutorial(meadow),times=[snow,desert].map(s=>tutorial(new Simulation('river',null,{nation:s.nation,provinceId:s.provinceId})));
 assert.ok(times.every(t=>t<base*1.6),'snow and desert reach the first rank within 1.6x of a meadow: '+[base,...times].map(Math.round));}
// U handoff 1: a building may not shut a facility in (like the export road, X1): not on a neighbour's last free side, not
// where it has no free side itself, not where it cuts the only way from the warehouse. Roads, rails and pipes are walked
// over and stay allowed; rebuilding after a demolition is held to the same rule; the scripted demo towns still build.
{const town=()=>{const s=new Simulation('river',null,{nation:'estern'});s.nextEvent=1e12;s.money=1e5;s.rank=32;for(const r of Object.keys(s.stock))s.stock[r]=99;return s;};/* rank set directly: every facility unlocked */
 let s=town();for(const [t,x,z] of [['warehouse',11,12],['well',13,12],['field',14,12],['field',13,11],['field',12,12]])assert.ok(s.build(t,x,z).ok,t);
 assert.match(s.canBuild('field',13,13),/우물의 마지막 출입구를 막는 자리/);assert.match(s.canBuild('pond',13,13),/마지막 출입구/);for(const t of ['road','pipe'])assert.equal(s.canBuild(t,13,13),null,t+' is walked over');
 assert.ok(s.demolish(14,12).ok);assert.equal(s.canBuild('field',13,13),null,'with a side free again the spot is open');assert.ok(s.build('field',13,13).ok);
 assert.match(s.canBuild('field',14,12),/마지막 출입구/,'rebuilding on the side left free is refused');
 s=town();s.build('warehouse',11,12);for(const [x,z] of [[14,10],[15,9],[15,11]])assert.ok(s.build('field',x,z).ok);/* x=16 is outside the owned land */
 assert.match(s.canBuild('well',15,10),/드나들 빈 칸이 없는 자리/);assert.equal(s.canBuild('clover',15,10),null,'a terrain facility needs no door');
 s=town();s.build('warehouse',9,12);for(let z=8;z<16;z++)if(z!==12)assert.ok(s.build('field',12,z).ok,'wall '+z);assert.ok(s.build('well',14,12).ok);
 assert.match(s.canBuild('field',12,12),/우물에서 창고로 가는 길을 막는 자리/);assert.equal(s.canBuild('road',12,12),null);
 const tour=createShowcase();assert.equal(tour.buildings.length,37,'the showcase tour builds every facility');assert.ok(tour.buildings.every(b=>!tour.needsDoor(b.type)||tour.entries(b).length));}
// U handoff 2: the title chain names the site once: the domain is the province of the site's plot, and a site named after
// it (or after the district at a capital start) is not listed again above itself.
{for(const c of [new Campaign({nation:'estern',race:'human'}),new Campaign({demo:true}),load(31)]){for(const v of c.sites){c.switchSite(v.id);const h=c.hierarchy();
  assert.equal(new Set(h).size,h.length,'no title twice: '+h.join(' > '));assert.equal(h.at(-2),v.name);assert.equal(h.filter(t=>t===v.name).length,1);}}}
// U handoff 3: a storage warning names three goods and counts the rest; the whole list follows as news (ledger list only).
{const s=new Simulation('river');s.notices=[];const goods=['wood','stone','water','grain','plank','flour'];for(const r of goods)s.stock[r]=s.storageCapacity+5;s.checkStorage();
 const [warn,news]=s.notices;assert.equal(warn.type,'warning');assert.match(warn.text,/ 외 4종 · 판매해 자리를 비우세요$/);assert.equal(warn.text.split(' · ').length,5,warn.text);
 assert.equal(news.type,'news');assert.ok(goods.every(r=>news.text.includes(RESOURCES[r].name)),'the full list is kept: '+news.text);
 const one=new Simulation('river');for(const r of Object.keys(one.stock))one.stock[r]=0;one.notices=[];one.stock.wood=one.storageCapacity+1;one.checkStorage();assert.equal(one.notices.length,1);assert.doesNotMatch(one.notices[0].text,/외 \d+종/);}
// K-03 (player audit): every paid action with goods refuses with what is short and by how many, and exports that check as
// its gate; the gate is null exactly when the action goes through. The prices the screen repeats match the rules.
{const town=()=>{const s=new Simulation('river',null,{nation:'estern'});s.nextEvent=1e12;s.money=1e5;s.rank=32;s.build('warehouse',11,12,true);s.build('house',11,14,true);return s;};/* set directly */
 const cases=[['sanitize',s=>s.sanitizeShort(),s=>s.sanitize(),{water:0,wood:1},'목재 2개'],['plant',s=>s.plantShort(13,12),s=>s.plant(13,12),{water:1},'물 1개'],
  ['reinforce',s=>{s.pendingEvent={type:'storm',at:s.time+20};return s.reinforceShort();},s=>s.reinforce(),{wood:0},'목재 4개'],
  ['mobilize',s=>{s.raid={faction:'orc',finished:false,boosted:false};return s.mobilizeShort();},s=>s.mobilize(),{grain:2},'밀 4개'],
  ['rescue cart',s=>{s.rescueQuest.step=2;return s.rescueShort();},s=>s.rescue(),{wood:12,grain:3},'밀 9개']];
 for(const [name,gate,act,stock,lack] of cases){for(const short of [true,false]){const s=town();for(const r of Object.keys(s.stock))s.stock[r]=99;if(short)Object.assign(s.stock,stock);
  const g=gate(s),r=act(s);assert.equal(!g,r.ok,name+' gate and action agree: '+g);if(short){assert.match(r.error,new RegExp(lack+'.* 부족'),name+': '+r.error);}}}
 const s=town();for(const r of Object.keys(s.stock))s.stock[r]=0;assert.match(s.canBuild('quarry',13,12),/건설비 .*목재 \d+개 부족/);
 assert.match(s.upgradeShort(s.buildings.find(b=>b.type==='house')),/목재 3개 부족/);
 assert.deepEqual(ACTION_PRICES.sanitize,{money:35,items:{water:8,wood:3}});if(ui.ACTION_COSTS)assert.deepEqual(ui.ACTION_COSTS,ACTION_PRICES,'the screen shows the prices the rules charge');}
// K-07: fuel vehicles join the fleet only once fuel can be had (a facility of this rank makes it, or some is in stock), so a
// rank-2 town hears about its three carts, not about fuel, trucks or steamers.
{const at=(rank,fuel=0)=>{const s=new Simulation('river',null,{nation:'estern'});s.nextEvent=1e12;s.rank=rank;s.build('warehouse',11,12,true);s.stock.wood=99;s.stock.fuel=fuel;for(let i=0;i<3;i++)s.sell('wood',1);return s;};
 const early=at(2);assert.ok(fleet(early).every(v=>VEHICLES[v.kind].fuel),'the starting truck requires fuel');assert.match(shipmentError(early),/연료|돌아오면 출발합니다/);
 assert.ok(fleet(at(2,5)).some(v=>VEHICLES[v.kind].fuel),'fuel delivered early brings the trucks');assert.ok(fleet(at(unlockRank('refinery'))).some(v=>VEHICLES[v.kind].fuel),'the refinery rank brings them');}
// Cancelling a paid build within the grace puts back what the tile held: the tree returns and the two wood its clearing
// gave are taken back (player audit: wood 44 → 41 → 46), also across a save.
{const s=new Simulation('river',null,{nation:'estern'});s.nextEvent=1e12;s.money=2000;s.rank=5;s.build('warehouse',11,12,true);s.stock.wood=44;
 const t=s.tiles.find(t=>t.nature==='tree'&&s.canBuild('quarry',t.x,t.z)===null),before={wood:s.stock.wood,money:s.money};assert.ok(s.build('quarry',t.x,t.z).ok);
 const r=new Simulation(s.region,decodeSave(encodeSave(s.save())));assert.ok(r.demolish(t.x,t.z).full);
 assert.deepEqual({wood:r.stock.wood,money:r.money},before,'stock and money as before the build');assert.equal(r.tile(t.x,t.z).nature,'tree');
 const bad=s.save();bad.buildings.find(b=>b.cleared).cleared={nature:'gold',remaining:1};assert.throws(()=>decodeSave(JSON.stringify(bad)));}
console.log('PASS: G3 save fields checked ('+'all saved paths'+'), home province kept, site books, button gates, real-second notices; G1-E4 open order kept, G1-T2b repair and terrain, G1-S1/S2 ground once; doors kept free, title chain once, short storage warning; K-03 shortfalls, K-07 fuel fleet, cancel undoes clearing');
