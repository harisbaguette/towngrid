import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createCommunity} from '../server/community.mjs';
const origin=process.env.TOWNGRID_URL||'http://localhost:5173',out='work/community-browser';
await mkdir(out,{recursive:true});
const service=createCommunity({database:':memory:',origin}),server=createServer(service.handler);
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const api='http://127.0.0.1:'+server.address().port;
const {chromium}=await import(pathToFileURL(process.argv[2]).href),browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const errors=[],report={layouts:[],checks:[]};let page;
async function open(){
 const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'}),p=await context.newPage();
 p.setDefaultTimeout(30000);await p.routeWebSocket('**/*',()=>{});p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/app/game/scene.js*',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace(/setSimulation\(([^)]*)\)\s*\{/,m=>m+'window.testScene=this;')});});
 await p.route('**/api/community/**',async route=>{const req=route.request(),headers={...req.headers()};delete headers.host;delete headers['content-length'];const r=await fetch(api+new URL(req.url()).pathname+new URL(req.url()).search,{method:req.method(),headers,...(req.postData()?{body:req.postData()}:{})});await route.fulfill({status:r.status,headers:Object.fromEntries(r.headers),body:Buffer.from(await r.arrayBuffer())});});
 await p.goto(origin,{waitUntil:'domcontentloaded',timeout:120000});
 for(let n=0;n<30&&!await p.getByRole('button',{name:'새 게임',exact:true}).isVisible();n++){await p.getByRole('button',{name:'화면을 눌러 시작',exact:true}).click().catch(()=>{});await p.waitForTimeout(250);}
 await p.waitForFunction(()=>[...document.querySelectorAll('.home-menu button')].some(b=>b.textContent==='새 게임'&&!b.disabled),null,{timeout:120000});return p;
}
async function online(p){await p.getByRole('button',{name:'게임 메뉴',exact:true}).click();await p.getByRole('button',{name:/온라인·서버 저장/}).click();await p.locator('.community-panel').waitFor();}
try{
 page=await open();
 for(const size of [{width:390,height:844},{width:844,height:390}]){await page.setViewportSize(size);const controls=await page.locator('.home-menu button').evaluateAll(nodes=>nodes.filter(el=>el.getClientRects().length).map(el=>{const r=el.getBoundingClientRect(),t=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {name:el.textContent,reachable:el===t||el.contains(t)};}));assert.ok(controls.every(c=>c.reachable),JSON.stringify(controls));await page.screenshot({path:out+'/home-'+size.width+'.png'});}
 await page.setViewportSize({width:1440,height:900});
 await page.getByRole('button',{name:'산업 도전',exact:true}).click();assert.equal(await page.locator('.industry-trials article').count(),10);await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'새 게임',exact:true}).click();for(let n=0;n<3;n++)await page.locator('.start-primary').click();
 await page.locator('.game-shell.is-playing:not([inert]) .focus-next').waitFor({timeout:120000});
 assert.match(await page.locator('.focus-next').innerText(),/첫 시설/);await page.locator('.focus-next').click();await page.locator('.minimal-construction').waitFor();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'일시정지',exact:true}).click();
 for(const size of [{width:1440,height:900},{width:390,height:844},{width:360,height:740},{width:844,height:390}]){
  await page.setViewportSize(size);await page.waitForTimeout(200);const reachable=await page.locator('.focus-next').evaluate(el=>{const r=el.getBoundingClientRect(),t=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return (el===t||el.contains(t))&&r.x>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;});assert.ok(reachable);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));report.layouts.push(size);await page.screenshot({path:out+'/focus-'+size.width+'.png'});
 }
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{window.testScene.sim.money=60;window.testScene.callbacks.onUpdate(window.testScene.sim);});await page.locator('.focus-next').filter({hasText:'운영비·연료 예산'}).click();await page.getByRole('status').filter({hasText:'운송 3회분 연료'}).waitFor();await page.screenshot({path:out+'/mobile-operating-reserve.png'});await page.keyboard.press('Escape');await page.evaluate(()=>{window.testScene.sim.money=1900;});await online(page);
 await page.getByLabel('계정 작업').selectOption('register');await page.getByLabel('계정 이름',{exact:true}).fill('Browser-player');await page.getByLabel('계정 비밀번호',{exact:true}).fill('browser test password 123');await page.getByRole('button',{name:'계정 만들기',exact:true}).click();await page.getByLabel('계정 복구 코드',{exact:true}).waitFor();assert.equal((await page.getByLabel('계정 복구 코드',{exact:true}).inputValue()).length,48);await page.getByRole('button',{name:'보관했습니다'}).click();
 await page.getByRole('button',{name:'현재 마을 서버에 저장',exact:true}).click();await page.getByRole('status').filter({hasText:'현재 마을을 서버에 저장했습니다.'}).waitFor();await page.screenshot({path:out+'/mobile-cloud.png'});
 await page.getByRole('tab',{name:'상회',exact:true}).click();await page.getByLabel('새 상회 이름').fill('Browser guild');await page.getByRole('button',{name:'상회 만들기',exact:true}).click();await page.getByLabel('상회 초대 코드').waitFor();assert.equal((await page.getByLabel('상회 초대 코드').inputValue()).length,24);
 const device=await open();await device.getByRole('button',{name:/온라인·서버 저장/}).click();await device.getByLabel('계정 이름',{exact:true}).fill('Browser-player');await device.getByLabel('계정 비밀번호',{exact:true}).fill('browser test password 123');await device.getByRole('button',{name:'로그인',exact:true}).click();await device.getByRole('button',{name:'서버 저장 불러오기',exact:true}).click();await device.locator('.game-shell.is-playing:not([inert]) .focus-next').waitFor({timeout:120000});assert.equal(await device.evaluate(()=>window.testScene.sim.paused),true);
 await online(device);await device.getByRole('tab',{name:'계정·저장',exact:true}).click();await device.getByRole('button',{name:'현재 마을 서버에 저장',exact:true}).click();await device.getByRole('status').filter({hasText:'현재 마을을 서버에 저장했습니다.'}).waitFor();
 await page.getByRole('tab',{name:'계정·저장',exact:true}).click();await page.getByRole('button',{name:'현재 마을 서버에 저장',exact:true}).click();await page.getByRole('alert').filter({hasText:'다른 기기의 저장이 바뀌었습니다.'}).waitFor();await page.screenshot({path:out+'/cloud-conflict.png'});report.checks.push('two independent browser devices, registration, recovery code, guild, cloud upload/load, conflict protection');
 await device.context().close();await page.keyboard.press('Escape');await page.getByRole('button',{name:'게임 메뉴',exact:true}).click();await page.getByRole('button',{name:/플레이 점검 기록/}).click();await page.getByRole('button',{name:'점검 기록 내려받기'}).waitFor();assert.equal(await page.getByRole('button',{name:'점검 기록 내려받기'}).isEnabled(),true);await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'게임 메뉴',exact:true}).click();await page.getByRole('button',{name:/시작 화면/}).click();await page.getByRole('button',{name:'산업 도전',exact:true}).click();await page.getByRole('button',{name:'숲의 제재소 시작',exact:true}).click();await page.locator('.game-shell.is-playing:not([inert]) .industry-trial-status').waitFor({timeout:120000});
 await page.evaluate(()=>{const c=window.testScene.sim.campaign;c.active.paused=false;while(c.trial.status==='playing')c.tick(.25);});await online(page);await page.getByRole('tab',{name:'사람끼리 순위',exact:true}).click();await page.getByRole('button',{name:'완료한 도전 기록 제출',exact:true}).click();await page.getByRole('status').filter({hasText:'검증된 점수'}).waitFor();assert.match(await page.locator('.community-panel table').first().innerText(),/Browser-player/);await page.screenshot({path:out+'/verified-score.png'});
 report.checks.push('10 trial cards, first-action button, local timing export, actual recorded trial replay submitted through UI');assert.deepEqual(errors,[]);await writeFile(out+'/results.json',JSON.stringify({...report,errors},null,2));console.log('PASS community browser '+JSON.stringify(report));
}catch(e){await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e;}finally{await browser.close();await new Promise(r=>server.close(r));service.close();}
