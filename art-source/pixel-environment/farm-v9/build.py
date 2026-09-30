# Regenerate every farm-v9 source sheet, its pack-manifest entries and the
# runtime socket table. Usage (repo root):
#   python art-source/pixel-environment/farm-v9/build.py
#   node scripts/pack-pixel-environment.mjs --only=<ids printed at the end>
#   node scripts/pack-resource-icons.mjs
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from pixel_kit import BUILDING_VIEW, building_views, fit_sprite, render_vox  # noqa: E402
import buildings  # noqa: E402
import sprites  # noqa: E402

ROOT = HERE.parents[2]
ENV = HERE.parent
CELL = 192
VIEWS = ['SE', 'NE', 'NW', 'SW']

# Facility order follows docs/EXPANSION_20260929.md section 2.
FACILITIES = ['sugarfield', 'saltfield', 'vineyard', 'cocoafarm', 'berryfield', 'mintfield', 'pumpkinpatch', 'oakfarm',
              'winery', 'chocolatier', 'sheeppen', 'milkbarn', 'apiary', 'duckhouse', 'feedmill',
              'sandpit', 'clayfield', 'packshop', 'solarpanel', 'pond', 'pasture', 'clover',
              # section 6 (2026-09-30)
              'shallowmine', 'windpump']
# Resource order follows section 1; the runtime atlas appends them after the 36 existing goods.
GOODS = ['sugarcane', 'salt', 'grapered', 'grapewhite', 'cocoa', 'strawberry', 'mint', 'pumpkin', 'oakwood',
         'sugar', 'winered', 'winewhite', 'barrel', 'chocolate', 'jam', 'candy', 'pie', 'lantern',
         'wool', 'yarn', 'milk', 'butter', 'honey', 'wax', 'feed', 'duckegg',
         'clay', 'sand', 'limestone', 'chromium', 'bluesteel',
         'woodbox', 'clothbox', 'foodparcel', 'giftparcel']
# Section 6 goods: own atlas farmGoods2, appended after the 71 goods.
GOODS2 = list(sprites.GOODS2)
CROPS = list(sprites.CROPS)
PARTS = list(sprites.PARTS)

# Work-part sockets in model cells (i, j, k). A socket hidden behind the
# architecture in a view is exported as null so the part is not drawn there.
SOCKETS = {
    'winery': {'press': (10, 30, 16)},
    'chocolatier': {'fire': (31, 36.2, 7), 'steam': (31, 31, 22)},
    'feedmill': {'steam': (10, 10, 39), 'wheel': (31.5, 32.2, 11)},
    'sandpit': {'pick': (18, 20, 7)},
    'clayfield': {'pick': (19, 15, 5)},
    'packshop': {'belt': (30, 11, 11)},
    'solarpanel': {'lamp': (36, 38.2, 12)},
    'apiary': {'bees': (20, 20, 22)},
    'shallowmine': {'pulley': (16, 16.6, 25.5)},
    'windpump': {'rotor': (18, 23.5, 34.5)},
}
# A wind wheel is far wider than the gear head it hangs on, so it is never
# fully hidden; its socket stays visible in every view.
ALWAYS_VISIBLE = {('windpump', 'rotor')}
# Plot centres shared by every field model (buildings.PLOTS) on the soil top.
CROP_SOCKETS = [(i, j, 7) for i, j in buildings.PLOTS]


def rotate(i, j, view, n=buildings.N):
    for _ in range(view):
        i, j = n - j, i
    return i, j


def screen(i, j, k, view):
    v = BUILDING_VIEW
    a, b = rotate(i, j, view)
    x = v['ox'] + (a - b) * v['sx']
    y = v['oy'] + (a + b) * v['sy'] - k * v['sz']
    return x, y, a + b + k * (2 * v['sy'] / v['sz'])


