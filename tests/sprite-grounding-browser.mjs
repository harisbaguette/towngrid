// node tests/sprite-grounding-browser.mjs <playwright/index.mjs> <chrome.exe>
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const out='docs/verification/sprite-grounding-20260930';await mkdir(out,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1320,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.TOWNGRID_URL||'http://localhost:5173')+'/art-preview.html');
 await page.waitForFunction(()=>window.artPreview?.entries.length>0);
 const result=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {loadPixelCharacters,createPixelCharacter,animatePixelCharacter}=await import('/src/app/game/pixel-characters.js');
  const {advanceCharacterRoute}=await import('/src/app/game/character-movement.js');
  const {loadPixelEnvironment,makePixelVehicle,makePixelBuilding}=await import('/src/app/game/pixel-environment.js');
  const {QUARTER_POLAR,quarterAzimuth}=await import('/src/app/game/quarter-camera.js');
  const {SoftwareRenderer}=await import('/src/app/game/software-renderer.js');
  await Promise.all(['human','dwarf','titan','centaur'].map(loadPixelCharacters));await loadPixelEnvironment();
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:false,preserveDrawingBuffer:true});renderer.setSize(240,240);renderer.setPixelRatio(1);renderer.setClearColor(0x000000,0);
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,100);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshBasicMaterial({color:0xff00ff,toneMapped:false}));floor.rotation.x=-Math.PI/2;floor.position.y=.026;scene.add(floor);
  const canvas=document.createElement('canvas');canvas.width=240;canvas.height=240;const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const pixels=()=>{renderer.render(scene,camera);ctx.clearRect(0,0,240,240);ctx.drawImage(renderer.domElement,0,0);return ctx.getImageData(0,0,240,240).data;};
  const lost=(reference,actual)=>{let n=0;for(let i=0;i<reference.length;i+=4)if(reference[i+3]>250&&actual[i]===255&&actual[i+1]===0&&actual[i+2]===255)n++;return n;};
  const report={samples:0,legacyClippedPixels:0,clippedPixels:0,trainClippedPixels:0,cpuAnchorError:0,frontOccludedPixels:0,behindOccludedPixels:0,legacyBuildingOccludedPixels:0},cards=[];
  const shot=(label)=>{floor.material.color.set('#8fba67');renderer.render(scene,camera);cards.push({label,url:renderer.domElement.toDataURL()});floor.material.color.set(0xff00ff);};
  for(const [id,race] of [['mira','human'],['bron','dwarf'],['taron','titan'],['kai','centaur']]){
   const model=createPixelCharacter(0,race,id);model.userData.shadow.visible=false;scene.add(model);
   const w={id:1,x:0,z:0,dir:0,walking:true,route:[]};
   for(let view=0;view<4;view++){
    camera.position.setFromSphericalCoords(20,QUARTER_POLAR,quarterAzimuth(view)).add(new THREE.Vector3(0,.55,0));camera.lookAt(0,.55,0);camera.updateMatrixWorld();
    for(const action of ['walk','carry','work'])for(let step=0;step<12;step++){
     w.route=[{x:w.x,z:w.z+.035}];advanceCharacterRoute(w,1,.035);w.x=w.z=0;w.walking=action!=='work';w.working=action==='work';w.task=action==='carry'?{carried:true}:null;
     animatePixelCharacter(model,w,step*.1+view*10,camera);
     floor.visible=false;const reference=pixels();floor.visible=true;
     report.clippedPixels+=lost(reference,pixels());report.samples++;
     const fixed=model.userData.sprite.position.clone();model.userData.sprite.position.set(0,.035,0);
     report.legacyClippedPixels+=lost(reference,pixels());
     if(view===0&&action==='walk'&&step===0)shot(id+' · 수정 전');
     model.userData.sprite.position.copy(fixed);
     if(view===0&&action==='walk'&&step===0)shot(id+' · 수정 후');
     // The software renderer must use the projected anchor, not world Y as a pixel lift.
     const cpu=new SoftwareRenderer();cpu.setSize(240,240);cpu.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);cpu.pixelsPerWorldUnit=120;
     const calls=[],original=cpu.ctx.drawImage.bind(cpu.ctx);cpu.ctx.drawImage=(...args)=>{calls.push(args);original(...args);};
     const center=cpu.project(model.position.x,model.position.y,model.position.z);cpu.drawPixelCharacter(model,center);
     const pos=model.userData.sprite.getWorldPosition(new THREE.Vector3()),anchor=cpu.project(pos.x,pos.y,pos.z),size=Math.round(model.userData.sprite.scale.y*120),draw=calls[0];
     if(draw[7]!==size||draw[8]!==size)throw Error(`${id}: CPU must preserve the WebGL sprite extent`);
     report.cpuAnchorError=Math.max(report.cpuAnchorError,Math.abs(draw[5]+size*model.userData.sprite.center.x-anchor.x),Math.abs(draw[6]+size*(1-model.userData.sprite.center.y)-anchor.y));
    }
   }
   scene.remove(model);
  }
  const building=makePixelBuilding('sawmill'),resident=createPixelCharacter(0,'human','mira');resident.userData.shadow.visible=false;scene.add(building,resident);building.position.y=.01;
  const covered=(reference,actual)=>{let n=0;for(let i=0;i<reference.length;i+=4)if(reference[i+3]===255&&(reference[i]!==actual[i]||reference[i+1]!==actual[i+1]||reference[i+2]!==actual[i+2]))n++;return n;};
  for(let view=0;view<4;view++)for(const side of [1,-1]){
   const angle=quarterAzimuth(view);camera.position.setFromSphericalCoords(20,QUARTER_POLAR,angle).add(new THREE.Vector3(0,.55,0));camera.lookAt(0,.55,0);camera.updateMatrixWorld();
   building.userData.animate(0,{type:'sawmill',health:100,enabled:true,working:false,out:0,progress:0},{time:0},view);
   animatePixelCharacter(resident,{id:99,x:Math.sin(angle)*.4*side,z:Math.cos(angle)*.4*side,dir:0,walking:true},0,camera);
   building.visible=false;floor.visible=false;const reference=pixels();building.visible=true;floor.visible=true;
   report[side===1?'frontOccludedPixels':'behindOccludedPixels']+=covered(reference,pixels());
   if(side===1){
    const characterPosition=resident.userData.sprite.position.clone(),buildingPosition=building.userData.sprite.position.clone();
    resident.userData.sprite.position.set(0,.035,0);resident.userData.sprite.material.depthWrite=false;
    const lift=(181/192-.69)*1.4*Math.sin(QUARTER_POLAR)+.01;
    building.userData.sprite.position.setFromSphericalCoords(lift/Math.cos(QUARTER_POLAR),QUARTER_POLAR,angle);
    report.legacyBuildingOccludedPixels+=covered(reference,pixels());
    if(view===0)shot('제재소 앞 · 수정 전');
    resident.userData.sprite.position.copy(characterPosition);resident.userData.sprite.material.depthWrite=true;building.userData.sprite.position.copy(buildingPosition);
    if(view===0)shot('제재소 앞 · 수정 후');
   }
  }
  scene.remove(building,resident);
  const train=makePixelVehicle('rail');train.userData.loaded=false;train.userData.previewMotion=true;train.position.y=.04;scene.add(train);
  for(let view=0;view<4;view++)for(let heading=0;heading<4;heading++){
   camera.position.setFromSphericalCoords(20,QUARTER_POLAR,quarterAzimuth(view)).add(new THREE.Vector3(0,.35,0));camera.lookAt(0,.35,0);camera.updateMatrixWorld();train.rotation.y=heading*Math.PI/2;
   for(let frame=0;frame<8;frame++){
    train.userData.animate(frame/8,null,false,view);floor.visible=false;const reference=pixels();floor.visible=true;report.trainClippedPixels+=lost(reference,pixels());
   }
   if(heading===0)shot('화물 열차 · 시점 '+view);
  }
  for(const child of document.body.children)child.style.display='none';
  document.body.insertAdjacentHTML('beforeend','<main style="font:16px sans-serif;background:#edf1e9;padding:16px"><h1>발·바퀴 접지 비교</h1><div id="proof" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px"></div></main>');
  for(const card of cards){const figure=document.createElement('figure');figure.style.margin='0';const img=new Image();img.src=card.url;img.style.width='100%';const label=document.createElement('figcaption');label.textContent=card.label;figure.append(img,label);document.querySelector('#proof').append(figure);}
  renderer.dispose();return report;
 });
 await page.screenshot({path:out+'/feet-and-wheels.png',fullPage:true});
 await writeFile(out+'/browser.json',JSON.stringify({...result,errors},null,2)+'\n');
 assert.ok(result.legacyClippedPixels>0,'reproduces the old clipped shoes');
 assert.equal(result.clippedPixels,0,'no opaque character pixels disappear behind the floor');
 assert.equal(result.trainClippedPixels,0,'wheels remain visible in every heading and animation frame');
 assert.equal(result.frontOccludedPixels,0,'a building cannot cover a resident standing in front of it');
 assert.ok(result.behindOccludedPixels>0,'the building still covers residents walking behind it');
 assert.ok(result.legacyBuildingOccludedPixels>0,'reproduces the lower-body clipping in front of buildings');
 assert.ok(result.cpuAnchorError<=.500001,'CPU and WebGL anchors agree within pixel rounding');
 assert.deepEqual(errors,[]);console.log(JSON.stringify(result));
}finally{await browser.close();}
