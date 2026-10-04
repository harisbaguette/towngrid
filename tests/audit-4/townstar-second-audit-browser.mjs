import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const dir='docs/verification/townstar-second-audit-20261003';await mkdir(dir,{recursive:true});
const ctx=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'}),page=await ctx.newPage(),report={errors:[]};
page.setDefaultTimeout(30000);await page.routeWebSocket('**/*',()=>{});page.on('pageerror',e=>report.errors.push(e.message));
const shot=name=>page.screenshot({path:dir+'/'+name+'.png'});
try{
 await page.goto('http://localhost:5173',{waitUntil:'domcontentloaded',timeout:120000});await page.locator('canvas[role="application"]').waitFor({state:'attached',timeout:120000});
 await page.getByRole('button',{name:'화면을 눌러 시작',exact:true}).click();await page.getByRole('button',{name:'새 게임',exact:true}).waitFor();
 await page.evaluate(async()=>{for(const url of new Set([...performance.getEntriesByType('resource').map(r=>r.name).filter(u=>/\/app\/game\/scene\.js(?:\?|$)/.test(u)),'/src/app/game/scene.js'])){const {GameScene}=await import(url),old=GameScene.prototype.setSimulation;GameScene.prototype.setSimulation=function(...args){window.auditGame=this;return old.apply(this,args);};}});
 await page.getByRole('button',{name:'산업 도전',exact:true}).click();await page.getByRole('button',{name:'강변 제빵사 시작',exact:true}).click();await page.locator('.game-shell.is-playing:not([inert]) .minimal-hud').waitFor({timeout:120000});await page.getByRole('button',{name:'일시정지',exact:true}).click();
 await page.evaluate(()=>{const s=window.auditGame.sim;s.rank=0;for(const k of Object.keys(s.stock))s.stock[k]=0;s.contracts=1;s.campaign.treasury.contractOrder={n:1,item:'grain'};s.stock.grain=10;s.revision++;});
 await page.getByRole('button',{name:'게임 메뉴',exact:true}).click();await page.getByRole('button',{name:/목표·납품/}).click();report.contract=await page.locator('.contract-box').innerText();assert.match(report.contract,/10\/14/);assert.ok(!report.contract.includes('연료'));assert.equal(await page.locator('.contract-box button').isDisabled(),true);await shot('01-hidden-contract-reason');await page.keyboard.press('Escape');
 report.storage=await page.evaluate(()=>{const g=window.auditGame,s=g.sim;s.money=1e6;s.build('house',10,14,true);s.build('sawmill',12,12,true);const m=s.at(12,12);m.out=10;s.setStorageRule(0,'plank',0);s.paused=false;for(let i=0;i<40;i++)s.tick(.25);s.paused=true;g.rebuild();g.callbacks.onClick(m.x,m.z);return {status:m.status,out:m.out,idle:s.workers.filter(w=>!w.task).length};});
 await page.getByRole('button',{name:'시설 상세 정보',exact:true}).click();report.storage.advice=await page.locator('.facility-advice').count();assert.equal(report.storage.status,'운반 대기');assert.equal(report.storage.advice,0);await shot('02-storage-policy-no-diagnosis');await page.keyboard.press('Escape');await page.keyboard.press('Escape');
 report.save=await page.evaluate(async()=>{const {encodeSave}=await import('/src/app/game/persistence.js');const g=window.auditGame,s=g.sim,m=s.at(12,12),h=s.at(10,14);s.setStorageRule(0,'plank',null);m.out=0;h.level=3;s.syncWorkers();s.stock.wood=10;s.paused=false;let carrier;
  for(let i=0;i<400;i++){s.tick(.25);carrier=s.workers.find(w=>w.task?.carried&&w.task.targetId===m.id);if(carrier)break;}if(!carrier)throw new Error('No carrier in real game');s.paused=true;s.owned=new Set(s.tiles.map(t=>t.x+','+t.z));
  for(let i=1;i<35;i++){const t=s.tiles.find(t=>!s.canBuild('house',t.x,t.z,true));if(!t||!s.build('house',t.x,t.z,true).ok)throw new Error('house fixture');s.at(t.x,t.z).level=3;}s.syncWorkers();encodeSave(s.campaign.save());s.stock.stone=s.storageCapacity-s.storageUsed;const r=s.demolish(h.x,h.z);if(!r.ok)throw new Error(r.error);g.rebuild();return {workers:s.workers.length,capacity:s.workerCount};});
 await page.getByRole('button',{name:'게임 메뉴',exact:true}).click();await page.getByRole('button',{name:'게임 설정',exact:true}).click();await page.getByRole('tab',{name:'저장·불러오기',exact:true}).click();await page.getByRole('button',{name:'지금 저장',exact:true}).click();report.save.message=await page.locator('.save-status').innerText();assert.match(report.save.message,/저장 실패/);
 await page.getByRole('button',{name:'저장 파일 내보내기',exact:true}).click();report.save.downloadLinks=await page.locator('.save-download').count();assert.equal(report.save.downloadLinks,0);await shot('03-save-and-export-rejected');assert.deepEqual(report.errors,[]);
 await writeFile(dir+'/browser.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch(e){await shot('failure').catch(()=>{});throw e;}finally{await browser.close();}
