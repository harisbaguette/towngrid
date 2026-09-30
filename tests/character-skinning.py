"""Check continuous limb UVs using the real source masks, not painted fixtures."""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from rig_skinning import limb_layers
from roster_rig import prepare
from mira_rig import prepare as prepare_mira, clean


def composite(layers):
    result = Image.new('RGBA', (128, 128))
    for layer in layers:
        result.alpha_composite(layer)
    return np.asarray(result)


limbs = 0
rigs = []
for path in sorted(Path('art-source/pixel-characters').glob('*-v*/*/rig.json')):
    spec = json.loads(path.read_text(encoding='utf-8'))
    for view in spec['views']:
        rigs.append((spec['id'], view['image'], prepare(path.parent, view, spec)))
mira = Path('art-source/pixel-characters/prototypes/mira-v3/runtime-pack.json')
spec = json.loads(mira.read_text(encoding='utf-8'))
source = clean(Image.open(mira.parent/spec['source']))
for view in spec['views']:
    rigs.append(('mira', view['direction'], prepare_mira(spec, source, view)))
for identity, direction, rig in rigs:
    for limb in rig['arms'] + rig['legs']:
        a, b, c = limb['joints']
        names = ['upper', 'lower'] + (['foot'] if 'foot' in limb else [])
        original = composite([limb[name] for name in names])
        unchanged = composite(limb_layers(limb, a, b, c))
        assert np.array_equal(original, unchanged), (identity, direction, 'identity mapping changes texture')
        shifted = composite(limb_layers(limb, a+[2, -3], b+[2, -3], c+[2, -3]))
        assert np.array_equal(shifted[:-3, 2:], original[3:, :-2]), (identity, 'integer translation')
        # The upper/lower overlap must sample the same source pixels even
        # with a folded elbow; independent bone maps disagree at this seam.
        layers = limb_layers(limb, a, b+[-4, 1], c+[-10, -8])
        upper, lower = [np.asarray(layer) for layer in layers[:2]]
        shared = (upper[:, :, 3] > 0) & (lower[:, :, 3] > 0)
        assert np.array_equal(upper[shared], lower[shared]), (identity, 'joint UV seam')
        limbs += 1
print(f'Joint skinning PASS: {limbs} authored limbs, identity pixels, translation and folded-joint UV continuity')
