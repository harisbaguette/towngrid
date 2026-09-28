"""Bake joint animation from imagegen-authored texture parts, with fixed head scale.

Art, masks and skeleton coordinates are versioned together. The head/torso is
translated only; no frame substitutes an independently generated face or body.
"""
import argparse
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageOps


def clean(image):
    a = np.array(image.convert('RGBA'))
    a[:, :, 3] = np.where(a[:, :, 3] >= 128, 255, 0)
    a[a[:, :, 3] == 0] = 0
    return Image.fromarray(a)


def cut_part(image, polygon, origin, scale, cell, baseline):
    mask = Image.new('L', image.size)
    ImageDraw.Draw(mask).polygon([tuple(p) for p in polygon], fill=255)
    a = np.array(image)
    a[:, :, 3] = np.minimum(a[:, :, 3], np.array(mask))
    part = Image.fromarray(a)
    # Fixed source-to-cell transform is shared by every limb and every frame.
    return part.transform((cell, cell), Image.Transform.AFFINE,
                          (1/scale, 0, origin[0]-cell/2/scale,
                           0, 1/scale, origin[1]-baseline/scale), Image.Resampling.NEAREST)


def move(image, offset):
    return image.transform(image.size, Image.Transform.AFFINE,
                           (1, 0, -round(offset[0]), 0, 1, -round(offset[1])), Image.Resampling.NEAREST)


def bone(image, a, b, c, d):
    before, after = b-a, d-c
    length = np.linalg.norm(before)
    along = before/length
    across = np.array([-along[1], along[0]])
    target = after/max(np.linalg.norm(after), .001)
    # Longitudinal projection may change, transverse limb width never scales.
    matrix = np.outer(after/length, along) + np.outer(np.array([-target[1], target[0]]), across)
    inverse = np.linalg.inv(matrix)
    offset = a-inverse@c
    return image.transform(image.size, Image.Transform.AFFINE,
                           (*inverse[0], offset[0], *inverse[1], offset[1]), Image.Resampling.NEAREST)


def joint(root, end, lengths, bend):
    vector = end-root
    distance = max(np.linalg.norm(vector), .001)
    first, second = lengths
    if distance > first+second-.01:
        extension = distance/(first+second-.01)
        first *= extension; second *= extension
    unit = vector/distance
    along = (first*first-second*second+distance*distance)/(2*distance)
    # A folded wrist/ankle can be closer than the planar chain's minimum
    # reach. Clamp the knee/elbow instead of producing a long texture spike.
    along = max(-first,min(first,along))
    height = math.sqrt(max(0, first*first-along*along))
    perpendicular = np.array([-unit[1], unit[0]])
    if np.dot(perpendicular, bend) < 0:
        perpendicular *= -1
    # Screen-space limb length foreshortens as the knee moves toward the camera.
    # Full planar IK would push the knee sideways like a paper cutout.
    return root+unit*along+perpendicular*height*.45


def foot_phase(phase, gait):
    t = phase % 1
    stance = gait['stance']
    if t < stance:
        return 1-2*t/stance, 0, True
    u = (t-stance)/(1-stance)
    # Matching endpoint velocity prevents the toe-off/heel-strike hitch.
    velocity = -2*(1-stance)/stance
    travel = -1+velocity*u+(6-3*velocity)*u*u+(2*velocity-4)*u*u*u
    return travel, gait['footLift']*math.sin(math.pi*u)**2, False


def leg_pose(rig, index, phase, moving, offset, spec):
    gait = spec['gait']
    side = -1 if index == 0 else 1
    forward = rig['forward']
    lateral = np.array([math.copysign(math.sqrt(.5),forward[1]), math.sqrt(1/6)])
    up = math.sqrt(2/3)
    origin = np.array([64., np.mean([limb['joints'][0][1] for limb in rig['legs']])+gait['pelvisHeight']*up])
    project = lambda p: origin+lateral*p[0]+forward*p[2]-[0,p[1]*up]
    travel,lift,contact = foot_phase(phase+index*.5,gait) if moving else (0,0,True)
    reach = spec['strideLength']*128/1.05*gait['stance']/2
    hip = np.array([side*gait['hipHalfWidth'],gait['pelvisHeight']-offset[1]/up,0.])
    ankle = np.array([side*gait['footHalfWidth'],lift,travel*reach])
    delta = ankle-hip
    distance = np.linalg.norm(delta)
    length_a,length_b = gait['thigh'],gait['shin']
    if distance >= length_a+length_b:
        raise ValueError(f'Unreachable leg pose: {distance:.3f} > {length_a+length_b}')
    unit = delta/distance
    along = (length_a**2-length_b**2+distance**2)/(2*distance)
    bend = np.array([0.,0.,1.])-unit*unit[2]
    bend /= np.linalg.norm(bend)
    knee = hip+unit*along+bend*math.sqrt(max(0,length_a**2-along**2))
    return [project(p) for p in [hip,knee,ankle]], {
        'foot':index,'ankle':project(ankle).round(4).tolist(),'contact':contact,
        'travel':round(travel,4),'lift':round(lift,4),
        'joints3d':[p.round(6).tolist() for p in [hip,knee,ankle]]}


