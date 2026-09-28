export const BRAND={name:'타운그리드',latin:'TOWNGRID',world:'이르데아'};
export const RACES={
 human:{name:'인간',color:'#467eab',roof:'#b95432',wall:'#f0dfba',trim:'#77573c',characters:['Worker_Male','Worker_Female','Chef_Female','Knight_Male'],style:'목조 골조 · 기와지붕'},
 elf:{name:'엘프',color:'#4c9879',roof:'#4b8a69',wall:'#e6ebca',trim:'#bba668',characters:['Elf','Witch'],style:'첨탑 · 잎사귀 지붕'},
 dwarf:{name:'드워프',color:'#be914c',roof:'#637786',wall:'#bdad91',trim:'#d99d49',characters:['Viking_Male','Viking_Female'],style:'석조 벽체 · 구리 장식'},
 demon:{name:'마인',color:'#9968aa',roof:'#694989',wall:'#a99bb5',trim:'#db7a94',characters:['Demon','Bat','Wizard'],style:'흑석 첨탑 · 마력 수정'},
 orc:{name:'오크',color:'#9a684d',roof:'#8a503a',wall:'#b7a377',trim:'#684639',characters:['Goblin_Male','Goblin_Female'],style:'통나무 요새 · 뿔 장식'},
 beast:{name:'수인족',color:'#c09254',roof:'#cca25a',wall:'#e1ca96',trim:'#a57442',characters:['Wolf','Fox','Cowboy_Female'],style:'초가 · 둥근 목조 기둥'}
};
export const NATIONS={
 estern:{name:'에스테른 왕국',race:'human',region:'river',fief:'로덴 백작령',capital:'하벤',color:'#73969d',point:[447,370],policy:'교역 헌장',effect:'판매 수익 +8% · 일일 세금 12G',sale:1.08,tax:12,production:{},lore:'발테론 제국의 조공국. 영주에게 빌린 강변 땅에서 시작합니다.'},
 silvaen:{name:'실바엔 수림왕국',race:'elf',region:'river',fief:'은잎 변경령',capital:'엘레실',color:'#5f9679',point:[254,226],policy:'성림 보호령',effect:'목재 가공 +12% · 일일 세금 9G',sale:1,tax:9,production:{sawmill:1.12},lore:'제국에 성목을 바치는 숲의 왕국. 자작의 숲 가장자리를 임차합니다.'},
 kardum:{name:'카르둠 산악왕국',race:'dwarf',region:'highland',fief:'청동 망치령',capital:'카르홀',color:'#b2986a',point:[494,175],policy:'장인 길드 협약',effect:'기계 제작 +12% · 일일 세금 14G',sale:1,tax:14,production:{workshop:1.12},lore:'광맥을 담보로 제국에 예속된 왕국. 갱도 밖의 빈 땅이 첫 터전입니다.'},
 nezar:{name:'네자르 마도왕국',race:'demon',region:'highland',fief:'흑요 남작령',capital:'네자르',color:'#947794',point:[739,225],policy:'마력 이용 허가',effect:'동력 생산 +15% · 일일 세금 16G',sale:1,tax:16,production:{generator:1.15},lore:'제국의 봉인 아래 놓인 마도왕국. 국경의 폐허를 개간해야 합니다.'},
 urkan:{name:'우르칸 부족왕국',race:'orc',region:'highland',fief:'붉은 이빨령',capital:'우르크',color:'#ac7b59',point:[692,422],policy:'변경 건설 조약',effect:'건설비 −8% · 일일 세금 11G',sale:1,tax:11,build:.92,production:{},lore:'제국의 군역을 지는 부족들. 족장이 배정한 황무지에서 시작합니다.'},
 lumea:{name:'루메아 연안왕국',race:'beast',region:'coast',fief:'금빛 꼬리령',capital:'루멘',color:'#c0a46c',point:[315,518],policy:'연안 교역 특허',effect:'생선 판매 +15% · 일일 세금 10G',sale:1,fishSale:1.15,tax:10,production:{},lore:'제국에 항만세를 내는 해양 왕국. 작은 해안 영지에 정착합니다.'}
};
export const RESIDENT_NAMES={human:['에단','미라','로웬','하나'],elf:['아엘','실렌','리엔','페이'],dwarf:['브론','헤르다','두린','마르나'],demon:['아스라','네브','키라','제온'],orc:['그룩','아르카','모그','우샤'],beast:['루','타비','나로','세라']};

