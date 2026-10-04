import {WORLD_REALMS} from './world-politics.js';
import {BIOMES} from './biome-data.js';
// Dialogs take precedence even on the home screen; related screens share a score.
export const SCREEN_MUSIC={
 title:{label:'대기·진입',track:'score-title'}, home:{label:'홈',track:'music-morning'},
 gallery:{label:'마을의 하루',track:'score-gallery'}, loading:{label:'불러오기',track:'score-loading'},
 world:{label:'대륙 전체',track:'music-explore'}, wilderness:{label:'무주지',track:'score-wilderness'},
 industry:{label:'산업도시',track:'music-industry'}, trade:{label:'시장',track:'music-bustling'},
 danger:{label:'습격',track:'music-danger'}, build:{label:'건설',track:'score-build'},
 menu:{label:'메뉴',track:'score-menu'}, operations:{label:'생산·위기',track:'score-operations'},
 terrain:{label:'주변 지형',track:'score-terrain'}, 'map-tools':{label:'지도 도구',track:'score-map-tools'},
 facility:{label:'시설 상세',track:'score-facility'}, diplomacy:{label:'거점·외교',track:'score-diplomacy'},
 league:{label:'도전·순위',track:'score-league'}, trials:{label:'산업 도전',track:'score-trials'},
 community:{label:'온라인·서버 저장',track:'score-league'}, playtest:{label:'플레이 점검 기록',track:'score-ledger'},
 haul:{label:'운반·보관',track:'score-haul'}, goals:{label:'신분과 권한',track:'score-goals'},
 settings:{label:'설정',track:'score-settings'}, residents:{label:'주민',track:'score-residents'},
 credits:{label:'제작 에셋',track:'score-credits'}, ledger:{label:'장부',track:'score-ledger'},
 promoted:{label:'승급',track:'score-promoted'}, finale:{label:'패권국 달성',track:'score-finale'},
 help:{label:'조작법',track:'score-help'}, confirm:{label:'새 게임 확인',track:'score-confirm'},
 error:{label:'복구',track:'score-error'},
};
export const NATION_MUSIC=Object.fromEntries(Object.entries(WORLD_REALMS).map(([id,n])=>[id,{label:n.name,track:'score-nation-'+id}]));
export const BIOME_MUSIC=Object.fromEntries(Object.entries(BIOMES).map(([id,b])=>[id,{label:b.name,track:'score-biome-'+id}]));
export const MUSIC_PLAYLISTS={
 ...Object.fromEntries(Object.entries(SCREEN_MUSIC).map(([id,v])=>[id,[v.track]])),
 ...Object.fromEntries(Object.entries(NATION_MUSIC).map(([id,v])=>['nation:'+id,[v.track]])),
 ...Object.fromEntries(Object.entries(BIOME_MUSIC).map(([id,v])=>['biome:'+id,[v.track]])),
 // Legacy preview tools without location information keep the normal town music.
 town:['music-morning','music-bustling'],
};
export const MUSIC=[...new Set(Object.values(MUSIC_PLAYLISTS).flat())];
export const sceneLabel=scene=>SCREEN_MUSIC[scene]?.label||NATION_MUSIC[scene.split(':')[1]]?.label||BIOME_MUSIC[scene.split(':')[1]]?.label||'마을';
export function locationMusic({nation=null,ecology=null,world=false,country=false,industrial=false,entry='region'}={}){
 const national=NATION_MUSIC[nation]?.track||SCREEN_MUSIC.wilderness.track;
 const regional=BIOME_MUSIC[ecology]?.track;
 if(world)return {scene:'world',label:SCREEN_MUSIC.world.label,tracks:MUSIC_PLAYLISTS.world};
 if(country)return {scene:'nation:'+(nation||'wilderness'),label:NATION_MUSIC[nation]?.label||'무주지',tracks:[national]};
 // A different biome starts with its own theme, then the country's theme. Industry is the third movement.
 return {scene:'place:'+(nation||'wilderness')+':'+(ecology||'legacy')+(industrial?':industry':''),
  label:[NATION_MUSIC[nation]?.label||'무주지',BIOME_MUSIC[ecology]?.label].filter(Boolean).join(' · '),
  tracks:[...new Set([...(entry==='nation'?[national,regional]:[regional,national]),industrial?SCREEN_MUSIC.industry.track:null].filter(Boolean))]};
}
export function musicSelection(state={}){
 const {front='game',dialog=null,raid=false,loading=false,error=false,building=false,facility=false,location=null}=state;
 let scene=error?'error':loading?'loading':dialog?(dialog==='world'?'diplomacy':dialog):null;
 if(!scene&&front!=='game')scene=front==='world'?null:front;
 if(!scene&&front==='game')scene=raid?'danger':building?'build':facility?'facility':null;
 if(scene)return {scene:SCREEN_MUSIC[scene]?scene:'menu',label:sceneLabel(scene),tracks:MUSIC_PLAYLISTS[scene]||MUSIC_PLAYLISTS.menu};
 if(location)return locationMusic({...location,industrial:front==='game'&&state.industrial});
 scene=state.world||front==='world'?'world':state.industrial?'industry':'town';
 return {scene,label:sceneLabel(scene),tracks:MUSIC_PLAYLISTS[scene]};
}
export const musicScene=state=>musicSelection(state).scene;
export const ACTION_SOUNDS={
 build:'action-build',demolish:'action-demolish',repair:'action-repair',upgrade:'action-upgrade',
 expand:'action-expand',plant:'action-plant',heal:'action-heal',invalid:'action-invalid',
 raid:'event-raid',defend:'event-defend',guardHit:'impactMetal_medium_001',impact:'event-impact',defeat:'event-defeat',
 retreat:'event-retreat',victory:'event-victory',storm:'event-thunder',manaStorm:'event-mana',
 illness:'event-illness',strike:'event-strike',sanction:'event-sanction',
 'trial-won':'event-victory','trial-ended':'event-retreat',
 world:'map-world',plot:'map-plot',enter:'map-enter',transition:'ui-transition',
 'vehicle-truck':'machine-chug','vehicle-cart':'cart-roll','vehicle-boat':'water-pour',
 'vehicle-ship':'vehicle-ship','vehicle-train':'vehicle-train','vehicle-air':'vehicle-air',
};
export const LOCAL_EVENTS=new Set(['footstep','pickup','drop','impact','defeat','guardHit']);
export const ALERT_EVENTS=new Set(['raid','storm','manaStorm','illness','strike','sanction','promotion','victory','contract','trial-won','trial-ended']);
export function vehicleSound(kind){
 if(['airship','airplane','plane'].includes(kind))return 'vehicle-air';
 if(['train','rail'].includes(kind))return 'vehicle-train';
 if(['steamer','ship'].includes(kind))return 'vehicle-ship';
 if(['raft','boat'].includes(kind))return 'vehicle-boat';
 if(['cart','wagon'].includes(kind))return 'vehicle-cart';
 return 'vehicle-truck';
}
