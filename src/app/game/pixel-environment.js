import * as THREE from 'three';
import { ENVIRONMENT_ASSETS, pixelBuildingFrame, oakFrame, waterFrame } from './pixel-environment-data.js';
import { QUARTER_POLAR, quarterAzimuth } from './quarter-camera.js';

const images = new Map(), pending = new Map(), alphaMasks = new Map(), baseTextures = new Map();
export async function loadPixelEnvironment() {
 await Promise.all(Object.entries(ENVIRONMENT_ASSETS).map(async ([id, spec]) => {
  if (images.has(id)) return;
  if (!pending.has(id)) pending.set(id, new Promise((resolve, reject) => {
   const image = new Image();
   const timeout = setTimeout(() => reject(new Error(`환경 이미지: ${id}`)), 20000);
   image.onload = () => {
    clearTimeout(timeout);
    try {
     if (spec.building) {
      const canvas = document.createElement('canvas');canvas.width = image.width;canvas.height = image.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });context.drawImage(image, 0, 0);
      alphaMasks.set(id, context.getImageData(0, 0, image.width, image.height).data);
     }
     images.set(id, image);resolve();
    } catch (error) { reject(error); }
   };
   image.onerror = () => { clearTimeout(timeout); reject(new Error(`환경 이미지: ${id}`)); };
   image.src = spec.sheet;
  }).finally(() => pending.delete(id)));
  await pending.get(id);
 }));
}

function textureFor(id) {
 const spec = ENVIRONMENT_ASSETS[id];
 if (!baseTextures.has(id)) {
  const base = new THREE.Texture(images.get(id));
  base.colorSpace = THREE.SRGBColorSpace;
  base.magFilter = base.minFilter = THREE.NearestFilter;
  base.generateMipmaps = false;
  baseTextures.set(id, base);
 }
 // Clones have independent frame UVs but share one GPU image source per atlas.
 const texture = baseTextures.get(id).clone();
 texture.repeat.set(1 / spec.frames, 1 / (spec.directions || 1));
 texture.offset.y = 1 - 1 / (spec.directions || 1);
 texture.needsUpdate = images.has(id);
 return texture;
}

function setFrame(object, frame, direction = 0) {
 const u = object.userData;
 if (!u.image && images.has(u.environmentId)) {
  u.image = images.get(u.environmentId);
  u.texture.image = u.image;
  u.texture.needsUpdate = true;
 }
 u.frame = frame;
 const spec = ENVIRONMENT_ASSETS[u.environmentId], rows = spec.directions || 1;
 u.direction = ((direction % rows) + rows) % rows;
 u.texture.offset.set(frame / spec.frames, (rows - 1 - u.direction) / rows);
 if (spec.building) {
  // Keep the drawn footprint centred on its tile while lifting the billboard
  // out of the opaque ground. Moving along the view ray preserves its screen
  // position; a vertical-only lift would make the building appear to float.
  const lift = Math.max(0, (181 / 192 - spec.anchor[1]) * spec.size * Math.sin(QUARTER_POLAR)) + .01;
  u.sprite.position.setFromSphericalCoords(lift / Math.cos(QUARTER_POLAR), QUARTER_POLAR, quarterAzimuth(u.direction));
 }
}

function createSprite(id, scale = 1) {
 const spec = ENVIRONMENT_ASSETS[id], texture = textureFor(id);
 const material = new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: .5, depthWrite: true, toneMapped: false });
 const sprite = new THREE.Sprite(material);
 sprite.geometry.userData.shared = true;
 sprite.userData.ownedMaterial = true;
 sprite.center.set(spec.anchor[0], 1 - spec.anchor[1]);
 sprite.scale.set(spec.size, spec.size, 1);
 const group = new THREE.Group();
 group.name = id === 'oak' ? 'tree-pixel-oak' : id;
 group.scale.setScalar(scale);
 group.add(sprite);
 group.userData = { pixelEnvironment: true, environmentId: id, image: images.get(id), texture, sprite, frame: 0, direction: 0 };
 // A transparent corner must select the ground behind it, not the sprite's box.
 const raycast = sprite.raycast;
 sprite.raycast = function (raycaster, intersections) {
  const hits = [];raycast.call(this, raycaster, hits);
  const u = group.userData, image = images.get(id), pixels = alphaMasks.get(id);
  for (const hit of hits) {
   if (pixels && image && hit.uv) {
    const cell = image.width / spec.frames;
    const x = u.frame * cell + Math.min(cell - 1, Math.max(0, Math.floor(hit.uv.x * cell)));
    const y = u.direction * cell + Math.min(cell - 1, Math.max(0, Math.floor((1 - hit.uv.y) * cell)));
    if (pixels[(y * image.width + x) * 4 + 3] < 128) continue;
   }
   intersections.push(hit);
  }
 };
 return group;
}

export function makePixelSawmill(race) {
 return makePixelBuilding('sawmill', race);
}

export function makePixelBuilding(type, race) {
 if (!ENVIRONMENT_ASSETS[type]?.building) return null;
 const group = createSprite(type);
 group.userData.race = race;
 group.userData.animate = (time, building, sim, view = 0) => setFrame(group, pixelBuildingFrame(type, building, time, sim), view);
 return group;
}

export function makePixelTree(kind = 0, scale = 1) {
 const group = createSprite('oak', scale);
 group.userData.phase = kind * .47;
 group.userData.animate = (time, tile, harvesting = false) => setFrame(group, oakFrame(tile, time, harvesting, group.userData.phase));
 return group;
}

export function makePixelWater(count, width = 1.005, height = 1.005) {
 const texture = textureFor('water');
 const water = new THREE.InstancedMesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }), count);
 water.userData = { pixelWater: true, environmentId: 'water', texture, image: images.get('water'), frame: 0 };
 water.userData.animate = time => setFrame(water, waterFrame(time));
 return water;
}
