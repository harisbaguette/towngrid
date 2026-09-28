// Founding a second site at 법인 대표 and running a truck route between the two warehouses.
import {Campaign,run,home,expectBug,finish,status} from './_harness.mjs';
const c=new Campaign(),s=home(c);s.build('warehouse',11,12);s.build('house',11,14);s.rank=13;s.money=5000;s.stock.wood=80;s.stock.stone=40;s.stock.water=30;s.nextEvent=1e9;/* rank/stock set directly */
const f=c.foundSite('estern');const b=c.sites.find(v=>v.id===f.id)?.sim;
const steps=[];if(b){b.nextEvent=1e9;for(const [t,x,z] of [['warehouse',11,12],['house',11,14],['lumber',9,10],['well',13,12]])steps.push([t,b.build(t,x,z).ok||b.canBuild(t,x,z)]);}
const r=c.createRoute(c.homeId,f.id,'wood',10,'truck');run(c,80);
const route=c.routes[0];
console.log(JSON.stringify({found:f,builtAtBranch:steps,branchStock:b&&Object.fromEntries(Object.entries(b.stock).filter(([,v])=>v>0)),route:route&&{status:route.status,completed:route.completed},deliveries:c.deliveries,branchStatus:b&&status(b)}));
expectBug('G1-branch-cannot-bootstrap',!f.ok||steps.some(([,ok])=>ok!==true)||!route||route.completed<1,{found:f,steps,route:route&&route.status});
finish('branch-site');
