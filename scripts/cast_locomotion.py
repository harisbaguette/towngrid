"""Sole-registered gait for the existing cast's authored texture rigs."""
import copy
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps
from character_body_motion import gait_bob, REVISION as BODY_REVISION

REVISION = 'cast-heel-toe-4'
UP = math.sqrt(2/3)
SAMPLES = 32


def calibrate_landmarks(spec,source):
    """Locate ankles inside the actual boots instead of a shared template."""
    if spec.get('kind')!='biped':return
    for view in spec['views']:
        alpha=np.asarray(Image.open(source/view['image']).convert('RGBA'))[:,:,3]>=128
        for joints in view['legs']:
            a,b,c=map(np.array,joints)
            left=max(0,round(c[0])-2);right=min(128,round(c[0])+3)
            ys,xs=np.where(alpha[:,left:right])
            if not len(ys):raise ValueError(f"{spec['id']}: no boot at {c}")
            c=c.astype(float);c[1]=float(ys.max()+1-6)
            b=a+(c-a)*.58
            joints[1]=b.round(3).tolist();joints[2]=c.tolist()


def sole_of(limb):
    alpha = np.asarray(limb['foot'])[:, :, 3] > 0
    below = np.zeros_like(alpha); below[:-1] = alpha[1:]
    ys, xs = np.where(alpha & ~below)
    ankle = np.asarray(limb['joints'][2])
    # Use the lower edge below the ankle, not a toe tip or the ankle itself.
    score = abs(xs+.5-ankle[0])*4-ys*.02
    index = int(score.argmin())
    return np.array([xs[index]+.5, ys[index]+1.])


def make_profile(rigs, spec):
    hover = spec.get('race') in ['fae', 'spirit'] or spec.get('kind') == 'spirit'
    mode = 'hover' if hover else spec.get('kind', 'biped')
    profile = {'revision': REVISION, 'samples': SAMPLES, 'mode': mode,
               'stance': .68 if mode == 'centaur' else .55,
               'footLift': 3.5, 'views': []}
    for rig in rigs:
        soles = [sole_of(limb) for limb in rig['legs']]
        if soles:
            origin = np.mean(soles, axis=0)
            widths = [limb['foot'].getbbox()[2]-limb['foot'].getbbox()[0] for limb in rig['legs']]
            half_width = spec['gait']['footHalfWidth'] if mode=='biped' else max(spec['gait']['footHalfWidth'], (max(widths)+1)/(2*math.sqrt(.5)))
        else:
            origin = np.array([np.mean([limb['joints'][0][0] for limb in rig['arms']]), spec.get('baseline',115)])
            half_width = 0
        from character_foot_roll import boot_contacts
        view = {'origin': origin.round(5).tolist(), 'soles': [v.tolist() for v in soles],
                'bootContacts': [boot_contacts(limb, sole, rig['forward']) for limb,sole in zip(rig['legs'],soles)] if mode=='biped' else [],
                'footHalfWidth': round(half_width,5), 'lengths': []}
        profile['views'].append(view)
    # Choose fixed lengths once, including the contact extremes and rest pose.
    # No frame stretches the chain to reach a distant foot.
    for rig, view in zip(rigs, profile['views']):
        if mode != 'biped': continue
        for index, limb in enumerate(rig['legs']):
            reach = 0
            for phase in [i/SAMPLES for i in range(SAMPLES)]:
                offset = [0,gait_bob(phase)]
                hip, ankle, _, _ = endpoints(rig, view, index, phase, True, offset, spec, profile)
                reach = max(reach, np.linalg.norm(ankle-hip))
            hip, ankle, _, _ = endpoints(rig, view, index, 0, False, [0,-3], spec, profile)
            reach = max(reach, np.linalg.norm(ankle-hip))+.35
            first, second = spec['gait']['thigh'], spec['gait']['shin']
            # The source drawings already contain perspective foreshortening.
            # Giving both painted legs the longest chain folds the shorter one.
            scale=reach/(first+second)
            view['lengths'].append([round(first*scale,6),round(second*scale,6)])
        bottom=0
        for phase in [i/SAMPLES for i in range(SAMPLES)]:
            for index,limb in enumerate(rig['legs']):
                _,ankle,project,_=endpoints(rig,view,index,phase,True,[0,0],spec,profile)
                bottom=max(bottom,project(ankle)[1]+limb['foot'].getbbox()[3]-limb['joints'][2][1])
        dy=min(0,125-math.ceil(bottom))
        if rig['core'].getbbox()[1]+dy<4:raise ValueError(f"{spec['id']}: stride needs more canvas headroom")
        view['renderOffset']=[0,dy]
    return profile


