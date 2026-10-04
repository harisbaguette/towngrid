import {BUILDINGS} from './simulation.js';
import {localWeatherState,daylight} from './effect-state.js';
import {shipmentPose} from './export-route.js';
import {shipmentVehicle} from './vehicle-art.js';
import {MUSIC,MUSIC_PLAYLISTS,musicSelection,ACTION_SOUNDS,LOCAL_EVENTS,ALERT_EVENTS,vehicleSound} from './soundscape.js';
import {MUSIC_CATALOG} from './music-catalog.js';
import {musicLocation} from './audio-geography.js';
export {MUSIC,MUSIC_PLAYLISTS} from './soundscape.js';
export const FILES={click:'bookPlace1',cancel:'cloth1',invalid:'metalLatch',build:'chop',demolish:'doorClose_1',sell:'handleCoins',pickup:'dropLeather',drop:'bookPlace1',heal:'cloth3',footstep:'footstep00',field:'clothBelt',well:'metalPot2',lumber:'chop',quarry:'metalPot1',stable:'creak2',warehouse:'doorOpen_1',house:'doorOpen_2',dwarfhouse:'doorOpen_2',titanhouse:'doorOpen_2',spirithouse:'doorOpen_2',centaurhouse:'doorOpen_2',sawmill:'knifeSlice',mill:'creak1',bakery:'metalPot3',dock:'cloth3',generator:'metalClick',workshop:'metalPot1',logistics:'beltHandle1',clinic:'bookOpen',road:'footstep04',repair:'chop',upgrade:'metalClick',expand:'bookOpen'};
Object.assign(FILES,{magetower:'bookOpen',steamworks:'metalClick',leyrelay:'bookOpen',plant:'cloth1',defend:'metalLatch',impact:'metalPot1',defeat:'cloth3',retreat:'doorClose_1',victory:'handleCoins',ironmine:'metalPot1',coalpit:'chop',smelter:'metalPot3',oilpump:'creak2',refinery:'metalPot2',chemical:'metalPot3',manaextractor:'bookOpen',electronics:'metalClick',automotive:'metalLatch',laboratory:'metalPot2',hospital:'bookOpen',arcanepower:'metalClick',battery:'metalLatch',station:'beltHandle1',rail:'metalClick',bank:'handleCoins',barracks:'doorOpen_1',dispatch:'doorClose_1',delivery:'handleCoins',strike:'bookClose',raid:'doorClose_1',manaStorm:'metalPot3',sanction:'metalLatch'});
// M11: facilities added by the 2026-09-28 balance patch reuse the existing samples.
Object.assign(FILES,{cottonfield:'clothBelt',herbgarden:'clothBelt',kiln:'metalPot3',glassworks:'metalPot3',cementworks:'metalPot3',blastfurnace:'metalPot3',weaver:'cloth3',tailor:'cloth3',smokehouse:'metalPot2',confectionery:'metalPot2',henhouse:'creak2',coppermine:'metalPot1',wiremill:'metalClick',cannery:'metalClick',engineworks:'metalClick',assemblyline:'metalClick',lampworks:'bookOpen',mithrilforge:'bookOpen',wardpost:'bookOpen',fortress:'bookOpen',parliament:'bookOpen',shipyard:'beltHandle1',airdock:'beltHandle1',watermill:'creak1',marketplace:'handleCoins',exchange:'handleCoins'});
Object.assign(FILES,{reservoir:'metalPot2',depot:'doorOpen_1',windturbine:'creak1',hover:'cloth1',tab:'bookOpen',open:'bookOpen',close:'bookClose',pause:'cloth1',resume:'bookPlace1',rotate:'clothBelt',zoom:'cloth3',select:'bookPlace1',save:'bookClose',load:'bookOpen',nation:'bookOpen',contract:'handleCoins',promotion:'handleCoins',storm:'doorClose_1',illness:'bookClose'});
// Trade terminals, networks and the substation (infrastructure.js) reuse the existing samples too.
Object.assign(FILES,{roadhub:'doorOpen_1',pavedroad:'footstep04',pavedhub:'doorOpen_1',snowmobile:'creak2',ferrydock:'cloth3',canaldock:'cloth3',streamdock:'cloth3',riverport:'beltHandle1',lakeport:'beltHandle1',coastport:'beltHandle1',polarferry:'cloth3',polarport:'beltHandle1',railterminal:'beltHandle1',airport:'metalLatch',airterminal:'beltHandle1',pipe:'metalPot2',substation:'metalClick',conveyor:'beltHandle1'});
// Original sound designs are reproducible with scripts/build-presentation-audio.py.
Object.assign(FILES,{hover:'ui-hover',tab:'ui-tab',open:'ui-open',close:'ui-close',select:'ui-select',pause:'ui-pause',resume:'ui-resume',rotate:'ui-rotate',zoom:'ui-zoom',save:'ui-save',load:'ui-load',nation:'ui-tab',notify:'ui-notice',contract:'contract-complete',dispatch:'transport-depart',delivery:'transport-arrive'});
Object.assign(FILES,ACTION_SOUNDS);
// Building sounds are chosen by what the facility does, so facilities added later get a fitting sound without a FILES entry.
// Recordings are listed in music-sources.json; original animal calls in presentation-sounds.json.
export const SOUND_PROFILES={
 wood:{files:['chop','impactWood_medium_001'],gain:.9,cadence:1.7},
 saw:{files:['saw-stroke','knifeSlice'],gain:.75,cadence:1.8},
 stone:{files:['impactMining_000','impactMining_003'],gain:.8,cadence:1},
 metal:{files:['impactMetal_medium_001','impactMetal_heavy_002','metalPot1'],gain:.65,cadence:1.2},
 furnace:{files:['metalPot3','impactMetal_heavy_002'],gain:.6,cadence:2.3,rate:[.8,.95]},
 machine:{files:['machine-chug','machine-press','machine-whirr'],gain:.5,cadence:1.5},
 chemistry:{files:['boil-bubble','impactGlass_light_001'],gain:.6,cadence:2.4},
 water:{files:['water-pour','pump-stroke'],gain:.6,cadence:2.4},
 mill:{files:['creak1','creak3'],gain:.6,cadence:2.6},
 farm:{files:['footstep_grass_002','clothBelt','impactSoft_medium_002'],gain:.75,cadence:2.8},
 animal:{files:['footstep_wood_001','creak2','impactSoft_medium_002'],gain:.7,cadence:3},
 sheep:{files:['sheep-bleat'],gain:.5,cadence:7},
 cow:{files:['cow-low'],gain:.5,cadence:8},
 duck:{files:['duck-quack'],gain:.55,cadence:6},
 hen:{files:['hen-cluck'],gain:.5,cadence:6},
 bee:{files:['bee-buzz'],gain:.4,cadence:5},
 kitchen:{files:['metalPot2','impactTin_medium_000','boil-bubble'],gain:.6,cadence:2.5},
 cloth:{files:['cloth3','cloth2','impactWood_medium_001'],gain:.7,cadence:1.9},
 glass:{files:['impactGlass_light_001','boil-bubble'],gain:.5,cadence:2.4},
 magic:{files:['impactBell_heavy_001'],gain:.3,rate:[1.45,1.85],cadence:3.4},
 electric:{files:['switch-click','machine-whirr'],gain:.5,cadence:3},
 cargo:{files:['beltHandle1','impactPlate_light_001','cart-roll'],gain:.6,cadence:2.8},
 dock:{files:['water-pour','cloth3'],gain:.6,cadence:2.8},
 coins:{files:['handleCoins','handleCoins2'],gain:.6,cadence:3.2},
 civic:{files:['bookOpen','bookFlip1'],gain:.6,cadence:3.4},
 guard:{files:['metalLatch','impactMetal_medium_001'],gain:.6,cadence:3.2},
 home:{files:['doorOpen_2','doorClose_2'],gain:.6,cadence:4},
 store:{files:['doorOpen_1','impactPlank_medium_002'],gain:.6,cadence:3.2},
 road:{files:['footstep04','footstep05'],gain:.5,cadence:4},
};
// Only facilities whose output/group would pick the wrong family are listed here.
const BUILDING_SOUNDS={road:'road',pavedroad:'road',logistics:'cargo',conveyor:'cargo',clinic:'civic',generator:'machine',windturbine:'mill',watermill:'mill',arcanepower:'magic',leyrelay:'magic',chemical:'chemistry',laboratory:'chemistry',refinery:'chemistry',pipe:'water',bank:'coins',marketplace:'coins',exchange:'coins',barracks:'guard',fortress:'guard',mithrilforge:'metal',ferrydock:'dock',canaldock:'dock',streamdock:'dock',polarferry:'dock',pond:'water',windpump:'mill'};
const OUTPUT_SOUNDS={wood:'wood',plank:'saw',stone:'stone',iron:'stone',coal:'stone',copper:'stone',water:'water',irrigation:'water',grain:'farm',cotton:'farm',herb:'farm',horse:'animal',egg:'hen',fish:'dock',flour:'mill',bread:'kitchen',cake:'kitchen',smokedfish:'kitchen',canned:'machine',cloth:'cloth',workwear:'cloth',glass:'glass',lamp:'glass',brick:'furnace',steel:'furnace',concrete:'machine',gear:'metal',wire:'machine',engine:'machine',car:'machine',airship:'machine',circuit:'electric',power:'electric',oil:'machine',fuel:'chemistry',polymer:'chemistry',medicine:'chemistry',health:'civic',mana:'magic',ward:'magic',mithril:'magic',transit:'cargo',
 sugarcane:'farm',salt:'water',grapered:'farm',grapewhite:'farm',cocoa:'farm',strawberry:'farm',mint:'farm',pumpkin:'farm',oakwood:'wood',sugar:'mill',winered:'kitchen',winewhite:'kitchen',barrel:'saw',chocolate:'kitchen',jam:'kitchen',candy:'kitchen',pie:'kitchen',lantern:'glass',
 wool:'sheep',yarn:'cloth',milk:'cow',butter:'kitchen',honey:'bee',wax:'bee',feed:'mill',duckegg:'duck',clay:'stone',sand:'stone',limestone:'stone',chromium:'stone',bluesteel:'furnace',woodbox:'saw',clothbox:'cloth',foodparcel:'cargo',giftparcel:'cargo'};
