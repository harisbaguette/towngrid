import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const out='docs/verification/character-contact-20261004';
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
  const {loadPixelEnvironment}=await import('/src/app/game/pixel-environment.js');
  const {QUARTER_POLAR,quarterAzimuth}=await import('/src/app/game/quarter-camera.js');
  await loadPixelEnvironment();
  const stage=new THREE.Scene(),camera=new THREE.OrthographicCamera(-.7,.7,.7,-.7,.1,30);
  const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(700,700);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(5,5),new THREE.MeshBasicMaterial({color:0x0000ff,toneMapped:false}));
  ground.rotation.x=-Math.PI/2;ground.position.y=.013;stage.add(ground);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=700;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const proof=document.createElement('canvas');proof.width=1400;proof.height=2100;const proofContext=proof.getContext('2d');
  const counts={},failures=[];
  for(const [kind,id,frame,height] of [['rails','networks',0,.036],['pipes','infrastructureGround',4,.040],['conveyors','infrastructureGround',6,.040]]){
   counts[kind]={samples:0,ground:0,surface:0,edgesSkipped:0};
   for(let mask=0;mask<16;mask++){
    const network=new Set(['0,0']);
    for(const [x,z,bit] of [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]])if(mask&bit)network.add(`${x},${z}`);
    const sim={roads:new Set(),[kind]:network,at:()=>null};
    const mesh=makeSurfaceBatch(id,frame,[{x:0,z:0,y:height}],{network:mask,layer:6});mesh.material.color.set(0xff0000);stage.add(mesh);
    for(let view=0;view<4;view++){
     camera.position.setFromSphericalCoords(10,QUARTER_POLAR,quarterAzimuth(view));camera.lookAt(0,0,0);camera.updateMatrixWorld();
     renderer.render(stage,camera);ctx.drawImage(renderer.domElement,0,0);const pixels=ctx.getImageData(0,0,700,700).data;
     for(const x of [-.44,-.33,-.22,-.11,0,.11,.22,.33,.44])for(const z of [-.44,-.33,-.22,-.11,0,.11,.22,.33,.44]){
      const h=terrainHeightAt(sim,x,z);
      // A screen pixel covers multiple texture texels near an alpha edge.
      // Check unambiguous interiors, including transparent parts of each tile.
      if([-.004,0,.004].some(dx=>[-.004,0,.004].some(dz=>terrainHeightAt(sim,x+dx,z+dz)!==h))){counts[kind].edgesSkipped++;continue;}
      const p=new THREE.Vector3(x,height,z).project(camera),px=Math.floor((p.x*.5+.5)*700),py=Math.floor((.5-p.y*.5)*700),i=(py*700+px)*4;
      const drawn=pixels[i+2]<10,expected=h===height;
      if(drawn!==expected)failures.push({kind,mask,view,x,z,h,rgb:[...pixels.slice(i,i+3)]});
      counts[kind].samples++;counts[kind][expected?'surface':'ground']++;
     }
     if(view===0&&[3,15].includes(mask))proofContext.drawImage(canvas,mask===3?0:700,['rails','pipes','conveyors'].indexOf(kind)*700);
    }
    stage.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();
   }
  }
  renderer.dispose();ground.geometry.dispose();ground.material.dispose();
  return {counts,failures,proof:proof.toDataURL()};
 });
 const {proof,...report}=result;
 await writeFile(`${out}/network-contact.png`,Buffer.from(proof.split(',')[1],'base64'));
 await writeFile(`${out}/network-contact.json`,JSON.stringify({...report,errors},null,2)+'\n');
 assert.deepEqual(errors,[]);assert.equal(result.failures.length,0,JSON.stringify(result.failures.slice(0,5)));
 for(const count of Object.values(result.counts))assert.ok(count.ground>500&&count.surface>500);
 console.log('NETWORK_CONTACT_OK',JSON.stringify(result.counts));
}finally{await browser.close();}
