import assert from 'node:assert/strict';
import {browser,open,toHome,shot,waitSim,R,save,tilePoint} from './audit-2/_browser.mjs';
import {WORLD_PLOTS} from '../src/app/game/territory.js';
import {PROGRESSION_OFFSET} from '../src/app/game/world.js';

const page=await open({width:1440,height:960},{reducedMotion:'reduce'});
try{
 await toHome(page,{previewMenu:false});
 await page.getByRole('button',{name:'새 게임',exact:true}).click();
 await page.locator('.start-world').waitFor();
 await waitSim(page,()=>window.tgScene?.renderer.domElement.dataset.worldReady==='true');
 await page.waitForTimeout(1200);await shot(page,'01-country.png');
 console.log('country',await page.evaluate(()=>({span:window.tgScene.worldSpan(),chunks:window.tgScene.landscape.chunks.size,picking:window.tgScene.worldPicking,errors:window.tgScene.renderer.info?.programs.map(p=>p.diagnostics).filter(Boolean)})));
 await page.getByRole('button',{name:'지역 살펴보기'}).click();
 await page.waitForTimeout(1200);await shot(page,'02-region.png');
 await page.getByRole('button',{name:'땅 미리보기'}).click();
 await page.waitForTimeout(1200);await shot(page,'03-plot.png');
 const before=await page.evaluate(()=>{window.worldCanvas=window.tgScene.renderer.domElement;return {position:window.tgScene.controls.target.toArray(),zoom:window.tgScene.camera.zoom,tiles:JSON.stringify(window.tgScene.sim.tiles)};});
 await page.getByRole('button',{name:'이 땅에서 시작'}).click();
 await page.locator('.game-shell.is-playing').waitFor();await page.waitForTimeout(1800);
 const after=await page.evaluate(()=>({sameCanvas:window.worldCanvas===window.tgScene.renderer.domElement,position:window.tgScene.controls.target.toArray(),zoom:window.tgScene.camera.zoom,tiles:JSON.stringify(window.tgScene.sim.tiles),canvases:document.querySelectorAll('.world-canvas canvas').length}));
 assert.equal(after.sameCanvas,true);assert.deepEqual(after.position,before.position);assert.equal(after.zoom,before.zoom);assert.equal(after.tiles,before.tiles);assert.equal(after.canvases,1);
 await shot(page,'04-playing.png');
 await page.getByRole('button',{name:'대륙 전체 보기'}).click();await page.waitForTimeout(1200);await shot(page,'05-world.png');
 assert.ok(await page.evaluate(()=>window.tgScene.worldSpan()>1000));
 await page.getByRole('button',{name:'내 땅으로',exact:true}).click();await page.waitForTimeout(1200);
 await page.evaluate(()=>{const s=window.tgScene;s.sim.paused=true;s.flyToWorld(...[s.sim.layout.cell[0]*24+60,s.sim.layout.cell[1]*24+12],70,{animate:false});});
 await page.waitForTimeout(1800);await shot(page,'06-neighbor.png');
 assert.ok(await page.evaluate(()=>window.tgScene.landscape.chunks.size<=25));
 // Picking in all four views uses the very same world coordinates as rendering.
 const neighbor=WORLD_PLOTS.find(p=>p.nation==='estern'&&p.id!=='estern-3'&&Math.hypot(p.cell[0]-14,p.cell[1]-16)<3);
 for(let q=0;q<4;q++){
  const point=await page.evaluate(({q,p})=>{const s=window.tgScene;s.setQuarterView(q);s.flyToWorld(p.cell[0]*24+11.5,p.cell[1]*24+11.5,120,{animate:false});s.camera.updateMatrixWorld();return s.worldScreenPoint(p.cell[0]*24+11.5,p.cell[1]*24+11.5);},{q,p:neighbor});
  await page.mouse.click(point.x+8,point.y+8);await page.locator('.world-plot-panel').waitFor();
  assert.equal(await page.locator('.world-plot-panel').getAttribute('data-province'),neighbor.id);
  await page.waitForTimeout(350);await shot(page,'07-rotation-'+q+'.png');await page.getByRole('button',{name:'부지 정보 닫기'}).click();
 }
 // World browsing is read-only, including streamed chunks and many camera jumps.
 const savedBefore=await page.evaluate(()=>{const {offline,...state}=window.tgScene.sim.campaign.save();return JSON.stringify(state);});
 const cache=[];
 for(const p of WORLD_PLOTS.filter((_,i)=>i%70===0)){
  await page.evaluate(p=>window.tgScene.flyToWorld(p.cell[0]*24+12,p.cell[1]*24+12,80,{animate:false}),p);await page.waitForTimeout(130);
  cache.push(await page.evaluate(()=>({chunks:window.tgScene.landscape.chunks.size,props:window.tgScene.landscape.props.size,textures:window.tgScene.renderer.info?.memory.textures,patterns:window.tgScene.renderer.surfacePatterns?.size})));
 }
 assert.ok(cache.every(s=>s.chunks<=25&&s.props<=25));assert.equal(await page.evaluate(()=>{const {offline,...state}=window.tgScene.sim.campaign.save();return JSON.stringify(state);}),savedBefore);
 // An actual building remains clickable after returning from the whole world.
 await page.getByRole('button',{name:'내 땅으로',exact:true}).click();await page.waitForTimeout(800);
 await page.getByRole('button',{name:'건설 목록 열기',exact:true}).click();
 const well=page.locator('.build-item').filter({hasText:'우물'}).first();await well.click();
 const tile=await page.evaluate(()=>{const s=window.tgScene.sim;return s.tiles.find(t=>!s.canBuild('well',t.x,t.z));});assert.ok(tile);
 const point=await tilePoint(page,tile.x,tile.z);await page.mouse.click(point.px,point.py);
 await waitSim(page,()=>window.tgScene.sim.buildings.some(b=>b.type==='well'));
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'대륙 전체 보기'}).click();await page.waitForTimeout(300);await page.getByRole('button',{name:'내 땅으로',exact:true}).click();await page.waitForTimeout(600);
 const again=await tilePoint(page,tile.x,tile.z);await page.mouse.click(again.px,again.py);await page.locator('.minimal-facility').waitFor();await shot(page,'08-building.png');await page.keyboard.press('Escape');
 // Acquire and operate another plot without creating a second canvas or loading screen.
 const target=await page.evaluate(({plots,rank})=>{const c=window.tgScene.sim.campaign;c.active.rank=rank;c.active.money=100000;Object.assign(c.active.stock,{wood:100,stone:100,water:100});return plots.find(p=>c.siteOffer('estern',p.id).ok);},{plots:WORLD_PLOTS,rank:PROGRESSION_OFFSET+8});assert.ok(target);
 const targetPoint=await page.evaluate(p=>{const s=window.tgScene;s.flyToWorld(p.cell[0]*24+12,p.cell[1]*24+12,120,{animate:false});s.camera.updateMatrixWorld();return s.worldScreenPoint(p.cell[0]*24+12,p.cell[1]*24+12);},target);
 await page.mouse.click(targetPoint.x,targetPoint.y);await page.getByRole('button',{name:/거점 세우기/}).click();await page.getByRole('button',{name:'이 거점 운영'}).click();
 await waitSim(page,id=>window.tgScene.sim.provinceId===id,target.id);assert.equal(await page.evaluate(()=>window.worldCanvas===window.tgScene.renderer.domElement),true);await page.waitForTimeout(900);await shot(page,'09-second-site.png');
 await page.getByRole('button',{name:'거점·외교',exact:true}).click();await page.getByRole('button',{name:'월드에서 이 땅 보기',exact:true}).click();await page.locator('.world-plot-panel').waitFor();await page.getByRole('button',{name:'부지 정보 닫기'}).click();
 // Touch-sized controls and the entire start flow on a narrow screen.
 const mobile=await open({width:390,height:844},{isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 await toHome(mobile,{previewMenu:false});await mobile.getByRole('button',{name:'새 게임',exact:true}).click();await mobile.locator('.start-world').waitFor();
 await mobile.getByRole('button',{name:'지역 살펴보기'}).click();await mobile.getByRole('button',{name:'땅 미리보기'}).click();await mobile.waitForTimeout(1200);await shot(mobile,'10-mobile-start.png');
 await mobile.getByRole('button',{name:'이 땅에서 시작'}).click();await mobile.locator('.minimal-hud').waitFor();await mobile.waitForTimeout(800);
 assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const mobileSpan=await mobile.evaluate(()=>window.tgScene.worldSpan());await mobile.getByRole('button',{name:'월드 축소',exact:true}).tap();assert.ok(await mobile.evaluate(()=>window.tgScene.worldSpan())>mobileSpan);
 await shot(mobile,'11-mobile-playing.png');
 // Real pinch input, followed by a pan, keeps terrain streaming around the camera.
 const cdp=await mobile.context().newCDPSession(mobile),touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y,id])=>({x,y,id,radiusX:2,radiusY:2,force:1}))});
 const zoomBefore=await mobile.evaluate(()=>window.tgScene.camera.zoom);await touch('touchStart',[[140,500,0],[240,570,1]]);await mobile.waitForTimeout(70);await touch('touchMove',[[110,470,0],[270,600,1]]);await mobile.waitForTimeout(70);await touch('touchMove',[[90,450,0],[290,620,1]]);await touch('touchEnd',[]);await mobile.waitForTimeout(300);
 const zoomAfter=await mobile.evaluate(()=>window.tgScene.camera.zoom);console.log('pinch',{zoomBefore,zoomAfter});assert.ok(zoomAfter>zoomBefore);
 await mobile.getByRole('button',{name:'대륙 전체 보기'}).tap();await mobile.waitForTimeout(500);await shot(mobile,'12-mobile-world.png');
 // Canvas fallback uses the same terrain/chunks and supports the same camera.
 const cpu=await open({width:1024,height:768},{reducedMotion:'reduce'});
 await cpu.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'||type==='webgl'?null:get.call(this,type,...args);};});
 await toHome(cpu,{previewMenu:false});await cpu.getByRole('button',{name:'새 게임',exact:true}).click();await cpu.getByRole('button',{name:'지역 살펴보기'}).click();await cpu.getByRole('button',{name:'땅 미리보기'}).click();await cpu.waitForTimeout(1800);
 assert.equal(await cpu.evaluate(()=>window.tgScene.renderer.isSoftware),true);await shot(cpu,'13-canvas.png');
 assert.ok(await cpu.evaluate(()=>window.tgScene.renderer.surfacePatterns.size<100));
 const metrics=await page.evaluate(()=>({fps:window.tgScene.renderer.domElement.dataset.fps,drawCalls:window.tgScene.renderer.info?.render.calls,chunks:window.tgScene.landscape.chunks.size}));
 await save('results.json',{passed:R.errors.length===0&&R.consoleErrors.length===0,checks:['one canvas and same camera from start to play','identical start tiles','continuous world zoom','four-view coordinate picking','read-only exploration','bounded streaming cache','build and select after zoom','new-site acquisition and operation','management focuses same world','mobile and pinch input','Canvas renderer'],before:{...before,tiles:undefined},after:{...after,tiles:undefined},cache,metrics,...R});
 assert.deepEqual(R.errors,[]);assert.deepEqual(R.consoleErrors,[]);console.log('SEAMLESS_WORLD_OK');
}catch(error){console.log('BROWSER_ERRORS',JSON.stringify(R));await shot(page,'failure.png').catch(()=>{});throw error;}
finally{await browser.close();}
