"""Pack the reviewed Mira sources for an in-game test; never synthesize poses."""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import binary_propagation


def transparent_crop(image, rect, background):
    x, y, w, h = rect
    pixels = np.array(image.crop((x, y, x + w, y + h)).convert('RGBA'))
    rgb = pixels[:, :, :3].astype(np.int16)
    # Only the cream backdrop connected to the crop boundary is discarded.
    # Enclosed cream clothing keeps its original pixels and opacity.
    candidate = ((rgb.min(axis=2) >= background['minimumChannel']) &
                 (np.ptp(rgb, axis=2) <= background['maximumSpread']))
    seed = np.zeros_like(candidate)
    seed[0, :] = candidate[0, :]; seed[-1, :] = candidate[-1, :]
    seed[:, 0] = candidate[:, 0]; seed[:, -1] = candidate[:, -1]
    backdrop = binary_propagation(seed, mask=candidate)
    pixels[:, :, 3][backdrop] = 0
    return Image.fromarray(pixels)


def pack_mira_runtime(spec_path, output):
    spec_path = Path(spec_path)
    spec = json.loads(spec_path.read_text(encoding='utf-8'))
    source = spec_path.parent
    preview = json.loads((source / spec['previewManifest']).read_text(encoding='utf-8'))
    images = {key: Image.open(source / name).convert('RGBA') for key, name in preview['images'].items()}
    legacy = Image.open(source / spec['legacyAtlas']).convert('RGBA')
    old_meta = json.loads((source / spec['legacyMetadata']).read_text(encoding='utf-8'))
    cell, baseline = spec['cell'], spec['baseline']
    columns = ['idle'] + [f'walk-{i + 1}' for i in range(8)] + ['carry-left', 'carry-right', 'work-windup', 'work-contact']
    atlas = Image.new('RGBA', (cell * len(columns), cell * 4))
    anchors, provenance = [], []
    for row, direction in enumerate(preview['directions']):
        row_anchors, row_sources = [], []
        idle = preview['clips']['rotation']
        walk = preview['clips']['walk']
        frames = [(idle, idle['frames'][row])] + [(walk, f) for f in walk['facings'][direction]]
        for column, (clip, frame) in enumerate(frames):
            cut = transparent_crop(images[clip['image']], frame['rect'], spec['background'])
            scale = spec['bodyHeight'] / clip['nominalHeight']
            resized = cut.resize((round(cut.width * scale), round(cut.height * scale)), Image.Resampling.NEAREST)
            x, y = frame['rect'][:2]
            ax, ay = frame['anchor']
            left, top = round(cell / 2 - (ax - x) * scale), round(baseline - (ay - y) * scale)
            if left < 0 or top < 0 or left + resized.width > cell or top + resized.height > cell:
                raise ValueError(f'{direction}/{column}: artwork exceeds cell')
            atlas.alpha_composite(resized, (column * cell + left, row * cell + top))
            row_anchors.append([.5, baseline / cell])
            row_sources.append({'image': preview['images'][clip['image']], **frame, 'scale': scale, 'cellOffset': [left, top]})
        for index, old_column in enumerate(spec['legacyColumns'], len(frames)):
            tile = legacy.crop((old_column * cell, row * cell, (old_column + 1) * cell, (row + 1) * cell))
            atlas.paste(tile, (index * cell, row * cell))
            row_anchors.append(old_meta['anchors'][row][old_column])
            row_sources.append({'image': spec['legacyAtlas'], 'row': row, 'column': old_column})
        anchors.append(row_anchors); provenance.append(row_sources)
    clips = {
        'idle': {'frames': [0], 'fps': 1},
        'walk': {'frames': list(range(1, 9)), 'fps': 10},
        'carry': {'frames': [9, 10], 'fps': 6},
        'work': {'frames': [11, 11, 12, 12], 'fps': 6},
        'attack': {'frames': [0, 11, 12, 12], 'fps': 7},
        'pickup': {'frames': [0, 11, 12, 9], 'fps': 7, 'once': True},
        'drop': {'frames': [9, 12, 11, 0], 'fps': 7, 'once': True},
        'defeat': {'frames': [0], 'fps': 1, 'once': True},
    }
    metadata = {
        'id': 'mira', 'source': str(spec_path).replace('\\', '/'), 'revision': 'mira-quarter-test-1',
        'status': spec['status'], 'directions': preview['directions'], 'cell': [cell, cell], 'columns': columns,
        'frames': 4 * len(columns), 'portrait': 'portrait.png', 'atlas': 'sprites.png',
        'bodyPixels': spec['bodyHeight'], 'sourceGrid': [8, 4], 'anchors': anchors, 'clips': clips,
        'sourceFrames': provenance, 'legacyActions': ['carry', 'work', 'attack', 'pickup', 'drop'],
    }
    target = Path(output) / 'mira'
    target.mkdir(parents=True, exist_ok=True)
    atlas.save(target / 'sprites.png', optimize=True)
    portrait = spec['portrait']
    transparent_crop(Image.open(source / portrait['source']), portrait['rect'], spec['background']).save(target / 'portrait.png', optimize=True)
    (target / 'frames.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    proof = []
    for row in range(4):
        for column in clips['walk']['frames']:
            tile = atlas.crop((column * cell, row * cell, (column + 1) * cell, (row + 1) * cell)).resize((256, 256), Image.Resampling.NEAREST)
            background = Image.new('RGB', (256, 256), '#dce9e6')
            background.paste(tile, (0, 0), tile); proof.append(background)
    proof[0].save(target / 'walk-preview.gif', save_all=True, append_images=proof[1:], duration=100, loop=0)
    return metadata


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('spec')
    parser.add_argument('--output', default='public/assets/pixel-characters')
    args = parser.parse_args()
    result = pack_mira_runtime(args.spec, args.output)
    output = Path(args.output)
    catalog = [json.loads(path.read_text(encoding='utf-8')) for path in sorted(output.glob('*/frames.json'))]
    (output / 'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"Mira runtime: {result['frames']} cells, four facings, eight walking drawings; legacy actions retained.")
