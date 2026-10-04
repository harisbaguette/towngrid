import {BUILDINGS} from './simulation.js';
export const POWER_SUPPLY={windturbine:6,generator:16,watermill:12,arcanepower:28,solarpanel:6,battery:12};
export const POWER_DEMAND={oilpump:2,refinery:3,chemical:3,smelter:3,automotive:4,shipyard:5,blastfurnace:5,assemblyline:5,logistics:2};
export const powerSupply=b=>(POWER_SUPPLY[b.type]||12)*(1+((b.level||1)-1)*.5)*Math.max(0,b.health/100);
export const powerDemand=b=>BUILDINGS[b.type]?.power?Math.round((POWER_DEMAND[b.type]||1)*(1+((b.level||1)-1)*.3)*10)/10:0;
export const powerReach=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.z-b.z))<=6;
const reach=powerReach;
export function gridAllocation(s,nodes){
 if(s.loadTime===s.time&&s.loadRevision===s.revision&&s.loadNodes===nodes)return s.loadAllocation;
 const groups=[];for(const node of [...nodes].sort((a,b)=>a.id-b.id)){const touching=groups.filter(g=>g.nodes.some(n=>reach(n,node)));if(!touching.length)groups.push({nodes:[node]});else{const first=touching[0];first.nodes.push(node);for(const g of touching.slice(1)){first.nodes.push(...g.nodes);groups.splice(groups.indexOf(g),1);}}}
 for(const g of groups){g.supply=g.nodes.reduce((n,b)=>n+(b.type==='substation'?0:powerSupply(b)),0);g.consumers=[];}
 const all=s.buildings.filter(b=>BUILDINGS[b.type].power&&b.health>0&&b.enabled!==false&&!(b.movingUntil>s.time)).sort((a,b)=>(b.priority??1)-(a.priority??1)||a.id-b.id);
 // Residual paths can move an earlier load to another reachable grid without cutting its power.
 // A rejected lower-priority load rolls back its tentative paths; partial power never runs a factory.
 const graph=Array.from({length:1+groups.length+all.length},()=>[]),edges=[];
 const add=(a,b,cap)=>{const f={to:b,cap,flow:0,reverse:null},r={to:a,cap:0,flow:0,reverse:f};f.reverse=r;graph[a].push(f);graph[b].push(r);edges.push(f);return f;};
 const supply=groups.map((g,i)=>add(0,i+1,g.supply)),eligible=new Map(),feeds=new Map(),assigned=new Map(),powered=new Set();
 all.forEach((b,i)=>{const list=groups.map((g,j)=>({g,j})).filter(({g})=>g.nodes.some(n=>reach(n,b)));eligible.set(b.id,list);feeds.set(b.id,list.map(({g,j})=>({g,edge:add(j+1,1+groups.length+i,powerDemand(b))})));});
 all.forEach((b,i)=>{const target=1+groups.length+i,need=powerDemand(b),before=edges.map(e=>e.flow);let sent=0;
  const push=(at,amount,seen)=>{if(at===target)return amount;seen.add(at);for(const e of graph[at]){if(e.cap-e.flow<1e-8||seen.has(e.to))continue;const n=push(e.to,Math.min(amount,e.cap-e.flow),seen);if(n>1e-8){e.flow+=n;e.reverse.flow-=n;return n;}}return 0;};
  while(sent<need-1e-8){const n=push(0,need-sent,new Set());if(n<1e-8)break;sent+=n;}
  if(sent>=need-1e-8)powered.add(b.id);else edges.forEach((e,j)=>{e.flow=before[j];e.reverse.flow=-before[j];});
 });
 for(const b of all){const used=feeds.get(b.id).filter(v=>v.edge.flow>1e-8),primary=used.sort((a,b)=>b.edge.flow-a.edge.flow)[0]?.g||eligible.get(b.id)[0]?.g;if(primary){assigned.set(b.id,primary);primary.consumers.push(b);}}
 groups.forEach((g,i)=>{g.used=supply[i].flow;g.demand=g.used+g.consumers.filter(b=>!powered.has(b.id)).reduce((n,b)=>n+powerDemand(b),0);});
 const result={groups,assigned,powered,feeds,supply:groups.reduce((n,g)=>n+g.supply,0),demand:all.filter(b=>assigned.has(b.id)).reduce((n,b)=>n+powerDemand(b),0)};
 s.loadTime=s.time;s.loadRevision=s.revision;s.loadNodes=nodes;s.loadAllocation=result;return result;
}

export const batteryChargeOf=(s,b)=>b.charge??s.batteryCharge??0;
export function tickBatteries(s,dt,grid){
 const batteries=s.buildings.filter(b=>b.type==='battery').sort((a,b)=>a.id-b.id),outage=s.outageUntil>s.time,left=grid.groups.map(g=>Math.max(0,g.supply-g.used));
 for(const b of batteries){b.charge??=s.batteryCharge||0;if(b.health<=0||b.enabled===false||b.movingUntil>s.time)continue;
  if(outage){b.charge=Math.max(0,b.charge-dt);continue;}
  let rate=0;for(let i=0;i<grid.groups.length&&rate<2;i++){if(!grid.groups[i].nodes.some(n=>reach(n,b)))continue;const n=Math.min(2-rate,left[i]);rate+=n;left[i]-=n;}
  b.charge=Math.min(90,b.charge+dt*rate);
 }
 s.batteryCharge=Math.max(0,...batteries.map(b=>b.charge));s.gridTime=-1;
}

export function powerCellColor(s,x,z){
 const grid=s.gridStatus(),b=s.at(x,z),groups=grid.groups.filter(g=>g.nodes.some(n=>reach(n,{x,z})));
 if(!groups.length)return '#8a8e8c';
 if(b&&powerDemand(b)&&!grid.powered.has(b.id))return '#cf6762';
 const spare=groups.reduce((n,g)=>n+g.supply-g.used,0);return spare>=2?'#68be91':spare>0?'#e3c66f':'#de9270';
}
export function powerPreview(s,type,x,z,level=1,id=null){
 if(!BUILDINGS[type]?.power)return null;
 const candidate={id:id??s.nextId,type,x,z,level,health:100,enabled:true,priority:1},original=id&&s.buildings.find(b=>b.id===id);if(original)Object.assign(candidate,original,{level});
 const current=s.gridStatus(),nodes=current.groups.flatMap(g=>g.nodes),copy=Object.create(s);copy.buildings=[...s.buildings.filter(b=>b.id!==candidate.id),candidate];copy.loadTime=-1;
 const after=gridAllocation(copy,nodes),connected=after.assigned.has(candidate.id),lost=s.buildings.filter(b=>current.powered.has(b.id)&&!after.powered.has(b.id)).length;
 return {need:powerDemand(candidate),connected,powered:after.powered.has(candidate.id),lost,text:'필요 전력 '+powerDemand(candidate)+' · '+(!connected?'전력망 밖':!after.powered.has(candidate.id)?'용량 부족':lost?lost+'곳 공급 중단 예상':'공급 가능')};
}
