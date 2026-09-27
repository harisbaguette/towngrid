// Atlas extraction only: artwork is generated, not procedurally drawn.
// sharp is already provided by the pinned Wrangler -> Miniflare dependency.
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const wrangler = createRequire(import.meta.resolve('wrangler'));
const sharp = createRequire(wrangler.resolve('miniflare'))('sharp');
const root = fileURLToPath(new URL('../', import.meta.url));
const sourceDir = path.join(root, 'art-source/pixel-environment');
const outputDir = path.join(root, 'public/assets/pixel-environment');
await mkdir(sourceDir, { recursive: true });
await mkdir(outputDir, { recursive: true });
const spec = JSON.parse(await readFile(path.join(sourceDir, 'pack-manifest.json'), 'utf8'));
if (process.argv[2]) await copyFile(path.resolve(process.argv[2]), path.join(sourceDir, spec.source));
const cell = spec.cellSize;
for (const [id, asset] of Object.entries(spec.assets)) {
  const source = path.join(sourceDir, asset.source || spec.source);
  const metadata = await sharp(source).metadata();
  const rects = asset.rects || Array.from({ length: asset.grid[0] * asset.grid[1] }, (_, index) => {
    const x = index % asset.grid[0], y = Math.floor(index / asset.grid[0]);
    const left = Math.floor(x * metadata.width / asset.grid[0]);
    // Generated rows are not always exactly spaced. Explicit row boundaries
    // keep a low foundation or tall chimney out of the neighbouring cell.
    const top = asset.rowBounds?.[y]?.[0] ?? Math.floor(y * metadata.height / asset.grid[1]);
    const bottom = asset.rowBounds?.[y]?.[1] ?? Math.floor((y + 1) * metadata.height / asset.grid[1]);
    return [left, top, Math.floor((x + 1) * metadata.width / asset.grid[0]) - left, bottom - top];
  });
  const columns = asset.columns || asset.grid?.[0] || rects.length, rows = Math.ceil(rects.length / columns);
  const crops = await Promise.all(rects.map(async ([left, top, width, height]) => {
    const raw = await sharp(source).extract({ left, top, width, height }).ensureAlpha().raw().toBuffer();
    // Binary cutout alpha avoids colored, almost-transparent export fringes.
    for (let i = 3; i < raw.length; i += 4) raw[i] = raw[i] >= 160 ? 255 : 0;
    const buf = await sharp(raw, { raw: { width, height, channels: 4 } }).png().toBuffer();
    return asset.opaqueTile ? buf : sharp(buf).trim({ background: '#00000000', threshold: 0 }).png().toBuffer();
  }));
  const bounds = await Promise.all(crops.map(crop => sharp(crop).metadata()));
  // All frames use ONE scale, including stump and saplings; no frame-by-frame resizing.
  const scale = asset.opaqueTile ? 1 : Math.min(asset.fit[0] / Math.max(...bounds.map(b => b.width)), asset.fit[1] / Math.max(...bounds.map(b => b.height)));
  const layers = [];
  for (let i = 0; i < crops.length; i++) {
    const width = asset.opaqueTile ? cell : Math.round(bounds[i].width * scale);
    const height = asset.opaqueTile ? cell : Math.round(bounds[i].height * scale);
    const input = await sharp(crops[i]).resize(width, height, { kernel: 'nearest' }).png().toBuffer();
    layers.push({ input, left: (i % columns) * cell + Math.floor((cell - width) / 2), top: Math.floor(i / columns) * cell + (asset.opaqueTile ? 0 : asset.baseline - height) });
  }
  const atlas = await sharp({ create: { width: cell * columns, height: cell * rows, channels: 4, background: '#00000000' } }).composite(layers).png().toBuffer();
  await writeFile(path.join(outputDir, `${id}.png`), atlas);
  if (asset.directions) await sharp(atlas).extract({ left: (asset.iconFrame || 0) * cell, top: 0, width: cell, height: cell }).png().toFile(path.join(outputDir, `${id}-icon.png`));
  console.log(`${id}: ${crops.length} cells, ${cell * columns} x ${cell * rows}`);
}
await writeFile(path.join(outputDir, 'frames.json'), JSON.stringify(spec, null, 2) + '\n');
