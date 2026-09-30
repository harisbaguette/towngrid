// Browser check of the two facilities added in the second expansion pass (docs/EXPANSION_20260929.md 6):
// the shallow mine on flat land and the wind pump beside a crop field, built in the real game screen.
// Starts a campaign, picks each facility from the build dock, hovers the tile to read the placement preview, builds
// it with a click, runs the clock at 4x with the speed key, opens the facility cards, turns the camera with E through
// the four quarter views and shows the damaged and broken states. Rank, money, stock and land are set directly in
// the page so the late facilities can be placed, and health is set directly for the damage captures.
// Usage: node tests/expansion-new-browser.mjs <playwright/index.mjs> <chrome.exe>   (dev server: TOWNGRID_URL, default :5173)
// In `npm test` the paths come from TOWNGRID_PLAYWRIGHT and TOWNGRID_CHROME; without them or a running dev server the
// suite reports SKIP instead of failing, because the headless regressions run without a browser.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
const origin=process.env.TOWNGRID_URL||'http://localhost:5173',out=new URL('../docs/verification/expansion-3-20260930/',import.meta.url);
const playwright=process.argv[2]||process.env.TOWNGRID_PLAYWRIGHT,chrome=process.argv[3]||process.env.TOWNGRID_CHROME;
const serverUp=await fetch(origin,{signal:AbortSignal.timeout(3000)}).then(r=>r.ok,()=>false);
if(!playwright||!chrome||!serverUp){console.log('SKIP expansion-new-browser: '+(!playwright||!chrome?'no TOWNGRID_PLAYWRIGHT/TOWNGRID_CHROME':'dev server not running at '+origin));process.exit(0);}
const {chromium}=await import(pathToFileURL(playwright).href);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:chrome,args:['--enable-unsafe-swiftshader']});
const errors=[],failed=[],results=[];
const ctx=await browser.newContext({viewport:{width:1440,height:900}});
await ctx.addInitScript(()=>{window.WebSocket=class{constructor(){this.readyState=0;}addEventListener(){}removeEventListener(){}send(){}close(){}};});
const page=await ctx.newPage();
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,200));});
page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)failed.push(r.url());});
const shot=(name,options={})=>page.screenshot({path:fileURLToPath(new URL(name+'.png',out)),...options});
// The app loads scene.js with a version query in dev; hook every loaded copy (as tests/expansion-rules-browser.mjs does).
const hook=()=>page.evaluate(async()=>{const urls=[...new Set([...performance.getEntriesByType('resource').map(e=>e.name).filter(u=>/\/app\/game\/scene\.js(?:\?|$)/.test(u)),'/src/app/game/scene.js'])];for(const url of urls){try{const {GameScene}=await import(url);if(GameScene.prototype.__tgHooked)continue;const o=GameScene.prototype.setSimulation;GameScene.prototype.setSimulation=function(s){window.tgScene=this;return o.call(this,s);};GameScene.prototype.__tgHooked=true;}catch{}}});
const home=async name=>{await page.goto(origin);for(let i=0;i<60&&!(await page.getByRole('button',{name}).count());i++){await page.getByRole('button',{name:'화면을 눌러 시작',exact:true}).click().catch(()=>{});await page.waitForTimeout(300);}await page.getByRole('button',{name}).first().waitFor();};
const proj=(x,y,z)=>page.evaluate(([x,y,z])=>{const s=window.tgScene,v=s.camera.position.clone().set(x,y,z);v.project(s.camera);const r=s.renderer.domElement.getBoundingClientRect();return {px:r.left+(v.x+1)/2*r.width,py:r.top+(1-v.y)/2*r.height};},[x,y,z]);
const focus=async([x,z],zoom=null)=>{await page.evaluate(([x,z,zoom])=>{const s=window.tgScene;s.controls.target.set(x,0,z);s.setQuarterView(0);if(zoom){s.camera.zoom=zoom;s.camera.updateProjectionMatrix();}},[x,z,zoom]);await page.waitForTimeout(350);};
const sim=(fn,arg)=>page.evaluate(fn,arg);
const dismiss=async()=>{for(const close of await page.locator('[data-sonner-toast] button[aria-label]').all())await close.click().catch(()=>{});};

