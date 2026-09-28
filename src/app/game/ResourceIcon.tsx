import { RESOURCE_ICONS } from './resource-art';

export default function ResourceIcon({name,size=18}:{name:string,size?:number}){
 const src=(RESOURCE_ICONS as Record<string,string>)[name];
 return src?<img src={src} alt="" width={size} height={size} draggable={false} style={{imageRendering:'pixelated',objectFit:'contain',flexShrink:0,verticalAlign:'middle'}}/>:null;
}
