import {BUILDINGS,RESOURCES} from './simulation.js';
import {scoreFactor} from './competition-rules.js';

const PLANS=[['well','field','mill','lumber','bakery'],['lumber','sawmill'],['well','cottonfield','weaver'],['lumber','quarry','kiln'],['well','field','mill'],['well','cottonfield','weaver','tailor'],['lumber','sawmill','quarry','windturbine','workshop']];
export function newRivalEconomy(index){return {version:1,cash:2000,stock:{},facilities:[],fuel:40,produced:0,sold:0,days:0,lastSales:0,lastStars:0,status:'시설 준비',plan:index%PLANS.length};}
export function validRivalEconomy(v){
 const number=n=>Number.isFinite(n)&&n>=0&&n<=1e12;
 return v&&v.version===1&&Number.isInteger(v.plan)&&v.plan>=0&&v.plan<PLANS.length&&['cash','fuel','produced','sold','days','lastSales','lastStars'].every(k=>number(v[k]))&&typeof v.status==='string'&&v.status.length<=100&&v.stock&&typeof v.stock==='object'&&!Array.isArray(v.stock)&&Object.entries(v.stock).every(([k,n])=>Object.hasOwn(RESOURCES,k)&&number(n))&&Array.isArray(v.facilities)&&v.facilities.length<=21&&v.facilities.every(b=>b&&PLANS[v.plan].includes(b.type)&&number(b.progress));
}
// An independent, small production simulation. It uses real recipes, inventory,
// purchased facilities, operating expenses and fuel-limited shipments, not the player's score.
export function rivalDay(rival,index,day){
 const e=rival.economy||(rival.economy=newRivalEconomy(index)),plan=PLANS[e.plan];
 e.days++;e.lastSales=0;e.lastStars=0;
 const desired=plan.length*(1+Math.min(2,Math.floor(e.days/28))),next=plan[e.facilities.length%plan.length];
 if(e.facilities.length<desired){const d=BUILDINGS[next],price=d.cost+Object.entries(d.materials||{}).reduce((sum,[k,n])=>sum+Math.ceil(RESOURCES[k].price*1.85)*n,0),reserve=e.facilities.length>=plan.length?Math.ceil(RESOURCES.fuel.price*1.85)*24:100;if(e.cash>=price+reserve){e.cash-=price;e.facilities.push({type:next,progress:0});}}
 const wages=e.facilities.reduce((sum,b)=>sum+BUILDINGS[b.type].cost*.015,0);if(e.cash<wages){e.status='운영비 부족';return 0;}e.cash-=wages;
 if(e.fuel<4&&e.cash>=Math.ceil(RESOURCES.fuel.price*1.85)*12){e.cash-=Math.ceil(RESOURCES.fuel.price*1.85)*12;e.fuel+=10;}
 const transport=18+index*3,capacity=240+e.facilities.length*20;
 const needed=Object.fromEntries(Object.keys(RESOURCES).map(k=>[k,e.facilities.reduce((n,b)=>n+(BUILDINGS[b.type].recipes?.[0]?.inputs?.[k]||0)*3,0)]));
 const powered=e.facilities.some(b=>b.type==='windturbine');
 for(let turn=0;turn<10;turn++)for(const b of e.facilities){
  const d=BUILDINGS[b.type],recipe=d.recipes?.[0]||d;
  if(!Object.hasOwn(RESOURCES,recipe.output)||d.power&&!powered)continue;
  b.progress+=8*(.8+index*.06);let cycles=Math.min(4,Math.floor(b.progress/recipe.period));
  cycles=Math.min(cycles,Math.max(0,Math.floor(((needed[recipe.output]||0)+transport*2-(e.stock[recipe.output]||0))/(recipe.amount||1))));
  for(const [k,n]of Object.entries(recipe.inputs||{}))cycles=Math.min(cycles,Math.floor((e.stock[k]||0)/n));
  const used=Object.values(e.stock).reduce((a,b)=>a+b,0);cycles=Math.min(cycles,Math.max(0,Math.floor((capacity-used)/(recipe.amount||1))));
  if(cycles){for(const[k,n]of Object.entries(recipe.inputs||{}))e.stock[k]-=n*cycles;e.stock[recipe.output]=(e.stock[recipe.output]||0)+cycles*(recipe.amount||1);e.produced+=cycles*(recipe.amount||1);b.progress-=cycles*recipe.period;}else b.progress=Math.min(b.progress,recipe.period);
 }
 let left=transport;const goods=Object.keys(e.stock).sort((a,b)=>RESOURCES[b].price-RESOURCES[a].price);
 for(const item of goods){const amount=Math.min(left,Math.max(0,Math.floor(e.stock[item]-(needed[item]||0))),Math.floor(e.fuel)*10);if(amount<1)continue;
  const trips=Math.ceil(amount/10);e.stock[item]-=amount;e.fuel-=trips;e.cash+=amount*RESOURCES[item].price;e.sold+=amount;e.lastSales+=amount;left-=amount;
  e.lastStars+=Math.round(Math.max(1,Math.ceil(RESOURCES[item].price/10))*amount*scoreFactor(item,day));
 }
 e.status=e.fuel<1?'연료 조달 중':e.lastSales?'생산품 '+e.lastSales+'개 출하':'원료·재고 준비';
 rival.score+=e.lastStars;return e.lastStars;
}