def sockets_for(fid, model):
    out = {}
    depth = [render_vox(model, view, **BUILDING_VIEW)[2] for view in range(4)]
    for name, (i, j, k) in SOCKETS.get(fid, {}).items():
        pts = []
        for view in range(4):
            x, y, d = screen(i, j, k, view)
            buf = depth[view][int(min(95, max(0, y))), int(min(95, max(0, x)))]
            hidden = buf > d + 2.0 and (fid, name) not in ALWAYS_VISIBLE
            pts.append(None if hidden else [round(x * 2), round(y * 2)])
        out[name] = pts
    return out


def superseded():
    """Assets that farm-v11/farm-v12 replaced with image-model art. Their
    manifest entries are left alone so this generator never reverts them; run
    scripts/pack-farm-refresh.mjs afterwards (see farm-v11/README.md)."""
    ids = set()
    for folder in ('farm-v11', 'farm-v12'):
        path = ENV / folder / 'manifest.json'
        if not path.exists():
            continue
        spec = json.loads(path.read_text(encoding='utf8'))
        ids |= {i for group in spec.get('buildingFiles', {}).values() for i in group}
        ids |= {i for entry in spec.get('buildings', []) for i in entry.get('ids', [])}
        ids |= {i for entry in spec.get('crops', []) for i in entry.get('ids', [])}
        if spec.get('resources') or spec.get('goods'):
            ids.add('farmGoods')
    # Only ids whose refreshed atlas is actually registered count; a planned
    # but unpacked refresh must not leave the facility without a picture.
    manifest = json.loads((ENV / 'pack-manifest.json').read_text(encoding='utf8'))
    return {i for i in ids if str(manifest['assets'].get(i, {}).get('source', '')).startswith(('farm-v11/', 'farm-v12/'))}


