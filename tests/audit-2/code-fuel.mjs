// Code audit (C): fuel contract with every free vehicle out. economy.js:12 reserveFor already reserves the open contract's fuel
// (minimumStock), and export-route.js:117 dispatchShipment / 100 nextVehicle subtracts the same fuel again as `hold`, so a truck needs twice the order.
import {load,calm,expectBug,finish} from './_fixture.mjs';
import {fleet,VEHICLES} from '../../src/app/game/export-route.js';
const c=load(18);calm(c);const s=c.active;
// Injected: pick the rank band whose pool has fuel and point the contract counter at it; cooldown cleared.
const pools=[[20,['wire','concrete','fuel']]];s.contracts=2;s.contractReadyAt=0;const ct=s.contract();
if(ct.item!=='fuel'){console.log('contract item',ct.item,'rank',s.rank);}
s.shipments=[];/* injected: no vehicle already out */s.stock.fuel=0;const prodReserve=s.minimumStock('fuel')-ct.amount;s.stock.fuel=prodReserve+ct.amount+1;/* production reserve + the order + one trip */s.stock.plank=Math.max(s.stock.plank,60);
// Send three plank sales so the three fuel-free vehicles are out (real sell calls).
for(let i=0;i<3;i++)s.sell('plank',5);
const slots=fleet(s).map(v=>v.kind+(v.busy?':busy':':idle'));
const st=s.contractStatus();
console.log(JSON.stringify({contract:ct,fuel:s.stock.fuel,available:s.availableStock('fuel'),reserve:s.minimumStock('fuel'),slots,status:st}));
const idleFuel=fleet(s).some(v=>!v.busy&&VEHICLES[v.kind].fuel);
expectBug('C-F1 a fuel order with fuel for production reserve + order + one trip still gets no truck (the order fuel is counted twice)',ct.item==='fuel'&&idleFuel&&!st.ready,{fuel:s.stock.fuel,productionReserve:prodReserve,order:ct.amount,idleFuelVehicle:idleFuel,status:st.error,neededToPass:prodReserve+2*ct.amount+1});
finish('code-fuel');
