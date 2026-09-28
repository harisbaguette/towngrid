import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RESOURCES, BUILDINGS } from './simulation.js';
import { asset, character, animateCharacter } from './assets.js';
import { RACES } from './world.js';
import { makePixelBuilding, makePixelTree, makePixelProp, makePixelVehicle } from './pixel-environment.js';
import { makePixelNetwork } from './pixel-terrain.js';
let currentRace='human';
const mats=new Map(),geos=new Map();
export const mat=(color,extra={})=>{const key=color+JSON.stringify(extra);if(!mats.has(key)){const m=new THREE.MeshStandardMaterial({color,roughness:.83,metalness:0,...extra});m.userData.shared=true;mats.set(key,m);}return mats.get(key);};
const geo=(key,make)=>{if(!geos.has(key)){const g=make();g.userData.shared=true;geos.set(key,g);}return geos.get(key);};
export function mesh(group,geometry,color,x=0,y=0,z=0,material=null){const m=new THREE.Mesh(geometry,material||mat(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
export function box(g,w,h,d,c,x=0,y=0,z=0,r=.04){return mesh(g,geo(['box',w,h,d,r].join(),()=>r?new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)):new THREE.BoxGeometry(w,h,d)),c,x,y,z);}
export function ball(g,rx,ry,rz,c,x=0,y=0,z=0){const m=mesh(g,geo('sphere',()=>new THREE.SphereGeometry(1,20,14)),c,x,y,z);m.scale.set(rx,ry,rz);return m;}
export function cyl(g,rt,rb,h,c,x=0,y=0,z=0,s=14){return mesh(g,geo(['cyl',rt,rb,h,s].join(),()=>new THREE.CylinderGeometry(rt,rb,h,s)),c,x,y,z);}
export function group(parent,x=0,y=0,z=0){const g=new THREE.Group();g.position.set(x,y,z);if(parent)parent.add(g);return g;}
function beam(g,a,b,r,c){const v=new THREE.Vector3(...a),w=new THREE.Vector3(...b),m=cyl(g,r,r,v.distanceTo(w),c);m.position.copy(v.add(w).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize());return m;}
// M12 placeholder body colours by facility group, used until the new facilities get pixel art.
const PLACEHOLDER_COLORS={farm:'#9dbb62',craft:'#c99a62',industry:'#8f9ea6',advanced:'#7fa7b8',energy:'#9f8fc9',civic:'#c7b38a',transport:'#b79a6b',base:'#b9a27f'};
const C={wood:'#996333',woodLight:'#bd8348',darkWood:'#684b30',cream:'#f0ddb2',roof:'#e87e2d',roofLight:'#f59638',stone:'#b4b9ac',blue:'#4284a3',deepBlue:'#266286',metal:'#a8b6ba',hay:'#eac24c'};
export function crate(parent,x=0,y=0,z=0,scale=1){const g=group(parent,x,y,z);box(g,.31,.3,.31,'#cc9659',0,.15);box(g,.045,.305,.318,'#eed6a1',0,.15);box(g,.315,.04,.31,'#ad7845',0,.05);g.scale.setScalar(scale);return g;}
function sack(parent,x,y,z,scale=1){const g=group(parent,x,y,z);ball(g,.18,.23,.15,'#e7d6af',0,.21);cyl(g,.05,.075,.11,'#d4bd91',0,.44);g.scale.setScalar(scale);return g;}
function hay(parent,x,y,z,s=.25){const g=group(parent,x,y,z);ball(g,s,s*.9,s,'#eac34c',0,s*.72);for(let i=0;i<6;i++){const a=i*Math.PI/3;const m=ball(g,s*.12,s*.64,s*.21,'#f2ce55',Math.cos(a)*s*.66,s*.82,Math.sin(a)*s*.66);m.rotation.z=Math.cos(a)*.4;}return g;}
function log(parent,x,y,z,len=.95){const m=cyl(parent,.13,.13,len,C.wood,x,y,z);m.rotation.x=Math.PI/2;const end=cyl(parent,.115,.115,.012,'#dcbb84',x,y,z+len/2);end.rotation.x=Math.PI/2;const core=cyl(parent,.04,.04,.015,C.woodLight,x,y,z+len/2+.01);core.rotation.x=Math.PI/2;return m;}
function gable(g,w=1.7,d=1.5,y=1.55,color=C.roof){
 const style=RACES[currentRace],base=new THREE.Color(style.roof),slope=currentRace==='elf'?.67:.48;
 // A rounded terracotta roof skin over the licensed modular walls and framing.
 for(const side of [-1,1]){
  const roof=group(g,side*w*.23,y+w*.13,0);roof.rotation.z=-side*slope;
  box(roof,w*.58,.12,d+.08,style.trim,0,-.035,0,.045);
  for(let row=0;row<3;row++)for(let col=0;col<4;col++){
   const tint=base.clone().lerp(new THREE.Color('#ffd391'),.035+((row+col)%3)*.045).getStyle();
   box(roof,w*.205,.095,d*.27,tint,(row-1)*w*.185,.115+(2-row)*.004,(col-1.5)*d*.25,.045);
  }
 }
 for(let col=0;col<4;col++){const cap=cyl(g,w*.057,w*.057,d*.265,base.clone().lerp(new THREE.Color('#ffd391'),.17).getStyle(),0,y+w*.255,(col-1.5)*d*.25,12);cap.rotation.x=Math.PI/2;}
}
function platform(g,size=2){box(g,size-.12,.095,size-.12,'#c3b793',0,.045,0,.05);}
function shed(g,{roof=true,back=true,color=C.roof}={}){
 platform(g);const style=RACES[currentRace];
 for(const x of [-.7,.7])for(const z of [-.59,.59]){const p=asset('town',['dwarf','demon'].includes(currentRace)?'pillar-stone':'pillar-wood',{height:1.5,color:style.trim});if(p){p.position.set(x,.05,z);g.add(p);}else box(g,.16,1.5,.16,style.trim,x,.8,z);}
 if(back){const wall=asset('town',['dwarf','demon'].includes(currentRace)?'wall':'wall-wood-window-shutters',{width:1.5,color:style.wall});if(wall){wall.position.set(0,.12,-.59);wall.rotation.y=Math.PI/2;g.add(wall);}}
 if(roof)gable(g,1.82,1.64,1.49,color);
}
export function horse(parent,x=0,y=0,z=0){
 const g=group(parent,x,y,z);
 ball(g,.25,.28,.38,'#ae692f',0,.51,0);
 const legs=[];
 for(const a of [-.16,.16])for(const b of [-.22,.22]){const l=group(g,a,.46,b);cyl(l,.07,.055,.37,'#a96a35',0,-.17);box(l,.13,.095,.15,'#765638',0,-.37,.018);legs.push(l);}
 const head=group(g,0,.77,.24);
 ball(head,.17,.27,.19,'#b97535',0,.01,.03);ball(head,.18,.21,.22,'#bc7c3c',0,.17,.15);ball(head,.185,.12,.15,'#dc9a65',0,.07,.32);
 for(const a of [-1,1]){ball(head,.058,.14,.058,'#b6793a',a*.12,.43,.08);ball(head,.028,.038,.015,'#422c25',a*.09,.08,.454);ball(head,.042,.067,.035,'#fff4d6',a*.153,.245,.245);ball(head,.03,.048,.03,'#252b29',a*.177,.245,.258);}
 for(let i=0;i<5;i++)ball(head,.066,.12,.075,'#f0c447',(i-2)*.067,.35-(i%2)*.03,.08);
 for(let i=0;i<4;i++)ball(g,.08,.16,.09,'#e7ba3d',0,.91-i*.09,.07-i*.065);
 const tail=group(g,0,.59,-.35);ball(tail,.06,.25,.075,'#d4a633',0,-.15,-.03);tail.rotation.x=-.3;
 g.userData={head,tail,legs};return g;
}
function stable(g){
 const bucket=asset('erdynth','Bucket',{height:.24});if(bucket){bucket.position.set(.64,.12,.59);g.add(bucket);}
 shed(g);box(g,.12,.55,.78,C.cream,.7,.61,-.14);box(g,.13,.49,.73,C.woodLight,.7,.36,.21);
 for(let i=0;i<4;i++)box(g,.14,.46,.018,C.wood,.71,.38,-.08+i*.17,.01);
 const h=asset('characters','Horse',{width:1.20})||horse(null);h.position.set(-.18,.12,.45);h.rotation.y=.25;g.add(h);
 const horseRoot=h.children[0],horseClip=horseRoot?.animations?.find(c=>c.name.endsWith('|Idle'));let mixer,last=0;
 if(horseClip){mixer=new THREE.AnimationMixer(horseRoot);mixer.clipAction(horseClip).play();mixer.update(0);h.userData.mixer=mixer;h.userData.root=horseRoot;}
 const hay1=hay(g,.89,.05,-.25,.27),hay2=hay(g,.86,.06,.16,.23);
 cyl(g,.2,.18,.2,C.darkWood,.64,.15,.78);cyl(g,.173,.173,.025,'#63b6c6',.64,.254,.78);
 const flag=group(g,0,2.04,-.33);cyl(flag,.025,.025,.5,C.woodLight,0,.24);box(flag,.34,.18,.028,'#f5c447',.17,.39,0,.015);
 const ring=mesh(g,new THREE.TorusGeometry(.075,.021,6,12,Math.PI*1.55),'#829091',-.775,1.16,.61);ring.rotation.z=-.7;
 return {animate:(t,b)=>{if(mixer){mixer.update(Math.min(.1,Math.max(0,t-last)));last=t;}else{h.userData.head.rotation.x=Math.sin(t*1.1)*.06;h.userData.tail.rotation.z=Math.sin(t*1.8)*.18;}flag.children[1].rotation.y=Math.sin(t*2)*.11;hay1.scale.setScalar((b.inputs.grain||0)>0?1:.72);hay2.visible=(b.inputs.grain||0)>1;}};
}
function warehouse(g){
 shed(g,{color:'#548eaa'});box(g,1.35,.12,.58,C.woodLight,0,.28,-.3);
 const crates=[];for(let row=0;row<2;row++)for(let i=0;i<3;i++)crates.push(crate(g,(i-1)*.4,.12+row*.32,-.38));
 for(let i=0;i<3;i++)box(g,.34,.065,.8,C.woodLight,(i-1)*.37,.1,.83);
 const cart=asset('town','cart',{width:.63});if(cart){cart.position.set(.55,.08,.64);g.add(cart);}
 sack(g,-.59,.1,.55);sack(g,-.39,.1,.72,.75);
 return {animate:(t,b,sim)=>{const total=Object.values(sim?.stock||{a:40}).reduce((a,c)=>a+c,0);crates.forEach((v,i)=>v.visible=total>i*13);}};
}
function well(g){
 for(let j=0;j<2;j++)for(let i=0;i<9;i++){const a=i*Math.PI*2/9+(j%2)*.3;const b=box(g,.23,.17,.14,j?'#b1b7a6':'#969f90',Math.sin(a)*.3,.12+j*.16,Math.cos(a)*.3);b.rotation.y=a;}
 cyl(g,.23,.23,.02,'#419bac',0,.16);
 for(const x of [-.38,.38])box(g,.075,.8,.08,C.wood,x,.65,0);
 const roof=box(g,.92,.11,.67,C.roof,0,1.1,0);roof.rotation.z=-.12;
 const axle=cyl(g,.045,.045,.88,C.woodLight,0,.85,0);axle.rotation.z=Math.PI/2;
 const crank=group(g,.48,.85,0);box(crank,.04,.23,.055,C.metal,0,-.07);cyl(crank,.03,.03,.13,C.wood,0,-.19,.06).rotation.x=Math.PI/2;
 const bucket=group(g,0,.36,0);cyl(bucket,.12,.095,.17,C.woodLight);cyl(bucket,.099,.099,.01,'#54b9cb',0,.09);beam(g,[0,.34,0],[0,.87,0],.009,'#d4c2a1');
 return {animate:(t,b)=>{if(b.working){bucket.position.y=.34+(Math.sin(t*1.8)+1)*.16;crank.rotation.x=t*2;}}};
}
function field(g){
 box(g,.91,.12,.91,'#8a633e',0,.08,0,.07);const stalks=group(g);
 for(let i=0;i<4;i++)for(let j=0;j<4;j++){const x=(i-1.5)*.19,z=(j-1.5)*.19;const s=group(stalks,x,.15,z);cyl(s,.012,.016,.3,'#b1b34f',0,.15);for(let k=0;k<3;k++)ball(s,.033,.065,.024,'#e9be4b',(k%2?.025:-.025),.3+k*.038,0);}
 return {animate:(t,b)=>{stalks.scale.y=.25+.75*b.progress;stalks.rotation.z=Math.sin(t*1.7)*.025;}};
}
function sawmill(g){
 platform(g);for(const x of [-.62,.62])box(g,.1,.6,1.2,C.wood,x,.35,0);
 box(g,1.42,.09,1.45,C.woodLight,0,.65,0);
 const saw=group(g,.05,.94,0);const disc=cyl(saw,.32,.32,.04,'#adbac1');disc.rotation.z=Math.PI/2;
 for(let i=0;i<14;i++){const a=i*Math.PI*2/14;const b=box(saw,.07,.1,.065,'#c7d2d5',0,Math.sin(a)*.33,Math.cos(a)*.33,.005);b.rotation.x=-a;}
 const feed=group(g,-.13,.81,.22);log(feed,0,0,0,1.5);
 for(let i=0;i<3;i++)box(g,.38,.09,1.25,'#dca565',.68,.15+i*.095,.04);
 for(const x of [-.72,.72])box(g,.11,1.3,.11,C.wood,x,.77,-.68);
 const roof=box(g,1.85,.1,.68,'#407b8c',0,1.48,-.54);roof.rotation.x=.12;
 return {animate:(t,b)=>{if(b.working){saw.rotation.x=t*7;feed.position.z=.42-b.progress*.65;}}};
}
function mill(g){
 platform(g);box(g,.85,1.35,.85,'#ebd8ac',0,.76,-.12,.13);cyl(g,.08,.64,.58,'#50829a',0,1.71,-.12,8);
 const wheel=group(g,0,1.45,.46);
 const sails=asset('town','windmill',{height:1.8});if(sails){sails.position.y=-.9;sails.rotation.y=Math.PI/2;wheel.add(sails);}

 sack(g,-.58,.1,.36);sack(g,-.48,.1,.7,.8);box(g,.35,.5,.33,C.woodLight,.58,.4,-.16);cyl(g,.23,.12,.3,'#d5a24c',.58,.77,-.16);
 return {animate:(t,b)=>{if(b.working)wheel.rotation.z=t*.8;}};
}
function bakery(g){
 platform(g);box(g,1.23,.94,1.1,C.cream,-.16,.59,-.25,.16);gable(g,1.5,1.38,1.12);
 box(g,.35,.87,.35,'#aeb1a3',.38,1.32,-.42);
 const oven=group(g,-.15,.46,.36);ball(oven,.39,.45,.11,'#b28251');ball(oven,.27,.33,.12,'#43352c',0,-.025,.06);const fire=group(oven,0,-.13,.17);for(let i=0;i<3;i++)ball(fire,.065,.11+(i%2)*.06,.045,i%2?'#ffd565':'#ef8939',(i-1)*.1,0,0);
 box(g,.75,.09,.4,C.woodLight,.5,.4,.69);for(const x of [.2,.8])box(g,.06,.4,.06,C.wood,x,.2,.69);
 for(let i=0;i<3;i++){ball(g,.105,.065,.16,'#d98c39',.29+i*.19,.495,.68);box(g,.025,.015,.13,'#f4c57b',.29+i*.19,.56,.69,.01);}
 const smoke=[];for(let i=0;i<3;i++)smoke.push(ball(g,.1,.1,.1,'#e9ede1',.38,1.9+i*.22,-.42));
 return {animate:(t,b)=>{fire.visible=b.working;fire.scale.y=.8+Math.sin(t*8)*.15;smoke.forEach((p,i)=>{p.visible=b.working;p.position.y=1.8+((t*.25+i*.24)%1);p.position.x=.38+Math.sin(t+i)*.06;p.scale.setScalar(.1*(.8+((t*.25+i*.24)%1)*1.4));});}};
}
function house(g){
 box(g,.73,.75,.68,C.cream,0,.41,0);gable(g,.93,.87,.79,'#498aa3');
 box(g,.23,.41,.04,C.wood,0,.29,.356);box(g,.17,.2,.04,'#75b5bf',.25,.59,.36);box(g,.035,.23,.05,C.woodLight,.25,.59,.37);box(g,.2,.03,.05,C.woodLight,.25,.59,.37);
 const curtain=box(g,.13,.15,.015,'#ead69c',-.372,.55,.03);curtain.rotation.y=Math.PI/2;
 return {animate:t=>{curtain.rotation.z=Math.sin(t*1.3)*.04;}};
}
function lumber(g){
 platform(g);for(let i=0;i<3;i++)log(g,-.45+i*.29,.25,-.29,1.05);log(g,-.18,.48,-.29,1.05);
 cyl(g,.25,.3,.32,C.wood,.45,.25,.5);cyl(g,.245,.245,.01,'#e1bd82',.45,.416,.5);
 const axe=group(g,.45,.59,.5),axeAsset=asset('erdynth','Axe',{height:.69});if(axeAsset){axeAsset.position.y=-.15;axe.add(axeAsset);}
 for(const x of [-.76,.18])box(g,.085,.9,.085,C.wood,x,.55,-.63);
 const roof=box(g,1.3,.065,.85,'#6c8b55',-.28,1.06,-.5);roof.rotation.x=.16;
 return {animate:(t,b)=>{if(b.working)axe.rotation.x=Math.sin(t*4)*.8;}};
}
function quarry(g){
 platform(g);for(let i=0;i<4;i++){const a=i*2.1;const stone=mesh(g,new THREE.DodecahedronGeometry(.31+i*.02),'#a5afa8',Math.sin(a)*.49,.35,Math.cos(a)*.48);stone.scale.y=.7;}
 const drill=group(g,.05,.65,.35);box(drill,.24,.3,.23,'#eab23b');cyl(drill,.05,.03,.55,C.metal,0,-.35);box(g,.45,.15,.47,C.wood,.55,.17,-.38);
 const pickaxe=asset('erdynth','Pickaxe',{height:.75});if(pickaxe){pickaxe.position.set(-.44,.19,.43);pickaxe.rotation.z=.25;g.add(pickaxe);}
 return {animate:(t,b)=>{if(b.working){drill.position.y=.65+Math.sin(t*18)*.035;if(pickaxe)pickaxe.rotation.x=Math.sin(t*2.5)*.3;}}};
}
function generator(g){
 platform(g);const boiler=cyl(g,.42,.42,1.07,'#548897',-.36,.85,-.14);boiler.rotation.x=Math.PI/2;
 for(const z of [-.6,.3]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.43,.037,6,20),mat('#9eb1b5'));ring.position.set(-.36,.85,z);g.add(ring);}
 box(g,.52,.42,.51,'#b7bfbd',-.35,.27,.15);box(g,.31,.18,.035,'#ef9a3a',-.35,.28,.424);
 cyl(g,.095,.12,.93,'#596e70',-.35,1.54,-.46);cyl(g,.14,.13,.1,'#849898',-.35,2,-.46);
 const wheel=group(g,.42,.6,.24);cyl(wheel,.33,.33,.09,'#6d848c').rotation.x=Math.PI/2;for(let i=0;i<6;i++){const arm=box(wheel,.048,.6,.13,'#d0b46c');arm.rotation.z=i*Math.PI/3;}
 box(g,.48,.63,.57,'#d4dbcf',.55,.44,-.39);const smoke=[];for(let i=0;i<3;i++)smoke.push(ball(g,.11,.14,.1,'#ecf0e6',-.35,2.1,-.46));
 return {animate:(t,b,sim)=>{const active=b.enabled!==false&&b.health>0&&(b.working||b.activeUntil>(sim?.time??t));if(active)wheel.rotation.z=t*3;smoke.forEach((p,i)=>{p.visible=active;p.position.y=2.06+(t*.34+i*.26)%1;p.position.x=-.35+Math.sin(t+i)*.06;});}};
}
function workshop(g){
 platform(g);box(g,1.52,1.18,.13,'#aab6b1',0,.72,-.66);box(g,.14,1.3,.14,'#367388',-.73,.75,.56);box(g,.14,1.3,.14,'#367388',.73,.75,.56);
 box(g,1.76,.12,.85,'#437f9b',0,1.44,-.33);box(g,.73,.15,.78,'#597e8a',-.16,.26,0);
 for(const x of [-.43,.14])box(g,.11,.83,.14,'#416b7c',x,.75,0);
 box(g,.79,.24,.41,'#ddb045',-.16,1.23,0);const press=box(g,.36,.17,.33,C.metal,-.16,.74,.06);
 const hammer=asset('erdynth','Hammer',{height:.5});if(hammer){hammer.position.set(.57,.43,.49);hammer.rotation.z=-.6;g.add(hammer);}
 crate(g,.61,.1,.29,.9);crate(g,.61,.1,-.27,.8);const gear=group(g,-.64,.65,.55);cyl(gear,.15,.15,.07,'#b4bbc0').rotation.x=Math.PI/2;
 for(let i=0;i<8;i++){const a=i*Math.PI/4,b=box(gear,.09,.07,.08,'#b4bbc0',Math.sin(a)*.16,Math.cos(a)*.16,0,.008);b.rotation.z=-a;}
 return {animate:(t,b)=>{if(b.working){press.position.y=.73+Math.sin(t*3)*.22;gear.rotation.z=t;}}};
}
function logistics(g){
 box(g,1.81,.16,1.81,'#aac5cf',0,.12,0,.065);
 for(const x of [.28,.81])for(const z of [-.64,.65])box(g,.065,1.35,.065,'#2f719e',x,.88,z);
 for(const y of [.28,.82,1.4])box(g,.67,.065,1.45,'#4289b4',.55,y,0);
 for(let k=0;k<2;k++)for(let i=0;i<4;i++)crate(g,.55,.32+k*.55,-.5+i*.31,.83);
 const rollers=group(g),parcels=[];const path=[[-.63,-.66],[-.63,.64],[.04,.64],[.04,-.66]];
 for(let i=0;i<9;i++){const c=cyl(rollers,.045,.045,.47,'#bdcbd0',-.56,.78-i*.048,-.63+i*.16);c.rotation.z=Math.PI/2;}
 for(const x of [-.85,-.27]){const frame=box(g,.06,.15,1.54,'#557d90',x,.52,0);frame.rotation.x=.291;}
 for(let i=0;i<4;i++)parcels.push(crate(g,-.55,.83-i*.111,-.6+i*.37,.7));
 const pipe=cyl(g,.105,.105,.67,C.metal,-.05,.37,-.15);pipe.rotation.z=Math.PI/2;
 const robot=asset('characters','Robot',{height:.76});let mixer,last=0;
 if(robot){robot.position.set(-.12,.17,.50);g.add(robot);const root=robot.children[0],clip=root.animations.find(c=>c.name.endsWith('Robot_Idle'));if(clip){mixer=new THREE.AnimationMixer(root);mixer.clipAction(clip).play();robot.userData.mixer=mixer;robot.userData.root=root;}}
 return {animate:(t,b,sim)=>{const active=sim?.automatic&&b.working;if(mixer){mixer.update(Math.min(.1,Math.max(0,t-last)));last=t;}parcels.forEach((p,i)=>{if(active){p.position.z=-.64+(t*.36+i*.33)%1.3;p.position.y=.83-(p.position.z+.64)*.3;}});rollers.children.forEach(r=>{if(active)r.rotation.x=t*4;});}};
}
function clinic(g){
 platform(g);box(g,1.36,1.1,1.2,'#ece8d8',0,.7,-.1,.1);box(g,1.59,.16,1.44,'#5c9b9c',0,1.33,-.1);box(g,.38,.69,.045,'#457d89',0,.43,.515);
 for(const x of [-.46,.46])box(g,.28,.32,.035,'#86bdc1',x,.87,.515);
 box(g,.43,.13,.05,'#de7d65',0,1.06,.54);box(g,.13,.43,.05,'#de7d65',0,1.06,.55);
 const flag=box(g,.27,.16,.025,'#eae9d8',.65,1.71,-.3);cyl(g,.02,.02,.58,C.metal,.5,1.58,-.3);
 return {animate:t=>{flag.rotation.y=Math.sin(t*2)*.14;}};
}
function dock(g){
 const pier=group(g);for(let i=0;i<6;i++)box(pier,.94,.07,.145,'#b68f5a',0,.09,(i-2.5)*.15,.018);
 for(const x of [-.39,.39])for(const z of [-.34,.34]){cyl(g,.035,.045,.28,'#806340',x,.11,z);cyl(g,.041,.041,.032,'#c5ac80',x,.26,z);}
 const shelter=group(g,0,.08,-.20);for(const x of [-.32,.32])cyl(shelter,.025,.035,.52,'#916b44',x,.25,0);box(shelter,.79,.065,.44,'#497e9c',0,.55,0,.035);
 const winch=group(g,-.29,.31,.17);cyl(winch,.08,.08,.18,'#5c7781').rotation.z=Math.PI/2;const crank=box(winch,.025,.2,.025,'#dcc08c',-.11,.02,.04,.008);
 for(const x of [.18,.33]){const basket=crate(g,x,.13,.23,.4);const fish=ball(basket,.12,.025,.035,'#82b9cb',0,.33,.02);fish.rotation.y=.25;}
 const net=group(g,-.32,.15,.31);for(let i=0;i<5;i++){beam(net,[-.13+i*.05,0,0],[-.13+i*.05,.23,0],.004,'#dfd3a7');beam(net,[-.13,i*.05,0],[.13,i*.05,0],.004,'#dfd3a7');}
 return {animate:(t,b)=>{if(b.working)crank.rotation.x=t*1.2;net.rotation.x=Math.sin(t)*.035;}};
}
export function makeBuilding(type,race='human'){
 if(BUILDINGS[type]?.tile)return makePixelNetwork(type);
 const pixel=makePixelBuilding(type,race);if(pixel)return pixel;
 currentRace=RACES[race]?race:'human';C.roof=RACES[currentRace].roof;C.cream=RACES[currentRace].wall;C.wood=RACES[currentRace].trim;
 const g=new THREE.Group();g.name=type;const kind=BUILDINGS[type]?.home?'house':type;
 const factory={stable,warehouse,well,field,sawmill,mill,bakery,house,lumber,quarry,generator,workshop,logistics,clinic,dock}[kind];
 g.userData=factory?factory(g):modern(g,type,currentRace);addProductionProps(g,type);g.userData.race=race;if(factory)decorate(g,kind,currentRace);const bounds=new THREE.Box3().setFromObject(g),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());const scale=.94/Math.max(size.x,size.z,.94);g.scale.setScalar(scale);for(const child of g.children){child.position.x-=center.x;child.position.z-=center.z;}return g;
}
function addProductionProps(g,type){
 const d=BUILDINGS[type];if(!d?.period||!RESOURCES[d.output]||['field','well','dock'].includes(type))return;
 const small=['ironmine','coalpit','smelter','oilpump','refinery','chemical','electronics','automotive','laboratory','manaextractor'].includes(type),unit=small?.45:1;
 const output=group(g,.55*unit,.08,.65*unit),items=[];output.scale.setScalar(unit);
 box(output,.48,.05,.34,'#97754e',0,.03,0,.016);
 for(let i=0;i<3;i++){
  let node;const x=(i-1)*.125,y=.10+(i%2)*.035;
  if(['wood','plank','steel','iron'].includes(d.output)){node=box(output,d.output==='steel'?.12:.10,.07,.26,RESOURCES[d.output].color,x,y,0,.018);if(d.output==='steel')box(node,.11,.016,.25,'#e3edf0',0,.038,0,.007);}
  else if(['flour','grain'].includes(d.output))node=sack(output,x,.055,0,.30);
  else if(['oil','fuel','polymer','medicine'].includes(d.output)){node=cyl(output,.052,.055,.16,RESOURCES[d.output].color,x,.14,0,16);cyl(node,.025,.025,.025,'#e2dbc8',0,.092,0);}
  else if(d.output==='circuit'){node=box(output,.11,.023,.19,'#439e7c',x,y,0,.01);box(node,.045,.025,.055,'#36505f',0,.025,0,.005);}
  else if(d.output==='bread')node=ball(output,.045,.035,.08,'#d99a4b',x,.11,0);
  else if(d.output==='car')continue;
  else node=crate(output,x,.06,0,.27);
  if(node)items.push(node);
 }
 const animate=g.userData.animate;g.userData.animate=(t,b,sim)=>{animate?.(t,b,sim);items.forEach((n,i)=>n.visible=(b.out||0)>i*2);};
}
export function makeTree(kind=0,scale=1){
 return makePixelTree(kind,scale);
}
export function makeRock(scale=1,kind='rock'){return makePixelProp(kind,scale);}
export function makeWorker(index=0,race='human',appearance){return character(index,race,appearance);}
export function animateWorker(group,worker,time,camera){animateCharacter(group,worker,time,camera);}

