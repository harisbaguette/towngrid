"""Pack whole authored cels for visual review; never replace a live actor pack."""
import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageOps

from mira_rig import clean


def pack_sheets(source, output, spec):
    """Extract whole drawings; sheet registration never invents limb poses."""
    cell = spec['cell']
    counts = [clip['count'] for clip in spec['clips'].values()]
    columns = sum(counts)
    atlas = Image.new('RGBA', (cell*columns, cell*4))
    proof = Image.new('RGBA', (cell*max(counts), cell*len(counts)*2), '#e5e9df')
    clips, drawings = {}, []
    start = 0
    for action, clip in spec['clips'].items():
        count = clip['count']
        clips[action] = {'frames': list(range(start, start+count)),
                         'fps': clip['fps'], 'strideLength': clip['strideLength']}
        for view, direction in enumerate(['SW', 'NW']):
            sheet = clip['sources'][direction]
            path = source.parent/sheet['file']
            image = clean(Image.open(path))
            cols, rows = sheet['grid']
            if cols*rows != count or len(sheet['origins']) != count:
                raise ValueError(f'{action}/{direction}: missing drawing or origin')
            for index in range(count):
                box = (round(index % cols*image.width/cols), round(index//cols*image.height/rows),
                       round((index % cols+1)*image.width/cols), round((index//cols+1)*image.height/rows))
                drawing = image.crop(box)
                scale, origin = sheet['scale'], sheet['origins'][index]
                anchor = spec['anchor']
                tile = drawing.transform((cell, cell), Image.Transform.AFFINE,
                    (1/scale, 0, origin[0]-anchor[0]/scale,
                     0, 1/scale, origin[1]-anchor[1]/scale), Image.Resampling.NEAREST)
                bounds = tile.getbbox()
                if not bounds or min(bounds[:2]) <= 0 or max(bounds[2:]) >= cell:
                    raise ValueError(f'{action}/{direction}/{index}: blank or clipped drawing: {bounds}')
                atlas.paste(tile, ((start+index)*cell, view*cell))
                atlas.paste(ImageOps.mirror(tile), ((start+index)*cell, (3-view)*cell))
                proof.alpha_composite(tile, (index*cell, (list(spec['clips']).index(action)*2+view)*cell))
                drawings.append({'action': action, 'direction': direction, 'index': index,
                                 'file': sheet['file'], 'sourceHash': hashlib.sha256(path.read_bytes()).hexdigest(),
                                 'sourceBox': box, 'origin': origin, 'scale': scale, 'bbox': bounds,
                                 'packedHash': hashlib.sha256(tile.tobytes()).hexdigest()})
        start += count
    output.mkdir(parents=True, exist_ok=True)
    atlas.save(output/'sprites.png', optimize=True)
    proof.resize((proof.width*2, proof.height*2), Image.Resampling.NEAREST).save(output/'poses.png')
    meta = {**spec, 'clips': clips, 'drawings': drawings, 'source': source.as_posix(),
            'sourceHash': hashlib.sha256(source.read_bytes()).hexdigest(),
            'atlasColumns': columns, 'atlasRows': 4, 'sourceDrawings': len(drawings),
            'uniqueDrawings': len({drawing['packedHash'] for drawing in drawings}),
            'method': 'whole-authored-cels-uniform-registration'}
    (output/'frames.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(f"{spec['id']}: {len(drawings)} source drawings, {len(clips)} actions, four views; visual review pending")
    return meta


def pack(source, output):
    source, output = Path(source), Path(output)
    spec = json.loads(source.read_text(encoding='utf-8'))
    if spec.get('runtimeApproved'):
        raise ValueError('This command only exports review packs')
    output = output.resolve()
    live = Path('public/assets/pixel-characters').resolve()
    if output == live or live in output.parents:
        raise ValueError('Review art cannot overwrite runtime character assets')
    if spec.get('clips'):
        return pack_sheets(source, output, spec)
    cell, count = spec['cell'], len(spec['frames'])
    if count < 2 or spec['directions'] != ['SW', 'SE']:
        raise ValueError('Expected SW poses and their SE mirror')
    atlas = Image.new('RGBA', (cell*count, cell*2))
    proof_columns = min(8, count)
    proof = Image.new('RGBA', (cell*proof_columns, cell*math.ceil(count/proof_columns)), '#e5e9df')
    records = []
    for index, frame in enumerate(spec['frames']):
        path = source.parent/frame['file']
        image = clean(Image.open(path))
        if image.width != image.height:
            raise ValueError(f'{path}: expected a square cel')
        scale = cell/image.width
        origin = np.array(spec['sourceOrigin'])*image.width
        anchor = np.array(spec['anchor'])
        # One uniform scale and translation for the entire drawing. No limb
        # deformation, body replacement, interpolation or synthetic poses.
        tile = image.transform((cell, cell), Image.Transform.AFFINE,
            (1/scale, 0, origin[0]-anchor[0]/scale,
             0, 1/scale, origin[1]-anchor[1]/scale), Image.Resampling.NEAREST)
        box = tile.getbbox()
        if not box or min(box[:2]) <= 0 or max(box[2:]) >= cell:
            raise ValueError(f'{path}: blank or clipped cel')
        atlas.paste(tile, (index*cell, 0))
        atlas.paste(ImageOps.mirror(tile), (index*cell, cell))
        proof.alpha_composite(tile, (index%proof_columns*cell, index//proof_columns*cell))
        records.append({**frame, 'sourceHash': hashlib.sha256(path.read_bytes()).hexdigest(),
                        'bbox': box, 'anchor': spec['anchor']})
    output.mkdir(parents=True, exist_ok=True)
    atlas.save(output/'sprites.png', optimize=True)
    ImageDraw.Draw(proof).text((3, 3), 'SW - visual review', fill='#17392d')
    proof.resize((proof.width*2, proof.height*2), Image.Resampling.NEAREST).save(output/'poses.png')
    meta = {**spec, 'source': source.as_posix(), 'frames': records,
            'sourceHash': hashlib.sha256(source.read_bytes()).hexdigest(),
            'atlasColumns': count, 'atlasRows': 2, 'uniqueDrawings': count,
            'method': 'whole-authored-cels-uniform-registration'}
    (output/'frames.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(f"{spec['id']}: {count} authored poses, SW + mirrored SE, review only")
    return meta


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source')
    parser.add_argument('--output', default='public/character-preview/authored-motion/mira')
    args = parser.parse_args()
    pack(args.source, args.output)
