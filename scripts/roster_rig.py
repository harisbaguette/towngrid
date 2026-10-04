"""Bake the resident cast from reviewed rest-pose textures and joint landmarks.

The face and torso keep their original pixels. Humanoids use the approved
distance-driven, fixed-length 3D walking cycle; spirits and centaurs have their
own locomotion. Source masks, landmarks and motion settings are in each spec.
"""
import argparse
import json
import math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageOps
from scipy.ndimage import label
from mira_rig import clean, move, joint, foot_phase, prop_image
from mira_portrait import bake_portrait
from rig_skinning import limb_layers, SKINNING_REVISION
from character_body_motion import gait_bob, handling_pose, ease
from character_arm_motion import reach_pose, walk_pose, handling_lowering, arm_audit, mirror_arms, grip_point, carry_center

ROOT=Path('art-source/pixel-characters/roster-v4')
COUNTS={'idle':4,'walk':12,'carry':12,'work':8,'pickup':6,'greet':6}
UP=math.sqrt(2/3)
Y,X=np.mgrid[:128,:128]
XY=np.stack((X,Y),axis=-1)


def poly_mask(points):
    mask=Image.new('L',(128,128));ImageDraw.Draw(mask).polygon([tuple(p) for p in points],fill=255)
    return np.array(mask)>0


def segment_distance(a,b):
    a,b=np.array(a),np.array(b);delta=b-a
    t=np.clip(np.sum((XY-a)*delta,axis=-1)/max(np.dot(delta,delta),.001),0,1)
    return np.linalg.norm(XY-a-t[:,:,None]*delta,axis=-1)


def masked(image,mask):
    a=np.array(image);a[~mask]=0
    return Image.fromarray(a)


