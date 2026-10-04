const KEY='towngrid-playtest-v1';
export function newPlaytest(s,now=Date.now()){return {version:1,started:now,nation:s.nation,province:s.provinceId,visibleMs:0,lastAt:now,milestones:[],menus:[],lastRank:s.rank,firstBuild:false,firstSale:false};}
/** @param {any} d @param {any} s @param {{now?:number,visible?:boolean,menu?:string|null}} options */
export function observePlaytest(d,s,{now=Date.now(),visible=true,menu=null}={}){
 if(!d)return;const elapsed=Math.max(0,Math.min(1500,now-d.lastAt));d.lastAt=now;if(visible)d.visibleMs+=elapsed;
 const mark=(kind,value)=>d.milestones.push({kind,value,seconds:Math.round(d.visibleMs/1000),gameDay:s.day});
 if(!d.firstBuild&&s.buildings.length){d.firstBuild=true;mark('first-build',s.buildings[0].type);}
 if(!d.firstSale&&Object.values(s.sold||{}).some(n=>n>0)){d.firstSale=true;mark('first-sale',Object.keys(s.sold).find(k=>s.sold[k]>0));}
 if(s.rank!==d.lastRank){d.lastRank=s.rank;mark('rank',s.rank+1);}
 if(menu&&!d.menus.some(v=>v.name===menu))d.menus.push({name:menu,seconds:Math.round(d.visibleMs/1000)});
}
export function savePlaytest(storage,diary){if(!diary)return false;try{const prior=JSON.parse(storage.getItem(KEY)||'[]'),list=Array.isArray(prior)?prior.filter(v=>v?.started!==diary.started).slice(-9):[];storage.setItem(KEY,JSON.stringify([...list,diary]));return true;}catch{return false;}}
export function readPlaytests(storage){try{const value=JSON.parse(storage.getItem(KEY)||'[]');return Array.isArray(value)?value.filter(v=>v?.version===1&&Number.isFinite(v.started)&&Number.isFinite(v.visibleMs)&&v.visibleMs>=0&&Number.isInteger(v.lastRank)&&Array.isArray(v.milestones)&&v.milestones.every(m=>m&&['first-build','first-sale','rank'].includes(m.kind)&&Number.isFinite(m.seconds))).slice(-10):[];}catch{return [];}}
