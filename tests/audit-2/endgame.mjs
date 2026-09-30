// audit-2: after the last rank (패권국). Load the bot's save at the moment it reached rank 33 and keep the town running
// for 10 in-game days (since 2026-09-29 the run keeps a completion record and endless legacy goals: campaign.completion / legacy()) with its own auto-sale settings; random events stay on. What goal or pressure is left?
import {load,run,expectBug,finish} from './_fixture.mjs';
const c=load(32);const s=c.home.sim;const m0=c.treasury.money,st0=c.newStates.length,terr0=c.metric('territories');const day0=s.day;
run(c,800,()=>{for(const v of c.sites){const b=v.sim;for(const x of b.buildings)if(x.health<100&&b.money>b.repairCost(x)+100)b.repair(x.id);}});
const next=s.promotion();
expectBug('E1 after 패권국 there is no next goal and cash piles up with nothing to buy',!next&&c.treasury.money-m0>50000&&!(c.completion&&c.legacy().goals.length),{completion:c.completion,legacy:c.legacy(),rank:c.rank,promotion:next,days:s.day-day0,cashStart:Math.round(m0),cashEnd:Math.round(c.treasury.money),newStatesSpawned:c.newStates.length-st0,territoriesStartEnd:[terr0,c.metric('territories')],screenText:'패권국에 도달했습니다. 신생 국가와의 경쟁은 계속됩니다. (Game.tsx goals dialog)'});
finish('endgame');
