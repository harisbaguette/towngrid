import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const out='docs/verification/weight-transfer-20261003';
await mkdir(out,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 await page.routeWebSocket('**/*',()=>{});
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto((process.env.TOWNGRID_URL||'http://localhost:5173')+'/environment-preview.html');
 await page.waitForFunction(()=>window.environmentPreview?.game.workerModels,{},{timeout:120000});
 const result=await page.evaluate(async()=>{
  const scene=window.environmentPreview.game;window.environmentPreview.pause();scene.sim.paused=true;scene.active=false;
  const urls=performance.getEntriesByType('resource').map(entry=>entry.name);
  const pixelURL=urls.find(url=>/\/app\/game\/pixel-characters\.js(?:\?|$)/.test(url));
  const source=await (await fetch(pixelURL)).text();
  const dependency=name=>source.match(new RegExp(`from\\s+["']([^"']*${name}\\.js[^"']*)["']`))[1];
  const {loadPixelCharacters,createPixelCharacter,animatePixelCharacter}=await import(pixelURL);
  const {PIXEL_HEIGHT,pixelRoster}=await import(dependency('pixel-character-data'));
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {QUARTER_POLAR,quarterAzimuth}=await import('/src/app/game/quarter-camera.js');
  await Promise.all(Object.keys(PIXEL_HEIGHT).map(loadPixelCharacters));
  const people=Object.keys(PIXEL_HEIGHT).flatMap(pixelRoster);
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:false,preserveDrawingBuffer:true});renderer.setSize(160,160);renderer.setClearColor(0x000000,0);
  const stage=new THREE.Scene(),camera=new THREE.OrthographicCamera(-.9,.9,.9,-.9,.1,100);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshBasicMaterial({color:0xff00ff,toneMapped:false}));floor.rotation.x=-Math.PI/2;stage.add(floor);
  const pixels=document.createElement('canvas');pixels.width=pixels.height=160;const px=pixels.getContext('2d',{willReadFrequently:true});
  const draw=()=>{renderer.render(stage,camera);px.clearRect(0,0,160,160);px.drawImage(renderer.domElement,0,0);return px.getImageData(0,0,160,160).data;};
  const picked=['mira','bron','taron','kai','fia','dew'];
  const proof=document.createElement('canvas');proof.width=640;proof.height=picked.length*320;
  const ctx=proof.getContext('2d');ctx.fillStyle='#e5e9df';ctx.fillRect(0,0,proof.width,proof.height);
  const report={characters:[],frames:0,floorClippedPixels:0};let time=0;
  for(const person of people){
   const meta=await (await fetch(`/assets/pixel-characters/${person.id}/frames.json`)).json();
   const actor=createPixelCharacter(0,person.race,person.id);actor.userData.shadow.visible=false;stage.add(actor);
   const worker={id:0,x:0,z:0,dir:0,walking:false,route:[]};
   for(let view=0;view<4;view++){
    const height=[.013,.026,.036,.040][view];floor.position.y=height;
    camera.position.setFromSphericalCoords(20,QUARTER_POLAR,quarterAzimuth(view)).add(new THREE.Vector3(0,.55,0));camera.lookAt(0,.55,0);camera.updateMatrixWorld();
    for(const [actionIndex,action] of ['pickup','drop'].entries()){
     const clip=meta.clips[action];worker.handling=action;
     for(let i=0;i<clip.frames.length;i++){
      worker.handlingTime=(i+.001)/clip.fps;time+=1/24;
      animatePixelCharacter(actor,worker,time,camera,height);
      if(actor.userData.frame!==clip.frames[i]||actor.userData.current!==action)throw Error(`${person.id}/${view}/${action}: frame mismatch`);
      floor.visible=false;const reference=draw();
      if(view===0&&picked.includes(person.id)&&[0,4,8,11].includes(i)){
       const col=[0,4,8,11].indexOf(i),row=picked.indexOf(person.id)*2+actionIndex;
       ctx.drawImage(renderer.domElement,col*160,row*160);ctx.fillStyle='#17392d';ctx.font='12px sans-serif';ctx.fillText(`${person.name} ${action} ${i+1}`,col*160+3,row*160+15);
      }
      floor.visible=true;const actual=draw();
      let lost=0;for(let p=0;p<reference.length;p+=4)if(reference[p+3]>250&&actual[p]===255&&actual[p+1]===0&&actual[p+2]===255)lost++;
      if(lost)throw Error(`${person.id}/${view}/${action}/${i}: floor clipping ${lost}`);
      report.frames++;report.floorClippedPixels+=lost;
     }
    }
    worker.handling=null;worker.task={carried:true};time+=.1;animatePixelCharacter(actor,worker,time,camera,height);
    if(actor.userData.frame!==meta.clips.pickup.frames.at(-1))throw Error(`${person.id}: waiting cargo frame mismatch`);
    worker.task=null;
   }
   stage.remove(actor);actor.userData.sprite.material.dispose();report.characters.push(person.id);
  }
  window.handlingProof=proof.toDataURL();renderer.dispose();return report;
 });
 assert.equal(result.characters.length,51);assert.equal(result.frames,4896);assert.equal(result.floorClippedPixels,0);assert.deepEqual(errors,[]);
 const proof=await page.evaluate(()=>window.handlingProof);
 await writeFile(`${out}/handling-live.png`,Buffer.from(proof.split(',')[1],'base64'));
 await writeFile(`${out}/handling-browser.json`,JSON.stringify({...result,errors},null,2)+'\n');
 console.log(JSON.stringify({...result,characters:result.characters.length,errors}));
}finally{await browser.close();}