def prepare(spec, image, view):
    def point(p):
        return (np.array(p)-view['origin'])*spec['scale'] + [spec['cell']/2, spec['baseline']]
    def part(poly):
        return cut_part(image, poly, view['origin'], spec['scale'], spec['cell'], spec['baseline'])
    result = {'core': part(view['core']), 'forward': np.array(view['forward']),
            **{kind: [{'joints': [point(p) for p in limb['joints']],
                       'upper': part(limb['upper']), 'lower': part(limb['lower'])}
                      for limb in view[kind]] for kind in ['arms', 'legs']}}
    for limb in result['legs']:
        ankle_y = limb['joints'][2][1]
        pixels = np.array(limb['lower'])
        shin, foot = pixels.copy(), pixels.copy()
        shin[math.ceil(ankle_y+1):,:,3] = 0
        foot[:math.floor(ankle_y-2),:,3] = 0
        limb['lower'] = Image.fromarray(shin)
        limb['foot'] = Image.fromarray(foot)
    return result


def prop_image(image, rect, size):
    prop = clean(image.crop(rect))
    prop = prop.crop(prop.getbbox())
    prop.thumbnail(size, Image.Resampling.NEAREST)
    return prop


def render(rig, action, phase, spec, crate, wrench):
    cell = spec['cell']
    layer = Image.new('RGBA', (cell, cell))
    f = rig['forward']
    moving = action in ['walk', 'carry']
    cargo = action in ['carry', 'pickup', 'drop']
    handling = action in ['pickup', 'drop']
    progress = 1-phase if action == 'drop' else phase
    crouch = math.sin(math.pi*progress)*11 if handling else 0
    # The pelvis rises over the planted leg at passing, then lowers at contact.
    # Standing straight is higher than the split-stance walking contact pose.
    bob = -round(1.8*math.sin(phase*2*math.pi)**2) if moving else -3+(round(math.sin(phase*math.pi)**2) if action == 'idle' else 0)
    offset = np.array([0., bob+crouch])
    leg_layers, arm_layers, audit = [], [], []
    for index, limb in enumerate(rig['legs']):
        a, b, c = limb['joints']
        (root,knee,end),foot = leg_pose(rig,index,phase,moving,offset,spec)
        leg_layers.append((bone(limb['upper'], a,b,root,knee), bone(limb['lower'], b,c,knee,end), move(limb['foot'],end-c)))
        audit.append(foot)
    crate_center = np.array([64., spec['baseline']-47.])+f*13+(offset if not handling else 0)
    if handling:
        lift = max(0, (progress-.3)/.7)
        crate_center += [0, (1-lift)*29]
    for index, limb in enumerate(rig['arms']):
        a,b,c = limb['joints']
        root = a+offset
        # Close the A pose into a natural rest position before adding arm swing.
        end = c + [-4 if c[0] > 64 else 4, -1]+offset
        if moving and not cargo:
            swing = math.cos(2*math.pi*(phase+(1-index)*.5))
            arm_length=np.linalg.norm(b-a)+np.linalg.norm(c-b)
            end=root+[0,arm_length*.92]+f*swing*4
        if cargo:
            grip = crate_center+([-crate.width/2+2, -5] if root[0] < 64 else [crate.width/2-2, -3])
            reach = min(1,progress*3) if handling else 1
            end = end*(1-reach)+grip*reach
        elif action in ['work', 'attack'] and index == 1:
            stroke = (.5-.5*math.cos(phase*2*math.pi))
            end = root+f*(8+10*stroke)+[0, -17+28*stroke]
        elif action == 'greet' and index == 1:
            raise_amount = math.sin(math.pi*phase)**.4
            end = end*(1-raise_amount)+(root+[7*math.sin(phase*math.pi*6), -16])*raise_amount
        lengths = [np.linalg.norm(b-a), np.linalg.norm(c-b)]
        elbow = joint(root,end,lengths,-f)
        arm_layers.append((bone(limb['upper'], a,b,root,elbow), bone(limb['lower'], b,c,elbow,end),end))
    # Far limbs, legs, torso, carried object, then near arm: consistent occlusion.
    for img in arm_layers[0][:2]: layer.alpha_composite(img)
    for pair in leg_layers:
        for img in pair: layer.alpha_composite(img)
    if cargo and f[1] < 0:
        layer.alpha_composite(crate, (round(crate_center[0]-crate.width/2), round(crate_center[1]-crate.height/2)))
    layer.alpha_composite(move(rig['core'],offset))
    if cargo and f[1] > 0:
        layer.alpha_composite(crate, (round(crate_center[0]-crate.width/2), round(crate_center[1]-crate.height/2)))
        layer.alpha_composite(arm_layers[0][1])
    for img in arm_layers[1][:2]: layer.alpha_composite(img)
    if action in ['work','attack']:
        hand = arm_layers[1][2]
        angle = -25+90*(.5-.5*math.cos(phase*2*math.pi))
        tool = wrench.rotate(angle, Image.Resampling.NEAREST, expand=True)
        layer.alpha_composite(tool, (round(hand[0]-tool.width/2), round(hand[1]-tool.height*.75)))
    return layer, {'coreOffset': offset.tolist(), 'feet': audit}


