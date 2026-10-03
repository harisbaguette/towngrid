import {NATIONS,LEGACY_NATION_IDS,PROGRESSION_OFFSET} from './world.js';
import {WORLD_MAP,MAP_COLS,MAP_ROWS,CAPITALS} from './world-map.js';
// Historical region anchors remain stable for saved plots: a former capital and five nearby
// centres. Current countries are assigned below after the administrative cells are resolved.
const CELL=26;
const names=['수도권','북부 구릉','동부 유역','남부 평원','서부 산림','외곽 개척지'];
const at=(x,z)=>x>=0&&z>=0&&x<MAP_COLS&&z<MAP_ROWS?WORLD_MAP[z][x]:'~';
const SITE_GROUND='.fd*',siteGround=(x,z)=>SITE_GROUND.includes(at(x,z));
// Landmasses: squares joined by anything but the sea.
const MASS=new Map();
for(let z=0,id=0;z<MAP_ROWS;z++)for(let x=0;x<MAP_COLS;x++){if(at(x,z)==='~'||MASS.has(x+','+z))continue;const stack=[[x,z]];MASS.set(x+','+z,++id);
 while(stack.length){const [a,b]=stack.pop();for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const k=(a+dx)+','+(b+dz);if(at(a+dx,b+dz)!=='~'&&!MASS.has(k)){MASS.set(k,id);stack.push([a+dx,b+dz]);}}}}
const NATION_IDS=LEGACY_NATION_IDS,CENTER=[MAP_COLS/2,MAP_ROWS/2];
const DIRS=[null,[0,-1],[1,0],[0,1],[-1,0]];
const taken=new Map(),cells=NATION_IDS.map(()=>[]);
for(const [i,id] of NATION_IDS.entries()){const [x,z]=CAPITALS[id];if(!siteGround(x,z)||taken.has(x+','+z))throw new Error('bad capital square for '+id);taken.set(x+','+z,i);cells[i][0]=[x,z];}
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
// Provinces are handed out in turns so neighbouring nations share the land between them fairly.
for(let j=1;j<6;j++)for(const [i,id] of NATION_IDS.entries()){
 const cap=CAPITALS[id],out=[cap[0]-CENTER[0],cap[1]-CENTER[1]],len=Math.hypot(...out)||1;
 const target=j<5?[cap[0]+DIRS[j][0]*2.5,cap[1]+DIRS[j][1]*2.5]:[cap[0]+out[0]/len*3.5,cap[1]+out[1]/len*3.5];
 let best=null,score=Infinity;
 for(let z=0;z<MAP_ROWS;z++)for(let x=0;x<MAP_COLS;x++){
  if(!siteGround(x,z)||taken.has(x+','+z)||Math.max(Math.abs(x-cap[0]),Math.abs(z-cap[1]))>5)continue;
  const c=[x,z],own=dist(c,cap),foreign=NATION_IDS.some((o,k)=>k!==i&&dist(c,CAPITALS[o])<own);
  const v=dist(c,target)+(foreign?3:0)+(MASS.get(x+','+z)===MASS.get(cap.join(','))?0:4)+own*.01;
  if(v<score){score=v;best=c;}
 }
 if(!best)throw new Error('no square for '+id+'-'+j);
 taken.set(best.join(','),i);cells[i][j]=best;
}
export const PROVINCES=NATION_IDS.flatMap((nation,i)=>cells[i].map((cell,j)=>({id:nation+'-'+j,nation,name:NATIONS[nation].capital+' '+names[j],cell,point:[(cell[0]+.5)*CELL,(cell[1]+.5)*CELL],cells:[],capital:j===0,resource:['grain','iron','water','wood','mana','oil'][(i+j)%6]})));
// Administrative regions retain their IDs. Every land square belongs to a region.
for(let z=0;z<MAP_ROWS;z++)for(let x=0;x<MAP_COLS;x++){if(at(x,z)==='~')continue;let best=null,d=Infinity;
 for(const p of PROVINCES){const v=dist([x,z],p.cell);if(v<=d&&(v<d||!best)){best=p;d=v;}}
 best?.cells.push([x,z]);}
