// Runtime contact sheets: four cameras, actual layered models, one renderer.
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const expansion=process.argv.includes('--expansion');
const out=new URL(expansion?'../docs/verification/world-v5/':'../docs/verification/industry-v4/',import.meta.url);await mkdir(out,{recursive:true});
try{
 const page=await browser.newPage();page.on('pageerror',e=>console.error(e));
 await page.goto((process.env.TOWNGRID_URL||'http://localhost:5173')+'/production-preview.html?group=food');
 await page.waitForFunction(()=>window.productionPreview);await page.locator('#pause').click();
 const sheets=await page.evaluate(async(expansion)=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {makePixelBuilding}=await import('/src/app/game/pixel-environment.js');
  const {INDUSTRY_GROUPS}=await import('/src/app/game/pixel-industry-data.js');
  const {EXPANSION_GROUPS}=await import('/src/app/game/pixel-expansion-data.js');
  const {QUARTER_POLAR,quarterAzimuth}=await import('/src/app/game/quarter-camera.js');
  const renderer=window.productionPreview.items[0].renderer;
  renderer.setSize(192,192);const camera=new THREE.OrthographicCamera(-.76,.76,.76,-.76,.1,30);
  const sheets=[];
  for(const [group,types] of Object.entries(expansion?EXPANSION_GROUPS:INDUSTRY_GROUPS)){
   const canvas=document.createElement('canvas');canvas.width=768;canvas.height=types.length*216;
   const ctx=canvas.getContext('2d');ctx.fillStyle='#dbe4c7';ctx.fillRect(0,0,canvas.width,canvas.height);
   for(const [row,type] of types.entries()){
    const scene=new THREE.Scene(),model=makePixelBuilding(type,'human');scene.add(model);
    for(let view=0;view<4;view++){
     model.userData.animate(.5,{type,health:100,working:true,progress:.5,out:6,animationTime:.5,activeUntil:60},{time:.5,power:true,batteryCharge:65,stage:1,health:{nextCare:60}},view);
     camera.position.setFromSphericalCoords(5,QUARTER_POLAR,quarterAzimuth(view)).add(new THREE.Vector3(0,.31,0));camera.lookAt(0,.31,0);camera.updateMatrixWorld();
     renderer.render(scene,camera);ctx.drawImage(renderer.domElement,view*192,row*216);
     ctx.font='14px monospace';ctx.fillStyle='#243d34';ctx.fillText(type+' / '+view,view*192+6,row*216+210);
    }
    scene.traverse(o=>{if(o.userData.texture)o.userData.texture.dispose();if(o.material)o.material.dispose();});
   }
   sheets.push({group,png:canvas.toDataURL()});
  }
  return sheets;
 },expansion);
 for(const {group,png} of sheets)await writeFile(new URL(group+'.png',out),Buffer.from(png.split(',')[1],'base64'));
 console.log(sheets.length+' four-view runtime contact sheets:',fileURLToPath(out));
}finally{await browser.close();}
