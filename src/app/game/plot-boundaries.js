import * as THREE from 'three';

const N=24;
let boundaryCanvas;
/** Plot boundaries are map overlays, not fences or buildable terrain. */
export function makePlotBoundaries(){
 const group=new THREE.Group();group.name='plot-boundaries';group.userData.plotSize=N;
 const points=[];
 for(let i=-2;i<=3;i++){
  const edge=i*N-.5;
  for(let j=-2;j<3;j++){
   // The four edges of the active plot have their own continuous gold line.
   if(!((i===0||i===1)&&j===0)){
    points.push(new THREE.Vector3(edge,.07,j*N-.5),new THREE.Vector3(edge,.07,(j+1)*N-.5));
    points.push(new THREE.Vector3(j*N-.5,.07,edge),new THREE.Vector3((j+1)*N-.5,.07,edge));
   }
  }
 }
 const neighbors=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineDashedMaterial({color:'#fff1c4',transparent:true,opacity:.42,dashSize:.6,gapSize:.4,depthWrite:false}));
 neighbors.name='neighbor-plot-borders';neighbors.computeLineDistances();group.add(neighbors);
 if(typeof document==='undefined')return group;
 const size=N+4,pixels=1024,scale=pixels/size,canvas=boundaryCanvas??=document.createElement('canvas');canvas.width=canvas.height=pixels;
 const ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.lineJoin='miter';
 // Wide geometry keeps this line readable on both WebGL and Canvas renderers.
 ctx.strokeStyle='#304b39';ctx.lineWidth=.34;ctx.strokeRect(2,2,N,N);
 ctx.strokeStyle='#ffdf78';ctx.lineWidth=.19;ctx.strokeRect(2,2,N,N);
 ctx.strokeStyle='#fff5c4';ctx.lineWidth=.055;ctx.strokeRect(2,2,N,N);
 for(const [x,z,sx,sz] of [[2,2,1,1],[N+2,2,-1,1],[N+2,N+2,-1,-1],[2,N+2,1,-1]]){
  ctx.beginPath();ctx.moveTo(x+sx*1.3,z);ctx.lineTo(x,z);ctx.lineTo(x,z+sz*1.3);
  ctx.strokeStyle='#304b39';ctx.lineWidth=.54;ctx.stroke();ctx.strokeStyle='#fff0a4';ctx.lineWidth=.32;ctx.stroke();
  ctx.fillStyle='#304b39';ctx.fillRect(x-.28,z-.28,.56,.56);ctx.fillStyle='#ffe399';ctx.fillRect(x-.16,z-.16,.32,.32);
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;
 const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.05,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
 const mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),material,1),dummy=new THREE.Object3D();
 dummy.position.set(11.5,.085,11.5);dummy.rotation.x=-Math.PI/2;dummy.scale.set(size,size,1);dummy.updateMatrix();mesh.setMatrixAt(0,dummy.matrix);
 mesh.name='active-plot-border';mesh.renderOrder=2;
 mesh.userData={pixelSurface:true,environmentId:'landscape-plot-border',image:canvas,texture,frame:0,repeat:[1,1],mask:null,network:null,layer:8,cells:[{x:11.5,z:11.5,w:size,h:size}]};
 group.add(mesh);return group;
}
