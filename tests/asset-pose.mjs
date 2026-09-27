import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {posedBounds} from '../app/game/assets.js';
// Geometry-only loading: textures are tested by the live browser, skinning here.
globalThis.self=globalThis;
globalThis.ProgressEvent=class{constructor(type,values){Object.assign(this,values);}};
for(const name of ['StoneTitan','Horse','Robot']){
 const bytes=fs.readFileSync(`public/assets/characters/${name}.glb`),length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length));
 json.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+length).toString('base64');json.images=[];json.textures=[];json.materials=[];
 for(const mesh of json.meshes)for(const primitive of mesh.primitives)delete primitive.material;
 const source=await new GLTFLoader().parseAsync(JSON.stringify(json),''),root=clone(source.scene),mixer=new THREE.AnimationMixer(root),clip=source.animations.find(c=>/Idle$/.test(c.name));
 assert.ok(clip,`${name} has an authored idle animation`);mixer.clipAction(clip).play();mixer.update(.17);
 const initial=posedBounds(root),size=initial.getSize(new THREE.Vector3());root.scale.setScalar(1/size.y);root.position.y=-initial.min.y/size.y;
 // Read animated vertex positions directly; cached boxes must not shrink the rig.
 root.updateMatrixWorld(true);const actual=new THREE.Box3();root.traverse(mesh=>{if(!mesh.isMesh)return;mesh.skeleton?.update();const vertices=mesh.geometry.attributes.position;for(let i=0;i<vertices.count;i++){const v=new THREE.Vector3().fromBufferAttribute(vertices,i);if(mesh.isSkinnedMesh)mesh.applyBoneTransform(i,v);actual.expandByPoint(v.applyMatrix4(mesh.matrixWorld));}});
 const rendered=actual.getSize(new THREE.Vector3());assert.ok(rendered.y>.9&&rendered.y<1.1,`${name}: visible height ${rendered.y}`);assert.ok(rendered.x>.1&&rendered.z>.1);mixer.stopAllAction();mixer.uncacheRoot(root);
 console.log('PASS animated clone keeps visible normalized geometry:',name);
}
