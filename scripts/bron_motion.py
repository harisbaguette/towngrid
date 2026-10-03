"""Bron's weight-bearing gait and image-authored hammer poses.

Locomotion keeps distance-driven foot contacts. Hammer cels are extracted from
the original image-model sheet, using one scale and reviewed ground landmarks.
"""
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps
from scipy.ndimage import label

from mira_rig import clean, foot_phase, joint
from rig_skinning import limb_layers

REVISION = 'bron-planted-walk-2'
UP = math.sqrt(2 / 3)


def foot_roll(phase, stance):
    t = phase % 1
    if t < .12:
        return math.radians(-12) * (1 - t / .12) ** 2
    if t < stance - .13:
        return 0.
    if t < stance:
        return math.radians(23) * ((t - stance + .13) / .13) ** 2
    u = (t - stance) / (1 - stance)
    return math.radians(23 * (1-u) ** 3 - 12 * math.sin(math.pi*u/2) ** 2)


def boot_transform(forward, pitch):
    # Project sagittal foot roll at the same elevation as the world camera.
    basis = np.column_stack((forward, [0, -UP]))
    c, s = math.cos(pitch), math.sin(pitch)
    return basis @ np.array([[c, s], [-s, c]]) @ np.linalg.inv(basis)


def body_mapping(rig, phase, carrying, offset):
    """Counter-rotate chest and pelvis without stretching the head."""
    shoulders = np.array([arm['joints'][0] for arm in rig['arms']])
    waist = np.mean([leg['joints'][0] for leg in rig['legs']], axis=0)
    neck = shoulders[:, 1].min() - 7
    chest = shoulders[:, 1].mean() + 8
    swing = math.cos(phase * math.tau)
    facing = 1 if rig['forward'][1] > 0 else -1
    turn = swing * (1.1 if carrying else 2.8) * facing
    levels = np.array([0, neck, chest, waist[1], 127])
    shifts = np.array([0, 0, turn, -turn * .35, -turn * .35])
    widths = np.array([1, 1, 1 + swing * .025, 1 - swing * .025, 1])

    def point(p):
        p = np.asarray(p, dtype=float)
        x = waist[0] + (p[0] - waist[0]) * np.interp(p[1], levels, widths)
        x += np.interp(p[1], levels, shifts)
        return np.array([x, p[1]]) + offset

    rgba = np.asarray(rig['core'])
    ys, xs = np.mgrid[:128, :128]
    sy = ys - round(offset[1])
    width = np.interp(sy, levels, widths)
    sx = np.rint(waist[0] + (xs - offset[0] - waist[0] - np.interp(sy, levels, shifts)) / width).astype(int)
    valid = (sx >= 0) & (sx < 128) & (sy >= 0) & (sy < 128)
    result = np.zeros_like(rgba)
    result[valid] = rgba[sy[valid], sx[valid]]
    return Image.fromarray(result), point, turn


