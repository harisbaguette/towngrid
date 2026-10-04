import assert from 'node:assert/strict';
import {Campaign} from '../src/app/game/campaign.js';
import {rivalDay} from '../src/app/game/rival-economy.js';
import {weeklyTrial,trialRule,legacyWeeklyTrial,practiceTrials} from '../src/app/game/industry-trials.js';
import {starsOf,leagueDay} from '../src/app/game/league.js';
import {encodeSave,decodeSave} from '../src/app/game/persistence.js';
import {focusNext} from '../src/app/game/focus-next.js';
import {newPlaytest,observePlaytest} from '../src/app/game/playtest-diary.js';
import {sellableStock,operatingReserve} from '../src/app/game/ui-rules.js';
const c=new Campaign(),a=structuredClone(c.league.rivals[0]),b=structuredClone(a);
for(let day=1;day<=60;day++){rivalDay(a,0,day);rivalDay(b,0,day);}
assert.deepEqual(a,b,'rivals depend on their economy, not player output');assert.ok(a.economy.produced>0&&a.economy.sold>0&&a.score>0);assert.ok(a.economy.cash>=0&&a.economy.fuel>=0);
c.league.rivals[0]=a;assert.deepEqual(decodeSave(encodeSave(c.save())).league.rivals[0],a,'rival economy survives saving');
const bad=c.save();bad.league.rivals[0].economy.fuel=-1;assert.throws(()=>encodeSave(bad));
assert.equal(starsOf('flour',10,1),starsOf('flour',10)*3);assert.equal(starsOf('flour',10,8),starsOf('flour',10));
assert.equal(new Set(Array.from({length:9},(_,i)=>weeklyTrial(i).item)).size,9);
assert.equal(new Set(Array.from({length:27},(_,i)=>weeklyTrial(i).condition.id)).size,3);
assert.deepEqual(trialRule('weekly-38'),legacyWeeklyTrial(38),'old saved competitions retain their rules');
assert.equal(practiceTrials().length,9);assert.equal(focusNext(c.active).view,'build');
const low=new Campaign(),high=new Campaign();high.league.total=1e8;
for(let day=2;day<60;day++){low.lastWorldDay=high.lastWorldDay=day;high.league.dayStars=1e6;leagueDay(low);leagueDay(high);}
assert.deepEqual(low.league.rivals,high.league.rivals,'player wealth and daily score cannot raise rival output');
for(const rival of low.league.rivals){assert.ok(Number.isFinite(rival.score));assert.ok(rival.economy.cash>=0);assert.ok(Object.values(rival.economy.stock).every(n=>Number.isFinite(n)&&n>=0));}
const d=newPlaytest(c.active,1000);observePlaytest(d,c.active,{now:2000,visible:true,menu:'goals'});observePlaytest(d,c.active,{now:3000,visible:false});assert.equal(d.visibleMs,1000);assert.equal(d.menus[0].name,'goals');
const cash=new Campaign(),s=cash.active;s.stock.water=120;s.stock.grain=50;s.stock.plank=40;
const offer=sellableStock(s,{grain:6});assert.equal(sellableStock(s,{grain:6},true).items.find(v=>v.id==='grain').n,36,'one six-unit order is held once, together with the eight-unit production reserve');
assert.equal(offer.items.some(v=>v.id==='water'),false,'cheap water cannot replenish the fuel spent exporting it');
assert.ok(sellableStock(s,{},true).items.some(v=>v.id==='water'),'full-store cleanup can still release low-value goods');
s.money=60;assert.ok(operatingReserve(s).short);assert.match(focusNext(s).label,/예산/);
console.log('PASS competition schedules, independent production rivals, save migration, next-action entry, local playtest timing');