/** A saved campaign on `province` (the game's own save format), loaded through 이어하기, then opened up for late facilities. */
async function start(nation,province){
 await home('새 게임');
 await page.evaluate(async([nation,province])=>{const P=await import('/src/app/game/persistence.js'),{Campaign}=await import('/src/app/game/campaign.js');localStorage.setItem(P.SAVE_KEY,P.encodeSave(new Campaign({nation,provinceId:province}).save()));},[nation,province]);
 await home('이어하기');await hook();await page.getByRole('button',{name:/이어하기/}).first().click();
 await page.waitForFunction(()=>window.tgScene?.sim,null,{timeout:60000});
 const land=await sim(()=>{const s=window.tgScene.sim;s.rank=32;s.money=5e6;s.debt=0;s.nextEvent=1e9;for(const r of Object.keys(s.stock))s.stock[r]=200;for(const t of s.tiles)s.owned.add(t.x+','+t.z);if(!s.warehouse){s.build('warehouse',11,12,true);for(const [x,z] of [[11,14],[9,12],[13,12]])s.build('house',x,z,true);}s.revision++;return {province:s.layout.province,ecology:s.layout.ecology,edges:s.layout.edges};});
 // A fresh site waits paused for its first warehouse; the speed button starts the clock as a player would.
 await page.getByRole('button',{name:'1×',exact:true}).click();await page.waitForTimeout(500);await dismiss();
 assert.equal(land.province,province);assert.ok(await sim(()=>window.tgScene.sim.time>0),'the clock runs');return land;
}
/** Tiles for each case, found from the live simulation. */
const pick=what=>sim(what=>{const s=window.tgScene.sim,cheb=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.z-b.z)),near=(t,p)=>Math.min(99,...s.tiles.filter(p).map(u=>cheb(t,u)));
 const free=(x,z,type='house')=>s.canBuild(type,x,z,true)===null,far=t=>s.buildings.every(b=>cheb(b,t)>2),water=u=>u.terrain==='water',mountain=u=>u.ground==='mountain';
 const tiles=s.tiles.filter(t=>t.x>2&&t.z>2&&t.x<21&&t.z<21&&far(t));
 // Flat ground: no mountain within five tiles (no mountain shade or wind shelter) and no water within three.
 const flat=tiles.filter(t=>near(t,mountain)>5&&near(t,water)>3);
 // Prefer open ground so no tree stands in front of the building in any of the four views.
 const open=t=>near(t,u=>u.nature&&u.remaining>0)>2,prefer=list=>list.filter(open).length?list.filter(open):list;
 if(what==='mine')return prefer(flat.filter(t=>free(t.x,t.z,'shallowmine'))).map(t=>[t.x,t.z])[0];
 if(what==='wet')return tiles.filter(t=>!water(t)&&!mountain(t)&&near(t,water)===1&&near(t,mountain)>2&&free(t.x,t.z,'shallowmine')).map(t=>[t.x,t.z])[0];
 // A crop field with free tiles to its east for the pump.
 if(what==='farm')return prefer(flat.filter(t=>[0,1,2].every(dx=>free(t.x+dx,t.z)&&far(s.tile(t.x+dx,t.z))))).map(t=>[t.x,t.z]).at(-1);
},what);
async function tool(name){
 if(await page.getByRole('button',{name:'건설 목록 열기'}).count())await page.getByRole('button',{name:'건설 목록 열기'}).click();
 const item=page.getByRole('button',{name:name+' 건설',exact:true});
 for(const tab of await page.locator('.build-dock [role=tab]').all()){await tab.click();await page.waitForTimeout(120);if(await item.count())break;}
 await item.click();await page.waitForTimeout(250);
}
/** Hover the tile with the tool picked and return the preview text; the screenshot keeps the preview on screen. */
async function preview(name,[x,z],file){
 await tool(name);await focus([x,z]);const p=await proj(x,0,z);await page.mouse.move(p.px,p.py);await page.waitForTimeout(150);await page.mouse.move(p.px+1,p.py);await page.waitForTimeout(500);
 const text=(await page.locator('.placement-effects.compact').innerText().catch(()=>'')).replace(/\s+/g,' ');if(file)await shot(file);return {p,text};
}
async function place(name,at,file){
 const {p,text}=await preview(name,at,file);await page.mouse.click(p.px+1,p.py);await page.waitForTimeout(400);await page.keyboard.press('Escape');
 const type=await sim(([x,z])=>window.tgScene.sim.at(x,z)?.type,at);return {name,at,text,built:type};
}
async function card(at,file){
 await page.keyboard.press('Escape');await focus(at);const id=await sim(([x,z])=>window.tgScene.sim.at(x,z).id,at);
 const marker=page.locator('[data-building-id="'+id+'"]');if(await marker.count())await marker.first().click();else{const p=await proj(at[0],.45,at[1]);await page.mouse.click(p.px,p.py);}
 await page.locator('.facility-card').waitFor({timeout:5000});
 const fold=page.locator('.facility-card details.facility-details:not([open]) summary');if(await fold.count())await fold.click();await page.waitForTimeout(300);
 const text=(await page.locator('.facility-card').innerText()).replace(/\s+/g,' ');await shot(file);
 await page.getByRole('button',{name:'시설 정보 닫기'}).click().catch(()=>{});return text;
}
/** What the renderer holds for the building at `at`: its view row, damage and part layers. */
const model=at=>sim(([x,z])=>{const g=window.tgScene,b=g.sim.at(x,z);let m=null;g.models.get(b.id)?.traverse(o=>{if(!m&&o.userData?.buildingType===b.type&&o.userData.layers)m=o;});
 return m&&{type:b.type,direction:m.userData.direction,image:!!m.userData.image,body:m.userData.sprite.visible,damage:m.userData.damageAmount??0,kind:m.userData.damageProfile?.kind??null,
  layers:m.userData.layers.filter(l=>l.visible).map(l=>l.name)};},at);

