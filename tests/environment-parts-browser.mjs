import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const folder='docs/verification/environment-motion-20260929';await mkdir(folder,{recursive:true});
const report={errors:[],poses:[]};
try{
 for(const mode of ['webgl','canvas']){
  const page=await browser.newPage({viewport:{width:1350,height:1080}});await page.routeWebSocket('**/*',()=>{});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',e=>{if(e.type()==='error')report.errors.push(e.text());});
  await page.goto((process.env.TOWNGRID_URL||'http://localhost:5173')+'/production-preview.html?group=newheavy'+(mode==='canvas'?'&renderer=canvas':''));
  await page.waitForFunction(()=>window.productionPreview);await page.locator('#pause').click();
  const cards=[];
  for(let view=0;view<4;view++){
   await page.locator('#view').selectOption(String(view));
   for(const time of [0,.375,.75]){
    const pose=await page.evaluate(t=>{
     window.productionPreview.setTime(t);const item=window.productionPreview.items.find(i=>i.type==='watermill');
     const part=item.model.userData.layers.find(l=>l.name.startsWith('waterwheel'));
     return {angle:part.userData.sprite.material.rotation,basis:part.userData.projection,visible:part.visible,image:item.renderer.domElement.toDataURL()};
    },time);
    assert.equal(pose.basis.length,4);cards.push(`<article><p>${view} / ${time}s</p><img src="${pose.image}"></article>`);
    report.poses.push({mode,view,time,angle:pose.angle,basis:pose.basis,visible:pose.visible});
   }
  }
  await page.setContent('<style>body{background:#eee;font:16px sans-serif;display:grid;grid-template-columns:repeat(3,400px);gap:12px}article{background:#dbe4c7}p{margin:8px}img{width:400px;image-rendering:pixelated}</style>'+cards.join(''));
  await page.screenshot({path:`${folder}/parts-${mode}.png`,fullPage:true});await page.close();
 }
 assert.deepEqual(report.errors,[]);await writeFile(folder+'/parts.json',JSON.stringify(report,null,2)+'\n');console.log('Rotating parts: 4 views × 3 poses × WebGL/CPU PASS.');
}finally{await browser.close();}