def main():
    manifest_path = ENV / 'pack-manifest.json'
    keep = superseded()
    manifest = json.loads(manifest_path.read_text(encoding='utf8'))
    record = {'generator': 'art-source/pixel-environment/farm-v9/build.py', 'kind': 'script-drawn pixel art',
              'note': 'Deterministic voxel/sprite drawing, not image-model artwork. Rows SE, NE, NW, SW.',
              'buildingView': BUILDING_VIEW, 'facilities': FACILITIES, 'goods': GOODS, 'goods2': GOODS2, 'crops': CROPS, 'parts': PARTS}

    sheet = Image.new('RGBA', (CELL * 4, CELL * len(FACILITIES)), (0, 0, 0, 0))
    sockets = {}
    for row, fid in enumerate(FACILITIES):
        model = buildings.BUILDERS[fid]()
        for view, cell in enumerate(building_views(model)):
            sheet.alpha_composite(cell, (view * CELL, row * CELL))
        sockets[fid] = sockets_for(fid, model)
        if fid in keep:
            continue
        manifest['assets'][fid] = {
            'source': 'farm-v9/buildings-source.png', 'rects': [[view * CELL, row * CELL, CELL, CELL] for view in range(4)],
            'columns': 1, 'directions': VIEWS, 'opaqueTile': True, 'baseline': 181, 'anchor': [.5, .69], 'size': 1.4,
            'worldFootprint': [1, 1], 'states': {'static': [0]}, 'generator': 'farm-v9/build.py'}
    sheet.save(HERE / 'buildings-source.png')

    crops = Image.new('RGBA', (CELL * 4, CELL * len(CROPS)), (0, 0, 0, 0))
    for row, cid in enumerate(CROPS):
        for stage in range(4):
            crops.alpha_composite(sprites.CROPS[cid](stage).image(), (stage * CELL, row * CELL))
        if cid in keep:
            continue
        manifest['assets'][cid] = {'source': 'farm-v9/crops-source.png', 'rects': [[s * CELL, row * CELL, CELL, CELL] for s in range(4)],
                                   'columns': 4, 'opaqueTile': True, 'anchor': [.5, .94], 'generator': 'farm-v9/build.py'}
    crops.save(HERE / 'crops-source.png')

    goods = Image.new('RGBA', (CELL * len(GOODS), CELL), (0, 0, 0, 0))
    for n, gid in enumerate(GOODS):
        goods.alpha_composite(fit_sprite(sprites.GOODS[gid]), (n * CELL, 0))
    goods.save(HERE / 'goods-source.png')
    if 'farmGoods' not in keep:
        manifest['assets']['farmGoods'] = {'source': 'farm-v9/goods-source.png', 'rects': [[n * CELL, 0, CELL, CELL] for n in range(len(GOODS))],
                                           'columns': len(GOODS), 'opaqueTile': True, 'anchor': [.5, .5], 'order': GOODS, 'generator': 'farm-v9/build.py'}

    goods2 = Image.new('RGBA', (CELL * len(GOODS2), CELL), (0, 0, 0, 0))
    for n, gid in enumerate(GOODS2):
        goods2.alpha_composite(fit_sprite(sprites.GOODS2[gid]), (n * CELL, 0))
    goods2.save(HERE / 'goods2-source.png')
    manifest['assets']['farmGoods2'] = {'source': 'farm-v9/goods2-source.png', 'rects': [[n * CELL, 0, CELL, CELL] for n in range(len(GOODS2))],
                                        'columns': len(GOODS2), 'opaqueTile': True, 'anchor': [.5, .5], 'order': GOODS2, 'generator': 'farm-v9/build.py'}

    parts = Image.new('RGBA', (CELL * len(PARTS), CELL), (0, 0, 0, 0))
    for n, pid in enumerate(PARTS):
        parts.alpha_composite(sprites.PARTS[pid](), (n * CELL, 0))
    parts.save(HERE / 'parts-source.png')
    manifest['assets']['farmParts'] = {'source': 'farm-v9/parts-source.png', 'rects': [[n * CELL, 0, CELL, CELL] for n in range(len(PARTS))],
                                       'columns': len(PARTS), 'opaqueTile': True, 'anchor': [.5, .5], 'order': PARTS, 'generator': 'farm-v9/build.py'}

    crop_pos = [[round(screen(i, j, k, 0)[0] * 2), round(screen(i, j, k, 0)[1] * 2)] for i, j, k in CROP_SOCKETS]
    record['sockets'] = sockets
    record['cropPositions'] = crop_pos
    (HERE / 'generation.json').write_text(json.dumps(record, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf8')

    js = ['// Generated by art-source/pixel-environment/farm-v9/build.py. Do not edit by hand.',
          '// Screen positions (packed 192px cell) of work-part sockets per view SE, NE, NW, SW;',
          '// null means the socket is hidden behind the architecture in that view.',
          'export const FARM_SOCKETS = ' + json.dumps(sockets, separators=(',', ':')) + ';',
          '// Crop roots are view-independent because the four plots are symmetric about the tile centre.',
          'export const FARM_CROP_POSITIONS = ' + json.dumps(crop_pos) + ';',
          'export const FARM_GOODS_ORDER = ' + json.dumps(GOODS) + ';',
          '// Section 6 goods (2026-09-30), own atlas, appended after all earlier goods.',
          'export const FARM_GOODS2_ORDER = ' + json.dumps(GOODS2) + ';',
          'export const FARM_CROP_ATLASES = ' + json.dumps(CROPS) + ';',
          'export const FARM_PART_FRAMES = ' + json.dumps({p: n for n, p in enumerate(PARTS)}) + ';', '']
    (ROOT / 'src/app/game/pixel-farm-sockets.js').write_text('\n'.join(js), encoding='utf8')
    print('--only=' + ','.join([f for f in FACILITIES if f not in keep] + [c for c in CROPS if c not in keep] + [a for a in ('farmGoods', 'farmGoods2', 'farmParts') if a not in keep]))
    if keep:
        print('farm-v11 keeps ' + ','.join(sorted(keep)) + ': run node scripts/pack-farm-refresh.mjs next')


if __name__ == '__main__':
    main()
