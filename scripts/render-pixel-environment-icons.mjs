// After packing, capture complete building icons with their authored parts.
// Usage: node scripts/render-pixel-environment-icons.mjs <playwright/index.mjs> <chrome.exe>
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.argv[2]?pathToFileURL(process.argv[2]).href:'playwright');
const browser=await chromium.launch({headless:true,...(process.argv[3]?{executablePath:process.argv[3]}:{}),args:['--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();
 await page.goto((process.env.TOWNGRID_URL||'http://localhost:5173')+'/production-preview.html');
 await page.waitForFunction(()=>window.productionPreview);
 await page.locator('#pause').click();
 const only=process.argv.find(v=>v.startsWith('--only='))?.slice(7).split(',');
 const icons=await page.evaluate(async(only)=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {makePixelBuilding}=await import('/src/app/game/pixel-environment.js');
  const {PIXEL_BUILDINGS}=await import('/src/app/game/pixel-environment-data.js');
  const {renderer,camera}=window.productionPreview.items[0];
  camera.left=-.7;camera.right=.7;camera.top=.7;camera.bottom=-.7;camera.updateProjectionMatrix();renderer.setSize(192,192);
  return PIXEL_BUILDINGS.filter(type=>!only||only.includes(type)).map(type=>{
   const scene=new THREE.Scene(),model=makePixelBuilding(type,'human');scene.add(model);
   model.userData.animate(1,{type,working:true,progress:.85,out:type==='lumber'?4:0,inputs:{wood:2},animationTime:1,activeUntil:60},{time:1,power:true,batteryCharge:65},0);
   renderer.render(scene,camera);const png=renderer.domElement.toDataURL('image/png');
   scene.traverse(o=>{if(o.userData.texture)o.userData.texture.dispose();if(o.material)o.material.dispose();if(o.isLine)o.geometry.dispose();});
   return {type,png};
  });
 },only);
 for(const {type,png} of icons)await writeFile(new URL('../public/assets/pixel-environment/'+type+'-icon.png',import.meta.url),Buffer.from(png.split(',')[1],'base64'));
 console.log(icons.length+' layered building icons rendered from the runtime models.');
}finally{await browser.close();}
