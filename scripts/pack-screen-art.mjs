// Encode original PNG artwork for runtime delivery; source pixels/art are not repainted.
import { createRequire } from 'node:module';
import { readdir, readFile, mkdir, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
let sharp;
try { sharp = require('sharp'); } catch {
  const store = resolve(root, 'node_modules/.pnpm');
  const entry = (await readdir(store)).find(name => name.startsWith('sharp@'));
  if (!entry) throw new Error('Run npm run setup first: the locked sharp dependency is required.');
  sharp = require(resolve(store, entry, 'node_modules/sharp'));
}
const manifests = await Promise.all(['pixel-refresh', 'daily-expansion'].map(async folder => JSON.parse(await readFile(resolve(root, `art-source/screen-concepts/2026-09-29/${folder}/manifest.json`), 'utf8'))));
let before = 0, after = 0;
for (const item of manifests.flatMap(manifest => manifest.images)) {
  const source = resolve(root, item.source), destination = resolve(root, item.output);
  await mkdir(dirname(destination), { recursive: true });
  await sharp(source).webp({ quality: 90, effort: 6, smartSubsample: true }).toFile(destination);
  // Small gallery previews; full artwork is fetched only when viewed.
  await sharp(source).resize(240, 135, { fit: 'cover', kernel: 'nearest' }).webp({ quality: 85, effort: 6 }).toFile(destination.replace(/\.webp$/, '-thumb.webp'));
  const input = (await stat(source)).size, output = (await stat(destination)).size;
  before += input; after += output;
  console.log(`${item.id}: ${input} -> ${output} bytes`);
}
console.log(`Runtime artwork: ${before} -> ${after} bytes (${Math.round((1 - after / before) * 100)}% smaller).`);
