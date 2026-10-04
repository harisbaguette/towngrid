import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const out='docs/verification/motion-v8-20261003';await mkdir(out,{recursive:true});
try{
 const page=await browser.newPage(),errors=[];await page.routeWebSocket('**/*',()=>{});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto((process.env.TOWNGRID_URL||'http://localhost:5173')+'/environment-preview.html');
 await page.waitForFunction(()=>window.environmentPreview?.game);
 const result=await page.evaluate(async()=>{
  window.environmentPreview.pause();window.environmentPreview.game.active=false;
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {FogLayer}=await import('/src/app/game/fog-layer.js');
  const {SoftwareRenderer}=await import('/src/app/game/software-renderer.js');
  const {atmosphereVisibility}=await import('/src/app/game/atmosphere-focus.js');
  const opaque=document.createElement('canvas');opaque.width=opaque.height=2;const ink=opaque.getContext('2d');ink.fillStyle='#fff';ink.fillRect(0,0,2,2);
  const texture=new THREE.CanvasTexture(opaque),layer=new FogLayer({count:1}),sprite=layer.slots[0];
  sprite.material.map=texture;sprite.material.opacity=.8;sprite.visible=true;sprite.scale.set(4,4,1);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#246834');scene.add(layer.group);scene.updateMatrixWorld(true);
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10);camera.position.set(0,0,3);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(200,200);
  const target=document.createElement('canvas');target.width=target.height=200;const ctx=target.getContext('2d');
  const draw=visible=>{layer.group.visible=visible;renderer.render(scene,camera);ctx.drawImage(renderer.domElement,0,0);return ctx.getImageData(0,0,200,200).data;};
  const bare=draw(false),weather=draw(true);
  const cpu=new SoftwareRenderer();cpu.setSize(200,200);cpu.pixelsPerWorldUnit=100;cpu.project=()=>({x:100,y:100});
  cpu.ctx.fillStyle='#246834';cpu.ctx.fillRect(0,0,200,200);const cpuBare=cpu.ctx.getImageData(0,0,200,200).data;
  cpu.drawAtmosphere(layer.group);const cpuWeather=cpu.ctx.getImageData(0,0,200,200).data;
  const pixel=(data,x,y)=>Array.from(data.slice((y*200+x)*4,(y*200+x)*4+4));
  const samples=[];
  for(const [x,y]of [[100,100],[115,100],[100,115],[5,100],[195,100]])samples.push({x,y,bare:pixel(bare,x,y),weather:pixel(weather,x,y),cpuBare:pixel(cpuBare,x,y),cpuWeather:pixel(cpuWeather,x,y),weight:atmosphereVisibility(x/100-1,y/100-1)});
  renderer.dispose();layer.dispose();texture.dispose();return samples;
 });
 for(const s of result){
  if(s.weight===0){assert.deepEqual(s.weather,s.bare,'WebGL fog cannot veil the resident focus');assert.deepEqual(s.cpuWeather,s.cpuBare,'CPU fog cannot veil the resident focus');}
  else{assert.notDeepEqual(s.weather,s.bare,'WebGL weather must remain visible outside focus');assert.notDeepEqual(s.cpuWeather,s.cpuBare,'CPU weather must remain visible outside focus');}
 }
 assert.deepEqual(errors,[]);await writeFile(`${out}/visibility.json`,JSON.stringify({samples:result,errors},null,2)+'\n');
 console.log('Resident visibility: oversized fog remains outside focus; center pixels preserved in WebGL and CPU PASS');
}finally{await browser.close();}
