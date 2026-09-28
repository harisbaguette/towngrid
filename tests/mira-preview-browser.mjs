// node tests/mira-preview-browser.mjs <playwright/index.mjs> <chrome.exe>
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const browser=await chromium.launch({headless:true,...(process.argv[3]?{executablePath:process.argv[3]}:{})});
const out=new URL('../docs/verification/mira-runtime/',import.meta.url);
await mkdir(out,{recursive:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1080}}), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.TOWNGRID_URL || 'http://localhost:5173')+'/character-preview/mira/');
 await page.waitForFunction(()=>window.miraPreview?.meta.revision==='mira-quarter-rig-4');
 assert.ok((await page.locator('#portrait').evaluate(e=>e.currentSrc)).endsWith('/portrait-idle.png'));
 await page.locator('#view-all').check();
 await page.getByRole('button',{name:'일시정지',exact:true}).click();
 await page.screenshot({path:fileURLToPath(new URL('preview-four-directions.png',out)),fullPage:true});
 for(const action of ['walk','carry','idle','work','greet','cargo','rotation']) {
  await page.locator(`[data-action="${action}"]`).click();
  for(const direction of ['SW','NW','NE','SE']) {
   await page.locator(`[data-direction="${direction}"]`).click();
   await page.locator('#step').click();
   assert.ok((await page.locator('#frame-label').textContent()).includes('프레임'));
  }
 }
 await page.locator('[data-action="carry"]').click();
 await page.screenshot({path:fileURLToPath(new URL('preview-carry.png',out)),fullPage:true});
 const ratio=await page.locator('#stage').evaluate(e=>({display:e.clientWidth/e.clientHeight,source:e.width/e.height}));
 assert.ok(Math.abs(ratio.display-ratio.source)<.02,'CSS must not stretch the character proportions');
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:fileURLToPath(new URL('preview-mobile.png',out)),fullPage:true});
 assert.deepEqual(errors,[]);
 await writeFile(new URL('preview-check.json',out),JSON.stringify({runtimeAtlas:true,actions:7,directions:4,ratio,mobileOverflow:false,errors},null,2));
 console.log('Mira preview: runtime assets, 7 actions, 4 directions, correct aspect ratio, mobile and browser errors passed.');
}finally{await browser.close();}
