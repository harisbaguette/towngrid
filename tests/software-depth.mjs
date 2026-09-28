import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SoftwareRenderer} from '../src/app/game/software-renderer.js';
// Crossed surfaces exercise the old painter-order failure: each side has a
// different nearest material even though both triangles share a centre depth.
globalThis.document={createElement(){const canvas={};canvas.getContext=()=>({createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4),width:w,height:h};},putImageData(buffer){canvas.pixels=buffer.data;}});return canvas;}};
const renderer=new SoftwareRenderer({alpha:true});renderer.setSize(80,80);
const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10);camera.position.z=5;camera.lookAt(0,0,0);camera.updateMatrixWorld();renderer.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
const root=new THREE.Group();const blue=new THREE.Mesh(new THREE.PlaneGeometry(1.6,1.6),new THREE.MeshStandardMaterial({color:'#0000ff',side:THREE.DoubleSide}));
const red=new THREE.Mesh(new THREE.PlaneGeometry(1.6,1.6),new THREE.MeshStandardMaterial({color:'#ff0000',side:THREE.DoubleSide}));red.rotation.y=Math.PI/3;root.add(red,blue);root.updateMatrixWorld(true);
const sprite=renderer.sprite(root),read=(x,y)=>{const i=((Math.floor(y-40-sprite.dy))*sprite.canvas.width+Math.floor(x-40-sprite.dx))*4;return Array.from(sprite.canvas.pixels.slice(i,i+4));};
const left=read(32,40),right=read(48,40);assert.ok(left[0]>150&&left[2]===0,`near left surface must be red: ${left}`);assert.ok(right[2]>150&&right[0]===0,`near right surface must be blue: ${right}`);
console.log('PASS CPU depth resolves intersecting curved-mesh surfaces independently per pixel.');
