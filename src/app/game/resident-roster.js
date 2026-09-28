// Stable identities for original pixel illustrations and animation atlases.
// Gender is a presentation choice, never an economic or combat modifier.
const look=(id,gender,name)=>({id,model:'Resident_'+id,gender,name});
export const RESIDENT_LOOKS={
 human:[look('mira','female','미라'),look('rowan','male','로웬'),look('hana','female','하나'),look('ethan','male','에단')],
 dwarf:[look('marna','female','마르나'),look('bron','male','브론')],
 titan:[look('vera','female','베라'),look('taron','male','타론')],
 elf:[look('silen','female','실렌'),look('ael','male','아엘'),look('lien','female','리엔'),look('elion','male','엘리온')],
 spirit:[look('dew','neutral','이슬'),look('mist','neutral','안개')],
 centaur:[look('lana','female','라나'),look('kai','male','카이')],
 fae:[look('fia','female','피아'),look('eil','male','에일')]
};
export const genderLabel=gender=>({female:'여성',male:'남성',neutral:'정령'})[gender]||'';
export function residentLook(race,index=0,appearance){
 const list=RESIDENT_LOOKS[race];if(!list)return null;
 return list.find(v=>v.id===appearance)||list[((index%list.length)+list.length)%list.length];
}
export function assignResidentAppearance(worker,races,ordinal=Math.floor(worker.id/Math.max(1,races.length))){
 const list=RESIDENT_LOOKS[worker.race];if(!list)return worker;
 // ordinal counts earlier residents of the same race, so every house alternates women and men.
 const raceIndex=Math.max(0,races.indexOf(worker.race));
 const selected=residentLook(worker.race,ordinal+(raceIndex%2),worker.appearance);
 worker.appearance=selected.id;worker.gender=selected.gender;
 if(!worker.name)worker.name=selected.name+(ordinal>=list.length?' '+(Math.floor(ordinal/list.length)+1):'');
 return worker;
}
export function residentPortraitKey(worker){return 'resident-'+worker.race+'-'+(worker.appearance||residentLook(worker.race,worker.id)?.id||'');}
