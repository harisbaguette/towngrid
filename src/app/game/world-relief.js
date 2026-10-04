import * as THREE from 'three';
import {MAP} from './world-grid.js';
import {mountainHeight,landformOf,mountainCourse,reliefHeight} from './landform-data.js';
import {paintWorldGround} from './world-ground.js';

// Fixed two-tile vertices at every scale: zoom never swaps a mountain silhouette.
export function reliefGeometry(cell){
 const steps=12,positions=[],uv=[],indices=[],x0=cell.cx*MAP-.5,z0=cell.cz*MAP-.5;
 for(let z=0;z<=steps;z++)for(let x=0;x<=steps;x++){
  const wx=x0+x*2,wz=z0+z*2;positions.push(x*2-12,mountainHeight(wx,wz)+.018,z*2-12);uv.push(x/steps,1-z/steps);
 }
 for(let z=0;z<steps;z++)for(let x=0;x<steps;x++){const a=z*(steps+1)+x,b=a+1,c=a+steps+1,d=c+1;indices.push(a,c,b,b,c,d);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
export function makeWorldRelief(data,cell,layout){
 const group=new THREE.Group();group.name='mountain-region-'+cell.cx+'-'+cell.cz;group.position.set(cell.cx*MAP+11.5,0,cell.cz*MAP+11.5);
 group.userData.landformSurface=true;group.userData.cell=cell;group.userData.landform=landformOf(layout).id;
 const image=paintWorldGround(data,cell.cx*MAP,cell.cz*MAP,MAP,MAP,6),texture=new THREE.CanvasTexture(image);
 texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
 const material=new THREE.MeshBasicMaterial({map:texture,toneMapped:false,side:THREE.DoubleSide});
 const mesh=new THREE.Mesh(reliefGeometry(cell),material);mesh.userData={landformSurface:true,image,texture};group.add(mesh);
 const course=mountainCourse(cell);
 if(course){
  const positions=[],uv=[],indices=[],dx=course.b[0]-course.a[0],dz=course.b[1]-course.a[1],length=Math.hypot(dx,dz),nx=-dz/length*.38,nz=dx/length*.38;
  for(const [i,p]of course.points.entries())for(const side of [-1,1]){const x=p.x+nx*side,z=p.z+nz*side;positions.push(x-group.position.x,reliefHeight(x,z)+.045,z-group.position.z);uv.push(side===-1?0:1,1-i/24);}
  for(let i=0;i<24;i++){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
  const bed=document.createElement('canvas');bed.width=16;bed.height=192;const ctx=bed.getContext('2d');ctx.fillStyle='#68b0bb';ctx.fillRect(0,0,16,192);ctx.fillStyle='#e0efdb';
  for(let y=0;y<192;y+=7){ctx.fillRect(3+(y%5),y,5,2);ctx.fillRect(2,y+3,2,4);}
  const map=new THREE.CanvasTexture(bed);map.colorSpace=THREE.SRGBColorSpace;map.magFilter=THREE.NearestFilter;
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const stream=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map,toneMapped:false,side:THREE.DoubleSide}));stream.name='mountain-cascade';stream.userData={landformSurface:true,image:bed,texture:map};group.add(stream);
 }
 return group;
}
