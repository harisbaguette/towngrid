// The only link between the fixed export road (x 0..7, z 11) and the starting land is tile (8,11).
// Any ordinary building there cuts off every sale, and nothing warns at placement time.
import {Campaign,run,home,expectBug,finish} from './_harness.mjs';
const c=new Campaign({nation:'estern',race:'human'}),s=home(c);
s.build('warehouse',11,12);s.build('house',11,14);
const before=s.exportStatus();
const warn=s.canBuild('house',8,11);
const built=s.build('house',8,11);
const after=s.exportStatus();
const sale=s.sell('wood',10);
console.log(JSON.stringify({before,placementWarning:warn,built,after,sale}));
expectBug('X1-export-chokepoint-8-11',before.connected&&built.ok&&!after.connected&&!sale.ok,{placementWarning:warn,after:after.error,sale:sale.error});
// Same root: every map's gate row. Count candidate choke tiles for all three regions.
for(const region of ['river','coast','highland']){const c2=new Campaign({nation:region==='river'?'estern':region==='coast'?'neiren':'arsel',race:region==='river'?'human':'elf'}),t=home(c2);t.build('warehouse',11,12);
 const chokes=[];for(let x=8;x<16;x++)for(let z=8;z<16;z++){if(t.at(x,z)||t.canBuild('road',x,z))continue;const probe=t.build('house',x,z,true);if(!probe.ok)continue;if(!t.exportStatus().connected)chokes.push([x,z]);t.demolish(x,z);}
 console.log(region,'export choke tiles on starting land:',JSON.stringify(chokes));}
// Auto-sell silently stops as well: bread/fish auto-sell never reports the blocked route.
// Since X1 refuses a building on the choke tile, the blocked state comes from an older save that already has one there.
const c3=new Campaign({nation:'estern',race:'human'});home(c3).build('warehouse',11,12);home(c3).build('house',11,14);
const raw=c3.save(),old=raw.sites[0].simulation;old.buildings.push({...structuredClone(old.buildings.find(b=>b.type==='house')),id:old.nextId++,x:8,z:11});
const c4=new Campaign({saved:raw}),u=home(c4);u.stock.wood=200;u.autoSell.wood=true;const n0=u.notices.length;run(c4,30);
expectBug('X2-autosell-silent-when-blocked',!u.exportStatus().connected&&u.shipments.length===0&&u.notices.slice(n0).every(n=>!/수출|막혔/.test(n.text)),{connected:u.exportStatus().connected,shipments:u.shipments.length,notices:u.notices.slice(n0).map(n=>n.text),note:'older save with a house on (8,11); stock set directly to 200 wood to trigger auto-sell'});
finish('export-chokepoint');
