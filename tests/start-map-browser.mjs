import assert from 'node:assert/strict';
import {NATIONS} from '../src/app/game/world.js';
import {startingProvinces,defaultStartingProvince} from '../src/app/game/starting-sites.js';
import {WORLD_CELLS} from '../src/app/game/world-grid.js';
process.env.TG_OUT||='docs/verification/start-map-20261003';
const {browser,open,toHome,shot,audit,save,R,waitSim}=await import('./audit-2/_browser.mjs');
const report={layouts:[],checks:[]},page=await open({width:1440,height:900},{reducedMotion:'reduce',hasTouch:true});
const root=page.locator('.start-world'),next=page.locator('.start-primary');
const choose=async(nation,plot)=>{await page.getByRole('button',{name:'지형으로 찾기',exact:true}).click();if(nation)await page.getByLabel('시작 국가',{exact:true}).selectOption(nation);if(plot)await page.getByLabel('시작 부지',{exact:true}).selectOption(plot);else await page.keyboard.press('Escape');};
const canvasReady=()=>waitSim(page,()=>!!window.tgScene?.landscape&&window.tgScene.worldPicking,null,120000);
const capture=async(stage,tag)=>{await page.waitForTimeout(200);const a=await audit(page,'.start-world');assert.deepEqual(a.covered,[],stage+' covered controls '+tag);assert.deepEqual(a.offscreen,[],stage+' offscreen controls '+tag);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);report.layouts.push({stage,tag,...a});await shot(page,stage+'-'+tag+'.png');};
try{
 await toHome(page);
 await page.getByRole('button',{name:'새 게임',exact:true}).click();await root.waitFor();
 assert.equal(await root.getAttribute('data-stage'),'country');assert.equal(await page.locator('.realm-card,.world-map-layout').count(),0);
 assert.equal(await page.locator('.world-place-labels [data-country]').count(),14);
 await page.getByRole('button',{name:'대륙 전체 보기'}).click();await page.locator('.world-place-labels [data-country=rivente]').click();assert.equal(await root.getAttribute('data-nation'),'rivente','Country label is clickable');
 await page.getByRole('button',{name:'지형으로 찾기',exact:true}).click();
 assert.equal(await page.locator('#realm option').count(),14);
 for(const [id,n] of Object.entries(NATIONS)){
  await page.getByLabel('시작 국가',{exact:true}).selectOption(id);
  if(n.playable)await page.locator('.start-primary:not(:disabled)').waitFor({timeout:60000});
  assert.equal(await next.isEnabled(),!!n.playable,id+' start permission');
 }
 await page.getByLabel('시작 국가',{exact:true}).selectOption('estern');await page.keyboard.press('Escape');
 report.checks.push('14 countries, playable and hostile gates, clickable country names');
 for(const viewport of [{width:1440,height:900},{width:1920,height:1080},{width:390,height:844},{width:360,height:800},{width:844,height:390}]){
  await page.setViewportSize(viewport);await page.waitForTimeout(200);const tag=viewport.width+'x'+viewport.height;
  await capture('country',tag);await next.click();assert.equal(await root.getAttribute('data-stage'),'plot');await capture('plot',tag);
  for(let q=1;q<=4;q++){await page.getByRole('button',{name:'월드 오른쪽 회전',exact:true}).click();assert.equal(await page.locator('.world-canvas canvas').getAttribute('data-camera-quarter'),String(q%4));}
  await next.click();await canvasReady();assert.equal(await root.getAttribute('data-stage'),'preview');await capture('preview',tag);
  for(let q=1;q<=4;q++){await page.getByRole('button',{name:'월드 오른쪽 회전',exact:true}).click();assert.equal(await page.locator('.world-canvas canvas').getAttribute('data-camera-quarter'),String(q%4));}
  await page.getByRole('button',{name:'부지 선택으로',exact:true}).click();assert.equal(await root.getAttribute('data-province'),defaultStartingProvince('estern').id);
  await page.getByRole('button',{name:'국가 선택으로',exact:true}).click();
 }
 report.checks.push('Five viewport sizes, three stages, four camera directions, selection preserved on back');
 await page.setViewportSize({width:1440,height:900});await next.click();
 // Click authoritative water/land squares through the actual game camera.
 const point=async cell=>page.evaluate(cell=>{const p=window.tgScene.worldScreenPoint(cell[0]*24+11.5,cell[1]*24+11.5);return {...p,inside:p.x>100&&p.x<innerWidth-100&&p.y>130&&p.y<innerHeight-190};},cell);
 let water;
 for(const c of WORLD_CELLS.filter(c=>c.terrain==='river')){const p=await point([c.cx,c.cz]);if(p.inside){water=p;break;}}
 assert.ok(water);await page.mouse.click(water.x,water.y);assert.ok(await next.isDisabled());assert.match(await root.innerText(),/수역.*정착 불가/);
 await choose('estern',defaultStartingProvince('estern').id);
 const alternative=startingProvinces('estern').find(p=>p.id!==defaultStartingProvince('estern').id&&!p.territoryId)||startingProvinces('estern')[1];
 await choose('estern',alternative.id);assert.equal(await root.getAttribute('data-province'),alternative.id);
 await page.getByRole('button',{name:'지역 자세히 보기',exact:true}).click();await page.locator('.local-map-preview canvas').waitFor();await page.keyboard.press('Escape');
 await next.click();await canvasReady();
 await page.getByRole('button',{name:'엘프족',exact:true}).click();await page.waitForTimeout(100);await canvasReady();
 const before=await page.evaluate(()=>({time:window.tgScene.sim.time,tiles:window.tgScene.sim.tiles,land:window.tgScene.sim.layout,province:window.tgScene.sim.provinceId,race:window.tgScene.sim.race,save:localStorage.getItem('first-land-v1')}));
 await page.waitForTimeout(1200);assert.equal(await page.evaluate(()=>window.tgScene.sim.time),before.time);assert.equal(before.save,null);
 const zoom=await page.evaluate(()=>window.tgScene.camera.zoom);await page.getByRole('button',{name:'월드 확대',exact:true}).click();assert.ok(await page.evaluate(()=>window.tgScene.camera.zoom)>zoom);
 await next.click();await waitSim(page,()=>!!window.tgScene?.sim&&!document.querySelector('.start-world')&&!!document.querySelector('.is-playing')&&!document.querySelector('.screen-loading'),null,120000);
 const after=await page.evaluate(()=>({tiles:window.tgScene.sim.tiles,land:window.tgScene.sim.layout,province:window.tgScene.sim.provinceId,race:window.tgScene.sim.race}));
 assert.equal(after.province,before.province);assert.equal(after.race,before.race);assert.deepEqual(after.tiles,before.tiles);assert.deepEqual(after.land,before.land);
 await shot(page,'started-game.png');report.checks.push('Water blocked, chosen plot and faction, read-only preview, preview tiles equal the actual new game');
 await page.getByRole('button',{name:'거점·외교',exact:true}).click();await page.locator('.campaign-world-layout').waitFor();
 await page.locator('.campaign-find>summary').click();
 await page.getByLabel('진출할 거점 부지',{exact:true}).selectOption(startingProvinces('estern').find(p=>p.id!==alternative.id).id);
 assert.ok(await page.locator('.expansion-offer').count());await shot(page,'in-game-world.png');await page.keyboard.press('Escape');
 report.checks.push('In-game atlas and expansion inspection remain available');
 assert.deepEqual(R.errors,[]);assert.deepEqual(R.consoleErrors,[]);assert.deepEqual(R.failedRequests,[]);
 report.result='PASS';report.browser=R;await save('browser-results.json',report);console.log(JSON.stringify({result:'PASS',screens:report.layouts.length,checks:report.checks}));
}catch(error){await shot(page,'failure.png');report.error=error.stack;report.browser=R;await save('browser-results.json',report);throw error;}finally{await browser.close();}
