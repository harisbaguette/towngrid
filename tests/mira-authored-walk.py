"""Mira's drawn SW/SE walk: real drawings, two distinct steps, grounded, no sliding."""
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

TARGET = Path('public/assets/pixel-characters/mira')
SOURCE = Path('art-source/pixel-characters/authored-actions-v13/mira')

meta = json.loads((TARGET/'frames.json').read_text(encoding='utf-8'))
spec = json.loads((SOURCE/'game-walk-SW.json').read_text(encoding='utf-8'))
atlas = Image.open(TARGET/'sprites.png').convert('RGBA')
strip = Image.open(SOURCE/'game-walk-SW.png').convert('RGBA')
assert meta['authoredWalk']['revision'] == spec['revision']
frames, columns, cell = meta['clips']['walk']['frames'], meta['atlasColumns'], spec['cell']
stride = meta['clips']['walk']['strideLengths']
assert stride == {'SW': spec['strideLength'], 'SE': spec['strideLength']}
assert meta['clips']['walk']['strideLength'] == .5, 'rigged NW/NE keep their own stride'


def tile(row, frame):
    x, y = frame % columns*cell, (row+frame//columns*4)*cell
    return atlas.crop((x, y, x+cell, y+cell))


report = {'cells': 0, 'tops': [], 'bottoms': []}
for view, row in [('SW', 0), ('SE', 3)]:
    for j, frame in enumerate(frames):
        audit = meta['rigAudit'][row][frame]
        slot = j*len(spec['sequence'])//len(frames)
        column = spec['sequence'][slot]
        assert audit['authored'] == spec['revision'] and audit['drawing'] == column
        expected = strip.crop((column*cell, 0, column*cell+cell, cell))
        if view == 'SE':
            expected = ImageOps.mirror(expected)
        assert tile(row, frame).tobytes() == expected.tobytes(), (view, frame, 'cel is not the drawing')
        alpha = np.asarray(tile(row, frame))[:, :, 3] > 0
        ys = np.where(alpha.any(1))[0]
        report['tops'].append(int(ys.min()))
        report['bottoms'].append(int(ys.max()))
        assert not (alpha[0].any() or alpha[-1].any() or alpha[:, 0].any() or alpha[:, -1].any()), (view, frame, 'clipped')
        # The planted boot is painted where the audit says it stands.
        sole = next(foot['sole'] for foot in audit['feet'] if foot['contact'])
        py, px = np.where(alpha)
        assert np.min(np.hypot(px+.5-sole[0], py+1-sole[1])) < 2.5, (view, frame, 'support sole not on the boot')
        report['cells'] += 1
    # Feet stay put on the ground while the sprite walks (sideways), and each
    # leg lands once per stride.
    f = np.array([-math.sqrt(.5) if row < 2 else math.sqrt(.5), math.sqrt(1/6)])
    step = stride[view]*128/1.05
    planted, last, strikes, drift = {}, {}, [0, 0], 0.
    for tick in range(len(frames)*3):
        frame = frames[tick % len(frames)]
        for index, foot in enumerate(meta['rigAudit'][row][frame]['feet']):
            if foot['contact']:
                world = np.array(foot['sole'])-np.array(meta['anchors'][row][frame])*128+tick/len(frames)*step*f
                if not last.get(index):
                    planted[index] = world
                    strikes[index] += last.get(index) is False
                drift = max(drift, abs(float(world[0]-planted[index][0])))
            last[index] = foot['contact']
    # A drawing held for three cells stands still while the ground moves 1.4px
    # per cell; anything beyond that is real sliding.
    assert drift < 2.5, (view, 'planted boot slides sideways', drift)
    assert strikes == [2, 3], (view, 'each leg must land once per stride', strikes)
    report[view+'Drift'] = round(drift, 2)

# One body size: the head top only moves with the planned bob.
assert max(report['tops'])-min(report['tops']) <= 2, report['tops']
assert max(report['bottoms'])-min(report['bottoms']) <= 2, report['bottoms']
# The swinging boot travels from behind to in front within each step.
# Two distinct steps: the near leg plants in the first, the far leg in the second.
assert spec['steps'] == [12, 8] and len(set(spec['sequence'][:16]) & set(spec['sequence'][16:])) == 0
start = 0
for size in spec['steps']:
    swing = [next(f['sole'][0] for f in feet if f['role'] == 'swing') for feet in spec['feet'][start:start+size]]
    start += size
    assert all(b-a < 3 for a, b in zip(swing, swing[1:])) and swing[0]-swing[-1] > 8, swing
    # Keep the largest jump of the swinging boot between drawings from growing.
    assert max(a-b for a, b in zip(swing, swing[1:])) < 12, swing
print(f"Mira drawn walk: {report['cells']} cells, {len(spec['feet'])} drawings, head within "
      f"{max(report['tops'])-min(report['tops'])}px, sideways drift SW {report['SWDrift']}px / SE {report['SEDrift']}px PASS")
