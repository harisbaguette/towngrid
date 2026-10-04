"""Continuous 3D motion for Mira. Coordinates: +Z up, -Y forward.

This module has no renderer dependency. It supplies real joint positions and
rigid foot rotations, so sprite sampling cannot change the underlying gait.
"""
import math
import numpy as np

TAU = math.tau
STRIDE = 1.0
PERIOD = .8
STANCE = .62
THIGH, SHIN = .405, .390
UPPER_ARM, FOREARM = .238, .230
HEEL = np.array([0., .083, -.110])
TOE = np.array([0., -.169, -.110])


def v(*xyz):
    return np.array(xyz, dtype=float)


def unit(a):
    return a / max(float(np.linalg.norm(a)), 1e-9)


def smooth(t):
    t = min(1., max(0., t))
    return t*t*(3.-2.*t)


def rx(t):
    c, s = math.cos(t), math.sin(t)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def ry(t):
    c, s = math.cos(t), math.sin(t)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def rz(t):
    c, s = math.cos(t), math.sin(t)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def joint(start, end, length_a, length_b, pole):
    delta = end-start
    distance = float(np.linalg.norm(delta))
    if distance >= length_a+length_b:
        raise ValueError(f'Unreachable joint: {distance:.5f} >= {length_a+length_b}')
    axis = unit(delta)
    bend = unit(pole-start-axis*np.dot(pole-start, axis))
    along = (length_a**2-length_b**2+distance**2)/(2*distance)
    return start+axis*along+bend*math.sqrt(max(0., length_a**2-along**2))


def foot_stance(phase):
    if phase < .13:
        pitch = -.22*(1-smooth(phase/.13))
        pivot = HEEL
    elif phase > .43:
        pitch = .40*smooth((phase-.43)/(STANCE-.43))
        pivot = TOE
    else:
        pitch, pivot = 0., HEEL
    rot = rx(pitch)
    # Compensate for rotation about the physical heel/toe. Its world contact
    # moves at exactly root speed in local space throughout stance.
    base = -.31+STRIDE*phase
    ankle = v(0., base+pivot[1]-(rot@pivot)[1], -(rot@pivot)[2])
    return ankle, pitch


def foot(phase, side):
    phase %= 1
    if phase <= STANCE:
        ankle, pitch = foot_stance(phase)
    else:
        t = (phase-STANCE)/(1-STANCE)
        a, ap = foot_stance(STANCE)
        b, bp = foot_stance(0)
        # Hermite ends preserve the backward local velocity at liftoff and
        # touchdown; the foot then travels forward in the middle of swing.
        h00, h10 = 2*t**3-3*t*t+1, t**3-2*t*t+t
        h01, h11 = -2*t**3+3*t*t, t**3-t*t
        y = h00*a[1]+h01*b[1]+(h10+h11)*STRIDE*(1-STANCE)
        pitch = ap+(bp-ap)*smooth(t)
        z = a[2]+(b[2]-a[2])*smooth(t)+.105*math.sin(math.pi*t)**1.3
        ankle = v(0., y, z)
    ankle[0] = side*.096
    return ankle, pitch


def hip_height(phase):
    t = (phase*2) % 1
    keys = [(0., .835), (.19, .821), (.53, .872), (.76, .856), (1., .835)]
    for (a, za), (b, zb) in zip(keys, keys[1:]):
        if t <= b:
            return za+(zb-za)*smooth((t-a)/(b-a))
    return .835