def render_locomotion(rig, action, phase, spec, crate, settle=0):
    carrying = action == 'carry'
    settings = spec['motionProfile']
    forward = rig['forward']
    lateral = np.array([math.copysign(math.sqrt(.5), forward[1]), math.sqrt(1 / 6)])
    gait = settings.get('gait',spec['gait'])
    # Settle just after contact; rise through mid-stance. Carrying damps bounce.
    drop = settings['carryDrop'] if carrying else settings['walkDrop']
    bounce = settings['carryBounce'] if carrying else settings['walkBounce']
    # Contact is low, passing is high. Settle to the same standing pelvis.
    dy = (drop + bounce * math.cos(phase * math.tau * 2)) * (1-settle)
    offset = np.array([0., dy])
    core, body_point, turn = body_mapping(rig, phase, carrying, offset)
    origin = np.array([np.mean([leg['joints'][0][0] for leg in rig['legs']]), spec['baseline']], float)
    project = lambda p: origin + lateral * p[0] + forward * p[2] - [0, p[1] * UP]
    leg_layers, feet = [], []
    for i, limb in enumerate(rig['legs']):
        side = -1 if i == 0 else 1
        travel, lift, contact = foot_phase(phase + i * .5, gait)
        travel *= 1-settle
        lift *= 1-settle
        pitch = foot_roll(phase+i*.5, gait['stance']) * (1-settle)
        ankle_height = 8.
        # The heel supports landing; the toe supports push-off. Both are
        # measured against the sole plane, not the centre of the ankle.
        heel, toe = -3., 7.
        pivot = toe if pitch > 0 else heel
        roll_height = pivot * math.sin(pitch)
        roll_travel = pivot * (1-math.cos(pitch))
        reach = spec['strideLength'] * 128 / spec['worldHeight'] * gait['stance'] / 2
        # Match the actual textured hip, including chest/pelvis counter-turn.
        hip2 = body_point(limb['joints'][0])
        hip_x = (hip2[0]-origin[0])/lateral[0]
        hip = np.array([hip_x, (origin[1]+lateral[1]*hip_x-hip2[1])/UP, 0.])
        ankle = np.array([side * gait['footHalfWidth'], ankle_height+lift+roll_height, travel * reach+roll_travel])
        delta = ankle - hip
        distance = np.linalg.norm(delta)
        unit = delta / distance
        first, second = settings.get('legLengths',[[gait['thigh'],gait['shin']]]*2)[i]
        if distance >= first + second:
            raise ValueError(f'Unreachable Bron foot at {action} {phase}: {distance}')
        along = (first * first - second * second + distance * distance) / (2 * distance)
        bend = np.array([0., 0., 1.]) - unit * unit[2]
        bend /= np.linalg.norm(bend)
        knee = hip + unit * along + bend * math.sqrt(max(0, first * first - along * along))
        root, joint_at, end = [project(p) for p in [hip, knee, ankle]]
        leg_layers.append(limb_layers(limb, root, joint_at, end, boot_transform(forward, pitch)))
        feet.append({'contact': contact, 'lift': lift, 'travel': travel,
                     'joints3d': [p.round(5).tolist() for p in [hip, knee, ankle]],
                     'ankle': end.round(4).tolist(), 'pitch':pitch,
                     'support':project([ankle[0],lift,travel*reach+pivot]).round(4).tolist()})

    shoulders = np.array([body_point(arm['joints'][0]) for arm in rig['arms']])
    crate_center = shoulders.mean(axis=0) + [0, 19] + forward * 11
    arms = []
    for i, limb in enumerate(rig['arms']):
        a, b, c = limb['joints']
        root = shoulders[i]
        lengths = [np.linalg.norm(b - a), np.linalg.norm(c - b)]
        if carrying:
            end = crate_center + [-crate.width / 2 + 2 if root[0] < crate_center[0] else crate.width / 2 - 2, -3]
        else:
            swing = math.cos(math.tau * (phase + (1 - i) * .5)) * settings['armSwing'] * (1-settle)
            end = root + [0, sum(lengths) * .83] + forward * swing
        reach = np.linalg.norm(end - root)
        if reach > sum(lengths) * .97:
            end = root + (end - root) / reach * sum(lengths) * .97
        elbow = joint(root, end, lengths, -forward)
        arms.append([*limb_layers(limb, root, elbow, end), end])

    result = Image.new('RGBA', (128, 128))
    for layer in arms[0][:2]:
        result.alpha_composite(layer)
    for layers in leg_layers:
        for layer in layers:
            result.alpha_composite(layer)
    crate_at = tuple(np.rint(crate_center - [crate.width / 2, crate.height / 2]).astype(int))
    if carrying and forward[1] < 0:
        result.alpha_composite(crate, crate_at)
    result.alpha_composite(core)
    if carrying and forward[1] > 0:
        result.alpha_composite(crate, crate_at)
        result.alpha_composite(arms[0][1])
    for layer in arms[1][:2]:
        result.alpha_composite(layer)
    from roster_rig import remove_specks
    return remove_specks(clean(result), 0), {
        'coreOffset': offset.tolist(), 'chestTurn': turn, 'feet': feet,
        'hands': [arm[2].round(4).tolist() for arm in arms],
        'cargoCenter': crate_center.round(4).tolist() if carrying else None,
        'motionRevision': REVISION,
    }


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
