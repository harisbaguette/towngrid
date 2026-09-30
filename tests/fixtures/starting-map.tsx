import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import WorldMap from '../../src/app/game/WorldMap';
import {Campaign} from '../../src/app/game/campaign';
import {defaultStartingProvince} from '../../src/app/game/starting-sites';
import {NATIONS,factionOf} from '../../src/app/game/world';
import {encodeSave,SAVE_KEY} from '../../src/app/game/persistence';
import '../../src/app/globals.css';
import '../../src/app/design-tokens.css';
import '../../src/app/game-panels.css';
import '../../src/app/game-ui.css';

// Isolated world-screen fixture: no scene, artwork loading or running village.
function StartingMap(){
 const [nation,setNation]=useState('estern'),[race,setRace]=useState('human');
 const [province,setProvince]=useState<string|null>(defaultStartingProvince(nation)?.id||null);
 const [result,setResult]=useState<string|null>(null);
 return result?<output data-start-province={result}>{result}</output>:<WorldMap nation={nation} race={race} startProvinceId={province} onStartProvince={setProvince}
  onNation={(id:string)=>{setNation(id);setProvince(defaultStartingProvince(id)?.id||null);if((NATIONS as any)[id].playable)setRace(factionOf((NATIONS as any)[id].race));}}
  onRace={setRace} busy={false} saved={false} onBegin={()=>{
   const campaign=new Campaign({nation,race,provinceId:province});
   localStorage.setItem(SAVE_KEY,encodeSave(campaign.save()));setResult(campaign.home.provinceId);
  }}/>;
}
createRoot(document.getElementById('root')!).render(<StartingMap/>);
