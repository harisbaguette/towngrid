// Browser check of the 2026-09-29 terrain rules in the real game screen (docs/BALANCE_PATCH_20260928.md 14).
// Starts a campaign on a mountain-and-river site and on a coast site, picks each facility from the build dock, hovers the
// tile to read the placement preview, builds it with a click and opens its facility card. Rank, money, stock and land are
// set directly in the page so the late facilities can be placed; everything else goes through the game's own UI.
// Usage: node tests/expansion-rules-browser.mjs <playwright/index.mjs> <chrome.exe>   (dev server: TOWNGRID_URL, default :5173)
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const origin=process.env.TOWNGRID_URL||'http://localhost:5173',out=new URL('../docs/verification/expansion-rules-20260929/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const errors=[],results=[];
const ctx=await browser.newContext({viewport:{width:1440,height:900}});
await ctx.addInitScript(()=>{window.WebSocket=class{constructor(){this.readyState=0;}addEventListener(){}removeEventListener(){}send(){}close(){}};});
const page=await ctx.newPage();
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,200));});
const shot=name=>page.screenshot({path:fileURLToPath(new URL(name+'.png',out))});
// The app loads scene.js with a version query in dev; hook every loaded copy (as tests/audit-2/_browser.mjs does).
const hook=()=>page.evaluate(async()=>{const urls=[...new Set([...performance.getEntriesByType('resource').map(e=>e.name).filter(u=>/\/app\/game\/scene\.js(?:\?|$)/.test(u)),'/src/app/game/scene.js'])];for(const url of urls){try{const {GameScene}=await import(url);if(GameScene.prototype.__tgHooked)continue;const o=GameScene.prototype.setSimulation;GameScene.prototype.setSimulation=function(s){window.tgScene=this;return o.call(this,s);};GameScene.prototype.__tgHooked=true;}catch{}}});
const home=async name=>{await page.goto(origin);for(let i=0;i<60&&!(await page.getByRole('button',{name}).count());i++){await page.getByRole('button',{name:'화면을 눌러 시작',exact:true}).click().catch(()=>{});await page.waitForTimeout(300);}await page.getByRole('button',{name}).first().waitFor();};
const proj=(x,y,z)=>page.evaluate(([x,y,z])=>{const s=window.tgScene,v=s.camera.position.clone().set(x,y,z);v.project(s.camera);const r=s.renderer.domElement.getBoundingClientRect();return {px:r.left+(v.x+1)/2*r.width,py:r.top+(1-v.y)/2*r.height};},[x,y,z]);
const focus=async([x,z])=>{await page.evaluate(([x,z])=>{const s=window.tgScene;s.controls.target.set(x,0,z);s.setQuarterView(0);},[x,z]);await page.waitForTimeout(350);};

/** A saved campaign on `province` (the game's own save format), loaded through 이어하기, then opened up for late facilities. */
async function start(nation,province){
 await home('새 게임');
 await page.evaluate(async([nation,province])=>{const P=await import('/src/app/game/persistence.js'),{Campaign}=await import('/src/app/game/campaign.js');localStorage.setItem(P.SAVE_KEY,P.encodeSave(new Campaign({nation,provinceId:province}).save()));},[nation,province]);
 await home('이어하기');await hook();await page.getByRole('button',{name:/이어하기/}).first().click();
 await page.waitForFunction(()=>window.tgScene?.sim,null,{timeout:60000});
 const land=await page.evaluate(()=>{const s=window.tgScene.sim;s.rank=32;s.money=5e6;s.debt=0;s.nextEvent=1e9;for(const r of Object.keys(s.stock))s.stock[r]=200;for(const t of s.tiles)s.owned.add(t.x+','+t.z);if(!s.warehouse){s.build('warehouse',11,12,true);for(const [x,z] of [[11,14],[9,12],[13,12]])s.build('house',x,z,true);}s.revision++;return {province:s.layout.province,ecology:s.layout.ecology,edges:s.layout.edges};});
 // A fresh site waits paused for its first warehouse; the speed button starts the clock as a player would.
 await page.getByRole('button',{name:'1×',exact:true}).click();await page.waitForTimeout(500);
 for(const close of await page.locator('[data-sonner-toast] button[aria-label]').all())await close.click().catch(()=>{});
 assert.equal(land.province,province);assert.ok(await page.evaluate(()=>window.tgScene.sim.time>0),'the clock runs');return land;
}
/** Tiles for each case, found from the live simulation. */
const pick=(what)=>page.evaluate(what=>{const s=window.tgScene.sim,cheb=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.z-b.z)),near=(t,p)=>Math.min(99,...s.tiles.filter(p).map(u=>cheb(t,u)));
 const free=(x,z,type='house')=>s.canBuild(type,x,z,true)===null,far=t=>s.buildings.every(b=>cheb(b,t)>2),water=u=>u.terrain==='water',mountain=u=>u.ground==='mountain',sea=u=>u.water==='coast';
 const tiles=s.tiles.filter(t=>t.x>1&&t.z>1&&t.x<22&&t.z<22&&far(t));
 if(what==='solar')return tiles.filter(t=>!mountain(t)&&near(t,mountain)===1&&near(t,water)>1&&free(t.x,t.z,'solarpanel')).map(t=>[t.x,t.z])[0];
 if(what==='salt')return tiles.filter(t=>near(t,sea)===1&&free(t.x,t.z,'saltfield')).map(t=>[t.x,t.z])[0];
 const quiet=tiles.filter(t=>near(t,water)>3&&near(t,mountain)>5);
 if(what==='vine')return quiet.filter(t=>[[0,0],[1,0],[-1,0],[2,0]].every(([dx,dz])=>free(t.x+dx,t.z+dz)&&far(s.tile(t.x+dx,t.z+dz)))).map(t=>[t.x,t.z])[0];
 if(what==='bees')return quiet.filter(t=>[[0,0],[2,0]].every(([dx,dz])=>free(t.x+dx,t.z+dz))&&far(t)).map(t=>[t.x,t.z]).at(-1);
 if(what==='wheat')return tiles.filter(t=>near(t,mountain)>5&&[[0,0],[1,0],[1,1],[0,1],[-1,0]].every(([dx,dz])=>free(t.x+dx,t.z+dz))).map(t=>[t.x,t.z])[Math.floor(tiles.length/3)%5];
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
 const type=await page.evaluate(([x,z])=>window.tgScene.sim.at(x,z)?.type,at);return {name,at,text,built:type};
}
async function card(at,file){
 await page.keyboard.press('Escape');await focus(at);const id=await page.evaluate(([x,z])=>window.tgScene.sim.at(x,z).id,at);
 const marker=page.locator('[data-building-id="'+id+'"]');if(await marker.count())await marker.first().click();else{const p=await proj(at[0],.45,at[1]);await page.mouse.click(p.px,p.py);}
 await page.locator('.facility-card').waitFor({timeout:5000});
 // The rule notes sit in the card's folded efficiency section; a player opens it the same way.
 const fold=page.locator('.facility-card details.facility-details:not([open]) summary');if(await fold.count())await fold.click();await page.waitForTimeout(300);const text=(await page.locator('.facility-card').innerText()).replace(/\s+/g,' ');await shot(file);
 await page.getByRole('button',{name:'시설 정보 닫기'}).click().catch(()=>{});return text;
}

