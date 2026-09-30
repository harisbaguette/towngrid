import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const wrangler=createRequire(import.meta.resolve('wrangler')),sharp=createRequire(wrangler.resolve('miniflare'))('sharp');
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({headless:true,executablePath:process.argv[3],args:['--enable-unsafe-swiftshader']});
const previewOnly=process.argv.includes('--preview-only'),gameOnly=process.argv.includes('--game-only');
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],failed=[],production={};
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().includes('/assets/'))failed.push(r.url());});
const origin=process.env.TOWNGRID_URL||'http://localhost:5173',out=new URL('../docs/verification/biomes/',import.meta.url);await mkdir(out,{recursive:true});
const shot=id=>page.screenshot({path:fileURLToPath(new URL(id+'.png',out))});
try{
 if(!gameOnly)for(const renderer of ['webgl','canvas']){
  console.log('Checking '+renderer+' biomes');
  await page.goto(origin+'/biome-preview.html'+(renderer==='canvas'?'?renderer=canvas':''));await page.waitForFunction(()=>window.biomePreview,{},{timeout:90000});
  await page.evaluate(()=>localStorage.setItem('biome-verification-sentinel','untouched'));
  const before=await page.evaluate(()=>JSON.stringify(localStorage));
  for(const preset of ['snow','meadow','forest','basin','desert','coast','marsh','volcanic']){
   await page.locator('#preset').selectOption(preset);
   for(let view=0;view<4;view++){
    const data=await page.evaluate(view=>{const g=window.biomePreview.game;g.setQuarterView(view);g.scene.updateMatrixWorld(true);g.camera.updateMatrixWorld();g.renderer.render(g.scene,g.camera);const props=[...g.nature,...g.decorations,...g.scenery.group.children.filter(m=>m.userData.mapSide)].filter(m=>m.userData.pixelProp);return {view:g.viewIndex,ecology:g.sim.layout.ecology,renderer:g.renderer.isSoftware?'canvas':'webgl',props:props.every(m=>!!m.userData.image&&m.userData.direction===(view-(m.userData.oriented?Math.round(m.rotation.y/(Math.PI/2)):0)+4)%4),ground:g.terrain.children.some(m=>m.userData.environmentId==='biomeGround'&&!!m.userData.image),buildings:[...g.models.values()].every(m=>!!m.userData.image)};},view);
    assert.equal(data.renderer,renderer);assert.equal(data.ecology,preset);assert.equal(data.view,view);assert.ok(data.props&&data.ground&&data.buildings,JSON.stringify(data));
    if(view===0||preset==='snow')await shot(preset+'-'+view+'-'+renderer);
   }
   const produced=await page.evaluate(()=>{const s=window.biomePreview.game.sim;s.paused=false;for(let i=0;i<720;i++)s.tick(.25);s.paused=true;return s.produced;});production[renderer+'-'+preset]=produced;
   for(const item of ['water','wood','grain','stone',...({desert:['oil'],forest:['plank'],basin:['iron','coal'],volcanic:['iron','coal'],snow:['iron'],coast:['fish'],marsh:['fish']}[preset]||[])])assert.ok(produced[item]>0,renderer+' '+preset+' '+item+JSON.stringify(produced));
  }
  await page.locator('#preset').selectOption('desert');await page.locator('#overlay').selectOption('oil');assert.equal(await page.evaluate(()=>window.biomePreview.game.overlay),'oil');
  await page.locator('#overlay').selectOption('');await page.locator('#center').click();await page.setViewportSize({width:390,height:844});await page.waitForTimeout(350);await shot('mobile-'+renderer);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const pixels=await sharp(await page.locator('canvas').screenshot()).removeAlpha().raw().toBuffer(),colors=new Set();for(let i=0;i<pixels.length;i+=57)colors.add(pixels.subarray(i,i+3).toString('hex'));assert.ok(colors.size>100,'Paused map stays visible after resize');
  assert.equal(await page.evaluate(()=>JSON.stringify(localStorage)),before,'Preview never alters saved games');await page.setViewportSize({width:1440,height:1000});
 }
 if(!previewOnly){
 console.log('Checking normal game UI');
 await page.goto(origin);await page.locator('canvas[role="application"]').waitFor({state:'attached',timeout:120000});await page.getByRole('button',{name:'화면을 눌러 시작',exact:true}).click();
 assert.ok(await page.getByRole('link',{name:'지형 8종 테스트',exact:true}).isVisible());await page.getByRole('button',{name:'새 게임',exact:true}).click();
 await page.locator('#realm').selectOption('elune');assert.equal(await page.locator('#start-province').inputValue(),'elune-5');assert.match(await page.locator('.realm-sheet .biome-summary').textContent(),/비옥한 평야/);await shot('world-map-start');
 await page.getByRole('button',{name:'이 땅에서 시작',exact:true}).click();await page.getByRole('button',{name:'일시정지',exact:true}).waitFor({timeout:120000});await page.getByRole('button',{name:'일시정지',exact:true}).click();
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'주변 지형',exact:true}).click();assert.match(await page.locator('.map-edges .biome-summary').textContent(),/비옥한 평야/);await shot('game-start');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(350);await shot('game-mobile');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);await writeFile(new URL(previewOnly?'preview-results.json':gameOnly?'game-results.json':'browser-results.json',out),JSON.stringify({passed:true,scope:previewOnly?'preview':gameOnly?'game':'all',checks:[...(!gameOnly?['eight actual province biomes','four camera views','WebGL/CPU','actual production per biome','oil overlay','no preview save writes']:[]),...(!previewOnly?['home link','world map','new game']:[]),'mobile'],production,errors,failed},null,2));
 console.log('Biome browser PASS: '+(previewOnly?'eight regions, four views, WebGL/CPU, production, save isolation and mobile':gameOnly?'home link, world map, new game and mobile':'preview and normal game UI')+'.');
}catch(e){console.error('Browser failure:',e.message,errors,failed);await shot('failure').catch(()=>{});throw e;}finally{await browser.close();}