// Regions keep their original cells and IDs. Small states hold a compact core; four major
// countries hold the wider hinterlands. Ownership follows geography, independent of race.
const realms=Object.keys(NATIONS);
for(const p of PROVINCES){
 p.legacyNation=p.nation;
 const candidates=realms;
 p.nation=p.capital&&realms.includes(p.legacyNation)?p.legacyNation:candidates.reduce((best,id)=>{
  const score=k=>dist(p.cell,CAPITALS[k])*(k==='nezar'?.24:NATIONS[k].tier==='major'?.38:1.2);
  return score(id)<score(best)?id:best;
 });
 p.capital=p.id===p.nation+'-0';
 p.previousNation=p.nation;
 // Capitals anchor limited territories; distant hinterlands have no sovereign.
 // Region/plot IDs and physical terrain stay fixed when political ownership changes.
 if(!p.capital&&dist(p.cell,CAPITALS[p.nation])>(NATIONS[p.nation].tier==='major'?8:3.5))p.nation=null;
 p.developed=!!p.nation&&p.id.endsWith('-0');
 if(!p.nation)p.name='미개척지 '+(p.cell[0]+1)+'·'+(p.cell[1]+1);
 else if(!p.capital&&p.developed)p.name=NATIONS[p.legacyNation].capital+' 마을';
}
export const successorOf=id=>PROVINCES.find(p=>p.id===id+'-0')?.previousNation||id;
export const plotBelongsTo=(id,nation)=>{const p=PLOT_INDEX.get(id);return !!p&&(p.nation===nation||p.legacyNation===nation||p.previousNation===nation||p.nation===null&&!!NATIONS[nation]?.playable);};
// Settlements occupy individual squares. Original IDs are kept for existing saves.
export const WORLD_PLOTS=[...PROVINCES];
const plotCells=new Set(PROVINCES.map(p=>p.cell.join(',')));
for(const p of PROVINCES)for(const [x,z] of p.cells){
 if(!siteGround(x,z)||plotCells.has(x+','+z))continue;
 WORLD_PLOTS.push({id:p.legacyNation+'-plot-'+x+'-'+z,nation:p.nation,legacyNation:p.legacyNation,previousNation:p.previousNation,territoryId:p.id,name:(p.nation?NATIONS[p.nation].capital+' 개척지':'미개척지')+' '+(x+1)+'·'+(z+1),cell:[x,z],point:[(x+.5)*CELL,(z+.5)*CELL],cells:[[x,z]],capital:false,developed:false,resource:p.resource});
}
export const PLOT_INDEX=new Map(WORLD_PLOTS.map(p=>[p.id,p]));
export const territoryOf=id=>PLOT_INDEX.get(id)?.territoryId||id;
/** Political sovereignty and a site's citizenship/development are independent. */
export function sovereignOf(id,owners={}){const p=PLOT_INDEX.get(id),slot=owners[territoryOf(id)];return slot&&Object.hasOwn(slot,'owner')?slot.owner:p?.nation??null;}
// A saved site is a deed to exactly one world plot. Frontier land belongs to the player
// immediately on acquisition; its citizenship never annexes the surrounding region.
export const frontierClaimOf=(id,sites=[])=>PLOT_INDEX.get(id)?.nation===null?sites.find(s=>s.provinceId===id)||null:null;
export const landOwnerOf=(id,owners={},sites=[])=>frontierClaimOf(id,sites)?'player':sovereignOf(id,owners);
export const frontierPlots=(sites=[])=>sites.map(s=>PLOT_INDEX.get(s.provinceId)).filter(p=>p?.nation===null);
export function developmentOf(id,sites=[]){const site=sites.find(s=>s.provinceId===id);return site?site.sim?.buildings?.length?'settlement':'outpost':PLOT_INDEX.get(id)?.developed?'settlement':'undeveloped';}
/** An SVG path covering a list of squares. */
export const cellsPath=list=>list.map(([x,z])=>`M${x*CELL} ${z*CELL}h${CELL}v${CELL}h-${CELL}Z`).join('');
const BY_ID=new Map(PROVINCES.map(p=>[p.id,p]));
/** The province of the player's home site; the split rule never takes it (G3-12). */
export const homeProvince=c=>territoryOf(c.sites?.find(v=>v.id===c.homeId)?.provinceId);
// A site's provinceId is its claim on the world map: one site per plot (a province square or another square of it) of
// the site's own nation (G3-03). Saves from before provinces put every branch on the capital province (the default of the
// old local map); a missing or duplicate claim moves to the province the old numbering meant (site-n -> nation-(n-1)%6),
// else to the first free plot of the nation. The home site keeps its claim; with every plot claimed the duplicate stays.
function claimProvinces(c){
 const taken=new Set(),loose=[];
 for(const site of [...c.sites].sort((a,b)=>+(b.id===c.homeId)-+(a.id===c.homeId))){const p=PLOT_INDEX.get(site.provinceId);if(p&&plotBelongsTo(p.id,site.nation)&&!taken.has(p.id))taken.add(p.id);else loose.push(site);}
 for(const site of loose){const meant=site.nation+'-'+(((+String(site.id).split('-')[1]||1)-1)%6),free=[meant,...WORLD_PLOTS.filter(p=>p.nation===site.nation).map(p=>p.id)].find(id=>PLOT_INDEX.has(id)&&!taken.has(id));
  if(free){site.provinceId=free;taken.add(free);}else site.provinceId??=meant;}
}
// New games start on a non-capital province, which the split rule used to take like any other (G3-12). In a save made
// before the rule protected it, the home province returns from the emerging state to the home nation; the state keeps
// its other provinces (and its diplomacy when it has none left). The home autonomy granted at stage 20 (campaign.js
// onPromotion) is then never lost, so a home that lost it to a split gets it back (G3-12c: it could not be bought back).
function keepHome(c){
 const home=c.sites.find(v=>v.id===c.homeId),slot=home&&c.provinces[territoryOf(home.provinceId)],holder=slot&&c.newStates?.find(v=>v.id===slot.owner);if(!home)return;
 if(holder){slot.owner=home.nation;holder.provinceIds=PROVINCES.filter(p=>c.provinces[p.id].owner===holder.id).map(p=>p.id);
  if(holder.capitalProvince===territoryOf(home.provinceId)&&holder.provinceIds.length){const p=BY_ID.get(holder.provinceIds[0]);holder.capitalProvince=p.id;holder.point=p.point;}}
 if((c.treasury?.rank??0)-PROGRESSION_OFFSET>=20)home.territory=true;
}
export function initializeTerritory(c){
 // Apply the atlas reorganisation on load without moving a plot, touching land or replacing residents.
 for(const site of c.sites){const p=PLOT_INDEX.get(site.provinceId);if(p?.nation&&site.nation===p.legacyNation&&site.nation!==p.nation&&(!NATIONS[site.nation].playable||NATIONS[p.nation].playable)){site.nation=p.nation;site.sim.nation=p.nation;}}
 if(c.provinces)for(const p of PROVINCES){const slot=c.provinces[p.id];if(slot&&(slot.owner===p.legacyNation||p.nation===null&&slot.owner===p.previousNation))slot.owner=p.nation;}
 if(c.factions){const seen=new Set();c.factions=c.factions.filter(f=>{f.id=successorOf(f.id);if(seen.has(f.id))return false;seen.add(f.id);return true;});}
 if(c.recognition)c.recognition=[...new Set(c.recognition.map(successorOf))];
 for(const state of c.newStates||[]){state.parent=successorOf(state.parent);if(state.rootNation)state.rootNation=successorOf(state.rootNation);}
 c.provinces??={};for(const p of PROVINCES)c.provinces[p.id]??={owner:p.nation};
 claimProvinces(c);keepHome(c);
}
export function tradeConditions(c,siteId){
 const site=c.sites.find(v=>v.id===siteId);if(!site)return {market:1,toll:0,owner:null};
 const owner=landOwnerOf(site.provinceId,c.provinces,c.sites),state=c.newStates.find(v=>v.id===owner);
 if(!state)return {market:1,toll:0,owner};
 return {market:state.pact?1.12:state.relation>=55?1.06:state.relation<20?.8:.93,toll:state.pact?0:state.relation>=55?3:12,owner,name:state.name,closed:state.relation<15};
}
export function splitTerritory(c,parent,state){
 initializeTerritory(c);const home=homeProvince(c),owned=PROVINCES.filter(p=>c.provinces[p.id].owner===parent&&!p.capital&&p.id!==home);
 if(!owned.length)return false;
 const start=owned[(c.nextState-1)%owned.length];const selected=owned.sort((a,b)=>Math.hypot(a.point[0]-start.point[0],a.point[1]-start.point[1])-Math.hypot(b.point[0]-start.point[0],b.point[1]-start.point[1])).slice(0,Math.max(1,Math.floor(owned.length/2)));
 for(const p of selected)c.provinces[p.id].owner=state.id;
 const ancestor=c.newStates.find(v=>v.id===parent);if(ancestor){ancestor.provinceIds=PROVINCES.filter(p=>c.provinces[p.id].owner===parent).map(p=>p.id);ancestor.dissolved=ancestor.provinceIds.length===0;if(ancestor.dissolved)c.recognition=c.recognition.filter(id=>id!==parent);}
 state.provinceIds=selected.map(p=>p.id);state.point=start.point;state.capitalProvince=start.id;
 for(const site of c.sites)if(state.provinceIds.includes(territoryOf(site.provinceId))){site.territory=false;site.unrest=Math.max(30,site.unrest);}
 return true;
}
