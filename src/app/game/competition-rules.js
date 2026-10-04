// Cash events and score events are separate. These schedules are versioned by the trial id.
export const SCORE_EVENTS=[
 {name:'제분 기술전',goods:{flour:3,bread:1.5}},
 {name:'직물 박람회',goods:{cloth:3,yarn:2,workwear:2}},
 {name:'건축 자재전',goods:{plank:2,brick:3,gear:2}},
 {name:'수확 가공전',goods:{jam:3,candy:3,winered:2}},
 {name:'금속 기술전',goods:{steel:3,copper:2,wire:2}},
 {name:'목축 품평회',goods:{wool:3,milk:2,butter:3}},
 {name:'해안 식품전',goods:{smokedfish:3,salt:2,canned:3}},
 {name:'첨단 산업전',goods:{circuit:3,car:3,airship:2}},
];
export const scoreEvent=day=>SCORE_EVENTS[Math.floor(Math.max(0,day-1)/7)%SCORE_EVENTS.length];
export const scoreFactor=(item,day)=>scoreEvent(day).goods[item]||1;

export const TRIAL_CATALOG=[
 {id:'timber',name:'숲의 제재소',nation:'silvaen',rank:2,item:'plank',target:140,duration:960,money:3200,plan:[['house',5],['lumber',3],['sawmill',2]]},
 {id:'bread',name:'강변 제빵사',nation:'estern',rank:3,item:'bread',target:100,duration:1000,money:4000,plan:[['house',6],['well',2],['lumber',1],['field',2],['mill',1],['bakery',1]]},
 {id:'cloth',name:'숲의 직물 공방',nation:'silvaen',rank:5,item:'cloth',target:60,duration:1100,money:5000,plan:[['house',6],['well',2],['cottonfield',3],['weaver',2]]},
 {id:'brick',name:'건축 자재 납품',nation:'estern',rank:8,item:'brick',target:100,duration:1200,money:5000,plan:[['house',6],['lumber',2],['quarry',2],['kiln',2]]},
 {id:'workwear',name:'작업복 수출',nation:'silvaen',rank:9,item:'workwear',target:40,duration:1600,money:6500,plan:[['house',7],['well',2],['cottonfield',3],['weaver',2],['tailor',1]]},
 {id:'steel',name:'산업 동력 시험',nation:'kardum',rank:15,item:'steel',target:60,duration:1800,money:9000,plan:[['house',3],['dwarfhouse',3],['well',2],['windturbine',1],['ironmine',1],['coalpit',1],['smelter',1]]},
 {id:'gear',name:'기계 부품 공방',nation:'kardum',rank:11,item:'gear',target:60,duration:1600,money:7000,plan:[['house',4],['dwarfhouse',3],['lumber',3],['sawmill',2],['quarry',2],['windturbine',1],['workshop',2]]},
 {id:'wool',name:'목장의 양모',nation:'estern',rank:6,item:'wool',target:80,duration:1200,money:5000,plan:[['house',6],['well',2],['field',3],['feedmill',1],['sheeppen',2]]},
 {id:'baguette',name:'제빵 분업 시험',nation:'estern',rank:5,item:'baguette',target:60,duration:1500,money:6000,plan:[['house',7],['well',2],['lumber',2],['field',3],['mill',2],['bakery',2]],recipes:{bakery:['dough','baguette']}},
];
export const TRIAL_CONDITIONS=[
 {id:'time',name:'빠른 납품',text:'남은 시간으로 추가 점수를 얻습니다.',fuelPenalty:0,buildingPenalty:0},
 {id:'fuel',name:'연료 절약',text:'운송 연료 1개당 50점이 차감됩니다.',fuelPenalty:50,buildingPenalty:0},
 {id:'compact',name:'작은 공장',text:'도로 등 바닥 타일을 제외한 시설 한 곳당 100점이 차감됩니다.',fuelPenalty:0,buildingPenalty:100},
];
