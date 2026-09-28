import * as THREE from 'three';
import { pixelIdentity, pixelRoster, pixelClip, pixelAtlasFrame, PIXEL_HEIGHT, PIXEL_BASELINE } from './pixel-character-data.js';
import { pixelMetadata } from './pixel-character-meta.js';
import { characterDistance } from './character-movement.js';
import { characterPose } from './character-motion-state.js';

const images = new Map(), loading = new Map(), textures = new Map();
export async function loadPixelCharacters(race) {
 await Promise.all(pixelRoster(race).map(async identity => {
  if (images.has(identity.id)) return;
  if (!loading.has(identity.id)) loading.set(identity.id, Promise.all([new Promise((resolve, reject) => {
   const image = new Image();
   const timeout = setTimeout(() => reject(new Error(`캐릭터 이미지: ${identity.id}`)), 20000);
   image.onload = () => { clearTimeout(timeout); resolve(image); };
   image.onerror = () => { clearTimeout(timeout); reject(new Error(`캐릭터 이미지: ${identity.id}`)); };
   image.src = identity.sheet;
  }), fetch(identity.sheet.replace('sprites.png', 'frames.json')).then(response => {
   if (!response.ok) throw new Error(`캐릭터 동작: ${identity.id}`);
   return response.json();
  })]).then(([image, metadata]) => { images.set(identity.id, image); pixelMetadata.set(identity.id, metadata); }).finally(() => loading.delete(identity.id)));
  await loading.get(identity.id);
 }));
}

export function createPixelCharacter(index, race, appearance) {
 const identity = pixelIdentity(race, index, appearance), image = images.get(identity.id);
 if (!textures.has(identity.id)) {
  const base = new THREE.Texture(image);
  base.colorSpace = THREE.SRGBColorSpace;
  base.magFilter = base.minFilter = THREE.NearestFilter;
  base.generateMipmaps = false;
  base.needsUpdate = !!image;
  textures.set(identity.id, base);
 }
 const texture = textures.get(identity.id).clone();
 const initial = pixelAtlasFrame(0, 0, pixelMetadata.get(identity.id));
 texture.repeat.set(1 / initial.columns, 1 / initial.rows);
 texture.offset.set(0, (initial.rows - 1 - initial.row) / initial.rows);
 texture.needsUpdate = !!image;
 const material = new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: .08, depthWrite: false, toneMapped: false });
 const sprite = new THREE.Sprite(material);
 sprite.geometry.userData.shared = true;
 sprite.userData.ownedMaterial = true;
 const height = PIXEL_HEIGHT[race] || PIXEL_HEIGHT.human;
 sprite.center.set(.5, 1 - PIXEL_BASELINE);
 sprite.scale.set(height, height, 1);
 sprite.position.y = .035;
 const group = new THREE.Group();
 group.name = `resident-${race}-${identity.id}`;
 group.add(sprite);
 const shadow = new THREE.Mesh(new THREE.CircleGeometry(height * .16, 20), new THREE.MeshBasicMaterial({ color: '#183d3d', transparent: true, opacity: .16, depthWrite: false }));
 shadow.rotation.x = -Math.PI / 2;
 shadow.scale.y = .7;
 shadow.position.y = .008;
 group.add(shadow);
 group.userData = { pixel: true, worker: true, original: true, appearance: identity.id, gender: identity.gender, identity, image, texture, sprite, atlas: initial, pixelHeight: height, current: 'idle', frame: 0, direction: 0, lastTime: 0, actionTime: 0, flying: ['spirit', 'fae'].includes(race) };
 return group;
}

export function animatePixelCharacter(group, worker, time, camera) {
 const u = group.userData;
 if (!u.pixel) return false;
 if (!u.image && images.has(u.identity.id)) { u.image = images.get(u.identity.id); u.texture.image = u.image; u.texture.needsUpdate = true; }
 const cameraAzimuth = camera ? Math.atan2(camera.matrixWorld.elements[8], camera.matrixWorld.elements[10]) : Math.PI / 4;
 const distance = characterDistance(worker);
 const metadata = pixelMetadata.get(u.identity.id);
 u.motionState ||= {};
 const {action,direction,elapsed,frame}=characterPose(u.motionState,worker,time,cameraAzimuth,metadata,distance);
 u.current=action;u.actionTime=u.motionState.actionAt;u.gaitDistance=distance;
 const atlas = pixelAtlasFrame(direction, frame, metadata);
 u.sprite.center.set(atlas.anchor[0], 1 - atlas.anchor[1]);
 if (frame !== u.frame || direction !== u.direction || atlas.rows !== u.atlas.rows || atlas.row !== u.atlas.row || atlas.columns !== u.atlas.columns) {
  u.frame = frame; u.direction = direction;
  u.texture.repeat.set(1 / atlas.columns, 1 / atlas.rows);
  u.texture.offset.set(frame / atlas.columns, (atlas.rows - 1 - atlas.row) / atlas.rows);
 }
 u.atlas = atlas;
 group.position.set(worker.x, .04, worker.z);
 group.rotation.set(0, 0, 0);
 u.sprite.position.y = u.flying ? .16 + Math.sin(time * 3 + (Number(worker.id) || 0)) * .025 : .035;
 const defeated = action === 'defeat';
 const deathClip=pixelClip('defeat',metadata),deathDuration=metadata?.authoredDefeat?deathClip.frames.length/deathClip.fps:0;
 u.sprite.material.rotation = defeated&&!metadata?.authoredDefeat ? -Math.PI / 2 : 0;
 u.sprite.material.opacity = defeated ? Math.max(0,Math.min(1,1-(elapsed-deathDuration)/Math.max(.1,2-deathDuration))) : 1;
 if(defeated)u.sprite.position.y=metadata?.authoredDefeat ? .035 : .08;
 u.lastTime = time;
 return true;
}
