import {RANKS} from './world.js';
export const MODERN_RESOURCES={
 iron:{name:'철광석',color:'#9e8575',price:14},coal:{name:'석탄',color:'#56636b',price:12},steel:{name:'강철',color:'#99b7c4',price:105},oil:{name:'원유',color:'#736176',price:18},fuel:{name:'연료',color:'#dfa947',price:75},polymer:{name:'합성 소재',color:'#d3b998',price:95},mana:{name:'마력 결정',color:'#b586dd',price:58},circuit:{name:'회로',color:'#6ab69a',price:355},car:{name:'자동차',color:'#ec9767',price:2200,final:true},medicine:{name:'의약품',color:'#8fcebf',price:350},
 // Balance patch 2026-09-28 (docs/BALANCE_PATCH_20260928.md). final = end product with no running consumer.
 cotton:{name:'목화',color:'#cbc3b1',price:13},herb:{name:'약초',color:'#78b46a',price:20},egg:{name:'달걀',color:'#dcb46a',price:25},smokedfish:{name:'훈제 생선',color:'#b9804f',price:51},cloth:{name:'직물',color:'#d9c9ec',price:79},cake:{name:'케이크',color:'#f0a7b8',price:200,final:true},brick:{name:'벽돌',color:'#b8583e',price:41},workwear:{name:'작업복',color:'#5f7fa8',price:235,final:true},glass:{name:'유리',color:'#a9dbe6',price:88},
 copper:{name:'구리광석',color:'#c07a4a',price:19},wire:{name:'구리 전선',color:'#d9964f',price:90},concrete:{name:'콘크리트',color:'#b7b3aa',price:105},canned:{name:'통조림',color:'#9aa9b3',price:185},lamp:{name:'마력등',color:'#f4d97a',price:400,final:true},engine:{name:'마력 기관',color:'#8c7ad8',price:1800},mithril:{name:'미스릴 강',color:'#c9e3f2',price:1260},airship:{name:'비공정',color:'#e3b04b',price:12000,final:true}
};
export const MODERN_BUILDINGS={
 reservoir:{name:'급수탑',group:'farm',cost:180,materials:{wood:8,stone:6},period:12,inputs:{water:3},output:'irrigation',amount:1,description:'물 3개로 주변 두 칸 작물의 물 요구량을 모두 채웁니다. 주민의 물 운반을 줄여줍니다.'},
 depot:{name:'자재 보관소',group:'base',cost:220,materials:{plank:6,stone:4},description:'각 자원의 보관 한도를 120개 늘립니다. 여러 곳 건설할 수 있습니다.'},
 windturbine:{name:'풍력 발전기',group:'energy',cost:330,materials:{plank:10,gear:2},period:24,output:'power',amount:1,description:'연료 없이 발전합니다. 주변 높은 건물이나 산이 바람을 가리면 느려집니다.'},
 magetower:{name:'마탑',group:'energy',cost:700,materials:{brick:6,steel:4,glass:2,circuit:2},period:28,inputs:{mana:2,circuit:1},output:'ward',amount:1,wardRadius:4.5,description:'마력 결정과 회로로 반경 4.5칸에 결계를 칩니다. 결계 안의 시설은 습격 피해를 받지 않고 들어온 습격자는 약해집니다. 결계가 유지되는 동안 마족의 전력 교란도 막습니다.'},
 steamworks:{name:'증기 기계공장',group:'industry',cost:560,materials:{steel:8,gear:4},period:21,inputs:{steel:1,coal:1,water:1},output:'gear',amount:4,description:'강철·석탄·물을 사용해 증기기관으로 기계 부품을 대량 가공합니다.'},
 leyrelay:{name:'마력 중계소',group:'transport',cost:880,materials:{steel:8,circuit:4},period:25,inputs:{mana:1},output:'transit',amount:1,transitFactor:0.8,power:true,description:'양쪽 거점에서 가동하면 트럭과 철도의 운송 시간이 20% 짧아집니다.'},
 ironmine:{name:'철광산',group:'industry',cost:380,materials:{plank:8,gear:2},period:16,output:'iron',amount:4,description:'타일의 광물량에 따라 철광석을 채굴합니다. 물가에 붙이면 침수로 30% 느려집니다.'},
 coalpit:{name:'탄광',group:'industry',cost:330,materials:{plank:6,gear:2},period:17,inputs:{water:1},output:'coal',amount:4,description:'물을 공급해 석탄을 채굴합니다. 타일 광물량이 작업 속도에 영향을 주고, 물가에 붙이면 침수로 30% 느려집니다.'},
 smelter:{name:'제철소',group:'industry',cost:900,materials:{stone:12,gear:4},period:23,inputs:{iron:3,coal:2},output:'steel',amount:3,power:true,description:'철광석과 석탄을 강철로 제련합니다.'},
 oilpump:{name:'유정',group:'energy',cost:420,materials:{gear:4,steel:4},period:19,output:'oil',amount:4,power:true,description:'타일의 원유 농도에 따라 원유를 추출합니다.'},
 refinery:{name:'정유소',group:'energy',cost:1000,materials:{steel:8,gear:4},period:22,inputs:{oil:3,water:1},output:'fuel',amount:4,power:true,description:'원유와 물을 받아 운송 연료를 생산합니다.'},
 chemical:{name:'화학 공장',group:'industry',cost:1000,materials:{steel:8,gear:4},period:23,inputs:{oil:2,water:1},output:'polymer',amount:3,power:true,description:'원유를 가공해 자동차와 의약품에 쓰는 합성 소재를 생산합니다.'},
 manaextractor:{name:'마력 추출소',group:'energy',cost:620,materials:{stone:10,gear:4},period:21,inputs:{water:1},output:'mana',amount:2,description:'타일의 마력 농도에 따라 마력 결정을 추출합니다.'},
 electronics:{name:'전자 공장',group:'advanced',cost:1600,materials:{steel:6,glass:4,gear:4},period:26,inputs:{wire:2,mana:1},output:'circuit',amount:2,power:true,description:'구리 전선과 마력 결정으로 전자·마력 제어 회로를 조립합니다.'},
 automotive:{name:'자동차 공장',group:'advanced',cost:3000,materials:{steel:12,gear:8,circuit:4},period:34,inputs:{steel:2,gear:2,circuit:1,polymer:2,glass:1},output:'car',amount:1,power:true,description:'강철·기계 부품·회로·합성 소재·유리를 공급해 자동차를 조립합니다. 모든 종족이 운영합니다.'},
 laboratory:{name:'제약 공장',group:'advanced',cost:2000,materials:{steel:4,glass:4,circuit:3},period:30,inputs:{water:1,herb:2,polymer:1,glass:1},output:'medicine',amount:3,power:true,description:'물·약초·합성 소재·유리로 의약품을 제조합니다.'},
 hospital:{name:'종합 병원',group:'civic',cost:1800,materials:{concrete:6,glass:4,circuit:3},period:30,inputs:{medicine:1,water:2},output:'health',amount:1,power:true,unique:true,description:'의약품과 물을 공급받는 동안 감염을 빠르게 치료하고, 감염 중에도 거점 불만이 오르지 않게 막습니다. 질병 발생 자체는 막지 못합니다.'},
 arcanepower:{name:'마력 발전소',group:'energy',cost:1900,materials:{steel:8,wire:4,circuit:3},period:18,inputs:{mana:1,water:1},output:'power',amount:1,description:'마력 결정으로 전력을 공급합니다. 모든 종족이 같은 발전 기술을 연구합니다.'},
 battery:{name:'축전 시설',group:'energy',cost:1400,materials:{steel:6,wire:6,circuit:3},unique:true,description:'정상 전력을 저장해 마력 폭풍 중에도 전력 공급을 유지합니다.'},
 station:{name:'화물역',group:'transport',cost:1400,materials:{steel:8,concrete:6,gear:4},power:true,unique:true,description:'역 옆에 선로가 연결되면 거점 간 철도 화물 노선을 운영할 수 있습니다.'},
 rail:{name:'철도',group:'transport',cost:12,materials:{steel:1},description:'역에 연결하는 선로. 선로에서 운반자가 빠르게 이동합니다.'},
 bank:{name:'투자 사무소',group:'civic',cost:1800,materials:{concrete:6,glass:3,gear:3},unique:true,description:'세계 지도에서 산업 투자에 출자하면 일일 배당을 받습니다.'},
 barracks:{name:'경비대 본부',group:'civic',cost:1900,materials:{concrete:8,steel:6,gear:3},unique:true,description:'경비대를 편성해 습격을 방어하고 치안권·독립 조건을 준비합니다.'},
 // Balance patch 2026-09-28: 19 production and 7 support facilities. Placeholder models until pixel art (models.js modern()).
 cottonfield:{name:'목화밭',group:'farm',cost:55,materials:{wood:3},period:9,inputs:{water:1},output:'cotton',amount:2,irrigable:true,waterNeed:4,description:'물을 받아 목화를 기릅니다. 물 요구량 4 · 주변 물로 채우면 물 운반 없이 자랍니다.'},
 herbgarden:{name:'약초원',group:'farm',cost:70,materials:{wood:4},period:8,inputs:{water:1},output:'herb',amount:1,irrigable:true,waterNeed:3,description:'약초를 재배합니다. 물 요구량 3 · 주변 물로 채우면 물 운반 없이 자랍니다. 진료소 치료와 결계 초소, 제약 공장에 쓰입니다.'},
 henhouse:{name:'양계장',group:'farm',cost:120,materials:{plank:4,stone:2},period:11,inputs:{grain:1,water:1},output:'egg',amount:2,description:'밀과 물을 먹여 달걀을 얻습니다. 오염에 약합니다.'},
 smokehouse:{name:'훈제장',group:'craft',cost:130,materials:{wood:6,stone:3},period:10,inputs:{fish:2,wood:1},output:'smokedfish',amount:2,description:'생선을 장작 연기로 훈제해 오래 두는 식품으로 만듭니다.'},
 weaver:{name:'방직소',group:'craft',cost:160,materials:{plank:4,stone:2},period:12,inputs:{cotton:3},output:'cloth',amount:2,description:'목화에서 실을 뽑아 직물을 짭니다.'},
 confectionery:{name:'제과점',group:'craft',cost:260,materials:{plank:5,stone:4},period:16,inputs:{flour:2,egg:2},output:'cake',amount:2,description:'밀가루와 달걀로 케이크를 굽습니다. 초반 최고가 식품입니다.'},
 kiln:{name:'벽돌 가마',group:'craft',cost:200,materials:{stone:8,wood:4},period:12,inputs:{stone:2,wood:1},output:'brick',amount:3,description:'석재를 구워 벽돌을 만듭니다. 3단계 개선과 중급 시설 건설에 쓰입니다. 연기가 한 칸 퍼집니다.'},
 tailor:{name:'봉제소',group:'craft',cost:320,materials:{plank:6,brick:4},period:16,inputs:{cloth:3},output:'workwear',amount:2,description:'직물로 작업복을 짓습니다. 경비대 편성에도 쓰입니다.'},
 glassworks:{name:'유리 공방',group:'craft',cost:340,materials:{brick:6,plank:4},period:14,inputs:{stone:2,wood:2},output:'glass',amount:2,description:'석재를 장작 불로 녹여 유리를 만듭니다. 연기가 두 칸 퍼집니다.'},
 coppermine:{name:'구리 광산',group:'industry',cost:400,materials:{brick:6,gear:2},period:18,output:'copper',amount:3,description:'타일 광물량에 따라 구리광석을 캡니다. 물가에 붙이면 침수로 30% 느려집니다.'},
 wiremill:{name:'전선 공장',group:'industry',cost:1100,materials:{brick:6,steel:4,gear:2},period:20,inputs:{copper:2,coal:1},output:'wire',amount:3,power:true,road:true,description:'구리를 녹여 전선을 뽑습니다. 회로와 마력 기관에 쓰입니다.'},
 cementworks:{name:'시멘트 공장',group:'industry',cost:1200,materials:{brick:8,steel:4},period:24,inputs:{stone:3,coal:1,water:1},output:'concrete',amount:3,power:true,road:true,description:'석재와 석탄으로 콘크리트를 만듭니다. 후반 시설의 건설 자재입니다.'},
 cannery:{name:'통조림 공장',group:'industry',cost:1500,materials:{steel:6,glass:2,gear:2},period:22,inputs:{smokedfish:2,steel:1},output:'canned',amount:4,power:true,road:true,description:'훈제 생선을 강철 캔에 담습니다. 방위 요새와 경비대 편성의 보급품입니다.'},
 lampworks:{name:'마력등 공방',group:'advanced',cost:2600,materials:{steel:6,glass:6,concrete:4},period:29,inputs:{glass:1,wire:1,mana:1},output:'lamp',amount:2,power:true,road:true,description:'유리 등갓에 마력 결정과 전선을 넣어 마력등을 조립합니다.'},
 engineworks:{name:'마력 기관 공장',group:'advanced',cost:4200,materials:{steel:8,concrete:6,circuit:3},period:33,inputs:{gear:2,wire:2,mana:1},output:'engine',amount:1,power:true,road:true,description:'부품과 전선에 마력 결정을 넣어 비공정용 마력 기관을 만듭니다.'},
 mithrilforge:{name:'미스릴 정련소',group:'advanced',cost:4800,materials:{concrete:8,steel:8,circuit:2},period:32,inputs:{steel:2,mana:2},output:'mithril',amount:1,power:true,road:true,description:'강철에 마력을 녹여 가볍고 단단한 미스릴 강을 만듭니다. 열기가 두 칸 퍼집니다.'},
 shipyard:{name:'비공정 조선소',group:'advanced',cost:9000,materials:{concrete:12,mithril:4,circuit:4},period:60,inputs:{engine:2,mithril:2,cloth:4,fuel:2},output:'airship',amount:1,power:true,road:true,description:'마력 기관·미스릴 선체·직물 기낭을 조립해 비공정을 띄웁니다.'},
 blastfurnace:{name:'용광로',group:'industry',cost:3500,materials:{concrete:8,steel:6},period:36,inputs:{iron:5,coal:2},output:'steel',amount:6,power:true,road:true,description:'대형 고로에서 강철을 한 번에 여섯 개씩 뽑아 냅니다. 오염이 세 칸 퍼집니다.'},
 assemblyline:{name:'자동 조립 공장',group:'advanced',cost:9500,materials:{concrete:12,steel:10,circuit:6},period:45,inputs:{steel:3,gear:3,circuit:2,polymer:3,glass:2},output:'car',amount:2,power:true,road:true,description:'컨베이어 조립 라인으로 자동차를 두 대씩 생산합니다. 같은 자동차를 더 적은 부품으로 만듭니다.'},
 watermill:{name:'물레방아',group:'energy',cost:300,materials:{plank:8,stone:6},period:30,output:'power',amount:1,nearWater:2,description:'강이나 호수에서 두 칸 이내에 지으면 원료 없이 전력을 만듭니다.'},
 marketplace:{name:'장터',group:'civic',cost:350,materials:{plank:6,stone:6},unique:true,marketRecovery:1.3,description:'상인이 모여 판매 후 떨어진 시세가 30% 빨리 회복됩니다.'},
 wardpost:{name:'결계 초소',group:'civic',cost:450,materials:{brick:6,plank:4},period:30,inputs:{herb:2},output:'ward',amount:1,wardRadius:3,description:'약초를 태워 반경 3칸에 결계를 칩니다. 결계 안의 시설은 습격 피해를 받지 않고 들어온 습격자는 약해집니다. 결계가 유지되는 동안 마족의 전력 교란도 막습니다.'},
 fortress:{name:'방위 요새',group:'civic',cost:2500,materials:{concrete:10,steel:6},period:30,inputs:{canned:1,concrete:1},output:'ward',amount:1,wardRadius:5.5,description:'통조림과 콘크리트를 받으면 반경 5.5칸에 방어선을 칩니다. 방어선 안의 시설은 습격 피해를 받지 않고 들어온 습격자는 약해집니다. 방어선이 유지되는 동안 마족의 전력 교란도 막습니다.'},
 parliament:{name:'의사당',group:'civic',cost:6000,materials:{concrete:12,glass:6,lamp:4},unique:true,unrestRelief:2,description:'모든 거점의 불만이 매일 2씩 더 내려갑니다. 독립 선언의 조건입니다.'},
 airdock:{name:'비공정 선착장',group:'transport',cost:5000,materials:{concrete:8,steel:6,engine:2},period:30,inputs:{fuel:2},output:'transit',amount:1,transitFactor:0.6,unique:true,power:true,description:'양쪽 거점에 운송 가속 시설이 가동하면 트럭·철도 운송 시간이 40% 짧아집니다. 가동하는 동안 신생국 교역품을 비공정으로 실어 대금이 20% 오릅니다.'},
 exchange:{name:'대륙 거래소',group:'civic',cost:8000,materials:{concrete:10,glass:6,mithril:2},unique:true,exportCarts:2,description:'연료로 움직이는 트럭·증기선이 2대 늘어 동시에 최대 7대가 운송합니다.'}
};