def pack_mira_rig(spec_path, output):
    spec_path = Path(spec_path)
    spec = json.loads(spec_path.read_text(encoding='utf-8'))
    source = spec_path.parent
    authored = clean(Image.open(source/spec['source']))
    portrait_sheet = Image.open(source/spec['portraitSource'])
    crate = prop_image(portrait_sheet, spec['crateRect'], (23,23))
    wrench = prop_image(portrait_sheet, spec['toolRect'], (8,24))
    rigs = [prepare(spec,authored,view) for view in spec['views']]
    # 48 columns stay below the common 8192px texture limit.
    counts = {'idle':4,'walk':12,'carry':12,'work':8,'pickup':6,'greet':6}
    columns, clips = [], {}
    for action,count in counts.items():
        clips[action] = {'frames':list(range(len(columns),len(columns)+count)),
                         'fps': 2 if action == 'idle' else 20 if action in ['walk','carry'] else 12}
        if action in ['walk','carry']: clips[action]['strideLength'] = spec['strideLength']
        if action == 'pickup': clips[action]['once'] = True
        columns += [f'{action}-{i+1}' for i in range(count)]
    clips['drop'] = {**clips['pickup'], 'frames': list(reversed(clips['pickup']['frames']))+[0]}
    clips['attack'] = {**clips['work']}
    clips['defeat'] = {'frames':[0], 'fps':1,'once':True}
    cell = spec['cell']
    atlas = Image.new('RGBA',(cell*len(columns),cell*4))
    audits = []
    for row in range(4):
        rig = rigs[0 if row in [0,3] else 1]
        mirrored = row in [2,3]
        row_audit = []
        for action,count in counts.items():
            for i,col in enumerate(clips[action]['frames']):
                phase = i/(count-1) if action in ['pickup','greet'] else i/count
                tile, audit = render(rig,action,phase,spec,crate,wrench)
                if mirrored:
                    tile = ImageOps.mirror(tile)
                    for foot in audit['feet']: foot['ankle'][0] = cell-foot['ankle'][0]
                atlas.alpha_composite(tile,(col*cell,row*cell))
                row_audit.append({'action':action,'phase':phase,**audit})
        audits.append(row_audit)
    target = Path(output)/'mira'
    target.mkdir(parents=True,exist_ok=True)
    atlas.save(target/'sprites.png',optimize=True)
    portrait = clean(portrait_sheet.crop(spec['portraitRect']))
    portrait.thumbnail((440,627),Image.Resampling.NEAREST)
    portrait.save(target/'portrait.png',optimize=True)
    from mira_portrait import bake_portrait
    portrait_animation = bake_portrait(portrait,spec['portraitMotion'],target)
    metadata = {'id':'mira','source':str(spec_path).replace('\\','/'),'revision':spec['revision'],
                'status':spec['status'],'directions':spec['directions'],'cell':[cell,cell],
                'columns':columns,'frames':len(columns)*4,'portrait':'portrait.png','atlas':'sprites.png',
                'sourceGrid':[2,1],'bodyPixels':100,'anchors':[[[.5,spec['baseline']/cell] for _ in columns] for _ in range(4)],
                'portraitAnimation':portrait_animation,
                'clips':clips,'animationMethod':'authored-texture-joint-rig','mirroredDirections':{'SE':'SW','NE':'NW'},
                'gait':spec['gait'],'rigAudit':audits,'limitations':['Mirrored opposite views','Attack shares tool-work motion','No dedicated injury/death artwork']}
    from character_actions import append_actions
    atlas,metadata=append_actions(atlas,metadata,rigs,{**spec,'kind':'biped'})
    atlas.save(target/'sprites.png',optimize=True)
    (target/'frames.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    proof = []
    for col in clips['walk']['frames']:
        panel=Image.new('RGBA',(cell*4,cell),'#dce9e6')
        for row in range(4): panel.alpha_composite(atlas.crop((col*cell,row*cell,(col+1)*cell,(row+1)*cell)),(row*cell,0))
        proof.append(panel.convert('RGB').resize((1024,256),Image.Resampling.NEAREST))
    proof[0].save(target/'walk-preview.gif',save_all=True,append_images=proof[1:],duration=round(1000/clips['walk']['fps']),loop=0)
    return metadata


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('spec')
    parser.add_argument('--output',default='public/assets/pixel-characters')
    args=parser.parse_args()
    meta=pack_mira_rig(args.spec,args.output)
    output=Path(args.output)
    catalog=[json.loads(path.read_text(encoding='utf-8')) for path in sorted(output.glob('*/frames.json'))]
    (output/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f"Mira: {meta['frames']} cells, fixed body textures, 12-frame alternating walking/carrying.")
