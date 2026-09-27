// Usage: node tests/pixel-environment-browser.mjs <playwright/index.mjs> <chrome.exe>
// Reuses an installed browser; no project dependency or lockfile changes.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}), args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage(), errors = [], failedAssets = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.url().includes('/assets/pixel-environment/') && response.status() >= 400) failedAssets.push(response.url()); });
const output = new URL('../docs/verification/pixel-environment/', import.meta.url);
await mkdir(output, { recursive: true });
const screenshot = name => page.screenshot({ path: new URL(name, output).pathname.replace(/^\/(?=[A-Z]:)/i, ''), fullPage: true });
const origin = process.env.TOWNGRID_URL || 'http://localhost:5173';
try {
 await page.goto(origin + '/pixel-environment-preview.html');
 await page.waitForFunction(() => document.querySelector('#sawmill').dataset.frame !== undefined);
 await screenshot('samples.png');
 await page.getByRole('button', { name: '생산 중', exact: true }).click();
 await page.waitForFunction(() => +document.querySelector('#sawmill').dataset.frame > 0);
 await page.getByRole('button', { name: '대기', exact: true }).click();
 await page.waitForFunction(() => document.querySelector('#sawmill').dataset.frame === '0');
 await page.getByRole('button', { name: '채집', exact: true }).click();
 await page.waitForFunction(() => document.querySelector('#oak').dataset.frame === '3');
 await screenshot('harvest.png');
 for(let view=0;view<4;view++)await page.getByLabel('제재소 방향').selectOption(String(view));
 await page.setViewportSize({ width: 390, height: 844 });
 assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
 await screenshot('samples-mobile.png');
 await page.setViewportSize({ width: 1440, height: 1000 });
 await page.goto(origin, { waitUntil: 'domcontentloaded' });
 await page.getByRole('button', { name: '산업도시 둘러보기', exact: true }).click({ timeout: 120000 });
 await page.getByRole('button', { name: '오른쪽 90도 회전', exact: true }).waitFor();
 const map = page.locator('canvas[role="application"]');
 const quarter = () => map.getAttribute('data-camera-quarter');
 assert.equal(await quarter(), '0');
 await page.getByRole('button', { name: '일시정지', exact: true }).click();
 for (let view = 0; view < 4; view++) {
  assert.equal(await quarter(), String(view));
  await screenshot(`game-quarter-${view}.png`);
  await page.getByRole('button', { name: '오른쪽 90도 회전', exact: true }).click();
 }
 assert.equal(await quarter(), '0');
 await page.keyboard.press('q');assert.equal(await quarter(), '3');
 await page.keyboard.press('e');assert.equal(await quarter(), '0');
 // A repeated keydown must not spin through the other authored views.
 await page.keyboard.down('e');await page.keyboard.down('e');await page.keyboard.up('e');
 assert.equal(await quarter(), '1');
 await page.getByRole('button', { name: '지도 중앙', exact: true }).click();
 assert.equal(await quarter(), '0');
 const bounds = await map.boundingBox();
 await page.mouse.move(bounds.x + bounds.width * .6, bounds.y + bounds.height * .55);
 await page.mouse.down({ button: 'right' });
 await page.mouse.move(bounds.x + bounds.width * .68, bounds.y + bounds.height * .65, { steps: 8 });
 await page.mouse.up({ button: 'right' });
 assert.equal(await quarter(), '0');
 await page.getByRole('button', { name: '확대', exact: true }).click();
 await page.getByRole('button', { name: '축소', exact: true }).click();
 assert.equal(await quarter(), '0');
 await page.getByRole('button', { name: '지도 중앙', exact: true }).click();
 // Inspect the same runtime objects in a disposable scene, independent of the
 // user's React refs and browser saves. Includes the CPU fallback path.
 const runtime = await page.evaluate(async () => {
  const [{GameScene},{createShowcase},{loadAssets},{SoftwareRenderer}] = await Promise.all([
   import('/app/game/scene.js'),import('/app/game/simulation.js'),import('/app/game/assets.js'),import('/app/game/software-renderer.js'),
  ]);
  await loadAssets('human');
  const host=document.createElement('div');host.style.cssText='position:fixed;inset:0;width:960px;height:720px;z-index:99999;background:#fff';document.body.append(host);
  const sim=createShowcase(),game=new GameScene(host,sim);game.active=false;sim.paused=true;
  const mill=sim.buildings.find(b=>b.type==='sawmill'),model=game.models.get(mill.id),views=[];
  const tiles=[];
  game.focusBuilding(mill.id);game.zoom(1.7);
  for(let view=0;view<4;view++){
   game.setQuarterView(view);game.scene.updateMatrixWorld(true);game.camera.updateMatrixWorld();
   const position=model.position.clone().project(game.camera);
   game.setMode('sawmill');
   game.pointerMove({clientX:(position.x+1)*host.clientWidth/2,clientY:(1-position.y)*host.clientHeight/2});
   tiles.push([game.hover.x,game.hover.z]);
   views.push({index:game.viewIndex,row:model.userData.direction,ghostRow:game.ghost.userData.direction,alphaTest:game.ghost.userData.sprite.material.alphaTest,opacity:game.ghost.userData.sprite.material.opacity,angle:game.controls.getAzimuthalAngle(),polar:game.controls.getPolarAngle()});
  }
  game.setMode(null);
  // Damping must not drift away from a freshly selected building or reset target.
  game.controls.pan(60,35);game.focusBuilding(mill.id);for(let i=0;i<20;i++)game.controls.update();
  const focused=game.controls.target.toArray();
  const point=model.position.clone().add({x:0,y:.55,z:0}).project(game.camera);
  game.pointerMove({clientX:(point.x+1)*host.clientWidth/2,clientY:(1-point.y)*host.clientHeight/2});
  const selected=[game.hover.x,game.hover.z];
  // Verify the transparent corner of a billboard does not intercept clicks.
  const sprite=model.userData.sprite,center=model.position.clone(),right=center.clone().setFromMatrixColumn(game.camera.matrixWorld,0),up=center.clone().setFromMatrixColumn(game.camera.matrixWorld,1);
  const corner=center.clone().addScaledVector(right,(.01-sprite.center.x)*sprite.scale.x).addScaledVector(up,(.99-sprite.center.y)*sprite.scale.y).project(game.camera);
  game.raycaster.setFromCamera({x:corner.x,y:corner.y},game.camera);
  const cornerHits=game.raycaster.intersectObject(model,true).length;
  const tree=game.nature.find(n=>n.userData.wasMature),tile=tree.userData.tile;
  tile.nature=null;tile.remaining=0;sim.revision++;game.rebuild();
  const stump=game.nature.find(n=>n.userData.stumpUntil&&n.position.x===tile.x&&n.position.z===tile.z);
  const stumpFrame=stump?.userData.frame;
  sim.time+=3;game.rebuild();
  const expired=!game.nature.some(n=>n.userData.stumpUntil&&n.position.x===tile.x&&n.position.z===tile.z);
  const water=game.water,waterFrame=water.userData.frame;water.userData.animate(.4);
  const waterMatrix=water.matrixWorld.clone();water.getMatrixAt(0,waterMatrix);
  const software=new SoftwareRenderer({alpha:true});software.setSize(960,720);
  const isolated=game.scene.clone(false),cpuModel=game.models.get(mill.id);
  game.setQuarterView(2);isolated.add(cpuModel);software.render(isolated,game.camera);
  const pixels=software.ctx.getImageData(0,0,960,720).data;
  let colored=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i])colored++;
  isolated.remove(cpuModel);game.world.add(cpuModel);
  const softwarePng=software.domElement.toDataURL();software.dispose();
  const renderer=game.renderer.isSoftware?'canvas':'webgl';
  game.dispose();host.remove();
  return {views,tiles,focused,selected,expected:[mill.x,mill.z],cornerHits,stumpFrame,expired,waterY:waterMatrix.elements[13],waterFrame,waterNext:water.userData.frame,colored,cpuRow:cpuModel.userData.direction,softwarePng,renderer};
 });
 for(const view of runtime.views){assert.equal(view.row,view.index);assert.equal(view.ghostRow,view.index);assert.ok(view.alphaTest<view.opacity);assert.ok(Math.abs(view.polar-Math.acos(1/Math.sqrt(3)))<1e-8);}
 for(const tile of runtime.tiles)assert.deepEqual(tile,runtime.expected);
 assert.deepEqual(runtime.selected,runtime.expected);
 assert.ok(Math.abs(runtime.focused[0]-runtime.expected[0])<1e-8&&Math.abs(runtime.focused[2]-runtime.expected[1])<1e-8);
 assert.equal(runtime.cornerHits,0);assert.equal(runtime.stumpFrame,4);assert.equal(runtime.expired,true);
 assert.ok(runtime.waterY>-.19);assert.equal(runtime.waterNext,1);assert.ok(runtime.colored>200);assert.equal(runtime.cpuRow,2);
 await writeFile(new URL('sawmill-software.png',output),Buffer.from(runtime.softwarePng.split(',')[1],'base64'));
 delete runtime.softwarePng;
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'오른쪽 90도 회전',exact:true}).click();
 assert.equal(await quarter(),'1');
 const cdp=await context.newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:125,y:350},{id:2,x:245,y:400}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:100,y:330},{id:2,x:270,y:425}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.equal(await quarter(),'1');
 await screenshot('game-mobile.png');
 assert.deepEqual(failedAssets, []);
 assert.deepEqual(errors, []);
 await writeFile(new URL('browser-results.json', output), JSON.stringify({ passed: true, checks: ['sample state controls', 'mobile overflow', 'four UI views', '90 degree buttons', 'Q/E keys', 'key repeat suppression', 'right drag no free rotation', 'zoom and reset', 'matching facade and ghost directions', 'tile picking in all views', 'transparent pixel picking', 'stump depletion and expiry', 'CPU sprite rendering', 'water above background', 'asset HTTP', 'no page errors'], runtime, errors, failedAssets }, null, 2));
 console.log('Browser verification passed: sample controls, mobile layout, live game, four camera directions, keyboard, pan, zoom, assets.');
} finally { await browser.close(); }
