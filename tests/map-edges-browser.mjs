import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const wrangler=createRequire(import.meta.resolve('wrangler')),sharp=createRequire(wrangler.resolve('miniflare'))('sharp');
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],failed=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().includes('/assets/pixel-environment/'))failed.push(r.url());});
const origin=process.env.TOWNGRID_URL||'http://localhost:5173',out=new URL('../docs/verification/map-edges/',import.meta.url);await mkdir(out,{recursive:true});
const shot=id=>page.screenshot({path:fileURLToPath(new URL(id+'.png',out))});
try{
 for(const renderer of ['webgl','canvas']){
  await page.goto(origin+'/map-edges-preview.html'+(renderer==='canvas'?'?renderer=canvas':''));await page.waitForFunction(()=>window.edgePreview,{},{timeout:90000});
  for(const preset of ['mixed','turned','estern-0','rivente-0','kardum-4','nubrik-0']){
   await page.locator('#preset').selectOption(preset);
   for(let view=0;view<4;view++){
    const data=await page.evaluate(view=>{const g=window.edgePreview.game;g.setQuarterView(view);g.scene.updateMatrixWorld(true);g.camera.updateMatrixWorld();g.renderer.render(g.scene,g.camera);const props=g.scenery.group.children.filter(m=>m.userData.mapSide);return {view:g.viewIndex,renderer:g.renderer.isSoftware?'canvas':'webgl',props:props.every(m=>!!m.userData.image&&m.userData.direction===view),water:g.terrain.children.filter(m=>m.userData.layer===1).every(m=>!!m.userData.image),types:[...g.models.values()].every(m=>!!m.userData.image)};},view);
    assert.equal(data.renderer,renderer);assert.equal(data.view,view);assert.ok(data.props&&data.water&&data.types);
    if(preset==='mixed'||view===0)await shot(preset+'-'+view+'-'+renderer);
   }
  }
  await page.locator('#preset').selectOption('mixed');
  await page.locator('[data-side="n"]').click();assert.match(await page.locator('#status').textContent(),/광물|채석/);
  assert.equal(await page.evaluate(()=>window.edgePreview.game.overlay),'ore');
  await page.locator('#center').click();
  const produced=await page.evaluate(()=>{const s=window.edgePreview.game.sim;s.paused=false;for(let i=0;i<720;i++)s.tick(.25);s.paused=true;return s.produced;});
  for(const id of ['iron','copper','stone','wood','fish','grain'])assert.ok(produced[id]>0,renderer+' real production '+id+JSON.stringify(produced));
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(350);await shot('mobile-'+renderer);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewportSize({width:1440,height:1000});
 }
 // Normal game UI, including opening the four sides and focusing one without moving the world.
 await page.goto(origin);await page.locator('canvas[role="application"]').waitFor({state:'attached',timeout:120000});
 await page.getByRole('button',{name:'화면을 눌러 시작',exact:true}).click();
 await page.evaluate(async()=>{const urls=performance.getEntriesByType('resource').map(e=>e.name).filter(url=>/\/app\/game\/scene\.js(?:\?|$)/.test(url));for(const url of new Set([...urls,'/src/app/game/scene.js'])){const {GameScene}=await import(url),original=GameScene.prototype.setSimulation;GameScene.prototype.setSimulation=function(sim){window.edgeGame=this;return original.call(this,sim);};}});
 await page.getByRole('button',{name:'초반 마을 테스트',exact:true}).click();
 await page.getByRole('button',{name:'일시정지',exact:true}).waitFor({timeout:120000});await page.getByRole('button',{name:'일시정지',exact:true}).click();
 await page.getByRole('button',{name:'주변 지형',exact:true}).click();assert.equal(await page.locator('.map-edges [data-side]').count(),4);await shot('game-edge-menu');
 const before=await page.evaluate(()=>JSON.stringify(window.edgeGame.sim.save()));
 await page.locator('.map-edges [data-side="e"]').click();await page.getByRole('button',{name:'주변 지형',exact:true}).click();await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);await shot('game-mobile-menu');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.equal(await page.evaluate(()=>JSON.stringify(window.edgeGame.sim.save())),before,'Focusing sides and resizing do not alter the save');
 const legend=await page.locator('.soil-legend').boundingBox();assert.ok(legend.height<60,'The soil legend must not stretch from top to bottom');
 const pixels=await sharp(await page.locator('canvas[role="application"]').screenshot()).removeAlpha().raw().toBuffer();const colors=new Set();for(let i=0;i<pixels.length;i+=57)colors.add(pixels.subarray(i,i+3).toString('hex'));assert.ok(colors.size>100,'Paused map remains drawn after resize');
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);await writeFile(new URL('browser-results.json',out),JSON.stringify({passed:true,checks:['six maps','four views','WebGL/CPU','mountain/forest/water production','side focus','actual game UI','mobile'],errors,failed},null,2));
 console.log('Map sides, scenery, actual production, normal game controls, WebGL/CPU and mobile PASS.');
}catch(e){await shot('failure');throw e;}finally{await browser.close();}
