import assert from 'node:assert/strict';
process.env.TG_OUT||='docs/verification/ui-polish-20261003/final';
const {open,toHome,sim,waitSim,shot,save,browser,R}=await import('./audit-2/_browser.mjs');
const page=await open({width:1440,height:900},{reducedMotion:'reduce'}),report={screens:[],checks:[]};
const close=async()=>{await page.keyboard.press('Escape');await page.waitForTimeout(100);};
const menu=async label=>{await page.getByRole('button',{name:'게임 메뉴',exact:true}).click();if(label)await page.getByRole('button',{name:label,exact:false}).click();};
async function capture(name){
 await page.waitForTimeout(100);
 const metrics=await page.locator('.game-dialog').evaluate(el=>{
  const body=el.querySelector('.dialog-scroll-body'),bounds=body.getBoundingClientRect(),title=el.querySelector('[data-slot=dialog-title]').getBoundingClientRect();
  const painted=b=>{if(!b.getClientRects().length||b.disabled)return false;for(let p=b.parentElement;p&&p!==el;p=p.parentElement)if(p.tagName==='DETAILS'&&!p.open&&!p.querySelector(':scope>summary')?.contains(b))return false;return true;};
  const shown=[...el.querySelectorAll('button,summary,input:not([type=range]),select')].filter(painted).map(b=>{const r=b.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,top=document.elementFromPoint(x,y);let visible=y>=Math.max(bounds.top,title.bottom)&&y<bounds.bottom&&x>=bounds.left&&x<bounds.right;for(let p=b.parentElement;p&&p!==el;p=p.parentElement){const style=getComputedStyle(p),box=p.getBoundingClientRect();if(style.overflowY!=='visible'&&(y<box.top||y>box.bottom)||style.overflowX!=='visible'&&(x<box.left||x>box.right))visible=false;}return {name:b.getAttribute('aria-label')||b.textContent.trim().slice(0,35),visible,hit:!!top&&(top===b||b.contains(top)),w:r.width,h:r.height,switch:b.getAttribute('role')==='switch'};}).filter(b=>b.visible);
  return {overflow:body.scrollWidth>body.clientWidth+2,width:[body.scrollWidth,body.clientWidth],outside:[...body.querySelectorAll('*')].filter(b=>b.getClientRects().length&&b.getBoundingClientRect().right>bounds.right+2).map(b=>b.className).slice(0,8),covered:shown.filter(b=>!b.hit),tiny:shown.filter(b=>!b.switch&&(b.w<28||b.h<28)),shown:shown.length,scrollHeight:body.scrollHeight};
 });
 report.screens.push({name,...metrics});
 await shot(page,name+'.png');console.log(name);
}
try{
 await toHome(page);await page.getByRole('button',{name:'초반 마을 테스트',exact:true}).click();await waitSim(page,()=>!!window.tgScene?.sim&&window.tgScene.sim.buildings.length>3,null,120000);await page.locator('.minimal-hud').waitFor();await sim(page,()=>{window.tgScene.sim.paused=true;window.tgScene.sim.autoSell={};});
 // A real sale and import use the selected order quantity and live transport.
 await page.getByRole('button',{name:'시장',exact:true}).click();await page.getByLabel('상품 검색').fill('목재');assert.equal(await page.locator('.market-row').count(),1);
 await page.getByLabel('주문 수량',{exact:true}).fill('3');await page.getByRole('button',{name:'목재 3개 판매',exact:true}).click();
 assert.ok(await sim(page,()=>window.tgScene.sim.shipments.some(s=>s.item==='wood'&&s.amount===3)));
 await page.evaluate(async()=>{const {tickShipments}=await import('/src/app/game/export-route.js');for(let i=0;i<1200;i++)tickShipments(window.tgScene.sim,.25);});
 await page.getByRole('tab',{name:'수입',exact:true}).click();await page.getByLabel('상품 검색').fill('연료');await page.getByRole('button',{name:'연료 1개 수입',exact:true}).click();
 assert.ok(await sim(page,()=>window.tgScene.sim.shipments.some(s=>s.kind==='import'&&s.item==='fuel'&&s.amount===1)));
 await page.evaluate(async()=>{const {tickShipments}=await import('/src/app/game/export-route.js');for(let i=0;i<1200;i++)tickShipments(window.tgScene.sim,.25);});
 await page.getByRole('tab',{name:'판매',exact:true}).click();await page.getByLabel('상품 검색').fill('목재');await page.getByRole('switch',{name:'목재 자동 판매',exact:true}).click();await page.getByLabel('목재 최소 보관').fill('12');assert.equal(await sim(page,()=>window.tgScene.sim.reserves.wood),12);
 await page.getByLabel('상품 검색').fill('없는상품');assert.match(await page.locator('.market-panel').innerText(),/검색한 상품이 없습니다/);await close();
 report.checks.push('Search, empty results, real 3-item sale, fuel import, auto-sale reserve');
 // General settings and file tools remain reachable on separate tabs.
 await menu('게임 설정');await page.getByLabel('그래픽 품질',{exact:true}).selectOption('balanced');await page.getByLabel('전체 음량',{exact:true}).fill('0.5');assert.equal(await page.getByLabel('전체 음량',{exact:true}).inputValue(),'0.5');
 await page.getByRole('tab',{name:'저장·불러오기',exact:true}).click();await page.getByRole('button',{name:'저장 파일 내보내기',exact:true}).click();await page.getByText('텍스트로 보관',{exact:true}).click();
 const exported=await page.getByLabel('저장 파일 내용',{exact:true}).inputValue();assert.ok(JSON.parse(exported).version);await close();
 report.checks.push('Audio/quality controls and valid save export');
 for(const viewport of [{width:1440,height:900},{width:1024,height:768},{width:390,height:844},{width:360,height:740},{width:844,height:390}]){
  await page.setViewportSize(viewport);const tag=viewport.width+'x'+viewport.height;
  await page.getByRole('button',{name:'시장',exact:true}).click();await capture('market-'+tag);await page.getByRole('tab',{name:'수입',exact:true}).click();await capture('import-'+tag);await page.getByRole('tab',{name:'판매',exact:true}).click();await page.locator('.market-logistics>summary').click();await page.getByLabel('교역 도시',{exact:true}).selectOption({index:0});await capture('transport-'+tag);await close();
  await menu('게임 설정');await capture('settings-'+tag);await page.getByRole('tab',{name:'저장·불러오기',exact:true}).click();await capture('save-'+tag);await close();
  await menu('목표·납품');await capture('goals-'+tag);await page.getByRole('tab',{name:'빚·가족·자치',exact:true}).click();await capture('story-'+tag);await close();
  await menu('주민');await capture('residents-'+tag);await page.locator('.resident-choice').nth(1).click();assert.equal(await page.locator('.resident-choice').nth(1).getAttribute('aria-pressed'),'true');await page.locator('.resident-motion>summary').click();await page.getByRole('button',{name:'걷기',exact:true}).click();await page.getByRole('button',{name:'왼쪽 뒤',exact:true}).click();await close();
  await page.getByRole('button',{name:'거점·세계 지도',exact:true}).click();await capture('world-'+tag);await page.locator('.campaign-find>summary').click();await page.getByLabel('세계 지도 국가',{exact:true}).selectOption('estern');await page.getByLabel('진출할 거점 부지',{exact:true}).selectOption({index:2});await page.locator('.campaign-preview>summary').click();await page.locator('.local-map-preview canvas').waitFor();await capture('world-detail-'+tag);
  for(const tab of ['운송망','운영과 외교','신생 국가']){await page.getByRole('tab',{name:tab,exact:true}).click();await capture(tab+'-'+tag);}await close();
 }
 report.checks.push('Five viewport sizes; market, transport, settings, save, goals, story, residents, atlas, preview, freight and diplomacy; controls reachable without overlap');
 assert.deepEqual(report.screens.filter(s=>s.overflow||s.covered.length||s.tiny.length),[],'Visible controls must fit and remain reachable');
 assert.deepEqual(R.errors,[]);assert.deepEqual(R.consoleErrors,[]);assert.deepEqual(R.failedRequests,[]);report.result='PASS';report.browser=R;await save('results.json',report);console.log('UI_POLISH_OK');
}catch(error){report.result='FAIL';report.error=error.stack;report.browser=R;await shot(page,'failure.png');await save('results.json',report);throw error;}finally{await browser.close();}
