// Isolated stress fixture; injected capital and construction are not balance evidence.
import assert from 'node:assert/strict';
import {Campaign} from '../src/app/game/campaign.js';
import {BUILDINGS} from '../src/app/game/simulation.js';
import {startingProvinces} from '../src/app/game/starting-sites.js';
import {encodeSave,SAVE_KEY,decodeSave} from '../src/app/game/persistence.js';
process.env.TG_OUT||='work/multisite-soak';
const {open,toHome,browser,save,R,origin}=await import('./audit-2/_browser.mjs');
const c=new Campaign();c.treasury.rank=18;c.treasury.money=1e8;c.treasury.debt=0;c.treasury.family=true;
for(const p of startingProvinces('estern')){
 if(c.sites.length===24)break;
 for(const k of ['wood','stone','water'])c.active.stock[k]=200;
 c.foundSite('estern',undefined,p.id);
}
assert.equal(c.sites.length,24);
for(const {sim:s}of c.sites){
 s.owned=new Set(s.tiles.map(t=>t.x+','+t.z));s.nextEvent=1e12;
 for(const [type,count]of [['warehouse',1],['house',3],['well',1],['lumber',1],['field',3],['mill',1],['bakery',1]])for(let i=0;i<count;i++){
  const t=s.tiles.filter(t=>t.z%2===0&&!s.canBuild(type,t.x,t.z,true)).sort((a,b)=>(Math.abs(a.x-11)+Math.abs(a.z-12))-(Math.abs(b.x-11)+Math.abs(b.z-12)))[0];if(t)s.build(type,t.x,t.z,true);
 }
 for(let z=3;z<21;z+=2)for(let x=3;x<21;x++)if(!s.at(x,z)&&s.tile(x,z).terrain!=='water')s.roads.add(x+','+z);
 for(const b of s.buildings)if(BUILDINGS[b.type].home)b.level=3;s.syncWorkers();
 for(const k of ['wood','stone','water','grain','flour','fuel'])s.stock[k]=60;
 s.autoSell={bread:true};s.speed=4;s.paused=false;
}
const raw=encodeSave(c.save());decodeSave(raw);
const page=await open({width:1440,height:900},{reducedMotion:'reduce'}),report={minutes:Number(process.env.TG_SOAK_MINUTES||6),sites:24,buildings:c.sites.reduce((n,v)=>n+v.sim.buildings.length,0),workers:c.sites.reduce((n,v)=>n+v.sim.workers.length,0),samples:[]};
await page.context().addInitScript(({key,raw,origin})=>{if(location.origin===origin)localStorage.setItem(key,raw);},{key:SAVE_KEY,raw,origin});
try{
 await toHome(page,{previewMenu:false});await page.getByRole('button',{name:'이어하기',exact:true}).click();await page.locator('.game-shell.is-playing:not([inert]) .minimal-hud').waitFor({timeout:120000});
 await page.evaluate(()=>{const g=window.tgScene;g.sim.paused=false;g.sim.speed=4;window.renderSamples=[];window.renderCosts=[];let last=performance.now();const render=g.renderer.render.bind(g.renderer);g.renderer.render=(...args)=>{const now=performance.now();window.renderSamples.push(now-last);last=now;if(window.renderSamples.length>1200)window.renderSamples.shift();const result=render(...args);window.renderCosts.push(performance.now()-now);if(window.renderCosts.length>1200)window.renderCosts.shift();return result;};});
 const cdp=await page.context().newCDPSession(page),start=Date.now();
 for(let n=0;n<=report.minutes*2;n++){
  if(n){await page.waitForTimeout(30000);}
  // Identical collections make retained-heap comparisons meaningful.
  await cdp.send('HeapProfiler.collectGarbage');
  const sample=await page.evaluate(()=>{const g=window.tgScene,sorted=[...window.renderSamples].sort((a,b)=>a-b),costs=[...window.renderCosts].sort((a,b)=>a-b);return {gameTime:g.sim.time,paused:g.sim.paused,frames:sorted.length,p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],renderP95:costs[Math.floor(costs.length*.95)],heap:performance.memory?.usedJSHeapSize,geometries:g.renderer.info?.memory.geometries,textures:g.renderer.info?.memory.textures,chunks:g.landscape.chunks.size,generated:g.landscape.data.generated.size,models:g.models.size+g.workerModels.size,viewport:[innerWidth,innerHeight],savesValid:true};});sample.seconds=Math.round((Date.now()-start)/1000);report.samples.push(sample);console.log(JSON.stringify(sample));assert.equal(sample.paused,false);assert.ok(sample.chunks<=25);
  if(n%2===1){await page.evaluate(n=>{const g=window.tgScene;g.setQuarterView(n%4);},n);}
  if(n===Math.floor(report.minutes)){await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.tgScene.setQuality('auto'));}
 }
 const final=await page.evaluate(async()=>{const {encodeSave}=await import('/src/app/game/persistence.js');return encodeSave(window.tgScene.sim.campaign.save());});decodeSave(final);
 assert.ok(report.samples.at(-1).gameTime>report.samples[0].gameTime+report.minutes*30,'all sites keep advancing');
 const stable=report.samples.slice(2);assert.ok(Math.max(...stable.map(v=>v.heap))<stable[0].heap*1.5+32e6,'retained JS heap must stay bounded');
 assert.deepEqual(R.errors,[]);report.errors=R.errors;await save('results.json',report);console.log('PASS 24-site soak; desktop and mobile viewport emulation, not physical mobile hardware');
}catch(e){report.error=e.message;report.errors=R.errors;await save('results.json',report);throw e;}finally{await browser.close();}
