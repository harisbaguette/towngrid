"use client";
import {checkpointOffline,catchUpOffline,cancelOffline,isOfflineProcessing} from './offline-progress';
import {IndustryTrials,IndustryTrialStatus} from './IndustryTrials';
import {createIndustryTrial,TRIAL_SAVE_KEY,recordIndustryTrial} from './industry-trials';
import StoragePanel from './StoragePanel';
import SettingsPanel from './SettingsPanel';
import MusicCredits from './MusicCredits';
import FocusNext from './FocusNext';
import PlaytestResults from './PlaytestResults';
import {newPlaytest,observePlaytest,savePlaytest} from './playtest-diary';
import CommunityPanel from './CommunityPanel';
import {attachTrialReplay} from './trial-replay';
import {layoutOf} from './world-grid';
import {PLOT_INDEX} from './territory';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowRight, ArrowUpRight, ChevronRight, Coins, Droplets, Flag, Hammer, HelpCircle, Home, Maximize, Minus, Pause, Play, Plus, RotateCcw, RotateCw, Globe2, Layers, Lock, Settings2, ShoppingBag, Sparkles, Sprout, Users, Wheat, X, Zap, CircleAlert, Grid2X2Plus, Trash2, Factory, Package, Mountain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BuildingCard, StatusBadge } from '@/components/game-ui/industrial-kit';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Toaster, toast } from 'sonner';
import {Operations,RescuePanel,CharterPanel,ShortFunds,GoalButton,CostShort} from './Operations';
import {BarChart3,Trophy,SaveOff,Truck,Star} from 'lucide-react';
import {LeaguePanel,HaulPanel} from './TownStarPanels';
import {productionDiagnosis} from './proximity';
import {clusterMarkers,demolishRefund,ledgerDiff,ledgerSnapshot,noticeRoute,tileMetrics,unlockedAt} from './ui-rules';
import {remainingSeconds} from './game-time';
import {MarketPanel,Tutorial,RaidPanel,LegacyGoals} from './QualityPanels';
import {effectNotes,slowNotes} from './proximity';
import {blockHint,contractState,crewRules,exportBlocked,itemGate,offered,productsOf,promotionProgress,recipeChoices,tutorialStep} from './ui-rules';
import {SAVE_KEY,BACKUP_KEY,encodeSave,decodeSave,writeSave,backupSave,readRecovery} from './persistence';
import { BUILDINGS, RESOURCES, GOOD_EVENTS, ACTION_PRICES } from './simulation';
import { GameAudio } from './audio';
import { interfaceAudio } from './interface-audio';
import { screenAmbience } from './screen-motion';
import WorldMap from './WorldMap';
import WorldViewControls from './WorldViewControls';
import WorldPlotPanel from './WorldPlotPanel';
import CampaignPanel from './CampaignPanel';
import {Campaign} from './campaign';
import {defaultStartingProvince} from './starting-sites';
import {NATIONS,RACES,RANKS,unlockRank,FACTIONS,factionOf,playableRace} from './world';
import {loadAssets,assetStatus} from './assets';
import ResidentRoster from './ResidentRoster';
import ResourceIcon from './ResourceIcon';
import {powerSupply,powerDemand,powerPreview} from './power-grid';
import {productionVisualState,describeFacility} from './production-visuals';
import {BiomeSummary, MapEdgeList} from './MapEdges';
import {MinimalHud, MinimalFacilityDock} from './MinimalHud';
import {tileLandscape} from './map-edges';
import { HomeScreen, LoadingScreen, TitleScreen, ScreenTransition, ScreenError } from './StartScreens';
import { createArtworkPicker, SCREEN_BACKGROUNDS, WORK_ART, TRANSITION_ART, transitionArtwork, warmArtwork } from './screen-art';
const GROUPS=[['base','기초',Home],['home','주거',Users],['farm','농축산',Sprout],['craft','가공',Hammer],['industry','중공업',Factory],['energy','동력·마법',Zap],['advanced','첨단',Sparkles],['transport','운송',Globe2],['civic','도시',Flag]] as const;
const defs:any=BUILDINGS,resources:any=RESOURCES;
const format=(n:number)=>Math.floor(n).toLocaleString('ko-KR');
// Same breakpoint as the phone layout in game-ui.css.
const PHONE='(max-width:700px)',watchPhone=(change:()=>void)=>{const m=window.matchMedia(PHONE);m.addEventListener('change',change);return()=>m.removeEventListener('change',change);},SHORT='(max-height:560px) and (min-aspect-ratio:1/1)',watchShort=(change:()=>void)=>{const m=window.matchMedia(SHORT);m.addEventListener('change',change);return()=>m.removeEventListener('change',change);};
// Race rules of the current faction, read from the same data the logistics code uses (RACES crafts / hauler, BUILDINGS skilled).
export default function Game(){
 const mount=useRef<HTMLDivElement>(null),scene=useRef<any>(null),campaign=useRef<any>(null),sim=useRef<any>(null),audio=useRef<any>(null),playing=useRef(false),demoRef=useRef(true);
 const importInput=useRef<HTMLInputElement>(null),saveFailure=useRef(false);
 const playtest=useRef<any>(null);
 const resumeRequired=useRef(new WeakSet<object>());
 const setPaused=(paused:boolean)=>{const current=sim.current;if(!current)return;current.paused=paused;if(paused)resumeRequired.current.add(current);else resumeRequired.current.delete(current);};
 // Notices already seen per settlement (C1/C2), the time of the player's last action (a plain notice answering it may pop up),
 // news held back from toasts (J9) and the day-boundary ledger snapshots (J8).
 const seenNotices=useRef(new Map<any,number>()),lastAction=useRef(0),ownNotices=useRef(new Set<string>()),news=useRef<{day:number,site:string,text:string}[]>([]);
 const ledger=useRef<{sim:any,start:any,last:any,history:number[]}|null>(null);
 const [saveFailed,setSaveFailed]=useState(false),[demolishArm,setDemolishArm]=useState<number|null>(null),[promoted,setPromoted]=useState<any>(null);
 // Last dialog kind, so a closing dialog keeps its title and body through the exit animation (B9); dialogOpen is read by
 // the key handler, which runs after the dialog has already closed itself on the same Escape (B10).
 const shownDialog=useRef<string|null>(null),dialogOpen=useRef(false);
 const exportUrl=useRef<string>('');const [exportData,setExportData]=useState('');
 const [quality,setQuality]=useState('auto'),[audioStatus,setAudioStatus]=useState<any>({state:'idle',loaded:0,total:0,failed:0}),[contextLost,setContextLost]=useState(false);
 const [saveState,setSaveState]=useState(''),[tutorialHidden,setTutorialHidden]=useState(true),[confirmNew,setConfirmNew]=useState(false);
 // True while the first-session guide is on screen; a new building then keeps its card closed so the next step stays visible.
 const guideOn=useRef(false);
 // Toasts sit below the compact status groups, leaving the current bottom tool accessible.
 const phone=useSyncExternalStore(watchPhone,()=>window.matchMedia(PHONE).matches,()=>false);const shortScreen=useSyncExternalStore(watchShort,()=>window.matchMedia(SHORT).matches,()=>false);
 const [frontScreen,setFrontScreen]=useState<'title'|'home'|'world'>('title');
 const [homeAmbience,setHomeAmbience]=useState('river');
 const [homeGallery,setHomeGallery]=useState(false),[worldStage,setWorldStage]=useState<'country'|'plot'|'preview'>('country');
 const onHomeArt=useCallback((src:string)=>setHomeAmbience(screenAmbience(src)),[]);
 const previousDialog=useRef<string|null>(null);
 const [transitionArt,setTransitionArt]=useState<typeof WORK_ART[number]|null>(null);
 const [transitionLabel,setTransitionLabel]=useState('마을을 불러오는 중');
 const [navigation,setNavigation]=useState<{art:typeof WORK_ART[number];label:string;complete:()=>void}|null>(null);
 const navigationLock=useRef(false);
 const navigate=(complete:()=>void,context='home',label='화면을 여는 중')=>{
  if(navigationLock.current||transitionLock.current)return;
  audio.current?.play('transition');
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){complete();return;}
  navigationLock.current=true;setNavigation({art:transitionArtwork(context),label,complete});
 };
 const finishNavigation=()=>{if(!navigationLock.current||!navigation)return;navigationLock.current=false;setNavigation(null);navigation.complete();};
 const navigateFront=(target:'title'|'home'|'world')=>navigate(()=>setFrontScreen(target),target==='world'?'world':'home',target==='world'?'시작할 땅을 고르는 중':target==='title'?'대기 화면으로':'마을로 돌아오는 길');
 const artworkPicker=useRef<ReturnType<typeof createArtworkPicker>|null>(null),transitionLock=useRef(false);
 const nextArtwork=useCallback(()=>{
  if(!artworkPicker.current){let storage;try{storage=window.localStorage;}catch{}artworkPicker.current=createArtworkPicker(storage);}
  setTransitionArt(artworkPicker.current()||null);void warmArtwork(artworkPicker.current.peek()?.src);
 },[]);
 const prepareTransition=async(context='village',label='마을을 불러오는 중')=>{audio.current?.play('transition');transitionLock.current=true;setTransitionArt(transitionArtwork(context));setTransitionLabel(label);setBusy(true);if(!artworkPicker.current){let storage;try{storage=window.localStorage;}catch{}artworkPicker.current=createArtworkPicker(storage);}void warmArtwork(artworkPicker.current.peek()?.src);await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));};
 const [ledgerAll,setLedgerAll]=useState(false),[labels,setLabels]=useState(false),[markers,setMarkers]=useState<any[]>([]);
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[welcome,setWelcome]=useState(true),[region,setRegion]=useState('river'),[icons,setIcons]=useState<Record<string,string>>({});
 const [nation,setNation]=useState('estern'),[race,setRace]=useState('human'),[busy,setBusy]=useState(false),[tile,setTile]=useState<any>(null),[overlay,setOverlay]=useState(''),[audioVolumes,setAudioVolumes]=useState<any>({master:.82,music:.48,effects:.85,ambience:.45});
 const [startProvinceId,setStartProvinceId]=useState<string|null>(()=>defaultStartingProvince('estern')?.id||null);
 const [buildOpen,setBuildOpen]=useState(false);
 const [worldSelection,setWorldSelection]=useState<string|null>(null);
 const [starterDemo,setStarterDemo]=useState(false);
 const [category,setCategory]=useState('base'),[tool,setTool]=useState<string|null>(null),[selected,setSelected]=useState<number|null>(null),[dialog,setDialog]=useState<string|null>(null),[muted,setMuted]=useState(false),[saved,setSaved]=useState(false),[demo,setDemo]=useState(false),[hover,setHover]=useState<any>(null),[,render]=useState(0);
 const repaint=()=>render(v=>v+1);
 const persistTimer=useRef<number|null>(null);
 // Button actions queue one merged save (C4): a burst of clicks writes once, 0.8 s after the last.
 const schedulePersist=()=>{if(persistTimer.current!==null)return;persistTimer.current=window.setTimeout(()=>{persistTimer.current=null;persist();},800);};
 const persist=()=>{if(playtest.current)savePlaytest(localStorage,playtest.current);if(persistTimer.current!==null){window.clearTimeout(persistTimer.current);persistTimer.current=null;}if(!sim.current||demoRef.current||!playing.current)return false;try{if(!document.hidden&&!isOfflineProcessing(campaign.current))checkpointOffline(campaign.current);if(campaign.current.trial){localStorage.setItem(TRIAL_SAVE_KEY,encodeSave(campaign.current.save()));if(!recordIndustryTrial(localStorage,campaign.current))toast.warning('게임은 저장됐지만 최고 기록은 보관하지 못했습니다.',{id:'trial-record-storage'});}else{writeSave(localStorage,campaign.current.save());setSaved(true);}setSaveState('저장됨 · '+new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}));saveFailure.current=false;setSaveFailed(false);return true;}catch{setSaveState('저장 실패 · 파일로 내보내세요');setSaveFailed(true);if(!saveFailure.current){toast.error('브라우저에 저장하지 못했습니다. 설정에서 저장 파일을 내려받으세요.',{duration:9000});saveFailure.current=true;}return false;}};
 const exportGame=()=>{if(!campaign.current)return;try{const raw=encodeSave(campaign.current.save());if(exportUrl.current)URL.revokeObjectURL(exportUrl.current);exportUrl.current=URL.createObjectURL(new Blob([raw],{type:'application/json'}));setExportData(raw);setDialog('settings');audio.current?.play('save');toast('저장 파일이 준비됐습니다. 파일 저장을 눌러 보관하세요.');}catch(e:any){toast.error(e.message||'저장 파일을 만들지 못했습니다.');}};
 const installSave=async(raw:string)=>{
  if(transitionLock.current||navigationLock.current||!scene.current)return;await prepareTransition('restore','저장한 마을을 불러오는 중');try{const restored=new Campaign({saved:decodeSave(raw)});attachTrialReplay(restored);await Promise.all(restored.active.availableRaces.map((r:string)=>loadAssets(r)));
  if(playtest.current)savePlaytest(localStorage,playtest.current);playtest.current=null;
   if(restored.trial)localStorage.setItem(TRIAL_SAVE_KEY,encodeSave(restored.save()));else{backupSave(localStorage);writeSave(localStorage,restored.save());}
   restored.active.paused=true;resumeRequired.current.add(restored.active);campaign.current=restored;sim.current=restored.active;demoRef.current=false;playing.current=true;setDemo(false);setWelcome(false);setBuildOpen(false);setSelected(null);setTile(null);setTool(null);setDialog(null);setNation(restored.active.nation);setRace(restored.active.race);syncNotices(restored);ledger.current=null;scene.current.setSimulation(restored.active);setIcons(scene.current.icons(restored.active.race));setSaved(!!localStorage.getItem(SAVE_KEY));setSaveState('불러오기 완료 · 재개를 눌러주세요');audio.current?.play('load');repaint();await scene.current.warmUp?.();
  }finally{transitionLock.current=false;setBusy(false);setTransitionArt(null);}
 };
 const restoreBackup=async(automatic=false)=>{try{const raw=automatic?readRecovery(localStorage):localStorage.getItem(BACKUP_KEY);if(!raw)throw new Error('복구할 백업이 없습니다. 자동 저장 복구 또는 파일 불러오기를 선택하세요.');await installSave(raw);toast.success('이전 저장을 복구했습니다.');}catch(e:any){toast.error(e.message);}};
 const importGame=async(file:File)=>{try{if(file.size>8_000_000)throw new Error('8MB 이하의 저장 파일을 선택하세요.');await installSave(await file.text());toast.success('저장 파일을 불러왔습니다.');}catch(e:any){toast.error(e.message||'저장 파일을 불러오지 못했습니다. 현재 진행은 유지됩니다.');}};
 // sound '' = the simulation plays its own event sound (sale coins, promotion fanfare), so the UI adds none (B5).
 // J9: a notice is the player's own when the button that was just pressed wrote it. act() runs right after the action and
 // before the next tick, so the notices not yet routed at that moment are exactly the ones the action made; a world
 // event that lands a moment later is routed as news, however close to a click it comes.
 const markOwnNotices=()=>{const c=campaign.current;if(!c)return;for(const site of c.sites){const s2=site.sim,seen=seenNotices.current.get(s2)??0;for(const n of s2.notices)if(n.id>seen)ownNotices.current.add(n.id+':'+(s2.siteId||''));}if(ownNotices.current.size>200)ownNotices.current=new Set([...ownNotices.current].slice(-100));};
 const act=(result:any,sound='click')=>{lastAction.current=performance.now();markOwnNotices();if(!result?.ok){audio.current?.play('invalid');toast.error(result?.error||'작업을 진행할 수 없습니다.');return false;}if(sound&&!sim.current?.soundEvents?.some((e:any)=>e.type===sound)){if(typeof audio.current?.[sound]==='function')audio.current[sound]();else audio.current?.play(sound);}schedulePersist();repaint();return true;};
 // Mark every notice now on record as seen, so switching or loading a settlement does not replay old ones (C2).
 const syncNotices=(c:any=campaign.current)=>{seenNotices.current=new Map((c?.sites||[]).map((site:any)=>[site.sim,site.sim.notices.at(-1)?.id||0]));};
 // Toasts per notice route (J9): warnings from every settlement (named when off screen, C1), successes and answers to the
 // player's own action from this one; the rest joins the ledger news list.
 const routeNotices=()=>{
  const c=campaign.current,active=sim.current;if(!c||!playing.current)return;
  for(const site of c.sites){const s2=site.sim,seen=seenNotices.current.get(s2)??0;let last=seen;
   for(const notice of s2.notices){if(notice.id<=seen)continue;last=Math.max(last,notice.id);const here=s2===active,route=noticeRoute(notice,{active:here,ownAction:ownNotices.current.has(notice.id+':'+(s2.siteId||''))});
    if(route==='warning'){toast.warning(here?notice.text:site.name+' · '+notice.text,{duration:6500});audio.current?.play('notify',{volume:.25});}else if(route==='success')toast.success(notice.text);else if(route==='info')toast(notice.text,{id:'routine-notice',duration:2600});
    // Warnings join the list too: a long warning toast is cut to three lines, its full text stays here.
    if(route!=='success')news.current=[{day:s2.day,site:site.name,text:notice.text},...news.current].slice(0,30);}
   seenNotices.current.set(s2,last);}
 };
 // Day-boundary ledger (J8): snapshot at each new day; the finished day becomes `last`, its money change joins the trend.
 // G3-06: with several sites the ledger covers all of them (shared money and output); a new site restarts it.
 const trackLedger=(s:any)=>{const l=ledger.current,count=campaign.current?.sites?.length||1;if(!l||l.sim!==s||l.start.sites!==count){ledger.current={sim:s,start:ledgerSnapshot(s,campaign.current),last:null,history:[]};return;}
  if(s.day!==l.start.day){const now=ledgerSnapshot(s,campaign.current),diff=ledgerDiff(l.start,now);
  // G3-06b: the day's net = money change between snapshots + what was booked before the first one - the next day's
  // wage already taken at the second one, so nothing is counted twice and a day that began before loading still adds up.
  const net=diff.money+l.start.income-l.start.expenses+now.expenses;l.last={...diff,money:net,day:l.start.day,income:now.lastIncome,expenses:now.lastExpenses};l.history=[...l.history,net].slice(-7);l.start=now;}};
 const pickTool=(name:string|null)=>{setWorldSelection(null);setBuildOpen(false);setTile(null);if(name){setSelected(null);scene.current?.select(null);}setTool(name);scene.current?.setMode(name);setHover(null);audio.current?.click();};
 useEffect(()=>{
  let disposed=false;audio.current=new GameAudio();audio.current.setInterface('title');try{setSaved(!!localStorage.getItem(SAVE_KEY));setMuted(audio.current.muted);setAudioVolumes({...audio.current.volumes});setTutorialHidden(localStorage.getItem('orvetharn-tutorial')!=='shown');}catch{}
  if(!audio.current.muted)void audio.current.start();
  import('./scene').then(async({GameScene})=>{
   await Promise.all((FACTIONS as any).human.members.map((r:string)=>loadAssets(r)));await Promise.all(['demon','orc','beast','goblin','dragon','aquatic'].map(r=>loadAssets(r)));
   if(disposed||!mount.current)return;campaign.current=new Campaign({demo:true});sim.current=campaign.current.active;
   scene.current=new GameScene(mount.current,sim.current,{
    onMarkers:(m:any[])=>setMarkers(m),
    onUpdate:(s:any)=>{if(playing.current&&!demoRef.current){observePlaytest(playtest.current,s,{visible:!document.hidden,menu:dialogOpen.current?shownDialog.current:null});}repaint();routeNotices();if(playing.current&&!demoRef.current)trackLedger(s);},
    // Settlements off screen still queue sounds; drop them so a later visit does not replay stale ones (C9).
    onAudio:(s:any,camera:any,view:any)=>{if(playing.current)audio.current?.update(s,camera,view);for(const site of campaign.current?.sites||[])if(site.sim!==s)site.sim.soundEvents.length=0;},
    onContextLost:()=>{setPaused(true);persist();toast.dismiss();setDialog(null);setConfirmNew(false);setContextLost(true);},onContextRestored:()=>{setContextLost(false);repaint();},
    onHint:(v:string)=>toast(v),onHover:(v:any)=>setHover(v),
    onWorldPick:(cell:any)=>{if(!playing.current)return;if(!cell.site){toast(cell.terrain==='mountain'?'산악 · 정착 불가':'수역 · 정착 불가');return;}audio.current?.play('plot');setWorldSelection(cell.site);scene.current.landscape?.select(cell.site);setSelected(null);setTile(null);setBuildOpen(false);},
    onClick:(x:number,z:number)=>{
     if(!playing.current)return;const s=sim.current,t=scene.current.mode;
     if(t==='expand'){act(s.expand(Math.floor(x/4),Math.floor(z/4)),'expand');return;}
     if(t==='bulldoze'){if(act(s.demolish(x,z),'demolish')){setSelected(null);scene.current.select(null);}return;}
     if(t&&defs[t]){const result=scene.current.relocatingId?s.relocate(scene.current.relocatingId,x,z):s.build(t,x,z);if(act(result,'build')){toast.dismiss('place-first');if(!defs[t].tile){if(!guideOn.current){setSelected(result.id);scene.current.select(result.id);}setTool(null);scene.current.setMode(null);}scene.current.hover=null;}return;}
     if(x===7&&z===11){setDialog('trade');return;}const b=s.at(x,z);setBuildOpen(false);setTile(b?null:s.tile(x,z));audio.current?.play(b?b.type:'click');setSelected(b?.id??null);scene.current.select(b?.id??null);if(!b)scene.current.selectTile(x,z);
    }
   });
   setIcons(scene.current.icons());setQuality(scene.current.quality);setReady(true);
   const context=(document as any).modelContext;
   if(context?.registerTool){
    const controller=new AbortController();(scene.current as any).toolController=controller;
    const register=(definition:any)=>{try{Promise.resolve(context.registerTool(definition,{signal:controller.signal})).catch(()=>{});}catch{}};
    register({name:'read_settlement',title:'마을 상태 확인',description:'현재 마을의 재고, 시설, 영토, 목표를 읽습니다.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({playing:playing.current,region:sim.current.region,money:sim.current.money,stock:sim.current.stock,buildings:sim.current.buildings.map((b:any)=>({id:b.id,type:b.type,x:b.x,z:b.z,status:b.status})),objectives:sim.current.objectives()})});
    register({name:'build_settlement_facility',title:'시설 건설',description:'현재 진행 중인 게임의 자재와 자금을 사용해 지정한 칸에 시설을 건설합니다.',inputSchema:{type:'object',properties:{type:{type:'string',enum:Object.keys(defs)},x:{type:'integer',minimum:0,maximum:23},z:{type:'integer',minimum:0,maximum:23}},required:['type','x','z'],additionalProperties:false},annotations:{readOnlyHint:false},execute:(input:any)=>{if(!playing.current)throw new Error('게임을 먼저 시작하세요');if(!defs[input.type]||!Number.isInteger(input.x)||!Number.isInteger(input.z))throw new Error('건설 입력을 확인하세요');const r=sim.current.build(input.type,input.x,input.z);if(!r.ok)throw new Error(r.error);persist();repaint();return r;}});
   }
  }).catch(e=>{console.error(e);setError('게임 화면을 불러오지 못했습니다. 다시 열기를 눌러주세요.');});
  const interval=setInterval(()=>{if(!document.hidden)persist();},6000),loadingTimer=setInterval(()=>{setAudioStatus(audio.current?.status||{});},500);
  window.addEventListener('pagehide',persist);
  const hide=async()=>{const c=campaign.current;if(!playing.current||!c)return;if(document.hidden){cancelOffline(c);checkpointOffline(c);persist();resumeRequired.current.add(c.active);c.active.paused=true;audio.current?.suspend();repaint();}else if(c.offline?.running&&!transitionLock.current){await prepareTransition('restore','부재 중 생산을 계산하는 중');try{const r=await catchUpOffline(c,Date.now(),undefined,()=>document.hidden);if(r.seconds||r.stop)toast('부재 중 '+r.seconds+'초 반영 · '+(r.stop||'일시정지 상태로 돌아왔습니다'));persist();repaint();}catch{toast.error('부재 중 계산을 중단했습니다. 저장한 진행에서 다시 확인하세요.');}finally{transitionLock.current=false;setBusy(false);setTransitionArt(null);}}};
  document.addEventListener('visibilitychange',hide);
  const keys=(e:KeyboardEvent)=>{
   // A dialog closes itself on the same Escape before this runs, so its open state is read from the ref (B10).
   if(e.defaultPrevented||dialogOpen.current||document.querySelector('[role=dialog][data-state=open],[role=alertdialog],[data-slot=popover-content][data-state=open]'))return;
   if(!playing.current||transitionLock.current||navigationLock.current||e.repeat||e.ctrlKey||e.metaKey||e.altKey||(e.target as HTMLElement)?.closest('input,select,textarea,[contenteditable="true"],[role="dialog"]'))return;
   if(e.code==='Space'&&(e.target as HTMLElement)?.closest('button'))return;
   if(e.key.toLowerCase()==='b'){e.preventDefault();setWorldSelection(null);setBuildOpen(v=>!v);setSelected(null);setTile(null);setTool(null);scene.current?.setMode(null);scene.current?.select(null);scene.current?.focusProvince(sim.current.provinceId,55);audio.current?.play('open');}
   if(e.code==='Space'){e.preventDefault();setPaused(!sim.current.paused);audio.current.paused=sim.current.paused;audio.current?.interact(sim.current.paused?'pause':'resume');repaint();}
   if(!e.repeat&&['q','e'].includes(e.key.toLowerCase())){scene.current?.rotate(e.key.toLowerCase()==='q'?-1:1);audio.current?.play('rotate');}
   // Escape closes the active placement tool or the bottom selection; dialogs handle their own Escape.
   if(e.key==='Escape'){audio.current?.play('close');const placing=!!scene.current?.mode;setTool(null);scene.current?.setMode(null);setHover(null);if(placing)return;setWorldSelection(null);setBuildOpen(false);setSelected(null);setTile(null);scene.current?.select(null);}
   if(['+','=','-'].includes(e.key)){scene.current?.zoom(e.key==='-'?1/1.15:1.15);audio.current?.play('zoom');}
   if(e.key==='1'||e.key==='2'||e.key==='3'){sim.current.speed=e.key==='3'?4:Number(e.key);audio.current?.play('select');repaint();}
  };
  window.addEventListener('keydown',keys);
  return ()=>{disposed=true;clearInterval(interval);clearInterval(loadingTimer);window.removeEventListener('pagehide',persist);document.removeEventListener('visibilitychange',hide);window.removeEventListener('keydown',keys);scene.current?.toolController?.abort();scene.current?.dispose();audio.current?.dispose();if(exportUrl.current)URL.revokeObjectURL(exportUrl.current);};
 },[]);
 const begin=async(kind:'new'|'demo'|'starter'|'continue'|'trial',trialId?:string)=>{
  if(transitionLock.current||navigationLock.current||!scene.current)return;if(playing.current)persist();toast.dismiss();audio.current?.start();const sameWorld=kind==='new'&&frontScreen==='world'&&scene.current.sim.provinceId===startProvinceId;if(sameWorld){transitionLock.current=true;setBusy(true);}else await prepareTransition(kind==='continue'?'restore':'village');try{
   let nextCampaign;
   if(kind==='trial'){const raw=trialId?null:localStorage.getItem(TRIAL_SAVE_KEY);nextCampaign=trialId?createIndustryTrial(trialId):new Campaign({saved:decodeSave(raw||'')});}
   else if(kind==='continue'){let raw=localStorage.getItem(SAVE_KEY);try{if(!raw)throw new Error();decodeSave(raw);}catch{raw=readRecovery(localStorage);toast('저장 파일에 문제가 있어 마지막 정상 백업을 불러왔습니다.',{duration:7000});}nextCampaign=new Campaign({saved:decodeSave(raw!)});
   }
   else{if(kind==='new'&&saved)backupSave(localStorage);nextCampaign=new Campaign({nation,race,provinceId:startProvinceId,demo:kind==='demo',starter:kind==='starter'});}
   attachTrialReplay(nextCampaign);await Promise.all(nextCampaign.active.availableRaces.map((r:string)=>loadAssets(r)));
   if(kind==='continue'){const r=await catchUpOffline(nextCampaign,Date.now(),undefined,()=>document.hidden);if(r.seconds||r.stop)toast('부재 중 '+r.seconds+'초 반영 · '+(r.stop||'진행을 확인한 뒤 재개하세요'));}campaign.current=nextCampaign;sim.current=nextCampaign.active;setPaused(kind==='continue'||kind==='trial'&&!trialId||document.hidden);setRace(sim.current.race);setNation(sim.current.nation);setTile(null);setIcons(scene.current.icons(sim.current.race));
   if(kind!=='new')playtest.current=null;demoRef.current=kind==='demo'||kind==='starter';playing.current=true;if(kind==='new')seenNotices.current=new Map();else syncNotices(nextCampaign);ledger.current=null;setPromoted(null);setWelcome(false);setBuildOpen(false);setDemo(demoRef.current);setStarterDemo(kind==='starter');setSelected(null);setDialog(null);setWorldSelection(null);scene.current.worldPicking=false;scene.current.setSimulation(sim.current,{preserveCamera:sameWorld});
   // Warm the new town behind the transition picture before the tool, the toasts and the keys come alive (perf: no first-frame stall).
   await scene.current.warmUp?.();if(kind==='starter')scene.current.zoom(1.45);audio.current?.start();audio.current?.setMuted(muted);audio.current?.play(kind==='continue'?'load':'enter');setTool(null);setCategory('base');setHover(null);
   scene.current.setMode(null);
   if(kind==='new'){playtest.current=newPlaytest(sim.current);setTutorialHidden(true);try{localStorage.setItem('orvetharn-tutorial','hidden');}catch{}}
   if(kind==='demo')toast('생산망 시연 · 자유롭게 건설할 수 있습니다. 기존 저장은 유지됩니다.',{duration:5500});
   if(kind==='trial'&&!trialId){toast('멈춘 상태로 불러왔습니다. ▶ 또는 Space로 이어가세요.');}
   else if(kind==='continue'){setSaveState('이어하기 · 재개를 눌러주세요');toast('멈춘 상태로 불러왔습니다. ▶ 또는 Space로 이어가세요.',{duration:5000});}
   if(kind==='starter')toast('초반 마을 테스트 · 건물을 눌러 가동을 바꾸고 Q·E로 회전하세요. 기존 저장은 유지됩니다.',{duration:6000});
   persist();repaint();
  }catch(e:any){toast.error(e.message||'게임을 불러오지 못했습니다. 백업 파일을 확인하세요.');}finally{transitionLock.current=false;setBusy(false);setTransitionArt(null);}
 };
 useEffect(()=>{if(!ready||!welcome||frontScreen!=='world')return;let active=true;setBusy(true);Promise.all((FACTIONS as any)[factionOf(race)].members.map((r:string)=>loadAssets(r))).then(()=>{if(active)setIcons(scene.current.icons(race));}).catch(()=>{if(active)toast.error('종족 자료를 불러오지 못했습니다. 다시 선택해 주세요.');}).finally(()=>{if(active&&!transitionLock.current)setBusy(false);});return()=>{active=false;};},[race,ready,welcome,frontScreen]);
 useEffect(()=>{const sources=[SCREEN_BACKGROUNDS.home,SCREEN_BACKGROUNDS.loading,...TRANSITION_ART.map(art=>art.src)];const timer=window.setTimeout(()=>{for(const src of sources)void warmArtwork(src);},ready?600:0);return()=>window.clearTimeout(timer);},[ready]);
 useEffect(()=>{if(!welcome)setFrontScreen('home');},[welcome]);
 useEffect(()=>{if(scene.current)scene.current.active=!welcome||frontScreen==='world';if(welcome){toast.dismiss();if(audio.current)audio.current.paused=true;}},[welcome,ready,frontScreen]);
 useEffect(()=>{audio.current?.setPresentation(welcome?(frontScreen==='title'?'evening':frontScreen==='world'?'wind':homeAmbience):null);},[welcome,frontScreen,homeAmbience,ready]);
 useEffect(()=>{
  const a=audio.current;if(!a)return;
  if(welcome&&frontScreen==='world')a.setLocation({nation:worldStage==='country'?nation:(PLOT_INDEX.get(startProvinceId||'')?.nation??null),ecology:startProvinceId?layoutOf(startProvinceId).ecology:null,country:worldStage==='country',world:false});
  a.setInterface(welcome?(frontScreen==='home'&&homeGallery?'gallery':frontScreen):'game',confirmNew?'confirm':dialog,{loading:(busy||!ready)&&frontScreen!=='title',error:!!error||contextLost,building:!welcome&&(buildOpen||!!tool),facility:!welcome&&selected!==null});
 },[welcome,frontScreen,homeGallery,dialog,ready,busy,error,contextLost,confirmNew,buildOpen,tool,selected,nation,startProvinceId,worldStage]);
 const chooseNation=(id:string)=>{setNation(id);setStartProvinceId(defaultStartingProvince(id)?.id||null);if(playableRace((NATIONS as any)[id].race))setRace(factionOf((NATIONS as any)[id].race));audio.current?.interact('nation');};
 const chooseRace=(id:string)=>{setRace(id);audio.current?.interact('select');};
 const visitSite=async(id:string)=>{const target=campaign.current.sites.find((site:any)=>site.id===id);if(!target||id===campaign.current.activeId||transitionLock.current||navigationLock.current)return;transitionLock.current=true;try{await Promise.all(target.sim.availableRaces.map((r:string)=>loadAssets(r)));if(!campaign.current.switchSite(id).ok)return;sim.current=campaign.current.active;setPaused(true);sim.current.soundEvents.length=0;syncNotices();scene.current.setSimulation(sim.current,{preserveCamera:true});scene.current.focusProvince(target.provinceId,55);setIcons(scene.current.icons(sim.current.race));audio.current?.play('enter');setBuildOpen(false);setSelected(null);setTile(null);setTool(null);setWorldSelection(null);setDialog(null);persist();repaint();}catch{toast.error('거점을 불러오지 못했습니다. 다시 시도하세요.');}finally{transitionLock.current=false;}};
 useEffect(()=>setDemolishArm(null),[selected]);
 useEffect(()=>{if(selected===null&&dialog==='facility')setDialog(null);},[selected,dialog]);
 useEffect(()=>{if((!dialog&&!busy&&!navigation)||!playing.current||!sim.current)return;const current=sim.current,paused=current.paused;current.paused=true;audio.current.paused=true;return()=>{if(sim.current===current&&playing.current)current.paused=document.hidden||!!scene.current?.contextLost||resumeRequired.current.has(current)||paused;};},[dialog,busy,navigation]);
 useEffect(()=>{if(dialog!==previousDialog.current){audio.current?.play(dialog?'open':'close');previousDialog.current=dialog;}},[dialog]);
 const s=sim.current,b=s?.buildings.find((v:any)=>v.id===selected),d=b?defs[b.type]:null;
 const selectedProduction=b?productionVisualState(b.type,b,s):null;
 // G3-11: why the specialisation crew cannot be hired now (rules' specializeShort), or '' when it can.
 const specialShort=b&&s?(s.specializeShort?s.specializeShort(b,b.race)||'':s.money<s.specializeCost(b)||s.availableStock('plank')<2?'특화 작업조 재료가 부족합니다':''):'';
 dialogOpen.current=!!dialog||confirmNew;if(dialog)shownDialog.current=dialog;const view=dialog||shownDialog.current;
 // Money trend for the operations card (J1-4): the last two finished days both lost money, or the purse is already empty.
 const falling=!!s&&!demo&&(s.money<0||((ledger.current?.sim===s)&&(ledger.current?.history||[]).length>=2&&ledger.current!.history.slice(-2).every(v=>v<0)));
 const refund=b?demolishRefund(s,b):null;
 // What the selected facility makes now: its chosen product for multi-product facilities.
 const made=b?s.recipeOf?.(b)?.output||d?.output:null;
 const promotion=s?.promotion();
 // G3-13: after 패권국 the gauge follows the closest continental record instead of staying full.
 const legacy=!promotion&&!demo?campaign.current?.legacy?.():null,rankProgress=promotion?promotionProgress(s,promotion):legacy?.active?Math.max(0,...legacy.goals.map((g:any)=>Math.min(99,Math.floor(g.current/g.target*100)))):100;
 const guide=s&&!demo&&!tutorialHidden&&s.rank<2?tutorialStep(s):null;guideOn.current=!!guide&&dialog==='operations';
 const exportStop=s?exportBlocked(s):null;
 const cancel=()=>{pickTool(null);setTile(null);setSelected(null);scene.current?.select(null);};
 // Rank-up moment (B5): the simulation plays the fanfare; the screen shows what the new rank opened. The top rank opens the
 // run summary instead (A2-E1), with the campaign's own record when it keeps one.
 // K-01: the condition buttons inside the rank dialog leave it for the tool, the market or the world window.
 const goalProps={onTool:(name:string)=>{setDialog(null);pickTool(name);},onMarket:()=>setDialog('trade'),onWorld:()=>setDialog('world'),onGoals:()=>document.querySelector('.rescue-chapter')?.scrollIntoView({block:'center'}),onAction:(r:any,k?:string)=>act(r,k||''),onSpeed:()=>{if(!s)return;s.speed=4;setDialog(null);setTimeout(()=>{if(!document.hidden&&!scene.current?.contextLost)setPaused(false);repaint();},0);}};
 const promote=()=>{const right=s.promotion()?.trial?.right||'';if(!act(s.promote(),''))return;const rank=sim.current.rank,c=campaign.current;
  if(rank>=RANKS.length-1){const record=c?.completion||c?.finale||{};setPromoted({rank,final:true,day:record.day??s.day,revenue:record.revenue??s.totalRevenue??0,produced:record.produced??Object.values(s.produced||{}).reduce((n:number,v:any)=>n+(+v||0),0),sites:record.sites??c?.sites.length??1,sold:record.sold,contracts:record.contracts});setDialog('finale');return;}
  setPromoted({rank,right,unlocked:unlockedAt(sim.current,rank)});setDialog('promoted');};
 const demolish=(target:any)=>{if(demolishArm!==target.id){setDemolishArm(target.id);audio.current?.click();return;}setDemolishArm(null);if(act(s.demolish(target.x,target.z),'demolish'))cancel();};
 const repairButton=(target:any)=>{const cost=s.repairCost(target);return <><Button size="sm" disabled={s.money<cost} onClick={()=>act(s.repair(target.id),'repair')}>수리 · {cost}G</Button><ShortFunds sim={s} need={cost} onAction={act} onMarket={()=>setDialog('trade')}/></>;};
 const toggleSound=()=>{const a=audio.current;if(!a)return;const v=a.context?.state==='running'&&!a.muted;setMuted(v);a.setMuted(v);if(!v)void a.start()?.then(()=>setAudioStatus(a.status));setAudioStatus(a.status);};
 const openBuild=()=>{setWorldSelection(null);setBuildOpen(v=>!v);setSelected(null);setTile(null);setTool(null);scene.current?.setMode(null);scene.current?.select(null);};
 const chooseBuild=(name:string)=>{if(tile&&s.ownedAt(tile.x,tile.z)&&tile.terrain!=='water'){const result=s.build(name,tile.x,tile.z);if(act(result,'build')){setBuildOpen(false);setTile(null);if(!guideOn.current){setSelected(result.id);scene.current.select(result.id);}}return;}pickTool(name);};
 const facilityDetails=b&&d?(<aside className="facility-inspector" key={b.id} aria-label={d.name+' 운영'}>

    <div className="facility-main"><img className="facility-model" src={icons[b.type]} alt=""/><div className="facility-summary"><span className="facility-level">Lv.{b.level||1}</span><StatusBadge className="facility-status" tone={b.enabled===false?'neutral':blockHint(b.status,s)?'warning':'success'}>{b.enabled===false?'가동 중지':b.status}</StatusBadge>
    {d.period?<><div className="recipe">{Object.entries(s.effectiveInputs(b)).map(([r,n]:any)=><span key={r} className={(b.inputs[r]||0)<n?'missing':''} title={resources[r].name}><ResourceIcon name={r} size={19}/>{b.inputs[r]||0}/{n}</span>)}{Object.keys(s.effectiveInputs(b)).length>0&&<ArrowRight size={16}/>}<span title={resources[made]?.name}><ResourceIcon name={made} size={21}/>{selectedProduction?.outputName}{selectedProduction&&<b>{selectedProduction.displayValue}</b>}</span></div><Progress value={(selectedProduction?.displayProgress??b.progress)*100} className="production-progress" aria-label="생산 진행"/></>:<p>{['warehouse','depot'].includes(b.type)?'주민이 이곳의 재고를 운반합니다.':describeFacility(b.type,s,b)}</p>}
    </div></div>
    {d.power&&(b.level||1)<3&&<p className="power-upgrade-preview">Lv.{(b.level||1)+1} 개선 후 {powerPreview(s,b.type,b.x,b.z,(b.level||1)+1,b.id)?.text}</p>}{(d.power||d.output==='power'||b.type==='substation')&&(()=>{const grid=s.gridStatus(),group=grid.assigned.get(b.id)||grid.groups.find((g:any)=>g.nodes.some((n:any)=>n.id===b.id));return <p className="power-summary">{d.output==='power'?'발전 용량 '+Number(powerSupply(b).toFixed(1)):d.power?'필요 전력 '+powerDemand(b):'전력 중계'} · 연결망 공급 {(group?.supply||0).toFixed(1)} / 수요 {(group?.demand||0).toFixed(1)} · 전력 부족 시 작업 순서가 높은 시설부터 공급</p>;})()}
    {recipeChoices(s,b).length>0&&<div className="recipe-picker" role="group" aria-label="생산 제품">{recipeChoices(s,b).map((r:any)=><button key={r.id} className={r.current?'current':''} aria-pressed={r.current} disabled={!!r.locked} aria-label={r.name+' 생산 · '+(r.locked||r.chain)} onClick={()=>{if(!r.current)act(s.setRecipe(b.id,r.id));}}>
     <span className="recipe-name"><ResourceIcon name={r.output} size={20}/><strong>{r.name}</strong></span>
     {r.locked?<small className="recipe-lock"><Lock size={12}/>{r.locked}</small>:<small className="recipe-flow">{Object.entries(r.inputs||{}).map(([k,n]:any)=><span key={k}><ResourceIcon name={k} size={13}/>{n}</span>)}{Object.keys(r.inputs||{}).length>0&&<ArrowRight size={11}/>}<span><ResourceIcon name={r.output} size={13}/>{r.amount}</span></small>}
    </button>)}</div>}
    {blockHint(b.status,s)&&<p className="facility-advice"><CircleAlert size={15}/>{/* K-06: the cause-specific advice (supply vs path) */productionDiagnosis(s,b,BUILDINGS,RESOURCES)?.text||blockHint(b.status,s)}</p>}
    {['warehouse','depot'].includes(b.type)&&<StoragePanel sim={s} store={b} onAction={act}/>}<div className="facility-quick-actions"><Button size="sm" variant="outline" disabled={b.movingUntil>s.time} onClick={()=>{setDialog(null);pickTool(b.type);scene.current.relocatingId=b.id;}}>이전 · {s.relocationCost(b)}G</Button>{(d.period||['logistics','station','battery','clinic'].includes(b.type))&&<Button size="sm" variant={b.enabled===false?'default':'secondary'} onClick={()=>act(s.setOperation(b.id,b.enabled===false),b.enabled===false?'pause':'resume')}>{b.enabled===false?<Play size={15}/>:<Pause size={15}/>} {b.enabled===false?'가동':'가동 중지'}</Button>}{b.type==='warehouse'&&<Button size="sm" onClick={()=>setDialog('trade')}><Package size={16}/>재고·판매</Button>}{b.health<100&&repairButton(b)}<span className="facility-durability">내구도 {Math.round(b.health)}%</span>{refund&&<Button size="sm" variant="outline" className={'demolish-action'+(demolishArm===b.id?' armed':'')} aria-label={(demolishArm===b.id?'철거 확인 · ':'철거 · ')+refund.money+'G'+(refund.full?'와 재료 전액':'')+' 환불'} onClick={()=>demolish(b)}><Trash2 size={14}/>{demolishArm===b.id?'한 번 더 눌러 철거':'철거'} · +{format(refund.money)}G{refund.full?' · 재료 전액 · '+remainingSeconds(b.refundUntil-s.time,s)+'초':''}</Button>}</div>
    {s.upgradeQuote(b)&&(()=>{const q=s.upgradeQuote(b),short=s.upgradeShort(b);return <div className="building-actions facility-upgrade" aria-label="시설 업그레이드"><Button variant="outline" disabled={!!short} onClick={()=>act(s.upgrade(b.id),'upgrade')}>Lv.{q.level} → Lv.{q.nextLevel} · {q.label} {q.from} → {q.to}<small>{q.money}G · {resources[q.item]?.name} {Math.floor(s.availableStock(q.item))}/{q.quantity}</small></Button>{short&&<small className="action-short" role="note">{short}</small>}</div>;})()}
    {Object.entries(b.returnStock||{}).some(([,n]:any)=>n>0)&&<div className="recipe" aria-label="반환 자재 운반 대기"><span>운반 대기</span>{Object.entries(b.returnStock).filter(([,n]:any)=>n>0).map(([item,n]:any)=><span key={item}><ResourceIcon name={item} size={18}/>{resources[item]?.name} {n}</span>)}</div>}
    <details className="facility-details"><summary>효율·개선·특화 <ChevronRight size={15}/></summary><div className="facility-details-body">
    <p>{describeFacility(b.type,s,b)}</p>{d.period&&<div className="placement-effects">{(()=>{const e=s.placementEffects(b.type,b.x,b.z);return <>{e.road&&<span className="positive">도로 인접 · 운반 빠름</span>}{slowNotes(b.type,e,true).map(n=><span key={n.text} className={n.tone}>{n.text}</span>)}{effectNotes(b.type,e).map(n=><span key={n.text} className={n.tone}>{n.text}</span>)}<strong>생산 효율 {Math.round(e.speed*s.tileMultiplier(b.type,b.x,b.z)*100)}%</strong></>})()}</div>}
    <div className="operation-controls">{d.period&&<label>작업 순서<select aria-label="작업 우선순위" value={b.priority??1} onChange={e=>act(s.setOperation(b.id,undefined,+e.target.value))}><option value={0}>낮음</option><option value={1}>보통</option><option value={2}>우선</option></select></label>}</div>
    <div className="specialty-control"><strong>{b.specialized?(RACES as any)[b.race].specialty.name:'특화 작업 방식'}</strong><span>{(RACES as any)[b.race].specialty.text}</span><div><select aria-label="시설 특화 작업반" disabled={!!itemGate(s,'plank',2)} defaultValue={b.race} key={b.id+':'+b.race} onChange={e=>{if(act(s.specialize(b.id,e.target.value),'success'))scene.current.rebuild();}}>{s.availableRaces.map((r:string)=><option key={r} value={r}>{(RACES as any)[r].name}</option>)}</select><Button size="sm" variant="outline" disabled={b.specialized||!!itemGate(s,'plank',2)||!!specialShort} onClick={()=>act(s.specialize(b.id,b.race),'success')}>{b.specialized?'적용 중':itemGate(s,'plank',2)?'판재 · '+itemGate(s,'plank',2):'특화 · '+format(s.specializeCost(b))+'G + 판재 2'}</Button></div><small className={!b.specialized&&specialShort&&!itemGate(s,'plank',2)?'action-short':undefined}>{!b.specialized&&specialShort&&!itemGate(s,'plank',2)?specialShort:'특화 유지비 하루 2G'}</small></div>

    </div></details>
   </aside>):null;
 return <main className={'game-shell minimal-game '+(!welcome?'is-playing ':'')+(buildOpen?'catalog-open ':'')+(b?'facility-open ':'')+(tool?'placing':'')} data-audio-state={audioStatus.state} data-audio-level={audioStatus.rms||0} {...interfaceAudio(audio)}>

  <input ref={importInput} className="sr-only" aria-label="저장 파일 불러오기" type="file" accept=".json,application/json" onChange={e=>{const f=e.target.files?.[0];if(f)importGame(f);e.target.value='';}}/>
  <div ref={mount} className="world-canvas"/>
  <div className="vignette" aria-hidden="true"/>
  {!welcome&&s&&<MinimalHud sim={s} urgent={!!(saveFailed||s.money<0||s.pendingEvent||s.sanctionUntil>s.time||s.health.infection>0||promotion?.ready)} onDialog={setDialog} onPause={()=>{setPaused(!s.paused);audio.current.paused=s.paused;audio.current?.interact(s.paused?'pause':'resume');repaint();}} onSpeed={speed=>{s.speed=speed;setPaused(false);repaint();}}/>}
  {welcome&&frontScreen==='title'&&!error&&<TitleScreen onEnter={()=>{audio.current?.start();navigateFront('home');}} muted={muted} soundReady={audioStatus.state==='running'} onSound={toggleSound}/>}
  {!ready&&!error&&frontScreen!=='title'&&<LoadingScreen/>}
  {error&&<ScreenError title="마을을 열지 못했습니다" message={error} onRetry={()=>location.reload()}/>}
  {welcome&&ready&&frontScreen==='home'&&<HomeScreen saved={saved} busy={busy} muted={muted} soundReady={audioStatus.state==='running'} onArtChange={onHomeArt} onGalleryChange={setHomeGallery} onContinue={()=>begin('continue')} onNew={()=>navigateFront('world')} onImport={()=>importInput.current?.click()} onSettings={()=>setDialog('settings')} onTrials={()=>setDialog('trials')} onCommunity={()=>setDialog('community')} onStarter={()=>begin('starter')} onDemo={()=>begin('demo')} onSound={toggleSound} onTitle={()=>navigateFront('title')}/>}
  {welcome&&ready&&frontScreen==='world'&&<><WorldMap scene={scene.current} onSound={(type:string)=>audio.current?.play(type)} onStageChange={setWorldStage} nation={nation} race={race} startProvinceId={startProvinceId} onStartProvince={(id:string|null)=>{setStartProvinceId(id);if(id)audio.current?.play('plot');}} onNation={chooseNation} onRace={chooseRace} onBegin={(kind:any)=>{if(kind==='new'&&saved)setConfirmNew(true);else begin(kind);}} saved={saved} busy={busy} icons={icons} onImport={()=>importInput.current?.click()} onBackup={()=>restoreBackup(true)} onHome={()=>navigateFront('home')}/></>}
  {!welcome&&s&&<>
   <WorldViewControls scene={scene.current} selectedId={worldSelection} onPlot={setWorldSelection} onManage={()=>setDialog('world')}/>
   {worldSelection&&<WorldPlotPanel id={worldSelection} campaign={campaign.current} scene={scene.current} onVisit={visitSite} onAction={r=>{act(r,'success');if(r.ok){scene.current.landscape.lastKey=null;scene.current.landscape.makeBorders();}}} onClose={()=>{setWorldSelection(null);scene.current.landscape?.select(s.provinceId);}}/>}
   {/* The default map shows faults and hovered facilities. Nearby markers merge. */}
   <div ref={el=>{if(scene.current)scene.current.markerLayer=el;}} className={'facility-labels '+(!labels?'minimal':'')} aria-label="시설 현황">{clusterMarkers(markers.flatMap((m:any)=>{
    const building=s.buildings.find((v:any)=>v.id===m.id);if(!building)return [];
    const production=productionVisualState(m.type,building,s),cut=!!exportStop&&building.id===s.warehouse?.id,fault=cut||building.enabled!==false&&!!blockHint(m.status,s);
    const hovered=hover?.x===building.x&&hover?.z===building.z,chosen=selected===m.id;
    // Selection uses the bottom dock; completed goods already appear on the building itself.
    if(!labels&&(!fault&&!hovered||chosen))return [];
    // Rough on-screen width (11 px glyphs, icon and count), capped like the marker's max-width, so wide labels merge too.
    // K-09: with names off a fault or a finished-goods marker still shows its short text, so it is wider than an icon.
    const w=labels?Math.min(170,44+11*(defs[m.type].name.length+(production?.label||m.status||'').length+3)):fault||production?.phase==='ready'?Math.min(phone?91:150,40+11*(fault?(m.status||'').length:(production?.label||'').length)):56;
    return [{...m,building,production,cut,fault,hovered,chosen,w,solo:chosen||hovered,rank:chosen?4:fault?3:hovered?2:production?.phase==='ready'?1:0}];
   })).map(({lead:m,members})=>{
    const def=defs[m.type],building=m.building,production=m.production,status=m.cut?'수출길 막힘':m.status,fault=m.fault;
    const description=(production?def.name+' · '+production.label+' · '+production.outputName+' '+production.displayValue+(production.service?'':'개')+(production.working&&!production.active?' · '+Math.floor(production.progress*100)+'%':'')+' · '+status:def.name+' · '+status)+(members.length?' 외 '+members.length+'곳':'');
    return <button key={m.id} data-building-id={m.id} data-production={production?.phase} data-output={production?.count} className={'facility-marker '+(m.working?'working':'waiting')+(production?' production':'')+(production?.ready?' ready':'')+(fault?' fault':'')+(m.chosen?' chosen':'')+(m.hovered?' hovered':'')} aria-label={description} title={description} onClick={()=>{setSelected(m.id);setTile(null);pickTool(null);scene.current.select(m.id);audio.current?.play(m.type);}}>
     <ResourceIcon name={(building&&s.recipeOf?.(building)?.output)||def.output||m.type} size={16}/>
     {production?<><b className="output-count">{production.displayValue}</b><span>{labels?def.name+' · ':''}{production.label}</span></>:<span>{fault?status:def.name}</span>}
     {fault&&<CircleAlert size={13}/>}
     {members.length>0&&<em className="marker-more" aria-hidden="true">+{members.length}</em>}
     <i style={{width:(production?.displayProgress??building?.progress??0)*100+'%'}}/>
    </button>;
   })}</div>
   {assetStatus.failed.length>0&&<button className="asset-warning" onClick={()=>{setBusy(true);Promise.all([...s.availableRaces,'demon','orc','beast','goblin','dragon','aquatic'].map(r=>loadAssets(r))).then(()=>{scene.current.iconCache?.clear();setIcons(scene.current.icons(s.race));scene.current.rebuild();setBusy(false);repaint();});}}>일부 에셋 재시도 · {assetStatus.failed.length}개</button>}
   {tool&&<div className={'placement-hint minimal-bottom '+(hover?.error?'invalid':'')}>
    {tool==='expand'?<><Grid2X2Plus size={17}/><strong>인접 구역 16칸 확보</strong><span>{format(s.expansionCost())}G · 16칸</span></>:tool==='bulldoze'?<><Trash2 size={17}/><strong>철거할 시설 선택</strong><span>짓고 바로 철거하면 전액 · 이후 40% 반환</span></>:<><Hammer size={17}/><strong>{defs[tool]?.name} {scene.current?.relocatingId?'이전':'배치'}</strong><span>{hover?.error||`${scene.current?.relocatingId?s.relocationCost(s.buildings.find((v:any)=>v.id===scene.current.relocatingId)):s.buildCost(tool)}G${!scene.current?.relocatingId&&hover&&s.clearCost(hover.x,hover.z,tool)?' · 부지 정리 '+s.clearCost(hover.x,hover.z,tool)+'G':''} · 1타일${Object.entries(scene.current?.relocatingId?{}:defs[tool]?.materials||{}).map(([r,n])=>' · '+resources[r].name+' '+n).join('')}`}</span></>}
    {defs[tool]&&hover&&!hover.error&&<div className="placement-effects compact">{(()=>{const e=s.placementEffects(tool,hover.x,hover.z);return <>{!defs[tool].terrain&&<><b>생산 효율 {Math.round(e.speed*s.tileMultiplier(tool,hover.x,hover.z)*100)}%</b>{/* K-08: a road helps; a missing exit is the placement error above, so nothing is said otherwise */e.road&&<span className="positive">도로 인접 · 운반 빠름</span>}</>}{defs[tool].power&&<span>{powerPreview(s,tool,hover.x,hover.z)?.text}</span>}{effectNotes(tool,e).map(n=><span key={n.text} className={n.tone}>{n.text}</span>)}{!defs[tool].terrain&&slowNotes(tool,e).map(n=><span key={n.text} className={n.tone}>{n.text}</span>)}</>})()}</div>}<button aria-label="배치 취소" onClick={()=>pickTool(null)}><X size={16}/></button>
   </div>}
   {b&&d&&!tool&&!buildOpen&&<MinimalFacilityDock sim={s} building={b} definition={d} production={selectedProduction} onOperation={()=>act(s.setOperation(b.id,b.enabled===false),b.enabled===false?'pause':'resume')} onDetails={()=>setDialog('facility')} onClose={cancel}/>}
   {!buildOpen&&!tool&&!b&&!tile&&!worldSelection&&<nav className="town-actions minimal-bottom" aria-label="마을 운영"><button className="market-action" aria-label="시장" onClick={()=>setDialog('trade')}><ShoppingBag size={21}/><span>시장</span></button><button className="build-action" aria-label="건설 목록 열기" aria-expanded={false} onClick={()=>{setWorldSelection(null);scene.current.focusProvince(s.provinceId,55);openBuild();}}><Hammer size={22}/><span>건설</span></button><button aria-label="거점·세계 지도" onClick={()=>{setWorldSelection(null);scene.current.showWorld();}}><Globe2 size={21}/><span>세계</span></button></nav>}
   {buildOpen&&<footer className="minimal-construction minimal-bottom" aria-label="건설 목록">
    <div className="minimal-build-header"><Tabs value={['farm','craft','industry','energy','advanced'].includes(category)?'production':['home','civic'].includes(category)?'town':category} onValueChange={v=>{setCategory(v);audio.current?.click();}}><TabsList variant="line" aria-label="건설 분류"><TabsTrigger value="base">기초</TabsTrigger><TabsTrigger value="town">주거·도시</TabsTrigger><TabsTrigger value="production">생산</TabsTrigger><TabsTrigger value="transport">운송</TabsTrigger></TabsList></Tabs><select className="minimal-build-filter" aria-label="전체 건설 분류" value="" onChange={e=>setCategory(e.target.value)}><option value="" disabled>전체</option><option value="all">모든 시설 · 잠김 포함</option>{GROUPS.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select><button className="minimal-close" aria-label="건설 목록 닫기" onClick={cancel}><X size={20}/><kbd>Esc</kbd></button></div>
    <div className="minimal-build-items" onWheel={e=>{const el=e.currentTarget;if(Math.abs(e.deltaY)>Math.abs(e.deltaX)&&el.scrollWidth>el.clientWidth)el.scrollLeft+=e.deltaY;}}>{Object.entries(defs).filter(([id,d]:any)=>offered(s,id)&&(category==='all'||s.rank>=unlockRank(id))&&(category==='all'||(category==='production'?['farm','craft','industry','energy','advanced'].includes(d.group):category==='town'?['home','civic'].includes(d.group):d.group===category))).sort(([a],[b])=>unlockRank(a)-unlockRank(b)).map(([id,v]:any)=>{
     const locked=s.rank<unlockRank(id);const cannotAfford=s.money<s.buildCost(id)||Object.entries(v.materials||{}).some(([r,n]:any)=>s.availableStock(r)<n);const exists=v.unique&&s.buildings.some((b:any)=>b.type===id);
     return <BuildingCard key={id} name={v.name} image={icons[id]} selected={tool===id} locked={locked} built={!!exists} lockReason={RANKS[unlockRank(id)].name+' 승급 시 열림'} price={<><Coins size={14}/> {format(s.buildCost(id))}</>} className={cannotAfford?'unaffordable':''} aria-label={v.name+' 건설'} onClick={()=>chooseBuild(id)} title={v.name+' · '+(locked?RANKS[unlockRank(id)].name+' 승급 필요 · ':'')+describeFacility(id,s)+(v.materials?' · '+Object.entries(v.materials).map(([r,n])=>resources[r].name+' '+n).join(' / '):'')}>
     </BuildingCard>;
    })}</div>
   </footer>}
   {overlay&&<div className="soil-legend panel">{({fertility:'비옥도',moisture:'수분',ore:'광물량',oil:'원유 농도',mana:'마력 농도',pollution:'오염',shade:'그늘',power:'전력망'} as any)[overlay]}{overlay==='power'?<><span style={{color:'#68be91'}}>여유</span><span style={{color:'#e3c66f'}}>적음</span><span style={{color:'#de9270'}}>가득</span><span style={{color:'#cf6762'}}>부족</span><span style={{color:'#8a8e8c'}}>연결 없음</span></>:<><span>낮음</span><i className={overlay}/><span>높음</span></>}</div>}
   {tile&&!b&&!tool&&!buildOpen&&<aside className="tile-panel minimal-bottom"><button aria-label="타일 정보 닫기" onClick={cancel}><X size={16}/></button><strong>{tileLandscape(s,tile).name} · {tile.x+1}, {tile.z+1}</strong><p className="tile-landscape">{tileLandscape(s,tile).detail}</p>{tile.terrain!=='water'&&<>{s.ownedAt(tile.x,tile.z)?<Button className="tile-build" onClick={()=>setBuildOpen(true)}><Hammer size={18}/>여기에 건설</Button>:<Button className="tile-build" onClick={()=>pickTool('expand')}><Grid2X2Plus size={18}/>영토 확장</Button>}{(()=>{const sale=s.landSaleOffer?.(tile.x,tile.z);return sale&&<Button className="land-sale" variant="outline" onClick={()=>{if(act(s.sellLand(tile.x,tile.z),'success'))setTile({...s.tile(tile.x,tile.z)});}}><Coins size={16}/>{sale.name} 매각 · +{sale.money}G<small> · {sale.note}</small></Button>;})()}{(()=>{const metrics=tileMetrics(s,tile),icon=(id:string)=>id==='field'?<Wheat size={16}/>:id==='well'?<Droplets size={16}/>:id==='quarry'?<Mountain size={16}/>:null,row=(m:any)=><div key={m.id}>{icon(m.id)}{m.label} <b>{m.value}</b></div>,later=metrics.filter(m=>!m.now);return <>{metrics.filter(m=>m.now).map(row)}{later.length>0&&<details className="tile-more"><summary>더 보기 · 나중에 쓰는 수치 {later.length}개</summary>{later.map(row)}</details>}</>;})()}{tile.nature==='sapling'?<p>묘목 성장 중 · 약 {Math.max(0,Math.ceil((tile.growAt-s.time)/80))}일</p>:tile.nature?<p>{tile.nature==='tree'?'목재':'석재'} 매장량 {Math.ceil(tile.remaining)}</p>:s.ownedAt(tile.x,tile.z)&&<><Button size="sm" variant="outline" disabled={!!s.plantShort?.(tile.x,tile.z)} onClick={()=>act(s.plant(tile.x,tile.z),'plant')}>나무 심기 · 15G + 물 2</Button><CostShort sim={s} text={s.plantShort?.(tile.x,tile.z)} price={ACTION_PRICES.plant} onAction={act} onMarket={()=>setDialog('trade')}/></>}</>}</aside>}
  </>}
  {!welcome&&!campaign.current?.trial&&!dialog&&!tool&&!buildOpen&&!selected&&!tile&&!worldSelection&&s&&<FocusNext sim={s} onOpen={view=>view==='build'?openBuild():setDialog(view)}/>}
  {!welcome&&campaign.current?.trial&&<IndustryTrialStatus campaign={campaign.current} onRetry={(id:string)=>begin('trial',id)} onList={()=>setDialog('trials')}/>}
  <Dialog open={!!dialog} onOpenChange={open=>!open&&setDialog(null)}><DialogContent className={'game-dialog town-dialog minimal-dialog ui-view-'+view+' '+(view==='menu'?'minimal-menu-dialog':view==='facility'?'facility-dialog':view==='trade'?'trade-dialog':view==='world'?'campaign-dialog':view==='promoted'||view==='finale'?'moment-dialog':view==='ledger'?'ledger-dialog':'')}>
   <DialogTitle><span className="title-seal" aria-hidden="true">{view==='world'?<Globe2/>:view==='trade'?<ShoppingBag/>:view==='goals'?<Flag/>:view==='residents'?<Users/>:view==='settings'?<Settings2/>:view==='ledger'?<BarChart3/>:view==='promoted'?<Flag/>:view==='finale'?<Trophy/>:view==='league'?<Star/>:view==='haul'?<Truck/>:<HelpCircle/>}</span><span>{view==='playtest'?'플레이 점검 기록':view==='community'?'온라인·서버 저장':view==='trials'?'산업 도전':view==='menu'?'메뉴':view==='operations'?'생산·위기':view==='terrain'?'주변 지형':view==='map-tools'?'지도 도구':view==='facility'?(d?.name||'시설 상세') : view==='world'?'이르데아':view==='trade'?'시장':view==='goals'?'신분과 권한':view==='settings'?'설정':view==='residents'?'주민':view==='credits'?'제작 에셋':view==='ledger'?'장부':view==='league'?'도전·순위':view==='haul'?'운반·보관':view==='promoted'?'승급':view==='finale'?'패권국 달성':'조작법'}</span></DialogTitle>
   <DialogDescription className="sr-only">{({menu:'목표, 주민, 지도 도구와 설정을 엽니다.',operations:'생산 문제와 납품, 다가오는 사건에 대응합니다.',terrain:'네 방향의 지형과 자원을 봅니다.','map-tools':'지형 표시와 카메라, 철거 도구를 사용합니다.',facility:'시설의 재고, 제품, 이전, 수리와 개선을 관리합니다.',ledger:'하루 수지와 품목별 생산·판매를 봅니다.',league:'오늘의 도전, 주간 교역 순위, 계절 축제와 이웃 선물을 봅니다.',haul:'운반 장비와 상품별 보관 상한을 정합니다.',promoted:'승급으로 새로 열린 시설입니다.',finale:'패권국에 도달한 기록입니다.',trade:'창고 재고를 팔거나 수입합니다.',goals:'승급 조건과 납품, 채무를 관리합니다.',world:'거점, 운송망, 외교를 관리합니다.',residents:'주택에 사는 주민을 봅니다.',settings:'소리, 화면, 저장을 설정합니다.',credits:'사용한 에셋의 출처입니다.'} as any)[view||'']||'조작법을 봅니다.'}</DialogDescription>
   {view==='menu'&&s&&<div className="minimal-menu"><p className="minimal-site-name">{campaign.current?.sites.find((v:any)=>v.id===campaign.current.activeId)?.name} · {(NATIONS as any)[s.nation].name}</p><div className="minimal-menu-grid">
    <button onClick={()=>setDialog('goals')}><Flag size={19}/><span>목표·납품<small>{promotion?.ready?'승급 가능':RANKS[s.rank].name+' · '+rankProgress+'%'}</small></span></button>
    <button onClick={()=>setDialog('operations')}><Factory size={19}/><span>생산·위기<small>{saveFailed?'자동 저장 실패':s.pendingEvent?s.eventName(s.pendingEvent.type):'가동 상태와 소식'}</small></span></button>
    <button aria-label="주민" onClick={()=>setDialog('residents')}><Users size={19}/><span>주민<small>{s.workerCount}명</small></span></button>
    <button onClick={()=>{savePlaytest(localStorage,playtest.current);setDialog('playtest');}}><Flag size={19}/><span>플레이 점검 기록<small>첫 건설·판매·승급 시간</small></span></button>
    <button onClick={()=>setDialog('community')}><Globe2 size={19}/><span>온라인·서버 저장<small>사람끼리 순위·상회</small></span></button>
    <button onClick={()=>setDialog('ledger')}><BarChart3 size={19}/><span>장부<small>생산·판매·하루 수지</small></span></button>
    {campaign.current?.league&&<button onClick={()=>setDialog('league')}><Star size={19}/><span>도전·순위<small>{campaign.current.league.daily.done?'오늘 도전 달성':'오늘 별 '+Math.max(0,campaign.current.league.total-campaign.current.league.daily.from).toLocaleString('ko-KR')+' / '+campaign.current.league.daily.goal.toLocaleString('ko-KR')}</small></span></button>}
    <button onClick={()=>setDialog('haul')}><Truck size={19}/><span>운반·보관<small>장비 · 보관 상한</small></span></button>
    <button aria-label="영토 확장" onClick={()=>{setDialog(null);pickTool('expand');}}><Grid2X2Plus size={19}/><span>영토 확장<small>인접 구역 · {format(s.expansionCost())}G</small></span></button>
    <button onClick={()=>setDialog('terrain')}><Mountain size={19}/><span>주변 지형<small>네 방향의 자원</small></span></button>
    <button onClick={()=>setDialog('map-tools')}><Layers size={19}/><span>지도 도구<small>회전·토질·철거</small></span></button>
    <button aria-label="게임 설정" onClick={()=>setDialog('settings')}><Settings2 size={19}/><span>설정<small>소리·화면·저장</small></span></button>
   </div><div className="minimal-menu-links"><button onClick={()=>setDialog('help')}><HelpCircle size={16}/>조작법</button><button onClick={()=>{persist();setDialog(null);navigate(()=>{setWelcome(true);playing.current=false;sim.current.paused=true;pickTool(null);},'home','마을의 하루로');}}>시작 화면<ArrowUpRight size={15}/></button></div>{demo&&<p className="minimal-demo-note">{starterDemo?'초반 마을 테스트':'생산망 시연'} · 자동 저장 안 함{!starterDemo&&<button onClick={()=>{s.pendingEvent={type:'raid',at:s.time+6};setDialog(null);setTimeout(()=>{if(!document.hidden&&!scene.current?.contextLost)setPaused(false);repaint();},0);}}>습격 체험</button>}</p>}</div>}
   {view==='operations'&&s&&<><div className="minimal-operations">
    {saveFailed&&!demo&&<button className="save-failure" role="alert" onClick={exportGame}><SaveOff size={15}/><span><strong>자동 저장 실패</strong><small>눌러서 진행 파일로 보관</small></span></button>}
    {s.money<0&&<div className="finance-warning" role="alert"><strong>운영 자금 {format(s.money)}G</strong><ShortFunds sim={s} need={0} onAction={act} onMarket={()=>setDialog('trade')}/></div>}
    <RaidPanel sim={s} onAction={act}/>
    {s.sanctionUntil>s.time&&<div className="sanction-warning" role="status"><CircleAlert size={16}/><span><strong>무역 압박 · {remainingSeconds(s.sanctionUntil-s.time,s)}초</strong><small>시장 판매 수익 −25%</small></span><Button size="sm" disabled={s.money<s.sanctionCost()} onClick={()=>act(s.negotiateSanction(),'success')}>통상 협상 · {format(s.sanctionCost())}G</Button><ShortFunds sim={s} need={s.sanctionCost()} onAction={act} onMarket={()=>setDialog('trade')}/></div>}
    {s.pendingEvent&&<div className={'weather-warning'+(GOOD_EVENTS.includes(s.pendingEvent.type)?' good-news':'')} role="status">{GOOD_EVENTS.includes(s.pendingEvent.type)?<Sparkles size={16}/>:<CircleAlert size={16}/>}{s.eventName(s.pendingEvent.type)} · {remainingSeconds(s.pendingEvent.at-s.time,s)}초{s.pendingEvent.type==='storm'&&<><button disabled={s.protected||!!s.reinforceShort?.()} onClick={()=>act(s.reinforce(),'build')}>{s.protected?'보강 완료':'보강 · '+ACTION_PRICES.reinforce.money+'G + 목재 '+ACTION_PRICES.reinforce.items.wood}</button>{!s.protected&&<CostShort sim={s} text={s.reinforceShort?.()} price={ACTION_PRICES.reinforce} onAction={act} onMarket={()=>setDialog('trade')}/>}</>}</div>}
    <Operations sim={s} hidden={!!guide} phone={false} onTool={(name:string)=>{setDialog(null);pickTool(name);}} onAction={act} onMarket={()=>setDialog('trade')} onWorld={()=>setDialog('world')} onSpeed={goalProps.onSpeed} falling={falling} onGoals={()=>setDialog('goals')} onFocus={(id:number)=>{setDialog(null);setSelected(id);setTile(null);pickTool(null);scene.current.select(id);scene.current.focusBuilding?.(id);}}/>
    {guide&&<Tutorial sim={s} onTool={(name:string)=>{setDialog(null);pickTool(name);}} onAction={(r:any)=>act(r,'success')} onGoals={()=>setDialog('goals')} onDismiss={()=>{setTutorialHidden(true);try{localStorage.setItem('orvetharn-tutorial','hidden');}catch{}}}/>}
   </div></>}
   {view==='trials'&&<IndustryTrials onStart={(id:string)=>begin('trial',id)} onContinue={()=>begin('trial')}/>}
   {view==='playtest'&&<PlaytestResults/>}
   {view==='community'&&<CommunityPanel saveRaw={playing.current&&!demoRef.current&&!campaign.current?.trial?()=>encodeSave(campaign.current.save()):null} onLoad={installSave} trial={campaign.current?.trial}/>}
   {view==='facility'&&facilityDetails}
   {view==='terrain'&&s&&<><BiomeSummary layout={s.layout}/><MapEdgeList layout={s.layout} onFocus={(edge:any)=>{setDialog(null);cancel();scene.current.focusEdge(edge.side);const value=edge.overlay||'';setOverlay(value);scene.current.setOverlay(value);}}/><p>방향을 누르면 해당 지형으로 이동합니다.</p></>}
   {view==='map-tools'&&s&&<div className="minimal-map-tools"><div className="minimal-camera" aria-label="쿼터뷰 카메라"><button data-sound="rotate" aria-label="왼쪽 90도 회전" onClick={()=>scene.current.rotate(-1)}><RotateCcw size={20}/>회전 Q</button><button data-sound="rotate" aria-label="오른쪽 90도 회전" onClick={()=>scene.current.rotate(1)}><RotateCw size={20}/>회전 E</button><button data-sound="zoom" aria-label="확대" onClick={()=>scene.current.zoom(1.2)}><Plus size={19}/></button><button data-sound="zoom" aria-label="축소" onClick={()=>scene.current.zoom(1/1.2)}><Minus size={19}/></button><button aria-label="지도 중앙" onClick={()=>scene.current.resetCamera()}><Maximize size={19}/></button></div><label>시설 이름 표시<Switch aria-label="시설 이름 표시" checked={labels} onCheckedChange={setLabels}/></label><label>토질 지도<select aria-label="토질 지도" value={overlay} onChange={e=>{setOverlay(e.target.value);scene.current.setOverlay(e.target.value);}}>{Object.entries({'':'표시 안 함',fertility:'비옥도',moisture:'수분',ore:'광물량',oil:'원유 농도',mana:'마력 농도',pollution:'오염',shade:'그늘',power:'전력망'}).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><Button variant="outline" aria-label="철거 도구" onClick={()=>{setDialog(null);pickTool('bulldoze');}}><Trash2 size={17}/>철거 도구</Button>{overlay==='power'&&<p>초록: 여유 · 노랑: 여유 2 미만 · 주황: 용량 사용 중 · 빨강: 시설 공급 부족 · 회색: 연결 없음</p>}<p>드래그로 이동 · 휠로 확대 · Q/E로 회전</p></div>}
   {view==='world'&&campaign.current&&<CampaignPanel campaign={campaign.current} onVisit={visitSite} onFocus={(id:string|null)=>{setDialog(null);setWorldSelection(id);if(id)scene.current.focusProvince(id,65);else scene.current.showWorld();}} onAction={(r:any)=>{act(r,'success');if(r.ok)scene.current?.rebuild();}}/>}
   {view==='league'&&campaign.current&&<LeaguePanel campaign={campaign.current} onAction={(r:any)=>act(r,'success')}/>}
   {view==='haul'&&s&&<HaulPanel sim={s} onAction={(r:any)=>act(r,'click')}/>}
   {view==='trade'&&s&&<MarketPanel sim={s} onAction={(r:any)=>act(r,'')} refresh={()=>{persist();repaint();}}/>}
   {view==='goals'&&s&&<Tabs defaultValue="promotion" className="goals-focused"><TabsList aria-label="목표 분류"><TabsTrigger value="promotion">승급·납품</TabsTrigger><TabsTrigger value="story">빚·가족·자치</TabsTrigger></TabsList><TabsContent value="promotion"><div className="promotion-box"><span>{s.rank+1} / {RANKS.length} · {RANKS[s.rank].name}</span>{s.promotion()?<><h3>{s.promotion().name}</h3>{s.promotion().trial&&<div className={'promotion-trial '+(s.promotion().trial.done?'done':'')}><span>{s.promotion().trial.name}</span><b>{s.promotion().trial.displayCurrent} / {s.promotion().trial.displayTarget}</b><small>{s.promotion().trial.right}</small><GoalButton sim={s} part={{key:'trial:'+s.promotion().trial.key,done:s.promotion().trial.done}} {...goalProps}/></div>}{s.promotion().requirements.map((r:any)=><div key={r.key} className={r.done?'done':''}><span>{r.done?'✓':'○'} {r.name}</span><b>{Math.min(r.current,r.target)} / {r.target}</b><GoalButton sim={s} part={{key:r.key,done:r.done}} {...goalProps}/></div>)}<Button disabled={!s.promotion().ready} onClick={promote}>승급 · {s.promotion().fee}G</Button><GoalButton sim={s} part={{key:'fee',done:s.money>=s.promotion().fee}} {...goalProps}/></>:<><p>패권국에 도달했습니다. 다음은 대륙 기록입니다.</p><LegacyGoals campaign={campaign.current}/></>}</div>{(()=>{const deal=contractState(s),c=deal.contract;return <div className="contract-box"><div><strong>납품 계약</strong><span>{resources[c.item]?.name} {c.amount}개 · {deal.note||deal.have+'/'+c.amount}</span></div><Button disabled={!deal.ready} onClick={()=>act(s.fulfill(),'success')}>{deal.label==='납품'?'납품 +'+c.reward+'G':deal.label}</Button></div>;})()}</TabsContent><TabsContent value="story"><div className="story-goals"><div><span><Coins size={18}/>{s.debt>0?'남은 빚':'빚 청산 완료'}</span><strong>{format(s.debt)}<small>G</small></strong>{s.debt>0&&<Button disabled={s.money<Math.min(s.debt,200)} onClick={()=>act(s.repay(),'success')}>{format(Math.min(s.debt,200))}G 상환</Button>}</div></div><RescuePanel sim={s} onAction={(r:any)=>act(r,'success')}/><CharterPanel sim={s} onAction={(r:any)=>act(r,'success')}/></TabsContent><details className="ui-disclosure rank-disclosure"><summary>전체 승급 단계</summary><div className="rank-track">{RANKS.map((r:any)=><span key={r.id} className={r.id===s.rank?'current':r.id<s.rank?'done':''}>{r.id+1}. {r.name}</span>)}</div></details></Tabs>}
   {view==='settings'&&<SettingsPanel playing={!welcome} demo={demo} muted={muted} onSound={toggleSound} volumes={audioVolumes} onVolume={(id:string,v:number)=>{setAudioVolumes({...audioVolumes,[id]:v});audio.current.start();audio.current.setVolume(id,v);audio.current.play('select',{volume:.2});}} onTest={(id:string)=>audio.current?.test(id)} onReset={()=>{setAudioVolumes(audio.current.resetVolumes());setMuted(false);}} audioStatus={audioStatus} onRetry={()=>audio.current?.retryFailed()} quality={quality} onQuality={(value:string)=>{setQuality(value);scene.current?.setQuality(value);}} onHelp={()=>setDialog('help')} onCredits={()=>setDialog('credits')} onTutorial={()=>{setTutorialHidden(false);try{localStorage.setItem('orvetharn-tutorial','shown');}catch{}setDialog('operations');}} saveState={saveState} onSave={()=>{if(persist()){audio.current?.play('save');toast.success('이 브라우저에 저장했습니다.');}else audio.current?.play('invalid');}} onExport={exportGame} onImport={()=>importInput.current?.click()} onRestore={restoreBackup} exportData={exportData} exportUrl={exportUrl.current} onHome={()=>{persist();setDialog(null);navigate(()=>{setWelcome(true);playing.current=false;sim.current.paused=true;pickTool(null);},'home','마을의 하루로');}} onRecover={()=>act(s.recover())} offlineEnabled={!!campaign.current?.offline?.enabled} offlineAllowed={!campaign.current?.trial} onOffline={(enabled:boolean)=>{campaign.current.offline={enabled};persist();repaint();}}/>}
   {view==='residents'&&s&&<><div className="resident-summary"><strong>{(FACTIONS as any)[factionOf(s.race)].name} 주민</strong><span>{s.workerCount}명</span></div><ResidentRoster workers={s.workers} resources={resources}/><p>주택의 주민이 물자를 운반합니다. 주택은 개선하면 최대 3명까지 늘어납니다.</p></>}
   {view==='credits'&&<div className="credits"><p>건축 부품 · 소품<br/><a href="https://kenney.nl/assets/fantasy-town-kit" target="_blank" rel="noreferrer">Kenney — Fantasy Town Kit</a></p><p>픽셀 캐릭터 · 일러스트와 방향별 동작<br/>타운그리드 오리지널 에셋</p><p>예인선 · 순찰선 · 등대 · 작업 도구<br/>타운그리드 자체 제작</p><MusicCredits/><p>효과음<br/><a href="https://kenney.nl/assets/rpg-audio" target="_blank" rel="noreferrer">Kenney — RPG Audio</a></p><p>현대 공장 · 자동차 · 기차<br/><a href="https://kenney.nl/assets/city-kit-industrial" target="_blank" rel="noreferrer">Kenney — Industrial / Car / Train Kit</a></p><p>기존 골렘 모델<br/><a href="https://shyr-games.itch.io/stan-the-golem" target="_blank" rel="noreferrer">Shyr Games — Stan the Golem</a></p><p>동물 · 용 · 해양 캐릭터<br/><a href="https://quaternius.com/packs/ultimateanimatedanimals.html" target="_blank" rel="noreferrer">Quaternius — Animated Animals</a><br/><a href="https://opengameart.org/content/lowpoly-animated-monsters" target="_blank" rel="noreferrer">Animated Monsters</a><br/><a href="https://opengameart.org/content/animated-fish" target="_blank" rel="noreferrer">Animated Fish</a></p><p>추가 농장 · 말 · 로봇<br/><a href="https://quaternius.com/packs/farmbuildings.html" target="_blank" rel="noreferrer">Quaternius — Farm Buildings / Animated Animals / Robot</a></p><p>공장 기계 · 선박 · 상업 건물<br/><a href="https://kenney.nl/assets/factory-kit" target="_blank" rel="noreferrer">Kenney — Factory / Watercraft / Commercial</a></p><p>환경음<br/><a href="https://opengameart.org/content/forest-ambience" target="_blank" rel="noreferrer">TinyWorlds — Forest Ambience</a></p><p>배경음악은 위에 표시한 라이선스를 따릅니다. 그 외 외부 에셋: CC0. 주민과 적대 캐릭터는 이 프로젝트에서 제작한 픽셀 에셋입니다. 선박·등대·도구는 직접 제작한 모델이며 동물은 외부 에셋을 사용합니다. 종족 장식·둥근 수목·기와·지도·일부 생산 기구는 이 프로젝트에서 제작했습니다.</p></div>}
   {view==='help'&&<div className="help-content"><div><span>01</span><p><strong>첫 건물은 자유롭게 고르세요.</strong>건설 메뉴에서 시설을 고르거나 빈 칸을 눌러 건설하세요. 각 건물은 1칸입니다. 시작 물자는 시장에서 바로 수출할 수 있습니다. 수출 수단의 미니 창고가 생산물과 수입품을 받습니다. 주민 주택을 지으면 자동 운반을 시작합니다. 연료 40개가 바닥나기 전에 풍력·유정·정유소를 준비하세요. 소형 증류소는 연료가 부족할 때만 쓰는 느린 비상 설비입니다. 주택은 처음에 1명이 살고, 개선할 때마다 1명씩 늘어 최대 3명입니다.</p></div><div><span>02</span><p><strong>생산 흐름을 연결하세요.</strong>우물 → 밀밭 → 제분소 → 빵집. 벌목장이 장작을 공급합니다.</p></div><div><span>03</span><p><strong>물·그늘·오염·바람을 확인하세요.</strong>담수 두 칸 안의 밀밭은 물 운반이 필요 없습니다. 공장의 오염과 높은 건물의 그늘은 농업을 늦추고, 제분소·풍력기는 바람이 트여야 빠릅니다.</p></div><div><span>04</span><p><strong>도로로 운반하고 묶음 출하하세요.</strong>흙길 이동은 70% 빠릅니다. 자동 판매는 필요한 원료를 남기고 10개 이상 모인 상품을 차량 적재량까지 보냅니다. 제철·정유·회로·자동차 산업까지 발전합니다. 모든 진영이 고산업까지 가지만 일부 작업장은 전담 종족 주민이 있어야 가동합니다.</p>{s&&!welcome&&<ul className="help-crews">{crewRules(s).map((v:string)=><li key={v}>{v}</li>)}</ul>}</div><div><span>05</span><p><strong>땅을 넓히고 위기에 대비하세요.</strong>인접한 16칸을 확보하거나 세계 지도에서 다른 거점으로 진출합니다. 파손 시설을 선택하면 수리할 수 있습니다.</p></div><div className="help-keys">이동: 왼쪽·오른쪽 드래그 · 확대: 휠<br/>90° 회전: Q·E / 회전 버튼 · 네 방향 쿼터뷰<br/>건설 목록: B · 일시정지: Space · 취소: Esc<br/>모바일: 한 손가락 이동 · 두 손가락 확대<br/>빈 칸 → 여기에 건설 → 시설 선택<br/>배치 모드: 선택한 칸을 다시 터치</div></div>}
   {view==='ledger'&&s&&(()=>{
    // G3-06: the rules keep each site's own books (simulation.js ledger()); without them the ledger sums every site
    // (ledgerSnapshot with the campaign) so one site's stock is never mixed with all sites' output.
    const own=typeof s.ledger==='function'&&!ledgerAll?s.ledger():null,siteCount=campaign.current?.sites?.length||1,part=(r:any)=>r?.partial?' · 불러온 뒤부터':'';
    let days:any[],flow:any,flowDay:any;
    if(own){const L=own.last,T=own.today;days=[L&&{title:L.day+'일째 · 하루'+part(L),income:L.income,expenses:L.expenses,net:L.net},{title:'오늘 지금까지'+part(T),income:T.income,expenses:T.expenses,net:T.net}].filter(Boolean);flow=L||T;flowDay=L?.day;}
    else{const l=ledger.current?.sim===s?ledger.current:null,now=ledgerSnapshot(s,campaign.current),today=l?ledgerDiff(l.start,now):null,last=l?.last;
     days=[last&&{title:last.day+'일째 · 하루',income:last.income,expenses:last.expenses,net:last.money},{title:'오늘 지금까지',income:now.income,expenses:now.expenses,net:today?today.money+l!.start.income-l!.start.expenses:now.income-now.expenses}].filter(Boolean);flow=last||today;flowDay=last?.day;}
    const top=Math.max(1,...days.flatMap(d=>[d.income,d.expenses,Math.abs(d.net-d.income+d.expenses)])),width=(v:number)=>Math.min(100,Math.round(Math.abs(v)/top*100))+'%';
    const rows=(flow?.items||[]).slice(0,14),most=Math.max(1,...rows.flatMap((r:any)=>[r.made,r.used,r.sold]));
    return <div className="ledger">
     {/* With several sites: this site's own books (rules' ledger()) or every site summed. */siteCount>1&&<div className="ledger-scope" role="group" aria-label="장부 범위">{typeof s.ledger==='function'&&<button type="button" aria-pressed={!ledgerAll} onClick={()=>setLedgerAll(false)}>{campaign.current.sites.find((v:any)=>v.sim===s)?.name||'이 거점'}</button>}<button type="button" aria-pressed={ledgerAll||typeof s.ledger!=='function'} onClick={()=>setLedgerAll(true)}>거점 {siteCount}곳 합계</button></div>}
     <section className="ledger-days" aria-label="하루 수지">{days.map(d=>{const other=d.net-d.income+d.expenses;return <div className="ledger-day" key={d.title}><strong>{d.title}</strong>
      <div className="ledger-bar income"><span>판매 수입</span><i><em style={{width:width(d.income)}}/></i><b>+{format(d.income)}G</b></div>
      <div className="ledger-bar expense"><span>유지비·세금</span><i><em style={{width:width(d.expenses)}}/></i><b>−{format(d.expenses)}G</b></div>
      <div className={'ledger-bar '+(other<0?'expense':'income')}><span>건설·수리·기타</span><i><em style={{width:width(other)}}/></i><b>{other<0?'−':'+'}{format(Math.abs(other))}G</b></div>
      <div className={'ledger-net '+(d.net<0?'negative':'positive')}><span>순이익</span><b>{d.net<0?'−':'+'}{format(Math.abs(d.net))}G</b></div></div>;})}</section>
     <section className="ledger-items" aria-label="품목별 생산과 사용"><strong>{flowDay?'품목 · '+flowDay+'일째 하루':'품목 · 오늘 지금까지'}</strong>{rows.length?<div className="ledger-table" role="table">{rows.map((r:any)=><div role="row" key={r.id}><span role="cell"><ResourceIcon name={r.id} size={18}/>{resources[r.id].name}</span><span role="cell" className="ledger-rate"><i className="made" style={{width:Math.round(r.made/most*100)+'%'}}/><i className="used" style={{width:Math.round((r.used+r.sold)/most*100)+'%'}}/></span><span role="cell">생산 {r.made} · 사용 {r.used} · 판매 {r.sold}</span><b role="cell" className={r.change<0?'negative':''}>{r.change>0?'+':''}{r.change}</b></div>)}</div>:<p>아직 기록이 없습니다. 하루가 지나면 채워집니다.</p>}</section>
     {news.current.length>0&&<details className="ledger-news"><summary>소식 {news.current.length}건</summary><ul>{news.current.map((v,i)=><li key={i}><small>{v.day}일 · {v.site}</small>{v.text}</li>)}</ul></details>}
     <div className="ledger-actions"><Button onClick={()=>setDialog('trade')}><ShoppingBag size={16}/>시장 열기</Button></div>
    </div>;})()}
   {view==='promoted'&&promoted&&<div className="promotion-moment"><div className="promotion-seal" aria-hidden="true"><Flag size={30}/></div><h3>{RANKS[promoted.rank]?.name}</h3>{promoted.right&&<p>{promoted.right}</p>}
    {promoted.unlocked.length>0?<><strong>새로 지을 수 있는 시설 {promoted.unlocked.length}</strong><div className="unlocked-grid">{promoted.unlocked.map((t:string)=><button key={t} aria-label={defs[t].name+' 배치'} onClick={()=>{setDialog(null);setCategory(defs[t].group);pickTool(t);}}><img src={icons[t]} alt=""/><span>{defs[t].name}</span>{productsOf(defs[t])[0]&&<small><ResourceIcon name={productsOf(defs[t])[0].output} size={13}/>{resources[productsOf(defs[t])[0].output]?.name}</small>}</button>)}</div></>:<p>이번 승급으로 새 권한을 얻었습니다.</p>}
    <div className="save-actions"><Button variant="outline" onClick={()=>setDialog(null)}>닫기</Button>{promoted.unlocked.length>0&&<Button onClick={()=>{setDialog(null);setCategory(defs[promoted.unlocked[0]].group);setBuildOpen(true);}}><Hammer size={16}/>건설 목록 열기</Button>}</div></div>}
   {view==='finale'&&promoted&&<div className="finale"><div className="promotion-seal" aria-hidden="true"><Trophy size={30}/></div><h3>{RANKS[RANKS.length-1].name}</h3><p>이르데아의 패권을 쥐었습니다. 이제 대륙 기록에 도전합니다.</p>
    <dl className="finale-stats"><div><dt>걸린 날</dt><dd>{format(promoted.day)}일</dd></div><div><dt>누적 수입</dt><dd>{format(promoted.revenue)}G</dd></div><div><dt>총 생산량</dt><dd>{format(promoted.produced)}개</dd></div><div><dt>운영 거점</dt><dd>{promoted.sites}곳</dd></div>{promoted.sold!=null&&<div><dt>총 판매량</dt><dd>{format(promoted.sold)}개</dd></div>}{promoted.contracts!=null&&<div><dt>영주 납품</dt><dd>{format(promoted.contracts)}회</dd></div>}</dl><LegacyGoals campaign={campaign.current} compact/>
    <Button onClick={()=>setDialog(null)}>계속 운영</Button></div>}
  </DialogContent></Dialog>
  <Dialog open={confirmNew} onOpenChange={setConfirmNew}><DialogContent className="game-dialog town-dialog minimal-dialog confirm-dialog"><DialogTitle>새 땅에서 시작할까요?</DialogTitle><DialogDescription>현재 저장은 백업으로 남깁니다. 설정에서 이전 백업을 복구할 수 있습니다.</DialogDescription><div className="save-actions"><Button variant="outline" onClick={()=>setConfirmNew(false)}>취소</Button><Button onClick={()=>{setConfirmNew(false);begin('new');}}>백업하고 새로 시작</Button></div></DialogContent></Dialog>
  {navigation&&<ScreenTransition art={navigation.art} label={navigation.label} onDone={finishNavigation}/>}
  {busy&&ready&&frontScreen!=='title'&&<LoadingScreen art={transitionArt||transitionArtwork('world')} label={transitionArt?transitionLabel:'지역 자료를 불러오는 중'} onNext={transitionArt?nextArtwork:undefined}/>}
  {contextLost&&<ScreenError title="화면 연결이 끊겼습니다" message="게임을 일시 정지했습니다. 잠시 뒤 복구를 시도합니다." onExport={()=>encodeSave(campaign.current.save())} onRetry={()=>location.reload()}/>}
  <Toaster position="top-center" mobileOffset={{top:phone?114:76}} offset={{top:phone?114:76}} visibleToasts={1} style={shortScreen?{'--width':'236px'} as React.CSSProperties:undefined} richColors closeButton duration={3800} toastOptions={{className:'game-toast'}}/>
 </main>;
}
