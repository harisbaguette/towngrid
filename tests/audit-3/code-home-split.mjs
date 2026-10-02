// Audit 3 (G3, code): new games now start on a non-capital province (starting-sites.js), but territory.js splitTerritory
// still protects only capital provinces, so an emerging state can take the player's HOME province: home autonomy is
// cleared, home sales drop to x0.93 and home freight pays a toll. Before the start-province change the home sat on the
// capital province and could never be split.  node tests/audit-3/code-home-split.mjs
import {load,Campaign,expectBug,finish} from '../audit-2/_fixture.mjs';
import {marketFactor} from '../../src/app/game/living-economy.js';
// (1) Natural: the bot campaign fixtures (tests/audit-2/campaign-trace.mjs, paid actions only).
{const rows=[26,29].map(r=>{const c=load(r),h=c.home;return {rank:r,day:c.active.day,home:h.provinceId,owner:c.provinces[h.provinceId].owner,homeTerritory:h.territory,homeMarket:c.tradeConditions(h.id).market,toll:c.tradeConditions(h.id).toll};});
 expectBug('G3-12 an emerging state takes the home province during a normal campaign: home autonomy lost, home sale prices x0.93, freight toll 12G',rows.some(v=>v.owner.startsWith('new-')&&v.homeMarket<1),rows);}
// (2) Minimal: a fresh game on the default start, the home nation spawns emerging states (worldDay does this when a
//     faction's unrest passes 78). Compare with a home on the capital province (all saves made before the change).
{const split=(provinceId)=>{const c=new Campaign({nation:'estern',race:'human',provinceId});const h=c.home;let n=0;
  for(;n<6&&c.provinces[h.provinceId].owner==='estern';n++)c.spawnState('estern','시험 연방');
  return {home:h.provinceId,splitsUntilTaken:c.provinces[h.provinceId].owner==='estern'?null:n,owner:c.provinces[h.provinceId].owner,market:+marketFactor(h.sim,'grain').toFixed(3)};};
 const now=split(undefined);/* default start estern-5 */
 const legacy=(()=>{const c=new Campaign({nation:'estern',race:'human'});c.home.provinceId='estern-0';for(let i=0;i<6;i++)c.spawnState('estern','시험 연방');return {home:'estern-0',owner:c.provinces['estern-0'].owner};})();
 console.log(JSON.stringify({defaultStart:now,capitalHome:legacy}));
 expectBug('G3-12b the default start province falls to the first emerging states of its nation while a capital home never does',now.splitsUntilTaken!==null&&legacy.owner==='estern',{now,legacy});}
// (3) At ranks 25-27 the home autonomy lost this way cannot be bought back: council('territory') is gated by the
//     per-rank allowance meant for OTHER sites (campaign.js allowance counts only non-home sites, yet still blocks the home).
{const c=load(26);const h=c.home;c.provinces[h.provinceId].owner='new-1';h.territory=false;/* injected: the split of (2) */
 c.treasury.money=1e6;c.support=90;const r=c.council('territory',c.homeId);
 expectBug('G3-12c at rank 26 the home cannot regain autonomy after the split: refused as "'+(r.error||'')+'"',!r.ok,{rank:c.rank,allowance:c.allowance('territory'),result:r});}
finish('code-home-split');
