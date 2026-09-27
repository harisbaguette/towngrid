// Original editable 3D assets for Erdynth. No external meshes or textures.
// All shapes, palettes, articulated pivots and animation curves are authored here.
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import fs from 'node:fs/promises';
import {RESIDENT_LOOKS} from '../app/game/resident-roster.js';

globalThis.FileReader=class {
 readAsArrayBuffer(blob){blob.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();});}
 readAsDataURL(blob){blob.arrayBuffer().then(v=>{this.result='data:'+blob.type+';base64,'+Buffer.from(v).toString('base64');this.onloadend?.();});}
};
const out=new URL('../public/assets/erdynth/',import.meta.url);await fs.mkdir(out,{recursive:true});
const palette={cream:'#fff1d8',gold:'#dba957',navy:'#273d55',skin:'#e7b799',rose:'#bc7578',metal:'#a5b6c3'};
const materialCache=new Map();
function material(c,metal=0){const key=c+':'+metal;if(!materialCache.has(key))materialCache.set(key,new T.MeshStandardMaterial({name:c,color:c,roughness:metal?.27:.42,metalness:metal}));return materialCache.get(key);}
function part(parent,geo,c,x=0,y=0,z=0,metal=0){const m=new T.Mesh(geo,material(c,metal));m.position.set(x,y,z);parent.add(m);return m;}
function group(parent,name,x=0,y=0,z=0){const g=new T.Group();g.name=name;g.position.set(x,y,z);parent?.add(g);return g;}
function ell(parent,c,x,y,z,rx,ry,rz,segments=16){const m=part(parent,new T.SphereGeometry(1,segments,10),c,x,y,z);m.scale.set(rx,ry,rz);return m;}
function rounded(parent,c,x,y,z,w,h,d,r=.035){return part(parent,new RoundedBoxGeometry(w,h,d,3,Math.min(r,w/3,h/3,d/3)),c,x,y,z);}
function cylinder(parent,c,x,y,z,rt,rb,h,metal=0){return part(parent,new T.CylinderGeometry(rt,rb,h,24),c,x,y,z,metal);}
function tube(parent,c,points,r=.015){const curve=new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v)));return part(parent,new T.TubeGeometry(curve,Math.max(8,points.length*3),r,6,false),c);}
function taperedTube(parent,c,points,radii,segments=8){
 const curve=new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v))),steps=points.length*3,frames=curve.computeFrenetFrames(steps,false),p=[],uv=[],index=[];
 for(let i=0;i<=steps;i++){const t=i/steps,v=curve.getPointAt(t),f=t*(radii.length-1),k=Math.min(radii.length-2,Math.floor(f)),r=T.MathUtils.lerp(radii[k],radii[k+1],f-k);
  for(let j=0;j<=segments;j++){const a=j/segments*Math.PI*2,w=v.clone().addScaledVector(frames.normals[i],Math.cos(a)*r).addScaledVector(frames.binormals[i],Math.sin(a)*r);p.push(...w);uv.push(j/segments,t);if(i<steps&&j<segments){const n=i*(segments+1)+j;index.push(n,n+1,n+segments+1,n+1,n+segments+2,n+segments+1);}}
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(index);geo.computeVertexNormals();return part(parent,geo,c);
}
function profile(parent,c,rings,depth=1){
 const geo=new T.LatheGeometry(rings.map(([r,y])=>new T.Vector2(r,y)),28);geo.scale(1,1,depth);return part(parent,geo,c);
}
function face(head,{female,skin,hair,eyes,elf,beard,faceWidth=1,eyeTilt=0}){
 const geo=new T.SphereGeometry(1,28,20),pos=geo.attributes.position;
 for(let i=0;i<pos.count;i++){const y=pos.getY(i),jaw=y<-.2?1+(y+.2)*(female?.16:.07):1;pos.setXYZ(i,pos.getX(i)*.282*jaw*faceWidth,y*.332,pos.getZ(i)*.253);}
 geo.computeVertexNormals();part(head,geo,skin,0,0,0);
 for(const s of [-1,1]){
  if(elf){const ear=ell(head,skin,s*.315,-.022,-.002,.052,.137,.040);ear.rotation.z=-s*.92;const inset=ell(head,'#d7a394',s*.335,-.014,.024,.021,.078,.012);inset.rotation.z=-s*.92;}
  else ell(head,skin,s*.277,-.014,0,.052,.080,.042);
  // Almond eye whites, dark irises and tiny highlights remain readable from above.
  const eye=group(head,'Eye'+s,s*.106,.017,.232);eye.rotation.y=s*.22;eye.rotation.z=s*eyeTilt;
  ell(eye,'#fff8ef',0,0,0,female?.069:.058,female?.039:.033,.013);
  ell(eye,eyes,.001,-.002,.011,.029,.033,.009);ell(eye,'#24313b',.003,-.001,.019,.016,.025,.005);
  ell(eye,'#ffffff',-.009,.012,.025,.007,.009,.003,12);
  tube(eye,hair,[[-.060,.024,.005],[-.026,.047,.012],[.023,.046,.014],[.064,.019,.008]],female?.007:.006);
  if(female)tube(eye,hair,[[s*.052,.030,.007],[s*.073,.044,.005],[s*.081,.052,0]],.006);
  tube(head,hair,[[s*.056,.102,.242],[s*.108,.119,.240],[s*.158,.103,.220]],female?.008:.012);
  const cheek=ell(head,female?'#e8a39a':'#e7ac97',s*.166,-.080,.200,.036,.015,.003);cheek.rotation.y=s*.42;
 }
 ell(head,skin,0,-.065,.251,.026,.037,.027);ell(head,'#f4cbb0',-.006,-.058,.275,.012,.018,.005);
 tube(head,female?'#b77679':'#a87369',[[-.037,-.145,.226],[0,-.151,.237],[.037,-.143,.226]],.008);
 if(female)ell(head,'#e7a1a0',0,-.161,.230,.026,.009,.006,12);
 if(beard){for(let i=-3;i<=3;i++){const x=i*.050;ell(head,hair,x,-.21+Math.abs(i)*.012,.180- Math.abs(i)*.009,.051,.095- Math.abs(i)*.006,.062);}
  for(const s of [-1,1]){const moustache=ell(head,hair,s*.045,-.124,.256,.055,.026,.017);moustache.rotation.z=s*.25;}}
}
function hairStyle(head,{hair,female,style,elf}){
 // Scalloped hair cap: a swept front fringe and a lower nape at the back.
 const geo=new T.BufferGeometry(),verts=[],indices=[],rings=12,segs=36;
 for(let j=0;j<=rings;j++)for(let i=0;i<=segs;i++){const a=i/segs*Math.PI*2,front=Math.max(0,Math.cos(a)),phi=(1.74-front*.55+front*Math.sin(a*2)*.16)*j/rings;verts.push(Math.sin(phi)*Math.sin(a)*.324,Math.cos(phi)*.367,Math.sin(phi)*Math.cos(a)*.292-.005);if(j<rings&&i<segs){const k=j*(segs+1)+i;indices.push(k,k+segs+1,k+1,k+1,k+segs+1,k+segs+2);}}
 geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setIndex(indices);geo.computeVertexNormals();part(head,geo,hair);
 const shine=new T.Color(hair).lerp(new T.Color('#efc19c'),.12).getStyle();
 for(let i=0;i<4;i++){const x=-.22+i*.105;taperedTube(head,hair,[[x,.29,.11],[x-.065,.19,.255],[x-.095,.08+(i%2)*.06,.257]],[.063,.062,.003],10);}
 if(female){
  if(style==='bob'){for(const s of [-1,1])taperedTube(head,hair,[[s*.24,.20,-.03],[s*.286,-.02,.028],[s*.27,-.28,.055],[s*.20,-.36,.08]],[.075,.095,.080,.010],10);}
  else if(style==='braids'){for(const s of [-1,1]){for(let i=0;i<7;i++){const lock=ell(head,hair,s*(.272+(i%2)*.014),-.12-i*.07,.016+(i%2)*.020,.052-i*.003,.058,.054-i*.003,14);lock.rotation.z=s*.22;}rounded(head,palette.gold,s*.285,-.54,.02,.072,.035,.066,.014);}}
  else {for(const s of [-1,1]){
   taperedTube(head,hair,[[s*.23,.20,-.075],[s*.29,-.08,-.01],[s*.25,-.31,.08],[s*.32,-.47,.06],[s*.27,-.56,.11]],[.085,.083,.075,.053,.003],10);
   taperedTube(head,shine,[[s*.267,.15,-.009],[s*.318,-.07,.035],[s*.278,-.28,.12],[s*.343,-.44,.09]],[.008,.01,.008,.001],6);
  }for(let i=-1;i<=1;i++)taperedTube(head,hair,[[i*.13,.14,-.22],[i*.16,-.15,-.22],[i*.17,-.44,-.16],[i*.14,-.53,-.12]],[.095,.095,.07,.005],10);}
  const ornament=group(head,'HairJewel',-.244,.08,.155);ell(ornament,elf?'#bbd1a0':'#dc9c92',0,0,0,.058,.025,.026);ell(ornament,palette.gold,.033,-.015,.012,.018,.018,.015,12);
 }else{taperedTube(head,hair,[[-.12,.25,.15],[.02,.38,.065],[.21,.29,-.035]],[.11,.09,.002],12);}
}
function wardrobe(body,spec){
 const {female,coat,trim,style,armor,race}=spec;
 const elf=race==='elf'||race==='spirit'||race==='fae',engineer=race==='dwarf',mage=style==='mage';
 const shirt=elf?'#e4ede0':female?'#f4e8d3':'#d8d6ca';
 profile(body,shirt,[[0,.85],[.19,.85],[.16,1.1],[.17,1.27],[.225,1.37],[.20,1.42],[.08,1.44],[0,1.44]],.66);
 // Different constructed clothing silhouettes, rather than a shared recolored tunic.
 if(female&&!armor&&!engineer){
  profile(body,coat,[[0,.66],[.265,.67],[.26,.72],[.18,.98],[.155,1.09],[.16,1.23],[.20,1.32],[.18,1.38],[.095,1.39]],.72);
  const front=rounded(body,shirt,0,1.285,.129,.17,.21,.024,.026);front.rotation.x=.04;
  for(const side of [-1,1])tube(body,trim,[[side*.10,1.38,.115],[side*.17,1.25,.117],[side*.155,1.10,.125],[side*.23,.70,.14]],.012);
  if(!elf){rounded(body,'#e4d6b5',0,.87,.167,.22,.25,.025,.03);rounded(body,trim,0,.87,.185,.13,.10,.017,.014);}
 }else if(engineer){
  profile(body,coat,[[0,.80],[.23,.81],[.24,1.14],[.26,1.34],[.20,1.4],[.08,1.44]],.80);
  rounded(body,'#997047',0,1.06,.195,.35,.50,.032,.035);
  for(const x of [-.115,.115])rounded(body,'#be965c',x,1.31,.181,.035,.28,.021,.008);
  rounded(body,'#735536',0,1.04,.223,.26,.10,.028,.012);
  for(const x of [-.085,0,.085])rounded(body,'#bcc5c7',x,1.07,.251,.035,.15,.027,.009);
 }else{
  profile(body,coat,[[0,.80],[.225,.81],[.217,1.06],[.21,1.22],[.25,1.36],[.225,1.42],[.105,1.45]],.69);
  for(const side of [-1,1]){const lapel=rounded(body,trim,side*.084,1.30,.154,.09,.23,.026,.018);lapel.rotation.z=side*.22;rounded(body,trim,side*.15,1.12,.153,.10,.045,.028,.012);}
  rounded(body,'#56626b',0,1.08,.161,.022,.52,.016,.006);
 }
 rounded(body,'#69513e',0,1.07,.004,female?.343:.40,.055,.29,.024);rounded(body,palette.gold,0,1.07,.160,.060,.057,.019,.010);
 for(const y of [1.18,1.27])ell(body,palette.gold,.035,y,.156,.009,.009,.006,12);
 if(mage){profile(body,coat,[[0,.48],[.275,.49],[.29,.54],[.21,.91],[.155,1.10]],.70);tube(body,trim,[[-.22,.54,.14],[0,.52,.20],[.22,.54,.14]],.018);}
 if(elf){const cape=profile(body,coat,[[.10,1.43],[.24,1.36],[.24,1.25],[.21,1.18]],.75);cape.position.z=-.055;ell(body,palette.gold,0,1.38,.18,.028,.034,.011);}
 if(armor){rounded(body,'#bccbd2',0,1.25,.093,.375,.34,.15,.06);tube(body,palette.gold,[[-.17,1.39,.165],[0,1.20,.210],[.17,1.39,.165]],.010);ell(body,trim,0,1.31,.202,.025,.04,.010);profile(body,'#688494',[[.20,.84],[.21,.91],[.19,1.07]],.73);}
 const pouch=rounded(body,'#98724e',-.20,.99,.015,.091,.124,.100,.025);pouch.rotation.z=.1;ell(body,palette.gold,-.20,1.007,.074,.009,.009,.006,12);
}
function resident(race,look){
 const female=look.gender==='female'||look.gender==='neutral';
 const variants={
  mira:{hair:'#704838',coat:'#477f79',trim:'#efcc96',style:'waves'},rowan:{hair:'#574332',coat:'#56798d',trim:'#e4c9a5'},
  hana:{hair:'#302e48',coat:'#6b5c87',trim:'#d7b575',style:'mage'},ethan:{hair:'#88614a',coat:'#7c584b',trim:'#d6b782',armor:true},
  marna:{hair:'#b16c43',coat:'#897556',trim:'#e6c88b',style:'braids'},bron:{hair:'#774932',coat:'#526779',trim:'#bca47d',beard:true},
  vera:{hair:'#e7d7ba',coat:'#577890',trim:'#dbb879',armor:true},taron:{hair:'#586073',coat:'#455b74',trim:'#d4b16e',armor:true,beard:true},
  silen:{hair:'#e0d5b4',coat:'#699276',trim:'#eedeb0',style:'waves'},ael:{hair:'#d5c399',coat:'#547b71',trim:'#e6c990'},
  lien:{hair:'#879dab',coat:'#658795',trim:'#dccda6',style:'bob'},elion:{hair:'#5e5949',coat:'#4d7261',trim:'#bea56e'},
  dew:{hair:'#c9e8dc',coat:'#87c4ba',trim:'#eef5d2',style:'waves'},mist:{hair:'#bfcede',coat:'#909fc0',trim:'#e2e6f2',style:'bob'},
  lana:{hair:'#8e503b',coat:'#62877d',trim:'#edc294',style:'braids'},kai:{hair:'#534034',coat:'#778361',trim:'#debb87'},
  fia:{hair:'#e8c497',coat:'#ac83a7',trim:'#f0d49c',style:'bob'},eil:{hair:'#83969e',coat:'#638e9c',trim:'#e3cba4'}
 };
 const spec={female,race,faceWidth:race==='dwarf'?1.10:race==='elf'?.93:look.id==='hana'?.96:1,eyeTilt:race==='elf'?.06:0,skin:race==='titan'?'#c6c1b7':race==='spirit'?'#c8dfd5':palette.skin,eyes:race==='elf'?'#527d6a':'#486676',elf:['elf','fae','centaur'].includes(race),...variants[look.id]};
 const root=new T.Group();root.name='Erdynth_'+look.id;
 const body=group(root,'Body'),torso=group(body,'Torso');wardrobe(torso,spec);cylinder(torso,spec.skin,0,1.47,0,.085,.092,.16);
 const head=group(torso,'Head',0,1.77,0);head.scale.setScalar(female?.94:.97);face(head,spec);hairStyle(head,{...spec,style:spec.style==='mage'?'bob':spec.style});
 if(spec.style==='mage'){
  cylinder(head,spec.coat,0,.30,-.016,.40,.40,.04);const hat=profile(head,spec.coat,[[.30,.31],[.27,.35],[.15,.57],[.05,.75],[.005,.78]],.95);hat.rotation.z=-.10;
  cylinder(head,spec.trim,0,.367,-.015,.247,.259,.042);ell(head,palette.gold,0,.373,.24,.026,.03,.015);
 }
 const width=race==='dwarf'?1.19:race==='titan'?1.12:1;
 const pivots={};
 for(const [side,suffix]of[[-1,'L'],[1,'R']]){
  const arm=pivots['Arm'+suffix]=group(torso,'Arm'+suffix,side*.285,1.36,0);arm.rotation.z=side*.13;
  const sleeve=part(arm,new T.CapsuleGeometry(spec.armor?.086:female?.062:.074,.16,6,16),spec.armor?'#adbdc7':spec.coat,0,-.115,0);cylinder(arm,spec.trim,0,-.238,0,female?.063:.076,female?.063:.076,.036);if(spec.armor)tube(arm,palette.gold,[[-.07,-.025,.07],[0,.022,.09],[.07,-.025,.07]],.010);
  const fore=pivots['Fore'+suffix]=group(arm,'Fore'+suffix,0,-.27,0);
  part(fore,new T.CapsuleGeometry(female?.045:.053,.13,6,16),spec.skin,0,-.102,0);cylinder(fore,spec.trim,0,-.18,0,.053,.054,.037);
  rounded(fore,spec.skin,0,-.253,.010,female?.080:.095,.105,.058,.028);ell(fore,spec.skin,-side*.037,-.236,.027,.018,.035,.021,16);
  if(race!=='centaur'){
   const leg=pivots['Leg'+suffix]=group(body,'Leg'+suffix,side*.115,.88,0);
   ell(leg,'#4b5661',0,-.19,0,.092,.24,.094);
   const knee=pivots['Knee'+suffix]=group(leg,'Knee'+suffix,0,-.39,0);ell(knee,'#4b5661',0,-.125,0,.071,.17,.073);
   cylinder(knee,spec.armor?'#8a9dab':'#6d5142',0,-.236,0,.072,.070,.23);ell(knee,spec.armor?'#8a9dab':'#6d5142',0,-.365,.049,.078,.05,.126,20);rounded(knee,'#443e38',0,-.403,.039,.159,.035,.236,.014);rounded(knee,spec.trim,0,-.205,.074,.076,.025,.015,.008);
  }
 }
 if(race==='dwarf'){torso.scale.set(1.14,.88,1.13);torso.position.y=-.13;for(const side of ['L','R']){pivots['Leg'+side].scale.y=.66;pivots['Leg'+side].position.y=.57;}body.scale.x=1.15;}
 if(race==='titan')body.scale.set(width,1.05,1.08);
 if(race==='centaur'){
  torso.position.set(0,.02,.24);
  ell(body,'#98654c',0,.60,-.15,.25,.24,.48);ell(body,'#b57d56',0,.65,.20,.21,.28,.23);
  rounded(body,'#425e56',0,.83,-.22,.40,.05,.43,.04);for(const s of [-1,1])rounded(body,'#a57d50',s*.244,.67,-.20,.13,.24,.29,.04);
  for(let i=0;i<4;i++){const x=i%2?.17:-.17,z=i<2?.15:-.43,leg=pivots['Hoof'+i]=group(body,'Hoof'+i,x,.58,z);ell(leg,'#966347',0,-.16,0,.060,.20,.063);ell(leg,'#b27f5a',0,-.38,.028,.047,.14,.05);rounded(leg,'#4b4141',0,-.515,.045,.103,.11,.135,.035);}
  taperedTube(body,spec.hair,[[0,.75,-.53],[0,.67,-.77],[.035,.43,-.8],[.08,.26,-.77]],[.065,.06,.045,.003],10);
 }
 if(race==='fae')for(const s of [-1,1]){const wing=group(torso,'Wing'+(s<0?'L':'R'),s*.12,1.25,-.08);const mesh=ell(wing,spec.trim,s*.16,.06,-.065,.18,.36,.026);mesh.rotation.z=-s*.5;ell(wing,'#d9c8e4',s*.14,-.19,-.08,.14,.19,.020);}
 if(race==='spirit'){for(let i=0;i<3;i++){const orbit=group(root,'Spark'+i);ell(orbit,'#eef4c8',Math.cos(i*2.1)*.44,1.28+i*.16,Math.sin(i*2.1)*.34,.033,.033,.033,12);}}
 root.userData={creator:'Erdynth original',identity:look.id,race,gender:look.gender};
 const clips=animations(pivots,race);return {root,clips};
}
function animations(pivots,race){
 const make=(name,duration,walking=false,carry=false,work=false)=>{
  const tracks=[],frames=17,times=Float32Array.from({length:frames},(_,i)=>i*duration/(frames-1));
  const rotation=(node,axis,fn)=>{const values=[];for(let i=0;i<frames;i++){const q=new T.Quaternion().setFromEuler(new T.Euler(axis==='x'?fn(i/(frames-1)):0,axis==='y'?fn(i/(frames-1)):0,axis==='z'?fn(i/(frames-1)):0));values.push(...q);}tracks.push(new T.QuaternionKeyframeTrack(node+'.quaternion',times,values));};
  for(const[suffix,s]of[['L',1],['R',-1]]){
   rotation('Arm'+suffix,'x',p=>carry?-1.04:work?-.7+Math.sin(p*Math.PI*4)*.6:walking?Math.sin(p*Math.PI*2)*.55*s:.04+Math.sin(p*Math.PI*2)*.025*s);
   rotation('Fore'+suffix,'x',p=>carry?-.56:work?-.48:walking?-.16-Math.max(0,Math.sin(p*Math.PI*2)*s)*.2:-.13);
   if(pivots['Leg'+suffix]){rotation('Leg'+suffix,'x',p=>walking?-Math.sin(p*Math.PI*2)*.62*s:0);rotation('Knee'+suffix,'x',p=>walking?Math.max(0,Math.sin(p*Math.PI*2)*s)*.8:0);}
   if(race==='fae')rotation('Wing'+suffix,'y',p=>Math.sin(p*Math.PI*4)*.4*s);
  }
  if(race==='centaur')for(let i=0;i<4;i++)rotation('Hoof'+i,'x',p=>walking?Math.sin(p*Math.PI*2+(i===0||i===3?0:Math.PI))*.5:0);
  rotation('Head','y',p=>walking?Math.sin(p*Math.PI*2)*.018:Math.sin(p*Math.PI*2)*.07);
  const values=[];for(let i=0;i<frames;i++){const p=i/(frames-1);values.push(0,walking?Math.abs(Math.sin(p*Math.PI*2))*.025:Math.sin(p*Math.PI*2)*.006,0);}tracks.push(new T.VectorKeyframeTrack('Body.position',times,values));
  return new T.AnimationClip(name,duration,tracks);
 };
 const pickup=make('Pickup',.55,false,false,true),drop=make('Drop',.55,false,true,true);
 for(const clip of [pickup,drop]){const times=Float32Array.from([0,.14,.3,.45,.55]),values=[];for(const y of [0,-.07,-.12,-.05,0])values.push(0,y,0);clip.tracks=clip.tracks.filter(t=>t.name!=='Body.position');clip.tracks.push(new T.VectorKeyframeTrack('Body.position',times,values));}
 return [make('Idle',3.2),make('Walk',.88,true),make('Walk_Carry',1.03,true,true),make('Work',1.4,false,false,true),pickup,drop,make('Attack',.7,false,false,true)];
}
function boat(patrol=false){
 const g=new T.Group();g.name=patrol?'PatrolBoat':'Tugboat';
 const hull=patrol?'#899cae':'#c9544a',deck=patrol?'#bdc8cd':'#5ea6c5',upper=patrol?'#d6dbda':'#f4f1e8';
 // Elliptical plan with a raised, narrowing bow; rings are one continuous hull.
 const p=[],indices=[],rings=8,segs=48;
 for(let j=0;j<=rings;j++)for(let i=0;i<=segs;i++){const a=i/segs*Math.PI*2,t=j/rings,r=.62+.38*Math.sin(t*Math.PI/2),z=Math.cos(a),bow=Math.max(0,z);p.push(Math.sin(a)*.52*r*(1-bow*.26),.05+t*.47+bow*.07,z*1.06*r);if(j<rings&&i<segs){const n=j*(segs+1)+i;indices.push(n,n+1,n+segs+1,n+1,n+segs+2,n+segs+1);}}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setIndex(indices);geo.computeVertexNormals();part(g,geo,hull);
 ell(g,hull,0,.075,0,.32,.11,.67,32);const deckGeo=new T.CylinderGeometry(1,1,.045,48),deckPos=deckGeo.attributes.position;for(let i=0;i<deckPos.count;i++){const z=deckPos.getZ(i);deckPos.setXYZ(i,deckPos.getX(i)*.48*(1-Math.max(0,z)*.26),deckPos.getY(i),z*1.01);}deckGeo.computeVertexNormals();part(g,deckGeo,deck,0,.505,0);
 // Continuous raised gunwale and rubber rubbing strip.
 for(const [color,y,rad]of[[hull,.53,.045],['#405565',.30,.017]]){const pts=[];for(let i=0;i<=48;i++){const a=i/48*Math.PI*2,z=Math.cos(a);pts.push([Math.sin(a)*(y<.4?.47:.515)*(1-Math.max(0,z)*.26),y+Math.max(0,z)*.07,z*(y<.4?.96:1.05)]);}tube(g,color,pts,rad);}
 rounded(g,deck,0,.735,-.19,.81,.42,.86,.085);rounded(g,upper,0,1.06,-.28,.67,.31,.63,.065);
 rounded(g,'#345063',0,1.08,.045,.47,.135,.018,.035);for(const x of [-.15,0,.15])rounded(g,'#90a4b0',x,1.08,.058,.014,.133,.012,.003);
 for(const s of [-1,1]){for(const z of [-.43,-.10]){const porthole=cylinder(g,'#b7d4df',s*.411,.72,z,.101,.101,.02,.3);porthole.rotation.z=Math.PI/2;const glass=cylinder(g,'#33586b',s*.425,.72,z,.077,.077,.023);glass.rotation.z=Math.PI/2;}
  const tire=part(g,new T.TorusGeometry(.12,.035,8,20),'#40505a',s*.50,.37,-.38);tire.rotation.y=Math.PI/2;
 }
 cylinder(g,patrol?'#6e8294':'#e3a45f',0,1.355,-.34,.13,.14,.31);cylinder(g,'#465766',0,1.515,-.34,.112,.112,.023);
 const ring=part(g,new T.TorusGeometry(.103,.024,8,24),'#eacab0',0,.99,-.611);for(const x of [-.3,.3])cylinder(g,'#586b73',x,.59,.56,.033,.033,.14);
 if(patrol){const turret=group(g,'Turret',0,.62,.55);cylinder(turret,'#63788e',0,.04,0,.17,.20,.12);rounded(turret,'#aebcc4',0,.15,0,.27,.17,.29,.055);const barrel=cylinder(turret,'#657b8d',0,.16,.25,.032,.035,.4,.4);barrel.rotation.x=Math.PI/2;cylinder(g,'#596c7d',0,1.62,-.34,.012,.012,.40);rounded(g,'#8193a2',0,1.82,-.34,.25,.037,.05,.016);}
 else {const propeller=group(g,'Propeller',0,.20,-.96);for(let i=0;i<3;i++){const blade=ell(propeller,palette.gold,0,.076,0,.025,.10,.014,12);blade.rotation.z=i*Math.PI*2/3;}ring.name='LifeRing';}
 return g;
}
function lighthouse(){
 const g=new T.Group();g.name='Lighthouse';
 profile(g,'#c59a58',[[0,0],[.52,0],[.56,.035],[.56,.14],[.52,.18],[0,.18]]);
 profile(g,'#eee1c3',[[0,.16],[.39,.16],[.4,.21],[.275,1.42],[.26,1.46],[0,1.46]]);
 for(const [y,w,h]of[[.35,.11,.27],[.78,.08,.20],[1.12,.075,.17]]){const surface=.4-(y-.21)*.125/1.21;const frame=rounded(g,'#d6bf96',0,y,surface+.008,w+.04,h+.03,.05,.04);const glass=rounded(g,'#354b61',0,y,surface+.038,w,h,.02,.038);frame.rotation.x=glass.rotation.x=-Math.atan(.125/1.21);}
 profile(g,'#bd5145',[[0,1.43],[.37,1.43],[.41,1.48],[.41,1.59],[.38,1.62],[0,1.62]]);
 const lens=cylinder(g,'#ffc665',0,1.84,0,.21,.21,.45);lens.material=new T.MeshStandardMaterial({color:'#ffe4a1',emissive:'#ffbf50',emissiveIntensity:.8,roughness:.22});
 for(let i=0;i<6;i++){const a=i*Math.PI/3;cylinder(g,'#b64d41',Math.cos(a)*.25,1.84,Math.sin(a)*.25,.025,.025,.49);}
 profile(g,'#c45a49',[[0,2.06],[.34,2.06],[.39,2.11],[.36,2.16],[.22,2.30],[.06,2.47],[0,2.49]]);ell(g,'#c45a49',0,2.48,0,.061,.066,.061);
 const beacon=group(g,'Beacon',0,1.85,0);
 for(const s of [-1,1]){const beam=part(beacon,new T.ConeGeometry(.25,.62,20,1,true),'#f9d184',s*.56,0,0);beam.rotation.z=s*Math.PI/2;beam.material=new T.MeshBasicMaterial({color:'#f9d184',transparent:true,opacity:.18,side:T.DoubleSide,depthWrite:false});}
 return g;
}
function tool(name){
 const g=new T.Group();g.name=name;
 if(name==='Pickaxe'||name==='Axe'||name==='Hammer'){
  const handle=rounded(g,'#dc963e',0,.40,0,.13,.74,.12,.055);handle.rotation.z=-.08;rounded(g,'#ae6d34',.025,.14,.003,.14,.20,.125,.05);
  const collar=cylinder(g,'#abbcc9',-.022,.79,0,.095,.095,.17,.55);collar.rotation.z=-.08;
  if(name==='Pickaxe'){const head=taperedTube(g,'#a5b7c8',[[-.54,.70,0],[-.30,.89,0],[0,.95,0],[.30,.89,0],[.54,.70,0]],[.007,.055,.073,.055,.007],12);head.material=material('#a5b7c8',.48);rounded(g,'#c8aa80',0,.87,.041,.17,.17,.10,.025);}
  if(name==='Axe'){const shape=new T.Shape();shape.moveTo(-.06,.67);shape.quadraticCurveTo(-.45,.62,-.48,.92);shape.quadraticCurveTo(-.2,1.00,-.06,.94);shape.lineTo(.12,.93);shape.lineTo(.12,.74);shape.closePath();const blade=part(g,new T.ExtrudeGeometry(shape,{depth:.04,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:3,steps:1,curveSegments:12}),'#a7bcc8',0,0,-.02,.5);}
  if(name==='Hammer'){rounded(g,'#a6b8c6',0,.87,0,.49,.21,.23,.055);rounded(g,'#c2ced3',-.23,.87,0,.07,.25,.27,.025);}
 }else if(name==='Lantern'){
  rounded(g,'#c09757',0,.05,0,.28,.08,.24,.025);rounded(g,'#f0cc81',0,.20,0,.18,.25,.16,.02);
  for(const x of [-.12,.12])for(const z of [-.10,.10])cylinder(g,'#9c804f',x,.20,z,.017,.017,.30);
  profile(g,'#967447',[[0,.34],[.17,.34],[.17,.38],[.08,.47],[0,.47]]);const ring=part(g,new T.TorusGeometry(.066,.012,6,18),'#99764c',0,.51,0);
 }else if(name==='Bucket'){
  profile(g,'#859caa',[[0,0],[.105,0],[.15,.26],[.14,.285],[.127,.27],[.11,.045],[0,.035]]);
  const handle=part(g,new T.TorusGeometry(.147,.012,6,20,Math.PI),'#b2bec4',0,.26,0,.4);handle.rotation.z=0;
 }return g;
}
const exporter=new GLTFExporter(),manifest=[];
async function save(name,root,animations=[]){root.updateMatrixWorld(true);const data=await exporter.parseAsync(root,{binary:true,animations});await fs.writeFile(new URL(name+'.glb',out),Buffer.from(data));let triangles=0,meshes=0;root.traverse(m=>{if(m.isMesh){meshes++;triangles+=(m.geometry.index?.count||m.geometry.attributes.position.count)/3;}});manifest.push({name,bytes:data.byteLength,triangles,meshes,clips:animations.map(c=>c.name)});}
for(const [race,looks]of Object.entries(RESIDENT_LOOKS))for(const look of looks){const {root,clips}=resident(race,look);await save('Resident_'+look.id,root,clips);}
await save('Tugboat',boat());await save('PatrolBoat',boat(true));await save('Lighthouse',lighthouse());
for(const name of ['Pickaxe','Axe','Hammer','Lantern','Bucket'])await save(name,tool(name));
await fs.writeFile(new URL('manifest.json',out),JSON.stringify({creator:'Original Erdynth assets',source:'scripts/build-erdynth-assets.mjs',assets:manifest},null,2));
console.log(JSON.stringify({assets:manifest.length,bytes:manifest.reduce((s,x)=>s+x.bytes,0),maxTriangles:Math.max(...manifest.map(x=>x.triangles))}));
