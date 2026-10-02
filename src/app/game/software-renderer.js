import * as THREE from 'three';
import {networkSamples} from './pixel-network.js';

// CPU renderer for devices where WebGL is unavailable. It projects the very same
// animated Three.js models, with cached model layers and diffuse face lighting.
export class SoftwareRenderer {
 constructor({alpha=false}={}){
  this.domElement=document.createElement('canvas');this.ctx=this.domElement.getContext('2d',{alpha});this.alpha=alpha;
  this.shadowMap={};this.cache=new Map();this.poseCache=new Map();this.surfacePatterns=new Map();this.ratio=1;this.width=1;this.height=1;this.background='#a5bca2';this.isSoftware=true;this.frame=0;
  this.v=new THREE.Vector3();this.normal=new THREE.Vector3();this.projection=new THREE.Matrix4();this.sun=new THREE.Vector3(-.4,.82,.4).normalize();
 }
 setPixelRatio(n){this.ratio=Math.min(n,1.4);}
 setClearColor(color){this.background=color;}
 setSize(w,h){this.width=w;this.height=h;this.domElement.width=Math.round(w*this.ratio);this.domElement.height=Math.round(h*this.ratio);this.cache.clear();this.poseCache.clear();}
 point(x,y,z){return this.v.set(x,y,z).applyMatrix4(this.projection).clone();}
 xy(v){return {x:(v.x+1)*this.width/2,y:(1-v.y)*this.height/2};}
 project(x,y,z){return this.xy(this.point(x,y,z));}
 polygons(root){
  const triangles=[],world=new THREE.Matrix4(),normalMat=new THREE.Matrix3(),va=new THREE.Vector3(),a=new THREE.Vector3(),col=new THREE.Color();
  root.traverseVisible(m=>{
   if(!m.isMesh||m.isInstancedMesh||!m.geometry.attributes.position)return;
   const p=m.geometry.attributes.position,idx=m.geometry.index,n=m.geometry.attributes.normal;let material=Array.isArray(m.material)?m.material[0]:m.material;
   if(!material||material.visible===false)return;
   world.copy(m.matrixWorld);normalMat.getNormalMatrix(world);col.copy(material.color||new THREE.Color('#ffffff')).convertLinearToSRGB();
   const count=idx?idx.count:p.count,projected=new Float32Array(p.count*3),shades=new Float32Array(p.count);
   const mvp=new THREE.Matrix4().multiplyMatrices(this.projection,world);
   const used=idx?new Set(idx.array):Array.from({length:p.count},(_,i)=>i);for(const i of used){a.fromBufferAttribute(p,i);if(m.isSkinnedMesh)m.applyBoneTransform(i,a);a.applyMatrix4(mvp);projected[i*3]=(a.x+1)*this.width/2;projected[i*3+1]=(1-a.y)*this.height/2;projected[i*3+2]=a.z;if(n){va.fromBufferAttribute(n,i).applyNormalMatrix(normalMat);const diffuse=Math.max(0,va.dot(this.sun)),spec=Math.pow(Math.max(0,va.dot(this.sun.clone().add(this.viewDirection||new THREE.Vector3(0,.4,1)).normalize())),24)*(1-(material.roughness??.8))*.35;shades[i]=.72+diffuse*.28+spec+Math.max(0,va.y)*.025;}else shades[i]=.86;}
   for(let i=0;i<count;i+=3){
    if(Array.isArray(m.material)){const group=m.geometry.groups.find(g=>i>=g.start&&i<g.start+g.count);material=m.material[group?.materialIndex||0];col.copy(material.color).convertLinearToSRGB();}const ia=idx?idx.getX(i):i,ib=idx?idx.getX(i+1):i+1,ic=idx?idx.getX(i+2):i+2;
    const ax=projected[ia*3],ay=projected[ia*3+1],bx=projected[ib*3],by=projected[ib*3+1],cx=projected[ic*3],cy=projected[ic*3+1];
    const area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);if(area>=-.025&&material.side!==THREE.DoubleSide)continue;
    const vertexColor=m.geometry.attributes.color;if(vertexColor&&(material.vertexColors||material.map)){col.fromBufferAttribute(vertexColor,ia).convertLinearToSRGB();}
    triangles.push({ax,ay,bx,by,cx,cy,az:projected[ia*3+2],bz:projected[ib*3+2],cz:projected[ic*3+2],z:(projected[ia*3+2]+projected[ib*3+2]+projected[ic*3+2])/3,r:col.r*255,g:col.g*255,b:col.b*255,sa:shades[ia],sb:shades[ib],sc:shades[ic],alpha:material.transparent?material.opacity:1});
   }
  });
  triangles.sort((a,b)=>b.z-a.z);return triangles;
 }
 sprite(root){
  const triangles=this.polygons(root);if(!triangles.length)return null;
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(const t of triangles){left=Math.min(left,t.ax,t.bx,t.cx);top=Math.min(top,t.ay,t.by,t.cy);right=Math.max(right,t.ax,t.bx,t.cx);bottom=Math.max(bottom,t.ay,t.by,t.cy);}
  left=Math.floor(left)-2;top=Math.floor(top)-2;right=Math.ceil(right)+2;bottom=Math.ceil(bottom)+2;
  const canvas=document.createElement('canvas'),ratio=this.ratio;canvas.width=Math.max(1,Math.ceil((right-left)*ratio));canvas.height=Math.max(1,Math.ceil((bottom-top)*ratio));const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,buffer=ctx.createImageData(w,h),pixels=buffer.data,depth=new Float32Array(w*h);depth.fill(Infinity);
  // Per-pixel depth avoids painter-order holes at curved hair, collars and hulls.
  // Interpolated authored normals keep the same rounded surfaces in CPU mode.
  const raster=t=>{
   const ax=(t.ax-left)*ratio,ay=(t.ay-top)*ratio,bx=(t.bx-left)*ratio,by=(t.by-top)*ratio,cx=(t.cx-left)*ratio,cy=(t.cy-top)*ratio;
   const denominator=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(denominator)<.00001)return;
   const x0=Math.max(0,Math.floor(Math.min(ax,bx,cx))),x1=Math.min(w-1,Math.ceil(Math.max(ax,bx,cx))),y0=Math.max(0,Math.floor(Math.min(ay,by,cy))),y1=Math.min(h-1,Math.ceil(Math.max(ay,by,cy)));
   const dxA=(by-cy)/denominator,dxB=(cy-ay)/denominator;
   for(let y=y0;y<=y1;y++){let a=((by-cy)*(x0+.5-cx)+(cx-bx)*(y+.5-cy))/denominator,b=((cy-ay)*(x0+.5-cx)+(ax-cx)*(y+.5-cy))/denominator;
    for(let x=x0;x<=x1;x++,a+=dxA,b+=dxB){const c=1-a-b;if(a<-.00001||b<-.00001||c<-.00001)continue;const z=a*t.az+b*t.bz+c*t.cz,index=y*w+x;if(z>depth[index]+1e-7)continue;const shade=a*t.sa+b*t.sb+c*t.sc,k=index*4,alpha=t.alpha;
     if(alpha>=.999){pixels[k]=t.r*shade;pixels[k+1]=t.g*shade;pixels[k+2]=t.b*shade;pixels[k+3]=255;depth[index]=z;}
     else{const old=pixels[k+3]/255,combined=alpha+old*(1-alpha);if(combined<=0)continue;pixels[k]=(t.r*shade*alpha+pixels[k]*old*(1-alpha))/combined;pixels[k+1]=(t.g*shade*alpha+pixels[k+1]*old*(1-alpha))/combined;pixels[k+2]=(t.b*shade*alpha+pixels[k+2]*old*(1-alpha))/combined;pixels[k+3]=combined*255;}
    }
   }
  };
  for(const t of triangles)if(t.alpha>=.999)raster(t);for(const t of triangles)if(t.alpha<.999)raster(t);ctx.putImageData(buffer,0,0);
  const center=this.project(root.matrixWorld.elements[12],root.matrixWorld.elements[13],root.matrixWorld.elements[14]);
  return {canvas,dx:left-center.x,dy:top-center.y,w:right-left,h:bottom-top,time:performance.now()};
 }
 drawPixelSurface(mesh){
  const u=mesh.userData,image=u.image;if(!image)return;
  const ctx=this.ctx,cell=image.height,key=u.environmentId+':'+u.frame+':'+u.network;
  if(!this.surfacePatterns.has(key)){
   const tile=document.createElement('canvas');tile.width=tile.height=cell;
   const tileCtx=tile.getContext('2d');tileCtx.drawImage(image,u.frame*cell,0,cell,cell,0,0,cell,cell);
   if(u.network!==null&&u.network!==undefined){
    const source=tileCtx.getImageData(0,0,cell,cell),target=tileCtx.createImageData(cell,cell);
    for(let y=0;y<cell;y++)for(let x=0;x<cell;x++)for(const [s,t] of networkSamples(u.network,(x+.5)/cell,1-(y+.5)/cell)){
     const sx=Math.min(cell-1,Math.floor((s-Math.floor(s))*cell)),sy=Math.min(cell-1,Math.floor((1-(t-Math.floor(t)))*cell)),k=(sy*cell+sx)*4;
     if(source.data[k+3])target.data.set(source.data.subarray(k,k+4),(y*cell+x)*4);
    }tileCtx.putImageData(target,0,0);
   }
   this.surfacePatterns.set(key,ctx.createPattern(tile,'repeat'));
  }
  const matrix=new THREE.Matrix4(),color=new THREE.Color(),repeat=u.repeat||[1,1];
  const corners=[[-.5,.5],[.5,.5],[.5,-.5],[-.5,-.5]];
  for(let i=0;i<mesh.count;i++){
   mesh.getMatrixAt(i,matrix);matrix.premultiply(mesh.matrixWorld);
   const p=corners.map(([x,y])=>{const v=new THREE.Vector3(x,y,0).applyMatrix4(matrix);return this.project(v.x,v.y,v.z);});
   if(Math.max(...p.map(v=>v.x))<0||Math.min(...p.map(v=>v.x))>this.width||Math.max(...p.map(v=>v.y))<0||Math.min(...p.map(v=>v.y))>this.height)continue;
   const w=cell*repeat[0],h=cell*repeat[1];
   ctx.save();ctx.imageSmoothingEnabled=false;ctx.transform((p[1].x-p[0].x)/w,(p[1].y-p[0].y)/w,(p[3].x-p[0].x)/h,(p[3].y-p[0].y)/h,p[0].x,p[0].y);
   if(u.mask!==null){
    ctx.beginPath();ctx.rect(w*.21,h*.21,w*.58,h*.58);
    if(u.mask&1)ctx.rect(w*.21,0,w*.58,h*.5);
    if(u.mask&2)ctx.rect(w*.5,h*.21,w*.5,h*.58);
    if(u.mask&4)ctx.rect(w*.21,h*.5,w*.58,h*.5);
    if(u.mask&8)ctx.rect(0,h*.21,w*.5,h*.58);
    ctx.clip();
   }
   // Overlap opaque ground by a subpixel; rotated Canvas rectangles otherwise
   // expose hairline gaps through the sea at their antialiased edges.
   const cover=u.layer<=3&&u.layer!==2&&!u.cells[i]?.vertical;
   const padX=cover?Math.min(cell*.045,w/Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y)*.7):0;
   const padY=cover?Math.min(cell*.045,h/Math.hypot(p[3].x-p[0].x,p[3].y-p[0].y)*.7):0;
   ctx.fillStyle=this.surfacePatterns.get(key);ctx.fillRect(-padX,-padY,w+2*padX,h+2*padY);
   if(mesh.instanceColor){mesh.getColorAt(i,color);if(color.getHex()!==0xffffff){ctx.globalCompositeOperation='multiply';ctx.fillStyle=color.getStyle(THREE.SRGBColorSpace);ctx.fillRect(-padX,-padY,w+2*padX,h+2*padY);}}
   ctx.restore();
  }
 }
 drawGround(mesh){
  if(mesh.userData.pixelSurface){this.drawPixelSurface(mesh);return;}
  const ctx=this.ctx,dummy=new THREE.Matrix4(),color=new THREE.Color(),pos=new THREE.Vector3();
  for(let i=0;i<mesh.count;i++){
   mesh.getMatrixAt(i,dummy);pos.setFromMatrixPosition(dummy);const water=mesh.geometry.type==='PlaneGeometry';
   const x=pos.x,z=pos.z,y=pos.y+(water?0:(mesh.geometry.parameters?.height||.2)/2),hx=(mesh.geometry.parameters?.width||1)*.5,hz=(water?mesh.geometry.parameters?.height:mesh.geometry.parameters?.depth||1)*.5,points=[this.project(x-hx,y,z-hz),this.project(x+hx,y,z-hz),this.project(x+hx,y,z+hz),this.project(x-hx,y,z+hz)];
   if(Math.max(...points.map(v=>v.x))<0||Math.min(...points.map(v=>v.x))>this.width||Math.max(...points.map(v=>v.y))<0||Math.min(...points.map(v=>v.y))>this.height)continue;
   if(mesh.instanceColor){mesh.getColorAt(i,color);ctx.fillStyle=color.getStyle(THREE.SRGBColorSpace);}else ctx.fillStyle=water?'#36b4c2':mesh.material.color.getStyle(THREE.SRGBColorSpace);
   const baseColor=ctx.fillStyle;
   const path=(pts,round=0)=>{ctx.beginPath();for(let j=0;j<4;j++){const p=pts[j],prev=pts[(j+3)%4],next=pts[(j+1)%4],a={x:p.x+(prev.x-p.x)*round,y:p.y+(prev.y-p.y)*round},b={x:p.x+(next.x-p.x)*round,y:p.y+(next.y-p.y)*round};if(j===0)ctx.moveTo(a.x,a.y);else ctx.lineTo(a.x,a.y);ctx.quadraticCurveTo(p.x,p.y,b.x,b.y);}ctx.closePath();};
   if(mesh.userData.soil){const bottom=[this.project(x-hx,pos.y-.21,z-hz),this.project(x+hx,pos.y-.21,z-hz),this.project(x+hx,pos.y-.21,z+hz),this.project(x-hx,pos.y-.21,z+hz)];for(let side=0;side<4;side++){const next=(side+1)%4;if((points[next].x-points[side].x)>=0)continue;const [nx,nz]=[[0,-1],[1,0],[0,1],[-1,0]][side];if(mesh.userData.land?.has((x+nx)+','+(z+nz)))continue;path([points[side],points[next],bottom[next],bottom[side]],.035);const grad=ctx.createLinearGradient(0,points[side].y,0,bottom[side].y);grad.addColorStop(0,'#ceb68a');grad.addColorStop(1,'#a5865e');ctx.fillStyle=grad;ctx.fill();}}
   path(points,(mesh.userData.tiles||mesh.userData.soil)?.012:0);ctx.fillStyle=baseColor;ctx.fill();
   if(mesh.userData.tiles){const top=Math.min(...points.map(p=>p.y)),bottom=Math.max(...points.map(p=>p.y)),light=ctx.createLinearGradient(0,top,0,bottom);light.addColorStop(0,'#f7ffcf16');light.addColorStop(.75,'#f7ffcf00');light.addColorStop(1,'#56724517');ctx.fillStyle=light;ctx.fill();ctx.strokeStyle='#d3eaad18';ctx.lineWidth=.65;ctx.stroke();}
   if(mesh.userData.pixelWater&&mesh.userData.image){
    const u=mesh.userData,image=u.image,cell=image.height,p=points;
    ctx.save();ctx.imageSmoothingEnabled=false;
    ctx.transform((p[1].x-p[0].x)/cell,(p[1].y-p[0].y)/cell,(p[3].x-p[0].x)/cell,(p[3].y-p[0].y)/cell,p[0].x,p[0].y);
    ctx.drawImage(image,u.frame*cell,0,cell,cell,0,0,cell,cell);ctx.restore();
   }else if(water){const wave=Math.sin(performance.now()*.001+x+z)*.1;const a=this.project(x-.24,y,z+wave),b=this.project(x+.09,y,z+wave);ctx.strokeStyle='#c2e7df66';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
  }
 }
 line(line){
  const ctx=this.ctx,p=line.geometry.attributes.position,v=new THREE.Vector3(),col=line.material.color.clone();ctx.strokeStyle=col.getStyle(THREE.SRGBColorSpace);ctx.lineWidth=1.5;ctx.globalAlpha=line.material.opacity??1;if(line.material.isLineDashedMaterial)ctx.setLineDash([5,4]);ctx.beginPath();
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(line.matrixWorld);const a=this.project(v.x,v.y,v.z);if(i===0||(line.isLineSegments&&i%2===0))ctx.moveTo(a.x,a.y);else ctx.lineTo(a.x,a.y);}if(line.isLineLoop)ctx.closePath();ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
 }
 grass(mesh){
  const ctx=this.ctx,matrix=new THREE.Matrix4(),p=new THREE.Vector3(),t=performance.now()*.001;
  ctx.lineCap='round';ctx.lineWidth=1.1;ctx.strokeStyle='#b9d28c';ctx.beginPath();
  for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);p.setFromMatrixPosition(matrix);const base=this.project(p.x,0,p.z),tip=this.project(p.x+Math.sin(t*1.25+p.x+p.z)*.018,.09,p.z);if(base.x<0||base.x>this.width||base.y<0||base.y>this.height)continue;ctx.moveTo(base.x,base.y);ctx.lineTo(tip.x,tip.y);}
  ctx.stroke();ctx.lineCap='butt';
 }
 drawPixelCharacter(root,center){
  const u=root.userData,ctx=this.ctx,image=u.image;if(!image)return;
  const size=Math.max(1,Math.round(u.pixelHeight*this.pixelsPerWorldUnit));
  const cellWidth=image.width/u.atlas.columns,cellHeight=image.height/u.atlas.rows;
  const position=u.sprite.getWorldPosition(new THREE.Vector3()),anchor=this.project(position.x,position.y,position.z);
  const x=Math.round(anchor.x-size*u.sprite.center.x),y=Math.round(anchor.y-size*(1-u.sprite.center.y));
  ctx.save();ctx.imageSmoothingEnabled=false;ctx.globalAlpha=u.sprite.material.opacity;
  ctx.fillStyle='#183d3d35';ctx.beginPath();ctx.ellipse(center.x,center.y+1,size*.18,size*.065,0,0,Math.PI*2);ctx.fill();
  if(u.sprite.material.rotation){
   // Authored defeat frames already contain the fallen body. Only rotate
   // legacy sprites, around the same anchor and with the WebGL rotation sign.
   ctx.translate(anchor.x,anchor.y);ctx.rotate(-u.sprite.material.rotation);
   ctx.drawImage(image,u.frame*cellWidth,u.atlas.row*cellHeight,cellWidth,cellHeight,-size*u.sprite.center.x,-size*(1-u.sprite.center.y),size,size);
  }else ctx.drawImage(image,u.frame*cellWidth,u.atlas.row*cellHeight,cellWidth,cellHeight,x,y,size,size);
  ctx.restore();
  const bar=u.hpBar;if(bar?.visible){const width=Math.max(16,size*.48),top=y+size*.05;ctx.fillStyle='#302c35';ctx.fillRect(center.x-width/2,top,width,5);ctx.fillStyle=bar.userData.fill.material.color.getStyle(THREE.SRGBColorSpace);ctx.fillRect(center.x-width/2+1,top+1,(width-2)*bar.userData.fill.scale.x,3);}
 }
 drawPixelEnvironment(root,center){
  const u=root.userData,image=u.image,sprite=u.sprite;if(!image)return;
  const projectPoint=v=>this.project(v.x,v.y,v.z);
  // Layered production art uses the same poses and inventory in both renderers.
  if(u.layers){
   for(const layer of u.layers)if(layer.visible&&layer.userData.behind)this.drawPixelEnvironment(layer,projectPoint(layer.getWorldPosition(new THREE.Vector3())));
  }
  const scale=root.getWorldScale(new THREE.Vector3()),ctx=this.ctx;
  const width=sprite.scale.x*scale.x*this.pixelsPerWorldUnit,height=sprite.scale.y*scale.y*this.pixelsPerWorldUnit;
  const cell=image.height*(u.texture.repeat.y),x=center.x-width*sprite.center.x,y=center.y-height*(1-sprite.center.y);
  if(sprite.visible){ctx.save();ctx.imageSmoothingEnabled=false;ctx.globalAlpha=sprite.material.opacity;
  if(u.clipLowerHalf){ctx.beginPath();ctx.rect(x,y,width,height*(1-sprite.center.y));ctx.clip();}
  if(sprite.material.rotation || u.flipX || u.projection){
   ctx.translate(center.x,center.y);if(u.projection){const [a,b,c,d]=u.projection;ctx.transform(a,-b,-c,d,0,0);}ctx.rotate(-sprite.material.rotation);if(u.flipX)ctx.scale(-1,1);
   if(u.crop){const [l,t,r,b]=u.crop;ctx.beginPath();ctx.rect((l-sprite.center.x)*width,(t-1+sprite.center.y)*height,(r-l)*width,(b-t)*height);ctx.clip();}
   ctx.drawImage(image,u.frame*cell,u.direction*cell,cell,cell,-width*sprite.center.x,-height*(1-sprite.center.y),width,height);
  }else {if(u.crop){const [l,t,r,b]=u.crop;ctx.beginPath();ctx.rect(x+l*width,y+t*height,(r-l)*width,(b-t)*height);ctx.clip();}ctx.drawImage(image,u.frame*cell,u.direction*cell,cell,cell,Math.round(x),Math.round(y),Math.round(width),Math.round(height));}ctx.restore();}
  for(const rope of [...(u.rope?[u.rope]:[]),...(u.ropes||[])])if(rope.visible){
   const points=rope.geometry.attributes.position;
   const a=projectPoint(root.localToWorld(new THREE.Vector3().fromBufferAttribute(points,0))),b=projectPoint(root.localToWorld(new THREE.Vector3().fromBufferAttribute(points,1)));
   ctx.save();ctx.strokeStyle='#705137';ctx.globalAlpha=sprite.material.opacity;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore();
  }
  for(const wake of u.wakes||[])if(wake.visible)this.line(wake);
  if(u.layers)for(const layer of u.layers)if(layer.visible&&!layer.userData.behind)this.drawPixelEnvironment(layer,projectPoint(layer.getWorldPosition(new THREE.Vector3())));
 }
 render(scene,camera){
  this.viewDirection=camera.getWorldDirection(new THREE.Vector3()).negate();const renderStart=performance.now();this.frame++;scene.updateMatrixWorld();scene.traverse(m=>{if(m.isSkinnedMesh)m.skeleton.update();});camera.updateMatrixWorld();this.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  this.pixelsPerWorldUnit=this.height*camera.zoom/(camera.top-camera.bottom);
  const zoom=camera.zoom+':'+camera.top+':'+this.width+':'+camera.quaternion.toArray().map(v=>Math.round(v*10000)).join(',');
  if(this.zoom!==zoom){this.cache.clear();this.poseCache.clear();this.domElement.dataset.clears=String(+(this.domElement.dataset.clears||0)+1);this.zoom=zoom;}
  const ctx=this.ctx;ctx.setTransform(this.ratio,0,0,this.ratio,0,0);ctx.globalAlpha=1;
  if(this.alpha)ctx.clearRect(0,0,this.width,this.height);else{ctx.fillStyle=this.background;ctx.fillRect(0,0,this.width,this.height);}
  const ground=[],units=[],lines=[],grass=[];
  const gather=g=>{if(!g.visible)return;if(g.isInstancedMesh){if(g.geometry.type==='ConeGeometry')grass.push(g);else ground.push(g);return;}if(g.isLine){lines.push(g);return;}if(g.isGroup&&(g.userData.pixelEnvironment||g.userData.asset||g.userData.worker||g.children.some(c=>c.isMesh))&&!g.children.some(c=>c.isInstancedMesh)){units.push(g);return;}for(const c of g.children)gather(c);};
  const groundLayer=m=>m.userData.pixelSurface?m.userData.layer:m.userData.tiles?3:m.userData.soil?2:0;
  gather(scene);ground.sort((a,b)=>groundLayer(a)-groundLayer(b)||Math.max(b.geometry.parameters?.width||1,b.geometry.parameters?.height||1,b.geometry.parameters?.depth||1)-Math.max(a.geometry.parameters?.width||1,a.geometry.parameters?.height||1,a.geometry.parameters?.depth||1));ground.forEach(g=>this.drawGround(g));grass.forEach(g=>this.grass(g));
  units.sort((a,b)=>this.point(b.matrixWorld.elements[12],b.matrixWorld.elements[13],b.matrixWorld.elements[14]).z-this.point(a.matrixWorld.elements[12],a.matrixWorld.elements[13],a.matrixWorld.elements[14]).z);
  const now=performance.now();const refreshIds=new Set(units.filter(root=>!root.userData.pixel&&!root.userData.pixelEnvironment&&!root.name.startsWith('tree-')&&root.name!=='rock'&&(root.userData.legs||root.userData.worker||root.userData.animate)).sort((a,b)=>(this.cache.get(a.uuid)?.time||0)-(this.cache.get(b.uuid)?.time||0)).slice(0,4).map(root=>root.uuid));
  for(const root of units){
   const center=this.project(root.matrixWorld.elements[12],root.matrixWorld.elements[13],root.matrixWorld.elements[14]);if(center.x< -200||center.x>this.width+200||center.y< -100||center.y>this.height+250)continue;
   if(root.userData.pixel){this.drawPixelCharacter(root,center);continue;}
   if(root.userData.pixelEnvironment){this.drawPixelEnvironment(root,center);continue;}
   const natural=root.name.startsWith('tree-')||root.name==='rock';const key=natural?root.name+':'+Math.round(root.scale.x*4):root.uuid;
   const u=root.userData,pose=u.worker&&u.asset&&!u.hpBar?u.asset+':'+(u.appearance||root.name.split('-')[1])+':'+Math.round(root.rotation.y/(Math.PI/4))+':'+u.current+':'+(u.cargoItem||'none')+':'+Math.floor(((u.actions?.[u.current]?.time||0)/(u.actions?.[u.current]?.getClip().duration||1))*(u.current==='Idle'?4:6)):null;
   let sprite=pose?this.poseCache.get(pose):this.cache.get(key);const moving=!!u.worker||!!u.legs||(!natural&&!!u.animate);const refresh=!pose&&moving&&(!sprite||now-sprite.time>(u.worker?85:180))&&refreshIds.has(root.uuid)&&performance.now()-now<12;
   if(!sprite||refresh){sprite=this.sprite(root);if(sprite){this.cache.set(key,sprite);if(pose){this.poseCache.set(pose,sprite);if(this.poseCache.size>512)this.poseCache.delete(this.poseCache.keys().next().value);}}}
   if(!sprite)continue;
   if(!this.alpha&&!root.name.startsWith('ghost')){const rx=Math.max(4,sprite.w*.41),ry=Math.max(2,sprite.w*.18);ctx.save();ctx.translate(center.x+sprite.w*.065,center.y+2);ctx.scale(1,ry/rx);const shadow=ctx.createRadialGradient(0,0,rx*.13,0,0,rx);shadow.addColorStop(0,'#25492450');shadow.addColorStop(.58,'#25492428');shadow.addColorStop(1,'#29472800');ctx.fillStyle=shadow;ctx.beginPath();ctx.arc(0,0,rx,0,Math.PI*2);ctx.fill();ctx.restore();}
   ctx.drawImage(sprite.canvas,center.x+sprite.dx,center.y+sprite.dy,sprite.w,sprite.h);
  }
  lines.forEach(l=>this.line(l));this.domElement.dataset.renderMs=String(Math.round(performance.now()-renderStart));
 }
 dispose(){this.cache.clear();this.poseCache.clear();this.surfacePatterns.clear();}
}
export function createRenderer({forceSoftware=false,...options}={}){
 if(forceSoftware)return new SoftwareRenderer(options);
 const probe=document.createElement('canvas');const gl=probe.getContext('webgl2',{failIfMajorPerformanceCaveat:false});
 if(gl){gl.getExtension('WEBGL_lose_context')?.loseContext();return new THREE.WebGLRenderer(options);}
 return new SoftwareRenderer(options);
}
