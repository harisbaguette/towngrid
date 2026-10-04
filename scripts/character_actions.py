"""Append joint-authored combat and foot-pivot poses without replacing locomotion.

Preserve the first 48 columns supplied by the shared locomotion rig. Each new
pose moves the original head/torso and limbs; defeat is not a rotated idle card.
"""
import math
from pathlib import Path
import numpy as np
from PIL import Image,ImageOps
from mira_rig import clean,joint
from rig_skinning import limb_layers
from character_body_motion import ease
from character_arm_motion import reach_pose, arm_audit, mirror_arms

COUNTS={'attack':6,'hurt':2,'defeat':4,'turn':4}


def key_pose(phase,keys):
    for (start,a),(end,b) in zip(keys,keys[1:]):
        if phase<=end:return a+(b-a)*ease((phase-start)/(end-start))
    return keys[-1][1]

def transform_image(image,pivot,angle,offset):
    # Rotate and translate in one sampling pass. An intermediate 128px rotate
    # canvas would cut the head off before the fallen body is moved into place.
    angle=math.radians(angle)
    inverse=np.array([[math.cos(angle),-math.sin(angle)],[math.sin(angle),math.cos(angle)]])
    origin=pivot-inverse@(pivot+offset)
    return image.transform(image.size,Image.Transform.AFFINE,(*inverse[0],origin[0],*inverse[1],origin[1]),Image.Resampling.NEAREST)

def render_action(rig,action,phase,spec,weapon=None):
    f=np.array(rig['forward']);arms=rig['arms'];legs=rig['legs'];kind=spec.get('kind','biped')
    roots=np.array([limb['joints'][0] for limb in legs or arms]);pivot=roots.mean(axis=0)
    if not legs:pivot += [0,26]
    angle=0.;offset=np.zeros(2);strike=0;amount=0
    settled=rig.get('contactView') is not None
    rest=-3 if spec.get('id')=='mira' else 0 if kind=='spirit' else -2
    if action=='attack':
        strike=key_pose(phase,[(0,0),(.25,-.2),(.43,1),(.58,.8),(1,0)])
        offset=f*(strike*3);angle=-3*strike
    elif action=='hurt':
        amount=key_pose(phase,[(0,0),(.16,1),(.45,.7),(1,0)])
        offset=-f*4*amount;angle=5*amount
    elif action=='defeat':
        amount=key_pose(phase,[(0,0),(.18,.08),(.62,.85),(1,1)])
        angle=-78*amount
        offset=np.array([-18*amount,17*amount])
        if kind=='centaur':angle=0;offset=np.array([0,12*amount])
        if kind=='spirit':angle=-15*amount;offset=np.array([0,7*amount])
    elif action=='turn':
        amount=key_pose(phase,[(0,0),(.38,1),(.62,1),(1,0)])
        angle=3*amount;offset=np.array([0,-amount])
    if settled:offset[1]+=rest*(1-amount if action=='defeat' else 1)
    radians=-math.radians(angle)
    rotation=np.array([[math.cos(radians),-math.sin(radians)],[math.sin(radians),math.cos(radians)]])
    point=lambda p:pivot+rotation@(np.array(p)-pivot)+offset
    output=Image.new('RGBA',(128,128));leg_layers=[];arm_layers=[];audit=[];arm_details=[]
    contact_poses=None;rest_poses=None
    if settled and action=='defeat':
        from cast_locomotion import contact_legs
        rest_poses=contact_legs(rig,0,False,np.array([0.,rest]),spec)
    if settled and action!='defeat':
        from cast_locomotion import contact_legs,endpoints,UP
        rig['actionRoots']=[point(limb['joints'][0]) for limb in legs]
        if action=='turn':rig['pivotAmount']=amount
        if spec['contactMotion']['mode']=='biped':
            lower=0.
            for i,limb in enumerate(legs):
                hip,ankle,_,_=endpoints(rig,rig['contactView'],i,0,False,offset,spec,spec['contactMotion'])
                length=sum(rig['contactView']['lengths'][i])-.02
                horizontal=np.linalg.norm((hip-ankle)[[0,2]])
                if horizontal>=length:raise ValueError(f"{spec['id']}: action reaches beyond fixed leg")
                lower=max(lower,(hip[1]-ankle[1]-math.sqrt(length*length-horizontal*horizontal))*UP)
            # Bend into a planted lunge instead of lengthening either bone.
            offset[1]+=lower
            rig['actionRoots']=[point(limb['joints'][0]) for limb in legs]
        try:contact_poses=contact_legs(rig,0,False,offset,spec)
        finally:
            rig.pop('actionRoots',None);rig.pop('pivotAmount',None)
    for i,limb in enumerate(legs):
        a,b,c=map(np.array,limb['joints']);root=point(a);end=c.copy()
        if action=='defeat':
            start=rest_poses[i][0][2] if rest_poses is not None else c
            if kind=='centaur':end=c+[8*amount,-2*amount]
            else:
                resting=np.array([pivot[0]-40+12*i,spec.get('baseline',108)-3+4*(i%2)])
                end=start*(1-amount)+resting*amount
        elif action=='turn':
            if i%2:end=c+[2*amount,-3*amount]
        bend=np.array([0.,-1.]) if action=='defeat' and kind=='biped' else f if i%2 else -f
        knee=joint(root,end,[np.linalg.norm(b-a),np.linalg.norm(c-b)],bend)
        if rest_poses is not None:
            blend=ease(amount/.25)
            knee=rest_poses[i][0][1]*(1-blend)+knee*blend
        foot={}
        if contact_poses is not None:(root,knee,end),foot=contact_poses[i]
        leg_layers.append(limb_layers(limb,root,knee,end,foot.get('footMatrix')))
        audit.append({'contact':bool(np.linalg.norm(end-c)<.01),**foot,
                      'ankle':end.tolist(),'hip':root.tolist(),'knee':knee.tolist()})
    for i,limb in enumerate(arms):
        a,b,c=map(np.array,limb['joints']);root=point(a);lengths=[np.linalg.norm(b-a),np.linalg.norm(c-b)]
        rest_hand=c+([4 if c[0]<64 else -4,-1] if spec.get('id')=='mira' else [3 if c[0]<a[0] else -3,0])
        end=point(rest_hand)
        if action=='attack':
            engaged=key_pose(phase,[(0,0),(.2,1),(.65,1),(1,0)])
            target=root+f*(10+19*strike)+[0,-3-6*math.sin(phase*math.pi)] if i==1 else root+f*8+[0,5]
            end=end*(1-engaged)+target*engaged
        elif action=='hurt':end=end*(1-amount)+(root+f*(8 if i else 4)+[0,4])*amount
        elif action=='defeat':
            target=np.array([pivot[0]-18+18*i,99-5*i])
            if kind in ['centaur','spirit']:target=root+[(-4 if i==0 else 4),sum(lengths)*.8]
            end=end*(1-amount)+target*amount
        elif action=='turn':
            end+=f*(3 if i else -3)*amount
        reach=np.linalg.norm(end-root)
        if reach>sum(lengths)*.98:end=root+(end-root)/reach*sum(lengths)*.98
        pose=reach_pose(limb,root,end,-f)
        root,elbow,end=pose
        arm_details.append(arm_audit(limb,pose))
        arm_layers.append([*limb_layers(limb,root,elbow,end),end])
    for extra in rig.get('extras',[]):
        attachment=extra['pivot'];world_attachment=point(attachment+extra.get('offset',np.zeros(2)))
        fold=-90*amount if action=='defeat' and kind=='biped' and extra['kind']=='tail' else 0
        output.alpha_composite(transform_image(extra['image'],attachment,angle+fold,world_attachment-attachment))
    if 'tail' in rig:output.alpha_composite(transform_image(rig['tail'],pivot,angle,offset))
    for img in arm_layers[0][:2]:output.alpha_composite(img)
    for limb in leg_layers:
        for img in limb:output.alpha_composite(img)
    output.alpha_composite(transform_image(rig['core'],pivot,angle,offset))
    for img in arm_layers[1][:2]:output.alpha_composite(img)
    if action=='attack' and weapon is not None:
        hand=arm_layers[1][2];prop=weapon.rotate(35-105*strike,Image.Resampling.NEAREST,expand=True)
        output.alpha_composite(prop,(round(hand[0]-prop.width/2),round(hand[1]-prop.height*.8)))
    from roster_rig import remove_specks
    return remove_specks(clean(output),0),{'action':action,'phase':phase,'coreOffset':offset.tolist(),'coreAngle':angle,'feet':audit,'arms':arm_details}

