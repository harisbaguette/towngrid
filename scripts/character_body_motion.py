"""Shared body timing; feet remain controlled by the contact solver."""
import math
import numpy as np

REVISION = 'weight-transfer-and-handling-1'


def ease(value):
    value = max(0., min(1., value))
    return value*value*(3-2*value)


def gait_bob(phase, mode='biped'):
    if mode == 'hover':
        return round(math.sin(phase*math.tau))
    if mode == 'centaur':
        return round(-.6+.6*math.cos(phase*math.tau*4))
    # Contact -> weight acceptance -> passing -> heel rise -> next contact.
    # The former -sin² curve rose immediately after contact, skipping the down pose.
    t = (phase*2) % 1
    keys = [(0., 0.), (.2, 1.), (.55, -1.5), (.8, -1.9), (1., 0.)]
    for (start, a), (end, b) in zip(keys, keys[1:]):
        if t <= end:
            return round(a+(b-a)*ease((t-start)/(end-start)))
    return 0


def handling_pose(action, phase):
    t = max(0., min(1., phase))
    if action == 'pickup':
        reach = ease(t/.36)
        lift = ease((t-.4)/.6)
        crouch = ease(t/.36)*(1-lift)
        return dict(reach=reach, lift=lift, crouch=crouch, visible=True,
                    stage='reach' if t < .36 else 'grip' if t < .4 else 'lift')
    lower = ease(t/.52)
    release = ease((t-.55)/.23)
    rise = ease((t-.68)/.32)
    return dict(reach=1-release, lift=1-lower, crouch=lower*(1-rise),
                visible=t < .78, stage='lower' if t < .52 else 'release' if t < .78 else 'recover')


def install_handling(atlas, meta, rigs, spec, render, crate, tool):
    """Reuse inactive legacy walk/carry slots; atlas dimensions stay unchanged."""
    from PIL import ImageOps
    if len(meta['columns']) != 128:
        raise ValueError('Handling slots require the distance-driven locomotion atlas')
    clips = {'pickup': list(range(16, 28)), 'drop': list(range(4, 16))}
    active = {f for action, clip in meta['clips'].items() if action not in clips for f in clip['frames']}
    if active.intersection(sum(clips.values(), [])):
        raise ValueError('Handling would overwrite an active clip')
    for action, frames in clips.items():
        # Logistics completes a handling action after .55 seconds.
        meta['clips'][action] = {'frames': frames, 'fps': 24, 'once': True}
        for i, col in enumerate(frames):
            meta['columns'][col] = f'{action}-independent-{i+1}'
            meta['frameScales'][col] = 1.
        for row in range(4):
            rig = rigs[0 if row in [0, 3] else 1]
            anchor = meta['anchors'][row][0]
            for i, col in enumerate(frames):
                phase = i/(len(frames)-1)
                tile, audit = render(rig, action, phase, spec, crate, tool)
                render_offset = np.array(spec['contactMotion']['views'][0 if row in [0,3] else 1].get('renderOffset',[0,0]))
                audit['coreOffset'] = (np.array(audit['coreOffset'])+render_offset).tolist()
                if row in [2, 3]:
                    tile = ImageOps.mirror(tile)
                    from character_arm_motion import mirror_arms
                    mirror_arms(audit)
                    for foot in audit['feet']:
                        for key in ['ankle', 'sole', 'hip', 'knee']:
                            if key in foot:
                                foot[key][0] = 128-foot[key][0]
                    if 'cargoCenter' in audit:
                        audit['cargoCenter'][0] = 128-audit['cargoCenter'][0]
                atlas.paste(tile, (col*128, row*128))
                meta['anchors'][row][col] = anchor[:]
                meta['rigAudit'][row][col] = {'action': action, 'phase': phase, **audit}
    meta['handlingRevision'] = REVISION
    return atlas, meta