def endpoints(rig, view, index, phase, moving, offset, spec, profile):
    from mira_rig import foot_phase
    f = rig['forward']; lateral = np.array([math.copysign(math.sqrt(.5), f[1]), math.sqrt(1/6)])
    origin = np.array(view['origin']); limb = rig['legs'][index]
    root = np.array(rig['actionRoots'][index]) if rig.get('actionRoots') is not None else np.array(limb['joints'][0])+offset
    sole_delta = np.array(view['soles'][index])-limb['joints'][2]
    gait = {**spec['gait'], 'stance': profile['stance'], 'footLift': profile['footLift']}
    travel,lift,contact = foot_phase(phase+index*.5,gait) if moving else (0.,0.,True)
    step = spec['strideLength']*128/spec.get('worldHeight',1.05)
    floor = np.array([(-1 if index==0 else 1)*view['footHalfWidth'],lift,travel*step*gait['stance']/2])
    if rig.get('pivotAmount') and index==1:
        floor += [0,rig['pivotAmount']*2.5,rig['pivotAmount']*.8]
        lift=floor[1];contact=False
    ankle = floor+[-sole_delta[0]/lateral[0],(sole_delta[1]-lateral[1]*sole_delta[0]/lateral[0])/UP,0]
    foot_details = {}
    if view.get('bootContacts'):
        from character_foot_roll import foot_roll
        matrix,pivot,angle,support = foot_roll(phase+index*.5,gait['stance'],moving,
            view['bootContacts'][index],view['soles'][index],f)
        shift = (matrix-np.eye(2))@(limb['joints'][2]-pivot)
        dz=shift[0]/f[0];dy=(f[1]*dz-shift[1])/UP
        ankle += [0,dy,dz]
        foot_details = {'footMatrix':matrix.tolist(),'footPitch':angle,'supportPart':support,
                        'supportOffset':(pivot-np.array(view['soles'][index])).tolist()}
    hip_height = (origin[1]-np.mean([v['joints'][0][1] for v in rig['legs']])-offset[1])/UP
    hip_x,hip_z=np.linalg.solve(np.column_stack((lateral,f)),root-origin+[0,hip_height*UP])
    hip=np.array([hip_x,hip_height,hip_z])
    project = lambda p: origin+lateral*p[0]+f*p[2]-[0,p[1]*UP]
    return hip,ankle,project,{'contact':contact,'lift':lift,'travel':travel,'sole':project(floor).tolist(),
                            'supportPoint':(project(floor)+foot_details.get('supportOffset',[0,0])).tolist(),**foot_details}


def contact_legs(rig,phase,moving,offset,spec):
    profile=spec['contactMotion'];view=rig['contactView']
    mode=profile['mode'];results=[]
    if mode=='biped':
        for index,limb in enumerate(rig['legs']):
            hip,ankle,project,audit=endpoints(rig,view,index,phase,moving,offset,spec,profile)
            first,second=view['lengths'][index]
            delta=ankle-hip;distance=np.linalg.norm(delta);unit=delta/distance
            if distance>=first+second:raise ValueError(f"{spec['id']}: contact leg cannot reach {distance}")
            along=(first*first-second*second+distance*distance)/(2*distance)
            # Knees bend in the actor's forward plane, never sideways toward
            # the camera. The former camera-dependent pole crushed one calf.
            pole=np.array([0.,0.,1.])
            bend=pole-unit*np.dot(pole,unit);bend/=np.linalg.norm(bend)
            knee=hip+unit*along+bend*math.sqrt(max(0,first*first-along*along))
            results.append(([project(p) for p in [hip,knee,ankle]],{**audit,'joints3d':[p.tolist() for p in [hip,knee,ankle]],'lengths':[first,second]}))
    else:
        from mira_rig import foot_phase,joint
        for index,limb in enumerate(rig['legs']):
            a,b,c=limb['joints'];root=a+offset
            gait={**spec['gait'],'stance':profile['stance'],'footLift':profile['footLift']}
            travel,lift,contact=foot_phase(phase+[0,.5,.25,.75][index],gait) if moving and mode=='centaur' else (0.,0.,True)
            reach=spec['strideLength']*128/spec.get('worldHeight',1.05)*gait['stance']/2
            end=c+rig['forward']*travel*reach-[0,lift]
            if mode=='hover':end=c+offset+[0,-2]
            elif rig.get('pivotAmount') and index%2:
                lift+=rig['pivotAmount']*2;end[1]-=rig['pivotAmount']*2;contact=False
            knee=joint(root,end,[np.linalg.norm(b-a),np.linalg.norm(c-b)],rig['forward']*(-1 if index>=2 else 1))
            sole=end+np.array(view['soles'][index])-c
            results.append(([root,knee,end],{'contact':contact and mode!='hover','lift':lift,'travel':travel,'hoof':index,'sole':sole.tolist()}))
    return results


def bind_rigs(rigs,profile):
    for rig,view in zip(rigs,profile['views']):
        from mira_rig import move
        view=copy.deepcopy(view);offset=np.array(view.get('renderOffset',[0,0]))
        view['origin']=(np.array(view['origin'])+offset).tolist()
        view['soles']=[(np.array(p)+offset).tolist() for p in view['soles']]
        for contacts in view.get('bootContacts',[]):
            for name in contacts:contacts[name]=(np.array(contacts[name])+offset).tolist()
        rig['contactView']=view
        if offset.any():
            rig['core']=move(rig['core'],offset)
            for limb in rig['legs']+rig['arms']:
                limb['joints']=np.array(limb['joints'])+offset
                limb.pop('_skin',None)
                limb.pop('_palm',None)
                for name in ['upper','lower','foot']:
                    if name in limb:limb[name]=move(limb[name],offset)
            for extra in rig.get('extras',[]):
                extra['image']=move(extra['image'],offset);extra['pivot']+=offset
        for limb in rig['legs']:limb['rigidFoot']=True


