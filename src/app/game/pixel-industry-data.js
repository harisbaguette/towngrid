// Authored four-view architecture, grouped only for the comparison page.
export const INDUSTRY_GROUPS = {
 food: ['quarry','mill','bakery','dock'],
 basic: ['stable','generator','workshop','logistics'],
 utilities: ['reservoir','depot','windturbine','steamworks'],
 mining: ['ironmine','coalpit','smelter','oilpump'],
 materials: ['refinery','chemical','manaextractor','electronics'],
 advanced: ['automotive','laboratory','hospital','arcanepower'],
 network: ['magetower','leyrelay','battery','station'],
 civic: ['clinic','bank','barracks','dwarfhouse'],
 homes: ['titanhouse','spirithouse','centaurhouse'],
};
export const INDUSTRY_BUILDINGS = Object.values(INDUSTRY_GROUPS).flat();
export const INDUSTRIAL_GOODS = {stone:0,flour:1,bread:2,fish:3,gear:4,iron:5,coal:6,steel:7,oil:8,fuel:9,polymer:10,mana:11,circuit:12,car:13,medicine:14};
export const INDUSTRIAL_TOOLS = {pick:0,sails:1,fire:2,ram:3,wheel:4,pump:5,arm:6,crystal:7,water:8,net:9,steam:10,spark:11,valve:12,fan:13,bubbles:14,lamp:15};

// Positions are in each packed 192px cell. The body is never moved to animate.
const tool = (name,size,pos,motion='still',show='always',extra={}) => ({name,frame:INDUSTRIAL_TOOLS[name],size,pos,motion,show,...extra});
const goods = (name,frame,size,pos,motion='still',show='work') => ({name,frame,size,pos,motion,show,atlas:'industrialGoods'});
const lamp = pos => tool('lamp',.11,pos,'still','supply');
const steam = pos => tool('steam',.20,pos,'steam','work');
export const INDUSTRY_PROFILES = {
 distillery:{parts:[steam([[97,32],[95,38],[100,44],[95,44]])],outputSize:.18,outputPos:[[84,153],[103,153],[122,144]]},
 quarry: {parts:[tool('pick',.34,[92,106],'strike')],outputPos:[[77,155],[96,165],[118,155]]},
 mill: {parts:[tool('sails',.70,[96,46],'spin')],outputSize:.23},
 bakery: {parts:[tool('fire',.20,[[65,133],[130,132],[131,133],[130,133]],'flicker','work'),steam([[112,31],[68,31],[119,31],[118,31]])]},
 dock: {parts:[tool('net',.31,[[145,126],[51,126],[130,124],[50,125]],'lift','always',{tether:[[145,100],[51,100],[130,100],[50,100]]})],outputSize:.26},
 stable: {parts:[lamp([[65,128],[129,128],[96,145],[129,128]])]},
 generator: {parts:[tool('wheel',.32,[[137,120],[74,120],[115,111],[63,122]],'spin'),tool('fire',.17,[[58,127],null,null,[137,128]],'flicker','work'),steam([[121,42],[133,42],[61,42],[72,37]]),lamp([96,151])]},
 workshop: {parts:[tool('ram',.34,[[95,115],[102,114],[95,114],[102,114]],'press')],outputSize:.24},
 logistics: {parts:[goods('parcel',15,.22,[96,148],'conveyor','work')]},
 reservoir: {parts:[tool('water',.20,[[133,138],[133,138],[133,138],[63,138]],'flow','supply'),lamp([96,149])]},
 depot: {parts:[]},
 windturbine: {parts:[tool('fan',.70,[96,43],'spin'),lamp([96,150])]},
 steamworks: {parts:[tool('ram',.30,[95,113],'press'),steam([[63,35],[115,35],[72,35],[124,35]])],outputSize:.25},
 ironmine: {parts:[tool('wheel',.24,[[120,60],[76,60],[90,54],[78,54]],'spin')],outputSize:.27},
 coalpit: {parts:[{...goods('lift-basket',6,.29,[[108,117],[85,117],null,[85,117]],'lift','work'),tether:[[108,68],[85,68],[96,68],[85,68]]}],outputSize:.27},
 smelter: {parts:[tool('fire',.22,[[74,130],[118,130],[118,130],null],'flicker','work'),steam([96,46])],outputSize:.28},
 oilpump: {parts:[tool('pump',.85,[96,76],'rock','always',{flip:[true,true,false,false]})],outputSize:.23},
 refinery: {parts:[tool('valve',.23,[[112,121],[79,121],[115,87],[141,136]],'spin'),steam([[73,44],[118,48],[86,40],[73,64]])],outputSize:.23},
 chemical: {parts:[tool('bubbles',.20,[[56,112],[133,110],[132,110],[62,114]],'bubble','work')],outputSize:.24},
 manaextractor: {parts:[tool('crystal',.33,[96,95],'float','work'),tool('spark',.29,[96,112],'flicker','work')],outputSize:.24},
 electronics: {parts:[tool('arm',.35,[[124,108],[73,108],[124,108],[73,108]],'arm'),goods('board',12,.18,[97,125],'feed','input')],outputSize:.23},
 automotive: {parts:[tool('arm',.36,[[69,112],[122,112],[69,112],[122,112]],'arm'),goods('assembly-car',13,.36,[101,135],'feed','input')],outputSize:.42,outputPos:[[96,156],[96,146],[96,136]],maxPiles:1},
 laboratory: {parts:[tool('bubbles',.19,[[68,116],[130,120],[68,114],[126,121]],'bubble','work')],outputSize:.24},
 hospital: {parts:[lamp([96,130])]},
 arcanepower: {parts:[tool('crystal',.38,[96,89],'float'),tool('spark',.37,[96,104],'flicker','supply'),lamp([96,148])]},
 magetower: {parts:[tool('crystal',.26,[[126,132],[126,132],null,[65,132]],'float','supply'),lamp([96,151])]},
 leyrelay: {parts:[tool('spark',.50,[96,88],'flicker','supply'),lamp([96,151])]},
 battery: {parts:[tool('lamp',.12,[[52,128],[89,128],[51,128],[51,128]],'still','charge',{threshold:0}),tool('lamp',.12,[[52,118],[89,118],[51,118],[51,118]],'still','charge',{threshold:30}),tool('lamp',.12,[[52,108],[89,108],[51,108],[51,108]],'still','charge',{threshold:60})]},
 station: {parts:[]},
 clinic: {parts:[tool('lamp',.11,[96,141],'still','care')]},
 bank: {parts:[]},barracks: {parts:[]},dwarfhouse: {parts:[]},titanhouse: {parts:[]},spirithouse: {parts:[]},centaurhouse: {parts:[]},
};
