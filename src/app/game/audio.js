export const FILES={click:'bookPlace1',cancel:'cloth1',invalid:'metalLatch',build:'chop',demolish:'doorClose_1',sell:'handleCoins',pickup:'dropLeather',drop:'bookPlace1',heal:'cloth3',footstep:'footstep00',field:'clothBelt',well:'metalPot2',lumber:'chop',quarry:'metalPot1',stable:'creak2',warehouse:'doorOpen_1',house:'doorOpen_2',dwarfhouse:'doorOpen_2',titanhouse:'doorOpen_2',spirithouse:'doorOpen_2',centaurhouse:'doorOpen_2',sawmill:'knifeSlice',mill:'creak1',bakery:'metalPot3',dock:'cloth3',generator:'metalClick',workshop:'metalPot1',logistics:'beltHandle1',clinic:'bookOpen',road:'footstep04',repair:'chop',upgrade:'metalClick',expand:'bookOpen'};
Object.assign(FILES,{magetower:'bookOpen',steamworks:'metalClick',leyrelay:'bookOpen',plant:'cloth1',defend:'metalLatch',impact:'metalPot1',defeat:'cloth3',retreat:'doorClose_1',victory:'handleCoins',ironmine:'metalPot1',coalpit:'chop',smelter:'metalPot3',oilpump:'creak2',refinery:'metalPot2',chemical:'metalPot3',manaextractor:'bookOpen',electronics:'metalClick',automotive:'metalLatch',laboratory:'metalPot2',hospital:'bookOpen',arcanepower:'metalClick',battery:'metalLatch',station:'beltHandle1',rail:'metalClick',bank:'handleCoins',barracks:'doorOpen_1',dispatch:'doorClose_1',delivery:'handleCoins',strike:'bookClose',raid:'doorClose_1',manaStorm:'metalPot3',sanction:'metalLatch'});
// M11: facilities added by the 2026-09-28 balance patch reuse the existing samples.
Object.assign(FILES,{cottonfield:'clothBelt',herbgarden:'clothBelt',kiln:'metalPot3',glassworks:'metalPot3',cementworks:'metalPot3',blastfurnace:'metalPot3',weaver:'cloth3',tailor:'cloth3',smokehouse:'metalPot2',confectionery:'metalPot2',henhouse:'creak2',coppermine:'metalPot1',wiremill:'metalClick',cannery:'metalClick',engineworks:'metalClick',assemblyline:'metalClick',lampworks:'bookOpen',mithrilforge:'bookOpen',wardpost:'bookOpen',fortress:'bookOpen',parliament:'bookOpen',shipyard:'beltHandle1',airdock:'beltHandle1',watermill:'creak1',marketplace:'handleCoins',exchange:'handleCoins'});
Object.assign(FILES,{reservoir:'metalPot2',depot:'doorOpen_1',windturbine:'creak1',hover:'cloth1',tab:'bookOpen',open:'bookOpen',close:'bookClose',pause:'cloth1',resume:'bookPlace1',rotate:'clothBelt',zoom:'cloth3',select:'bookPlace1',save:'bookClose',load:'bookOpen',nation:'bookOpen',contract:'handleCoins',promotion:'handleCoins',storm:'doorClose_1',illness:'bookClose'});
const CHANNELS=['music','effects','ambience'];
const DEFAULT_VOLUMES={master:.82,music:.48,effects:.85,ambience:.45};
export const SAMPLE_FILES=[...new Set(Object.values(FILES)),'calm-theme','forest-ambience'];
export class GameAudio{
 constructor(){
  this.context=null;this.muted=false;this.step=0;this.buffers={};this.volumes={...DEFAULT_VOLUMES};this.last={};this.region='river';this._paused=false;this.voices=new Set();this.failed=[];this.disposed=false;
  try{const saved=JSON.parse(localStorage.getItem('orvetharn-audio')||'null');if(saved){for(const key of Object.keys(DEFAULT_VOLUMES)){const v=saved.volumes?.[key];if(Number.isFinite(v))this.volumes[key]=Math.max(0,Math.min(1,v));}this.muted=saved.muted===true;}}catch{}
 }
 get paused(){return this._paused;}
 set paused(value){if(value&&!this._paused)this.stopVoices();this._paused=!!value;}
 start(){
  if(this.disposed||typeof window==='undefined'||!(window.AudioContext||window.webkitAudioContext))return;
  if(!this.context){
   const c=this.context=new(window.AudioContext||window.webkitAudioContext)();
   this.gain=c.createGain();this.compressor=c.createDynamicsCompressor();this.compressor.threshold.value=-12;this.compressor.knee.value=18;this.compressor.ratio.value=4;this.gain.connect(this.compressor);if(c.createAnalyser){this.analyser=c.createAnalyser();this.analyser.fftSize=512;this.waveform=new Float32Array(512);this.compressor.connect(this.analyser);this.analyser.connect(c.destination);}else this.compressor.connect(c.destination);
   for(const name of CHANNELS){this[name+'Gain']=c.createGain();this[name+'Gain'].connect(this.gain);}
   this.applyVolumes();this.timer=setInterval(()=>this.music(),420);this.ambientTimer=setInterval(()=>this.ambience(),4200);this.loadSamples();
  }
  return this.context.resume().then(()=>{if(!this.unlocked){this.unlocked=true;this.tone(523.25,.22,'sine',.28);this.tone(783.99,.3,'sine',.19,.12);this.music();}if(!this.paused&&!this.voices.size)this.ambience();return true;}).catch(()=>false);
 }
 async loadSamples(){
  if(!this.context||this.loading||this.disposed)return;this.loading=true;this.abort=new AbortController();
  await Promise.all(SAMPLE_FILES.map(async file=>{
   if(this.buffers[file])return;
   for(const extension of ['ogg','mp3'])try{
    const response=await fetch('/assets/audio/'+file+'.'+extension,{signal:this.abort.signal});if(!response.ok)throw new Error('sound unavailable');
    const data=await response.arrayBuffer();if(this.disposed)return;const buffer=await this.context.decodeAudioData(data);if(this.disposed)return;
    this.buffers[file]=buffer;this.failed=this.failed.filter(v=>v!==file);return;
   }catch{if(this.disposed)return;}
   if(!this.failed.includes(file))this.failed.push(file);
  }));this.loading=false;
 }
 get status(){let rms=0;if(this.analyser&&this.waveform&&this.context?.state==='running'){this.analyser.getFloatTimeDomainData(this.waveform);rms=Math.sqrt(this.waveform.reduce((sum,v)=>sum+v*v,0)/this.waveform.length);}return {rms:Math.round(rms*100000)/100000,state:this.context?.state||'idle',loaded:Object.keys(this.buffers).length,total:SAMPLE_FILES.length,failed:this.failed.length,voices:this.voices.size,loading:!!this.loading};}
 applyVolumes(){if(!this.context)return;const now=this.context.currentTime;this.gain.gain.setTargetAtTime(this.muted?0:this.volumes.master,now,.025);for(const n of CHANNELS)this[n+'Gain'].gain.setTargetAtTime(this.volumes[n],now,.025);}
 setVolume(name,v){if(!(name in DEFAULT_VOLUMES)||!Number.isFinite(v))return;this.volumes[name]=Math.max(0,Math.min(1,v));this.applyVolumes();this.saveSettings();}
 resetVolumes(){this.volumes={...DEFAULT_VOLUMES};this.setMuted(false);this.start();return {...this.volumes};}
 saveSettings(){try{localStorage.setItem('orvetharn-audio',JSON.stringify({volumes:this.volumes,muted:this.muted}));}catch{}}
 track(source,nodes,channel){
  if(this.voices.size>=48){const oldest=[...this.voices].find(v=>v.channel==='effects')||this.voices.values().next().value;oldest?.stop();}
  let ended=false;const voice={channel,stop:()=>{try{source.stop();}catch{}cleanup();}};
  const cleanup=()=>{if(ended)return;ended=true;for(const node of [source,...nodes])node.disconnect();this.voices.delete(voice);};
  source.onended=cleanup;this.voices.add(voice);return voice;
 }
 stopVoices(){for(const voice of [...this.voices])voice.stop();}
 tone(frequency,duration=.15,type='sine',volume=.15,delay=0,channel='effects'){
  if(this.context?.state!=='running'||this.muted||this.disposed)return;
  const o=this.context.createOscillator(),g=this.context.createGain(),t=this.context.currentTime+delay;o.type=type;o.frequency.value=frequency;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(this[channel+'Gain']);this.track(o,[g],channel);o.start(t);o.stop(t+duration+.03);
 }
 noise(duration,volume,filter=500,channel='effects'){
  if(this.context?.state!=='running'||this.muted||this.disposed)return;const c=this.context;
  if(!this.noiseBuffer){this.noiseBuffer=c.createBuffer(1,c.sampleRate*5,c.sampleRate);const data=this.noiseBuffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;}
  const src=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain(),t=c.currentTime;src.buffer=this.noiseBuffer;src.loop=true;f.type='lowpass';f.frequency.value=filter;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+Math.min(.18,duration/3));g.gain.linearRampToValueAtTime(0,t+duration);src.connect(f);f.connect(g);g.connect(this[channel+'Gain']);this.track(src,[f,g],channel);src.start();src.stop(t+duration+.02);
 }
 music(){
  if(this.muted||this.context?.state!=='running')return;
  if(this.buffers['calm-theme']){
   if(this.voices.has(this.musicVoice)&&this.context.currentTime<this.musicEnds-2)return;
   const c=this.context,src=c.createBufferSource(),g=c.createGain(),t=c.currentTime;src.buffer=this.buffers['calm-theme'];const d=src.buffer.duration,fade=Math.min(2,d/4);
   g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.64,t+fade);g.gain.setValueAtTime(.64,t+d-fade);g.gain.linearRampToValueAtTime(0,t+d);src.connect(g);g.connect(this.musicGain);
   this.musicVoice=this.track(src,[g],'music');this.musicEnds=t+d;src.start();src.stop(t+d+.02);return;
  }
  const pitch=this.region==='coast'?1.12246:this.region==='highland'?.8909:1;
  const phrases=[[293.66,369.99,440,554.37,493.88,440,369.99,329.63],[293.66,440,587.33,554.37,493.88,369.99,329.63,220],[369.99,440,493.88,659.25,587.33,493.88,440,369.99],[329.63,392,493.88,587.33,554.37,440,329.63,293.66]];
  const phrase=phrases[Math.floor(this.step/16)%phrases.length];
  if(this.step%2===0)this.tone(phrase[Math.floor(this.step/2)%8]*pitch,1.6,'triangle',.19,0,'music');
  if(this.step%8===0){const root=[146.83,110,123.47,130.81][Math.floor(this.step/16)%4]*pitch;this.tone(root,3.2,'sine',.14,0,'music');this.tone(root*1.5,3.2,'sine',.07,0,'music');}this.step++;
 }
 ambience(){if(this.paused||this.muted||this.context?.state!=='running')return;
  if(this.buffers['forest-ambience']){if(!this.voices.has(this.forestVoice)){const c=this.context,src=c.createBufferSource(),g=c.createGain();src.buffer=this.buffers['forest-ambience'];src.loop=true;g.gain.setValueAtTime(0,c.currentTime);g.gain.linearRampToValueAtTime(.22,c.currentTime+1.2);src.connect(g);g.connect(this.ambienceGain);this.forestVoice=this.track(src,[g],'ambience');src.start();}}
  else if(this.region!=='highland')for(let i=0;i<3;i++)this.tone(1800+i*320,.1,'sine',.025,1.3+i*.14,'ambience');
  this.noise(4.5,this.region==='coast'?.17:.04,this.region==='highland'?320:1100,'ambience');
 }
 play(type,{pan=0,volume=.35}={}){
  if(this.context?.state!=='running'||this.muted||this.disposed)return;const now=this.context.currentTime;if(now-(this.last[type]??-10)<.13)return;this.last[type]=now;
  const buffer=this.buffers[FILES[type]];
  if(buffer){const src=this.context.createBufferSource(),g=this.context.createGain(),p=this.context.createStereoPanner();src.buffer=buffer;src.playbackRate.value=.94+Math.random()*.12;g.gain.value=volume;p.pan.value=Math.max(-1,Math.min(1,pan));src.connect(g);g.connect(p);p.connect(this.effectsGain);this.track(src,[g,p],'effects');src.start();}
  else this.tone(type==='invalid'?110:520,.09,'triangle',.08);
  if(type==='well'||type==='dock')this.noise(.3,volume*.18,2200);if(type==='generator')this.noise(.5,volume*.2,400);if(type==='storm'){this.noise(2,.45,280);this.tone(48,1.8,'sine',.2);}if(type==='illness')this.tone(196,.5,'sine',.16);if(type==='dispatch')this.tone(95,.55,'sawtooth',.04);if(type==='delivery')this.tone(660,.15,'sine',.07);if(type==='manaStorm'){this.noise(1.4,.2,1500);this.tone(82,.8,'sine',.08);}if(['promotion','victory'].includes(type))this.success();if(['magetower','leyrelay'].includes(type)){this.tone(740,.6,'sine',.05);this.tone(1110,.8,'sine',.025,.12);}if(type==='defend')this.tone(220,.4,'triangle',.09);if(type==='impact')this.noise(.25,.08,400);
 }
 interact(type='click'){const ready=this.start();if(this.context?.state==='running')this.play(type,{volume:type==='hover'?.10:.48});else ready?.then(ok=>{if(ok)this.play(type,{volume:.48});});}
 test(channel){this.start();this.context?.resume().then(()=>{if(channel==='effects')this.play('build');if(channel==='music')for(const[i,f]of [293.66,369.99,440].entries())this.tone(f,.65,'triangle',.12,i*.25,'music');if(channel==='ambience')this.noise(1.6,.17,1100,'ambience');}).catch(()=>{});}
 update(sim,camera){
  this.paused=sim.paused;this.region=sim.region;const events=sim.soundEvents.splice(0);
  for(const e of events){const distance=Math.hypot(e.x-(camera?.x??12),e.z-(camera?.z??12));this.play(e.type,{pan:(e.x-(camera?.x??12))/15,volume:e.type==='footstep'?Math.max(0,.075-distance*.008):['pickup','drop'].includes(e.type)?Math.max(.02,.2-distance*.016):Math.max(.03,.36-distance*.023)});}
  if(sim.paused)return;
  if(this.context){
   const nearby=sim.buildings.filter(b=>b.working&&['sawmill','mill','quarry','generator','workshop','logistics','well','stable','smelter','oilpump','refinery','electronics','automotive','arcanepower','kiln','glassworks','weaver','cementworks','wiremill','blastfurnace','assemblyline','shipyard','watermill'].includes(b.type)).sort((a,b)=>Math.hypot(a.x-camera.x,a.z-camera.z)-Math.hypot(b.x-camera.x,b.z-camera.z)).slice(0,3);
   for(const b of nearby){const cadence={quarry:.7,workshop:1.05,sawmill:1.7,generator:2.5,well:2.0}[b.type]||2.2,phase=Math.floor((b.animationTime||0)/cadence),key='work-'+b.id;
    if(this.last[key]!==phase){this.last[key]=phase;const distance=Math.hypot(b.x-camera.x,b.z-camera.z);if(distance<9)this.play(b.type,{pan:(b.x-camera.x)/9,volume:.13*(1-distance/10)});}
   }
  }
 }
 click(){this.play('click');}build(){this.play('build');}success(){for(const[i,f]of [392,493.88,587.33,783.99].entries())this.tone(f,.42,'triangle',.16,i*.11);}
 suspend(){this.stopVoices();this.context?.suspend().catch(()=>{});}
 setMuted(v){this.muted=!!v;if(this.muted)this.stopVoices();this.applyVolumes();this.saveSettings();}
 dispose(){this.disposed=true;clearInterval(this.timer);clearInterval(this.ambientTimer);this.abort?.abort();this.stopVoices();for(const n of CHANNELS)this[n+'Gain']?.disconnect();this.gain?.disconnect();this.compressor?.disconnect();this.analyser?.disconnect();this.context?.close().catch(()=>{});this.buffers={};this.noiseBuffer=null;}
}