// Every culture shares the entire industrial tree. Specialties are optional operating choices.
Object.assign(RACES,{
 goblin:{name:'고블린',color:'#769443',roof:'#759b62',wall:'#e4d8ac',trim:'#96703b',characters:['Goblin_Male','Goblin_Female'],style:'모듈 골조 · 재활용 금속'},
 dragon:{name:'용인족',color:'#c36e51',roof:'#883f37',wall:'#d6b397',trim:'#cd9653',characters:['Dragon'],style:'내열 석재 · 청동 비늘'},
 aquatic:{name:'수생족',color:'#49a8b2',roof:'#478f9c',wall:'#d4e9df',trim:'#678c95',characters:['MantaRay','Elf'],style:'유선형 지붕 · 수로'},
 fae:{name:'요정족',color:'#b481be',roof:'#8c6ca7',wall:'#ece0df',trim:'#c3ad73',characters:['Elf','Witch'],style:'수정 창 · 정밀 장식'}
});
export const SPECIALTIES={
 human:{name:'유연한 조직',text:'특화 시설의 개선 비용 20% 감소'},
 elf:{name:'재료 회수',text:'특화 시설에서 4회 생산마다 주원료 1개 회수'},
 dwarf:{name:'내구 설계',text:'특화 시설은 재난 피해를 한 번 견딤 · 수리비 25G'},
 demon:{name:'출력 제어',text:'특화 전력 시설·전력 소비 시설의 작업 속도 +12%'},
 orc:{name:'연속 공정',text:'3개 이상 묶음 생산하는 특화 시설의 작업 속도 +12%'},
 beast:{name:'현장 대응',text:'수인 운반자의 이동 속도 +12% · 특화 시설 작업 +5%'},
 goblin:{name:'모듈 조립',text:'특화 시설 작업 +7% · 철거 시 건설비 65% 회수'},
 dragon:{name:'내열 작업',text:'특화 제련·정유·발전·화학 시설의 작업 속도 +15%'},
 aquatic:{name:'유체 제어',text:'물을 투입하는 특화 시설·우물·어항의 작업 속도 +12%'},
 fae:{name:'미세 조립',text:'1~2개 단위로 생산하는 특화 시설의 작업 속도 +12%'}
};
Object.assign(RACES,{
 titan:{...RACES.human,name:'티탄',color:'#bd9064',wall:'#c9c6b8',trim:'#9e794a',characters:['StoneTitan'],style:'거석 기둥 · 대형 기어'},
 spirit:{...RACES.elf,name:'정령',color:'#7cced0',roof:'#81aea1',characters:['Ghost'],style:'빛나는 수정 · 순환 수로'},
 centaur:{...RACES.elf,name:'켄타로스',color:'#ba8a60',roof:'#8d9a5d',characters:['Worker_Male','Elf'],style:'넓은 출입구 · 목조 골조'}
});
// Who may work where. A specialist race is the only crew for its workshops while it belongs to the faction;
// haulers carry double loads but cannot run the high-intelligence facilities (buildings marked skilled).
Object.assign(RACES.dwarf,{crafts:['workshop','smelter','steamworks','mithrilforge','blastfurnace'],role:'기계 공장·제철소·증기 기계공장·미스릴 정련소·용광로 전담'});
// Spirits and fae are one crew (the elf-side dwarves): they share one house and one set of workshops.
Object.assign(RACES.spirit,{crafts:['manaextractor','magetower','arcanepower','electronics','laboratory','lampworks','engineworks'],role:'요정 포함 · 마력 추출소·마탑·마력 발전소·전자 공장·제약 공장·마력등 공방·마력 기관 공장 전담'});
Object.assign(RACES.fae,{kin:'spirit',role:'정령으로 묶임 · 마력 추출소·마탑·마력 발전소·전자 공장·제약 공장·마력등 공방·마력 기관 공장 전담'});
export const crewOf=race=>RACES[race]?.kin||race;
Object.assign(RACES.titan,{hauler:true,role:'짐 두 배 · 고지능 작업장 출입 불가'});
Object.assign(RACES.centaur,{hauler:true,role:'짐 두 배 · 빠른 이동 · 고지능 작업장 출입 불가'});
Object.assign(RACES.human,{role:'어느 시설이든 운반하는 기본 주민'});
Object.assign(RACES.elf,{role:'어느 시설이든 운반하는 기본 주민'});
Object.assign(SPECIALTIES,{titan:{name:'중량 공정',text:'3개 이상 묶음 생산하는 특화 시설의 작업 속도 +12%'},spirit:{name:'마력 공명',text:'특화 발전·마법·전자 시설의 작업 속도 +12%'},centaur:{name:'기동 운반',text:'켄타로스 운반자의 이동 속도 +15% · 특화 시설 작업 +5%'}});
export const FACTIONS={human:{name:'인족',playable:true,members:['human','dwarf','titan'],trait:'공학과 내구성',text:'유연한 생산 전환 · 튼튼한 설비 · 중량 공정'},elf:{name:'엘프족',playable:true,members:['elf','spirit','centaur','fae'],trait:'정밀 제어와 마력 순환',text:'재료 회수 · 마력 공명 · 빠른 운반 · 미세 조립'},demon:{name:'마족',playable:false,members:['demon'],trait:'마력 교란',text:'악마·마인·마괴물이 마력망과 발전 시설을 공격합니다.'},orc:{name:'오크족',playable:false,members:['orc','goblin'],trait:'대규모 약탈',text:'오크·고블린·마물이 생산 시설과 창고를 습격합니다.'},beast:{name:'수인족',playable:false,members:['beast','dragon','aquatic'],trait:'기동 습격',text:'동물계 수인·용인·수생족이 운송로를 기습합니다.'}};
export const factionOf=race=>Object.keys(FACTIONS).find(id=>FACTIONS[id].members.includes(race))||'human';
export const playableRace=race=>!!RACES[race]&&FACTIONS[factionOf(race)].playable;
export const PROGRESSION_OFFSET=5;
for(const [id,r]of Object.entries(RACES)){r.specialty=SPECIALTIES[id];if(!RESIDENT_NAMES[id])RESIDENT_NAMES[id]=({goblin:['피즈','루카','비트','니모'],dragon:['카엘','레나','바르','세린'],aquatic:['네리','마린','리오','세아'],fae:['피아','에일','미엘','루네'],titan:['타론','베라','오린','헤라'],spirit:['이슬','아린','루아','미르'],centaur:['카이','라나','테론','키라']})[id];}
export const CONTINENTS=[{id:'irdea',name:'이르데아 대륙'}];
export const ATLAS_REGIONS=[{id:'west',name:'서부 유역',view:'45 115 535 560'},{id:'north',name:'북부 산맥',view:'255 0 740 410'},{id:'east',name:'동부 평원',view:'780 100 505 545'},{id:'south',name:'남부 연안',view:'350 380 740 395'}];
export const MAINLAND='M88 273L124 231 109 187 163 139 222 132 244 92 308 111 369 69 438 82 487 40 548 59 591 36 636 68 708 48 747 89 812 67 853 96 927 90 956 135 1024 148 1054 186 1132 202 1168 241 1221 257 1234 309 1202 340 1242 389 1208 429 1222 484 1174 513 1146 565 1082 588 1052 636 1001 645 974 692 908 679 855 720 794 704 742 744 682 724 630 754 574 724 524 737 483 700 413 708 394 674 323 682 308 629 240 613 215 567 159 548 149 505 109 482 122 437 79 407 98 363 61 327Z';
export const INLAND_SEA='M606 227C632 211 684 220 701 248L748 266 770 305 753 343 784 369 773 410 793 448 772 491 731 516 707 553 665 541 649 505 603 490 617 446 587 414 603 377 578 341 602 309 586 269Z';
export const GREAT_RIVERS=[{name:'은결강',path:'M270 138Q316 193 290 250T352 350Q386 394 448 400T599 421',label:[384,373]},{name:'하르덴강',path:'M615 61Q571 118 644 159T652 228',label:[552,156]},{name:'벨루강',path:'M767 327Q856 308 901 349T1071 369Q1161 377 1217 399',label:[1017,343]},{name:'루멘강',path:'M699 546Q721 595 677 627T688 731',label:[731,638]}];
const nationRows=[
 ['estern','에스테른 왕국','human','river','royal'],['silvaen','실바엔 수림왕국','elf','river','green'],['kardum','카르둠 산악왕국','dwarf','highland','industrial'],['nezar','네자르 마도왕국','demon','highland','energy'],['urkan','우르칸 부족연맹','orc','highland','frontier'],['lumea','루메아 연안왕국','beast','coast','trade'],['fizden','피즈덴 공업공화국','goblin','river','industrial'],['karyon','카리온 용인왕국','dragon','highland','energy'],['neria','네리아 해양연합','aquatic','coast','trade'],['miel','미엘 수정공국','fae','river','research'],
 ['rivente','리벤트 연방','human','coast','trade'],['arsel','아르셀 공업연방','elf','highland','industrial'],['broden','브로덴 철도연방','dwarf','river','frontier'],['vesra','베스라 연구공화국','demon','river','research'],['morgal','모르갈 노동공화국','orc','coast','industrial'],['tavira','타비라 자유도시연합','beast','river','trade'],['griv','그리브 상업연맹','goblin','coast','royal'],['serkan','세르칸 에너지공화국','dragon','highland','energy'],['pelara','펠라라 수로왕국','aquatic','river','green'],['elune','엘루네 기술공화국','fae','highland','research'],
 ['harren','하렌 농업공화국','human','river','green'],['neiren','네이렌 해양공화국','elf','coast','trade'],['torvik','토르비크 기업국','dwarf','highland','royal'],['zail','자일 상업도시국가','demon','coast','trade'],['orbel','오르벨 산업왕국','orc','river','frontier'],['savera','사베라 산악연방','beast','highland','green'],['nubrik','누브릭 기술국','goblin','highland','research'],['arvonn','아르본 항만연방','dragon','coast','frontier'],['thalia','탈리아 조류공화국','aquatic','coast','energy'],['sylune','실루네 자치왕국','fae','river','green']
];
const policies={royal:{name:'국가 납품 헌장',effect:'판매 수익 +8% · 세금 12G',sale:1.08,tax:12},green:{name:'자원 순환 협약',effect:'목재 가공 +12% · 세금 9G',tax:9,production:{sawmill:1.12}},industrial:{name:'산업 투자 협약',effect:'부품·제련 작업 +12% · 세금 14G',tax:14,production:{workshop:1.12,smelter:1.12}},energy:{name:'에너지 이용 허가',effect:'발전·정유 작업 +15% · 세금 16G',tax:16,production:{generator:1.15,refinery:1.15,arcanepower:1.15}},frontier:{name:'지역 개발 특허',effect:'건설비 −8% · 세금 11G',build:.92,tax:11},trade:{name:'자유항 교역 협약',effect:'판매 수익 +5% · 세금 10G',sale:1.05,tax:10},research:{name:'기술 연구 협약',effect:'회로·의약품 작업 +12% · 세금 13G',tax:13,production:{electronics:1.12,laboratory:1.12}}};
export const ATLAS_POINTS=[[389,315],[228,217],[467,151],[848,207],[942,439],[865,613],[1108,461],[1039,230],[1037,564],[422,475],[266,503],[512,267],[503,614],[849,388],[1105,316],[378,592],[1158,396],[738,133],[864,501],[495,387],[202,341],[575,665],[359,186],[997,335],[975,527],[939,172],[724,646],[566,549],[823,681],[324,418]];
export const ATLAS_LAYOUTS=[ATLAS_POINTS];
for(let i=0;i<nationRows.length;i++){
 const [id,name,race,region,policy]=nationRows[i],old=NATIONS[id]||{},c=Math.floor(i/10),p=policies[policy];
 const overlord=['발테론 제국','카르제온 연방','아스테라 패권국'][c],point=ATLAS_POINTS[i];
 NATIONS[id]={faction:factionOf(race),playable:playableRace(race),sovereign:['아우렐 독립왕국','네레이드 독립연방','솔름 독립공국'][c],capitalDomain:(old.capital||name.split(' ')[0])+' 수도직할령',manor:(old.fief||name.split(' ')[0])+' 개척장',dependency:'종속 공국',sale:1,production:{},...old,...p,id,name,race,region,continent:'irdea',overlord,policy:p.name,effect:p.effect,color:RACES[race].color,point,subregion:point[1]<240?'north':point[1]>550?'south':point[0]<600?'west':'east',fief:old.fief||name.split(' ')[0]+' 자치주',district:old.capital?old.capital+' 개발구':name.split(' ')[0]+' 산업구',capital:old.capital||name.split(' ')[0],lore:overlord+'의 통제를 받는 종속국. 지방 개발구의 빈 땅을 임차해 사업을 시작합니다.',population:{[race]:65,human:race==='human'?65:20,other:15}};
}
// Rank table from the 2026-09-28 balance patch: each rank asks for the output of the facility the previous rank opened.
// The quarry is in no unlock list, so it is a starting facility. Length 33 is part of the save format.
export const RANKS=[
 ['농노',0,[],[]],
 ['등록 농노',35,[['produced:water',12,'물 생산'],['produced:grain',12,'밀 생산']],['sawmill']],
 ['개간 농노',60,[['produced:plank',12,'판재 생산'],['contracts',2,'영주 납품']],['mill','smokehouse']],
 ['계약 농노',100,[['produced:flour',12,'밀가루 생산'],['expansions',1,'개간지 확장']],['bakery','cottonfield']],
 ['준자유민',160,[['sold:bread',10,'빵 판매'],['debtFree',1,'몸값 채무 청산']],['herbgarden','clinic']],
 ['임차 사업주',250,[['family',1,'가족 구출'],['produced:herb',8,'약초 생산']],['weaver','depot']],
 ['등록 사업주',300,[['produced:cloth',8,'직물 생산'],['revenue',2400,'누적 판매 수입']],['henhouse','marketplace']],
 ['지역 공급자',350,[['produced:egg',20,'달걀 생산'],['contracts',4,'납품 계약']],['confectionery','reservoir']],
 ['제조 허가업자',400,[['produced:cake',10,'케이크 생산'],['contracts',6,'납품 계약']],['kiln','stable']],
 ['지역 납품업자',500,[['produced:brick',20,'벽돌 생산'],['revenue',6000,'교역 수입']],['tailor','glassworks']],
 ['공인 계약업자',600,[['produced:workwear',8,'작업복 생산'],['produced:glass',8,'유리 생산'],['contracts',8,'납품 계약']],['watermill','dwarfhouse','spirithouse']],
 ['개척 사업자',700,[['expansions',2,'부지 확장'],['produced:plank',120,'판재 생산']],['generator','workshop']],
 ['동력 제조업자',850,[['power',1,'동력 가동'],['produced:gear',8,'부품 생산']],['windturbine','logistics']],
 ['법인 대표',1000,[['automatic',1,'자동 물류 가동'],['revenue',20000,'교역 수입']],['ironmine','coalpit','titanhouse','centaurhouse']],
 ['중공업 사업자',1200,[['produced:iron',16,'철광석 생산'],['produced:coal',16,'석탄 생산'],['expansions',3,'부지 확장']],['smelter','steamworks','wardpost']],
 ['에너지 사업자',1450,[['produced:steel',18,'강철 생산'],['debtFree',1,'채무 청산']],['oilpump','refinery','coppermine']],
 ['산업단지 운영자',1700,[['produced:fuel',12,'연료 생산'],['produced:copper',16,'구리광석 생산'],['sites',2,'운영 거점']],['chemical','manaextractor','wiremill']],
 ['정밀 제조업자',2000,[['produced:polymer',18,'합성 소재 생산'],['produced:wire',12,'전선 생산'],['produced:mana',8,'마력 결정 생산']],['electronics','magetower','cementworks']],
 ['광역 투자자',2400,[['produced:circuit',12,'회로 생산'],['produced:concrete',12,'콘크리트 생산'],['deliveries',3,'지역 간 운송']],['station','rail','cannery']],
 ['자동차 제조사',2800,[['railRoutes',1,'철도 운송망'],['produced:canned',12,'통조림 생산']],['automotive']],
 ['기술 기업군',3300,[['produced:car',6,'자동차 생산'],['contracts',12,'납품 계약']],['laboratory','hospital']],
 ['기반시설 운영자',3800,[['produced:medicine',24,'의약품 생산'],['sites',3,'운영 거점']],['arcanepower','battery','leyrelay']],
 ['개발구 운영권자',4400,[['revenue',200000,'교역 수입'],['deliveries',12,'지역 간 운송']],['bank','barracks']],
 ['치안권 보유자',5000,[['defense',2,'경비대 편성'],['produced:medicine',60,'의약품 생산']],['fortress','lampworks']],
 ['재정 운영권자',5800,[['investment',2,'산업 투자'],['produced:lamp',24,'마력등 생산'],['contracts',16,'납품 계약']],['engineworks']],
 ['자치구 대표',6700,[['sites',4,'운영 거점'],['support',65,'주민 지지'],['produced:engine',10,'마력 기관 생산']],['mithrilforge']],
 ['자치정부 수장',7700,[['defense',4,'경비대 편성'],['railRoutes',2,'철도 운송망'],['produced:mithril',10,'미스릴 강 생산']],['parliament']],
 ['독립 선언국',8800,[['recognition',2,'외교 지지국'],['support',70,'주민 지지'],['building:parliament',1,'의사당 건립']],['shipyard']],
 ['승인 독립국',10000,[['recognition',4,'외교 지지국'],['produced:airship',3,'비공정 건조'],['deliveries',30,'지역 간 운송']],['airdock']],
 ['지역 강국',12500,[['sites',5,'운영 거점'],['investment',4,'산업 투자'],['building:fortress',2,'방위 요새'],['revenue',700000,'교역 수입']],['blastfurnace']],
 ['다지역 연방',15000,[['territories',3,'자치권 확보 지역'],['support',75,'주민 지지'],['produced:car',80,'자동차 생산']],['assemblyline']],
 ['열강',18000,[['sites',6,'운영 거점'],['recognition',6,'외교 지지국'],['produced:airship',10,'비공정 건조']],['exchange']],
 ['패권국',21000,[['territories',5,'자치권 확보 지역'],['revenue',1000000,'교역 수입'],['defense',10,'방위대 편성'],['produced:car',120,'자동차 생산']],[]]
].map(([name,fee,requirements,unlocks],id)=>({id,name,fee,requirements,unlocks}));
export const unlockRank=type=>RANKS.find(r=>r.unlocks.includes(type))?.id||0;