def append_actions(atlas,meta,rigs,spec):
    assert len(meta['columns'])==48
    result=Image.new('RGBA',(8192,512));result.alpha_composite(atlas)
    weapon=None
    if spec.get('weaponFile'):
        path=Path(spec.get('toolRoot','art-source/pixel-characters/roster-v4'))/spec['weaponFile']
        weapon=clean(Image.open(path))
    for action,count in COUNTS.items():
        frames=list(range(len(meta['columns']),len(meta['columns'])+count))
        meta['columns'] += [f'{action}-{i+1}' for i in range(count)]
        meta['clips'][action]={'frames':frames,'fps':12 if action=='attack' else 10 if action=='hurt' else 5 if action=='defeat' else 20,'once':action!='attack'}
        for row in range(4):
            rig=rigs[0 if row in [0,3] else 1]
            for i,col in enumerate(frames):
                tile,audit=render_action(rig,action,i/(count-1),spec,weapon)
                if row in [2,3]:
                    tile=ImageOps.mirror(tile)
                    mirror_arms(audit)
                    for foot in audit['feet']:
                        for key in ['ankle','hip','knee']:foot[key][0]=128-foot[key][0]
                result.alpha_composite(tile,(col*128,row*128))
                meta['rigAudit'][row].append(audit)
                meta['anchors'][row].append(meta['anchors'][row][0][:])
    meta.update({'frames':256,'actionRevision':'combat-pivot-2','authoredDefeat':True,'turnMidpoint':2,
                 'limitations':['Opposite views mirrored','Joint-based original textures; not individually redrawn cels','Quarter turn uses foot pivot then switches the authored view']})
    return result,meta
