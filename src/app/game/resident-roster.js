// Stable identities for original pixel illustrations and animation atlases.
// Gender is a presentation choice, never an economic or combat modifier.
import {SPECIALIST_LOOKS,GUARD_LOOKS} from './specialist-roster.js';
const look=(id,gender,name)=>({id,model:'Resident_'+id,gender,name});
export const RESIDENT_LOOKS={
 human:[look('mira','female','미라'),look('rowan','male','로웬'),look('hana','female','하나'),look('ethan','male','에단'),look('vera','female','베라')],
 dwarf:[look('marna','female','마르나'),look('bron','male','브론')],
 titan:[look('taron','male','타론')],
 elf:[look('silen','female','실렌'),look('ael','male','아엘'),look('lien','female','리엔'),look('elion','male','엘리온')],
 spirit:[look('dew','neutral','이슬'),look('mist','neutral','안개')],
 centaur:[look('lana','female','라나'),look('kai','male','카이')],
 fae:[look('fia','female','피아'),look('eil','male','에일')]
};
for(const identity of SPECIALIST_LOOKS)RESIDENT_LOOKS[identity.race].push(identity);
export const genderLabel=gender=>({female:'여성',male:'남성',neutral:'정령'})[gender]||'';
// Housing supplies a recognizable general workforce. Other identities belong
// to facility professions; they are retained for portraits and older saves.
export const HOME_LOOKS={human:'mira',dwarf:'bron',titan:'taron',elf:'silen',spirit:'dew',centaur:'kai',fae:'fia'};
export function residentLook(race,index=0,appearance){
 const list=RESIDENT_LOOKS[race];if(!list)return null;
 return list.find(v=>v.id===appearance)||list[((index%list.length)+list.length)%list.length];
}
export function assignResidentAppearance(worker,races,ordinal=Math.floor(worker.id/Math.max(1,races.length))){
 const list=RESIDENT_LOOKS[worker.race];if(!list)return worker;
 const previous=Object.values(RESIDENT_LOOKS).flat().find(v=>v.id===worker.appearance)||residentLook(worker.race,ordinal);
 if(worker.guard)worker.race=races.includes('elf')?'elf':'human';
 const selected=residentLook(worker.race,0,worker.guard?GUARD_LOOKS[worker.race]:HOME_LOOKS[worker.race]);
 // Keep custom names, tasks, home IDs and cargo when older saves are loaded.
 // Only former automatically assigned character names follow the new look.
 if(worker.name && previous && new RegExp('^'+previous.name+'(?: [0-9]+)?$').test(worker.name))worker.name=worker.name.replace(previous.name,selected.name);
 worker.appearance=selected.id;worker.gender=selected.gender;
 if(!worker.name)worker.name=selected.name+(ordinal>0?' '+(ordinal+1):'');
 return worker;
}
export function residentPortraitKey(worker){return 'resident-'+worker.race+'-'+(worker.appearance||residentLook(worker.race,worker.id)?.id||'');}
