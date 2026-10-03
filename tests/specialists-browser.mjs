// Standalone real-scene/component coverage, independent of world-map UI work.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
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
 report.cast=await page.evaluate(async()=>{const p=window.rosterPreview,rows=[];for(const e of p.cast){await p.select(e[0]);const a=p.assets.get(e[0]);rows.push({id:e[0],columns:a.meta.columns.length,frames:a.meta.frames,portrait:a.meta.portraitAnimation.frames,actions:Object.keys(a.meta.clips)});}return rows;});
 assert.equal(report.cast.length,51);assert.ok(report.cast.every(v=>v.columns===64&&v.frames===256&&v.portrait>8));
 for(const id of ['dorin','nara','borik','cedric','otto','garen']){
  await page.evaluate(id=>window.rosterPreview.select(id),id);
  await page.locator('[data-action="work"]').click();
  await page.screenshot({path:fileURLToPath(new URL('profession-'+id+'.png',out))});
 }
 for(const action of ['attack','hurt','defeat','turn']){await page.locator('[data-action="'+action+'"]').click();assert.equal(await page.evaluate(()=>window.rosterPreview.state.action),action);}
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.waitForFunction(()=>document.querySelector('#portrait').currentSrc.endsWith('/portrait.png'));
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:fileURLToPath(new URL('professions-mobile.png',out))});
 await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:1440,height:1050});
 await page.goto(origin+'/environment-preview.html');
 await page.waitForFunction(()=>window.environmentPreview?.game?.sim?.buildings.length>0,null,{timeout:120000});
 await page.evaluate(()=>window.environmentPreview.pause());
 report.factions={};
 for(const race of ['human','elf']){
  await page.evaluate(async race=>{
   const {createShowcase}=await import('/src/app/game/simulation.js');
   const {loadAssets}=await import('/src/app/game/assets.js');
   const {NATIONS,factionOf}=await import('/src/app/game/world.js');
   await Promise.all((race==='human'?['human','dwarf','titan']:['elf','spirit','centaur','fae']).map(loadAssets));
   const nation=Object.keys(NATIONS).find(id=>NATIONS[id].playable&&factionOf(NATIONS[id].race)===race);
   const sim=createShowcase(nation,race);sim.paused=true;
   const {FACILITY_PROFESSIONS,facilityRoster}=await import('/src/app/game/facility-staff.js');
   const present=new Set(sim.buildings.map(b=>FACILITY_PROFESSIONS[b.type]));
   for(const [type,job]of Object.entries(FACILITY_PROFESSIONS))if(!present.has(job)){
    const tile=sim.tiles.find(t=>t.x>5&&t.x<20&&t.z>5&&t.z<20&&t.terrain!=='water'&&!sim.at(t.x,t.z)&&!sim.roads.has(t.x+','+t.z));
    if(!tile)throw Error('No space for profession '+job);tile.nature=null;sim.owned.add(tile.x+','+tile.z);
    sim.buildings.push({id:sim.nextId++,type,x:tile.x,z:tile.z,size:1,level:1,race,health:100,enabled:true,inputs:{},out:0,progress:0,working:false,status:'',age:0,priority:1});present.add(job);
   }
   window.previewProfessions=facilityRoster(sim);window.environmentPreview.game.setSimulation(sim);window.environmentPreview.game.camera.zoom=1.2;window.environmentPreview.game.camera.updateProjectionMatrix();
  },race);
  await page.waitForFunction(()=>window.environmentPreview.game.workerModels.size>0&&[...window.environmentPreview.game.workerModels.values()].every(m=>m.userData.atlas.columns===64));
  report.factions[race]=await page.evaluate(()=>{const g=window.environmentPreview.game;return {staff:window.previewProfessions.map(w=>w.appearance),spawned:g.world.children.filter(m=>m.userData.facilityStaff).length,workers:g.sim.workers.map(w=>({appearance:w.appearance,gender:w.gender,race:w.race}))};});
  assert.equal(report.factions[race].spawned,0,'workplaces do not add map residents');
  for(const id of race==='human'?['dorin','nara','borik','cedric','bel','dax','garen']:['elvar','lyra','oriel','mist','vian','norin','aster'])assert.ok(report.factions[race].staff.includes(id),id);
  for(let view=0;view<4;view++){
   await page.evaluate(view=>window.environmentPreview.game.setQuarterView(view),view);await page.waitForTimeout(100);
   assert.ok(await page.evaluate(()=>[...window.environmentPreview.game.workerModels.values()].every(m=>m.userData.texture.repeat.x===1/64&&m.userData.atlas.rows===4)));
   await page.screenshot({path:fileURLToPath(new URL('professions-'+race+'-'+view+'.png',out))});
  }
  const saved=await page.evaluate(()=>JSON.stringify(window.environmentPreview.game.sim.save()));
  await page.evaluate(()=>window.environmentPreview.game.rebuild());await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>JSON.stringify(window.environmentPreview.game.sim.save())),saved);
 }
 await page.evaluate(async()=>{
  const runtime=(await import('/@react-refresh')).default;runtime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
  const {mountResidents}=await import('/tests/fixtures/resident-preview.js');window.unmountResidents=mountResidents(window.environmentPreview.game.sim);
 });
 await page.locator('.resident-choice').filter({hasText:'엘바르'}).first().click();
 assert.equal(await page.locator('.resident-actions button').count(),11);
 assert.match(await page.locator('.resident-illustration').getAttribute('src'),/elvar\/portrait-idle\.png$/);
 for(const title of ['작업','공격','피격','쓰러짐','회전'])await page.locator('.resident-actions button').getByText(title,{exact:true}).click();
 await page.screenshot({path:fileURLToPath(new URL('professions-resident.png',out))});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:fileURLToPath(new URL('professions-resident-mobile.png',out))});
 await page.evaluate(()=>window.unmountResidents());await page.setViewportSize({width:1440,height:1050});
 report.combat=await page.evaluate(async()=>{
  const game=window.environmentPreview.game,{assignResidentAppearance}=await import('/src/app/game/resident-roster.js');
  const {createPixelCharacter,animatePixelCharacter}=await import('/src/app/game/pixel-characters.js');
  const {SoftwareRenderer}=await import('/src/app/game/software-renderer.js');
  const guard=assignResidentAppearance({id:800,guard:true,race:'elf',hp:75,maxHp:75,dir:0,x:11,z:12,walking:false,attacking:true},game.sim.availableRaces);
  const model=createPixelCharacter(guard.id,guard.race,guard.appearance),states=[];
  const snapshot=time=>{animatePixelCharacter(model,guard,time,game.camera);states.push({action:model.userData.current,frame:model.userData.frame,rotation:model.userData.sprite.material.rotation,opacity:model.userData.sprite.material.opacity});};
  snapshot(0);guard.hp=50;snapshot(.1);snapshot(.35);guard.hp=0;snapshot(.4);snapshot(1.15);snapshot(1.8);
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle='#dce9df';ctx.fillRect(0,0,320,256);/* 187b773: the sprite anchor goes through renderer.project */SoftwareRenderer.prototype.drawPixelCharacter.call({ctx,pixelsPerWorldUnit:200,project:()=>({x:160,y:170})},model,{x:160,y:170});window.combatProof=canvas.toDataURL();
  return {identity:guard.appearance,states};
 });
 assert.equal(report.combat.identity,'aster');assert.deepEqual(report.combat.states.map(v=>v.action),['attack','hurt','attack','defeat','defeat','defeat']);
 assert.ok(report.combat.states.every(v=>v.rotation===0));assert.ok(report.combat.states.at(-1).opacity<1);
 await writeFile(new URL('combat-cpu.png',out),Buffer.from((await page.evaluate(()=>window.combatProof)).split(',')[1],'base64'));
 report.errors=errors;report.failed=failed;assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 await writeFile(new URL('specialists-browser.json',out),JSON.stringify(report,null,2)+'\n');
 console.log('51 identities, both factions, 4 real scene views, resident UI/mobile, combat and CPU PASS');
}finally{await browser.close();}
