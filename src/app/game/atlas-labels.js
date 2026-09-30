/** Place labels in screen pixels, then project back. Zoom never enlarges the type.
 * `blocked` lists boxes in viewport pixels (map controls) that labels must not sit under. */
export function placeAtlasLabels(candidates,view,size,blocked=[]){
 const scale=Math.min(size.width/view.width,size.height/view.height),placed=[];
 const width=view.width*scale,height=view.height*scale,ox=(size.width-width)/2,oy=(size.height-height)/2;
 const walls=blocked.map(b=>({x:b.x-ox,y:b.y-oy,w:b.w,h:b.h}));
 const hits=(x,y,w,h,box,gap)=>x<box.x+box.w+gap&&x+w+gap>box.x&&y<box.y+box.h+3&&y+h+3>box.y;
 for(const item of [...candidates].sort((a,b)=>(b.priority||0)-(a.priority||0))){
  const px=(item.point[0]-view.x)*scale,py=(item.point[1]-view.y)*scale;
  if(px<0||py<0||px>width||py>height)continue;
  const font=item.font||12,w=Array.from(item.text).reduce((n,c)=>n+(c.charCodeAt(0)>255?font:font*.57),0)+12,h=font+8;
  for(const dy of [-(item.offset??24)-h,16,-(item.offset??24)-h-22]){
   const x=Math.max(3,Math.min(width-w-3,px-w/2)),y=py+dy;
   if(y<3||y+h>height-3)continue;
   if(walls.some(b=>hits(x,y,w,h,b,2)))continue;
   if(placed.some(p=>hits(x,y,w,h,p.box,5)))continue;
   placed.push({...item,box:{x,y,w,h},x:view.x+(x+w/2)/scale,y:view.y+(y+h/2)/scale,width:w/scale,height:h/scale,font:font/scale});break;
  }
 }
 return placed;
}
