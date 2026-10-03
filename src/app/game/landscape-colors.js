// World-space variation: adjacent tiles sample the same field, never a new random swatch.
export const LAND_COLORS={plain:[157,181,98],forest:[119,153,80],mountain:[144,151,121],sand:[216,188,125],desert:[216,188,125],ice:[217,233,228],marsh:[135,157,94],volcanic:[114,119,121]};
export const WATER_COLORS={coast:[44,117,139],lake:[65,143,153],river:[66,146,157],canal:[63,139,151],stream:[77,152,160],pond:[83,156,161]};
export function landscapeHash(x,z){let h=Math.imul(x+101,374761393)^Math.imul(z+79,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
export function landscapeNoise(x,z){
 const a=Math.floor(x),b=Math.floor(z),u=x-a,v=z-b,s=u*u*(3-2*u),t=v*v*(3-2*v);
 const top=landscapeHash(a,b)*(1-s)+landscapeHash(a+1,b)*s,bottom=landscapeHash(a,b+1)*(1-s)+landscapeHash(a+1,b+1)*s;
 return top*(1-t)+bottom*t;
}
export const mixColor=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