function decorate(g,type,race){
 const r=RACES[race],size=type==='house'||type==='well'||type==='field'?1:2,s=(size-1)*.4+.3;
 const lantern=asset('erdynth','Lantern',{height:.32});if(lantern&&type!=='field'){lantern.position.set(-s,.65,s);g.add(lantern);}
 let moving=null;g.traverse(m=>{if(m.isMesh&&m.material?.color&&!m.userData.asset){const hex=m.material.color.getHexString();if(['407b8c','6c8b55','437f9b','367388','498aa3'].includes(hex))m.material=mat(r.roof);}});
 if(['warehouse','stable','house','bakery','clinic','workshop','sawmill','lumber','logistics'].includes(type)){
  const banner=asset('town','banner-green',{height:size===1?.42:.62,color:r.color});if(banner){banner.position.set(-s,.7,-s);g.add(banner);moving=banner;}
 }
 if(race==='elf'){
  for(const x of [-s,s]){const spire=asset('town','roof-high-point',{width:.3,color:r.roof});if(spire){spire.position.set(x,type==='field'?.15:1.05,-s);g.add(spire);}cyl(g,.035,.045,type==='field'?.3:1.2,r.trim,x,type==='field'?.15:.6,-s,8);}
 }else if(race==='dwarf'){
  for(const x of [-s,s]){const p=asset('town','pillar-stone',{height:type==='field'?.23:.7,color:'#bdab8d'});if(p){p.position.set(x,0,s);p.scale.x*=1.4;p.scale.z*=1.4;g.add(p);}}for(let i=0;i<3;i++)box(g,.18,.14,.13,r.trim,-.23+i*.23,.2,-s);
 }else if(race==='demon'){
  for(const x of [-s,s]){const crystal=mesh(g,new THREE.OctahedronGeometry(type==='field'?.07:.12),'#c27bd8',x,type==='field'?.22:1.3,-s);crystal.scale.y=1.7;g.userData.crystal=crystal;}
 }else if(race==='orc'){
  for(const x of [-s,s]){cyl(g,.04,.1,type==='field'?.32:.8,r.trim,x,type==='field'?.16:.4,s,6);cyl(g,0,.075,.28,'#e4cfac',x,type==='field'?.42:.93,s,5);}
 }else if(['beast','goblin','dragon','aquatic','fae'].includes(race)){
  for(const x of [-s,s]){cyl(g,.06,.1,type==='field'?.24:.6,'#b78447',x,type==='field'?.12:.3,s,8);const pennant=box(g,.2,.14,.02,r.roof,x,type==='field'?.28:.68,s);if(!moving)moving=pennant;}
 }
 const prev=g.userData.animate;g.userData.animate=(t,b,sim)=>{prev?.(['field','house','clinic','dock','stable','warehouse'].includes(type)?t:b?.animationTime??t,b,sim);if(moving)moving.rotation.z=Math.sin(t*1.7)*.035;if(g.userData.crystal)g.userData.crystal.rotation.y=t*.5;};
}

