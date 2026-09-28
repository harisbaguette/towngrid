// Copies generated originals and builds a virtual atlas. No image pixels are edited.
// Only the isolated approval preview is written; production character assets are untouched.
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'art-source/pixel-characters/prototypes/mira-v2');
const target = resolve(root, 'public/character-preview/mira');
const bounds = {
  rotation: [[78,14,160,199],[270,14,360,200],[456,12,544,200],[624,12,715,199],[821,12,900,199],[995,12,1086,199],[1181,13,1269,200],[1368,14,1463,199]],
  idle: [[56,214,155,403],[242,214,341,403],[427,216,526,403],[612,214,712,403],[797,214,895,403],[982,214,1082,403],[1169,214,1267,403],[1358,214,1457,403]],
  work: [[55,420,156,606],[241,420,345,606],[427,422,545,606],[605,410,735,606],[793,422,928,606],[988,430,1148,607],[1174,420,1294,607],[1362,422,1463,606]],
  greet: [[56,621,155,809],[246,621,358,809],[431,620,541,809],[614,620,736,809],[802,620,920,809],[985,624,1112,809],[1176,623,1278,809],[1362,623,1460,809]],
  cargo: [[45,818,192,1000],[242,834,371,1000],[431,852,556,1000],[612,824,729,999],[794,818,917,1000],[986,841,1123,1000],[1179,856,1308,1000],[1355,818,1501,1000]],
  walk: [[110,30,418,497],[464,39,703,497],[813,28,1041,497],[1200,23,1438,497],[97,516,425,981],[474,524,701,984],[818,517,1048,984],[1202,512,1436,982]],
};
const origins = {
  rotation: [120,307,491,669,861,1048,1235,1428],
  idle: [122,308,494,680,865,1050,1236,1425],
  work: [120,305,491,676,862,1050,1234,1425],
  greet: [122,310,495,680,865,1050,1238,1428],
  cargo: [117,304,489,676,862,1050,1237,1421],
  walk: [263,620,974,1325,267,624,986,1327],
};
const baselines = { rotation: 201, idle: 404, work: 608, greet: 810, cargo: 1001, walk: [498,498,498,498,982,985,985,983] };
const fps = { rotation: 2, idle: 4, work: 8, greet: 7, cargo: 5, walk: 10 };
const manifest = {
  version: 2, identity: 'mira', status: 'in-game-test', background: '#eeeae0',
  images: { study: 'study.png', motions: 'motions.png', walk: 'walk.png', walkQuarter: 'walk-quarter.png' },
  directions: ['SW','NW','NE','SE'],
  notes: '68 source poses: walking has SW/NW/NE/SE x 8 frames; rotation has four diagonal idle views. Other actions still face E. Opaque cream review sheets, not production RGBA sprites. Rects and anchors use source-image pixels. Fixed scale per clip preserves drawn anticipation/crouching. The walking draft still needs clearer opposite-leg contacts and silhouette cleanup.',
  clips: Object.fromEntries(Object.entries(bounds).map(([action, boxes]) => [action, {
    image: action === 'walk' ? 'walk' : 'motions', fps: fps[action], nominalHeight: action === 'walk' ? 470 : 188,
    frames: boxes.map(([left,top,right,bottom], i) => ({
      rect: [left-2, top-2, right-left+5, bottom-top+5],
      anchor: [origins[action][i], Array.isArray(baselines[action]) ? baselines[action][i] : baselines[action]],
    })),
  }])),
};
manifest.clips.rotation.frames = [1,3,5,7].map(index => manifest.clips.rotation.frames[index]);
// Reviewed crop boxes from the new four-direction original; fixed floor per row.
const quarterBoxes = [
  [[44,16,178,254],[236,16,366,254],[431,14,554,255],[603,16,735,255],[794,16,927,255],[986,15,1115,255],[1175,14,1304,255],[1357,15,1492,254]],
  [[44,263,180,501],[235,264,372,499],[429,267,560,501],[607,264,742,502],[793,264,929,501],[989,265,1121,497],[1177,267,1308,501],[1356,264,1495,501]],
  [[44,512,176,751],[235,512,371,751],[428,513,555,748],[610,512,746,751],[793,512,933,751],[985,512,1119,751],[1171,512,1296,748],[1357,512,1491,751]],
  [[33,759,170,995],[219,759,350,996],[409,758,532,996],[593,759,729,996],[784,759,920,996],[973,758,1108,996],[1165,759,1292,996],[1347,759,1481,996]],
];
const quarterOrigins = [
  [109,298,485,670,861,1047,1232,1422],
  [103,297,486,665,851,1047,1234,1415],
  [120,311,502,689,877,1061,1248,1436],
  [106,291,480,667,859,1047,1236,1418],
];
const quarterFloors = [256,503,752,997];
const facings = Object.fromEntries(manifest.directions.map((direction, row) => [direction, quarterBoxes[row].map(([left,top,right], column) => ({
  rect: [left-2, top-2, right-left+5, quarterFloors[row]-top+5],
  anchor: [quarterOrigins[row][column], quarterFloors[row]],
}))]));
manifest.clips.walk = { image: 'walkQuarter', fps: 10, nominalHeight: 240, frames: facings.SW, facings };
mkdirSync(target, { recursive: true });
for (const filename of Object.values(manifest.images)) {
  const bytes = readFileSync(resolve(source, filename));
  assert.equal(bytes.readUInt32BE(16), 1536, `${filename}: width changed, review crop rects`);
  assert.equal(bytes.readUInt32BE(20), 1024, `${filename}: height changed, review crop rects`);
  copyFileSync(resolve(source, filename), resolve(target, filename));
}
for (const [action, clip] of Object.entries(manifest.clips)) {
  assert.equal(clip.frames.length, action === 'rotation' ? 4 : 8);
  for (const { rect: [x,y,w,h], anchor: [ax,ay] } of clip.facings ? Object.values(clip.facings).flat() : clip.frames) {
    assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x+w <= 1536 && y+h <= 1024);
    assert.ok(ax >= x && ax <= x+w && ay >= y && ay <= y+h);
  }
}
const json = JSON.stringify(manifest, null, 2) + '\n';
writeFileSync(resolve(source, 'pack-manifest.json'), json);
writeFileSync(resolve(target, 'frames.json'), json);
writeFileSync(resolve(target, 'frames.js'), `window.MIRA_PREVIEW = ${json.trim()};\n`);
assert.deepEqual(Object.keys(facings), manifest.directions);
assert.ok(Object.values(facings).every(frames => frames.length === 8));
console.log('Mira approval preview: 4 originals copied, 68 frame rectangles and foot anchors checked; four-direction walking draft.');
