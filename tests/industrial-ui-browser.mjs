import assert from 'node:assert/strict';
import { R, open, toHome, shot, save, browser } from './audit-2/_browser.mjs';
const report={screens:[],errors:[]};
const page=await open({width:1440,height:960},{reducedMotion:'reduce'});
const snap=async name=>{await page.waitForTimeout(200);await shot(page,name+'.png');report.screens.push(name);console.log('[screen]',name);};
const closeDialog=async()=>{await page.keyboard.press('Escape');await page.waitForTimeout(100);};
try{
 await page.goto((process.env.TOWNGRID_URL||'http://localhost:5173')+'/design-system',{waitUntil:'networkidle'});
 await page.getByRole('heading',{name:'산업 제어반',exact:true}).waitFor();
 const states=await page.evaluate(()=>{
  const root=document.querySelector('.design-system-page'),buttons=[...root.querySelectorAll('[data-slot=button]')];
  const disabled=buttons.find(b=>b.disabled),primary=buttons.find(b=>b.textContent==='건설');
  const meter=root.querySelector('[data-slot=progress-indicator]');
  return {disabled:getComputedStyle(disabled).backgroundColor,primary:getComputedStyle(primary).backgroundColor,meter:meter.getBoundingClientRect().height,position:getComputedStyle(root).position};
 });
 assert.notEqual(states.disabled,states.primary,'Locked and actionable controls have distinct surfaces');
 assert.ok(states.meter>0,'Production fill remains visible');
 await page.getByRole('button',{name:'우물',exact:false}).click();
 assert.equal(await page.locator('.ds-building-cards .build-item').first().getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('.ds-building-cards .build-item').last().isDisabled(),true);
 await page.getByRole('button',{name:'벌목장',exact:false}).click();
 await page.getByRole('tab',{name:'운송',exact:true}).click();
 assert.equal(await page.getByRole('tab',{name:'운송',exact:true}).getAttribute('aria-selected'),'true');
 await page.getByRole('tab',{name:'생산',exact:true}).click();
 await snap('01-components');
 await page.getByRole('button',{name:'건설',exact:true}).click();
 assert.equal(await page.getByRole('dialog').evaluate(el=>getComputedStyle(el).position),'fixed','Portal dialog stays over the scene');
 await snap('02-dialog');
 await closeDialog();
 await page.getByRole('button',{name:'가동 중지',exact:true}).click();
 await page.getByRole('button',{name:'생산 재개',exact:true}).waitFor();
 await page.getByRole('button',{name:'생산 재개',exact:true}).click();
 await page.setViewportSize({width:390,height:844});
 await snap('03-components-mobile');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.setViewportSize({width:1440,height:960});
 await toHome(page);
 await snap('04-home');
 await page.getByRole('button',{name:'설정',exact:true}).click();
 await snap('05-settings');
 await closeDialog();
 await page.getByRole('button',{name:'새 게임',exact:true}).click();
 await page.locator('.realm-card .start-button:not(:disabled)').waitFor({timeout:120000});
 await snap('06-world');
 await page.setViewportSize({width:390,height:844});
 await snap('07-world-mobile');
 await page.setViewportSize({width:1440,height:960});
 // Gameplay interactions and responsive layouts are covered by minimal-ui-browser.mjs.
 report.errors=R.errors;
 report.failedRequests=R.failedRequests;
 await save('results.json',report);
 assert.deepEqual(report.errors,[]);
 console.log('INDUSTRIAL_UI_OK');
}catch(error){
 report.failure=String(error);report.errors=R.errors;report.body=(await page.locator('body').innerText()).slice(0,4000);
 await snap('failure');await save('results.json',report);throw error;
}finally{await browser.close();}