def prepare(source,view,spec):
    image=clean(Image.open(source/view['image']))
    core=poly_mask(view['core'])
    fixed=np.zeros((128,128),bool)
    for polygon in view.get('fixedPixels',[]):fixed|=poly_mask(polygon)
    core|=fixed
    roots=[arm[0] for arm in view['arms']]
    head=(Y<min(p[1] for p in roots)-2)|((Y<min(p[1] for p in roots)+5)&(X>min(p[0] for p in roots)+5)&(X<max(p[0] for p in roots)-5))
    if view.get('headPolygon'):
        head=poly_mask(view['headPolygon'])
    core|=head
    if spec.get('hairColor'):
        rgba=np.array(image)
        core|=(rgba[:,:,0]>135)&(rgba[:,:,1]>145)&(rgba[:,:,2]>100)&(rgba[:,:,1]>=rgba[:,:,0])&(X>68)&(Y<80)
    if spec['kind']=='spirit':
        left,right=view.get('tailBounds',[44,84])
        tail_region=(Y>=view['tailStart'])&(X>=left)&(X<=right)
        core|=tail_region
    extras=[{'image':masked(image,poly_mask(v['polygon'])),'pivot':np.array(v['pivot'],float),'kind':v['kind'],
             'offset':np.array(v.get('offset',[0,0]),float)} for v in view.get('extras',[])]
    extra_mask=np.zeros((128,128),bool)
    for extra in view.get('extras',[]): extra_mask|=poly_mask(extra['polygon'])
    candidates=[]
    for kind in ['arms','legs']:
        for limb in view.get(kind,[]):
            points=np.array(limb,float)
            distance=np.minimum(segment_distance(*points[:2]),segment_distance(*points[1:]))
            distance[Y<points[0,1]-(spec.get('shoulderCap',3) if kind=='arms' else 3)]=1000
            candidates.append((kind,points,distance))
    distances=np.stack([item[2] for item in candidates])
    owners=np.argmin(distances,axis=0)
    if spec.get('contactMotion') and len(view.get('legs',[]))==2:
        # A protruding toe can be nearer the other leg's line. Assign each
        # connected boot silhouette as a whole before splitting its layers.
        leg_indices=[i for i,item in enumerate(candidates) if item[0]=='legs']
        ankle_x=np.array([limb[2][0] for limb in view['legs']])
        boot_top=min(limb[2][1] for limb in view['legs'])-3
        alpha=np.asarray(image)[:,:,3]>0
        labels,count=label(alpha&(Y>=boot_top)&~extra_mask&~core,structure=np.ones((3,3)))
        for component in range(1,count+1):
            ys,xs=np.where(labels==component)
            if len(xs)<5 or xs.max()-xs.min()>abs(ankle_x[1]-ankle_x[0])+6:continue
            owner=int(np.argmin(abs(ankle_x-np.mean(xs))))
            owners[labels==component]=leg_indices[owner]
    lower_start=min((limb[0][1] for limb in view.get('legs',[])),default=view.get('tailStart',85))
    # Pixels above a limb's root are never reassigned to the opposite arm.
    # That used to rotate tiny shoulder/hair fragments beside the face.
    core|=(distances.min(axis=0)>spec.get('partRadius',24))&(Y<lower_start)
    # Core polygon is reviewed per view, preserving head, torso, hair and hems.
    result={'core':masked(image,core&~extra_mask),'arms':[],'legs':[],
            'extras':extras,'forward':np.array([-.70710678,.40824829 if view['image']=='SW.png' else -.40824829]),'view':view}
    for index,(kind,points,_) in enumerate(candidates):
        owned=(owners==index)&(~core|((Y>=points[0,1]-2) if kind=='legs' else False))&~extra_mask&~head&~fixed
        # Two pixels of overlap at the shoulder/hip prevent joint pinholes.
        root_overlap=(segment_distance(points[0],points[1])<view.get('jointRadius',4))&(Y>=points[0,1])&(Y<=points[0,1]+3)&~extra_mask&~head if kind=='arms' else np.zeros((128,128),bool)
        owned|=root_overlap&~fixed
        a,b,c=points
        split=np.sum((XY-b)*(c-a),axis=-1)/max(np.linalg.norm(c-a),.001)
        upper=masked(image,owned&(split<=2));lower=masked(image,owned&(split>=-2))
        entry={'joints':points,'upper':upper,'lower':lower}
        if kind=='legs':
            entry['foot']=masked(lower,Y>=c[1]-2)
            entry['lower']=masked(lower,Y<=c[1]+1)
        result[kind].append(entry)
    if spec['kind']=='spirit':
        tail=tail_region
        result['tail']=masked(result['core'],tail)
        result['core']=masked(result['core'],~tail)
    return result


def legs_pose(rig,phase,moving,offset,spec):
    if rig.get('contactView') is not None:
        from cast_locomotion import contact_legs
        return contact_legs(rig,phase,moving,offset,spec)
    f=rig['forward'];lateral=np.array([math.copysign(math.sqrt(.5),f[1]),math.sqrt(1/6)])
    legs=rig['legs'];gait=spec['gait']
    origin=np.mean([p['joints'][0] for p in legs],axis=0)+[0,gait['pelvisHeight']*UP]
    project=lambda p:origin+lateral*p[0]+f*p[2]-[0,p[1]*UP]
    results=[]
    for index,limb in enumerate(legs):
        side=-1 if index==0 else 1
        travel,lift,contact=foot_phase(phase+index*.5,gait) if moving else (0,0,True)
        reach=spec['strideLength']*128/spec['worldHeight']*gait['stance']/2
        hip=np.array([side*gait['hipHalfWidth'],gait['pelvisHeight']-offset[1]/UP,0.])
        ankle=np.array([side*gait['footHalfWidth'],lift,travel*reach])
        delta=ankle-hip;distance=np.linalg.norm(delta);unit=delta/distance
        first,second=gait['thigh'],gait['shin']
        if distance>=first+second:raise ValueError(f"{spec['id']}: unreachable leg {distance} >= {first+second}")
        along=(first*first-second*second+distance*distance)/(2*distance)
        bend=np.array([0.,0.,1.])-unit*unit[2];bend/=np.linalg.norm(bend)
        knee=hip+unit*along+bend*math.sqrt(max(0,first*first-along*along))
        results.append(([project(p) for p in [hip,knee,ankle]],{'contact':contact,'lift':lift,'travel':travel,'joints3d':[p.round(5).tolist() for p in [hip,knee,ankle]]}))
    return results


