"""Pack Mira's generated SW walk drawings into a consistent, grounded cycle.

The 32 generated cels are separate image-model outputs. Packed in file order
they did not form a walk: each 8-cel block drew the figure at its own size and
height, legs ended 3-5% above or below the ground, and the second half never
swung the rear leg forward, so feet slid under a body that floated.

This packer keeps the drawings but fixes what a sequence needs:
1. Every cel is registered on the face and hair (scale and position), so the
   head never changes size or jumps between drawings.
2. Legs below mid-thigh are fitted so the lowest boot stands on one ground
   line, with a small planned body bob (low after contact, high at passing).
3. Cels are ordered by where the swinging boot really is. The only complete
   step in the set (0-9) is used for both steps of the stride; the drawn
   right/left identity of the legs is not readable at game size.
Only uniform scale, translation and a vertical leg fit are applied; no pixels
are painted.
"""
import hashlib
import json
import math
from pathlib import Path

import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))

SOURCE = Path('art-source/pixel-characters/authored-actions-v13/mira')
OUTPUT = Path('public/character-preview/slow-walk/mira')
GAME_CELL = 128
GAME_SCALE = .1               # 1000 source units -> the game's 100-pixel body
GAME_ANCHOR = (65.5, 109)     # Mira's existing SW ground anchor in the game atlas
CELL = 256
SCALE = .2                    # source units (figure height 1000) -> review cel pixels
ANCHOR = (128, 232)           # ground point in the review cel
THIGH = 600                   # head-registered row below which legs are fitted
PAD = 100                     # rows above the head kept free for the body bob
HIP = 430                     # belt line: legs pivot here when the stance is carried back
# One step, ordered by the swinging boot moving from behind to in front:
# contact, lift x3, rising, passing x3, reach, landing, heel strike. Frame 4 is
# the passing pose that belongs after 5, 6 and 7; in file order it made the
# rear boot step back.
STEP = [0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11]
# Game cells each drawing is shown for; 16 per step, 32 per stride. Contact,
# passing, reach and heel strike are held a little longer than the lifts.
HOLD = [2, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 2]
BOB = 16                      # body rise from the lowest to the highest slot (1.6 game px)
# Measured from the drawings: over one step the planted boot travels 16.1 game
# pixels right and 10.9 up, which is 0.204 world units of ground for the 1.05
# unit tall sprite at the quarter-view pitch. Two steps per stride.
STRIDE = .41


def source_name(index):
    prefix = 'original-proportions-key' if index % 8 == 0 else 'precise-inbetween'
    return f'{prefix}-{index:02d}.png'


def clean(cel):
    """Opaque figure only; drop the image model's stray specks."""
    opaque = (cel[:, :, 3] > 100).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(opaque, connectivity=8)
    largest = max(stats[1:, 4])
    keep = np.isin(labels, [k for k in range(1, count) if stats[k, 4] > largest*.01])
    cel = cel.copy()
    cel[:, :, 3] = np.where(keep, 255, 0)
    cel[~keep] = 0
    return cel


def flat(cel):
    rgb = cel[:, :, :3].astype(np.float32)
    return np.where(cel[:, :, 3:4] > 0, rgb, np.float32(128))


