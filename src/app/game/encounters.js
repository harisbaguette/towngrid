import {FACTIONS} from './world.js';
import {BUILDINGS} from './simulation.js';
import {assignResidentAppearance} from './resident-roster.js';
import {advanceCharacterRoute} from './character-movement.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
// Guards hold ids GUARD_ID_BASE..+7 and attackers ATTACKER_ID_BASE and up, so the two never share an id however many raids
// a site has fought (audit C10: attackers were 500+3n and reached the guards' 800 at the 100th raid).
export const GUARD_ID_BASE=800,ATTACKER_ID_BASE=1000;
/** Melee reach: an attacker strikes a guard this close, and a guard fights any attacker this close, wherever it stands (C3). */
export const MELEE=1.35;
/** Guards also leave their post up to LEASH tiles past its range to stop an attacker that is striking something there. */
export const LEASH=3;
// Running ward facilities (output 'ward') cover d.wardRadius tiles (M4): attackers inside weaken and facilities inside
// take no raid damage. While any ward holds (sim.wardUntil) demons cannot cut the power (audit H5).
export const wardAt=(s,p)=>s.buildings.find(b=>BUILDINGS[b.type].output==='ward'&&b.health>0&&b.enabled!==false&&b.activeUntil>s.time&&distance(b,p)<BUILDINGS[b.type].wardRadius);
export function startRaid(sim){
 if(sim.raid&&!sim.raid.finished)return;
 const sequence=sim.raidCount||0,faction=['demon','orc','beast'][sequence%3],strength=1+Math.max(0,sim.stage-8)*.055;
 const border=sim.tiles.filter(t=>sim.walkable(t.x,t.z)&&[[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>!sim.ownedAt(t.x+a,t.z+b)));
 const start=border.sort((a,b)=>a.z-b.z||a.x-b.x)[sequence%Math.max(1,Math.min(6,border.length))];if(!start||!sim.warehouse)return;
 sim.raidCount=sequence+1;sim.raid={faction,started:sim.time,ends:sim.time+65,strength,damage:0,defeated:0,finished:false,boostUntil:0,boosted:false,lastHit:sim.time,disrupted:false};
 sim.attackers=Array.from({length:3},(_,i)=>({id:ATTACKER_ID_BASE+sequence*3+i,enemy:true,race:FACTIONS[faction].members[i%FACTIONS[faction].members.length],x:start.x,z:start.z,dir:0,walking:false,phase:'idle',task:null,route:[],until:sim.time+65,hp:45*strength,maxHp:45*strength,delay:i*1.7,lastAttack:sim.time}));
 sim.guards=[];deployGuards(sim);sim.notify(`${FACTIONS[faction].name} 접근 · 경비대는 주둔지 주변에서 적을 막습니다.`,'warning');sim.sound('raid');
}
function deployGuards(s){
 const bases=s.buildings.filter(b=>b.type==='barracks'&&b.health>0&&b.enabled!==false);
 const count=Math.min(8,(bases.length?Math.max(1,s.campaign?.defense||0):0)+(s.raid.boosted?2:0));
 for(let i=s.guards.length;i<count;i++){
  const base=bases[i%Math.max(1,bases.length)]||s.warehouse,p=s.entries(base)[0];if(!p)continue;
  const race=s.availableRaces[i%s.availableRaces.length],w=assignResidentAppearance({id:GUARD_ID_BASE+i,race,x:p.x,z:p.z,homeId:base.id,dir:0,walking:false,phase:'idle',task:null,route:[],guard:true,hp:75,maxHp:75,attackAt:0},s.availableRaces);s.guards.push(w);
 }
}
export function mobilize(s){
 if(!s.raid||s.raid.finished)return {ok:false,error:'현재 습격이 없습니다'};
 if(s.raid.boosted)return {ok:false,error:'이번 습격에 경계를 강화했습니다'};
 const short=s.moneyShort?.(80,'경계 강화 ');if(short)return {ok:false,error:short};if(s.availableStock('grain')<6)return {ok:false,error:'경계 강화: 80G와 밀 6개'};
 s.money-=80;s.stock.grain-=6;s.raid.boostUntil=s.time+65;s.raid.boosted=true;deployGuards(s);s.sound('defend');return {ok:true};
}
function walk(s,w,target,dt,speed){
 if(!w.route.length||!s.walkable(w.route[0].x,w.route[0].z)){
  w.route=target.size?s.routeTo(w,target)?.path||[]:s.path(w,{x:Math.round(target.x),z:Math.round(target.z)})||[];
 }
 advanceCharacterRoute(w,dt,speed,(x,z)=>s.walkable(x,z));
}
export function tickRaid(s,dt){
 const r=s.raid;s.guards??=[];if(!r||r.finished){s.attackers=s.attackers.filter(w=>w.until>s.time);s.guards=[];return;}
 let active=s.attackers.filter(w=>w.hp>0);
 for(const w of active){
  w.delay=Math.max(0,w.delay-dt);if(w.delay)continue;
  const ward=wardAt(s,w);
  if(ward){w.hp=Math.max(0,w.hp-dt*15);w.hitUntil=s.time+.12;}
  if(w.hp<=0)continue;
  const guard=s.guards.filter(g=>g.hp>0&&distance(g,w)<MELEE).sort((a,b)=>distance(a,w)-distance(b,w))[0];
  let target=guard;
  if(!target){
   target=s.buildings.find(b=>b.id===w.targetId&&b.health>0);
   if(!target){const targets=s.buildings.filter(b=>b.health>0&&!['field','well'].includes(b.type)&&!BUILDINGS[b.type].home);target=targets.sort((a,b)=>distance(w,a)-(a.type==='warehouse'?2:0)-distance(w,b)+(b.type==='warehouse'?2:0))[0]||s.warehouse;w.targetId=target?.id;w.route=[];}
  }
  if(!target)continue;
  const nearby=distance(w,target)<(guard?MELEE:1.2);w.attacking=nearby;
  if(!nearby)walk(s,w,target,dt,r.faction==='beast'?1.2:.84);
  else{w.walking=false;w.dir=Math.atan2(target.x-w.x,target.z-w.z);if(s.time>=w.lastAttack+(guard?1.05:3.2)){
   w.lastAttack=s.time;s.sound('impact',w.x,w.z);
   if(guard)guard.hp=Math.max(0,guard.hp-5*r.strength);
   else if(wardAt(s,target))s.sound('defend',target.x,target.z);
   else{target.health=Math.max(target.type==='warehouse'?15:0,target.health-10*r.strength);const loss=Math.min(Math.max(0,s.money)*.015,32*r.strength);s.money-=loss;r.damage+=loss;if(target.health===0)s.revision++;
    if(!r.disrupted&&!(r.faction==='demon'&&s.wardUntil>s.time)){r.disrupted=true;if(r.faction==='demon')s.outageUntil=s.time+20;if(r.faction==='beast')for(const route of s.campaign?.routes||[])if(route.from===s.siteId||route.to===s.siteId)route.ambush=25;}
   }
  }}
 }
 // Guards act after the attackers, so a guard struck this step answers in the same step (C3).
 for(const g of s.guards){
  g.walking=false;g.attacking=false;if(g.hp<=0)continue;
  const home=s.buildings.find(b=>b.id===g.homeId)||s.warehouse;
  const range=s.rank>=23?9:6.5;
  // A guard defends the ground around its barracks. It also answers any attacker in melee reach of it (the attacker's own
  // rule for striking a guard) and one striking a facility just past the range line (audit C3: attackers hovering at the
  // line hit guards or facilities unanswered, so the same raid turned on a tenth of a tile).
  const enemy=active.filter(w=>w.hp>0&&w.delay<=0&&(distance(w,home)<range||distance(w,g)<MELEE||w.attacking&&distance(w,home)<range+LEASH)).sort((a,b)=>distance(g,a)-distance(g,b))[0];
  if(!enemy){if(distance(g,home)>1.6)walk(s,g,home,dt,1.8);continue;}
  if(g.target!==enemy.id){g.target=enemy.id;g.route=[];}
  if(distance(g,enemy)>=MELEE)walk(s,g,enemy,dt,2.1);
  else{g.route=[];g.dir=Math.atan2(enemy.x-g.x,enemy.z-g.z);g.attacking=true;if(s.time>=g.attackAt){enemy.hp=Math.max(0,enemy.hp-9);g.attackAt=s.time+.7;s.sound('defend',g.x,g.z);}}
 }
 for(const w of active)if(w.hp<=0){r.defeated++;w.walking=false;w.attacking=false;w.until=s.time+2;s.sound('defeat',w.x,w.z);}
 active=s.attackers.filter(w=>w.hp>0);s.attackers=s.attackers.filter(w=>w.hp>0||w.until>s.time);
 if(!active.length||s.time>=r.ends){r.finished=true;s.attackers=s.attackers.filter(w=>w.hp<=0&&w.until>s.time);s.sound(r.damage?'retreat':'victory');s.notify(r.damage?`습격 종료 · 자금 ${Math.round(r.damage)}G 손실. 파손 시설을 수리하세요.`:'주둔지와 결계로 습격을 막았습니다.',r.damage?'warning':'success');s.campaign?.recordBattle?.(s,r);}
}
