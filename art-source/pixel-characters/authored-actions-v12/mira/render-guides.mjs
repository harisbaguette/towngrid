import {readFile,writeFile,readdir} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const folder=fileURLToPath(new URL('./',import.meta.url));
const browser=await chromium.launch({executablePath:process.argv[3],headless:true});
try{
 const page=await browser.newPage({viewport:{width:1536,height:768}});
 for(const file of await readdir(folder))if(file.endsWith('.svg')){
  const svg=await readFile(`${folder}/${file}`,'utf8');
  const png=await page.evaluate(async svg=>{
   const img=new Image();img.src='data:image/svg+xml;base64,'+btoa(svg);await img.decode();
   const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;canvas.getContext('2d').drawImage(img,0,0);return canvas.toDataURL();
  },svg);
  await writeFile(`${folder}/${file.replace('.svg','.png')}`,Buffer.from(png.split(',')[1],'base64'));
 }
}finally{await browser.close();}
