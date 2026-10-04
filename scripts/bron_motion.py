"""Extract image-authored hammer poses with registered ground anchors."""
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageOps
from scipy.ndimage import label
from mira_rig import clean

REVISION = "bron-authored-contact-2"


def apply_hammer_cels(atlas, meta, manifest_path):
    path = Path(manifest_path)
    manifest = json.loads(path.read_text(encoding='utf-8'))
    source = clean(Image.open(path.parent / manifest['source']))
    packed_scale = manifest['packedScale']
    display_scale = manifest['displayScale'] / packed_scale
    target_anchor = np.array(manifest['packedAnchor'], float)
    meta['frameScales'] = [1.] * len(meta['columns'])
    for row in range(4):
        view = manifest['views'][0 if row in [0, 3] else 1]
        for action, sequence in manifest['sequences'].items():
            columns = [i for i, name in enumerate(meta['columns']) if name.startswith(action + '-')]
            assert len(columns) == len(sequence)
            for index, (column, cel_index) in enumerate(zip(columns, sequence)):
                cel = view['cels'][cel_index]
                box = cel['box']
                cut = source.crop(tuple(box))
                # The source's third strike overlaps the nominal grid gutter.
                # Keep this complete connected figure, not the neighboring boot.
                pixels=np.array(cut)
                labels,_=label(pixels[:,:,3]>0,structure=np.ones((3,3)))
                areas=np.bincount(labels.ravel());areas[0]=0
                pixels[labels!=int(areas.argmax())]=0
                cut=Image.fromarray(pixels)
                ground = np.array(cel['ground'], float) - box[:2]
                tile = cut.transform((128, 128), Image.Transform.AFFINE,
                                     (1 / packed_scale, 0, ground[0] - target_anchor[0] / packed_scale,
                                      0, 1 / packed_scale, ground[1] - target_anchor[1] / packed_scale),
                                     Image.Resampling.NEAREST)
                tile = clean(tile)
                anchor = target_anchor / 128
                if row in [2, 3]:
                    tile = ImageOps.mirror(tile)
                    anchor = np.array([1 - anchor[0], anchor[1]])
                alpha = np.asarray(tile)[:, :, 3]
                if alpha[0].any() or alpha[-1].any() or alpha[:, 0].any() or alpha[:, -1].any():
                    raise ValueError(f'{action} {row} {index}: authored pose clipped')
                atlas.paste(tile, (column * 128, row * 128))
                meta['anchors'][row][column] = anchor.tolist()
                meta['frameScales'][column] = display_scale
                meta['rigAudit'][row][column] = {
                    'action': action, 'phase': index / len(sequence), 'feet': [],
                    'authoredCel': cel_index, 'sourceView': view['direction'],
                    'sourceGround': cel['ground'], 'mirrored': row in [2, 3],
                }
    for action, timing in manifest['timing'].items():
        columns = [i for i, name in enumerate(meta['columns']) if name.startswith(action + '-')]
        meta['clips'][action]['frames'] = [columns[i] for i in timing['poses']]
        meta['clips'][action]['fps'] = timing['fps']
    meta['motionRevision'] = REVISION
    meta['authoredMotion'] = path.as_posix()
    meta['animationMethod'] = 'joint-locomotion-and-authored-hammer-cels'
    meta['limitations'] = [
        'Opposite views mirrored',
        'Locomotion uses original-texture joints; hammer actions use image-model cels',
        'Work and attack reuse the hammer pose set with different ranges and timing',
        'Quarter turn uses foot pivot then switches the authored view',
    ]
    return atlas, meta
