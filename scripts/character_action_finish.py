"""Bake full pose paths, including recovery, into a third atlas page."""
import copy,hashlib,json
from pathlib import Path
import numpy as np
from PIL import Image,ImageOps

SOURCE=Path('art-source/pixel-characters/motion-v8/actions.json')


def install_action_finish(atlas,meta,rigs,spec,render,crate,tool):
    from character_actions import render_action
    config=json.loads(SOURCE.read_text(encoding='utf-8'))
    if spec.get('handlingMotion'):
        from roster_rig import prepare,render as roster_render
        from cast_locomotion import bind_rigs
        path=Path(spec['handlingMotion'])
        spec={**spec,**json.loads(path.read_text(encoding='utf-8'))}
        rigs=[prepare(path.parent,view,spec) for view in spec['views']]
        bind_rigs(rigs,spec['contactMotion']);render=roster_render
    result=Image.new('RGBA',(8192,1536));result.paste(atlas,(0,0))
    meta['columns'] += ['']*64
    meta['frameScales'] += [1.]*64
    for row in range(4):
        meta['anchors'][row] += [meta['anchors'][row][0][:] for _ in range(64)]
        meta['rigAudit'][row] += [None]*64
    weapon=None
    if spec.get('weaponFile'):
        from mira_rig import clean
        weapon=clean(Image.open(Path(spec.get('toolRoot','art-source/pixel-characters/roster-v4'))/spec['weaponFile']))
    for action,settings in config['clips'].items():
        count=settings['count'];frames=list(range(settings['start'],settings['start']+count))
        previous=copy.deepcopy(meta['clips'][action])
        # Bron retains the separately authored hammer poses and their timing.
        preserve=meta['id']=='bron' and action in ['attack','work']
        if preserve and action=='work':continue
        if not preserve:meta['clips'][action]={'frames':frames,'fps':settings['fps'],'once':not settings['loop']}
        for i,col in enumerate(frames):meta['columns'][col]=f'{action}-pose-{i+1}'
        for row in range(4):
            rig=rigs[0 if row in [0,3] else 1]
            for i,col in enumerate(frames):
                phase=i/count if action in ['idle','work'] else i/(count-1)
                if preserve:
                    old=previous['frames'][min(len(previous['frames'])-1,round(phase*(len(previous['frames'])-1)))]
                    x=old%64*128;y=(row+old//64*4)*128
                    tile=atlas.crop((x,y,x+128,y+128));audit=copy.deepcopy(meta['rigAudit'][row][old])
                    meta['anchors'][row][col]=meta['anchors'][row][old][:]
                    meta['frameScales'][col]=meta['frameScales'][old]
                else:
                    tile,audit=render(rig,action,phase,spec,crate,tool) if action in ['idle','greet','work'] else render_action(rig,action,phase,spec,weapon)
                    # Recovery poses meet exactly, including skinning and extras.
                    if action in ['greet','hurt','turn','attack'] and i in [0,count-1] or action=='defeat' and i==0:
                        tile,audit=render(rig,'idle',0,spec,crate,tool)
                    if row in [2,3]:
                        tile=ImageOps.mirror(tile)
                        from character_arm_motion import mirror_arms
                        mirror_arms(audit)
                        if 'cargoCenter' in audit:audit['cargoCenter'][0]=128-audit['cargoCenter'][0]
                        for foot in audit['feet']:
                            for key in ['ankle','sole','supportPoint','hip','knee']:
                                if key in foot:foot[key][0]=128-foot[key][0]
                    audit={'action':action,'phase':phase,**audit}
                result.paste(tile,(col%64*128,(row+col//64*4)*128))
                meta['rigAudit'][row][col]=audit
    meta.update(atlasRows=12,frames=768,actionRevision=config['revision'],turnMidpoint=4,
        actionSource=SOURCE.as_posix(),actionSourceHash=hashlib.sha256(SOURCE.read_bytes()).hexdigest())
    from character_actions import key_pose
    carried_hurt=list(range(54,62))
    active={frame for clip in meta['clips'].values() for frame in clip['frames']}
    if active.intersection(carried_hurt):raise ValueError('Carried hurt would overwrite an active pose')
    for row in range(4):
        rig=rigs[0 if row in [0,3] else 1]
        for index,col in enumerate(carried_hurt):
            phase=index/(len(carried_hurt)-1)
            recoil=key_pose(phase,[(0,0),(.16,1),(.45,.7),(1,0)])
            rig['reactionOffset']=(-rig['forward']*1.5+[0,1.5])*recoil
            try:tile,audit=render(rig,'pickup',1,spec,crate,tool)
            finally:rig.pop('reactionOffset',None)
            if row in [2,3]:
                tile=ImageOps.mirror(tile)
                from character_arm_motion import mirror_arms
                mirror_arms(audit)
                audit['cargoCenter'][0]=128-audit['cargoCenter'][0]
                for foot in audit['feet']:
                    for key in ['ankle','sole','supportPoint','hip','knee']:
                        if key in foot:foot[key][0]=128-foot[key][0]
            result.paste(tile,(col*128,row*128))
            meta['columns'][col]=f'hurt-carried-{index+1}'
            meta['anchors'][row][col]=meta['anchors'][row][meta['clips']['pickup']['frames'][-1]][:]
            meta['rigAudit'][row][col]={'action':'hurt','phase':phase,'carried':True,**audit}
    meta['variants']={'hurt':{'carry':{'frames':carried_hurt,'fps':40,'once':True}}}
    meta['groundContactActions']=list(meta['clips'])
    from character_arm_motion import REVISION
    meta['armMotionRevision']=REVISION
    arm_source=Path('scripts/character_arm_motion.py')
    meta['armMotionSource']=arm_source.as_posix()
    meta['armMotionSourceHash']=hashlib.sha256(arm_source.read_bytes()).hexdigest()
    from character_tool_motion import SOURCE as TOOL_SOURCE,configuration
    meta['toolAttachmentRevision']=configuration()['revision']
    meta['toolAttachmentSource']=TOOL_SOURCE.as_posix()
    meta['toolAttachmentSourceHash']=hashlib.sha256(TOOL_SOURCE.read_bytes()).hexdigest()
    return result,meta
