import {GameAudio,SOUND_PROFILES,soundProfileOf} from './audio.js';
import {vehicleSound} from './soundscape.js';

const byId=id=>document.getElementById(id);
const value=id=>byId(id)?.value;
const checked=id=>!!byId(id)?.checked;
const STEP_ACTIONS=new Set(['walk','carry','start','stop']);
const FLOATING=new Set(['dew','fia','mist','eil']);
const JOB_SOUND={bron:'quarry',taron:'quarry',hana:'bakery',lien:'bakery',rowan:'workshop',terin:'workshop',marna:'smelter',serin:'smelter',ethan:'field',elion:'field',vera:'clinic',eil:'clinic',ael:'sawmill',mist:'magetower',dorin:'ironmine',elvar:'ironmine',nara:'weaver',lyra:'weaver',borik:'glassworks',oriel:'glassworks',garron:'lumber',maren:'dock',nalia:'dock',roa:'stable',lana:'stable',cedric:'magetower',bel:'bank',vian:'bank',oswin:'parliament',erena:'parliament',dax:'logistics',norin:'logistics',hugo:'dock',selia:'dock',otto:'station',luth:'station',iris:'airport',aira:'airport',garen:'barracks',aster:'barracks'};

// The selected character supplies one clock, even when several directions are on screen.
export function characterCue({id='mira',action='walk',time=0,meta,stepSpeed=.8,paused=false}){
 if(paused)return null;
 const clip=meta?.clips?.[action],duration=clip?.seconds||clip?.frames?.length/(clip?.fps||8)||1;
 if(STEP_ACTIONS.has(action)){
  if(FLOATING.has(id))return null;
  const stride=clip?.strideLength||meta?.strideLength||.6;
  return {key:id+':'+action,type:'footstep',phase:Math.floor(time*(stepSpeed===null?1/duration:stepSpeed/stride)*2),volume:.07};
 }
 const type={work:JOB_SOUND[id]||'field',pickup:'pickup',drop:'drop',attack:'guardHit',hurt:'impact',defeat:'defeat',greet:'hover',turn:'footstep'}[action];
 if(!type||clip?.once&&time>=duration)return null;
 return {key:id+':'+action,type,phase:Math.floor(time/duration),volume:action==='work'?.13:.18};
}

function character(read,id,stepSpeed=.8){return ()=>{
 const p=read();if(!p)return null;const s=p.state,part=p.segment?.(),meta=p.assets?.get(s.id)?.meta||p.meta||p.after?.meta;
 return {scene:'residents',presentation:'garden',paused:s.paused,cue:characterCue({id:s.id||id,action:part?.action||s.action||'walk',time:part?part.phase*meta.clips[part.action].seconds:s.elapsed??s.time,paused:s.paused,meta,stepSpeed:part?null:stepSpeed})};
};}
function map(read,{running,staticLandscape=false}={}){return ()=>{
 const p=read();if(!p)return null;const game=p.game;
 return {game,paused:running?!running(p):false,working:running?running(p):!game.sim.paused,staticLandscape};
};}
const PROFILES={
 '/biome-preview.html':map(()=>window.biomePreview),
 '/map-edges-preview.html':map(()=>window.edgePreview),
 '/landforms-preview.html':map(()=>window.landformsPreview,{staticLandscape:true}),
 '/world-effects-preview.html':map(()=>window.effectsPreview,{running:p=>p.isRunning()}),
 '/environment-preview.html':map(()=>window.environmentPreview,{running:p=>p.isRunning()}),
 '/character-preview/':character(()=>window.rosterPreview,'mira'),
 '/character-preview/mira/':character(()=>window.miraPreview,'mira',null),
 '/character-preview/bron-motion/':character(()=>window.bronComparison,'bron',.36),
 '/character-preview/authored-motion/':character(()=>window.authoredMotionReview,'mira',.625),
 '/production-preview.html':()=>{
  const p=window.productionPreview;if(!p)return null;
  const s=p.state(),items=p.items.filter(i=>visible(i.article)),focus=items.find(i=>i.article.matches(':focus-within, :hover'))||items[0];
  const working=['working','working-ready'].includes(s.state);
  return {scene:'industry',presentation:working?'workshop':'room',paused:s.paused,cue:focus&&working?workCue(focus.type,s.time):null};
 },
 '/pixel-environment-preview.html':()=>{
  const p=window.pixelEnvironmentPreview;if(!p)return null;
  const target=document.querySelector('[data-target]:hover')?.dataset.target||p.focus;
  const type=target==='sawmill'&&p.state.sawmill==='working'?'sawmill':target==='oak'&&p.state.oak==='harvest'?'lumber':null;
  return {scene:target==='water'?'terrain':'facility',presentation:target==='water'&&p.state.water==='flow'?'river':target==='oak'?'garden':type?'workshop':'room',cue:type?workCue(type,p.time()):null};
 },
 '/art-preview.html':()=>{
  const p=window.artPreview;if(!p)return null;const kind=value('category');
  const entries=p.entries.filter(e=>visible(e.ctx.canvas)),focus=entries.find(e=>e.ctx.canvas.parentElement.matches(':hover, :focus-within'))||entries[0];
  const type=kind==='vehicles'&&checked('motion')&&focus?vehicleSound(focus.id):kind==='handling'&&focus?'logistics':null;
  return {scene:kind==='vehicles'||kind==='handling'?'haul':'gallery',presentation:kind==='vehicles'&&['raft','steamer','ship','ferry'].includes(focus?.id)?'coast':'room',cue:type?{key:focus.id,type,phase:Math.floor(p.time()/2),volume:.1}:null};
 },
 '/building-readability.html':()=>({scene:'facility',presentation:'room'}),
 '/design-system':()=>({scene:'menu',presentation:'room'}),
 '/ui-layout-concepts/':()=>({scene:'home',presentation:'river'}),
 '/ui-layout-concepts/full-layouts.html':()=>({scene:'menu',presentation:'room'}),
 '/ui-layout-concepts/start-map.html':()=>({scene:'world',presentation:'wind'}),
};
function visible(element){const r=element.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth;}
function workCue(type,time){const profile=SOUND_PROFILES[soundProfileOf(type)];return profile?{key:type,type,phase:Math.floor(time/profile.cadence),volume:.11}:null;}

