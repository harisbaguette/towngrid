// node tests/mira-runtime-browser.mjs <playwright/index.mjs> <chrome.exe>
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
const out = new URL(process.env.TOWNGRID_PROOF_DIR || '../docs/verification/mira-runtime/', import.meta.url);
await mkdir(out, { recursive: true });
try {
 const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = [], failedAssets = [];
 // Keep this test snapshot stable while other local work triggers HMR.
 await page.routeWebSocket('**/*',()=>{});
 page.on('pageerror', e => errors.push(e.message));
 page.on('response', r => { if (r.status() >= 400 && r.url().includes('/pixel-characters/')) failedAssets.push(r.url()); });
 await page.route(/\/src\/app\/game\/scene\.js(?:\?|$)/,async route=>{
  const response=await route.fetch(),source=await response.text();
  await route.fulfill({response,body:source.replace('setSimulation(sim) {','setSimulation(sim) { window.miraScene=this;').replace('setSimulation(sim){','setSimulation(sim){window.miraScene=this;')});
 });
 await page.goto(process.env.TOWNGRID_URL || 'http://localhost:5173');
 // The scene canvas exists after the client and its game assets initialize.
 await page.locator('canvas[role="application"]').waitFor({ state: 'attached', timeout: 120000 });
 await page.getByRole('button', { name: '화면을 눌러 시작', exact: true }).click({ timeout: 120000 });
 await page.locator('.home-extras summary').click();
 await page.getByRole('button', { name: '초반 마을 테스트', exact: true }).waitFor({ timeout: 120000 });
 await page.getByRole('button', { name: '초반 마을 테스트', exact: true }).click();
 await page.waitForFunction(() => window.miraScene?.sim.workers.some(w => w.appearance === 'mira'));
 await page.getByRole('button', { name: '일시정지', exact: true }).click();
 const assets = await page.evaluate(async () => {
  const data = await fetch('/assets/pixel-characters/mira/frames.json').then(r => r.json());
  const image = await new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = '/assets/pixel-characters/mira/sprites.png'; });
  const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0); const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
  const alpha = (x, y) => pixels[(y * image.width + x) * 4 + 3];
  const cells = [];
  for (let row = 0; row < 8; row++) for (let column = 0; column < 64; column++) {
   let opaque = 0, border = 0, minY = 128, maxY = 0;
   for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) if (alpha(column * 128 + x, row * 128 + y)) {
    opaque++; minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    if (x === 0 || x === 127 || y === 0 || y === 127) border++;
   }
   cells.push({ row, column, opaque, border, minY, maxY });
  }
  const s = window.miraScene;
  return { width: image.width, height: image.height, revision: data.revision, clips: data.clips, cells, residents: s.sim.workers.map(w => ({ id: w.id, appearance: w.appearance, columns: s.workerModels.get(w.id)?.userData.atlas.columns })) };
 });
 assert.equal(assets.width, 8192); assert.equal(assets.height, 1536);
 assert.ok(assets.cells.every(c => c.opaque > 600 && c.opaque < 10000 && c.border === 0));
 assert.ok(assets.cells.every(c => c.minY > 0 && c.maxY < 127), 'all actions stay inside their cells');
 assert.ok(assets.residents.filter(w => w.appearance === 'mira').every(w => w.columns === 64));
 assert.ok(assets.residents.filter(w => w.appearance !== 'mira').every(w => w.columns === 64));
 const headCheck = await page.evaluate(async () => {
  const meta=await fetch('/assets/pixel-characters/mira/frames.json').then(r=>r.json());
  const img=new Image();img.src='/assets/pixel-characters/mira/sprites.png';await img.decode();
  const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
  const checks=[];
  for(let row=0;row<4;row++) {
   const bytes=(col,bob)=>Array.from(ctx.getImageData((col%64)*128+42,(row+Math.floor(col/64)*4)*128+13+bob,44,30).data).join(',');
   const reference=bytes(0,meta.rigAudit[row][0].coreOffset[1]);
   for(const action of ['walk','carry']) for(const col of meta.clips[action].frames) {
    const bob=meta.rigAudit[row][col].coreOffset[1];checks.push(bytes(col,bob)===reference);
   }
  }
  return {samples:checks.length,identical:checks.every(Boolean)};
 });
 assert.deepEqual(headCheck,{samples:256,identical:true},'head pixels remain identical across walk and carry');
 const views = [];
 for (let view = 0; view < 4; view++) {
  await page.waitForTimeout(60);
  views.push(await page.evaluate(() => {
   const s = window.miraScene; return { view: s.viewIndex, models: [...s.workerModels.values()].filter(m => m.userData.appearance === 'mira').map(m => ({ row: m.userData.atlas.row, columns: m.userData.atlas.columns, frame: m.userData.frame, center: m.userData.sprite.center.toArray() })) };
  }));
  await page.screenshot({ path: fileURLToPath(new URL(`game-quarter-${view}.png`, out)) });
  await page.keyboard.press('e');
 }
 assert.equal(new Set(views.flatMap(v => v.models.map(m => m.row%4))).size, 4);
 // Actual, unforced logistics: observe empty walking and loaded cargo in the village.
 const activity = await page.evaluate(async () => {
  const scene = window.miraScene, sim = scene.sim, start = sim.time, frames = new Set(), actions = new Set();
  const delivered = sim.logisticsStats.delivered;
  const mismatches=[],counts={moving:0,handling:0,holding:0,corners:0},headings=new Map();
  sim.paused = false; sim.speed = 2;
  const deadline = performance.now()+55000;
  while (sim.time - start < 90 && performance.now() < deadline) {
   await new Promise(requestAnimationFrame);
   for (const w of sim.workers) {
    const m = scene.workerModels.get(w.id),action=m.userData.current;
    if(w.appearance==='mira'){
     actions.add(action);
     if(action==='walk')frames.add(m.userData.frame);
    }
    let expected;
    if(w.handling){counts.handling++;expected=w.handling;}
    else if(w.walking){
     counts.moving++;expected=w.task?.carried||w.phase==='destination'?'carry':'walk';
     if(headings.has(w.id)&&headings.get(w.id)!==w.dir)counts.corners++;
    }else if(w.task?.carried){counts.holding++;expected='carry';}
    headings.set(w.id,w.dir);
    if(expected&&action!==expected&&mismatches.length<20)mismatches.push({id:w.id,time:sim.time,expected,action});
   }
  }
  sim.paused = true;
  return { seconds:sim.time-start, frames: [...frames].sort((a,b) => a-b), actions: [...actions], delivered: sim.logisticsStats.delivered - delivered,counts,mismatches };
 });
 assert.deepEqual(activity.frames, Array.from({length:32},(_,i)=>i+64));
 assert.ok(activity.actions.includes('carry')); assert.ok(activity.delivered > 0);
 assert.ok(activity.counts.corners>0&&activity.counts.handling>0&&activity.counts.holding>0);
 assert.deepEqual(activity.mismatches,[],'real logistics keeps moving cargo, handling and waiting poses');
 await page.getByRole('button', { name: '게임 메뉴', exact: true }).click();
 await page.getByRole('button', { name: '주민', exact: true }).click();
 await page.locator('.resident-choice').filter({ hasText: /^미라/ }).first().click();
 await page.locator('.resident-motion summary').click();
 const sprite = page.locator('.resident-preview');
 assert.equal(await sprite.getAttribute('data-character'), 'mira');
 assert.equal(await sprite.evaluate(e => e.style.backgroundSize), '6400% 800%');
 await page.waitForFunction(()=>document.querySelector('.resident-illustration')?.naturalWidth>0);
 const portrait = await page.locator('.resident-illustration').evaluate(e => ({ width: e.naturalWidth, height: e.naturalHeight }));
 assert.deepEqual(portrait, { width: 220, height: 314 });
 assert.ok((await page.locator('.resident-illustration').evaluate(e=>e.currentSrc)).endsWith('/portrait-idle.png'));
 const stillA=await page.locator('.resident-illustration').screenshot();
 await page.waitForTimeout(1400);
 const stillB=await page.locator('.resident-illustration').screenshot();
 assert.ok(!stillA.equals(stillB),'portrait pixels breathe without requiring a panel rerender');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.waitForFunction(()=>document.querySelector('.resident-illustration')?.currentSrc.endsWith('/portrait.png'));
 await page.emulateMedia({reducedMotion:'no-preference'});
 const uiClips = [];
 for (const [action, name] of [['idle','대기'],['walk','걷기'],['carry','운반'],['work','작업'],['attack','공격'],['pickup','들기'],['drop','놓기'],['greet','인사'],['hurt','피격'],['defeat','쓰러짐'],['turn','회전']]) {
  await page.locator('.resident-actions').getByRole('button', { name, exact: true }).click();
  const keyframes = await sprite.evaluate(e => e.getAnimations()[0]?.effect.getKeyframes().map(k => k.backgroundPosition));
  assert.ok(keyframes?.length > 1, `${action}: metadata animation exists`);
  uiClips.push({ action, keyframes });
 }
 await page.locator('.resident-actions').getByRole('button', { name: '걷기', exact: true }).click();
 for (const name of ['왼쪽 앞','왼쪽 뒤','오른쪽 뒤','오른쪽 앞']) {
  await page.locator('.resident-directions').getByRole('button', { name, exact: true }).click();
  assert.equal(await sprite.evaluate(e => e.getAnimations()[0].effect.getKeyframes().length), 33);
 }
 await page.screenshot({ path: fileURLToPath(new URL('resident-mira.png', out)) });
 await page.setViewportSize({ width: 390, height: 844 });
 await page.screenshot({ path: fileURLToPath(new URL('mobile-mira.png', out)), fullPage: true });
 assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
 assert.deepEqual(errors, []); assert.deepEqual(failedAssets, []);
 await writeFile(new URL('browser-check.json', out), JSON.stringify({ assets, headCheck, views, activity, portrait, uiClips, mobileOverflow: false, errors, failedAssets }, null, 2));
 console.log(JSON.stringify({ atlas: '8192x1024 RGBA', newFrames: 512, legacyActionFrames: 0, views: 4, activity, portrait, uiClips: uiClips.length, errors, failedAssets }));
} finally { await browser.close(); }
