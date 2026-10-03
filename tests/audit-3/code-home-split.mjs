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
// Updated with the fix (R team, 2026-10-02): the home autonomy granted at stage 20 is no longer lost (the split skips the
// home province, and a save where a split had taken it gets province and autonomy back on load, territory.js keepHome),
// so the probe checks the ways it was lost: emerging states splitting the home nation at rank 26 and the rank-29 save
// written after such a split. The old probe set the lost state directly, which the rules can no longer reach.
{const c=load(26);const h=c.home;for(let i=0;i<8;i++)c.spawnState(h.nation,'시험 연방');const split={owner:c.provinces[h.provinceId].owner,territory:h.territory};
 const late=load(29),lh=late.home,loaded={rank:late.rank,owner:late.provinces[lh.provinceId].owner,territory:lh.territory,market:late.tradeConditions(lh.id).market};
 expectBug('G3-12c from rank 26 the home loses its autonomy to an emerging state and cannot get it back',split.owner!==h.nation||!split.territory||loaded.owner!==lh.nation||!loaded.territory,{rank:c.rank,afterSplits:split,rank29Save:loaded});}
finish('code-home-split');