def apply_contact_motion(atlas,meta,rigs,spec,render,crate,tool):
    profile=spec['contactMotion'];bind_rigs(rigs,profile)
    combined=Image.new('RGBA',(8192,1024));combined.paste(atlas,(0,0))
    meta['frameScales']=meta.get('frameScales',[1.]*64)+[1.]*64
    for action in ['walk','carry']:
        start=64 if action=='walk' else 96
        meta['clips'][action]={'frames':list(range(start,start+SAMPLES)),'fps':40,'strideLength':spec['strideLength']}
        meta['columns'].extend(f'{action}-contact-{i+1}' for i in range(SAMPLES))
    for direction in range(4):
        view_index=0 if direction in [0,3] else 1
        rig=rigs[view_index];mirrored=direction in [2,3]
        offset=np.array(profile['views'][view_index].get('renderOffset',[0,0]))
        origin=np.array(rig['contactView']['origin'])
        anchor=origin/128
        if mirrored:anchor[0]=1-anchor[0]
        meta['anchors'][direction]=[anchor.tolist() for _ in range(128)]
        meta['rigAudit'][direction].extend([None]*64)
        if offset.any():
            from mira_rig import move
            for col in range(64):
                box=(col*128,direction*128,(col+1)*128,(direction+1)*128)
                combined.paste(move(combined.crop(box),offset),box[:2])
                old=meta['rigAudit'][direction][col]
                old['coreOffset']=(np.array(old.get('coreOffset',[0,0]))+offset).tolist()
                for arm in old.get('arms',[]):
                    for key in ['shoulder','elbow','wrist','palm','grip']:
                        if key not in arm:continue
                        arm[key]=(np.array(arm[key])+offset).tolist()
                for foot in old['feet']:
                    for key in ['ankle','hip','knee']:
                        if key in foot:foot[key]=(np.array(foot[key])+offset).tolist()
        for action in ['idle','walk','carry','work','pickup','greet','turn']:
            frames=meta['clips'][action]['frames'];count=len(frames)
            for index,col in enumerate(frames):
                phase=index/(count-1) if action in ['pickup','greet'] else index/count
                if action=='turn':
                    rig['pivotAmount']=[0,1,1,0][index]
                    tile,audit=render(rig,'idle',index/3,spec,crate,tool)
                    rig.pop('pivotAmount')
                else:tile,audit=render(rig,action,phase,spec,crate,tool)
                audit['coreOffset']=(np.array(audit['coreOffset'])+offset).tolist()
                if mirrored:
                    tile=ImageOps.mirror(tile)
                    from character_arm_motion import mirror_arms
                    mirror_arms(audit)
                    if 'cargoCenter' in audit:audit['cargoCenter'][0]=128-audit['cargoCenter'][0]
                    for foot in audit['feet']:
                        for key in ['ankle','sole','supportPoint','hip','knee']:
                            if key in foot:foot[key][0]=128-foot[key][0]
                        if 'supportOffset' in foot:foot['supportOffset'][0]*=-1
                combined.paste(tile,((col%64)*128,(direction+(col//64)*4)*128))
                meta['rigAudit'][direction][col]={'action':action,'phase':phase,**audit}
        # Retain old frame addresses for tools, but make them samples of the
        # same new gait rather than keeping a second, divergent walking cycle.
        for action,start in [('walk',4),('carry',16)]:
            for i in range(12):
                col=meta['clips'][action]['frames'][round(i/12*SAMPLES)%SAMPLES]
                tile=combined.crop(((col%64)*128,(direction+4)*128,(col%64+1)*128,(direction+5)*128))
                combined.paste(tile,((start+i)*128,direction*128))
                meta['rigAudit'][direction][start+i]=copy.deepcopy(meta['rigAudit'][direction][col])
    if profile['mode']=='hover':meta['clips']['idle']['fps']=8
    meta.update(atlasColumns=64,atlasRows=8,frames=512,locomotionRevision=REVISION,
                locomotionMode=profile['mode'],contactMotion=profile,
                groundContactActions=['idle','walk','carry','work','pickup','drop','greet','turn','attack','hurt'],
                animationMethod='sole-registered-original-texture-rig',bodyMotionRevision=BODY_REVISION)
    source=Path(meta['source'])
    files=[source]
    if spec.get('id')=='mira':files += [source.parent/spec['source']]
    else:files += [source.parent/view['image'] for view in spec['views']]
    meta['locomotionSourceHashes']={path.as_posix():hashlib.sha256(path.read_bytes()).hexdigest() for path in files}
    return combined,meta