def horse_pose(rig,phase,moving,offset,spec):
    if rig.get('contactView') is not None:
        from cast_locomotion import contact_legs
        return contact_legs(rig,phase,moving,offset,spec)
    # Four-beat walk: hind-left, fore-left, hind-right, fore-right. Body and
    # fore/hind roots stay fixed; each hoof has a distinct planted interval.
    results=[]
    for i,limb in enumerate(rig['legs']):
        a,b,c=limb['joints'];travel,lift,contact=foot_phase(phase+[0,.5,.25,.75][i],spec['gait']) if moving else (0,0,True)
        reach=spec['strideLength']*128/spec['worldHeight']*spec['gait']['stance']/2
        root=a+offset;end=c+rig['forward']*travel*reach-[0,lift]
        knee=joint(root,end,[np.linalg.norm(b-a),np.linalg.norm(c-b)],rig['forward']*(-1 if i>=2 else 1))
        results.append(([root,knee,end],{'contact':contact,'lift':lift,'travel':travel,'hoof':i}))
    return results


def transform_extra(extra,phase,offset):
    image=extra['image'];pivot=extra['pivot']
    if extra['kind']=='wing':
        scale=.80+.20*math.cos(phase*math.tau)**2
        image=image.transform((128,128),Image.Transform.AFFINE,(1/scale,0,pivot[0]*(1-1/scale),0,1,0),Image.Resampling.NEAREST)
    else:
        angle=math.sin(phase*math.tau)*3
        image=image.rotate(angle,Image.Resampling.NEAREST,center=tuple(pivot))
    return move(image,offset+extra['offset'])


def remove_specks(image,protected_top):
    # Rotating a cut-out limb can disconnect one or two outline pixels.
    # Drop only tiny islands below the head; keep original facial pixels and
    # all substantial hair, wing and spirit wisps.
    rgba=np.array(image);mask=rgba[:,:,3]>0;seen=np.zeros(mask.shape,bool)
    for y,x in zip(*np.where(mask)):
        if seen[y,x]:continue
        stack=[(y,x)];seen[y,x]=True;points=[]
        while stack:
            py,px=stack.pop();points.append((py,px))
            for ny in range(max(0,py-1),min(128,py+2)):
                for nx in range(max(0,px-1),min(128,px+2)):
                    if mask[ny,nx] and not seen[ny,nx]:seen[ny,nx]=True;stack.append((ny,nx))
        if len(points)<=3 and min(p[0] for p in points)>protected_top:
            for py,px in points:rgba[py,px]=0
    return Image.fromarray(rgba)


