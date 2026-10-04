import assert from 'node:assert/strict';
import {open,toHome,sim,waitSim,tilePoint,shot,save,browser,R} from './audit-2/_browser.mjs';

const page=await open({width:1440,height:960},{reducedMotion:'reduce'});
const report={screens:[],checks:[],viewports:[]};
const snap=async name=>{await page.waitForTimeout(180);await shot(page,name+'.png');report.screens.push(name);console.log('[screen]',name);};
const close=async()=>{await page.keyboard.press('Escape');await page.waitForTimeout(120);};
const menu=async label=>{await page.getByRole('button',{name:'게임 메뉴',exact:true}).click();if(label)await page.getByRole('button',{name:label,exact:false}).click();};
const selectBuilding=async type=>{
 const tile=await sim(page,type=>{const b=window.tgScene.sim.buildings.find(b=>b.type===type);return [b.x,b.z];},type);
 const p=await tilePoint(page,...tile);await page.mouse.click(p.px,p.py);await page.locator('.minimal-facility').waitFor();
};
const reachable=async selector=>page.locator(selector).evaluateAll(nodes=>nodes.filter(el=>el.getClientRects().length&&!el.disabled).map(el=>{const r=el.getBoundingClientRect(),at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {label:el.getAttribute('aria-label')||el.textContent.trim(),ok:!!at&&(el===at||el.contains(at)),rect:[r.x,r.y,r.width,r.height].map(Math.round)};}));
try {
 await toHome(page);
 await page.getByRole('button',{name:'초반 마을 테스트',exact:true}).click();
 await waitSim(page,()=>!!window.tgScene?.sim&&window.tgScene.sim.buildings.length>3,null,120000);
 await page.locator('.minimal-hud').waitFor();await page.waitForTimeout(6600);
 await sim(page,()=>window.tgScene.sim.paused=true);
 assert.equal(await page.locator('.minimal-hud').evaluate(el=>getComputedStyle(el).position),'absolute','minimal stylesheet loaded');
 assert.equal(await page.locator('.town-actions>button').count(),3);
 assert.equal(await page.locator('.minimal-resources>button').count(),4,'three resources and expand');
 assert.equal(await page.locator('.objective-card,.hud-stack,.side-tools,.camera-controls').count(),0,'no persistent extra rails');
 await snap('01-default');
 await page.getByRole('button',{name:'자원 펼치기',exact:true}).click();
 await page.getByText('주요 재고',{exact:true}).waitFor();await snap('02-resources');await close();
 await page.getByRole('button',{name:/배속 선택/}).click();await page.getByRole('button',{name:'2×',exact:true}).click();
 assert.equal(await sim(page,()=>window.tgScene.sim.speed),2);assert.equal(await sim(page,()=>window.tgScene.sim.paused),false);
 await page.getByRole('button',{name:'일시정지',exact:true}).click();
 await page.keyboard.press('b');await page.locator('.minimal-construction').waitFor();
 assert.equal(await page.locator('.minimal-bottom').count(),1);assert.equal(await page.locator('.town-actions').count(),0);
 await snap('03-construction');
 // The first required facility has a tab of its own (homes and civic buildings were in no tab, only the full list).
 await page.getByRole('tab',{name:'주거·도시',exact:true}).click();assert.equal(await page.getByRole('button',{name:'주민 주택 건설'}).count(),1);
 await page.getByRole('tab',{name:'생산',exact:true}).click();assert.ok(await page.locator('.minimal-build-items .build-item').count()>0);
 await page.getByLabel('전체 건설 분류',{exact:true}).selectOption('all');assert.ok(await page.locator('.minimal-build-items .build-item:disabled').count()>0);
 await page.getByRole('tab',{name:'기초',exact:true}).click();
 await page.getByRole('button',{name:'우물 건설',exact:true}).click();
 assert.equal(await page.locator('.minimal-construction').count(),0);await page.getByRole('button',{name:'배치 취소',exact:true}).waitFor();
 const empty=await sim(page,()=>{const s=window.tgScene.sim;for(let z=8;z<18;z++)for(let x=7;x<18;x++)if(!s.canBuild('well',x,z))return [x,z];});
 assert.ok(empty,'buildable tile exists');const p=await tilePoint(page,...empty);await page.mouse.click(p.px,p.py);
 await page.waitForFunction(([x,z])=>window.tgScene.sim.at(x,z)?.type==='well',empty);
 await page.locator('.minimal-facility').waitFor();report.checks.push('actual construction through pointer input');
 await close();
 await selectBuilding('lumber');await snap('04-facility');
 assert.equal(await page.locator('.minimal-bottom').count(),1);
 await page.getByRole('button',{name:'시설 가동 중지',exact:true}).click();
 assert.equal(await sim(page,()=>window.tgScene.sim.buildings.find(b=>b.type==='lumber').enabled),false);
 await page.getByRole('button',{name:'시설 가동',exact:true}).click();
 assert.equal(await sim(page,()=>window.tgScene.sim.buildings.find(b=>b.type==='lumber').enabled),true);
 await page.getByRole('button',{name:'자원 펼치기',exact:true}).click();await close();
 assert.equal(await page.locator('.minimal-facility').count(),1,'popover Escape preserves selection');
 await page.getByRole('button',{name:'시설 상세 정보',exact:true}).click();await page.locator('.facility-inspector').waitFor();
 assert.ok(await page.getByRole('button',{name:/이전 ·/}).count());assert.ok(await page.getByRole('button',{name:/철거 ·/}).count());
 await page.locator('.facility-details summary').click();await page.getByLabel('작업 우선순위',{exact:true}).selectOption('2');
 assert.equal(await sim(page,()=>window.tgScene.sim.buildings.find(b=>b.type==='lumber').priority),2);
 await snap('05-details');await close();assert.equal(await page.locator('.minimal-facility').count(),1,'dialog Escape preserves dock');
 await close();
 await selectBuilding('warehouse');await page.getByRole('button',{name:'시설 상세 정보',exact:true}).click();await snap('06-storage');await close();await close();
 await menu();await snap('07-menu');await page.getByRole('button',{name:/목표·납품/}).click();await snap('08-goals');await close();
 await menu('생산·위기');await snap('09-operations');await close();
 await menu('주민');await snap('10-residents');await close();
 await menu('주변 지형');await page.getByLabel('네 방향 주변 지형').waitFor();await snap('11-terrain');await close();
 await menu('지도 도구');const view=await sim(page,()=>window.tgScene.viewIndex);
 await page.getByRole('button',{name:'오른쪽 90도 회전',exact:true}).click();assert.notEqual(await sim(page,()=>window.tgScene.viewIndex),view);
 await page.getByLabel('토질 지도',{exact:true}).selectOption('ore');await snap('12-map-tools');await close();assert.equal(await page.locator('.soil-legend').count(),1);
 await menu('지도 도구');await page.getByLabel('토질 지도',{exact:true}).selectOption('');await page.getByRole('button',{name:'철거 도구',exact:true}).click();await page.getByRole('button',{name:'배치 취소',exact:true}).click();
 await menu('영토 확장');await page.getByRole('button',{name:'배치 취소',exact:true}).waitFor();assert.equal(await sim(page,()=>window.tgScene.mode),'expand');await close();
 await menu('게임 설정');await snap('13-settings');await close();
 await page.getByRole('button',{name:'시장',exact:true}).click();await snap('14-market');await close();
 await page.getByRole('button',{name:'거점·세계 지도',exact:true}).click();await snap('15-world');await close();
 // Closing a menu restores the previous running state.
 await page.getByRole('button',{name:'재개',exact:true}).click();await menu();assert.equal(await sim(page,()=>window.tgScene.sim.paused),true);await close();assert.equal(await sim(page,()=>window.tgScene.sim.paused),false);await page.getByRole('button',{name:'일시정지',exact:true}).click();
 for(const size of [{width:1440,height:960},{width:1024,height:768},{width:390,height:844},{width:360,height:740},{width:844,height:390}]){
  await page.setViewportSize(size);const tag=size.width+'x'+size.height;await page.waitForTimeout(150);
  const buttons=await reachable('.minimal-hud button,.minimal-bottom button');assert.deepEqual(buttons.filter(b=>!b.ok),[],tag+' idle controls reachable');
  report.viewports.push({size,buttons});await snap('idle-'+tag);
  await page.getByRole('button',{name:'건설 목록 열기',exact:true}).click();await snap('build-'+tag);
  for(const tab of await page.locator('.minimal-build-header [role=tab]').all()){await tab.click();assert.equal(await tab.getAttribute('aria-selected'),'true');}
  await page.getByRole('button',{name:'건설 목록 닫기',exact:true}).click();
  await selectBuilding('lumber');await snap('facility-'+tag);assert.deepEqual((await reachable('.minimal-facility button')).filter(b=>!b.ok),[],tag+' facility controls reachable');await page.getByRole('button',{name:'시설 정보 닫기',exact:true}).click();
  await menu();await snap('menu-'+tag);await close();
 }
 assert.deepEqual(R.errors,[]);report.errors=R.errors;report.failedRequests=R.failedRequests;await save('results.json',report);console.log('MINIMAL_UI_OK');
}catch(error){report.failure=String(error);report.errors=R.errors;await snap('failure');await save('results.json',report);throw error;}
finally{await browser.close();}