// Expansion 2026-09-29 (docs/EXPANSION_20260929.md, balance: docs/BALANCE_PATCH_20260928.md 13). Optional chains:
// no promotion requirement asks for them. waterNeed is the water demand read by the tiered water rule (proximity.js);
// terrain marks a facility that reshapes its tile (pond, pasture, clover) and has no production of its own.
export const EXPANSION_RESOURCES={
 sugarcane:{name:'사탕수수',color:'#9cc25a',price:10},salt:{name:'소금',color:'#e6ecf1',price:14},grapered:{name:'붉은 포도',color:'#7d2c55',price:16},grapewhite:{name:'흰 포도',color:'#c9d967',price:17},cocoa:{name:'카카오',color:'#86533a',price:18},strawberry:{name:'딸기',color:'#e0434f',price:14},mint:{name:'박하',color:'#56cfa2',price:11},pumpkin:{name:'호박',color:'#e8842c',price:17},oakwood:{name:'참나무 원목',color:'#80603f',price:19},
 sugar:{name:'설탕',color:'#fbf6ea',price:34},winered:{name:'적포도주',color:'#9e2342',price:125,final:true},winewhite:{name:'백포도주',color:'#e8d98a',price:130,final:true},barrel:{name:'오크통',color:'#9a6a3a',price:85},chocolate:{name:'초콜릿',color:'#5b3423',price:80,final:true},jam:{name:'딸기잼',color:'#c7283f',price:72,final:true},candy:{name:'박하 사탕',color:'#9fe8cf',price:50,final:true},pie:{name:'호박 파이',color:'#d7913f',price:110,final:true},lantern:{name:'호박등',color:'#f2a93b',price:280,final:true},
 wool:{name:'양모',color:'#f1ece0',price:46},yarn:{name:'털실',color:'#c98bb7',price:78},milk:{name:'우유',color:'#f6f8fb',price:46},butter:{name:'버터',color:'#f4dc75',price:120,final:true},honey:{name:'꿀',color:'#e9aa1f',price:24},wax:{name:'밀랍',color:'#e8cf8a',price:30},feed:{name:'사료',color:'#a9a15a',price:17},duckegg:{name:'오리알',color:'#bcd9d3',price:44},
 clay:{name:'점토',color:'#b9785a',price:8},sand:{name:'모래',color:'#e2c98f',price:9},limestone:{name:'석회암',color:'#d8d3bf',price:16},chromium:{name:'크롬',color:'#8fa3b8',price:30},bluesteel:{name:'청강',color:'#4f7fb8',price:640,final:true},
 woodbox:{name:'나무 상자',color:'#b88a52',price:30},clothbox:{name:'천 상자',color:'#a88fc9',price:230},foodparcel:{name:'식량 소포',color:'#c79a5b',price:660,final:true},giftparcel:{name:'선물 소포',color:'#d9546c',price:1500,final:true}
};
const WATERED=n=>'물 요구량 '+n+' · 주변 물로 채우면 물 운반 없이 자랍니다.';
export const EXPANSION_BUILDINGS={
 sugarfield:{name:'사탕수수밭',group:'farm',cost:60,materials:{wood:3},period:14,inputs:{water:1},output:'sugarcane',amount:3,irrigable:true,waterNeed:8,description:'물 1개로 사탕수수 3개를 기릅니다. '+WATERED(8)+' 제분소에서 설탕으로 만듭니다.'},
 saltfield:{name:'소금밭',group:'farm',cost:55,materials:{wood:2,stone:2},period:12,inputs:{water:1},output:'salt',amount:2,waterNeed:3,description:'물 1개를 말려 소금 2개를 얻습니다. 물 요구량 3 · 바닷물도 쓰며 주변 물로 채우면 물을 나르지 않습니다. 바다 가까이에서는 소금기로 빨라집니다. 훈제장 소금 절임과 빵집 버터에 쓰입니다.'},
 vineyard:{name:'포도밭',group:'farm',cost:90,materials:{wood:4,plank:2},period:14,inputs:{water:1},output:'grapered',amount:2,irrigable:true,waterNeed:5,description:'물 1개로 붉은 포도 2개를 기릅니다. 흰 포도로 바꿔 기를 수 있습니다. '+WATERED(5)+' 포도는 와이너리에서 포도주가 됩니다.'},
 cocoafarm:{name:'카카오 농장',group:'farm',cost:140,materials:{plank:4,brick:2},period:15,inputs:{water:1},output:'cocoa',amount:2,irrigable:true,waterNeed:6,description:'물 1개로 카카오 2개를 기릅니다. '+WATERED(6)+' 초콜릿 공방의 원료입니다.'},
 berryfield:{name:'딸기밭',group:'farm',cost:65,materials:{wood:3},period:12,inputs:{water:1},output:'strawberry',amount:2,irrigable:true,waterNeed:4,description:'물 1개로 딸기 2개를 기릅니다. '+WATERED(4)+' 빵집에서 딸기잼을 만듭니다.'},
 mintfield:{name:'박하밭',group:'farm',cost:70,materials:{wood:3,plank:1},period:10,inputs:{water:1},output:'mint',amount:2,irrigable:true,waterNeed:3,description:'물 1개로 박하 2개를 기릅니다. '+WATERED(3)+' 제과점에서 박하 사탕을 만듭니다.'},
 pumpkinpatch:{name:'호박밭',group:'farm',cost:70,materials:{wood:4},period:15,inputs:{water:1},output:'pumpkin',amount:2,irrigable:true,waterNeed:5,description:'물 1개로 호박 2개를 기릅니다. '+WATERED(5)+' 빵집의 호박 파이와 벽돌 가마의 호박등에 쓰입니다.'},
 oakfarm:{name:'참나무 농장',group:'farm',cost:110,materials:{wood:6,plank:2},period:20,inputs:{water:1},output:'oakwood',amount:2,irrigable:true,waterNeed:7,description:'물 1개로 참나무 원목 2개를 키웁니다. '+WATERED(7)+' 제재소에서 오크통과 나무 상자를 만듭니다. 주변 나무를 베지 않습니다.'},
 winery:{name:'와이너리',group:'craft',cost:420,materials:{plank:8,brick:4,glass:2},period:28,inputs:{grapered:3,barrel:1},output:'winered',amount:2,description:'붉은 포도 3개와 오크통 1개로 적포도주 2병을 담급니다. 흰 포도를 넣는 백포도주로 바꿀 수 있습니다.'},
 chocolatier:{name:'초콜릿 공방',group:'craft',cost:480,materials:{plank:6,brick:4,glass:2},period:24,inputs:{cocoa:2,sugar:1},output:'chocolate',amount:2,description:'카카오 2개와 설탕 1개로 초콜릿 2개를 만듭니다.'},
 sheeppen:{name:'양 우리',group:'farm',cost:130,materials:{wood:6,plank:2},period:18,inputs:{feed:1,water:1},output:'wool',amount:2,waterNeed:3,description:'사료 1개와 물 1개를 먹여 양모 2개를 깎습니다. 물 요구량 3을 주변 물로 채우면 물을 나르지 않고, 목초지 옆에서 빨라집니다. 오염에 약합니다. 양모는 방직소에서 털실이 됩니다.'},
 milkbarn:{name:'젖소 우리',group:'farm',cost:170,materials:{plank:6,stone:4},period:18,inputs:{feed:1,water:1},output:'milk',amount:2,waterNeed:4,description:'사료 1개와 물 1개를 먹여 우유 2개를 짭니다. 물 요구량 4를 주변 물로 채우면 물을 나르지 않고, 목초지 옆에서 빨라집니다. 오염에 약합니다. 빵집에서 버터를 만듭니다.'},
 apiary:{name:'양봉장',group:'farm',cost:120,materials:{plank:4},period:10,output:'honey',amount:1,description:'두 칸 안에 야생 클로버가 있어야 원료 없이 꿀 1개를 모읍니다. 밀랍을 모으도록 바꿀 수 있습니다. 오염에 약합니다.'},
 duckhouse:{name:'오리 집',group:'farm',cost:140,materials:{plank:4,stone:2},period:17,inputs:{feed:1,water:1},output:'duckegg',amount:2,waterNeed:2,description:'사료 1개와 물 1개를 먹여 오리알 2개를 얻습니다. 물 요구량 2를 연못이나 강으로 채우면 물을 나르지 않습니다. 오염에 약합니다. 빵집의 호박 파이에 쓰입니다.'},
 feedmill:{name:'사료 공장',group:'farm',cost:150,materials:{wood:6,stone:4},period:10,inputs:{grain:2},output:'feed',amount:3,description:'밀 2개를 빻아 사료 3개를 만듭니다. 양 우리·젖소 우리·오리 집이 먹습니다.'},
 sandpit:{name:'모래 채굴장',group:'base',cost:130,materials:{wood:4,plank:2},period:10,output:'sand',amount:2,description:'모래 2개를 퍼 올립니다. 사막·해안의 모래 땅 위에서는 25% 빠르고, 물가에 붙이면 침수로 30% 느려집니다. 유리 공방의 모래 유리에 쓰입니다.'},
 clayfield:{name:'점토밭',group:'base',cost:90,materials:{wood:4},period:10,output:'clay',amount:2,nearWater:2,description:'강이나 바다에서 두 칸 이내에 지으면 점토 2개를 캡니다. 벽돌 가마가 석재 대신 점토로 벽돌을 굽습니다.'},
 packshop:{name:'포장 공방',group:'craft',cost:900,materials:{plank:10,brick:6,glass:2},period:24,inputs:{woodbox:1,honey:2,jam:1,bread:2},output:'foodparcel',amount:1,description:'나무 상자에 꿀 2·딸기잼 1·빵 2를 담아 식량 소포 1개를 꾸립니다. 천 상자에 케이크·적포도주·호박 파이를 담는 선물 소포로 바꿀 수 있습니다.'},
 solarpanel:{name:'태양광 패널',group:'energy',cost:1600,materials:{steel:4,glass:6,wire:4},period:30,output:'power',amount:1,description:'연료 없이 햇빛으로 전력을 만듭니다. 높은 건물이나 산의 그늘이 지면 한 단계마다 20% 느려집니다(최저 40%).'},
 pond:{name:'연못',group:'farm',cost:60,materials:{stone:2},terrain:'pond',description:'빈 땅 한 칸을 파서 담수 연못으로 바꿉니다. 맞닿은 칸에 물 2, 두 칸째에 물 1을 주어 작물과 가축의 물 요구량을 채웁니다. 광산 옆에 두면 광산이 침수됩니다. 철거하면 메워서 빈 땅으로 돌아가고 건설비의 40%를 돌려받습니다.'},
 pasture:{name:'목초지',group:'farm',cost:40,materials:{wood:2},terrain:'pasture',description:'빈 땅 한 칸에 풀을 심어 목초지로 바꿉니다. 맞닿은 양 우리·젖소 우리는 20%, 두 칸째는 10% 빨라집니다(합계 최대 40%). 철거하면 빈 땅으로 돌아가고 건설비의 40%를 돌려받습니다.'},
 clover:{name:'야생 클로버',group:'farm',cost:25,materials:{wood:1},terrain:'clover',description:'빈 땅 한 칸에 야생 클로버를 퍼뜨립니다. 두 칸 안의 양봉장은 클로버가 있어야 가동합니다. 철거하면 빈 땅으로 돌아가고 건설비의 40%를 돌려받습니다.'}
};
Object.assign(MODERN_RESOURCES,EXPANSION_RESOURCES);Object.assign(MODERN_BUILDINGS,EXPANSION_BUILDINGS);
// Unlock rank of each new facility: farms early to mid, the costly packing and power late (balance doc 13-3).
export const EXPANSION_RANKS={saltfield:2,sugarfield:3,berryfield:4,pumpkinpatch:5,pond:5,feedmill:6,pasture:6,sheeppen:7,milkbarn:7,duckhouse:8,clayfield:8,apiary:9,clover:9,mintfield:10,oakfarm:11,vineyard:12,winery:13,sandpit:14,cocoafarm:15,chocolatier:16,packshop:19,solarpanel:23};
for(const [type,rank] of Object.entries(EXPANSION_RANKS))RANKS[rank].unlocks.push(type);