const GROUP_SOUNDS={base:'store',farm:'farm',home:'home',craft:'metal',industry:'machine',advanced:'machine',energy:'electric',transport:'cargo',civic:'civic'};
export function soundProfileOf(type){
 if(BUILDING_SOUNDS[type])return BUILDING_SOUNDS[type];
 const d=BUILDINGS[type];if(!d)return null;
 if(d.natural==='tree')return 'wood';if(d.natural==='rock')return 'stone';
 return OUTPUT_SOUNDS[d.output]||(d.home||d.resident?'home':null)||(d.onWater?'dock':null)||(d.inputs?.mana?'magic':null)||GROUP_SOUNDS[d.group]||'store';
}
for(const type of Object.keys(BUILDINGS))FILES[type]??=SOUND_PROFILES[soundProfileOf(type)].files[0];
const CHANNELS=['music','effects','ambience'];
const DEFAULT_VOLUMES={master:.82,music:.48,effects:.85,ambience:.45};
// Background tracks rotate with a crossfade; region beds and the day/evening layers loop underneath.
export const AMBIENCE={river:'amb-river',coast:'amb-coast',highland:'amb-wind'};
export const LAYERS={day:'forest-ambience',evening:'amb-crickets'};
export const FRONT_AMBIENCE={
 river:{'amb-river':.7,'forest-ambience':.45},coast:{'amb-coast':.65,'amb-wind':.15},
 evening:{'amb-river':.45,'amb-crickets':.5},garden:{'forest-ambience':.7,'amb-wind':.2},
 winter:{'amb-wind':.65},wind:{'amb-wind':.6},workshop:{'amb-workshop':.8,'forest-ambience':.15},
 forge:{'amb-hearth':.9,'amb-workshop':.3},magic:{'amb-arcane':.8,'amb-room':.3},room:{'amb-room':.8,'amb-hearth':.25},
};
// Source loudness trims in dB. Music is mastered to -20 LUFS; beds use -24 dB RMS.
// the original forest recording is far quieter (-51 dB RMS).
const TRIM={'forest-ambience':25};
const MUSIC_FADE=4;
// Building/footstep sounds share one budget so dozens of working facilities never pile up.
export const WORLD_LIMITS={perSecond:4,voices:5,gain:.16,radius:13,gap:.6,nearby:3};
export const SAMPLE_FILES=[...new Set([...Object.values(FILES),...Object.values(SOUND_PROFILES).flatMap(p=>p.files)])];
export const BACKGROUND_FILES=[...new Set([...MUSIC,'amb-rain',...Object.values(AMBIENCE),...Object.values(LAYERS),...Object.values(FRONT_AMBIENCE).flatMap(Object.keys)])];
const BIOME_AMBIENCE={
 snow:{bed:'amb-wind',level:.75,birds:0,insects:0},
 desert:{bed:'amb-wind',level:.65,birds:0,insects:0},
 volcanic:{bed:'amb-wind',level:.55,birds:0,insects:0},
 basin:{bed:'amb-wind',level:.5,birds:.12,insects:0},
 forest:{bed:'amb-wind',level:.15,birds:.65,insects:.5},
 meadow:{bed:'amb-river',level:.35,birds:.4,insects:.35},
 marsh:{bed:'amb-river',level:.6,birds:.45,insects:.65},
 coast:{bed:'amb-coast',level:.7,birds:.18,insects:.12},
};
// A brief look at a tool or menu should not interrupt a phrase.
const DELAYED_MUSIC=new Set(['menu','settings','residents','ledger','map-tools','terrain','help','credits','operations','goals','haul','trade','league','trials','build','facility','confirm']);
const db=v=>Math.pow(10,v/20);
export class GameAudio{
 constructor(){
  this.context=null;this.muted=false;this.step=0;this.buffers={};this.pending={};this.volumes={...DEFAULT_VOLUMES};this.last={};this.region='river';this.ecology=null;this.clock=0;this._paused=false;this.voices=new Set();this.failed=[];this.disposed=false;this.beds={};this.worldStarts=[];this.musicIndex=0;this.musicResume=null;this.variant={};
  this.front='game';this.dialog=null;this.scene='town';this.world=false;this.industrial=false;this.raid=false;this.environment={};this.movingVehicles=new WeakMap();
  this.selection=musicSelection();this.musicPositions=new Map();this.location=null;
  try{const saved=JSON.parse(localStorage.getItem('orvetharn-audio')||'null');if(saved){for(const key of Object.keys(DEFAULT_VOLUMES)){const v=saved.volumes?.[key];if(Number.isFinite(v))this.volumes[key]=Math.max(0,Math.min(1,v));}this.muted=saved.muted===true;}}catch{}
 }
 get paused(){return this._paused;}
 // Game pause silences the world (effects, ambience); the music keeps playing so dialogs never restart it.
 set paused(value){const next=!!value,changed=next!==this._paused;this._paused=next;if(next&&changed)this.stopVoices(['effects']);if(changed)this.ambience();}
 setPresentation(preset){const next=FRONT_AMBIENCE[preset]?preset:null;if(this.presentation===next)return;this.presentation=next;this.ambience();}
 setInterface(front='game',dialog=null,{loading=false,...options}={}){this.front=front;this.dialog=dialog;this.interfaceLoading=loading;Object.assign(this,options);this.refreshScene(true);this.ambience();}
 setLocation(next){if(!next)return;const old=this.location,same=old&&old.nation===next.nation&&old.ecology===next.ecology&&old.country===next.country&&old.world===next.world;this.location={...next,entry:same?old.entry:old&&old.nation!==next.nation&&old.ecology===next.ecology?'nation':'region'};}
 refreshScene(immediate=false){
  const next=musicSelection({...this,loading:!!this.interfaceLoading}),now=this.context?.currentTime||0;
  if(next.scene===this.scene){this.selection=next;this.sceneCandidate=null;return;}
  const delay=DELAYED_MUSIC.has(next.scene)?1.25:!immediate&&!['danger','error','loading'].includes(next.scene)?1:0;
  if(delay){
   if(this.sceneCandidate?.scene!==next.scene)this.sceneCandidate={scene:next.scene,since:now};
   if(now-this.sceneCandidate.since<delay)return;
  }
  this.selection=next;this.scene=next.scene;this.sceneCandidate=null;this.musicResume=null;this.music();
 }
 start(){
  if(this.disposed||typeof window==='undefined'||(typeof document!=='undefined'&&document.hidden)||!(window.AudioContext||window.webkitAudioContext))return;
  if(!this.context){
   const c=this.context=new(window.AudioContext||window.webkitAudioContext)();
   this.gain=c.createGain();this.compressor=c.createDynamicsCompressor();this.compressor.threshold.value=-12;this.compressor.knee.value=18;this.compressor.ratio.value=4;this.gain.connect(this.compressor);if(c.createAnalyser){this.analyser=c.createAnalyser();this.analyser.fftSize=512;this.waveform=new Float32Array(512);this.compressor.connect(this.analyser);this.analyser.connect(c.destination);}else this.compressor.connect(c.destination);
   this.meters={};for(const name of CHANNELS){this[name+'Gain']=c.createGain();this[name+'Gain'].connect(this.gain);if(c.createAnalyser){const m=c.createAnalyser();m.fftSize=512;this[name+'Gain'].connect(m);this.meters[name]=m;}}
   this.applyVolumes();this.timer=setInterval(()=>this.tick(),500);this.loadSamples();
   // Coming back to the tab resumes the context the game suspended on hide (a gesture already unlocked it).
   if(typeof document!=='undefined'){this.onVisible=()=>{if(document.hidden)this.suspend();else if(this.unlocked&&this.context?.state==='suspended')this.context.resume().then(()=>this.tick()).catch(()=>{});};document.addEventListener('visibilitychange',this.onVisible);}
  }
  return this.context.resume().then(()=>{if(!this.unlocked){this.unlocked=true;this.tone(523.25,.22,'sine',.28);this.tone(783.99,.3,'sine',.19,.12);}this.tick();return true;}).catch(()=>false);
 }
 fetchBuffer(file){
  if(this.buffers[file])return Promise.resolve(this.buffers[file]);if(!this.context||this.disposed)return Promise.resolve(null);
  return this.pending[file]??=(async()=>{
   for(const extension of ['ogg','mp3'])try{
    const response=await fetch('/assets/audio/'+file+'.'+extension,{signal:this.abort?.signal});if(!response.ok)throw new Error('sound unavailable');
    const data=await response.arrayBuffer();if(this.disposed)return null;const buffer=await this.context.decodeAudioData(data);if(this.disposed)return null;
    this.buffers[file]=buffer;this.failed=this.failed.filter(v=>v!==file);return buffer;
   }catch{if(this.disposed)return null;}
   if(!this.failed.includes(file))this.failed.push(file);return null;
  })().finally(()=>{delete this.pending[file];});
 }
 async loadSamples(){
  if(!this.context||this.loading||this.disposed)return;this.loading=true;this.abort??=new AbortController();
  await Promise.all(SAMPLE_FILES.map(file=>this.fetchBuffer(file)));this.loading=false;
 }
 async retryFailed(){
  const background=this.failed.filter(name=>BACKGROUND_FILES.includes(name));
  await Promise.all([this.loadSamples(),...background.map(name=>this.fetchBuffer(name))]);this.tick();
 }
 level(node){if(!node||this.context?.state!=='running')return 0;const data=this.waveform;node.getFloatTimeDomainData(data);let sum=0;for(const v of data)sum+=v*v;return Math.round(Math.sqrt(sum/data.length)*100000)/100000;}
 get status(){const rms=this.level(this.analyser),levels={};for(const n of CHANNELS)levels[n]=this.level(this.meters?.[n]);const music=this.voices.has(this.musicVoice)?this.musicVoice:null;return {rms,levels,state:this.context?.state||'idle',loaded:SAMPLE_FILES.filter(f=>this.buffers[f]).length,total:SAMPLE_FILES.length,failed:this.failed.length,voices:this.voices.size,loading:!!this.loading,scene:this.scene,music:music?.name||null,musicTitle:MUSIC_CATALOG[music?.name]?.title||'',musicContext:music?.label||'',ambience:Object.keys(this.beds).filter(n=>this.voices.has(this.beds[n])&&this.beds[n].target>.02)};}
 applyVolumes(){if(!this.context)return;const now=this.context.currentTime;this.gain.gain.setTargetAtTime(this.muted?0:this.volumes.master,now,.025);for(const n of CHANNELS){const gain=this[n+'Gain'].gain;gain.cancelScheduledValues?.(now);gain.setTargetAtTime(this.volumes[n]*(n==='music'&&this.duckUntil>now?.6:1),now,.025);if(n==='music'&&this.duckUntil>now)gain.setTargetAtTime(this.volumes[n],this.duckUntil,.45);}}
 duckMusic(seconds=1.8){if(!this.context)return;this.duckUntil=Math.max(this.duckUntil||0,this.context.currentTime+seconds);this.applyVolumes();}
 setVolume(name,v){if(!(name in DEFAULT_VOLUMES)||!Number.isFinite(v))return;this.volumes[name]=Math.max(0,Math.min(1,v));this.applyVolumes();this.saveSettings();}
 resetVolumes(){this.volumes={...DEFAULT_VOLUMES};this.setMuted(false);this.start();return {...this.volumes};}
 saveSettings(){try{localStorage.setItem('orvetharn-audio',JSON.stringify({volumes:this.volumes,muted:this.muted}));}catch{}}
 track(source,nodes,channel,extra){
  if(this.voices.size>=48){const oldest=[...this.voices].find(v=>v.channel==='effects');if(!oldest||channel!=='effects')return null;oldest.stop();}
  let ended=false;const voice={channel,...extra,stop:()=>{try{source.stop();}catch{}cleanup();}};
  const cleanup=()=>{if(ended)return;ended=true;for(const node of [source,...nodes])node.disconnect();this.voices.delete(voice);};
  source.onended=cleanup;this.voices.add(voice);return voice;
 }
 stopVoices(channels){for(const voice of [...this.voices])if(!channels||channels.includes(voice.channel)){if(voice===this.musicVoice)this.rememberMusic();voice.stop();}}
 rememberMusic(){const v=this.musicVoice;if(v&&this.voices.has(v)&&this.context){this.musicResume={name:v.name,offset:Math.max(0,(v.offset+this.context.currentTime-v.started))%v.duration};this.musicPositions.delete(v.scene);this.musicPositions.set(v.scene,this.musicResume);if(this.musicPositions.size>128)this.musicPositions.delete(this.musicPositions.keys().next().value);}}
 tick(){if(this.disposed)return;this.refreshScene();this.music();this.ambience();}
 tone(frequency,duration=.15,type='sine',volume=.15,delay=0,channel='effects'){
  if(this.context?.state!=='running'||this.muted||this.disposed)return;
  const o=this.context.createOscillator(),g=this.context.createGain(),t=this.context.currentTime+delay;o.type=type;o.frequency.value=frequency;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(this[channel+'Gain']);if(!this.track(o,[g],channel)){g.disconnect();return;}o.start(t);o.stop(t+duration+.03);
 }
 noise(duration,volume,filter=500,channel='effects'){
  if(this.context?.state!=='running'||this.muted||this.disposed)return;const c=this.context;
  if(!this.noiseBuffer){this.noiseBuffer=c.createBuffer(1,c.sampleRate*5,c.sampleRate);const data=this.noiseBuffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;}
  const src=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain(),t=c.currentTime;src.buffer=this.noiseBuffer;src.loop=true;f.type='lowpass';f.frequency.value=filter;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+Math.min(.18,duration/3));g.gain.linearRampToValueAtTime(0,t+duration);src.connect(f);f.connect(g);g.connect(this[channel+'Gain']);if(!this.track(src,[f,g],channel)){g.disconnect();return;}src.start();src.stop(t+duration+.02);
 }
 // One long source per track; the next one starts MUSIC_FADE seconds before the current ends, so the playlist never has a gap.
 music(){
  if(this.muted||this.disposed||this.context?.state!=='running')return;
  const c=this.context,now=c.currentTime,current=this.voices.has(this.musicVoice)?this.musicVoice:null;
  // A missing contextual track falls back to the normal town playlist, with no repeated failed requests.
  const preferred=this.selection.tracks,available=preferred.filter(n=>!this.failed.includes(n));
  const playlist=available.length?available:MUSIC_PLAYLISTS.town.filter(n=>!this.failed.includes(n));
  if(!playlist.length){if(!current)this.fallbackMusic();return;}
  const changing=!!current&&(!playlist.includes(current.name)||(current.scene!==this.scene&&current.name!==playlist[0]));
  if(current&&!changing){current.scene=this.scene;current.label=this.selection.label;}
  const saved=!current&&this.musicResume||((!current||changing)&&this.musicPositions.get(this.scene));
  const resume=saved&&playlist.includes(saved.name)?saved:null;
  const name=resume?resume.name:changing?playlist[0]:current?playlist[(playlist.indexOf(current.name)+1)%playlist.length]:playlist[0];
  // Old requests can finish after a fast menu change; retain only live tracks and the next selection.
  const live=new Set([...this.voices].filter(v=>v.channel==='music').map(v=>v.name));
  for(const n of MUSIC)if(n!==name&&!live.has(n))delete this.buffers[n];
  if(current&&!changing&&now<current.ends-MUSIC_FADE-.6)return;
  if(changing&&now-(this.musicChangedAt??-10)<.8)return;
  const buffer=this.buffers[name];
  if(!buffer){this.fetchBuffer(name);return;}
  const at=current&&!changing?Math.max(now,current.ends-MUSIC_FADE):now,offset=resume&&resume.offset<buffer.duration-MUSIC_FADE*2?resume.offset:0,d=buffer.duration-offset,fadeIn=changing?1.2:offset?1.2:current?MUSIC_FADE:1.5,level=db(TRIM[name]||0);
  // At most two music sources, even when menus are opened and closed quickly.
  for(const voice of [...this.voices])if(voice.channel==='music'&&voice!==current)voice.stop();
  if(changing){this.rememberMusic();const gain=current.g.gain;if(gain.cancelAndHoldAtTime)gain.cancelAndHoldAtTime(now);else{gain.cancelScheduledValues?.(now);gain.setValueAtTime(Math.max(0,gain.value),now);}gain.linearRampToValueAtTime(0,now+1.2);current.src.stop(now+1.25);current.ends=now+1.2;this.musicChangedAt=now;}
  const src=c.createBufferSource(),g=c.createGain();src.buffer=buffer;
  g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(level,at+fadeIn);g.gain.setValueAtTime(level,at+d-MUSIC_FADE);g.gain.linearRampToValueAtTime(0,at+d);src.connect(g);g.connect(this.musicGain);
  const voice=this.track(src,[g],'music',{name,src,g,scene:this.scene,label:this.selection.label,started:at,offset,duration:buffer.duration,ends:at+d});if(!voice){g.disconnect();return;}
  if(current)current.handedOver=true;this.musicVoice=voice;this.musicResume=null;this.musicIndex=MUSIC.indexOf(name);src.start(at,offset);src.stop(at+d+.05);
  const upcoming=playlist[(playlist.indexOf(name)+1)%playlist.length];if(!this.buffers[upcoming])this.fetchBuffer(upcoming);
  // Keep at most the playing and the next track decoded (each is tens of MB once decoded).
  for(const n of MUSIC)if(n!==name&&n!==upcoming&&n!==current?.name)delete this.buffers[n];
 }
 fallbackMusic(){
  const pitch=this.region==='coast'?1.12246:this.region==='highland'?.8909:1;
  const phrases=[[293.66,369.99,440,554.37,493.88,440,369.99,329.63],[293.66,440,587.33,554.37,493.88,369.99,329.63,220],[369.99,440,493.88,659.25,587.33,493.88,440,369.99],[329.63,392,493.88,587.33,554.37,440,329.63,293.66]];
  const phrase=phrases[Math.floor(this.step/16)%phrases.length];
  if(this.step%2===0)this.tone(phrase[Math.floor(this.step/2)%8]*pitch,1.6,'triangle',.19,0,'music');
  if(this.step%8===0){const root=[146.83,110,123.47,130.81][Math.floor(this.step/16)%4]*pitch;this.tone(root,3.2,'sine',.14,0,'music');this.tone(root*1.5,3.2,'sine',.07,0,'music');}this.step++;
 }
 // The same day/night phase as the visible lighting; wildlife follows the visible biome.
 ambienceMix(){
  if(this.presentation)return FRONT_AMBIENCE[this.presentation];
  if(this.dialog==='trade')return {'amb-room':.8};
  if(this.overview||this.dialog==='world')return {'amb-wind':.45};
  const ecology=this.location?.ecology||this.ecology;
  const profile=BIOME_AMBIENCE[ecology]||{bed:AMBIENCE[this.region]||AMBIENCE.river,level:.7,birds:.4,insects:.35};
  const night=daylight(this.clock).night,calm=1-Math.min(.8,this.environment['amb-rain']||0);
  return {[profile.bed]:profile.level,[LAYERS.day]:profile.birds*(1-night)*calm,[LAYERS.evening]:profile.insects*night*calm,...this.environment};
 }
 ambience(){
  if(this.muted||this.disposed||this.context?.state!=='running')return;
  const c=this.context,now=c.currentTime,mix=this.paused&&!this.presentation&&!['trade','world'].includes(this.dialog)?{}:this.ambienceMix();
  for(const name of new Set([...Object.keys(this.beds),...Object.keys(mix)])){
   const target=(mix[name]||0)*db(TRIM[name]||0);let voice=this.voices.has(this.beds[name])?this.beds[name]:null;
   if(!voice&&target>0){const buffer=this.buffers[name];if(!buffer){if(!this.failed.includes(name))this.fetchBuffer(name);else if(name.startsWith('amb-')&&now-(this.last.bedNoise??-10)>4){this.last.bedNoise=now;this.noise(4.5,this.region==='coast'?.17:.05,this.region==='highland'?320:1100,'ambience');}continue;}
    const src=c.createBufferSource(),g=c.createGain();src.buffer=buffer;src.loop=true;const edge=Math.min(.03,buffer.duration/20);src.loopStart=edge;src.loopEnd=buffer.duration-edge;
    g.gain.setValueAtTime(0,now);src.connect(g);g.connect(this.ambienceGain);voice=this.track(src,[g],'ambience',{name,g,target:0});if(!voice){g.disconnect();continue;}
    this.beds[name]=voice;src.start(now,Math.random()*buffer.duration*.8);}
   if(!voice)continue;
   if(Math.abs(voice.target-target)>.001){voice.g.gain.setTargetAtTime(target,now,target>voice.target?1.2:.5);voice.target=target;voice.idleSince=target>0?null:now;}
   if(target===0&&now-(voice.idleSince??now)>4){voice.stop();delete this.beds[name];}
  }
  // Browsing all scenes must not retain every decoded ambience track in memory.
  const retained=this.ambienceMix();
  for(const name of BACKGROUND_FILES)if(!MUSIC.includes(name)&&!retained[name]&&!this.voices.has(this.beds[name]))delete this.buffers[name];
 }
 play(type,{pan=0,volume=.35,world=false}={}){
  if(this.context?.state!=='running'||this.muted||this.disposed)return false;const now=this.context.currentTime;
  const profileId=soundProfileOf(type),profile=SOUND_PROFILES[profileId],key=world&&profile?'p:'+profileId:type;
  if(world){
   if(now-(this.last[key]??-10)<(type.startsWith('vehicle-')?1.8:WORLD_LIMITS.gap))return false;
   // 1.1 s window: the audio clock ticks in render quanta, so a plain 1 s window can let a fifth start into one wall-clock second.
   this.worldStarts=this.worldStarts.filter(t=>now-t<1.1);if(this.worldStarts.length>=WORLD_LIMITS.perSecond)return false;
   if([...this.voices].filter(v=>v.world).length>=WORLD_LIMITS.voices)return false;
   volume=Math.min(volume,WORLD_LIMITS.gain);this.worldStarts.push(now);
  }else if(now-(this.last[key]??-10)<(type==='notify'?4:ALERT_EVENTS.has(type)?1.5:.13))return false;
  this.last[key]=now;
  if(!world&&this.volumes.effects>0&&ALERT_EVENTS.has(type))this.duckMusic(type==='promotion'?2.4:1.8);
  // A promotion has its own fanfare (B5); it no longer shares the coin sample of a sale.
  if(type==='promotion'){this.fanfare();return true;}
  let name=FILES[type];if(profile){const files=profile.files.filter(f=>this.buffers[f]);if(files.length){const i=(this.variant[profileId]=((this.variant[profileId]??-1)+1+Math.floor(Math.random()*Math.max(1,files.length-1)))%files.length);name=files[i];}}
  const buffer=this.buffers[name];
  if(buffer){const src=this.context.createBufferSource(),g=this.context.createGain(),p=this.context.createStereoPanner(),[lo,hi]=profile?.rate||(ACTION_SOUNDS[type]?[1,1]:[.94,1.06]);src.buffer=buffer;src.playbackRate.value=lo+Math.random()*(hi-lo);g.gain.value=Math.min(world?WORLD_LIMITS.gain:1,volume*(profile?.gain??1));p.pan.value=Math.max(-1,Math.min(1,pan));src.connect(g);g.connect(p);p.connect(this.effectsGain);if(!this.track(src,[g,p],'effects',{world,type,name})){p.disconnect();return false;}src.start();}
  else if(!world)this.tone(type==='invalid'?110:520,.09,'triangle',.08);
  if(world)return true;
  return true;
 }
 interact(type='click'){const ready=this.start();if(this.context?.state==='running')this.play(type,{volume:type==='hover'?.10:.48});else ready?.then(ok=>{if(ok)this.play(type,{volume:.48});});}
 preview(name,seconds=3){
  const buffer=this.buffers[name];if(!buffer){this.fetchBuffer(name).then(b=>{if(b)this.preview(name,seconds);});return;}
  if(this.context?.state!=='running'||this.muted)return;const c=this.context,src=c.createBufferSource(),g=c.createGain(),t=c.currentTime,level=db(TRIM[name]||0);src.buffer=buffer;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(level,t+.4);g.gain.setValueAtTime(level,t+seconds-.8);g.gain.linearRampToValueAtTime(0,t+seconds);src.connect(g);g.connect(this.ambienceGain);if(!this.track(src,[g],'ambience')){g.disconnect();return;}src.start(t,Math.random()*Math.max(0,buffer.duration-seconds));src.stop(t+seconds+.05);
 }
 test(channel){this.start();this.context?.resume().then(()=>{if(channel==='effects')this.play('build');if(channel==='music'){if(this.voices.has(this.musicVoice))return;this.music();if(!this.voices.has(this.musicVoice))for(const[i,f]of [293.66,369.99,440].entries())this.tone(f,.65,'triangle',.12,i*.25,'music');}if(channel==='ambience')this.preview(Object.keys(this.ambienceMix())[0]);}).catch(()=>{});}
 update(sim,camera,view={}){
  this.presentation=null;this.paused=sim.paused;this.region=sim.region;this.ecology=sim.layout?.ecology||null;this.clock=sim.time||0;const events=sim.soundEvents.splice(0);
  this.world=(view.span??55)>95||Math.hypot((camera?.x??12)-12,(camera?.z??12)-12)>34;
  this.overview=(view.span??55)>95;
  this.raid=!!sim.raid&&!sim.raid.finished;
  this.industrial=sim.buildings.filter(b=>b.enabled!==false&&(b.health??100)>0&&['industry','advanced','energy'].includes(BUILDINGS[b.type]?.group)).length>=3;
  this.setLocation(musicLocation(sim,camera,view));
  this.refreshScene();
  const cx=camera?.x??12,cz=camera?.z??12,fall=(x,z,r=WORLD_LIMITS.radius)=>Math.max(0,1-Math.hypot(x-cx,z-cz)/r)**2,pan=x=>Math.max(-.35,Math.min(.35,(x-cx)/12));
  const weather=localWeatherState(sim,{x:cx,z:cz}),snow=(this.location?.ecology||this.ecology)==='snow';
  this.environment={'amb-rain':snow?0:weather.rain*.7,'amb-arcane':weather.mana*.25};
  if(snow&&weather.rain>0)this.environment['amb-wind']=.75+weather.rain*.25;
  for(const b of sim.buildings){if(!b.working||this.world)continue;const f=fall(b.x,b.z,10),profile=soundProfileOf(b.type),bed=profile==='magic'?'amb-arcane':profile==='furnace'?'amb-hearth':['machine','metal','saw'].includes(profile)?'amb-workshop':null;if(bed)this.environment[bed]=Math.max(this.environment[bed]||0,.55*f);}
  for(const e of events){
   if(BUILDINGS[e.type]||LOCAL_EVENTS.has(e.type)){if(sim.paused||this.world)continue;const f=fall(e.x,e.z,e.type==='footstep'?8:WORLD_LIMITS.radius);if(f>.02)this.play(e.type,{pan:pan(e.x),volume:(e.type==='footstep'?.06:.16)*f,world:true});continue;}
   // Confirmation and important notices remain audible while paused or looking at the continent.
   this.play(e.type,{volume:.36});
  }
  if(sim.paused||this.world||!this.context)return;
  for(const sh of sim.shipments||[]){const old=this.movingVehicles.get(sh);this.movingVehicles.set(sh,{progress:sh.progress,away:sh.away});if(sh.blocked||!old||!sh.route?.length)continue;const departed=sh.away&&!old.away;if(!departed&&(sh.away||old.progress===sh.progress))continue;const p=shipmentPose(sh),f=fall(p.x,p.z,11);if(f>.02)this.play(vehicleSound(departed?sh.vehicle:shipmentVehicle(sh,sim,p)),{pan:pan(p.x),volume:.1*f,world:true});}
  // Quiet work rhythm from the nearest few running facilities; the world budget above still applies.
  const nearby=sim.buildings.filter(b=>b.working&&SOUND_PROFILES[soundProfileOf(b.type)]?.cadence&&fall(b.x,b.z,9)>0).sort((a,b)=>Math.hypot(a.x-cx,a.z-cz)-Math.hypot(b.x-cx,b.z-cz)).slice(0,WORLD_LIMITS.nearby);
  for(const b of nearby){const cadence=SOUND_PROFILES[soundProfileOf(b.type)].cadence,phase=Math.floor((b.animationTime||sim.time||0)/cadence),key='work-'+b.id;
   if(this.last[key]!==phase){this.last[key]=phase;this.play(b.type,{pan:pan(b.x),volume:.11*fall(b.x,b.z,9),world:true});}
  }
 }
 click(){this.play('click');}build(){this.play('build');}
 // Rank-up: rising brass-like arpeggio and a held chord, longer and lower-rooted than the 4-note success jingle.
 fanfare(){for(const[i,f]of [261.63,329.63,392,523.25].entries()){this.tone(f,.32,'sawtooth',.045,i*.12);this.tone(f,.36,'triangle',.13,i*.12);}for(const f of [523.25,659.25,783.99])this.tone(f,1.1,'triangle',.09,.5);this.tone(130.81,1.3,'sine',.14,.5);}
 success(){for(const[i,f]of [392,493.88,587.33,783.99].entries())this.tone(f,.42,'triangle',.16,i*.11);}
 suspend(){this.stopVoices(['effects']);this.context?.suspend().catch(()=>{});}
 setMuted(v){this.muted=!!v;if(this.muted){this.stopVoices();this.beds={};}this.applyVolumes();this.saveSettings();if(!this.muted)this.tick();}
 dispose(){this.disposed=true;clearInterval(this.timer);if(this.onVisible)document.removeEventListener('visibilitychange',this.onVisible);this.abort?.abort();this.stopVoices();for(const n of CHANNELS){this[n+'Gain']?.disconnect();this.meters?.[n]?.disconnect();}this.gain?.disconnect();this.compressor?.disconnect();this.analyser?.disconnect();this.context?.close().catch(()=>{});this.buffers={};this.beds={};this.noiseBuffer=null;}
}
