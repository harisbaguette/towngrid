"""All cast arm lengths, distinct cargo grips, opposing swing and mirrored joints."""
import argparse, hashlib, json
from pathlib import Path
import numpy as np

parser=argparse.ArgumentParser()
parser.add_argument('--output',default='public/assets/pixel-characters')
parser.add_argument('--report',default='docs/verification/character-arms-20261004/arms.json')
args=parser.parse_args()
results=[]
for path in sorted(Path(args.output).glob('*/frames.json')):
    meta=json.loads(path.read_text(encoding='utf-8'))
    identity=meta['id']
    assert meta['armMotionRevision']=='fixed-arm-lengths-1',identity
    assert hashlib.sha256(Path(meta['armMotionSource']).read_bytes()).hexdigest()==meta['armMotionSourceHash'],(identity,'stale arm pack')
    assert hashlib.sha256(Path(meta['toolAttachmentSource']).read_bytes()).hexdigest()==meta['toolAttachmentSourceHash']
    checked=grips=tools=0;max_length_error=max_grip_error=0.
    for row in range(4):
        clips={**meta['clips'],'hurtCarry':meta['variants']['hurt']['carry']}
        for action,clip in clips.items():
            # These are whole authored cels, not deformed arm pieces.
            if identity=='bron' and action in ['walk','carry','work','attack']:continue
            for frame in clip['frames']:
                audit=meta['rigAudit'][row][frame]
                if audit.get('authored'):continue  # drawn cels keep their painted arms
                arms=audit.get('arms',[])
                assert len(arms)==2,(identity,row,action,frame,'arm audit missing')
                for index,arm in enumerate(arms):
                    a,b,c=[np.array(arm[key]) for key in ['shoulder','elbow','wrist']]
                    error=max(abs(np.linalg.norm(b-a)-arm['lengths'][0]),abs(np.linalg.norm(c-b)-arm['lengths'][1]))
                    max_length_error=max(max_length_error,float(error));checked+=1
                    assert error<.001,(identity,row,action,frame,index,'arm shrinks/stretches',error)
                    mirror=meta['rigAudit'][3-row][frame]['arms'][index]
                    for key in ['shoulder','elbow','wrist','palm','grip']:
                        if key in arm:assert np.allclose([128-arm[key][0],arm[key][1]],mirror[key]),(identity,row,action,frame,key,'wrong mirror')
                held='cargoCenter' in audit and audit.get('handling',{}).get('reach',1)==1
                if held:
                    assert arms[0]['grip'][0]!=arms[1]['grip'][0],(identity,row,action,frame,'both hands use one corner')
                    for arm in arms:
                        error=float(np.linalg.norm(np.array(arm['palm'])-arm['grip']))
                        max_grip_error=max(max_grip_error,error);grips+=1
                        assert error<.051,(identity,row,action,frame,'hand loses box',error)
                if audit.get('tool'):
                    tool=audit['tool'];hand=np.array(tool['hand'])
                    assert np.allclose(hand,arms[1]['palm']),(identity,row,action,frame,'tool is on wrist, not palm')
                    mapped=np.array(tool['inverse'])@hand+tool['origin']
                    assert np.allclose(mapped,tool['sourceGrip']),(identity,row,action,frame,'tool slides during rotation')
                    tools+=1
        if identity!='bron' and not meta['rigAudit'][row][meta['clips']['walk']['frames'][0]].get('authored'):
            cycle=[meta['rigAudit'][row][f]['arms'] for f in meta['clips']['walk']['frames']]
            # At the opposite contact, each hand must exchange front/back
            # positions. A static forearm or two hands swinging together fails.
            swing=[]
            for index in [0,1]:
                coordinates=np.array([np.array(a[index]['wrist'])-a[index]['shoulder'] for a in cycle])
                swing.append(coordinates[:,0])
                assert np.ptp(coordinates[:,0])>(.5 if meta['locomotionMode']=='hover' else 4.),(identity,row,index,'arm barely moves')
            assert np.corrcoef(swing)[0,1]<-.95,(identity,row,'arms do not alternate')
    results.append({'id':identity,'armPoses':checked,'lockedGrips':grips,'toolPoses':tools,'maximumLengthError':max_length_error,'maximumGripError':max_grip_error})
assert len(results)==51,len(results)
report=Path(args.report);report.parent.mkdir(parents=True,exist_ok=True)
report.write_text(json.dumps(results,indent=2)+'\n',encoding='utf-8')
print(f"51 characters: {sum(r['armPoses'] for r in results)} arm poses, {sum(r['lockedGrips'] for r in results)} palm grips, {sum(r['toolPoses'] for r in results)} tool pivots PASS")
