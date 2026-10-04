"""Check cargo handoff continuity and independent lowering/release/recovery."""
import argparse,json
from pathlib import Path
import numpy as np
from PIL import Image

parser=argparse.ArgumentParser()
parser.add_argument('--output',default='public/assets/pixel-characters')
parser.add_argument('--report',default='docs/verification/weight-transfer-20261003/handling.json')
args=parser.parse_args()
reports=[]
for path in sorted(Path(args.output).glob('*/frames.json')):
    meta=json.loads(path.read_text(encoding='utf-8'))
    assert meta['handlingRevision']=='weight-transfer-and-handling-1',meta['id']
    atlas=Image.open(path.parent/'sprites.png').convert('RGBA')
    def tile(row,frame):
        x=frame%64*128;y=(row+frame//64*4)*128
        return np.asarray(atlas.crop((x,y,x+128,y+128)))
    pickup=meta['clips']['pickup']['frames'];drop=meta['clips']['drop']['frames']
    assert len(pickup)==len(drop)==12
    assert not set(pickup)&set(drop),(meta['id'],'shared lift/drop addresses')
    assert (len(drop)-1)/meta['clips']['drop']['fps']<.55
    for row in range(4):
        assert np.array_equal(tile(row,pickup[-1]),tile(row,drop[0])),(meta['id'],row,'held box jumps at lowering start')
        assert np.array_equal(tile(row,drop[-1]),tile(row,meta['clips']['idle']['frames'][0])),(meta['id'],row,'recovery jumps to idle')
        assert any(not np.array_equal(tile(row,a),tile(row,b)) for a,b in zip(pickup,drop[::-1])),(meta['id'],'just reverse playback')
        for action,frames in [('pickup',pickup),('drop',drop)]:
            audits=[meta['rigAudit'][row][f] for f in frames]
            assert all(meta['anchors'][row][f]==meta['anchors'][row][0] for f in frames)
            assert len({tile(row,f).tobytes() for f in frames})>=8,(meta['id'],row,action,'too few distinct poses')
            for index,audit in enumerate(audits):
                state=audit['handling']
                if action=='pickup' and state['lift']>0:
                    assert state['reach']==1,(meta['id'],'box lifts before grip')
                if action=='drop' and state['reach']<1:
                    assert state['lift']==0,(meta['id'],'hands release before box stops lowering')
                if meta.get('handlingMode',meta.get('locomotionMode'))!='hover':
                    for foot,first in zip(audit['feet'],audits[0]['feet']):
                        assert foot['contact'] and np.allclose(foot['sole'],first['sole']),(meta['id'],row,action,index,'planted foot moves')
    reports.append({'id':meta['id'],'pickupFrames':12,'dropFrames':12,'directions':4,'continuousHandoffs':True})
assert len(reports)==51,len(reports)
out=Path(args.report);out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(reports,indent=2)+'\n',encoding='utf-8')
print('51 characters × 4 views: grip before lift, lower before release, planted feet, held-box and idle handoffs PASS')
