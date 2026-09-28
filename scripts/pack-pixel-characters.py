"""Slice authored RGBA artwork into aligned game atlases. Never redraw the artwork."""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation, find_objects, label

QUARTER_DIRECTIONS = ['SW', 'NW', 'NE', 'SE']
LEGACY_DIRECTIONS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE']


def extract_objects(path, cutoff=0, split_rows=()):
    image = Image.open(path).convert('RGBA')
    pixels = np.asarray(image)
    mask = pixels[:, :, 3] > 96
    mask[:, :cutoff] = False
    for boundary in split_rows:
        mask[boundary:boundary + 1, cutoff:] = False
    labels, _ = label(mask, structure=np.ones((3, 3)))
    objects = []
    for number, slices in enumerate(find_objects(labels), 1):
        if not slices:
            continue
        ys, xs = slices
        area = int(np.count_nonzero(labels[slices] == number))
        width, height = xs.stop - xs.start, ys.stop - ys.start
        if area > 600 and width > 15 and height > 40:
            objects.append({'label': number, 'box': [xs.start, ys.start, xs.stop, ys.stop], 'area': area})
    return image, labels, objects


def cut_object(image, labels, obj):
    # Isolate the authored connected figure, keeping original edge alpha.
    # Padding includes its antialiased fringe without including nearby figures.
    parts = [obj] + obj.get('extras', [])
    x0 = min(p['box'][0] for p in parts)
    y0 = min(p['box'][1] for p in parts)
    x1 = max(p['box'][2] for p in parts)
    y1 = max(p['box'][3] for p in parts)
    x0, y0, x1, y1 = max(0, x0 - 3), max(0, y0 - 3), min(image.width, x1 + 3), min(image.height, y1 + 3)
    cut = np.array(image.crop((x0, y0, x1, y1)))
    selected = binary_dilation(np.isin(labels[y0:y1, x0:x1], [p['label'] for p in parts]), iterations=3)
    cut[:, :, 3] = np.where(selected, cut[:, :, 3], 0)
    return Image.fromarray(cut), (x0, y0, x1, y1)