try{
 const site=await start('elune','elune-2');results.push({site});
 // 1. Shallow mine on flat ground far from any mountain.
 const mineAt=await pick('mine');assert.ok(mineAt,'a flat tile with no mountain nearby');
 const wet=await pick('wet');assert.ok(wet,'a tile beside fresh water');
 const flood=await preview('얕은 광산',wet,'01-shallowmine-waterside-preview');await page.keyboard.press('Escape');
 assert.match(flood.text,/침수 -30%/);assert.match(flood.text,/생산 효율 70%/);results.push({name:'얕은 광산(물가 미리보기)',at:wet,text:flood.text});
 const mine=await place('얕은 광산',mineAt,'02-shallowmine-flat-preview');assert.equal(mine.built,'shallowmine');
 assert.match(mine.text,/생산 효율 100%/);assert.doesNotMatch(mine.text,/침수|그늘/);
 // 2. Wind pump beside a sugar cane field (water need 8): the field needs carried water until the pump runs.
 const farmAt=await pick('farm');assert.ok(farmAt,'flat room for a field and a pump');const [fx,fz]=farmAt,pumpAt=[fx+1,fz];
 const field=await place('사탕수수밭',farmAt,'03-field-before-pump-preview');assert.equal(field.built,'sugarfield');assert.match(field.text,/물 0\/8 · 운반 필요/);
 const pump=await place('풍력 양수기',pumpAt,'04-windpump-preview');assert.equal(pump.built,'windpump');assert.match(pump.text,/생산 효율 100%/);
 // Run the clock at 4x (key 3) until the mine has finished a cycle and the pump has lifted water.
 await page.keyboard.press('3');
 await page.waitForFunction(([m,p])=>{const s=window.tgScene.sim,a=s.at(...m),b=s.at(...p);return a.cycles>0&&b.activeUntil>s.time;},[mineAt,pumpAt],{timeout:60000,polling:500});
 await page.keyboard.press('1');await page.waitForTimeout(600);await dismiss();
 const state=await sim(([m,p,f])=>{const s=window.tgScene.sim,a=s.at(...m),b=s.at(...p),c=s.at(...f);
  return {mine:{status:a.status,cycles:a.cycles,iron:s.produced.iron||0},pump:{status:b.status,left:Math.round(b.activeUntil-s.time)},field:{water:s.placementEffects('sugarfield',...f).water,status:c.status}};},[mineAt,pumpAt,farmAt]);
 assert.ok(state.mine.cycles>0&&state.mine.iron>0,'the mine has dug iron ore');assert.equal(state.pump.status,'관개 공급 중');assert.equal(state.field.water,1,'the pump waters the field');
 results.push(mine,field,pump,{state});
 mine.card=await card(mineAt,'05-shallowmine-card');assert.match(mine.card,/얕은 광산/);assert.match(mine.card,/철광석/);
 pump.card=await card(pumpAt,'06-windpump-card');assert.match(pump.card,/풍력 양수기/);assert.match(pump.card,/관개 공급 중/);
 field.card=await card(farmAt,'07-field-watered-card');assert.match(field.card,/운반 생략/);
 // 3. Four quarter views: the E key turns the camera 90 degrees; both buildings follow with their own view row.
 const mid=[(mineAt[0]+pumpAt[0])/2,(mineAt[1]+pumpAt[1])/2],span=Math.max(Math.abs(mineAt[0]-pumpAt[0]),Math.abs(mineAt[1]-pumpAt[1]));
 await page.keyboard.press('Escape');const views=[];
 for(const [label,at] of [['shallowmine',mineAt],['windpump',pumpAt]]){
  await focus(at,2.6);
  for(let view=0;view<4;view++){
   if(view)await page.keyboard.press('e');await page.waitForTimeout(450);
   const v=await sim(()=>window.tgScene.viewIndex);const m=await model(at);assert.equal(m.direction,v,label+' follows the camera');assert.ok(m.image&&m.body,label+' drawn');
   views.push({label,view:v,layers:m.layers});
   const c=await proj(at[0],.35,at[1]);await shot(`08-${label}-view-${['se','ne','nw','sw'][view]}`,{clip:{x:c.px-170,y:c.py-190,width:340,height:300}});
  }
 }
 assert.deepEqual([...new Set(views.map(v=>v.view))].sort(),[0,1,2,3]);results.push({views,span});
 // 4. Damage: half health cracks the body in place; zero health collapses the upper sections over the fixed base.
 const damage=[];
 for(const health of [40,0]){
  await sim(([m,p,h])=>{const s=window.tgScene.sim;for(const at of [m,p])s.at(...at).health=h;/* health set directly */s.revision++;},[mineAt,pumpAt,health]);
  for(const [label,at] of [['shallowmine',mineAt],['windpump',pumpAt]]){
   await focus(at,2.6);await page.waitForTimeout(700);const m=await model(at);damage.push({label,health,...m});
   assert.ok(m.layers.includes('damage-cracks'),label+' cracks at '+health);if(!health)assert.ok(m.layers.includes('damage-rubble')&&m.damage>.9,label+' collapses');
   // The lattice pump tower breaks like the other towers (upper sections fold lower); the mine frame like a structure.
   assert.equal(m.kind,label==='windpump'?'tower':'structure',label+' damage profile');
   const c=await proj(at[0],.35,at[1]);await shot(`09-${label}-health-${health}`,{clip:{x:c.px-170,y:c.py-190,width:340,height:300}});
  }
 }
 // Repair through the facility card as a player would; the silhouette comes back.
 const repaired=[];
 for(const at of [mineAt,pumpAt]){
  await page.keyboard.press('Escape');await focus(at);const id=await sim(([x,z])=>window.tgScene.sim.at(x,z).id,at);
  const marker=page.locator('[data-building-id="'+id+'"]');if(await marker.count())await marker.first().click();else{const p=await proj(at[0],.45,at[1]);await page.mouse.click(p.px,p.py);}
  await page.locator('.facility-card').waitFor({timeout:5000});await page.locator('.facility-card button',{hasText:/수리/}).first().click();await page.waitForTimeout(1600);
  repaired.push(await sim(([x,z])=>window.tgScene.sim.at(x,z).health,at));await page.getByRole('button',{name:'시설 정보 닫기'}).click().catch(()=>{});
 }
 assert.deepEqual(repaired,[100,100],'both repaired from the card');
 await focus(pumpAt,2.6);await page.waitForTimeout(500);{const c=await proj(pumpAt[0],.35,pumpAt[1]);await shot('10-windpump-repaired',{clip:{x:c.px-170,y:c.py-190,width:340,height:300}});}
 results.push({damage,repaired});
 // 5. The same two bodies side by side in the art check page, WebGL and CPU renderer, four views: the pump's water tub
 // and wind wheel are compared against the earlier captures in docs/verification/expansion-art-20260930/.
 for(const renderer of ['webgl','canvas']){
  await page.setViewportSize({width:1100,height:1000});
  await page.goto(origin+'/production-preview.html?group=farmsupport'+(renderer==='canvas'?'&renderer=canvas':''));
  await page.waitForFunction(()=>window.productionPreview);await page.locator('#pause').click();await page.locator('[data-state="working-ready"]').click();
  for(let view=0;view<4;view++){
   await page.locator('#view').selectOption(String(view));await page.evaluate(()=>window.productionPreview.setTime(7.4));await page.waitForTimeout(250);
   const rows=await page.evaluate(()=>window.productionPreview.items.map(i=>({type:i.type,direction:i.model.userData.direction,parts:i.model.userData.layers.filter(l=>l.visible&&/^(rotor|pulley)/.test(l.name)).map(l=>l.name)})));
   assert.deepEqual(rows.map(r=>[r.type,r.direction,r.parts.length]),[['shallowmine',view,1],['windpump',view,1]],renderer+' view '+view);
   await shot(`11-art-${renderer}-${['se','ne','nw','sw'][view]}`,{clip:renderer==='webgl'?{x:20,y:328,width:860,height:248}:{x:20,y:328,width:1060,height:400}});
  }
 }
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
}finally{
 await writeFile(new URL('results.json',out),JSON.stringify({date:'2026-09-30',origin,errors,failed,results},null,1)+'\n');await browser.close();
}
console.log('PASS new facilities in the game screen: 얕은 광산 (flat, waterside preview), 풍력 양수기 (beside 사탕수수밭), four views, damage and repair; console errors 0');