function modern(g,type,race){
 const r=RACES[race],moves=[];
 if(!['rail','windturbine'].includes(type))box(g,.94,.06,.94,['depot','station','magetower'].includes(type)?'#c8b78e':'#c3ced1',0,.015,0,.055);
 if(['steamworks'].includes(type)){box(g,.90,.54,.07,'#ede5ce',0,.30,-.40,.035);box(g,.08,.62,.73,r.trim,-.42,.32,-.055,.025);box(g,.97,.105,.46,r.roof,0,.65,-.25,.045);box(g,.30,.15,.045,'#9bcbd4',.20,.42,-.345,.025);}
 const add=(kind,name,width,x=0,y=0,z=0)=>{const a=asset(kind,name,{width});if(a){a.position.set(x,y,z);g.add(a);}return a;};
 const moving=(node,kind,extra={})=>{if(node)moves.push({node,kind,base:node.position.clone(),...extra});return node;};
 if(type==='rail'){for(const x of [-.25,.25])box(g,.035,.045,.96,'#9ba8ad',x,.07);for(let i=0;i<5;i++)box(g,.75,.045,.08,'#78664e',0,.045,-.4+i*.2);return {animate:()=>{}};}
 if(type==='depot'){add('farm','OpenBarn',.93);for(let i=0;i<3;i++)moving(crate(g,(i-1)*.22,.02,.28,.65),'cargo',{index:i});}
 else if(type==='reservoir'){add('industrial','water-tower',.64);const valve=add('town','wheel',.24,.25,.27,.25);moving(valve,'spin');const water=box(g,.31,.03,.2,'#55bde3',0,.25,.36);moving(water,'pulse');}
 else if(type==='windturbine'){const w=add('industrial','windmill',.85);moving(w?.getObjectByName('blades'),'rotor');}
 else if(type==='steamworks'){add('factory','machine-window',.70,-.16,0,-.15);add('industrial','detail-tank-large',.29,.32,0,-.1);const p=add('factory','piston-square',.33,.24,.03,.27);moving(p?.getObjectByName('top')||p,'press');moving(add('town','wheel',.28,-.24,.35,.34),'spin');}
 else if(type==='magetower'){for(let i=0;i<2;i++)add('town','wall-wood-window-shutters',.70,0,i*.40,-.06);add('town','roof-high-point',.83,0,.90);add('industrial','detail-tank-large',.28,.29,0,.24);const gem=mesh(g,new THREE.OctahedronGeometry(.12),'#bb92f0',0,1.45,0);moving(gem,'magic');const ring=mesh(g,new THREE.TorusGeometry(.21,.016,5,16),'#f0cc72',0,1.39,0);ring.rotation.x=Math.PI/2;moving(ring,'spin');}
 else if(type==='ironmine'){add('factory','hopper-high-round',.45,-.22,0,-.18);const crane=add('factory','crane',.68,.18,0,.04);moving(crane?.getObjectByName('arm'),'swing');const rock=makeRock(.62);rock.position.set(-.2,0,.26);g.add(rock);}
 else if(type==='coalpit'){add('industrial','building-o',.64,-.14,0,-.16);moving(add('trains','train-carriage-coal',.64,.12,.02,.28),'cargo');}
 else if(type==='smelter'){
  for(const x of [-.15,.18]){cyl(g,.125,.15,.58,'#7c94a1',x,.36,-.15,24);cyl(g,.15,.16,.07,'#b6c2c4',x,.2,-.15,24);cyl(g,.11,.14,.10,'#b2bcc0',x,.67,-.15,24);cyl(g,.05,.067,.3,'#596f7a',x,.85,-.15,20);}
  box(g,.38,.22,.22,'#ab8061',.02,.20,.03,.045);const heat=box(g,.22,.09,.026,'#ffa348',.02,.22,.151,.025);moving(heat,'heat');
  const input=add('factory','conveyor-long-stripe-sides',.46,-.25,.05,.22);if(input)input.rotation.y=-.3;
  for(let i=0;i<3;i++){const ore=makeRock(.16);ore.position.set(-.31+i*.08,.15,.25);g.add(ore);moving(ore,'cargo',{index:i});}
  const pipe=beam(g,[.19,.42,-.16],[.33,.42,.21],.035,'#c0b090');
  box(g,.19,.08,.46,'#657c88',.32,.10,.19,.022);for(let i=0;i<5;i++)cyl(g,.023,.023,.18,'#cad2d4',.32,.155,.02+i*.085).rotation.z=Math.PI/2;
 }
 else if(type==='oilpump'){
  box(g,.55,.10,.64,'#879792',-.05,.1,-.07,.04);
  for(const x of [-.18,.14]){beam(g,[x,.12,-.28],[x,.59,-.04],.035,'#5b747f');beam(g,[x,.12,.21],[x,.59,-.04],.035,'#5b747f');}
  const jack=group(g,-.02,.60,-.03);box(jack,.17,.075,.64,'#bd8856',0,0,0,.025);const head=box(jack,.20,.29,.16,'#d3a06c',0,-.045,.34,.06);moving(jack,'swing');
  cyl(g,.012,.012,.56,'#7c8c8a',0,.31,.33);cyl(g,.13,.13,.30,'#526e7a',.29,.20,-.22,24);cyl(g,.133,.133,.035,'#bec6b9',.29,.35,-.22,24);
  const wheel=cyl(g,.095,.095,.055,'#bea267',-.03,.27,-.28);wheel.rotation.x=Math.PI/2;moving(wheel,'spin');
 }
 else if(type==='refinery'){
  for(const [x,z,r,h]of [[-.25,-.18,.14,.80],[.07,-.2,.10,1.03],[.27,.02,.12,.58]]){
   cyl(g,r,r,h,'#b9c6c9',x,h/2+.07,z,24);ball(g,r,r*.48,r,'#d8ddda',x,h+.07,z);for(const y of [.2,.42,.64])if(y<h)cyl(g,r+.009,r+.009,.025,'#657f8a',x,y,z,24);
  }
  beam(g,[-.25,.35,-.18],[-.25,.35,.22],.035,'#b79b61');beam(g,[-.25,.35,.22],[.27,.35,.22],.035,'#b79b61');beam(g,[.27,.35,.22],[.27,.18,.1],.035,'#b79b61');
  const tank=cyl(g,.105,.105,.32,'#538a9a',.04,.18,.23,24);tank.rotation.z=Math.PI/2;moving(tank,'pulse');
  const wheel=group(g,-.30,.29,.25);mesh(wheel,new THREE.TorusGeometry(.066,.012,8,20),'#bb634a');moving(wheel,'spin');
 }
 else if(type==='chemical'){add('industrial','building-h',.64,-.15,0,-.10);add('factory','hopper-high-round',.32,.30,0,.19);add('industrial','detail-tank-large',.3,.27,0,-.23);moving(ball(g,.04,.07,.04,'#a8dfbc',.28,.53,.16),'magic');}
 else if(['automotive','electronics','laboratory'].includes(type)){
  add('factory','conveyor-long-stripe-sides',.94,0,0,.16);
  if(type==='automotive'){for(const x of [-.38,.38])box(g,.055,.61,.055,'#43868f',x,.34,-.3,.015);box(g,.88,.10,.26,'#568d99',0,.66,-.3,.04);for(let i=0;i<3;i++)mesh(g,new THREE.TorusGeometry(.053,.020,8,18),'#415360',.33,.16+i*.10,-.18);const robot=add('factory','robot-arm-a',.45,-.25,0,-.18);moving(robot?.getObjectByName('element-b')||robot,'swing');add('factory','scanner-high',.48,.20,0,.14);moving(add('vehicles','sedan',.50,0,.08,.20),'car');}
  else if(type==='electronics'){box(g,.81,.50,.10,'#e2e8df',0,.32,-.34,.04);box(g,.90,.08,.36,'#598894',0,.61,-.25,.035);add('factory','machine-window',.49,-.17,0,-.18);const robot=add('factory','robot-arm-a',.34,.26,0,-.1);moving(robot?.getObjectByName('element-c')||robot,'swing');const board=box(g,.18,.025,.12,'#62b998',0,.14,.28);moving(board,'cargo');}
  else{add('commercial','building-c',.64,0,0,-.12);for(const x of [-.27,.27]){const tank=add('industrial','detail-tank-large',.20,x,0,.25);moving(tank,'pulse');}moving(ball(g,.06,.09,.06,'#8bc7df',0,.60,.1),'magic');}
 }
 else if(type==='hospital'){add('commercial','building-e',.94);box(g,.19,.055,.035,'#d97867',0,.64,.38);box(g,.055,.19,.035,'#d97867',0,.64,.38);moving(add('vehicles','van',.36,.23,0,.32),'park');}
 else if(type==='bank'){add('commercial','building-c',.90);const coin=cyl(g,.10,.10,.025,'#e8ba58',0,.55,.38);coin.rotation.x=Math.PI/2;moving(coin,'shine');}
 else if(type==='station'){add('farm','Barn',.67,0,0,-.20);add('trains','railroad-straight',.90,0,0,.24);moving(add('trains','train-locomotive-a',.58,-.10,.04,.26),'park');}
 else if(type==='battery'){add('industrial','shipping-container-b',.87);for(let i=0;i<3;i++){const gauge=box(g,.12,.05,.02,'#7ed9b0',-.19+i*.19,.34,.35);moving(gauge,'pulse',{index:i});}}
 else if(type==='barracks'){add('industrial','building-a',.88);add('town','banner-red',.16,-.30,.52,.3);moving(add('vehicles','truck',.35,.23,0,.3),'park');}
 else if(type==='manaextractor'||type==='arcanepower'||type==='leyrelay'){add('industrial',type==='arcanepower'?'detail-tank-large':'water-tower',.55);for(const x of [-.30,.30]){add('town','pillar-stone',.13,x,0,.12);const crystal=mesh(g,new THREE.OctahedronGeometry(type==='arcanepower'?.13:.10),'#bb98e5',x,.60,.1);moving(crystal,'magic');}const ring=mesh(g,new THREE.TorusGeometry(.32,.02,6,20),'#d7bc70',0,.76,0);ring.rotation.x=Math.PI/2;moving(ring,'spin');}
 else{
  // M12 placeholder: a body in the group colour with a band in the output colour; addProductionProps adds the output crates.
  const d=BUILDINGS[type]||{},accent=RESOURCES[d.output]?.color||'#e9dcc0';
  if(d.irrigable)for(let i=0;i<4;i++)moving(box(g,.16,.10,.80,accent,-.3+i*.2,.10,0,.03),'pulse',{index:i});
  else{box(g,.80,.48,.66,PLACEHOLDER_COLORS[d.group]||PLACEHOLDER_COLORS.base,0,.29,-.08,.05);box(g,.88,.09,.74,r.roof,0,.57,-.08,.04);box(g,.82,.07,.02,accent,0,.40,.26,.01);box(g,.18,.26,.02,'#5a4632',-.22,.18,.26,.01);moving(box(g,.12,.08,.02,'#ffe39a',.2,.24,.26,.01),'heat');}
 }
 const flag=add('town','banner-green',.13,-.37,.29,-.3);if(flag){flag.traverse(m=>{if(m.isMesh){m.material=m.material.clone();m.material.color.set(r.color);m.material.map=null;m.material.vertexColors=false;m.userData.ownedMaterial=true;}});moving(flag,'flag');}
 if(['smelter','refinery','steamworks','chemical'].includes(type))for(let i=0;i<2;i++)moving(ball(g,.045,.065,.045,'#ebeff0',.22,.9,-.16),'steam',{index:i});
 return {animate:(t,b,sim)=>{const work=b.working&&b.health!==0&&b.enabled!==false,clock=b.animationTime??t;for(const a of moves){const n=a.node;if(a.kind==='flag')n.rotation.y=Math.sin(t*1.6)*.12;else if(a.kind==='steam'){n.visible=work;n.position.y=a.base.y+(clock*.2+a.index*.20)%.5;}else if(a.kind==='rotor'&&work)n.rotation.z=clock*2.3;else if(a.kind==='spin'&&work)n.rotation.z=clock*1.5;else if(a.kind==='swing'&&work)n.rotation.x=Math.sin(clock*1.8)*.28;else if(a.kind==='press'&&work)n.position.y=a.base.y+Math.sin(clock*4)*.06;else if(a.kind==='car'&&work)n.position.x=a.base.x+Math.sin(clock*.65)*.16;else if(a.kind==='cargo'&&work)n.position.x=a.base.x+Math.sin(clock*.7+(a.index||0))*.055;else if(a.kind==='magic'){n.rotation.y=t*(work?1.3:.25);n.position.y=a.base.y+Math.sin(t*1.7)*.025;}else if(a.kind==='pulse')n.scale.y=work?1+Math.sin(clock*2+(a.index||0))*.04:1;else if(a.kind==='heat')n.visible=work;else if(a.kind==='shine')n.rotation.z=Math.sin(t*.3)*.08;}}};
}
// The west-edge gate that export carts drive through. The road runs along x, so the arch spans z.
export function makeExportGate(){const g=makePixelProp('exportGate');g.name='export-gate';g.userData.oriented=true;g.rotation.y=Math.PI/2;return g;}
export function makeFreightVehicle(mode='truck',item='steel'){const g=makePixelVehicle(mode,item);g.name='freight-'+mode;return g;}