def pack_character(spec, output):
    if spec.get('runtimePrototype'):
        from mira_runtime import pack_mira_runtime
        return pack_mira_runtime(spec['runtimePrototype'], output)
    source_directions = spec.get('directions', LEGACY_DIRECTIONS)
    if any(direction not in source_directions for direction in QUARTER_DIRECTIONS):
        raise ValueError(f"{spec['id']}: missing a quarter-view direction")
    source = Path(spec['source'])
    image, labels, objects = extract_objects(source)
    portrait = max(objects, key=lambda o: o['area'])
    portrait_labels = labels
    if spec.get('cutoff'):
        image, labels, objects = extract_objects(source, spec['cutoff'], spec.get('split_rows', []))
    sprites = [o for o in objects if o is not portrait and o['area'] > 1500 and o['box'][0] > image.width * .3 and o['box'][3] - o['box'][1] < image.height * .23]
    # A staff or trident may be separated from the hand by a transparent pixel.
    # Keep such authored accessories with the closest body, not as an extra pose.
    for extra in objects:
        if extra is portrait or extra in sprites or extra['area'] > 1500:
            continue
        ex0, ey0, ex1, ey1 = extra['box']
        candidates = []
        for body in sprites:
            x0, y0, x1, y1 = body['box']
            dx = max(0, x0 - ex1, ex0 - x1)
            dy = max(0, y0 - ey1, ey0 - y1)
            if dx < 40 and dy < 12 and abs((ey0 + ey1) / 2 - (y0 + y1) / 2) < 90:
                candidates.append((dx + dy * 2 + abs((ex0 + ex1) / 2 - (x0 + x1) / 2) * .1, body))
        if candidates:
            min(candidates, key=lambda c: c[0])[1].setdefault('extras', []).append(extra)
    # Generated sheets may contain a spare neutral column. Select the authored
    # poses explicitly rather than stretching the sheet onto an assumed grid.
    rows = []
    for obj in sorted(sprites, key=lambda o: o['box'][3]):
        bottom = obj['box'][3]
        row = next((r for r in rows if abs(np.median([v['box'][3] for v in r]) - bottom) < image.height * .036), None)
        if row is None:
            rows.append([obj])
        else:
            row.append(obj)
    rows.sort(key=lambda r: np.median([v['box'][3] for v in r]))
    for row in rows:
        row.sort(key=lambda o: o['box'][0])
    row_map = spec.get('rows', list(range(len(rows))))
    columns = spec.get('columns')
    if len(rows) != spec.get('source_rows', len(source_directions)):
        raise ValueError(f"{spec['id']}: unexpected source facings; found {len(rows)} rows {[len(r) for r in rows]}")
    selected_rows = []
    for row_index in row_map:
        row = rows[row_index]
        indices = columns or (list(range(6)) + [7, 8] if len(row) == 9 else list(range(8)))
        if len(row) not in [8, 9] and columns is None:
            raise ValueError(f"{spec['id']}: row {row_index} has {len(row)} figures")
        selected_rows.append([row[i] for i in indices])
    contexts = [[(image, labels, 1)] * 8 for _ in selected_rows]
    base_height = float(np.median([r[0]['box'][3] - r[0]['box'][1] for r in selected_rows]))
    for patch in spec.get('insert_rows', []):
        patch_image, patch_labels, patch_objects = extract_objects(patch['source'])
        patch_objects = sorted([o for o in patch_objects if o['area'] > 1500], key=lambda o: o['box'][0])
        if len(patch_objects) != 8:
            raise ValueError(f"{spec['id']}: direction supplement must have eight actions")
        factor = base_height / (patch_objects[0]['box'][3] - patch_objects[0]['box'][1])
        selected_rows.insert(patch['index'], patch_objects)
        contexts.insert(patch['index'], [(patch_image, patch_labels, factor)] * 8)
    if len(selected_rows) != len(source_directions):
        raise ValueError(f"{spec['id']}: source direction count must be {len(source_directions)}")
    for patch in spec.get('replace_rows', []):
        patch_image, patch_labels, patch_objects = extract_objects(patch['source'])
        patch_objects = [o for o in patch_objects if o['area'] > 1500]
        row_count = patch.get('source_rows', 1)
        if len(patch_objects) != row_count * 8:
            raise ValueError(f"{spec['id']}: replacement must have {row_count * 8} actions")
        patch_objects.sort(key=lambda o: o['box'][3])
        offset = patch.get('source_row', 0) * 8
        patch_objects = sorted(patch_objects[offset:offset + 8], key=lambda o: o['box'][0])
        factor = base_height / patch.get('body_height', patch_objects[0]['box'][3] - patch_objects[0]['box'][1])
        selected_rows[patch['index']] = patch_objects
        contexts[patch['index']] = [(patch_image, patch_labels, factor)] * 8
    for patch in spec.get('replace_columns', []):
        patch_image, patch_labels, patch_objects = extract_objects(patch['source'])
        patch_objects = sorted([o for o in patch_objects if o['area'] > 1500], key=lambda o: o['box'][0])
        if len(patch_objects) != len(source_directions):
            raise ValueError(f"{spec['id']}: pose supplement must have {len(source_directions)} directions")
        reference_height = float(np.median([r[patch['index']]['box'][3] - r[patch['index']]['box'][1] for r in selected_rows]))
        factor = base_height / patch['body_height'] if patch.get('body_height') else reference_height / float(np.median([o['box'][3] - o['box'][1] for o in patch_objects]))
        for y, obj in enumerate(patch_objects):
            selected_rows[y][patch['index']] = obj
            contexts[y][patch['index']] = (patch_image, patch_labels, factor)
    for frame in spec.get('frame_boxes', []):
        # Manual crop bounds separate an illustrated portrait overhang from a
        # neighboring sprite. They never replace or repaint authored pixels.
        selected_rows[frame['row']][frame['column']]['box'] = frame['box']
    extracted = [[cut_object(contexts[y][x][0], contexts[y][x][1], obj) for x, obj in enumerate(row)] for y, row in enumerate(selected_rows)]
    cuts = [[entry[0] for entry in row] for row in extracted]
    max_width = max(cut.width * contexts[y][x][2] for y, row in enumerate(cuts) for x, cut in enumerate(row))
    max_height = max(cut.height * contexts[y][x][2] for y, row in enumerate(cuts) for x, cut in enumerate(row))
    scale = min(116 / max_width, 110 / max_height, 1.25)
    target = output / spec['id']
    target.mkdir(parents=True, exist_ok=True)
    atlas = Image.new('RGBA', (1024, 128 * len(source_directions)))
    anchors = []
    for y, row in enumerate(cuts):
        anchor_row = []
        for x, cut in enumerate(row):
            frame_scale = scale * contexts[y][x][2]
            w, h = round(cut.width * frame_scale), round(cut.height * frame_scale)
            cut = cut.resize((w, h), Image.Resampling.NEAREST)
            atlas.alpha_composite(cut, (x * 128 + (128 - w) // 2, y * 128 + 116 - h))
            obj = selected_rows[y][x]
            x0, y0, x1, y1 = obj['box']
            row_labels = contexts[y][x][1]
            foot_mask = row_labels[max(y0, y1 - round(15 / contexts[y][x][2])):y1, x0:x1] == obj['label']
            foot_xs = np.where(foot_mask)[1]
            source_foot_x = x0 + (float(np.median(foot_xs)) if len(foot_xs) else (x1 - x0) / 2)
            source_rect = extracted[y][x][1]
            anchor_x = ((128 - w) // 2 + (source_foot_x - source_rect[0]) * frame_scale) / 128
            anchor_row.append([round(anchor_x, 5), round(116 / 128, 5)])
        anchors.append(anchor_row)
    # Keep legacy source row/column corrections intact, then retain only the four
    # authored diagonals. Scale is computed before selection to preserve size.
    selected_indices = [source_directions.index(d) for d in QUARTER_DIRECTIONS]
    compact = Image.new('RGBA', (1024, 512))
    for destination_row, source_row in enumerate(selected_indices):
        compact.paste(atlas.crop((0, source_row * 128, 1024, (source_row + 1) * 128)), (0, destination_row * 128))
    atlas = compact
    anchors = [anchors[i] for i in selected_indices]
    atlas.save(target / 'sprites.png', optimize=True)
    if spec.get('cutoff'):
        portrait['box'][2] = min(portrait['box'][2], spec['cutoff'] - 3)
    illustration, _ = cut_object(image, portrait_labels, portrait)
    illustration.thumbnail((512, 768), Image.Resampling.NEAREST)
    illustration.save(target / 'portrait.png', optimize=True)
    # Animated proof uses precisely the atlas frames consumed by the game.
    walk = []
    for direction in range(4):
        for _ in range(2):
            for frame in [1, 2, 3, 2]:
                tile = atlas.crop((frame * 128, direction * 128, (frame + 1) * 128, (direction + 1) * 128))
                background = Image.new('RGB', (256, 256), '#dce9e6')
                tile = tile.resize((256, 256), Image.Resampling.NEAREST)
                background.paste(tile, (round((.5 - anchors[direction][frame][0]) * 256), 0), tile)
                walk.append(background)
    walk[0].save(target / 'walk-preview.gif', save_all=True, append_images=walk[1:], duration=125, loop=0, optimize=True)
    metadata = {'id': spec['id'], 'source': source.name, 'directions': QUARTER_DIRECTIONS, 'cell': [128, 128], 'columns': ['idle', 'walk-left', 'walk-pass', 'walk-right', 'carry-left', 'carry-right', 'work-windup', 'work-contact'], 'frames': 32, 'portrait': 'portrait.png', 'atlas': 'sprites.png', 'bodyPixels': round(np.median([r[0].height for r in cuts]) * scale), 'sourceGrid': [len(rows[0]), len(rows)], 'anchors': anchors}
    (target / 'frames.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
    return metadata


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('manifest')
    parser.add_argument('--output', default='public/assets/pixel-characters')
    args = parser.parse_args()
    specs = json.loads(Path(args.manifest).read_text())
    output = Path(args.output)
    summaries = []
    for spec in specs:
        summary = pack_character(spec, output)
        summaries.append(summary)
        print(summary['id'], summary['frames'], 'frames', summary['sourceGrid'])
    # Incremental correction packs must retain the rest of the roster catalog.
    catalog = [json.loads(path.read_text()) for path in sorted(output.glob('*/frames.json'))]
    (output / 'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n')
