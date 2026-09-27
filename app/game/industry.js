export const MODERN_RESOURCES={
 iron:{name:'철광석',color:'#9e8575',price:14},coal:{name:'석탄',color:'#56636b',price:12},steel:{name:'강철',color:'#99b7c4',price:65},oil:{name:'원유',color:'#736176',price:18},fuel:{name:'연료',color:'#dfa947',price:46},polymer:{name:'합성 소재',color:'#d3b998',price:56},mana:{name:'마력 결정',color:'#b586dd',price:58},circuit:{name:'회로',color:'#6ab69a',price:160},car:{name:'자동차',color:'#ec9767',price:920},medicine:{name:'의약품',color:'#8fcebf',price:180}
};
export const MODERN_BUILDINGS={
 reservoir:{name:'급수탑',group:'farm',cost:180,materials:{wood:8,stone:6},period:12,inputs:{water:3},output:'irrigation',amount:1,description:'물 3개로 60초간 주변 두 칸의 밀밭에 관개합니다. 주민의 물 운반을 줄여줍니다.'},
 depot:{name:'자재 보관소',group:'base',cost:220,materials:{plank:6,stone:4},description:'각 자원의 보관 한도를 120개 늘립니다. 여러 곳 건설할 수 있습니다.'},
 windturbine:{name:'풍력 발전기',group:'energy',cost:330,materials:{plank:10,gear:2},period:24,output:'power',amount:1,description:'연료 없이 발전합니다. 주변 높은 건물이 바람을 가리면 느려집니다.'},
 magetower:{name:'마탑',group:'energy',cost:700,materials:{plank:8,steel:6,circuit:2},period:28,inputs:{mana:2,circuit:1},output:'ward',amount:1,description:'마력 결계가 습격 피해와 마족의 전력 교란을 막습니다. 마력 결정과 회로를 계속 공급하세요.'},
 steamworks:{name:'증기 기계공장',group:'industry',cost:560,materials:{steel:8,gear:4},period:21,inputs:{steel:1,coal:1,water:1},output:'gear',amount:4,description:'강철·석탄·물을 사용해 증기기관으로 기계 부품을 대량 가공합니다.'},
 leyrelay:{name:'마력 중계소',group:'transport',cost:880,materials:{steel:8,circuit:4},period:25,inputs:{mana:1},output:'transit',amount:1,power:true,description:'양쪽 거점에서 가동하면 트럭과 철도의 운송 시간이 20% 짧아집니다.'},
 ironmine:{name:'철광산',group:'industry',cost:270,materials:{plank:8,gear:2},period:16,output:'iron',amount:4,description:'타일의 광물량에 따라 철광석을 채굴합니다.'},
 coalpit:{name:'탄광',group:'industry',cost:250,materials:{plank:6,gear:2},period:17,inputs:{water:1},output:'coal',amount:4,description:'물을 공급해 석탄을 채굴합니다. 타일 광물량이 작업 속도에 영향을 줍니다.'},
 smelter:{name:'제철소',group:'industry',cost:480,materials:{stone:12,gear:4},period:23,inputs:{iron:3,coal:2},output:'steel',amount:3,power:true,description:'철광석과 석탄을 강철로 제련합니다.'},
 oilpump:{name:'유정',group:'energy',cost:420,materials:{gear:4,steel:4},period:19,output:'oil',amount:4,power:true,description:'타일의 지하 자원량에 따라 원유를 추출합니다.'},
 refinery:{name:'정유소',group:'energy',cost:560,materials:{steel:8,gear:4},period:22,inputs:{oil:3,water:1},output:'fuel',amount:4,power:true,description:'원유와 물을 받아 운송 연료를 생산합니다.'},
 chemical:{name:'화학 공장',group:'industry',cost:580,materials:{steel:8,gear:4},period:23,inputs:{oil:2,water:1},output:'polymer',amount:3,power:true,description:'원유를 가공해 자동차와 의약품에 쓰는 합성 소재를 생산합니다.'},
 manaextractor:{name:'마력 추출소',group:'energy',cost:440,materials:{stone:10,gear:4},period:21,inputs:{water:1},output:'mana',amount:2,description:'타일의 마력 농도에 따라 마력 결정을 추출합니다.'},
 electronics:{name:'전자 공장',group:'advanced',cost:760,materials:{steel:8,gear:6},period:26,inputs:{steel:1,mana:1},output:'circuit',amount:2,power:true,description:'강철과 마력 결정으로 전자·마력 제어 회로를 조립합니다.'},
 automotive:{name:'자동차 공장',group:'advanced',cost:1100,materials:{steel:12,gear:8,circuit:4},period:34,inputs:{steel:2,gear:2,circuit:1,polymer:2},output:'car',amount:1,power:true,description:'강철·기계 부품·회로·합성 소재를 공급해 자동차를 조립합니다. 모든 종족이 운영합니다.'},
 laboratory:{name:'제약 공장',group:'advanced',cost:860,materials:{steel:6,circuit:4},period:25,inputs:{water:2,mana:1,polymer:1},output:'medicine',amount:3,power:true,description:'물·마력 결정·합성 소재로 의약품을 제조합니다.'},
 hospital:{name:'종합 병원',group:'civic',cost:950,materials:{steel:8,circuit:4},period:30,inputs:{medicine:1,water:2},output:'health',amount:1,power:true,unique:true,description:'의약품을 공급하면 마력성 질병을 예방하고 주민 지지를 높입니다.'},
 arcanepower:{name:'마력 발전소',group:'energy',cost:1000,materials:{steel:10,circuit:4},period:18,inputs:{mana:1,water:1},output:'power',amount:1,description:'마력 결정으로 전력을 공급합니다. 모든 종족이 같은 발전 기술을 연구합니다.'},
 battery:{name:'축전 시설',group:'energy',cost:700,materials:{steel:6,circuit:4},unique:true,description:'정상 전력을 저장해 마력 폭풍 중에도 전력 공급을 유지합니다.'},
 station:{name:'화물역',group:'transport',cost:780,materials:{steel:12,gear:5},power:true,unique:true,description:'역 옆에 선로가 연결되면 거점 간 철도 화물 노선을 운영할 수 있습니다.'},
 rail:{name:'철도',group:'transport',cost:12,materials:{steel:1},description:'역에 연결하는 선로. 선로에서 운반자가 빠르게 이동합니다.'},
 bank:{name:'투자 사무소',group:'civic',cost:900,materials:{steel:6,gear:4},unique:true,description:'세계 지도에서 산업 투자에 출자하면 일일 배당을 받습니다.'},
 barracks:{name:'경비대 본부',group:'civic',cost:950,materials:{steel:10,gear:5},unique:true,description:'경비대를 편성해 습격을 방어하고 치안권·독립 조건을 준비합니다.'}
};

for(const id of ['logistics','smelter','refinery','chemical','electronics','automotive','laboratory','hospital','station'])if(MODERN_BUILDINGS[id])MODERN_BUILDINGS[id].road=true;
