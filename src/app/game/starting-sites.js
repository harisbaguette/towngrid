import {NATIONS} from './world.js';
import {PROVINCES} from './territory.js';
import {terrainOfCell,WATER_KINDS} from './world-grid.js';

// New campaigns start in provincial land. Saved games retain their original province.
const STARTS=new Map(Object.keys(NATIONS).map(nation=>[nation,PROVINCES.filter(p=>{
 if(p.nation!==nation||p.capital||!NATIONS[nation].playable)return false;
 const terrain=terrainOfCell(...p.cell);
 return terrain!=='mountain'&&!WATER_KINDS.includes(terrain);
})]));
export const startingProvinces=nation=>STARTS.get(nation)||[];
export const defaultStartingProvince=nation=>startingProvinces(nation).find(p=>p.id===nation+'-5')||startingProvinces(nation)[0]||null;
export const startingProvince=(nation,id)=>startingProvinces(nation).find(p=>p.id===id)||null;
