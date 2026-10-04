// Finished goods and returned ingredients remain at their facility until hauled.
export function outputStock(s,b,item){return (s.recipeOf(b)?.output===item?b.out||0:0)+(b.returnStock?.[item]||0);}
export function outputItems(s,b){const items={...b.returnStock};const item=s.recipeOf(b)?.output;if(item&&b.out>0)items[item]=(items[item]||0)+b.out;return Object.entries(items).filter(([,n])=>n>0);}
export const padUsed=b=>(b.out||0)+Object.values(b.returnStock||{}).reduce((n,v)=>n+v,0);
export function putReturn(b,item,n){if(n>0){b.returnStock??={};b.returnStock[item]=(b.returnStock[item]||0)+n;}}
export function takeOutput(s,b,item,n){const returned=Math.min(n,b.returnStock?.[item]||0);if(returned){b.returnStock[item]-=returned;if(!b.returnStock[item])delete b.returnStock[item];}const made=Math.min(n-returned,s.recipeOf(b)?.output===item?b.out||0:0);b.out-=made;return returned+made;}
