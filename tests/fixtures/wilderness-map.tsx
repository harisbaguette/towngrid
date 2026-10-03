import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import CampaignWorld from '../../src/app/game/CampaignWorld';
import {Campaign} from '../../src/app/game/campaign';
import {PROGRESSION_OFFSET} from '../../src/app/game/world';
import '../../src/app/globals.css';
import '../../src/app/design-tokens.css';
import '../../src/app/game-panels.css';
import '../../src/app/game-ui.css';
const saved=sessionStorage.getItem('frontier-preview-save');
const campaign=saved?new Campaign({saved:JSON.parse(saved)}):new Campaign();
if(!saved){campaign.active.rank=PROGRESSION_OFFSET+13;campaign.active.money=10000;Object.assign(campaign.active.stock,{wood:100,stone:100,water:100});}
function Fixture(){const [nation,setNation]=useState('estern'),[,refresh]=useState(0);(window as any).wildernessCampaign=campaign;(window as any).refreshWilderness=()=>refresh(v=>v+1);
 return <main style={{padding:16}}><CampaignWorld campaign={campaign} nation={nation} onNation={setNation} onVisit={(id:string)=>{campaign.switchSite(id);refresh(v=>v+1);}} onAction={()=>refresh(v=>v+1)}/></main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
