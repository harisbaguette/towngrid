export const EXPANSION_GROUPS = {
 newfarm:['cottonfield','herbgarden','henhouse','smokehouse'],
 newcraft:['weaver','confectionery','kiln','tailor'],
 newmaterials:['glassworks','coppermine','wiremill','cementworks'],
 newadvanced:['cannery','lampworks','engineworks','mithrilforge'],
 newheavy:['shipyard','blastfurnace','assemblyline','watermill'],
 newcivic:['marketplace','wardpost','fortress','parliament'],
 newtransport:['airdock','exchange'],
 landterminals:['roadhub','pavedhub','snowmobile','railterminal'],
 smallports:['ferrydock','canaldock','streamdock','polarferry'],
 largeports:['riverport','lakeport','coastport','polarport'],
 airpower:['airport','airterminal','substation'],
};
export const EXPANSION_BUILDINGS=Object.values(EXPANSION_GROUPS).flat();
export const EXPANSION_GOODS=Object.fromEntries(['cotton','herb','egg','smokedfish','cloth','cake','brick','workwear','glass','copper','wire','concrete','canned','lamp','engine','mithril','airship'].map((id,i)=>[id,i]));
const tool=(name,frame,size,pos,motion='still',show='always',extra={})=>({name,frame,size,pos,motion,show,...extra});
const item=(name,frame,size,pos,motion='still',show='work')=>tool(name,frame,size,pos,motion,show,{atlas:'expansionGoods'});
const fire=pos=>tool('fire',2,.19,pos,'flicker','work');
const smoke=pos=>tool('steam',10,.20,pos,'steam','work');
const supply=pos=>tool('lamp',15,.11,pos,'still','supply');
const front=(left=[75,132],right=[118,132])=>[left,null,null,right];
const chimney=[[116,29],[85,30],[105,30],[73,29]];
export const EXPANSION_PROFILES={
 cottonfield:{parts:[],crop:'cottonGrowth',outputSize:.24},
 herbgarden:{parts:[],crop:'herbGrowth',outputSize:.25},
 henhouse:{parts:[tool('hen',0,.25,front([76,141],[117,141]),'peck','always',{atlas:'henPeck',flip:[false,false,false,true]})],outputSize:.25},
 smokehouse:{parts:[fire(front()),smoke(chimney)],outputSize:.26},
 weaver:{parts:[item('shuttle',17,.23,front([75,122],[117,122]),'feed')],outputSize:.24},
 confectionery:{parts:[fire(front()),smoke([[114,36],[81,36],[109,36],[76,36]])],outputSize:.25},
 kiln:{parts:[fire(front()),smoke([[116,24],[115,24],[84,24],[76,24]])],outputSize:.26},
 tailor:{parts:[item('needle',18,.22,front([84,122],[111,122]),'press','always')],outputSize:.25},
 glassworks:{parts:[fire(front()),smoke([[124,26],[132,47],[61,48],[58,27]])],outputSize:.24},
 coppermine:{parts:[tool('wheel',4,.25,[[89,71],[105,58],[100,58],[106,71]],'spin')],outputSize:.27},
 wiremill:{parts:[item('reel',10,.35,front([83,118],[106,118]),'spin','always')],outputSize:.25},
 cementworks:{parts:[tool('wheel',4,.28,[[143,112],[39,108],[151,112],[36,112]],'spin')],outputSize:.27},
 cannery:{parts:[tool('ram',3,.26,front([78,118],[115,118]),'press')],outputSize:.24},
 lampworks:{parts:[item('workpiece',13,.23,front([81,119],[114,119]),'still','input'),tool('spark',11,.16,front([81,109],[114,109]),'flicker','work')],outputSize:.25},
 engineworks:{parts:[tool('arm',6,.30,front([63,112],[122,112]),'arm'),item('engine',14,.25,front([84,134],[113,134]),'feed','input')],outputSize:.27},
 mithrilforge:{parts:[fire(front()),smoke([[110,30],[101,30],[91,30],[81,30]])],outputSize:.28},
 shipyard:{parts:[tool('airship',0,.60,[96,132],'still','input',{atlas:'cargoAirship',directional:true})],outputSize:.39,outputPos:[[96,155]],maxPiles:1},
 blastfurnace:{parts:[fire(front()),smoke([[129,25],[120,25],[59,25],[61,25]])],outputSize:.28},
 assemblyline:{parts:[tool('arm',6,.28,front([65,114],[70,114]),'arm'),tool('arm',6,.28,front([120,112],[124,112]),'arm')],outputSize:.40,outputPos:[[96,152]],maxPiles:1},
 watermill:{parts:[item('waterwheel',19,.51,[[149,117],[139,128],[51,128],[41,117]],'spin','always'),supply([96,151])]},
 marketplace:{parts:[]},
 wardpost:{parts:[tool('crystal',7,.26,[96,29],'float','supply'),supply([96,151])]},
 fortress:{parts:[tool('spark',11,.25,[96,59],'flicker','supply'),supply([96,151])]},
 parliament:{parts:[]},
 airdock:{parts:[tool('moored-airship',0,.65,[96,124],'still','supply',{atlas:'cargoAirship',directional:true}),supply([96,151])]},
 exchange:{parts:[]},
 ...Object.fromEntries(['roadhub','pavedhub','snowmobile','railterminal','ferrydock','canaldock','streamdock','polarferry','riverport','lakeport','coastport','polarport','airport','airterminal'].map(id=>[id,{parts:[]}])),
 airterminal:{parts:[tool('parked-plane',0,.46,[96,153],'still','always',{atlas:'cargoPlane',directional:true})]},
 substation:{parts:[tool('lamp',15,.12,[96,149],'still','grid')]},
};
