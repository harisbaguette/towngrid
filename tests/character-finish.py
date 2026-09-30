"""Verify packed joint finishing, attachments and preservation of approved art."""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import label

parser = argparse.ArgumentParser()
parser.add_argument('--output', default='public/assets/pixel-characters')
parser.add_argument('--before')
parser.add_argument('--report')
args = parser.parse_args()
output = Path(args.output)
report = {'characters': 0, 'cells': 0, 'preservedPortraits': 0, 'attachments': [], 'preservedGaits': 0}


def islands(cell):
    labels, _ = label(cell[:, :, 3] > 0, structure=np.ones((3, 3)))
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    largest = sizes.argmax()
    parts = []
    for index in np.flatnonzero(sizes >= 4):
        if index == largest:
            continue
        ys, xs = np.where(labels == index)
        parts.append({'pixels': int(sizes[index]), 'box': [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]})
    return parts


for path in sorted(output.glob('*/frames.json')):
    meta = json.loads(path.read_text(encoding='utf-8'))
    atlas = np.asarray(Image.open(path.parent/'sprites.png'))
    assert meta['rigFinish'] == 'continuous-joints-1', meta['id']
    assert atlas.shape == (512, 8192, 4), meta['id']
    for row in range(4):
        for col in range(64):
            cell = atlas[row*128:(row+1)*128, col*128:(col+1)*128]
            alpha = cell[:, :, 3]
            assert not (alpha[0].any() or alpha[-1].any() or alpha[:, 0].any() or alpha[:, -1].any()), (meta['id'], row, col, 'clipped')
            assert np.count_nonzero(alpha) > 350, (meta['id'], row, col, 'empty')
            assert np.isin(alpha, [0, 255]).all(), 'pixel edges must stay sharp'
            report['cells'] += 1
    for row, source in [(2, 1), (3, 0)]:
        for col in range(48, 64):
            for foot, original in zip(meta['rigAudit'][row][col]['feet'], meta['rigAudit'][source][col]['feet']):
                for key in ['ankle', 'hip', 'knee']:
                    assert np.allclose(foot[key], [128-original[key][0], original[key][1]]), (meta['id'], 'mirrored joint')
    if args.before:
        before = Path(args.before)/meta['id']
        original = json.loads((before/'frames.json').read_text(encoding='utf-8'))
        for key in ['anchors', 'clips', 'gait', 'portraitAnimation']:
            assert meta[key] == original[key], (meta['id'], key)
        for row in range(4):
            assert meta['rigAudit'][row][:48] == original['rigAudit'][row][:48], (meta['id'], 'locomotion changed')
        report['preservedGaits'] += 1
        for name in ['portrait.png', 'portrait-idle.png']:
            assert (path.parent/name).read_bytes() == (before/name).read_bytes(), (meta['id'], name)
            report['preservedPortraits'] += 1
    report['characters'] += 1

# These are actual observed defects, not a global "delete detached pixels"
# rule: floating hair wisps and other authored details are intentionally kept.
cases = [('kai', 1, 44, 50), ('dew', 1, 16, 78), ('fia', 0, 59, 45), ('sora', 0, 28, 50), ('sora', 0, 59, 50)]
for identity, row, col, below in cases:
    atlas = np.asarray(Image.open(output/identity/'sprites.png'))
    cell = atlas[row*128:(row+1)*128, col*128:(col+1)*128]
    remaining = [part for part in islands(cell) if part['box'][1] >= below]
    assert not remaining, (identity, row, col, remaining)
    item = {'id': identity, 'row': row, 'frame': col, 'detachedAfter': len(remaining)}
    if args.before:
        old = np.asarray(Image.open(Path(args.before)/identity/'sprites.png'))
        old_cell = old[row*128:(row+1)*128, col*128:(col+1)*128]
        item['detachedBefore'] = len([part for part in islands(old_cell) if part['box'][1] >= below])
    report['attachments'].append(item)
assert report['characters'] == 51
if args.report:
    Path(args.report).parent.mkdir(parents=True, exist_ok=True)
    Path(args.report).write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
