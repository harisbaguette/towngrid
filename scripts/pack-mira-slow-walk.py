"""Pack Mira's generated SW walk drawings into a consistent, grounded cycle.

The generated cels are separate image-model outputs. Packed in file order
they did not form a walk: each batch drew the figure at its own size and
height, legs ended 3-5% above or below the ground, and v13 never swung the
rear leg forward in its second half, so feet slid under a floating body. v14
redrew that second step.

This packer keeps the drawings but fixes what a sequence needs:
1. Every cel is registered on the face and hair (scale and position), so the
   head never changes size or jumps between drawings.
2. Legs below mid-thigh are fitted so the lowest boot stands on one ground
   line, with a small planned body bob (low after contact, high at passing).
3. Cels are ordered by where the swinging boot really is: v13 for the step on
   the near leg, v14 for the step on the far leg.
4. Below the hips each cel is sheared sideways so the planted boot moves
   back evenly with the ground.
Only uniform scale, translation, a vertical leg fit and that shear are
applied; no pixels are painted.
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


def source_name(index):
    prefix = 'original-proportions-key' if index % 8 == 0 else 'precise-inbetween'
    return f'{prefix}-{index:02d}.png'


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
SECOND = Path('art-source/pixel-characters/authored-actions-v14/mira')
# Each step is ordered by the swinging boot moving from behind to in front:
# contact, lift, passing, reach, landing. HOLD is how many game cells each
# drawing is shown; 16 per step, 32 per stride.
# Near leg planted (v13). Frame 4 is the passing pose that belongs after 5, 6
# and 7; in file order it made the rear boot step back.
FIRST_STEP = [SOURCE/source_name(i) for i in [0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11]]
FIRST_HOLD = [2, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 2]
# Which boot is planted, read off the drawings: the front one until the
# swinging boot passes it, then the back one. In this camera a landing front
# boot is lower on screen than the planted back boot, so height cannot tell.
FIRST_PLANTED = ['front']*6+['back']*6
# Far leg planted: the v13 contact, then the redrawn v14 step. v13 12-31 never
# brought the rear boot forward, so this step did not exist before.
SECOND_STEP = [SOURCE/source_name(16)]+[SECOND/f'walk-SW-{i:02d}.png' for i in [18, 20]]+[
    SECOND/'continuity/second-pass-in.png']+[SECOND/f'walk-SW-{i:02d}.png' for i in [22, 24, 26, 30]]
# v14 28 reaches 5px past where 30 lands, so the boot would step back.
SECOND_HOLD = [2, 2, 1, 1, 2, 2, 3, 3]
SECOND_PLANTED = ['front']*6+['back']*2
STEPS = [(FIRST_STEP, FIRST_HOLD, FIRST_PLANTED), (SECOND_STEP, SECOND_HOLD, SECOND_PLANTED)]
BOB = 16                      # body rise from the lowest to the highest slot (1.6 game px)
# Ground covered per stride is measured from the drawings: how far right the
# planted boot travels over both steps. One world unit along a quarter-view
# diagonal is this many game pixels across the screen for the 1.05 unit sprite.
SCREEN_X_PER_WORLD = 128/1.05*math.sqrt(.5)




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


def fitted(cel, reg, body_height, shear=(0., 0.), side=None):
    """Head-registered cel standing on row 1000 (+PAD), head top at 1000-body_height.

    Legs below mid-thigh are scaled so the lowest boot meets the ground. Then
    everything below the hips is sheared by `shear` (full at the ground, none
    at the hips) to carry the planted boot back and up the way the ground
    moves under a walking body; the drawings keep it nearly still. `side`
    (x between the boots, +1 if the planted boot is the back one) limits the
    shear to the planted leg, so the swinging boot keeps its drawn path.
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
    if side is not None:
        middle, sign = side
        t = t/(1+np.exp(-sign*(xo-middle)/12))
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


def step_times(hold):
    """Start of each drawing within its step, 0..1, from its hold."""
    starts = np.cumsum([0]+hold[:-1])/sum(hold)
    return [float(t) for t in starts]


def planted(frames, sides):
    """(planted sole, swinging sole) per cel, by the drawn side of the planted boot."""
    soles = []
    for frame, side in zip(frames, sides):
        front, back = sorted(boots(frame['big']))
        soles.append([front, back] if side == 'front' else [back, front])
    return soles


