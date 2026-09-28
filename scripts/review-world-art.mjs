import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const out=new URL('../docs/verification/world-v5/',import.meta.url);await mkdir(out,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto((process.env.TOWNGRID_URL||'http://localhost:5173')+'/environment-preview.html');await page.waitForFunction(()=>window.environmentPreview,{},{timeout:120000});await page.evaluate(()=>window.environmentPreview.pause());
 for(const region of ['river','coast','highland']){
  await page.locator('#region').selectOption(region);
  for(const view of [0,1,2,3]){
   await page.evaluate(view=>window.environmentPreview.game.setQuarterView(view),view);await page.waitForTimeout(180);
   await page.screenshot({path:fileURLToPath(new URL(region+'-'+view+'.png',out))});
  }
 }
 await writeFile(new URL('render-errors.json',out),JSON.stringify(errors,null,2));console.log({errors});
}finally{await browser.close();}
