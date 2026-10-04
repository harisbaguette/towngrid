"""Joint poses for the original painted arms; no replacement character art."""
import math
import numpy as np

REVISION = 'fixed-arm-lengths-1'


def lengths_of(limb):
    a, b, c = np.asarray(limb['joints'], dtype=float)
    return np.array([np.linalg.norm(b-a), np.linalg.norm(c-b)])


def reach_pose(limb, root, target, pole):
    """Keep both painted segments at their source length, including tight folds."""
    first, second = lengths_of(limb)
    vector = np.asarray(target)-root
    distance = float(np.linalg.norm(vector))
    direction = vector/max(distance, .0001) if distance > .0001 else np.array([0., 1.])
    distance = float(np.clip(distance, abs(first-second)+.001, first+second-.001))
    end = root+direction*distance
    along = (first*first-second*second+distance*distance)/(2*distance)
    height = math.sqrt(max(0., first*first-along*along))
    perpendicular = np.array([-direction[1], direction[0]])
    if np.dot(perpendicular, pole) < 0:
        perpendicular *= -1
    elbow = root+direction*along+perpendicular*height
    return root, elbow, end


def walk_pose(limb, root, forward, phase, index, mode='biped'):
    """Shoulder pendulum and elbow follow-through, opposite the same-side leg."""
    first, second = lengths_of(limb)
    t = math.tau*(phase+(1-index)*.5)
    amplitude = .60 if mode != 'hover' else .10
    shoulder = amplitude*math.cos(t)-.10
    # The forearm follows the upper arm, rather than the elbow changing sides
    # when an inverse-kinematic wrist target crosses the shoulder line.
    forearm = amplitude*math.cos(t-.16)+.22
    def axis(angle):
        vector = np.array([0., math.cos(angle)])+forward*math.sin(angle)
        return vector/np.linalg.norm(vector)
    elbow = root+axis(shoulder)*first
    end = elbow+axis(forearm)*second
    return root, elbow, end


def grip_point(limb, arms, center, width):
    middle = np.mean([arm['joints'][0][0] for arm in arms])
    left = limb['joints'][0][0] < middle
    return center+[-width/2+2 if left else width/2-2, -5 if left else -3]


def carry_center(arms, offset, desired, width):
    """Place the prop inside both hands' reach, using one shared prop position."""
    center = np.array(desired, dtype=float)
    constraints = []
    for limb in arms:
        grip_offset = grip_point(limb, arms, np.zeros(2), width)
        circle = np.asarray(limb['joints'][0])+offset-grip_offset
        constraints.append((circle, float(sum(lengths_of(limb)))-.05))
    left = max(c[0]-r for c,r in constraints)
    right = min(c[0]+r for c,r in constraints)
    if left >= right:
        raise ValueError('The crate is wider than the two painted arms can hold')
    center[0] = np.clip(center[0], left+.0001, right-.0001)
    ceiling = max(c[1]-math.sqrt(max(0., r*r-(center[0]-c[0])**2)) for c,r in constraints)
    floor = min(c[1]+math.sqrt(max(0., r*r-(center[0]-c[0])**2)) for c,r in constraints)
    if ceiling > floor:
        raise ValueError('Both hands cannot reach the same crate position')
    center[1] = np.clip(center[1], ceiling, floor)
    return center


def handling_lowering(arms, offset, center, width, reach):
    """Squat far enough to reach the box instead of lengthening the sleeves."""
    lower = 0.
    for limb in arms:
        root = np.asarray(limb['joints'][0])+offset
        grip = grip_point(limb, arms, center, width)
        radius = float(sum(lengths_of(limb)))-.05
        horizontal = abs(float(grip[0]-root[0]))
        if horizontal < radius:
            lower = max(lower, float(grip[1]-root[1])-math.sqrt(radius*radius-horizontal*horizontal))
    return max(0., lower)*reach


def arm_audit(limb, pose):
    root, elbow, end = pose
    return {'shoulder':root.tolist(), 'elbow':elbow.tolist(), 'wrist':end.tolist(),
            'lengths':lengths_of(limb).tolist()}


def mirror_arms(audit):
    for arm in audit.get('arms', []):
        for key in ['shoulder', 'elbow', 'wrist', 'grip']:
            if key in arm:arm[key][0] = 128-arm[key][0]