def register(master, cel):
    """Scale and offset that put this cel's head on the master's head."""
    ys, xs = np.where(master[:, :, 3] > 0)
    top, left, right, bottom = ys.min(), xs.min(), xs.max(), ys.max()
    template = flat(master)[top:top+int((bottom-top)*.24), left:right]
    image = flat(cel)
    best = None
    for scale in np.arange(.94, 1.061, .01):
        sized = cv2.resize(template, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
        score = cv2.matchTemplate(image, sized, cv2.TM_CCOEFF_NORMED)
        _, value, _, at = cv2.minMaxLoc(score)
        if best is None or value > best[0]:
            best = (value, float(scale), at)
    value, scale, (x, y) = best
    return {'score': round(float(value), 4), 'scale': scale, 'head': (x, y), 'masterHead': (int(left), int(top))}


def fitted(cel, reg, body_height, shear=(0., 0.)):
    """Head-registered cel standing on row 1000 (+PAD), head top at 1000-body_height.

    Legs below mid-thigh are scaled so the lowest boot meets the ground. Then
    everything below the hips is sheared by `shear` (full at the ground, none
    at the hips) to carry the planted boot back and up the way the ground
    moves under a walking body; the drawings keep it nearly still.
    """
    scale, (hx, hy), (mx, _) = reg['scale'], reg['head'], reg['masterHead']
    ys = np.where(cel[:, :, 3] > 0)[0]
    foot = (ys.max()-hy)/scale
    leg = (body_height-THIGH)/(foot-THIGH)
    width, height = 1300, 1100+PAD
    dx, dy = shear
    lift = body_height-1000
    hip = HIP-lift
    yo = (np.arange(height, dtype=np.float32)-PAD)[:, None].repeat(width, 1)
    xo = np.arange(width, dtype=np.float32)[None, :].repeat(height, 0)
    y = np.where(yo < hip, yo, hip+(yo-hip)/(1-dy/(1000-hip)))
    t = np.clip((y-hip)/(1000-hip), 0, 1)
    x = xo-dx*t
    q = y+lift
    rows = np.where(q < THIGH, q, THIGH+(q-THIGH)/leg)
    map_y = (rows*scale+hy).astype(np.float32)
    map_x = ((x-650+612-mx)*scale+hx).astype(np.float32)
    out = cv2.remap(cel, map_x, map_y, cv2.INTER_NEAREST, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    return out, round(float(leg), 4)


def reduce(cel, factor):
    """Area-average premultiplied colour, then keep a hard pixel-art edge."""
    data = cel.astype(np.float32)/255
    alpha = data[:, :, 3:4]
    size = (round(cel.shape[1]*factor), round(cel.shape[0]*factor))
    colour = cv2.resize(data[:, :, :3]*alpha, size, interpolation=cv2.INTER_AREA)
    alpha = cv2.resize(alpha, size, interpolation=cv2.INTER_AREA)[:, :, None]
    rgb = np.where(alpha > 1e-3, colour/np.maximum(alpha, 1e-3), 0)
    return (np.concatenate([rgb, (alpha > .5)], 2)*255).round().astype(np.uint8)


def step_times():
    """Start of each drawing within the step, 0..1, from its hold."""
    starts = np.cumsum([0]+HOLD[:-1])/sum(HOLD)
    return [float(t) for t in starts]


def drawings():
    assert len(HOLD) == len(STEP) and sum(HOLD) == 16
    cels = {i: clean(np.array(Image.open(SOURCE/source_name(i)).convert('RGBA'))) for i in STEP}
    master = cels[STEP[0]]
    result = []
    for slot, (index, time) in enumerate(zip(STEP, step_times())):
        reg = register(master, cels[index])
        # Lowest just after contact, highest at passing.
        body = 1000+BOB/2-BOB/2*math.cos(2*math.pi*(time-.1))
        big, leg = fitted(cels[index], reg, body)
        result.append({'index': index, 'slot': slot, 'time': time, 'big': big, 'register': reg, 'leg': leg, 'body': round(body, 2)})
    # The planted boot is the lower one. When the landing boot also touches
    # down at the end of the step, keep following the planted one by position.
    soles = []
    support = None
    for frame in result:
        pair = sorted(boots(frame['big']), key=lambda sole: -sole[1])
        if support is not None and pair[0][1]-pair[1][1] < 20:
            pair.sort(key=lambda sole: abs(sole[0]-support))
        support = pair[0][0]
        soles.append(pair)
    land, trail = np.array(soles[0][0], float), np.array(soles[0][1], float)
    for frame, sole in zip(result, soles):
        # It should travel evenly in time from where it lands to where the
        # first cel shows the trailing boot, one step later.
        ideal = land+(trail-land)*frame['time']
        delta = ideal-np.array(sole[0], float)
        # Only the sideways part: lifting the planted boot up the screen also
        # lifts the swinging boot, which then has to drop onto the ground.
        frame['shear'] = (round(float(delta[0]), 2), 0.)
        hip = HIP-(frame['body']-1000)
        frame['soles'] = []
        for role, (x, bottom) in zip(['support', 'swing'], sole):
            t = min(1., max(0., (bottom-hip)/(1000-hip)))
            frame['soles'].append((role, x+frame['shear'][0]*t, bottom-frame['shear'][1]*t))
        frame['big'], _ = fitted(cels[frame['index']], frame['register'], frame['body'], frame['shear'])
    return result


def cel_at(big, factor, cell, anchor):
    small = reduce(big, factor)
    tile = Image.new('RGBA', (cell, cell))
    image = Image.fromarray(small)
    # Head-registered space: x 650 is the body centre, y 1000 the ground.
    tile.alpha_composite(image, (round(anchor[0]-650*factor), round(anchor[1]-(1000+PAD)*factor)))
    return tile


def boots(big):
    """Each boot's sole in head-registered units: (x, lowest row)."""
    hsv = cv2.cvtColor(np.ascontiguousarray(big[:, :, :3]), cv2.COLOR_RGB2HSV).astype(int)
    mask = (big[:, :, 3] > 0) & (hsv[:, :, 0] <= 22) & (hsv[:, :, 1] > 90) & (hsv[:, :, 2] > 40) & (hsv[:, :, 2] < 200)
    mask[:780+PAD] = False
    mask = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    parts = sorted([k for k in range(1, count) if stats[k, 4] > 1500], key=lambda k: -stats[k, 4])[:2]
    if len(parts) != 2:
        raise ValueError('expected two boots')
    soles = []
    for k in parts:
        ys, xs = np.where(labels == k)
        bottom = ys.max()
        soles.append((float(xs[ys >= bottom-25].mean()), int(bottom)-PAD))
    return soles


def game_strip(frames):
    """SW cels for the game atlas plus each boot's role: support or swing."""
    strip = Image.new('RGBA', (GAME_CELL*len(frames), GAME_CELL))
    feet = []
    for column, frame in enumerate(frames):
        strip.paste(cel_at(frame['big'], GAME_SCALE, GAME_CELL, GAME_ANCHOR), (column*GAME_CELL, 0))
        cel = []
        for role, x, bottom in frame['soles']:
            lift = max(0., (1000-bottom)*GAME_SCALE) if role == 'swing' else 0
            cel.append({'role': role, 'sole': [round(GAME_ANCHOR[0]+(x-650)*GAME_SCALE, 2), round(GAME_ANCHOR[1]+(bottom-1000)*GAME_SCALE, 2)],
                        'lift': round(lift, 2)})
        feet.append(cel)
    return strip, feet


def main():
    frames = drawings()
    atlas = Image.new('RGBA', (CELL*len(frames), CELL*2))
    records = []
    for column, frame in enumerate(frames):
        tile = cel_at(frame['big'], SCALE, CELL, ANCHOR)
        atlas.paste(tile, (column*CELL, 0))
        atlas.paste(tile.transpose(Image.Transpose.FLIP_LEFT_RIGHT), (column*CELL, CELL))
        name = source_name(frame['index'])
        records.append({'column': column, 'source': name, 'register': frame['register'],
                        'legFit': frame['leg'], 'bodyHeight': frame['body'], 'stanceShear': frame['shear'],
                        'sha256': hashlib.sha256((SOURCE/name).read_bytes()).hexdigest(),
                        'packedHash': hashlib.sha256(tile.tobytes()).hexdigest()})
    OUTPUT.mkdir(parents=True, exist_ok=True)
    atlas.save(OUTPUT/'sprites.png', optimize=True)
    # Two steps per stride; each plays the same ordered step.
    sequence = [column for column, hold in enumerate(HOLD) for _ in range(hold)]*2
    meta = {'id': 'mira', 'revision': 'authored-slow-walk-v13c', 'cell': CELL,
            'atlasColumns': len(frames), 'atlasRows': 2, 'directions': ['SW', 'SE'],
            'mirroredDirections': {'SE': 'SW'}, 'sourceDrawings': 32, 'usedDrawings': len(frames),
            'sequence': sequence, 'anchor': list(ANCHOR), 'strideLength': STRIDE,
            'frames': records,
            'rejected': {'10-15': '앞발이 닿는 착지 자세가 다른 묶음보다 작고 손 위치가 달라 이어지지 않음',
                         '16-31': '뒷발이 앞으로 나오지 않아 두 번째 걸음이 그려지지 않음'},
            'remaining': ['NW/NE 방향', '운반·출발·정지와 나머지 동작']}
    (OUTPUT/'frames.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    (SOURCE/'pack.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    strip, feet = game_strip(frames)
    strip.save(SOURCE/'game-walk-SW.png', optimize=True)
    game = {'revision': meta['revision'], 'cell': GAME_CELL, 'anchor': list(GAME_ANCHOR),
            'strideLength': STRIDE, 'sequence': sequence, 'feet': feet}
    (SOURCE/'game-walk-SW.json').write_text(json.dumps(game, ensure_ascii=False, indent=1)+'\n', encoding='utf-8')
    from mira_authored_walk import install_into_game
    install_into_game()
    print(f'Mira SW walk: {len(frames)} drawings in step order, {len(sequence)} cells per stride; SE mirrored')
    return frames


if __name__ == '__main__':
    main()
