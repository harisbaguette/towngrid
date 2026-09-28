// Build TownGrid.exe at the project root from TownGrid.cs, using the brand symbol PNGs as its icon.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const here = fileURLToPath(new URL('./', import.meta.url));
const sizes = [16, 32, 48, 64, 128, 256];

// ICO with PNG-compressed entries (supported by Windows Vista and later).
function buildIcon() {
  const images = sizes.map((size) => readFileSync(join(root, `public/assets/brand/towngrid-icon-${size}.png`)));
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach((png, i) => {
    const entry = 6 + 16 * i;
    const size = sizes[i];
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images]);
}

if (process.platform !== 'win32') throw new Error('The launcher is a Windows executable; build it on Windows.');
const csc = join(process.env.WINDIR ?? 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
if (!existsSync(csc)) throw new Error(`C# compiler not found: ${csc}`);

const work = mkdtempSync(join(tmpdir(), 'towngrid-launcher-'));
try {
  const icon = join(work, 'towngrid.ico');
  writeFileSync(icon, buildIcon());
  const result = spawnSync(csc, [
    '/nologo', '/target:winexe', '/optimize+', '/codepage:65001',
    `/win32icon:${icon}`, `/out:${join(root, 'TownGrid.exe')}`,
    '/r:System.Windows.Forms.dll', '/r:System.Drawing.dll', '/r:System.Runtime.Serialization.dll',
    join(here, 'TownGrid.cs'),
  ], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  console.log('Built TownGrid.exe');
} finally {
  rmSync(work, { recursive: true, force: true });
}
