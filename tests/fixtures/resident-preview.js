import React from 'react';
import {createRoot} from 'react-dom/client';
import ResidentRoster from '../../src/app/game/ResidentRoster.tsx';
import {facilityRoster} from '../../src/app/game/facility-staff.js';
import {BUILDINGS,RESOURCES} from '../../src/app/game/simulation.js';
import '../../src/app/game-ui.css';
export function mountResidents(sim){
 const host=document.createElement('div');host.id='resident-fixture';
 host.style.cssText='position:fixed;right:12px;top:12px;bottom:12px;width:min(570px,calc(100vw - 24px));overflow:auto;background:#f3f6e9;padding:18px;z-index:1000;border:2px solid #3984aa;border-radius:12px';
 document.body.append(host);
 const root=createRoot(host),workers=[...sim.workers,...facilityRoster(sim).map(w=>({...w,workplaceName:BUILDINGS[w.workplace].name}))];
 root.render(React.createElement(ResidentRoster,{workers,resources:RESOURCES}));
 return ()=>{root.unmount();host.remove();};
}
