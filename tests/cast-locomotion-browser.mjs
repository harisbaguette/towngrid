import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const out=process.env.TOWNGRID_GAIT_PROOF_DIR||'docs/verification/cast-locomotion-20261003';
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
  const {advanceCharacterRoute,characterDistance}=await import(dependency('character-movement'));
  const {PIXEL_HEIGHT,pixelRoster}=await import(dependency('pixel-character-data'));
  const {terrainHeightAt}=await import('/src/app/game/pixel-terrain.js');
  const {characterGroundHeight}=await import('/src/app/game/character-ground-contact.js');
  const {SoftwareRenderer}=await import('/src/app/game/software-renderer.js');
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {QUARTER_POLAR,quarterAzimuth}=await import('/src/app/game/quarter-camera.js');
  const identities=Object.keys(PIXEL_HEIGHT).flatMap(pixelRoster).filter(person=>person.id!=='bron');
  await Promise.all(Object.keys(PIXEL_HEIGHT).map(loadPixelCharacters));
  const clear=scene.sim.tiles.find(tile=>scene.sim.ownedAt(tile.x,tile.z)&&tile.terrain!=='water'&&!tile.natural&&!tile.nature&&!scene.sim.at(tile.x,tile.z)&&!scene.sim.at(tile.x,tile.z+1)&&tile.x>3&&tile.z>3);
  if(!clear)throw Error('No clear inspection tile');
  const report={characters:[],liveFrames:0,floorSamples:0,clippedPixels:0,cpuAnchorError:0,groundHeights:[]};
  const proof=[];
  for(let i=0;i<5;i++){
   const canvas=document.createElement('canvas');canvas.width=960;canvas.height=1600;
   const ctx=canvas.getContext('2d');ctx.fillStyle='#e8ede3';ctx.fillRect(0,0,960,1600);proof.push({canvas,ctx});
  }
  // A real depth-tested floor also catches sprite/floor intersections that
  // metadata and transparent-atlas checks cannot see.
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:false,preserveDrawingBuffer:true});renderer.setSize(180,180);renderer.setClearColor(0x000000,0);
  const stage=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,100);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshBasicMaterial({color:0xff00ff,toneMapped:false}));floor.rotation.x=-Math.PI/2;stage.add(floor);
  const pixels=document.createElement('canvas');pixels.width=pixels.height=180;const px=pixels.getContext('2d',{willReadFrequently:true});
  const draw=()=>{renderer.render(stage,camera);px.clearRect(0,0,180,180);px.drawImage(renderer.domElement,0,0);return px.getImageData(0,0,180,180).data;};
  const cpu=new SoftwareRenderer();cpu.setSize(180,180);
  for(const [index,person] of identities.entries()){
   const meta=await (await fetch(`/assets/pixel-characters/${person.id}/frames.json`)).json();
   const worker={id:9000+index,appearance:person.id,race:person.race,x:clear.x,z:clear.z,dir:0,walking:false,atHome:false,route:[]};
   scene.sim.workers=[worker];scene.syncPeople();const model=scene.workerModels.get(worker.id);
   const capture=(column,label)=>{
    // The live loop is paused for deterministic poses; refresh camera-based
    // cloud/fog opacity just as that loop does before rendering the scene.
    scene.atmosphere?.update(0);
    scene.scene.updateMatrixWorld(true);scene.renderer.render(scene.scene,scene.camera);
    const p=model.position.clone().project(scene.camera),canvas=scene.renderer.domElement;
    const x=(p.x*.5+.5)*canvas.width,y=(-p.y*.5+.5)*canvas.height;
    const {ctx}=proof[Math.floor(index/10)],top=index%10*160;
    const extent=person.race==='titan'?220:160;
    ctx.drawImage(canvas,x-extent/2,y-extent*.875,extent,extent,column*160,top,160,160);
    ctx.fillStyle='#122c27';ctx.font='12px sans-serif';ctx.fillText(`${person.name} ${label}`,column*160+4,top+14);
   };
   const cases=[];
   for(let view=0;view<4;view++)for(const action of ['walk','carry']){
    Object.assign(worker,{x:clear.x,z:clear.z,dir:0,working:false,attacking:false,handling:null,phase:null,task:action==='carry'?{carried:true}:null,route:[{x:clear.x,z:clear.z+2}]});
    scene.controls.target.set(clear.x,0,clear.z);scene.camera.zoom=2;scene.camera.updateProjectionMatrix();scene.setQuarterView(view);model.userData.motionState={};
    const clip=meta.clips[action],stepLength=(clip.strideLengths?.[['SW','NW','NE','SE'][view]]??clip.strideLength)/32,distance=characterDistance(worker);
    let first=(Math.floor(distance/stepLength)+.5)*stepLength-distance;if(first<=0)first+=stepLength;
    const frames=[];
    for(let step=0;step<32;step++){
     advanceCharacterRoute(worker,(step?stepLength:first)/.4,.4);scene.sim.time+=.08;scene.syncPeople();
     const u=model.userData;
     if(u.current!==action||u.atlas.row!==view+4||!model.visible||u.appearance!==person.id)throw Error(`${person.id}: live ${action}/${view} is wrong`);
     const ground=characterGroundHeight(worker,meta,u.direction,u.frame,u.atlas,u.pixelHeight,quarterAzimuth(view),(x,z)=>terrainHeightAt(scene.sim,x,z));
     if(Math.abs(model.position.y-ground-.002)>1e-6)throw Error(`${person.id}: scene lost supporting-foot height`);
     frames.push(u.frame);report.liveFrames++;
     if(view===0&&action==='walk'&&step%8===0)capture(step/8,`걷기 ${step+1}`);
     if(view===1&&action==='carry'&&step===8)capture(4,'뒤 운반');
    }
    if(new Set(frames).size!==32)throw Error(`${person.id}: skipped gait frames`);
    worker.walking=false;scene.syncPeople();const stopped=model.userData.frame;
    if(action==='carry'&&stopped!==meta.clips.pickup.frames.at(-1))throw Error(`${person.id}: lost holding pose`);
    if(action==='walk'&&model.userData.current!=='idle')throw Error(`${person.id}: did not stop`);
    if(view===1&&action==='carry')capture(5,'운반 대기');
    scene.sim.time+=2;scene.syncPeople();if(action==='carry'&&model.userData.frame!==stopped)throw Error(`${person.id}: walking in place`);
    worker.task=null;scene.syncPeople();worker.dir=Math.PI/2;scene.sim.time+=.1;scene.syncPeople();
    if(model.userData.current!=='turn')throw Error(`${person.id}: missing pivot`);
    scene.sim.time+=.3;scene.syncPeople();if(model.userData.current!=='idle')throw Error(`${person.id}: unfinished pivot`);
    cases.push({view,action,frames:32,stopped,pivot:true});
   }
   const actor=createPixelCharacter(0,person.race,person.id);actor.userData.shadow.visible=false;stage.add(actor);
   const w={id:0,x:0,z:0,dir:0,route:[]};
   for(let view=0;view<4;view++){
    const height=[.013,.026,.036,.040][view];floor.position.y=height;
    camera.position.setFromSphericalCoords(20,QUARTER_POLAR,quarterAzimuth(view)).add(new THREE.Vector3(0,.55,0));camera.lookAt(0,.55,0);camera.updateMatrixWorld();
    cpu.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);cpu.pixelsPerWorldUnit=90;
    for(const action of ['walk','carry'])for(let step=0;step<32;step++){
     const stride=meta.clips[action].strideLength/32;
     w.route=[{x:0,z:stride}];advanceCharacterRoute(w,1,stride);w.x=w.z=0;w.walking=true;w.task=action==='carry'?{carried:true}:null;
     animatePixelCharacter(actor,w,step*.1+view*10,camera,height);
     floor.visible=false;const reference=draw();floor.visible=true;const actual=draw();
     let lost=0;for(let i=0;i<reference.length;i+=4)if(reference[i+3]>250&&actual[i]===255&&actual[i+1]===0&&actual[i+2]===255)lost++;
     if(lost)throw Error(`${person.id}/${view}/${action}/${step}: ${lost} floor-clipped pixels`);
     report.clippedPixels+=lost;report.floorSamples++;
     if(step===0){
      const calls=[],original=cpu.ctx.drawImage.bind(cpu.ctx);cpu.ctx.drawImage=(...args)=>{calls.push(args);original(...args);};
      cpu.drawPixelCharacter(actor,cpu.project(actor.position.x,actor.position.y,actor.position.z));cpu.ctx.drawImage=original;
      const world=actor.userData.sprite.getWorldPosition(new THREE.Vector3()),anchor=cpu.project(world.x,world.y,world.z),size=Math.round(actor.userData.sprite.scale.y*90),call=calls[0];
      if(call[7]!==size||call[8]!==size)throw Error(`${person.id}: CPU sprite size differs`);
      report.cpuAnchorError=Math.max(report.cpuAnchorError,Math.abs(call[5]+size*actor.userData.sprite.center.x-anchor.x),Math.abs(call[6]+size*(1-actor.userData.sprite.center.y)-anchor.y));
     }
    }
   }
   stage.remove(actor);actor.userData.sprite.material.dispose();
   report.characters.push({id:person.id,mode:meta.locomotionMode,cases});
  }
  report.groundHeights=[.013,.026,.036,.040];window.castProof=proof.map(p=>p.canvas.toDataURL());renderer.dispose();return report;
 });
 for(const [i,url] of (await page.evaluate(()=>window.castProof)).entries())await writeFile(`${out}/live-cast-${i+1}.png`,Buffer.from(url.split(',')[1],'base64'));
 assert.equal(result.characters.length,50);assert.equal(result.liveFrames,12800);assert.equal(result.floorSamples,12800);assert.equal(result.clippedPixels,0);assert.ok(result.cpuAnchorError<=.500001);assert.deepEqual(errors,[]);
 await writeFile(`${out}/browser-check.json`,JSON.stringify({...result,errors},null,2)+'\n');
 console.log(JSON.stringify({characters:50,liveFrames:result.liveFrames,floorSamples:result.floorSamples,clippedPixels:result.clippedPixels,cpuAnchorError:result.cpuAnchorError,errors}));
}finally{await browser.close();}
