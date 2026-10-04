"""Check visible soles, fixed bones and preserved faces in the full cast pack."""
import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

parser=argparse.ArgumentParser()
parser.add_argument('--output',default='public/assets/pixel-characters')
parser.add_argument('--before',default='work/cast-locomotion-before')
parser.add_argument('--report',default='docs/verification/cast-locomotion-20261003/art-check.json')
args=parser.parse_args()
reports=[]
for path in sorted(Path(args.output).glob('*/frames.json')):
    meta=json.loads(path.read_text(encoding='utf-8'))
    if meta['id']=='bron':continue
    assert meta['locomotionRevision']=='cast-heel-toe-4',meta['id']
    spec=json.loads(Path(meta['source']).read_text(encoding='utf-8'))
    assert meta['contactMotion']==spec['contactMotion']
    for source,digest in meta['locomotionSourceHashes'].items():
        assert hashlib.sha256(Path(source).read_bytes()).hexdigest()==digest,(source,'stale pack')
    atlas=np.asarray(Image.open(path.parent/'sprites.png'))
    mode=meta['locomotionMode'];height=spec.get('worldHeight',1.05)
    report={'id':meta['id'],'mode':mode,'frames':0,'maxContactDrift':0.,'maxSolePixelError':0.,'heldFrameDriftBefore':0.,'heldFrameDriftAfter':0.}
    for row in range(4):
        f=np.array([-math.sqrt(.5) if row<2 else math.sqrt(.5),math.sqrt(1/6) if row in [0,3] else -math.sqrt(1/6)])
        for action in ['walk','carry']:
            clip=meta['clips'][action];frames=clip['frames'];count=len(frames)
            assert count==32
            assert clip['strideLength']==spec['strideLength']
            step=clip['strideLength']*128/height
            report['heldFrameDriftBefore']=step*np.linalg.norm(f)/12
            report['heldFrameDriftAfter']=step*np.linalg.norm(f)/count
            planted={};last_contact={}
            for tick in range(count*2):
                frame=frames[tick%count];audit=meta['rigAudit'][row][frame]
                tile=atlas[(row+4)*128:(row+5)*128,(frame%64)*128:(frame%64+1)*128]
                alpha=tile[:,:,3]>0
                if tick<count:report['frames']+=1
                assert alpha.sum()>350 and not(alpha[0].any() or alpha[-1].any() or alpha[:,0].any() or alpha[:,-1].any()),(meta['id'],row,frame,'clipped or empty')
                contact_count=sum(foot['contact'] for foot in audit['feet'])
                if mode=='biped':assert contact_count>=1,(meta['id'],'airborne step')
                elif mode=='centaur':assert contact_count>=2,(meta['id'],'unstable four-beat walk')
                else:assert contact_count==0
                visible=[]
                for index,foot in enumerate(audit['feet']):
                    if mode=='biped':
                        a,b,c=np.array(foot['joints3d'])
                        first,second=meta['contactMotion']['views'][0 if row in [0,3] else 1]['lengths'][index]
                        assert abs(np.linalg.norm(b-a)-first)<1e-6 and abs(np.linalg.norm(c-b)-second)<1e-6,(meta['id'],'stretching leg')
                    if foot['contact']:
                        world=np.array(foot['sole'])-np.array(meta['anchors'][row][frame])*128+tick/count*step*f
                        if not last_contact.get(index):planted[index]=world
                        error=float(np.linalg.norm(world-planted[index]))
                        report['maxContactDrift']=max(report['maxContactDrift'],error)
                        assert error<.001,(meta['id'],row,frame,index,'sliding sole',error)
                        ys,xs=np.where(alpha);sole=np.array(foot.get('supportPoint',foot['sole']))
                        pixel_error=float(np.min(np.hypot(xs+.5-sole[0],ys+1-sole[1])))
                        visible.append(pixel_error)
                    last_contact[index]=foot['contact']
                if visible:
                    error=min(visible);report['maxSolePixelError']=max(report['maxSolePixelError'],error)
                    assert error<1.75,(meta['id'],row,frame,'no visible support sole',error)
    before=Path(args.before)/meta['id']
    if before.exists():
        for name in ['portrait.png','portrait-idle.png']:
            assert (path.parent/name).read_bytes()==(before/name).read_bytes(),(meta['id'],'portrait changed')
        old_meta=json.loads((before/'frames.json').read_text(encoding='utf-8'))
        old=np.asarray(Image.open(before/'sprites.png'))
        # Compare a common unobstructed face area after undoing body translation.
        for row in range(4):
            mask=Image.new('L',(128,128),255)
            excluded=Image.new('L',(128,128))
            for extra in spec['views'][0 if row in [0,3] else 1].get('extras',[]):
                ImageDraw.Draw(excluded).polygon([tuple(p) for p in extra['polygon']],fill=255)
            # Wings are animated separately and can cross the rectangular crop.
            excluded=excluded.filter(ImageFilter.MaxFilter(9))
            face_mask=np.array(mask)>np.array(excluded)
            if row in [2,3]:face_mask=face_mask[:,::-1]
            face_mask=face_mask[10:30,44:84]
            for frame in meta['clips']['walk']['frames']:
                old_frame=old_meta['clips']['walk']['frames'][0]
                shift=round(meta['rigAudit'][row][frame]['coreOffset'][1])-round(old_meta['rigAudit'][row][old_frame]['coreOffset'][1])
                x=(frame%64)*128;y=(row+4)*128
                actual=atlas[y+10+shift:y+30+shift,x+44:x+84]
                old_x=old_frame%64*128;old_y=(row+old_frame//64*4)*128
                reference=old[old_y+10:old_y+30,old_x+44:old_x+84]
                opaque_face=face_mask & (reference[:,:,3]>0)
                assert np.array_equal(actual[opaque_face],reference[opaque_face]),(meta['id'],row,frame,'face pixels changed')
    reports.append(report)
assert len(reports)==50,len(reports)
out=Path(args.report);out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(reports,indent=2)+'\n',encoding='utf-8')
print(f"50 characters: {sum(r['frames'] for r in reports)} gait cells, visible planted soles, fixed bones, preserved portraits/faces PASS")
