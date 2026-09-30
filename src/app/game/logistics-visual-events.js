// Presentation events are deliberately outside saves and inventory accounting.
const histories = new WeakMap();
const state = sim => {
 let value = histories.get(sim);
 if (!value || value.time > sim.time) histories.set(sim, value = {time:sim.time, next:0, events:[]});
 value.time = sim.time;
 value.events = value.events.filter(e => e.until > sim.time && e.revision === sim.revision);
 return value;
};
function pathThrough(net, from, to) {
 const keys = new Set(net.tiles), target = new Set(), queue = [], previous = new Map();
 const around = p => [[p.x+1,p.z],[p.x-1,p.z],[p.x,p.z+1],[p.x,p.z-1]].map(([x,z])=>`${x},${z}`);
 for (const key of around(to)) if (keys.has(key)) target.add(key);
 for (const key of around(from)) if (keys.has(key)) {queue.push(key);previous.set(key,null);}
 for (let i=0;i<queue.length;i++) {
  const key=queue[i];
  if(target.has(key)) {
   const path=[];
   for(let k=key;k!==null;k=previous.get(k)){const [x,z]=k.split(',').map(Number);path.unshift({x,z});}
   return [{x:from.x,z:from.z},...path,{x:to.x,z:to.z}];
  }
  const [x,z]=key.split(',').map(Number);
  for(const next of around({x,z}))if(keys.has(next)&&!previous.has(next)){previous.set(next,key);queue.push(next);}
 }
 return null;
}
export function recordNetworkTransfer(sim,net,from,to,item,amount) {
 if(amount<=0)return;
 net.visualPaths ??= new Map();
 const key=from.id+':'+to.id;
 if(!net.visualPaths.has(key))net.visualPaths.set(key,pathThrough(net,from,to));
 const path=net.visualPaths.get(key);if(!path)return;
 const history=state(sim),duration=Math.min(3,Math.max(.7,(path.length-1)*.24));
 history.events.push({id:++history.next,kind:net.type,item,amount,path,from:from.id,to:to.id,
  start:sim.time,until:sim.time+duration,revision:sim.revision});
 if(history.events.length>128)history.events.splice(0,history.events.length-128);
}
export function recordTerminalTransfer(sim,shipment,terminalId,at) {
 if(!terminalId)return;
 const history=state(sim);
 history.events.push({id:++history.next,kind:'terminal',item:shipment.item,amount:shipment.amount,
  terminal:terminalId,import:shipment.kind==='import',start:sim.time,until:sim.time+1.6,revision:sim.revision,at});
 if(history.events.length>128)history.events.splice(0,history.events.length-128);
}
export function logisticsVisualEvents(sim) {
 if(!sim)return [];
 return state(sim).events.filter(e=>[e.from,e.to,e.terminal].filter(id=>id!==undefined).every(id=>{
  const b=sim.buildings.find(b=>b.id===id);return b&&b.health>0&&b.enabled!==false;
 }));
}
export function transferPose(event,time) {
 const progress=Math.max(0,Math.min(1,(time-event.start)/(event.until-event.start)));
 const distance=progress*(event.path.length-1),i=Math.min(event.path.length-2,Math.floor(distance)),f=distance-i;
 const a=event.path[i],b=event.path[i+1];
 return {x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f,progress};
}