def pose(phase, action='walk'):
    phase %= 1
    angle = phase*TAU
    moving = action in ['walk', 'carry']
    carry = action in ['carry','hold']
    sway = -.014*math.sin(angle) if moving else 0.
    pelvis = v(sway, 0., hip_height(phase) if moving else .886)
    hip_r = rz(.075*math.cos(angle) if moving else 0.)
    body_r = rz(-.105*math.cos(angle) if moving else 0.) @ rx(.045 if carry else .006)
    body_r = body_r @ ry(.022*math.sin(angle) if moving else 0.)
    if not moving:
        pelvis[2] += .0025*math.sin(angle)
    chest = pelvis + body_r@v(0., 0., .365)
    neck = pelvis + body_r@v(0., 0., .508)
    head_r = rz(.023*math.cos(angle) if moving else 0.)
    bones = {'pelvis': (pelvis, pelvis+hip_r@v(0.,0.,.15)),
             'torso': (pelvis, neck), 'head': (neck, neck+head_r@v(0.,0.,.37))}
    rotations = {'pelvis':hip_r, 'torso':body_r, 'head':head_r}
    feet, arms = {}, {}
    for side, label, offset in [(-1,'L',0.), (1,'R',.5)]:
        p = (phase+offset)%1
        hip = pelvis+hip_r@v(side*.092,0.,0.)
        ankle, pitch = foot(p,side) if moving else (v(side*.096,0.,.110),0.)
        knee = joint(hip,ankle,THIGH,SHIN,hip+v(side*.03,-1.,-.25))
        bones['thigh.'+label] = (hip,knee)
        bones['shin.'+label] = (knee,ankle)
        bones['foot.'+label] = (ankle,ankle+rx(pitch)@v(0.,-.20,0.))
        rotations['foot.'+label] = rx(pitch)
        shoulder = pelvis+body_r@v(side*.222,0.,.441)
        if carry:
            wrist = pelvis+body_r@v(side*.254,-.338,.225)
            elbow = joint(shoulder,wrist,UPPER_ARM,FOREARM,shoulder+v(side*.45,.06,-.4))
        else:
            a = (p*TAU)
            swing = .40*math.cos(a-.10) if moving else -.05
            lower = .36*math.cos(a-.30)-.22 if moving else -.14
            elbow = shoulder+body_r@(rx(swing)@unit(v(side*.10,0.,-1.))*UPPER_ARM)
            wrist = elbow+body_r@(rx(lower)@unit(v(side*.07,0.,-1.))*FOREARM)
        hand_end = wrist+unit(wrist-elbow)*.090
        bones['upper.'+label] = (shoulder,elbow)
        bones['fore.'+label] = (elbow,wrist)
        bones['hand.'+label] = (wrist,hand_end)
        feet[label] = {'ankle':ankle,'pitch':pitch,'phase':p,'support':moving and p<=STANCE,'hip':hip,'knee':knee}
        arms[label] = {'shoulder':shoulder,'elbow':elbow,'wrist':wrist}
    pony_root = neck+head_r@v(0.,.135,.365)
    pony_tip = pony_root+v(.036*math.sin(angle-.65) if moving else 0.,.10,.0)
    pony_tip[2] -= .37
    pony_tip[1] += .027*math.cos(angle*2-.7) if moving else .006*math.sin(angle)
    bones['pony'] = (pony_root,pony_tip)
    return {'bones':bones,'rotations':rotations,'feet':feet,'arms':arms,
            'cargo':pelvis+body_r@v(0.,-.375,.221),'bodyRotation':body_r,
            'rootDistance':STRIDE*phase if moving else 0.}


def transition(t, action, carrying=False):
    """One real starting step / settling step with a planted support foot."""
    t = min(1.,max(0.,t))
    move = pose(0.,'carry' if carrying else 'walk')
    idle = pose(0.,'hold' if carrying else 'idle')
    u = smooth(t)
    if action == 'start':
        a,b = idle,move
        distance = .19*u
        planted, swing = 'R','L'
    else:
        a,b = move,idle
        # End under the flat left foot, whose heel stays fixed while rolling.
        initial=move['feet']['L']
        heel_y=(initial['ankle']+rx(initial['pitch'])@HEEL)[1]
        distance = (-heel_y+HEEL[1])*u
        planted,swing = 'L','R'
    # Body blend only; feet use an independent contact-space construction.
    bones={name:(aa[0]*(1-u)+b['bones'][name][0]*u,
                 aa[1]*(1-u)+b['bones'][name][1]*u) for name,aa in a['bones'].items()}
    rotations={name: a['rotations'][name]*(1-u)+b['rotations'][name]*u for name in a['rotations']}
    feet={}
    for side,label in [(-1,'L'),(1,'R')]:
        fa,fb=a['feet'][label],b['feet'][label]
        pitch=fa['pitch']*(1-u)+fb['pitch']*u
        if label==planted:
            pivot=TOE if action=='start' else HEEL
            fixed=fa['ankle']+rx(fa['pitch'])@pivot
            ankle=fixed-rx(pitch)@pivot+v(0.,distance,0.)
        else:
            end_distance=.19 if action=='start' else (-heel_y+HEEL[1])
            world_a=fa['ankle']
            world_b=fb['ankle']-v(0.,end_distance,0.)
            ankle=world_a*(1-u)+world_b*u+v(0.,distance,.09*math.sin(math.pi*t)**1.5)
        hip=bones['thigh.'+label][0]
        knee=joint(hip,ankle,THIGH,SHIN,hip+v(side*.03,-1.,-.25))
        bones['thigh.'+label]=(hip,knee)
        bones['shin.'+label]=(knee,ankle)
        bones['foot.'+label]=(ankle,ankle+rx(pitch)@v(0.,-.20,0.))
        rotations['foot.'+label]=rx(pitch)
        # Restore exact arm lengths after endpoint blending.
        sh=bones['upper.'+label][0]
        wrist=bones['fore.'+label][1]
        el=joint(sh,wrist,UPPER_ARM,FOREARM,bones['upper.'+label][1])
        bones['upper.'+label]=(sh,el)
        bones['fore.'+label]=(el,wrist)
        bones['hand.'+label]=(wrist,wrist+unit(wrist-el)*.09)
        feet[label]={'ankle':ankle,'pitch':pitch,'support':label==planted,'hip':hip,'knee':knee}
    return {'bones':bones,'rotations':rotations,'feet':feet,'arms':{},
            'cargo':a['cargo']*(1-u)+b['cargo']*u,'bodyRotation':rotations['torso'],
            'rootDistance':distance}


def sample(action, t):
    if action in ['start','stop']:
        return transition(t,action)
    if action in ['carryStart','carryStop']:
        return transition(t,'start' if action=='carryStart' else 'stop',True)
    return pose(t,action)


if __name__ == '__main__':
    for action in ['idle','walk','carry','start','stop','hold','carryStart','carryStop']:
        for i in range(97):
            sample(action,i/96)
    print('Continuous poses are reachable')
