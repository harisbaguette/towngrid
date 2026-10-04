import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const out='docs/verification/motion-v8-20261003';
await mkdir(out,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 await page.routeWebSocket('**/*',()=>{});
 if(process.env.TOWNGRID_CHARACTER_PACK)await page.route('**/assets/pixel-characters/**',async route=>{
  const match=new URL(route.request().url()).pathname.match(/\/pixel-characters\/([a-z]+)\/(frames\.json|sprites\.png|portrait(?:-idle)?\.png)$/);
  if(!match)return route.continue();
  const body=await readFile(`${process.env.TOWNGRID_CHARACTER_PACK}/${match[1]}/${match[2]}`);
  await route.fulfill({body,contentType:match[2].endsWith('.json')?'application/json':'image/png'});
 });
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto((process.env.TOWNGRID_URL||'http://localhost:5173')+'/environment-preview.html');
 try{await page.waitForFunction(()=>window.environmentPreview?.game.workerModels,{},{timeout:120000});}
 catch(error){throw new Error(`Environment preview did not initialize: ${errors.join('; ')}`,{cause:error});}
 const result=await page.evaluate(async()=>{
  const game=window.environmentPreview.game;window.environmentPreview.pause();game.sim.paused=true;game.active=false;
  const pixelURL=performance.getEntriesByType('resource').map(e=>e.name).find(url=>/\/app\/game\/pixel-characters\.js(?:\?|$)/.test(url));
  const source=await (await fetch(pixelURL)).text();
  const dependency=name=>source.match(new RegExp(`from\\s+["']([^"']*${name}\\.js[^"']*)["']`))[1];
  const {loadPixelCharacters,createPixelCharacter,animatePixelCharacter}=await import(pixelURL);
  const {PIXEL_HEIGHT,pixelRoster,pixelAtlasFrame}=await import(dependency('pixel-character-data'));
  const {pixelMetadata}=await import(dependency('pixel-character-meta'));
  const {SoftwareRenderer}=await import('/src/app/game/software-renderer.js');
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {QUARTER_POLAR,quarterAzimuth}=await import('/src/app/game/quarter-camera.js');
  await Promise.all(Object.keys(PIXEL_HEIGHT).map(loadPixelCharacters));
  const people=Object.keys(PIXEL_HEIGHT).flatMap(pixelRoster);
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:false,preserveDrawingBuffer:true});renderer.setSize(160,160);renderer.setClearColor(0x000000,0);
  const stage=new THREE.Scene(),camera=new THREE.OrthographicCamera(-.9,.9,.9,-.9,.1,100);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshBasicMaterial({color:0xff00ff,toneMapped:false}));floor.rotation.x=-Math.PI/2;stage.add(floor);
  const pixels=document.createElement('canvas');pixels.width=pixels.height=160;const px=pixels.getContext('2d',{willReadFrequently:true});
  const draw=()=>{renderer.render(stage,camera);px.clearRect(0,0,160,160);px.drawImage(renderer.domElement,0,0);return px.getImageData(0,0,160,160).data;};
  const actions=['idle','walk','carry','work','pickup','drop','greet','attack','hurt','defeat','turn','hurtCarry'];
  const proofs={};const report={characters:[],frames:0,floorClippedPixels:0,cpuCrops:0};
  for(const person of people){
   const meta=pixelMetadata.get(person.id);const inspection=structuredClone(meta);
   pixelMetadata.set(person.id,inspection);
   const actor=createPixelCharacter(0,person.race,person.id);actor.userData.shadow.visible=false;stage.add(actor);
   const proof=document.createElement('canvas');proof.width=1280;proof.height=actions.length*160;
   const ctx=proof.getContext('2d');ctx.fillStyle='#e5e9df';ctx.fillRect(0,0,proof.width,proof.height);
   const checked=[];
   for(let view=0;view<4;view++){
    const height=[.013,.026,.036,.040][view];floor.position.y=height;
    camera.position.setFromSphericalCoords(20,QUARTER_POLAR,quarterAzimuth(view)).add(new THREE.Vector3(0,.55,0));camera.lookAt(0,.55,0);camera.updateMatrixWorld();
    for(const [actionIndex,action] of actions.entries()){
     const clip=action==='hurtCarry'?meta.variants.hurt.carry:meta.clips[action];
     for(let i=0;i<clip.frames.length;i++){
      // Inspect the exact active cel through the real renderer. The temporary
      // idle binding does not alter production metadata or a saved worker.
      inspection.clips.idle={frames:[clip.frames[i]],fps:1};
      actor.userData.motionState={};
      animatePixelCharacter(actor,{id:0,x:0,z:0,dir:0},0,camera,height);
      const expected=pixelAtlasFrame(view,clip.frames[i],meta),u=actor.userData;
      if(u.frame!==clip.frames[i]||u.atlas.row!==expected.row||u.atlas.rows!==12)throw Error(`${person.id}/${view}/${action}: wrong atlas cel`);
      floor.visible=false;const reference=draw();
      const selected=[0,Math.round((clip.frames.length-1)/3),Math.round((clip.frames.length-1)*2/3),clip.frames.length-1];
      if(view<2&&selected.includes(i)){
       const col=view*4+selected.indexOf(i),row=actionIndex;
       ctx.drawImage(renderer.domElement,col*160,row*160);ctx.fillStyle='#17392d';ctx.font='12px sans-serif';ctx.fillText(`${person.name} ${action} ${view}/${i+1}`,col*160+3,row*160+15);
      }
      floor.visible=true;const actual=draw();
      let lost=0;for(let p=0;p<reference.length;p+=4)if(reference[p+3]>250&&actual[p]===255&&actual[p+1]===0&&actual[p+2]===255)lost++;
      if(lost)throw Error(`${person.id}/${view}/${action}/${i}: floor clipping ${lost}`);
      const calls=[],cpuContext=new Proxy({}, {get:(_,key)=>(...args)=>calls.push([key,...args]),set:()=>true});
      SoftwareRenderer.prototype.drawPixelCharacter.call({ctx:cpuContext,pixelsPerWorldUnit:128,project:()=>({x:80,y:120})},actor,{x:80,y:120});
      const crop=calls.find(([name])=>name==='drawImage');
      if(crop[2]!==expected.frame*128||crop[3]!==expected.row*128||crop[4]!==128||crop[5]!==128)throw Error(`${person.id}/${view}/${action}/${i}: CPU crop mismatch`);
      report.frames++;report.cpuCrops++;report.floorClippedPixels+=lost;
     }
     checked.push(`${action}/${view}`);
    }
   }
   proofs[person.id]=proof.toDataURL();
   stage.remove(actor);actor.userData.texture.dispose();actor.userData.sprite.material.dispose();pixelMetadata.set(person.id,meta);
   report.characters.push({id:person.id,cases:checked.length});
  }
  window.actionProofs=proofs;renderer.dispose();return report;
 });
 assert.equal(result.characters.length,51);assert.ok(result.characters.every(p=>p.cases===48));assert.equal(result.floorClippedPixels,0);assert.deepEqual(errors,[]);
 for(const id of result.characters.map(p=>p.id)){
  const proof=await page.evaluate(id=>window.actionProofs[id],id);
  await writeFile(`${out}/${id}-actions.png`,Buffer.from(proof.split(',')[1],'base64'));
 }
 await writeFile(`${out}/browser.json`,JSON.stringify({...result,errors},null,2)+'\n');
 console.log(JSON.stringify({...result,characters:result.characters.length,errors}));
}finally{await browser.close();}
