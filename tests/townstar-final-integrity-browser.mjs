import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {weeklyTrial} from '../src/app/game/industry-trials.js';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const cpu=process.env.TG_TEST_CPU==='1',dir='docs/verification/townstar-final-integrity-20261003'+(cpu?'/cpu':'');await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await ctx.newPage(),report={errors:[]};
page.setDefaultTimeout(30000);await page.routeWebSocket('**/*',()=>{});page.on('pageerror',e=>report.errors.push(e.message));
await page.route('**/scene.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace(/setSimulation\(sim\)\s*\{/, 'setSimulation(sim){window.auditGame=this;')});});
await page.route('**/offline-progress.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace(/const processing\s*=\s*new WeakMap\(\);/, 'const processing=new WeakMap();window.auditOfflineProcessing=c=>processing.has(c);')});});
if(cpu)await page.route('**/software-renderer.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('forceSoftware = false','forceSoftware = true').replace('forceSoftware=false','forceSoftware=true')});});
await ctx.addInitScript(()=>{localStorage.setItem('towngrid-industry-records-v1',JSON.stringify({bread:{score:{bad:true},delivered:['bad']},cloth:{score:5000,elapsed:800,delivered:60,status:'won'}}));});
const shot=name=>page.screenshot({path:dir+'/'+name+'.png'});
try{
 await page.goto('http://localhost:5173',{waitUntil:'domcontentloaded',timeout:120000});await page.locator('canvas[role="application"]').waitFor({state:'attached',timeout:120000});
 await page.getByRole('button',{name:'화면을 눌러 시작',exact:true}).click();await page.getByRole('button',{name:'산업 도전',exact:true}).click();
 assert.equal(await page.locator('.industry-trials article').count(),4);const text=await page.locator('.industry-trials').innerText();assert.ok(text.includes('제한 '+(weeklyTrial().duration/80).toLocaleString('ko-KR',{maximumFractionDigits:1})+'게임일'));assert.match(text,/최고 5000점/);assert.doesNotMatch(text,/bad|object Object/);await shot('01-safe-records-mobile');
 await page.getByRole('button',{name:'강변 제빵사 시작',exact:true}).click();await page.locator('.game-shell.is-playing:not([inert]) .minimal-hud').waitFor({timeout:120000});
 report.software=await page.evaluate(()=>!!window.auditGame.renderer.isSoftware);assert.equal(report.software,cpu);
 // Quota failure in the optional records must not misreport a successful game save.
 await page.evaluate(()=>{const c=window.auditGame.sim.campaign;c.treasury.produced.bread=100;c.treasury.sold.bread=100;c.active.paused=false;c.tick(.25);window.originalRecordSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='towngrid-industry-records-v1')throw new DOMException('quota','QuotaExceededError');return window.originalRecordSet.call(this,key,value);};});
 await page.getByRole('button',{name:'게임 메뉴',exact:true}).click();await page.getByRole('button',{name:'게임 설정',exact:true}).click();await page.getByRole('tab',{name:'저장·불러오기',exact:true}).click();await page.getByRole('button',{name:'지금 저장',exact:true}).click();assert.match(await page.locator('.save-status').innerText(),/저장됨/);await page.getByText('게임은 저장됐지만 최고 기록은 보관하지 못했습니다.',{exact:true}).waitFor();
 report.quotaSave=true;await page.evaluate(()=>{Storage.prototype.setItem=window.originalRecordSet;delete window.originalRecordSet;});await page.keyboard.press('Escape');
 // Use the application's actual visibility handler; expose a test-only visibility state.
 report.cancellation=await page.evaluate(async()=>{
  const isOfflineProcessing=window.auditOfflineProcessing;const c=window.auditGame.sim.campaign,s=c.active;c.trial=null;s.nextEvent=1e12;s.money=100000;s.pendingEvent=null;c.offline.enabled=true;s.paused=false;
  let hidden=false;Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden});
  hidden=true;document.dispatchEvent(new Event('visibilitychange'));c.offline.at-=600000;const before=s.time;
  hidden=false;document.dispatchEvent(new Event('visibilitychange'));
  await new Promise((resolve,reject)=>{const start=performance.now(),timer=setInterval(()=>{if(isOfflineProcessing(c)){hidden=true;document.dispatchEvent(new Event('visibilitychange'));clearInterval(timer);resolve();}else if(performance.now()-start>10000){clearInterval(timer);reject(new Error('catch-up never started'));}},0);});
  await new Promise((resolve,reject)=>{const start=performance.now(),timer=setInterval(()=>{if(!isOfflineProcessing(c)){clearInterval(timer);resolve();}else if(performance.now()-start>10000){clearInterval(timer);reject(new Error('catch-up did not stop'));}},0);});
  const after=s.time;hidden=false;document.dispatchEvent(new Event('visibilitychange'));await new Promise(r=>setTimeout(r,100));delete document.hidden;
  return {before,after,final:s.time,paused:s.paused,running:c.offline.running};
 });
 assert.ok(report.cancellation.after>report.cancellation.before);assert.ok(report.cancellation.after-report.cancellation.before<300);assert.equal(report.cancellation.final,report.cancellation.after);assert.equal(report.cancellation.paused,true);assert.equal(report.cancellation.running,false);
 await page.locator('.game-shell.is-playing:not([inert]) .minimal-hud').waitFor();await page.getByRole('button',{name:'게임 메뉴',exact:true}).click();await page.getByRole('button',{name:'게임 설정',exact:true}).click();await page.getByRole('tab',{name:'저장·불러오기',exact:true}).click();await page.getByRole('button',{name:'지금 저장',exact:true}).click();assert.match(await page.locator('.save-status').innerText(),/저장됨/);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot('02-cancelled-return-save');
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.auditGame.sim.paused),true);await page.getByRole('button',{name:'재개',exact:true}).click();
 await page.waitForFunction(()=>!window.auditGame.sim.paused);await page.getByRole('button',{name:'게임 메뉴',exact:true}).click();await page.keyboard.press('Escape');await page.waitForFunction(()=>!window.auditGame.sim.paused);
 await page.getByRole('button',{name:'일시정지',exact:true}).click();await page.getByRole('button',{name:'게임 메뉴',exact:true}).click();await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.auditGame.sim.paused),true);report.manualPause=true;
 for(const [width,height] of [[320,740],[844,390],[1440,900]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+'px viewport');}
 assert.deepEqual(report.errors,[]);
 await writeFile(dir+'/browser.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch(e){await shot('failure').catch(()=>{});throw e;}finally{await browser.close();}
