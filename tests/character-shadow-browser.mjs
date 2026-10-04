import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage(),errors=[];
 await page.routeWebSocket('**/*',()=>{});page.on('pageerror',error=>errors.push(error.message));
 await page.goto((process.env.TOWNGRID_URL||'http://localhost:5173')+'/environment-preview.html');
 await page.waitForFunction(()=>window.environmentPreview?.game.workerModels,{},{timeout:120000});
 const result=await page.evaluate(async()=>{
  window.environmentPreview.pause();window.environmentPreview.game.active=false;
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {loadPixelCharacters,createPixelCharacter,animatePixelCharacter}=await import('/src/app/game/pixel-characters.js');
  const {PIXEL_HEIGHT,pixelRoster}=await import('/src/app/game/pixel-character-data.js');
  const {SoftwareRenderer}=await import('/src/app/game/software-renderer.js');
  const {QUARTER_POLAR,quarterAzimuth}=await import('/src/app/game/quarter-camera.js');
  await Promise.all(Object.keys(PIXEL_HEIGHT).map(loadPixelCharacters));
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:false,preserveDrawingBuffer:true});renderer.setSize(256,256);renderer.setClearColor(0,0);
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-.4,.4,.4,-.4,.1,30);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const cpu=new SoftwareRenderer({alpha:true});cpu.setSize(256,256);cpu.pixelsPerWorldUnit=320;
  cpu.ctx.drawImage=()=>{}; // Isolate the shadow from the separately tested cel.
  const measure=data=>{
   let mass=0,x=0,y=0;for(let i=3;i<data.length;i+=4){const a=data[i],p=(i-3)/4;mass+=a;x+=(p%256+.5)*a;y+=(Math.floor(p/256)+.5)*a;}
   return {mass,x:x/mass,y:y/mass};
  };
  let cases=0,centroidError=0,massError=0;
  const identities=Object.keys(PIXEL_HEIGHT).flatMap(pixelRoster);
  for(const person of identities){
   const actor=createPixelCharacter(0,person.race,person.id);scene.add(actor);actor.userData.sprite.visible=false;
   for(let view=0;view<4;view++)for(const height of [.013,.040]){
    camera.position.setFromSphericalCoords(10,QUARTER_POLAR,quarterAzimuth(view));camera.lookAt(0,0,0);camera.updateMatrixWorld();
    animatePixelCharacter(actor,{x:0,z:0,dir:0},0,camera,()=>height);scene.updateMatrixWorld(true);
    const shadow=actor.userData.shadow.getWorldPosition(new THREE.Vector3());
    if(Math.abs(shadow.y-height-.005)>1e-9)throw Error(`${person.id}: shadow left the ground`);
    renderer.render(scene,camera);ctx.clearRect(0,0,256,256);ctx.drawImage(renderer.domElement,0,0);
    cpu.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);cpu.ctx.clearRect(0,0,256,256);
    cpu.drawPixelCharacter(actor,cpu.project(actor.position.x,actor.position.y,actor.position.z));
    const web=measure(ctx.getImageData(0,0,256,256).data),fallback=measure(cpu.ctx.getImageData(0,0,256,256).data);
    centroidError=Math.max(centroidError,Math.hypot(web.x-fallback.x,web.y-fallback.y));
    massError=Math.max(massError,Math.abs(web.mass-fallback.mass)/web.mass);cases++;
   }
   scene.remove(actor);actor.userData.sprite.material.dispose();actor.userData.shadow.geometry.dispose();actor.userData.shadow.material.dispose();
  }
  renderer.dispose();return {characters:identities.length,cases,centroidError,massError};
 });
 assert.deepEqual(errors,[]);assert.equal(result.characters,51);assert.equal(result.cases,408);assert.ok(result.centroidError<.3,JSON.stringify(result));assert.ok(result.massError<.05,JSON.stringify(result));
 await mkdir('docs/verification/character-contact-20261004',{recursive:true});
 await writeFile('docs/verification/character-contact-20261004/shadows.json',JSON.stringify({...result,errors},null,2)+'\n');
 console.log('CHARACTER_SHADOW_OK',JSON.stringify(result));
}finally{await browser.close();}
