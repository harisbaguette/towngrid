import assert from 'node:assert/strict';
import {Simulation,BUILDINGS} from '../src/app/game/simulation.js';
import {RESIDENT_LOOKS,HOME_LOOKS,assignResidentAppearance} from '../src/app/game/resident-roster.js';
import {facilityStaff,facilityRoster,FACILITY_PROFESSIONS,PROFESSIONS} from '../src/app/game/facility-staff.js';
import {SPECIALIST_LOOKS} from '../src/app/game/specialist-roster.js';
import {factionOf} from '../src/app/game/world.js';
for(const [race,appearance]of Object.entries(HOME_LOOKS)){
 const expected=RESIDENT_LOOKS[race].find(v=>v.id===appearance);
 for(let id=0;id<8;id++)assert.equal(assignResidentAppearance({id,race},[race],id).gender,expected.gender);
}
const custom={id:51,race:'human',appearance:'rowan',name:'사용자 이름',homeId:5,task:{item:'flour',amount:3,carried:true},route:[{x:2,z:3}]};
const oldTask=custom.task,oldRoute=custom.route;assignResidentAppearance(custom,['human']);
assert.equal(custom.appearance,'mira');assert.equal(custom.name,'사용자 이름');assert.equal(custom.task,oldTask);assert.equal(custom.route,oldRoute);assert.equal(custom.homeId,5);
const generated={id:2,race:'human',appearance:'rowan',name:'로웬 2'};assignResidentAppearance(generated,['human']);assert.equal(generated.name,'미라 2');
assert.equal(Object.keys(PROFESSIONS).length,19);
assert.equal(Object.keys(FACILITY_PROFESSIONS).length,77);
for(const identity of SPECIALIST_LOOKS)assert.ok(Object.values(PROFESSIONS).some(job=>job.human[1]===identity.id||job.elf[1]===identity.id),identity.id+' is used');
for(const faction of ['human','elf'])assert.equal(new Set(Object.values(PROFESSIONS).map(job=>job[faction][1])).size,19,'different jobs use distinct identities');
for(const race of ['human','elf']){
 const sim=new Simulation('river',null,{race});
 const oldGuard={id:800,guard:true,race,appearance:race==='human'?'mira':'silen',name:'이름 유지',hp:32,maxHp:75,homeId:3,x:4,z:5,route:[{x:4,z:6}]};
 sim.guards=[oldGuard];const restored=new Simulation('river',sim.save());
 assert.equal(restored.guards[0].appearance,race==='human'?'garen':'aster');
 for(const key of ['hp','maxHp','homeId','x','z','route','name'])assert.deepEqual(restored.guards[0][key],oldGuard[key]);
 for(const [type,def]of Object.entries(BUILDINGS)){
  const b={id:45,type,x:10,z:12,health:100,enabled:true,working:true,progress:.4,inputs:{},out:0,status:'생산 중'};
  const staff=facilityStaff(sim,b);
  if(def.home||['road','rail','pavedroad','pipe','conveyor'].includes(type)){assert.equal(staff,null,type);continue;}
  assert.ok(staff&&FACILITY_PROFESSIONS[type],type+' has a profession');
  assert.equal(factionOf(staff.race),factionOf(race));
  assert.ok(RESIDENT_LOOKS[staff.race].some(v=>v.id===staff.appearance));
  assert.equal(staff.buildingId,b.id);assert.equal(staff.staff,true);assert.equal(staff.task,null);
  assert.equal(facilityStaff(sim,{...b,health:0}),null);
  assert.equal(facilityStaff(sim,{...b,enabled:false}).working,false);
 }
 const b={id:20,type:'bakery',x:10,z:12,health:100,enabled:true,working:true,progress:.5,inputs:{},out:0};
 sim.buildings.push(b);const before=JSON.stringify(sim.save());
 assert.equal(facilityRoster(sim)[0].jobTitle,'제빵사');assert.equal(facilityRoster(sim)[0].working,true);
 assert.equal(facilityRoster(sim)[0].appearance,race==='human'?'hana':'lien');
 assert.equal(JSON.stringify(sim.save()),before,'staff projection must not alter saves, inventory, transport slots or production');
 b.working=false;assert.equal(facilityRoster(sim)[0].working,false);
 sim.buildings=[];assert.deepEqual(facilityRoster(sim),[],'demolition removes attached staff');
}
console.log('Facility staff: fixed housing identities, both factions, all workplaces, state synchronization and save preservation PASS');
