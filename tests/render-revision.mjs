// Renders the shipped GLBs using the game's actual CPU renderer, without a browser.
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SoftwareRenderer} from '../app/game/software-renderer.js';
const require=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/local.js');
const {createCanvas}=require('@napi-rs/canvas');
globalThis.document={createElement(){const c=createCanvas(1,1);c.dataset={};return c;}};
const sheet=createCanvas(1440,990),ctx=sheet.getContext('2d');ctx.fillStyle='#e8f0f4';ctx.fillRect(0,0,1440,990);ctx.fillStyle='#35566e';ctx.font='bold 25px sans-serif';ctx.fillText('ERDYNTH / SHIPPED 3D MODEL REVIEW',30,42);ctx.font='14px sans-serif';ctx.fillText('Game CPU renderer · orthographic camera · authored geometry and materials',30,65);
const list=[['Resident_mira','Mira / human'],['Resident_rowan','Rowan / human'],['Resident_silen','Silen / elf'],['Resident_marna','Marna / dwarf'],['Resident_hana','Hana / mage'],['Resident_vera','Vera / titan'],['Resident_lana','Lana / centaur'],['Tugboat','Tugboat']];
for(let i=0;i<list.length;i++){
 const [id,label]=list[i],bytes=await fs.readFile('public/assets/erdynth/'+id+'.glb'),loaded=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),model=loaded.scene;
 const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());model.position.sub(center);model.userData.asset=id;
 const scene=new THREE.Scene();scene.add(model);const span=Math.max(size.y*.59,size.x*.65,size.z*.58),camera=new THREE.OrthographicCamera(-span*.85,span*.85,span,-span,.01,50);camera.position.set(2.1,id.includes('Resident')?.8:3.4,7);camera.lookAt(0,0,0);
 const renderer=new SoftwareRenderer({alpha:true});renderer.setPixelRatio(1.25);renderer.setSize(340,405);renderer.render(scene,camera);
 const x=25+i%4*352,y=88+Math.floor(i/4)*450;ctx.fillStyle='#f9fbfb';ctx.fillRect(x,y,337,434);ctx.drawImage(renderer.domElement,x,y,337,405);ctx.fillStyle='#35566e';ctx.font='16px sans-serif';ctx.fillText(label,x+14,y+422);
}
await fs.writeFile('docs/revised-assets-proof.png',sheet.toBuffer('image/png'));console.log('docs/revised-assets-proof.png');
