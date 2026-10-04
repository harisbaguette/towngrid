import {MUSIC_CATALOG} from './music-catalog';
import {SCREEN_MUSIC,NATION_MUSIC,BIOME_MUSIC} from './soundscape';

export default function MusicCredits(){
 const groups=[['화면·상황',SCREEN_MUSIC],['국가',NATION_MUSIC],['지역 지형',BIOME_MUSIC]] as const;
 return <section aria-label="배경음악 출처"><p>배경음악 · {Object.keys(MUSIC_CATALOG).length}곡<br/>음량 보정 · OGG/MP3 변환 · 곡 사이 교차 재생</p>
  {groups.map(([label,items])=><details key={label}><summary>{label} 음악</summary>{Object.entries(items).map(([id,item]:any)=>{
   const track=(MUSIC_CATALOG as any)[item.track];return <p key={id}><strong>{item.label}</strong><br/><a href={track.source} target="_blank" rel="noreferrer">{track.author} — {track.title}</a><br/><a href={track.license_url} target="_blank" rel="noreferrer">{track.license}</a></p>;
  })}</details>)}
 </section>;
}
