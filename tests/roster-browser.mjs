// node tests/roster-browser.mjs <playwright-core/index.mjs> <chrome.exe>
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
const {chromium}=await import(process.argv[2]?pathToFileURL(process.argv[2]).href:'playwright');
const browser=await chromium.launch({headless:true,...(process.argv[3]?{executablePath:process.argv[3]}:{}),args:['--enable-unsafe-swiftshader']});
const origin=process.env.TOWNGRID_URL||'http://localhost:5173',out=new URL(process.env.TOWNGRID_PROOF_DIR||'../docs/verification/roster-professions/',import.meta.url);
await mkdir(out,{recursive:true});
const errors=[],failed=[],report={};
try{
 const page=await browser.newPage({viewport:{width:1440,height:1050}});
 // Keep this test snapshot stable while other local work triggers HMR.
 await page.routeWebSocket('**/*',()=>{});
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().includes('pixel-characters'))failed.push(r.url());});
 await page.goto(origin+'/character-preview/');
 await page.waitForFunction(()=>window.rosterPreview?.assets.size>=7);
 report.cast=await page.evaluate(async()=>{const p=window.rosterPreview,rows=[];for(const entry of p.cast){await p.select(entry[0]);const a=p.assets.get(entry[0]);rows.push({id:entry[0],columns:a.meta.columns.length,frames:a.meta.frames,portrait:a.meta.portraitAnimation?.frames});}return rows;});
 assert.equal(report.cast.length,51);assert.ok(report.cast.every(v=>v.columns===64&&v.frames===256&&v.portrait>8));
 await page.evaluate(()=>window.rosterPreview.select('taron'));
 await page.screenshot({path:fileURLToPath(new URL('cast-titan.png',out)),fullPage:true});
 await page.evaluate(()=>window.rosterPreview.select('hana'));
 for(const action of ['idle','walk','carry','work','pickup','drop','greet']){await page.locator('[data-action="'+action+'"]').click();assert.equal(await page.evaluate(()=>window.rosterPreview.state.action),action);}
 await page.screenshot({path:fileURLToPath(new URL('baker.png',out)),fullPage:true});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.waitForFunction(()=>document.querySelector('#portrait').currentSrc.endsWith('/portrait.png'));
 assert.match(await page.locator('#portrait').evaluate(el=>el.currentSrc),/\/portrait\.png$/);
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.waitForFunction(()=>document.querySelector('#portrait').currentSrc.endsWith('/portrait-idle.png'));
 assert.match(await page.locator('#portrait').evaluate(el=>el.currentSrc),/portrait-idle\.png$/);
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:fileURLToPath(new URL('gallery-mobile.png',out)),fullPage:true});
 await page.setViewportSize({width:1440,height:1050});
 await page.goto(origin);
 await page.locator('canvas[role="application"]').waitFor({state:'attached',timeout:120000});
 await page.getByRole('button',{name:'화면을 눌러 시작',exact:true}).click({timeout:120000});
 await page.getByRole('button',{name:'산업도시 둘러보기',exact:true}).waitFor({timeout:120000});
 await page.evaluate(async()=>{
  const urls=performance.getEntriesByType('resource').map(e=>e.name).filter(url=>/\/app\/game\/scene\.js(?:\?|$)/.test(url));
  for(const url of new Set([...urls,'/src/app/game/scene.js'])){const{GameScene}=await import(url),original=GameScene.prototype.setSimulation;GameScene.prototype.setSimulation=function(sim){window.rosterScene=this;return original.call(this,sim);};}
 });
 await page.getByRole('button',{name:'산업도시 둘러보기',exact:true}).click();
 await page.waitForFunction(()=>window.rosterScene?.workerModels?.size>0,{},{timeout:120000});
 await page.getByRole('button',{name:'일시정지',exact:true}).click();
 report.game=await page.evaluate(()=>{const scene=window.rosterScene;return {workers:scene.sim.workers.map(w=>({race:w.race,appearance:w.appearance,gender:w.gender})),staff:scene.world.children.filter(m=>m.userData.facilityStaff).map(m=>m.userData.appearance),scale:[...scene.workerModels.values()].map(m=>({race:m.userData.identity.race,height:m.userData.pixelHeight}))};});
 assert.ok(report.game.workers.every(w=>({human:'female',dwarf:'male',titan:'male'})[w.race]===w.gender));
 assert.deepEqual(report.game.staff,[],'facilities do not spawn decorative residents');
 assert.ok(report.game.scale.find(w=>w.race==='titan').height>report.game.scale.find(w=>w.race==='human').height*1.35);
 for(let view=0;view<4;view++){
  await page.evaluate(v=>window.rosterScene.setQuarterView(v),view);
  await page.waitForTimeout(180);
  const directions=await page.evaluate(()=>[...window.rosterScene.workerModels.values()].map(m=>({row:m.userData.atlas.row,columns:m.userData.atlas.columns,repeat:m.userData.texture.repeat.toArray()})));
  assert.ok(directions.every(v=>v.row>=0&&v.row<4&&v.columns===64&&v.repeat[0]===1/64&&v.repeat[1]===.25));
  await page.screenshot({path:fileURLToPath(new URL('game-view-'+view+'.png',out))});
 }
 await page.getByRole('button',{name:'주민',exact:true}).click();
 await page.locator('.resident-choice').filter({hasText:'미라'}).first().click();
 assert.match(await page.locator('.resident-illustration').getAttribute('src'),/mira\/portrait-idle\.png$/);
 assert.equal(await page.locator('.resident-actions button').count(),11);
 await page.locator('.resident-actions button').filter({hasText:'작업'}).click();
 await page.screenshot({path:fileURLToPath(new URL('residents-baker.png',out))});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:fileURLToPath(new URL('residents-mobile.png',out))});
 await page.keyboard.press('Escape');await page.setViewportSize({width:1440,height:1050});
 const bakeryId=await page.evaluate(()=>{const scene=window.rosterScene,b=scene.sim.buildings.find(b=>b.type==='bakery');scene.focusBuilding(b.id);scene.callbacks.onClick(b.x,b.z);return b.id;});
 await page.locator('.facility-card').waitFor();
 assert.equal(await page.locator('.facility-staff').count(),0);
 await page.getByRole('button',{name:'가동 중지',exact:true}).click();
 await page.waitForFunction(id=>window.rosterScene.sim.buildings.find(b=>b.id===id)?.enabled===false,bakeryId);
 assert.match(await page.locator('.facility-card').innerText(),/가동 중지/);
 await page.screenshot({path:fileURLToPath(new URL('bakery-stopped.png',out))});
 const before=await page.evaluate(()=>JSON.stringify(window.rosterScene.sim.save()));
 await page.evaluate(()=>window.rosterScene.rebuild());
 await page.waitForTimeout(250);
 assert.equal(await page.evaluate(()=>JSON.stringify(window.rosterScene.sim.save())),before,'rendered staff do not alter saved simulation');
 // Use the real canvas fallback to draw the same character atlas and anchors.
 report.cpu=await page.evaluate(async()=>{
  const{SoftwareRenderer}=await import('/src/app/game/software-renderer.js');const scene=window.rosterScene;
  const canvas=document.createElement('canvas');canvas.width=800;canvas.height=260;const ctx=canvas.getContext('2d');ctx.fillStyle='#e4eff0';ctx.fillRect(0,0,800,260);
  const models=[...scene.workerModels.values()].slice(0,4);
  // 187b773: drawPixelCharacter projects the sprite's world anchor through renderer.project; this fake renderer maps it to the slot.
  models.forEach((m,i)=>{const c={x:100+i*190,y:210};SoftwareRenderer.prototype.drawPixelCharacter.call({ctx,pixelsPerWorldUnit:150,project:()=>c},m,c);});
  window.rosterCpu=canvas.toDataURL();return {count:models.length,painted:ctx.getImageData(0,0,800,260).data.some((v,i)=>i%4===0&&v<100)};
 });assert.ok(report.cpu.count===4&&report.cpu.painted);
 const data=await page.evaluate(()=>window.rosterCpu);await writeFile(new URL('cpu-cast.png',out),Buffer.from(data.split(',')[1],'base64'));
 // Render a real elf showcase through the same live scene, in this disposable
 // browser context, to catch humanoid assumptions in spirits and centaurs.
 await page.keyboard.press('Escape');
 await page.evaluate(async()=>{
  const {createShowcase}=await import('/src/app/game/simulation.js');
  const {NATIONS,factionOf}=await import('/src/app/game/world.js');
  const loaders=performance.getEntriesByType('resource').map(e=>e.name).filter(url=>/\/app\/game\/pixel-characters\.js(?:\?|$)/.test(url));
  for(const url of new Set([...loaders,'/src/app/game/pixel-characters.js'])){
   const {loadPixelCharacters}=await import(url);
   await Promise.all(['elf','spirit','centaur','fae'].map(loadPixelCharacters));
  }
  const nation=Object.keys(NATIONS).find(id=>NATIONS[id].playable&&factionOf(NATIONS[id].race)==='elf');
  const sim=createShowcase(nation,'elf');sim.paused=true;
  window.rosterScene.setSimulation(sim);
 });
 await page.waitForFunction(()=>window.rosterScene.workerModels.size>0&&[...window.rosterScene.workerModels.values()].every(m=>m.userData.image?.width>0));
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 report.elf=await page.evaluate(()=>{const scene=window.rosterScene;return {workers:scene.sim.workers.map(w=>({race:w.race,appearance:w.appearance,gender:w.gender})),staff:scene.world.children.filter(m=>m.userData.facilityStaff).map(m=>m.userData.appearance)};});
 assert.ok(report.elf.workers.every(w=>({elf:'female',centaur:'male',fae:'female',spirit:'neutral'})[w.race]===w.gender));
 for(const id of ['silen','kai','fia','dew'])assert.ok(report.elf.workers.some(w=>w.appearance===id),id);
 assert.deepEqual(report.elf.staff,[],'elf facilities do not spawn decorative residents');
 await page.screenshot({path:fileURLToPath(new URL('elf-workforce.png',out))});
 report.errors=errors;report.failed=failed;assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 await writeFile(new URL('browser-check.json',out),JSON.stringify(report,null,2)+'\n');console.log('Roster gallery, portraits, 4 views, facility work/stop, resident UI, mobile and CPU PASS');
}finally{await browser.close();}
