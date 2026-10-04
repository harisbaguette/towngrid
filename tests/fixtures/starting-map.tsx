import React, {useEffect,useRef,useState} from 'react';
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
import '../../src/app/industrial-components.css';
import '../../src/app/start-world.css';
import '../../src/app/world-view.css';

// Isolated start flow, including its paused local preview; no running campaign.
function StartingMap(){
 const mount=useRef<HTMLDivElement>(null),[scene,setScene]=useState<any>(null);
 useEffect(()=>{let dead=false,current:any;Promise.all([import('../../src/app/game/scene'),import('../../src/app/game/assets')]).then(async([{GameScene},{loadAssets}])=>{await loadAssets('human');if(dead||!mount.current)return;current=new GameScene(mount.current,new Campaign().active);setScene(current);});return()=>{dead=true;current?.dispose();};},[]);
 const [nation,setNation]=useState('estern'),[race,setRace]=useState('human');
 const [province,setProvince]=useState<string|null>(defaultStartingProvince(nation)?.id||null);
 const [result,setResult]=useState<string|null>(null);
 return result?<output data-start-province={result}>{result}</output>:<><div className="world-canvas" ref={mount}/>{scene&&<WorldMap scene={scene} nation={nation} race={race} startProvinceId={province} onStartProvince={setProvince}
  onNation={(id:string)=>{setNation(id);setProvince(defaultStartingProvince(id)?.id||null);if((NATIONS as any)[id].playable)setRace(factionOf((NATIONS as any)[id].race));}}
  onRace={setRace} busy={false} saved={false} onBegin={()=>{
   const campaign=new Campaign({nation,race,provinceId:province});
   localStorage.setItem(SAVE_KEY,encodeSave(campaign.save()));setResult(campaign.home.provinceId);
  }}/> }</>;
}
createRoot(document.getElementById('root')!).render(<StartingMap/>);