// Second expansion 2026-09-30 (docs/EXPANSION_20260929.md 6, balance: docs/BALANCE_PATCH_20260928.md 17). The goods ride
// on alternative products of existing facilities; the old bread, cake, wine and fuel lines keep their inputs and prices.
export const EXPANSION2_RESOURCES={
 dough:{name:'빵 반죽',color:'#e9d3a6',price:34},baguette:{name:'바게트',color:'#c98a3f',price:78,final:true},batter:{name:'케이크 반죽',color:'#f3e2b8',price:90},
 fancycake:{name:'고급 케이크',color:'#e86f8f',price:360,final:true},decorcake:{name:'장식 케이크',color:'#8fd8c0',price:465,final:true},
 winebottle:{name:'와인병',color:'#3f7a5a',price:40},sangria:{name:'상그리아',color:'#c23a4a',price:180,final:true},honeycomb:{name:'벌집',color:'#f0b429',price:40},jetfuel:{name:'항공유',color:'#7fb6d9',price:160}
};
export const EXPANSION2_BUILDINGS={
 shallowmine:{name:'얕은 광산',group:'industry',cost:220,materials:{wood:6,plank:4},period:16,output:'iron',amount:2,description:'산이나 광맥이 없어도 어디서나 땅을 얕게 파 철광석 2개를 캡니다. 철광산의 절반 속도이며 타일 광물량과 산 지면의 영향을 받지 않습니다. 구리광석을 캐도록 바꿀 수 있고, 물가에 붙이면 침수로 30% 느려집니다.'},
 windpump:{name:'풍력 양수기',group:'farm',cost:240,materials:{plank:6,stone:4},period:40,output:'irrigation',amount:1,description:'바람으로 물을 길어 올려 {supply}초간 주변 두 칸 작물의 물 요구량을 모두 채웁니다. 급수탑과 달리 물과 전력이 필요 없습니다. 주변 높은 건물이나 산이 바람을 가리면 느려져 물이 끊기는 때가 생깁니다.'}
};
Object.assign(MODERN_RESOURCES,EXPANSION2_RESOURCES);Object.assign(MODERN_BUILDINGS,EXPANSION2_BUILDINGS);
export const EXPANSION2_RANKS={windpump:10,shallowmine:12};
for(const [type,rank] of Object.entries(EXPANSION2_RANKS))RANKS[rank].unlocks.push(type);