try{
 // A. Mountain and river site: solar at the foot of the mountain, ponds and a vineyard, bees and clover, a wheat cluster.
 const A=await start('elune','elune-2');results.push({site:A});
 const solar=await pick('solar');assert.ok(solar,'a tile at the foot of the mountain');
 const r1=await place('태양광 패널',solar,'01-solar-mountain-preview');assert.equal(r1.built,'solarpanel');assert.match(r1.text,/산 그늘 3/);assert.match(r1.text,/생산 효율 40%/);
 r1.card=await card(solar,'02-solar-mountain-card');assert.match(r1.card,/산 그늘 3\/3/);results.push(r1);
 const vine=await pick('vine');assert.ok(vine);const [vx,vz]=vine;
 const r2=await place('연못',[vx+1,vz]);assert.equal(r2.built,'pond');
 const r3=await preview('포도밭',vine,'03-vineyard-one-pond-preview');assert.match(r3.text,/물 2\/5 · 운반 필요/);
 await page.keyboard.press('Escape');const r4=await place('연못',[vx-1,vz]);
 const r5=await place('포도밭',vine,'04-vineyard-two-ponds-preview');assert.equal(r5.built,'vineyard');assert.match(r5.text,/물 4\/5 · 운반 필요/);
 const r6=await place('연못',[vx+2,vz],'05-pond-preview');assert.equal(r6.built,'pond');assert.match(r6.text,/물 받는 시설 1곳/);
 r6.card=await card(vine,'06-vineyard-card');assert.match(r6.card,/물 5\/5 · 운반 생략/);results.push(r2,r3,r4,r5,r6);
 const bees=await pick('bees');assert.ok(bees);const r7=await place('양봉장',bees,'07-apiary-no-clover-preview');assert.match(r7.text,/야생 클로버 없음 · 가동 불가/);
 await page.waitForTimeout(2500);r7.card=await card(bees,'08-apiary-blocked-card');assert.match(r7.card,/야생 클로버 필요/);
 r7.operations=(await page.locator('.operations-card').innerText().catch(()=>'')).replace(/\s+/g,' ');
 const r8=await place('야생 클로버',[bees[0]+2,bees[1]],'09-clover-preview');assert.equal(r8.built,'clover');assert.match(r8.text,/꿀벌 양봉장 1곳/);
 await page.waitForTimeout(2500);r8.card=await card(bees,'10-apiary-running-card');assert.match(r8.card,/야생 클로버 1/);assert.doesNotMatch(r8.card,/야생 클로버 필요/);results.push(r7,r8);
 const wheat=await pick('wheat');assert.ok(wheat);const [wx,wz]=wheat;for(const d of [[1,0],[1,1],[0,1]])await page.evaluate(([x,z])=>window.tgScene.sim.build('field',x,z),[wx+d[0],wz+d[1]]);
 const r9=await place('밀밭',wheat,'11-wheat-cluster-preview');assert.match(r9.text,/같은 시설 3 · 시간 -30%/);results.push(r9);
 // B. Coast site: a salt pan on the shore.
 const B=await start('harren','harren-2');results.push({site:B});
 const salt=await pick('salt');assert.ok(salt,'a tile by the sea');const r10=await place('소금밭',salt,'12-saltfield-coast-preview');assert.equal(r10.built,'saltfield');assert.match(r10.text,/소금기 2/);assert.match(r10.text,/운반 생략/);
 r10.card=await card(salt,'13-saltfield-card');assert.match(r10.card,/소금기 2/);results.push(r10);
 assert.deepEqual(errors,[]);
}finally{
 await writeFile(new URL('results.json',out),JSON.stringify({date:'2026-09-29',origin,errors,results},null,1)+'\n');await browser.close();
}
console.log('PASS expansion rules in the game screen: '+results.filter(r=>r.name).map(r=>r.name+(r.built?'':' (preview)')).join(', '));
