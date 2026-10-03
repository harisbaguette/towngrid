// Selling a natural feature of an owned tile for cash once (Town Star sold ponds and desert oil seeps to fund the start,
// docs/TOWNSTAR_RULES.md). Here a desert oil seep sells its drilling rights and a marsh reed bed its cutting rights; the
// tile stays, the decoration goes, and the seep's rich oil falls to an ordinary field's.
import {biomeOf,biomeHash} from './biome-data.js';

export const LAND_SALES={
 oilSeep:{name:'유정 채굴권',money:400,note:'원유 농도가 40%로 내려갑니다'},
 reeds:{name:'갈대 채취권',money:60,note:'갈대밭이 사라집니다'},
};
/** The decoration a tile shows before any sale (biome-terrain.js biomeDecoration reads the same rule). */
export function naturalFeature(layout,t){
 if(!biomeOf(layout)||t.water)return null;const n=biomeHash(t.x+5,t.z);
 if(layout.ecology==='desert'&&t.oil>=85&&n>.60)return 'oilSeep';
 if(layout.ecology==='marsh'&&n>.68)return 'reeds';
 return null;
}
/** What this owned, empty tile can sell now, or null. */
export function landSaleOffer(s,x,z){
 const t=s.tile(x,z);if(!t||t.sold||!s.ownedAt(x,z)||s.at(x,z))return null;const kind=naturalFeature(s.layout,t);
 return kind&&LAND_SALES[kind]?{kind,x,z,...LAND_SALES[kind]}:null;
}
export function applySold(t){t.sold=true;if(t.oil>=85)t.oil=40;}
export function sellLand(s,x,z){
 const o=landSaleOffer(s,x,z);if(!o)return {ok:false,error:'팔 수 있는 자연물이 없는 칸입니다'};
 const t=s.tile(x,z);applySold(t);s.soldLand.add(x+','+z);s.money+=o.money;s.budget.income+=o.money;s.revision++;
 s.sound('sell',x,z);s.notify(o.name+' 매각 · +'+o.money+'G','success');return {ok:true,money:o.money};
}
