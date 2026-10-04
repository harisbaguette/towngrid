import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decodeSave} from '../src/app/game/persistence.js';
process.env.TG_OUT ||= 'docs/verification/front-ui-20261003/layouts';
const {browser,open,origin,shot,save,R,toHome,demo,waitSim}=await import('./audit-2/_browser.mjs');
const page=await open({width:1440,height:900},{reducedMotion:'reduce'}),report={screens:[],checks:[]};
const toolbar=()=>page.getByRole('navigation',{name:'화면 미리보기'});
const view=async label=>{await toolbar().getByRole('button',{name:label,exact:true}).click();await page.waitForTimeout(80);};
const decoded=()=>page.waitForFunction(()=>[...document.querySelectorAll('.front-screen img:not([loading=lazy])')].every(img=>img.complete&&img.naturalWidth>0));
async function capture(name){
 await decoded();
 const metrics=await page.locator('.front-screen').evaluate(root=>{
  const controls=[...root.querySelectorAll('button,summary,a')].filter(b=>{
   if(!b.getClientRects().length||b.disabled)return false;
   for(let p=b.parentElement;p&&p!==root;p=p.parentElement)if(p.tagName==='DETAILS'&&!p.open&&!p.querySelector(':scope>summary')?.contains(b))return false;
   return true;
  }).map(b=>{
   const r=b.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
   let shown=x>=0&&x<innerWidth&&y>=44&&y<innerHeight;
   for(let p=b.parentElement;p&&p!==root;p=p.parentElement){const s=getComputedStyle(p),q=p.getBoundingClientRect();if(s.overflowX!=='visible'&&(x<q.left||x>q.right)||s.overflowY!=='visible'&&(y<q.top||y>q.bottom))shown=false;}
   const top=document.elementFromPoint(x,y),s=getComputedStyle(b);
   return {name:b.getAttribute('aria-label')||b.textContent.trim().slice(0,30),shown,hit:top===b||b.contains(top),width:r.width,height:r.height,shadow:s.boxShadow};
  }).filter(b=>b.shown);
  const unskinned=[...root.querySelectorAll('.screen-button,.screen-back,.screen-sound,.screen-motion-toggle')].filter(el=>el.getClientRects().length&&getComputedStyle(el,'::before').borderImageSource==='none').map(el=>el.className);
  return {overflow:document.documentElement.scrollWidth>innerWidth,covered:controls.filter(b=>!b.hit),tiny:controls.filter(b=>b.width<32||b.height<38),unskinned,count:controls.length};
 });
 report.screens.push({name,...metrics});await shot(page,name+'.png');console.log(name);
 assert.equal(metrics.overflow,false,name+' page overflow');assert.deepEqual(metrics.covered,[],name+' covered controls');assert.deepEqual(metrics.tiny,[],name+' tiny controls');assert.deepEqual(metrics.unskinned,[],name+' missing approved component artwork');
}
try{
 await page.goto(origin+'/screen-preview/');await page.locator('.art-gallery').waitFor();
 await page.waitForFunction(()=>Object.keys(document.querySelector('.gallery-controls button')||{}).some(k=>k.startsWith('__reactProps$')));
 await page.evaluate(()=>{window.realRandom=Math.random;Math.random=()=>.99;localStorage.setItem('front-ui-save-sentinel','untouched');});
 for(const viewport of [{width:1440,height:900},{width:1920,height:1080},{width:390,height:844},{width:360,height:800},{width:844,height:390}]){
  await page.setViewportSize(viewport);const tag=viewport.width+'x'+viewport.height;
  await view('대기 화면');await capture('title-'+tag);
  await page.keyboard.press('Enter');await page.locator('.home-screen').waitFor();await capture('home-'+tag);
  assert.equal(await page.locator('.home-extras').getAttribute('open'),null);
  assert.equal(await page.locator('.home-menu button').first().innerText(),'새 게임');
  assert.equal(await page.getByRole('button',{name:'이어하기',exact:true}).isDisabled(),true);
  assert.equal(await page.locator('.home-menu .primary').count(),1);
  const homeFit=await page.locator('.home-logo,.home-to-title,.home-menu').evaluateAll(els=>els.every(el=>{const r=el.getBoundingClientRect();return r.top>=44&&r.bottom<=innerHeight;}));assert.equal(homeFit,true,tag+' default menu fits');
  await page.locator('.home-extras>summary').click();await capture('extras-'+tag);
  await page.getByRole('link',{name:'지형 8종 테스트'}).scrollIntoViewIfNeeded();assert.equal(await page.getByRole('link',{name:'지형 8종 테스트'}).getAttribute('href'),'/biome-preview.html');
  await page.locator('.home-extras>summary').click();await page.getByRole('button',{name:'마을의 하루',exact:true}).click();await capture('gallery-'+tag);
  await view('로딩 화면');await capture('loading-'+tag);
  assert.equal(await page.locator('[role=progressbar]').getAttribute('aria-valuenow'),null,'Indeterminate load must not invent a percentage');
  await view('복구 화면');await capture('recovery-'+tag);
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'진행 파일로 보관');
  await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'화면 다시 열기');
  await page.getByRole('button',{name:'화면 다시 열기',exact:true}).click();await page.locator('.home-screen').waitFor();
 }
 assert.equal(await page.evaluate(()=>localStorage.getItem('front-ui-save-sentinel')),'untouched');
 report.checks.push('Five viewport sizes, title keyboard entry, primary-first home, folded extras, gallery, indeterminate loading, recovery focus loop and retry');
 const live=await open({width:1440,height:900},{reducedMotion:'reduce'});
 await toHome(live,{previewMenu:false});assert.equal(await live.locator('.home-extras').getAttribute('open'),null);
 await shot(live,'actual-home.png');await demo(live,'초반 마을 테스트');
 await live.getByRole('button',{name:'게임 메뉴',exact:true}).click();await live.getByRole('dialog').waitFor();
 await live.evaluate(()=>{window.tgLossExtension=window.tgScene.renderer.getContext().getExtension('WEBGL_lose_context');window.tgLossExtension.loseContext();});
 await live.locator('.screen-error').waitFor();assert.equal(await live.getByRole('dialog').count(),0,'Close underlying modal so recovery can receive focus');
 await live.waitForFunction(()=>!!document.activeElement.closest('.screen-error'));
 assert.equal(await live.evaluate(()=>window.tgScene.sim.paused),true);
 await live.locator('[data-sonner-toast]').waitFor({state:'detached'});
 await shot(live,'actual-context-lost.png');
 await live.getByRole('button',{name:'진행 파일로 보관',exact:true}).click();
 const downloadPromise=live.waitForEvent('download');await live.getByRole('link',{name:'파일 저장 · JSON',exact:true}).click();
 const download=await downloadPromise,raw=await readFile(await download.path(),'utf8'),saved=decodeSave(raw);
 assert.ok(saved.sites?.length>0,'Recovery download contains the real campaign');
 assert.match(download.suggestedFilename(),/^towngrid-recovery-.*\.json$/);
 await shot(live,'actual-recovery-download.png');
 await live.evaluate(()=>window.tgLossExtension.restoreContext());await live.locator('.screen-error').waitFor({state:'detached',timeout:60000});await waitSim(live,()=>!window.tgScene.contextLost);
 await live.getByRole('button',{name:'게임 메뉴',exact:true}).click();await live.getByRole('button',{name:'시작 화면',exact:true}).click();await live.locator('.home-screen').waitFor();
 report.checks.push('Actual WebGL loss while a modal is open, paused simulation, focused recovery, valid campaign download, context restoration and home navigation');
 // Fail renderer initialization only in an isolated browser; production has no test switches.
 const failedContext=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 await failedContext.addInitScript(()=>{
  window.WebSocket=class{addEventListener(){}removeEventListener(){}send(){}close(){}};
 });
 let injected=false;
 await failedContext.route('**/app/game/software-renderer.js*',async route=>{
  const response=await route.fetch(),body=await response.text();
  const changed=body.replace(/function createRenderer\s*\([^)]*\)\s*\{/,'$& throw new Error("Renderer startup test failure");');
  assert.notEqual(body,changed,'Renderer failure must be injected');injected=true;await route.fulfill({response,body:changed});
 });
 const failed=await failedContext.newPage(),fatalErrors=[];failed.on('pageerror',error=>fatalErrors.push(error.message));
 await failed.goto(origin);await failed.getByRole('heading',{name:'마을을 열지 못했습니다'}).waitFor({timeout:120000});
 assert.equal(injected,true);
 assert.equal(await failed.getByRole('button',{name:'진행 파일로 보관',exact:true}).count(),0);
 await shot(failed,'actual-startup-error.png');await failed.setViewportSize({width:360,height:800});await shot(failed,'actual-startup-error-mobile.png');
 await failed.getByRole('button',{name:'화면 다시 열기',exact:true}).click();await failed.getByRole('heading',{name:'마을을 열지 못했습니다'}).waitFor({timeout:120000});
 assert.deepEqual(fatalErrors,[]);await failedContext.close();
 report.checks.push('Renderer initialization failure displays branded error and retry; no export offered before a campaign exists');
 assert.deepEqual(R.errors,[]);assert.deepEqual(R.consoleErrors,[]);assert.deepEqual(R.failedRequests,[]);
 await save('results.json',{result:'PASS',...report,browser:R});
}catch(error){await shot(page,'failure.png');await save('results.json',{result:'FAIL',error:String(error),...report,browser:R});throw error;}finally{await browser.close();}
