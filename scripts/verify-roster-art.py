"""Asset invariants for authored cast rigs, including faces and foot contacts."""
import json,math,sys,hashlib
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
ROOT=Path('art-source/pixel-characters/roster-v4')
OUTPUT=Path(sys.argv[1] if len(sys.argv)>1 else 'public/assets/pixel-characters')
report=[]
for path in sorted(list(ROOT.glob('*/rig.json'))+list(Path('art-source/pixel-characters/professions-v5').glob('*/rig.json'))):
    spec=json.loads(path.read_text(encoding='utf-8'));target=OUTPUT/spec['id'];meta=json.loads((target/'frames.json').read_text(encoding='utf-8'))
    atlas=np.array(Image.open(target/'sprites.png'))
    assert atlas.shape==(meta.get('atlasRows',4)*128,meta.get('atlasColumns',64)*128,4),spec['id']
    cells=0
    for row in range(meta.get('atlasRows',4)):
        for col in range(meta.get('atlasColumns',64)):
            a=atlas[row*128:(row+1)*128,col*128:(col+1)*128,3]
            assert np.count_nonzero(a)>350,(spec['id'],row,col,'empty')
            assert not(a[0].any() or a[-1].any() or a[:,0].any() or a[:,-1].any()),(spec['id'],row,col,'clipped')
            cells+=1
    if meta.get('authoredLocomotion'):
        assert spec['strideLength']==meta['clips']['walk']['strideLength']==meta['clips']['carry']['strideLength']
        for name,digest in meta['locomotionSourceHashes'].items():
            assert hashlib.sha256(Path(name).read_bytes()).hexdigest()==digest,(name,'repack required')
        for direction in range(4):
            forward=np.array([-.7071067811865476 if direction<2 else .7071067811865476,.4082482904638631 if direction in [0,3] else -.4082482904638631])
            for action in ['walk','carry']:
                clip=meta['clips'][action];locked=None
                for index,col in enumerate(clip['frames']):
                    row=direction+(col//64)*4
                    tile=atlas[row*128:(row+1)*128,(col%64)*128:(col%64+1)*128]
                    sole=np.array(meta['rigAudit'][direction][col]['sole'])
                    ys,xs=np.where(tile[:,:,3]>0)
                    assert np.min(np.hypot(xs+.5-sole[0],ys+1-sole[1]))<2,(direction,col,'contact misses the visible boot')
                    anchor=np.array(meta['anchors'][direction][col])*128
                    world=sole-anchor+forward*index/len(clip['frames'])*spec['strideLength']*128/spec['worldHeight']
                    if index%16==0:locked=world
                    assert np.linalg.norm(world-locked)<.00001,(direction,col,'sliding stance')
    else:
        # Top head pixels stay rigid through gait. Shoulder/hand regions are
        # intentionally excluded because arms can occlude them during carrying.
        for row in [0,1]:
            height=int(min(limb[0][1] for limb in spec['views'][row]['arms']))-7
            source=np.array(Image.open(path.parent/spec['views'][row]['image']))[:height]
            mask=source[:,:,3]>0
            if spec['views'][row].get('headPolygon'):
                head=Image.new('L',(128,128));ImageDraw.Draw(head).polygon([tuple(p) for p in spec['views'][row]['headPolygon']],fill=255)
                mask&=np.array(head)[:height]>0
            for extra in spec['views'][row].get('extras',[]):
                excluded=Image.new('L',(128,128));ImageDraw.Draw(excluded).polygon([tuple(p) for p in extra['polygon']],fill=255)
                mask&=np.array(excluded)[:height]==0
            for col in meta['clips']['walk']['frames']+meta['clips']['carry']['frames']:
                physical_row=row+(col//64)*4;physical_col=col%64
                dy=round(meta['rigAudit'][row][col]['coreOffset'][1]);actual=atlas[physical_row*128:(physical_row+1)*128,physical_col*128:(physical_col+1)*128]
                ys,xs=np.where(mask);valid=ys+dy>=0
                assert np.array_equal(actual[ys[valid]+dy,xs[valid]],source[ys[valid],xs[valid]]),(spec['id'],row,col,'head changed')
        for row in meta['rigAudit']:
            cycle=[v for v in row if v['action']=='walk']
            if spec['kind']!='spirit' and meta.get('locomotionMode')!='hover':
                assert all(any(f['contact'] and f['lift']==0 for f in v['feet']) for v in cycle),spec['id']
            if spec['kind']=='biped' and meta.get('locomotionMode')!='hover':
                for frame in cycle:
                    for foot in frame['feet']:
                        a,b,c=np.array(foot['joints3d'])
                        lengths=foot.get('lengths',[spec['gait']['thigh'],spec['gait']['shin']])
                        assert abs(np.linalg.norm(b-a)-lengths[0])<.00003
                        assert abs(np.linalg.norm(c-b)-lengths[1])<.00003
        if spec['kind']!='spirit' and not meta.get('locomotionRevision'):
            cycle=meta['rigAudit'][0][4:16];foot=cycle[0]['feet'][0]['ankle']
            for i in range(1,6):
                for axis,forward in enumerate([-.70710678,.40824829]):
                    world=cycle[i]['feet'][0]['ankle'][axis]+i/12*spec['strideLength']*128/spec['worldHeight']*forward
                    assert abs(world-foot[axis])<.002,(spec['id'],'foot slides')
    portrait=Image.open(target/'portrait-idle.png');duration=0;unique=set()
    for i in range(portrait.n_frames):
        portrait.seek(i);duration+=portrait.info['duration'];unique.add(portrait.convert('RGBA').tobytes())
    assert duration==4000 and len(unique)>8,(spec['id'],'portrait breathing')
    report.append({'id':spec['id'],'cells':cells,'portraitFrames':portrait.n_frames,'durationMs':duration,'locomotion':spec['kind']})
dest=Path('docs/verification/roster-professions');dest.mkdir(parents=True,exist_ok=True)
(dest/'art-check.json').write_text(json.dumps(report,indent=2)+'\n')
print(f'{len(report)} cast rigs: {sum(v["cells"] for v in report)} unclipped cells, rigid heads, planted gait, animated portraits PASS')