for(const id of ['logistics','smelter','refinery','chemical','electronics','automotive','laboratory','hospital','station'])if(MODERN_BUILDINGS[id])MODERN_BUILDINGS[id].road=true;
// Second balance pass 2026-09-28 (docs/BALANCE_PATCH_20260928.md 12-5): a facility may switch between products.
// simulation.js builds BUILDINGS[type].recipes = [its own inputs/output (the default), ...these]. Each
// alternative feeds another chain or trades volume for value; `unlock` is the rank that permits it.
export const ALT_RECIPES={
 quarry:[{id:'copper',name:'구리 광맥 선광',inputs:{water:1},output:'copper',amount:3,period:16,unlock:14}],
 bakery:[{id:'cake',name:'달걀 적은 케이크',inputs:{flour:3,egg:1},output:'cake',amount:2,period:18,unlock:7}],
 kiln:[{id:'glass',name:'가마 유리',inputs:{stone:3,wood:1},output:'glass',amount:2,period:20,unlock:9}],
 glassworks:[{id:'coalglass',name:'석탄 유리',inputs:{stone:2,coal:1},output:'glass',amount:3,period:20,unlock:13}],
 workshop:[{id:'steelgear',name:'강철 부품',inputs:{steel:1,plank:1},output:'gear',amount:3,period:15,unlock:14}],
 ironmine:[{id:'copper',name:'구리 광맥',inputs:{},output:'copper',amount:3,period:18,unlock:14}],
 smelter:[{id:'charcoalsteel',name:'목탄 제련',inputs:{iron:3,wood:4},output:'steel',amount:2,period:26,unlock:14}],
 steamworks:[{id:'wire',name:'증기 인발 전선',inputs:{copper:2,coal:1,water:1},output:'wire',amount:4,period:30,unlock:16}],
 refinery:[{id:'polymer',name:'무수 합성 소재',inputs:{oil:3},output:'polymer',amount:3,period:26,unlock:16}],
 chemical:[{id:'coalfuel',name:'석탄 액화',inputs:{coal:3,water:2},output:'fuel',amount:3,period:24,unlock:16}],
 cementworks:[{id:'brick',name:'대량 벽돌',inputs:{stone:3,coal:1},output:'brick',amount:5,period:20,unlock:17}],
 laboratory:[{id:'herbal',name:'약초 제제',inputs:{herb:3,water:1,glass:1},output:'medicine',amount:2,period:26,unlock:20}]
};
// Expansion 2026-09-29: the new chains run through existing facilities where the spec allows it (docs/EXPANSION_20260929.md 1).
export const EXPANSION_RECIPES={
 mill:[{id:'sugar',name:'설탕',inputs:{sugarcane:3},output:'sugar',amount:2,period:12,unlock:3}],
 smokehouse:[{id:'saltfish',name:'소금 절임',inputs:{fish:2,salt:1},output:'smokedfish',amount:3,period:12,unlock:2}],
 weaver:[{id:'yarn',name:'털실',inputs:{wool:2},output:'yarn',amount:2,period:12,unlock:7}],
 bakery:[{id:'jam',name:'딸기잼',inputs:{strawberry:3,sugar:1},output:'jam',amount:2,period:14,unlock:4},{id:'butter',name:'버터',inputs:{milk:3,salt:1},output:'butter',amount:2,period:13,unlock:7},{id:'pie',name:'호박 파이',inputs:{pumpkin:2,flour:1,duckegg:1},output:'pie',amount:2,period:16,unlock:8}],
 confectionery:[{id:'candy',name:'박하 사탕',inputs:{mint:2,sugar:1},output:'candy',amount:3,period:14,unlock:10}],
 kiln:[{id:'claybrick',name:'점토 벽돌',inputs:{clay:2,wood:1},output:'brick',amount:3,period:12,unlock:8},{id:'lantern',name:'호박등',inputs:{pumpkin:1,wax:1,yarn:1},output:'lantern',amount:1,period:18,unlock:12}],
 sawmill:[{id:'barrel',name:'오크통',inputs:{oakwood:2},output:'barrel',amount:1,period:14,unlock:11},{id:'woodbox',name:'나무 상자',inputs:{oakwood:2},output:'woodbox',amount:3,period:12,unlock:11}],
 vineyard:[{id:'grapewhite',name:'흰 포도',inputs:{water:1},output:'grapewhite',amount:2,period:14,unlock:12}],
 winery:[{id:'winewhite',name:'백포도주',inputs:{grapewhite:3,barrel:1},output:'winewhite',amount:2,period:28,unlock:13}],
 apiary:[{id:'wax',name:'밀랍',inputs:{},output:'wax',amount:1,period:14,unlock:9}],
 glassworks:[{id:'sandglass',name:'모래 유리',inputs:{sand:2,wood:1},output:'glass',amount:2,period:14,unlock:14}],
 quarry:[{id:'limestone',name:'석회암',inputs:{},output:'limestone',amount:2,period:12,unlock:15}],
 cementworks:[{id:'limeconcrete',name:'석회 콘크리트',inputs:{limestone:2,coal:1,water:1},output:'concrete',amount:3,period:22,unlock:17}],
 tailor:[{id:'clothbox',name:'천 상자',inputs:{woodbox:1,cloth:2,wax:1},output:'clothbox',amount:2,period:18,unlock:18}],
 ironmine:[{id:'chromium',name:'크롬 광맥',inputs:{},output:'chromium',amount:2,period:18,unlock:20}],
 packshop:[{id:'giftparcel',name:'선물 소포',inputs:{clothbox:1,cake:1,winered:1,pie:1},output:'giftparcel',amount:1,period:30,unlock:22}],
 smelter:[{id:'bluesteel',name:'청강',inputs:{steel:2,chromium:1},output:'bluesteel',amount:1,period:26,unlock:24}]
};
for(const [type,list] of Object.entries(EXPANSION_RECIPES))ALT_RECIPES[type]=[...(ALT_RECIPES[type]||[]),...list];
// Second expansion: every new intermediate has a consumer here (dough -> baguette, batter -> the two chocolate cakes,
// winebottle -> sangria, honeycomb -> honey mint candy, jetfuel -> the airship line).
export const EXPANSION2_RECIPES={
 bakery:[{id:'dough',name:'빵 반죽',inputs:{flour:2,water:1},output:'dough',amount:3,period:10,unlock:5},{id:'baguette',name:'바게트',inputs:{dough:2,wood:1},output:'baguette',amount:2,period:14,unlock:5},{id:'batter',name:'케이크 반죽',inputs:{flour:2,egg:1,sugar:1},output:'batter',amount:2,period:12,unlock:16}],
 chocolatier:[{id:'fancycake',name:'고급 케이크',inputs:{batter:1,chocolate:1,strawberry:2},output:'fancycake',amount:1,period:20,unlock:16},{id:'decorcake',name:'장식 케이크',inputs:{batter:1,chocolate:1,candy:2},output:'decorcake',amount:1,period:22,unlock:18}],
 glassworks:[{id:'winebottle',name:'와인병',inputs:{sand:3},output:'winebottle',amount:2,period:12,unlock:14}],
 winery:[{id:'sangria',name:'상그리아',inputs:{winered:1,strawberry:2,winebottle:1},output:'sangria',amount:2,period:18,unlock:15}],
 apiary:[{id:'honeycomb',name:'벌집',inputs:{},output:'honeycomb',amount:1,period:16,unlock:11}],
 confectionery:[{id:'honeycandy',name:'벌집 박하 사탕',inputs:{mint:2,honeycomb:1},output:'candy',amount:3,period:14,unlock:11}],
 refinery:[{id:'jetfuel',name:'항공유',inputs:{oil:3,water:1},output:'jetfuel',amount:2,period:24,unlock:26}],
 shipyard:[{id:'jetairship',name:'항공유 비공정',inputs:{engine:2,mithril:2,cloth:4,jetfuel:2},output:'airship',amount:1,period:48,unlock:27}],
 shallowmine:[{id:'copper',name:'얕은 구리 광맥',inputs:{},output:'copper',amount:2,period:24,unlock:12}]
};
for(const [type,list] of Object.entries(EXPANSION2_RECIPES))ALT_RECIPES[type]=[...(ALT_RECIPES[type]||[]),...list];