const UI_SOUND={left:'rotate',right:'rotate',rotate:'rotate',closer:'zoom',farther:'zoom',center:'zoom',repair:'repair',view:'rotate',direction:'rotate',size:'zoom',scale:'zoom',zoom:'zoom',preset:'nation',biome:'nation',region:'nation',landform:'plot',loaded:'pickup',item:'select',health:'impact',overlay:'tab',layout:'tab',category:'tab',effect:'tab',group:'tab'};
export function mountPreviewAudio({read=()=>({scene:'menu',presentation:'room'}),host=document.querySelector('header')||document.body}={}){
 const audio=new GameAudio(),events=new AbortController();let lastCue=null,lastScene=null,lastSim=null,lastTick=0,frame,disposed=false;
 audio.setInterface(read()?.scene||'loading');
 const panel=document.createElement('details');panel.className='preview-audio';panel.setAttribute('aria-label','소리 설정');
 const summary=document.createElement('summary');summary.textContent='소리';panel.append(summary);
 const settings=document.createElement('div'),toggle=document.createElement('button');toggle.type='button';toggle.dataset.audioToggle='';settings.append(toggle);
 const labels={master:'전체',music:'배경음악',effects:'효과음',ambience:'환경음'};
 for(const [key,label]of Object.entries(labels)){
  const row=document.createElement('label'),input=document.createElement('input');row.textContent=label;input.type='range';input.min='0';input.max='100';input.value=String(Math.round(audio.volumes[key]*100));input.setAttribute('aria-label',label+' 음량');
  input.addEventListener('input',()=>{audio.start();audio.setVolume(key,Number(input.value)/100);},{signal:events.signal});row.append(input);settings.append(row);
 }
 const now=document.createElement('small');settings.append(now);panel.append(settings);host.append(panel);
 const style=document.createElement('style');style.textContent='.preview-audio{position:relative;display:inline-block;margin-left:auto;font:13px/1.5 system-ui;flex-shrink:0;color:#293f38}.preview-audio summary{cursor:pointer;padding:6px 12px;border:1px solid #aab9a5;border-radius:5px;background:#fffdf4;white-space:nowrap}.preview-audio>div{position:absolute;right:0;top:100%;z-index:1000;width:248px;padding:12px;background:#fffdf4;border:1px solid #aab9a5;border-radius:5px;box-shadow:0 5px 18px #0003}.preview-audio label{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:9px 0}.preview-audio input{width:150px}.preview-audio button{font:inherit;color:inherit;padding:6px 10px;background:#edf0e5;border:1px solid #aab9a5;border-radius:4px;cursor:pointer}.preview-audio small{display:block;overflow-wrap:anywhere}.preview-audio :focus-visible{outline:3px solid #bf8c2d;outline-offset:2px}';document.head.append(style);
 const refresh=()=>{summary.textContent=audio.muted?'소리 꺼짐':'소리';toggle.textContent=audio.muted?'소리 켜기':'소리 끄기';toggle.setAttribute('aria-pressed',String(!audio.muted));now.textContent=audio.status.musicTitle||'화면을 누르면 소리가 시작됩니다.';};
 const position=()=>{const r=summary.getBoundingClientRect();settings.style.position='fixed';settings.style.right='auto';settings.style.left=Math.max(8,Math.min(innerWidth-256,r.right-248))+'px';settings.style.top=Math.max(8,Math.min(innerHeight-270,r.bottom+4))+'px';};
 panel.addEventListener('toggle',position,{signal:events.signal});addEventListener('resize',position,{signal:events.signal});document.addEventListener('scroll',position,{capture:true,passive:true,signal:events.signal});
 toggle.addEventListener('click',()=>{audio.setMuted(!audio.muted);if(!audio.muted)audio.start();refresh();},{signal:events.signal});
 const interact=e=>{
  const target=e.target.closest?.('button,select,input,a,summary,[role=button],[role=tab]');
  if(panel.contains(e.target)){if(!e.target.closest('[data-audio-toggle]'))audio.start();return;}
  audio.start();if(!target||e.type==='click'&&['SELECT','INPUT'].includes(target.tagName))return;
  const key=target.id,s=read(),type=target.dataset.sound||UI_SOUND[key]||(['play','pause'].includes(key)?(s?.paused||s?.game?.sim.paused)?'pause':'resume':target.dataset.state==='ready'?'delivery':target.dataset.state==='disabled'?'pause':'select');
  audio.play(type,{volume:.26});
 };
 document.addEventListener('click',interact,{signal:events.signal});document.addEventListener('change',interact,{signal:events.signal});
 document.addEventListener('pointerdown',e=>{if(!e.target.closest?.('[data-audio-toggle]'))audio.start();},{signal:events.signal});
 document.addEventListener('keydown',e=>{if(e.repeat||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;audio.start();if(['q','e'].includes(e.key.toLowerCase()))audio.play('rotate',{volume:.22});},{signal:events.signal});
 const tick=time=>{
  if(disposed)return;frame=requestAnimationFrame(tick);if(document.hidden||time-lastTick<80)return;lastTick=time;
  const s=read();if(!s)return;
  if(s.game){
   const game=s.game,sim=game.sim;
   if(lastSim!==sim){sim.soundEvents.length=0;lastSim=sim;}
   if(audio.front!=='game')audio.setInterface('game');
   // Display fixtures freeze the simulation while advancing their own animation clock.
   // Only the audio view is adapted; the fixture and campaign are never changed.
   const view={...sim,paused:!!s.paused,buildings:s.working&&!s.staticLandscape?sim.buildings:sim.buildings.map(b=>({...b,working:false})),soundEvents:sim.soundEvents};
   audio.update(view,game.controls.target,{span:game.worldSpan()});
  }else{
   if(s.scene!==lastScene){audio.setInterface(s.scene);lastScene=s.scene;}
   audio.setPresentation(s.paused?'room':s.presentation);audio.paused=!!s.paused;
  }
  const cue=s.paused?null:s.cue;
  if(cue&&audio.context?.state==='running'&&!audio.muted&&(!lastCue||cue.key!==lastCue.key||cue.phase!==lastCue.phase))audio.play(cue.type,{volume:cue.volume,world:true});
  lastCue=cue;refresh();
 };
 frame=requestAnimationFrame(tick);refresh();audio.start();
 const dispose=()=>{if(disposed)return;disposed=true;cancelAnimationFrame(frame);events.abort();audio.dispose();panel.remove();style.remove();};
 addEventListener('pagehide',e=>{if(e.persisted)audio.suspend();else dispose();},{signal:events.signal});
 addEventListener('pageshow',e=>{if(e.persisted&&audio.unlocked&&!disposed)audio.start();},{signal:events.signal});
 return {audio,dispose};
}

export function installPreviewAudio(){
 const path=location.pathname.replace(/\/index\.html$/,'/'),read=PROFILES[path];
 if(!read)return null;
 const instance=mountPreviewAudio({read});window.previewAudio=instance.audio;return instance.dispose;
}
