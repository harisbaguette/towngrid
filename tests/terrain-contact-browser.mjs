import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const out='docs/verification/terrain-contact-20261004';
await mkdir(out,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:800}}),errors=[];
 await page.routeWebSocket('**/*',()=>{});
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto((process.env.TOWNGRID_URL||'http://localhost:5173')+'/environment-preview.html');
 await page.waitForFunction(()=>window.environmentPreview?.game?.workerModels,{},{timeout:120000});
 const result=await page.evaluate(async()=>{
  window.environmentPreview.pause();window.environmentPreview.game.active=false;
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {makeSurfaceBatch,terrainHeightAt}=await import('/src/app/game/pixel-terrain.js');
  const {QUARTER_POLAR,quarterAzimuth}=await import('/src/app/game/quarter-camera.js');
  const {SoftwareRenderer}=await import('/src/app/game/software-renderer.js');
  const stage=new THREE.Scene(),camera=new THREE.OrthographicCamera(-.8,.8,.8,-.8,.1,30);
  const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(320,320);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(5,5),new THREE.MeshBasicMaterial({color:0x0000ff,toneMapped:false}));
  ground.rotation.x=-Math.PI/2;ground.position.y=.013;stage.add(ground);
  const red=new THREE.DataTexture(new Uint8Array([255,0,0,255]),1,1);red.needsUpdate=true;
  const capture=document.createElement('canvas');capture.width=capture.height=320;
  const ctx=capture.getContext('2d',{willReadFrequently:true});
  const proof=document.createElement('canvas');proof.width=1280;proof.height=1280;
  const proofContext=proof.getContext('2d');
  let samples=0,canvasSamples=0;
  for(let mask=0;mask<16;mask++){
   const roads=new Set(['0,0']);
   for(const [x,z,bit] of [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]])if(mask&bit)roads.add(`${x},${z}`);
   const road=makeSurfaceBatch('ground',0,[{x:0,z:0,y:.026}],{mask,layer:5});road.material.map=red;stage.add(road);
   // Exercise the CPU renderer's actual clipping path on the same mesh.
   const cpu=new SoftwareRenderer();cpu.setSize(320,320);
   const source=document.createElement('canvas');source.width=source.height=192;source.getContext('2d').fillStyle='#f00';source.getContext('2d').fillRect(0,0,192,192);
   road.userData.image=source;
   for(let view=0;view<4;view++){
    camera.position.setFromSphericalCoords(10,QUARTER_POLAR,quarterAzimuth(view));camera.lookAt(0,0,0);camera.updateMatrixWorld();
    stage.updateMatrixWorld(true);renderer.render(stage,camera);ctx.drawImage(renderer.domElement,0,0);
    cpu.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);cpu.ctx.fillStyle='#00f';cpu.ctx.fillRect(0,0,320,320);cpu.drawPixelSurface(road);
    for(const x of [-.43,-.15,.15,.43])for(const z of [-.43,-.15,.15,.43]){
     const height=terrainHeightAt({roads},x,z),p=new THREE.Vector3(x,height,z).project(camera);
     const px=Math.round((p.x*.5+.5)*320),py=Math.round((.5-p.y*.5)*320);
     const expected=height===.026?'road':'ground';
     for(const [kind,context] of [['WebGL',ctx],['Canvas',cpu.ctx]]){
      const pixel=context.getImageData(px,py,1,1).data;
      const actual=pixel[0]>200?'road':'ground';
      if(actual!==expected)throw Error(`${kind} mask=${mask} view=${view} (${x},${z}): displayed ${actual}, height says ${expected}`);
      if(kind==='WebGL')samples++;else canvasSamples++;
     }
    }
    if(view===0){proofContext.drawImage(capture,mask%4*320,Math.floor(mask/4)*320);proofContext.fillStyle='#fff';proofContext.font='16px sans-serif';proofContext.fillText(`connections ${mask}`,mask%4*320+10,Math.floor(mask/4)*320+24);}
   }
   stage.remove(road);road.geometry.dispose();road.material.dispose();
  }
  renderer.dispose();red.dispose();ground.geometry.dispose();ground.material.dispose();
  window.terrainContactProof=proof.toDataURL();return {masks:16,views:4,samples,canvasSamples};
 });
 const png=await page.evaluate(()=>window.terrainContactProof);
 await writeFile(`${out}/road-masks.png`,Buffer.from(png.split(',')[1],'base64'));
 assert.deepEqual(errors,[]);
 await writeFile(`${out}/browser.json`,JSON.stringify({...result,errors},null,2)+'\n');
 console.log(`TERRAIN_RENDER_CONTACT_OK: ${result.samples} WebGL + ${result.canvasSamples} Canvas samples, 16 road connections x four camera views`);
}finally{await browser.close();}