def drawings():
    master = clean(np.array(Image.open(FIRST_STEP[0]).convert('RGBA')))
    steps = []
    for step, (paths, hold, sides) in enumerate(STEPS):
        assert len(paths) == len(hold) == len(sides) and sum(hold) == 16
        frames = []
        for path, time in zip(paths, step_times(hold)):
            cel = clean(np.array(Image.open(path).convert('RGBA')))
            reg = register(master, cel)
            # Lowest just after contact, highest at passing.
            body = 1000+BOB/2-BOB/2*math.cos(2*math.pi*(time-.1))
            big, leg = fitted(cel, reg, body)
            frames.append({'path': path, 'step': step, 'time': time, 'cel': cel, 'big': big,
                           'register': reg, 'leg': leg, 'body': round(body, 2)})
        steps.append((frames, planted(frames, sides)))
    # The planted boot lands where it is drawn and from there moves back at the
    # ground's speed; one step's travel is the mean of what the drawings show
    # from landing to trailing in the next step's first cel.
    travel = [steps[(k+1) % len(steps)][1][0][1][0]-soles[0][0][0] for k, (_, soles) in enumerate(steps)]
    step_travel = float(np.mean(travel))
    result = []
    for step, (frames, soles) in enumerate(steps):
        land = soles[0][0][0]
        hold = STEPS[step][1]
        for frame, sole, cells in zip(frames, soles, hold):
            # A held drawing is right halfway through its hold.
            ideal = land+step_travel*(frame['time']+(cells-1)/2/sum(hold))
            delta = np.array([ideal-sole[0][0], 0.])
            # Only the sideways part: lifting the planted boot up the screen
            # also lifts the swinging boot, which then has to drop.
            frame['shear'] = (round(float(delta[0]), 2), 0.)
            hip = HIP-(frame['body']-1000)
            frame['soles'] = []
            for role, (x, bottom) in zip(['support', 'swing'], sole):
                t = min(1., max(0., (bottom-hip)/(1000-hip))) if role == 'support' else 0.
                frame['soles'].append((role, x+frame['shear'][0]*t, bottom-frame['shear'][1]*t))
            side = ((sole[0][0]+sole[1][0])/2, 1 if sole[0][0] > sole[1][0] else -1)
            frame['big'], _ = fitted(frame.pop('cel'), frame['register'], frame['body'], frame['shear'], side)
            result.append(frame)
    return result, round(2*step_travel*GAME_SCALE/SCREEN_X_PER_WORLD, 3)


def cel_at(big, factor, cell, anchor):
    # Reduction can leave a lone pixel of a boot outline the shear tore off.
    small = clean(reduce(big, factor))
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
    frames, stride = drawings()
    atlas = Image.new('RGBA', (CELL*len(frames), CELL*2))
    records = []
    for column, frame in enumerate(frames):
        tile = cel_at(frame['big'], SCALE, CELL, ANCHOR)
        atlas.paste(tile, (column*CELL, 0))
        atlas.paste(tile.transpose(Image.Transpose.FLIP_LEFT_RIGHT), (column*CELL, CELL))
        records.append({'column': column, 'step': frame['step'], 'source': frame['path'].as_posix(), 'register': frame['register'],
                        'legFit': frame['leg'], 'bodyHeight': frame['body'], 'stanceShear': frame['shear'],
                        'sha256': hashlib.sha256(frame['path'].read_bytes()).hexdigest(),
                        'packedHash': hashlib.sha256(tile.tobytes()).hexdigest()})
    OUTPUT.mkdir(parents=True, exist_ok=True)
    atlas.save(OUTPUT/'sprites.png', optimize=True)
    holds = [hold for _, step_hold, _ in STEPS for hold in step_hold]
    sequence = [column for column, hold in enumerate(holds) for _ in range(hold)]
    meta = {'id': 'mira', 'revision': 'authored-walk-v14a', 'cell': CELL,
            'atlasColumns': len(frames), 'atlasRows': 2, 'directions': ['SW', 'SE'],
            'mirroredDirections': {'SE': 'SW'}, 'usedDrawings': len(frames),
            'steps': [len(paths) for paths, _, _ in STEPS],
            'sequence': sequence, 'anchor': list(ANCHOR), 'strideLength': stride,
            'frames': records,
            'unused': {'v13 12-15, 17-31': '크기가 다르거나 뒷발이 앞으로 나오지 않음',
                       'v14 07, 14, 28': '두 신발이 붙어 발 위치를 잴 수 없거나, v13 16번과 같은 접지 자세이거나, 착지 자리보다 5px 더 나가 발이 뒤로 물러남'},
            'remaining': ['NW/NE 방향', '운반·출발·정지와 나머지 동작']}
    (OUTPUT/'frames.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    (SOURCE/'pack.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    strip, feet = game_strip(frames)
    strip.save(SOURCE/'game-walk-SW.png', optimize=True)
    game = {'revision': meta['revision'], 'cell': GAME_CELL, 'anchor': list(GAME_ANCHOR),
            'strideLength': stride, 'sequence': sequence, 'steps': meta['steps'], 'feet': feet}
    (SOURCE/'game-walk-SW.json').write_text(json.dumps(game, ensure_ascii=False, indent=1)+'\n', encoding='utf-8')
    from mira_authored_walk import install_into_game
    install_into_game()
    print(f'Mira SW walk: {len(frames)} drawings over two steps, {len(sequence)} cells per stride; SE mirrored')
    return frames


if __name__ == '__main__':
    main()