def render(rig,action,phase,spec,crate,tool):
    if spec.get('authoredLocomotion') and action in ['walk','carry']:
        # Replaced by the authored pack after the shared action slots exist.
        return rig['core'],{'feet':[]}
    layer=Image.new('RGBA',(128,128));f=rig['forward']
    style=spec.get('workStyle','labor')
    moving=action in ['walk','carry'];cargo=action in ['carry','pickup','drop'] or action=='work' and style=='carrier';handling=action in ['pickup','drop']
    mode=spec.get('contactMotion',{}).get('mode',spec['kind'])
    bob=gait_bob(phase,mode) if moving else -2+round(math.sin(phase*math.pi)**2)
    if handling:bob=-2
    if moving and rig.get('contactView') is None:
        bob=-round(1.8*math.sin(phase*math.tau)**2)
    handling_state=handling_pose(action,phase) if handling else None
    crouch=handling_state['crouch']*5 if handling else 0
    if spec['kind']=='spirit':bob=round(math.sin(phase*math.tau)) if not handling else 0
    offset=np.array([0.,bob+crouch]);audit={'coreOffset':offset.tolist(),'feet':[]}
    reaction=np.array(rig.get('reactionOffset',[0.,0.]))
    offset+=reaction;audit['coreOffset']=offset.tolist()
    if action=='work' and rig.get('contactView') is not None:
        from profession_motion import body_offset
        offset+=body_offset(style,phase,f)
        audit['coreOffset']=offset.tolist()
    shoulders=np.array([p['joints'][0] for p in rig['arms']])
    crate_center=shoulders.mean(axis=0)+[0,21]+f*10+offset
    if cargo:crate_center=carry_center(rig['arms'],offset,crate_center,crate.width)
    if handling:
        standing=np.array([0.,0 if spec['kind']=='spirit' else -2])+reaction
        crate_center=carry_center(rig['arms'],standing,shoulders.mean(axis=0)+[0,21]+f*10+standing,crate.width)
        crate_center[1]+=(1-handling_state['lift'])*18
        offset[1]+=handling_lowering(rig['arms'],offset,crate_center,crate.width,handling_state['reach'])
        audit['coreOffset']=offset.tolist()
    leg_layers=[]
    poses=horse_pose(rig,phase,moving,offset,spec) if spec['kind']=='centaur' else legs_pose(rig,phase,moving,offset,spec) if rig['legs'] else []
    for limb,(pose,foot) in zip(rig['legs'],poses):
        a,b,c=limb['joints'];root,knee,end=pose
        leg_layers.append(limb_layers(limb,root,knee,end,foot.get('footMatrix')))
        entry={**foot,'ankle':end.round(4).tolist()}
        if rig.get('contactView') is not None:
            entry.update(hip=root.round(4).tolist(),knee=knee.round(4).tolist())
        audit['feet'].append(entry)
    arms=[];audit['arms']=[]
    for i,limb in enumerate(rig['arms']):
        a,b,c=limb['joints'];root=a+offset;lengths=[np.linalg.norm(b-a),np.linalg.norm(c-b)]
        end=c+[3 if c[0]<a[0] else -3,0]+offset
        if cargo:
            grip=grip_point(limb,rig['arms'],crate_center,crate.width)
            reach=handling_state['reach'] if handling else 1;end=end*(1-reach)+grip*reach
        elif action=='work':
            from profession_motion import hand_pose
            end=hand_pose(style,i,root,shoulders+offset,f,phase,end)
            reach=np.linalg.norm(end-root)
            if reach>sum(lengths)*.98:end=root+(end-root)/reach*sum(lengths)*.98
        elif action=='greet' and i==1:
            amount=ease(phase/.3)*(1-ease((phase-.72)/.28))
            end=end*(1-amount)+(root+[5*math.sin(phase*math.pi*6),-12])*amount
        pose=walk_pose(limb,root,f,phase,i,mode) if moving and not cargo else reach_pose(limb,root,end,-f)
        root,elbow,end=pose
        audit['arms'].append(arm_audit(limb,pose))
        if cargo:audit['arms'][-1]['grip']=grip.tolist()
        arms.append([*limb_layers(limb,root,elbow,end),end])
    for extra in rig['extras']:layer.alpha_composite(transform_extra(extra,phase,offset))
    for img in arms[0][:2]:layer.alpha_composite(img)
    for pair in leg_layers:
        for img in pair:layer.alpha_composite(img)
    if 'tail' in rig:
        a=np.array(rig['tail']);start=rig['view']['tailStart'];weight=np.clip((Y-start)/max(1,115-start),0,1)
        shift=np.rint(np.sin(phase*math.tau-weight*2)*weight*2).astype(int)
        sx=np.clip(X-shift,0,127);tail=Image.fromarray(a[Y,sx]);layer.alpha_composite(move(tail,offset))
    show_cargo=cargo and (not handling or handling_state['visible'])
    if show_cargo and f[1]<0:layer.alpha_composite(crate,tuple(np.rint(crate_center-[crate.width/2,crate.height/2]).astype(int)))
    layer.alpha_composite(move(rig['core'],offset))
    if show_cargo and f[1]>0:
        layer.alpha_composite(crate,tuple(np.rint(crate_center-[crate.width/2,crate.height/2]).astype(int)))
        layer.alpha_composite(arms[0][1])
    for img in arms[1][:2]:layer.alpha_composite(img)
    if action=='work' and style!='carrier':
        from profession_motion import tool_angle
        hand=arms[1][2];prop=tool.rotate(tool_angle(style,phase),Image.Resampling.NEAREST,expand=True)
        layer.alpha_composite(prop,(round(hand[0]-prop.width/2),round(hand[1]-prop.height*.75)))
    head_bottom=min(arm['joints'][0,1] for arm in rig['arms'])-2+offset[1]
    if cargo:audit.update(cargoCenter=crate_center.tolist(),cargoSize=list(crate.size))
    if handling:audit.update(handling=handling_state,cargoCenter=crate_center.tolist())
    return remove_specks(clean(layer),head_bottom),audit


