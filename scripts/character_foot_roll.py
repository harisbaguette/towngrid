"""Heel/ball/toe support for the existing painted boots.

The boot moves as one rigid part in its sagittal plane. The ankle follows the
same transform before the fixed-length leg is solved, so it cannot detach.
"""
import math
import numpy as np
from character_body_motion import ease

UP = math.sqrt(2/3)


def boot_contacts(limb, sole, forward):
    alpha = np.asarray(limb['foot'])[:, :, 3] > 0
    below = np.zeros_like(alpha); below[:-1] = alpha[1:]
    ys, xs = np.where(alpha & ~below)
    points = np.column_stack((xs+.5, ys+1.))
    travel = (points[:, 0]-sole[0])/forward[0]
    # Use visible outsole contours, not the rectangular image's empty margin.
    result = {}
    for name, percentile in [('heel', 15), ('toe', 85)]:
        target = np.percentile(travel, percentile)
        score = abs(travel-target)+abs(points[:, 1]-sole[1])*.05
        result[name] = points[int(score.argmin())].tolist()
    return result


def foot_roll(phase, stance, moving, contacts, sole, forward):
    t = phase % 1
    angle = 0.; support = 'flat'
    if moving:
        if t < .10:
            angle = 18*(1-ease(t/.10)); support = 'heel'
        elif t < stance-.16:
            angle = 0.
        elif t < stance:
            angle = -24*ease((t-(stance-.16))/.16); support = 'toe'
        else:
            u = (t-stance)/(1-stance)
            angle = -24+(18+24)*ease(u); support = 'swing'
    pivot = np.array(contacts['heel' if angle > 0 else 'toe']) if angle else np.array(sole)
    basis = np.column_stack((forward, [0., -UP]))
    a = math.radians(angle)
    rotation = np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]])
    matrix = basis @ rotation @ np.linalg.inv(basis)
    return matrix, pivot, angle, support
