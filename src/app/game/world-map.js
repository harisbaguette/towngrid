// The drawn world of Irdea: one big grid, one character per square. Each square is one 24×24 site
// map, and the square beside it decides what that side of the site map is (world-grid.js). The map is
// shaped for play, not copied from a globe. Waterways and impassable cells anchor saved sites.
// mixedLandcover distributes woodland, meadow and dry/cold pockets within that fixed topology.
//   ~ sea   ^ mountain   f forest   d desert   * ice   . plain
//   1–6 lakes   A B D E G rivers   K M N canals   a b c e g h j k streams   (WATERWAY_CHARS)
import {mixedLandcover} from './world-landcover.js';
const BASE_WORLD_MAP=[
 '^^^^**************~~~~~~~~~~~~~*************^^^^^^',
 '^^^^**************~~~~~~~~~~~~~****B********^*^^^^',
 '^^^^***************~~~~~~~~~~~*****B************^^',
 '^^^^****.***...*.f***~~~~~~~..*..*BB**..f**..**f^^',
 '^^^^...^...^............f......^..B....fff..f...^^',
 '^^^.^^^.....f..........f.....f..BBBN.....fff...^^^',
 '^^..^^^.e..................ff..fB..NN44..f^^^f..^^',
 '^^..^^^.e...33..f......f...f~~~BB...f44b..^^^...^^',
 '^^^.....e...33..f...f....f.~~~~~.......b..^^^...^^',
 '^^..ffffeff................~~~~~.......b.^.f....^^',
 '^^f.ffffefffa..............~~~~~.....f.b........^^',
 '^^^.f.f.eff.aff.......f...~~~~~....f..^^^^......^^',
 '^^...f.ffff.a..........~~~~~~~.........^^^......^^',
 '^^^f.ffffff.a.....~~~~.~~.~~~~....f....^^^.....^^^',
 '^^.AAAAA....a...~~~~~~~~...~~~....ff...........^^^',
 '^^.....AAAAAAAAA~~~~~~~~...~~~DDDDDDD...DDDDDDD.^^',
 '^^.....f.K....f.~~~~~~~~.f.~~~......DDDDD......^^^',
 '^^.......K...f..f.~~~~.~~.~~~~.....55...M..f...^^^',
 '^^.......K..f.ff.f.....~~~~~~~..........M....^^^^^',
 '^^^......K....f...g.......~~~~~.........M....^^.^^',
 '^^.GGGGG11.f...fffg........~~~~~........M....^^^^^',
 '^^..f.f.11hhh..f..gf.......~~~~~.ff..ff.66..f...^^',
 '^^.^^^.........22.g...f...f~~~~~..ffff..66c.f..^^^',
 '^^^^^^......ff.22.......k...~~~..ffffff...c....^^^',
 '^^f^^^.f...f.f......^^..k...E....f.f......c....^^^',
 '^^^f.....ffff.....f.^^..k..EE....fff.ff...c.~~..^^',
 '^^^....dd....dd.dd.d^^.dkd.E..d.f.d.dj...~~~~~~~~.',
 'dddddd^ddddddd^ddddddddddddEdddddddddjd.~~~~~~~~~~',
 'ddddddd^dddddd^ddddddddddddddd^ddddddjj~~~~....~~~',
 'dddddddddddddddddddd^dddddddddddddddddd~~~~....~~~',
 'ddddddddddddddddddddddddddddddddddddddd~~~~~~~~~~~'
];
export const WORLD_MAP=mixedLandcover(BASE_WORLD_MAP);
/** Waterways drawn on the map. A river, canal or stream is a chain of squares traced from `from`. */
export const WATERWAY_CHARS={
 A:{id:'river-eungyeol',kind:'river',name:'은결강',from:[3,14]},
 B:{id:'river-harden',kind:'river',name:'하르덴강',from:[35,1]},
 D:{id:'river-belu',kind:'river',name:'벨루강',from:[46,15]},
 E:{id:'river-lumen',kind:'river',name:'루멘강',from:[27,27]},
 G:{id:'river-ash',kind:'river',name:'잿물강',from:[3,20]},
 K:{id:'canal-royal',kind:'canal',name:'왕도 운하',from:[9,19]},
 M:{id:'canal-east',kind:'canal',name:'동부 운하',from:[40,20]},
 N:{id:'canal-broden',kind:'canal',name:'브로덴 운하',from:[36,6]},
 a:{id:'stream-willow',kind:'stream',name:'버들내',from:[12,10]},
 b:{id:'stream-obsidian',kind:'stream',name:'흑요내',from:[39,7]},
 c:{id:'stream-cloud',kind:'stream',name:'구름내',from:[42,25]},
 e:{id:'stream-silver',kind:'stream',name:'은빛내',from:[8,6]},
 g:{id:'stream-meadow',kind:'stream',name:'초원내',from:[18,19]},
 h:{id:'stream-mirror',kind:'stream',name:'거울내',from:[12,21]},
 j:{id:'stream-tide',kind:'stream',name:'갯내',from:[37,26]},
 k:{id:'stream-south',kind:'stream',name:'남내',from:[24,23]},
 1:{id:'lake-mirror',kind:'lake',name:'거울 호수'},
 2:{id:'lake-moon',kind:'lake',name:'달빛 호수'},
 3:{id:'lake-high',kind:'lake',name:'높은 호수'},
 4:{id:'lake-obsidian',kind:'lake',name:'흑요 호수'},
 5:{id:'lake-reed',kind:'lake',name:'갈대 호수'},
 6:{id:'lake-cloud',kind:'lake',name:'구름 호수'}
};
/** The three seas. `seed` is one of its squares; `lane` is the shipping lane, in squares. */
export const SEAS=[
 {id:'glass-lane',name:'유리 내해',port:'유리 내해 연안항',joins:'유리 내해 세 잎 항로',seed:[20,15],label:[25.5,11.6],
  lane:[[16.5,15],[20,14.2],[22.6,12.6],[27.6,11.4],[28.6,8.6],[30,9.8],[28.8,12.8],[28.6,16],[28.8,18.6],[29.6,21],[28.2,21.4],[27.2,18.6],[24,17.6],[20,16],[16.5,15]]},
 {id:'frost-lane',name:'서리만',port:'서리만 극지항',joins:'서리만 빙해 항로',seed:[24,1],label:[24.5,1.2],
  lane:[[18.6,.6],[21,2],[24.5,2.6],[28,2],[30.4,.6]]},
 {id:'coral-lane',name:'산호만',port:'산호만 연안항',joins:'산호만 난류 항로',seed:[42,27],label:[45,26.9],
  lane:[[39.4,28.4],[41.6,26.8],[45,26.6],[48.4,27.4],[48,30.4],[42,30.4],[39.4,28.4]]}
];
/** Small waterways (ferry routes) run inside a square, so they are lines, not squares. */
export const FERRIES=[
 {id:'ferry-stone',name:'돌 수로',line:[[8,6],[9,5],[10,4]]},
 {id:'ferry-willow',name:'버들 수로',line:[[24,9],[24,12]]},
 {id:'ferry-field',name:'들 수로',line:[[32,18],[29,18]]},
 {id:'ferry-rock',name:'바위 수로',line:[[38,14],[38,16]]},
 {id:'ferry-pine',name:'솔 수로',line:[[39,24],[39,26],[41,26]]}
];
/** Capital square of every nation, in world.js order. */
export const CAPITALS={
 estern:[14,14],silvaen:[6,13],kardum:[7,5],nezar:[4,2],urkan:[8,28],lumea:[18,2],fizden:[4,19],karyon:[4,25],neria:[24,15],miel:[10,19],
 rivente:[26,9],arsel:[42,9],broden:[33,4],vesra:[36,2],morgal:[30,2],tavira:[44,14],griv:[24,4],serkan:[47,9],pelara:[34,16],elune:[38,12],
 harren:[26,25],neiren:[32,20],torvik:[22,25],zail:[40,26],orbel:[28,27],savera:[44,19],nubrik:[15,28],arvonn:[46,25],thalia:[43,28],sylune:[39,22]
};
/** Names written on the map, in squares. */
export const MAP_LABELS=[
 {name:'서리 황야',at:[10,1],kind:'range'},{name:'잿빛 장벽',at:[1,16],kind:'range',vertical:true},{name:'용마루 산맥',at:[48.5,13],kind:'range',vertical:true},
 {name:'붉은 모래 사막',at:[20,29.4],kind:'range'},{name:'별빛 봉우리',at:[40.5,10.6],kind:'range'},{name:'은잎 숲',at:[7,9.6],kind:'range'}
];
export const MAP_COLS=WORLD_MAP[0].length,MAP_ROWS=WORLD_MAP.length;