def pack_roster_rig(spec_path,output='public/assets/pixel-characters'):
    path=Path(spec_path);spec=json.loads(path.read_text(encoding='utf-8'));source=path.parent
    rigs=[prepare(source,v,spec) for v in spec['views']]
    props=Image.open('art-source/pixel-characters/prototypes/mira-v3/portrait-props.png')
    crate=prop_image(props,[882,256,1254,670],(23,23));tool=prop_image(props,[978,704,1168,1225],(8,24))
    if spec.get('toolFile'):tool=clean(Image.open(Path(spec.get('toolRoot',ROOT))/spec['toolFile']))
    columns=[];clips={}
    for action,count in COUNTS.items():
        clips[action]={'frames':list(range(len(columns),len(columns)+count)),'fps':2 if action=='idle' else 20 if action in ['walk','carry'] else 12}
        if action in ['walk','carry']:clips[action]['strideLength']=spec['strideLength']
        if action=='pickup':clips[action]['once']=True
        columns += [f'{action}-{i+1}' for i in range(count)]
    clips['drop']={**clips['pickup'],'frames':clips['pickup']['frames'][::-1]+[0]}
    clips['attack']={**clips['work']};clips['defeat']={'frames':[0],'fps':1,'once':True}
    atlas=Image.new('RGBA',(128*len(columns),512));audits=[]
    for row in range(4):
        rig=rigs[0 if row in [0,3] else 1];audit_row=[]
        for action,count in COUNTS.items():
            for i,col in enumerate(clips[action]['frames']):
                phase=i/(count-1) if action in ['pickup','greet'] else i/count
                tile,audit=render(rig,action,phase,spec,crate,tool)
                if row in [2,3]:
                    tile=ImageOps.mirror(tile)
                    mirror_arms(audit)
                    if 'cargoCenter' in audit:audit['cargoCenter'][0]=128-audit['cargoCenter'][0]
                    for foot in audit['feet']:foot['ankle'][0]=128-foot['ankle'][0]
                atlas.alpha_composite(tile,(col*128,row*128));audit_row.append({'action':action,'phase':phase,**audit})
        audits.append(audit_row)
    target=Path(output)/spec['id'];target.mkdir(parents=True,exist_ok=True)
    atlas.save(target/'sprites.png',optimize=True)
    portrait=clean(Image.open(source/'portrait.png'));portrait.save(target/'portrait.png',optimize=True)
    motion={'size':[220,314],'samples':32,'frameMs':125,'headRise':1,'shoulderRise':2,'tailSway':0,
            'headBottom':175,'shoulderBottom':205,'waistTop':270,'chestTop':178,'chestBottom':230,**spec.get('portraitMotion',{})}
    animation=bake_portrait(portrait,motion,target)
    anchors=[]
    for row in range(4):
        rig=rigs[0 if row in [0,3] else 1]
        center=float(np.mean([v['joints'][0][0] for v in rig['legs'] or rig['arms']]))/128
        if row in [2,3]:center=1-center
        anchors.append([[center,spec.get('baseline',108)/128] for _ in columns])
    meta={'id':spec['id'],'revision':'roster-professions-1','source':path.as_posix(),'status':'in-game-test',
          'directions':['SW','NW','NE','SE'],'cell':[128,128],'columns':columns,'frames':192,
          'portrait':'portrait.png','atlas':'sprites.png','bodyPixels':100,
          'anchors':anchors,
          'portraitAnimation':animation,'clips':clips,'animationMethod':'authored-texture-joint-rig','rigFinish':SKINNING_REVISION,
          'locomotion':spec['kind'],'worldHeight':spec['worldHeight'],'gait':spec['gait'],'rigAudit':audits,'profession':spec.get('profession'),'workStyle':spec.get('workStyle','labor'),
          'mirroredDirections':{'SE':'SW','NE':'NW'},'limitations':['Opposite views mirrored','Attack shares profession work','No dedicated injury/death drawing']}
    from character_actions import append_actions
    # Work and combat share the same complete sleeve masks and joint mapping.
    action_rigs=[prepare(source,v,{**spec,'partRadius':24}) for v in spec['views']]
    atlas,meta=append_actions(atlas,meta,action_rigs,spec)
    if spec.get('contactMotion'):
        from cast_locomotion import apply_contact_motion
        atlas,meta=apply_contact_motion(atlas,meta,rigs,spec,render,crate,tool)
    if spec.get('authoredMotion'):
        from bron_motion import apply_hammer_cels
        atlas,meta=apply_hammer_cels(atlas,meta,spec['authoredMotion'])
    if spec.get('authoredLocomotion'):
        from bron_locomotion import apply_locomotion
        atlas,meta=apply_locomotion(atlas,meta,target)
        if meta['authoredLocomotion']!=spec['authoredLocomotion'] or meta['clips']['walk']['strideLength']!=spec['strideLength']:
            raise ValueError('Authored locomotion source/stride disagrees with roster rig')
    if spec.get('contactMotion'):
        from character_body_motion import install_handling
        atlas,meta=install_handling(atlas,meta,rigs,spec,render,crate,tool)
    if spec.get('handlingMotion'):
        from bron_handling import apply_handling
        atlas,meta=apply_handling(atlas,meta,spec['handlingMotion'],crate,tool)
    from character_action_finish import install_action_finish
    atlas,meta=install_action_finish(atlas,meta,rigs,spec,render,crate,tool)
    atlas.save(target/'sprites.png',optimize=True)
    (target/'frames.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    proof=[]
    for col in clips['walk']['frames']:
        panel=Image.new('RGBA',(512,128),'#dce9e6')
        for row in range(4):
            columns=meta.get('atlasColumns',len(meta['columns']));x=(col%columns)*128;y=(row+(col//columns)*4)*128
            panel.alpha_composite(atlas.crop((x,y,x+128,y+128)),(row*128,0))
        proof.append(panel.convert('RGB').resize((1024,256),Image.Resampling.NEAREST))
    proof[0].save(target/'walk-preview.gif',save_all=True,append_images=proof[1:],duration=round(1000/clips['walk']['fps']),loop=0)
    return meta


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('ids',nargs='*');parser.add_argument('--output',default='public/assets/pixel-characters');args=parser.parse_args()
    ids=args.ids or [p.parent.name for p in sorted(ROOT.glob('*/rig.json'))]
    for identity in ids:
        meta=pack_roster_rig(ROOT/identity/'rig.json',args.output);print(f'{identity}: {meta["frames"]} cells, {meta["locomotion"]}')
    output=Path(args.output);catalog=[json.loads(p.read_text(encoding='utf-8')) for p in sorted(output.glob('*/frames.json'))]
    (output/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
