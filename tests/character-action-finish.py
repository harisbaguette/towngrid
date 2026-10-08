"""Check continuous recovery poses and visible boot support, not art approval."""
import argparse,hashlib,json,math
from pathlib import Path
import numpy as np
from PIL import Image,ImageOps

parser=argparse.ArgumentParser()
parser.add_argument('--output',default='public/assets/pixel-characters')
parser.add_argument('--report',default='docs/verification/motion-v8-20261003/actions.json')
args=parser.parse_args();reports=[]
for path in sorted(Path(args.output).glob('*/frames.json')):
 meta=json.loads(path.read_text(encoding='utf-8'));atlas=Image.open(path.parent/'sprites.png').convert('RGBA')
 assert meta['actionRevision']=='continuous-action-poses-3',meta['id']
 assert hashlib.sha256(Path(meta['actionSource']).read_bytes()).hexdigest()==meta['actionSourceHash']
 def tile(row,frame):
  x=frame%64*128;y=(row+frame//64*4)*128
  return atlas.crop((x,y,x+128,y+128))
 max_support=0.;counts={}
 for row in range(4):
  idle=tile(row,meta['clips']['idle']['frames'][0]).tobytes()
  carried=meta['variants']['hurt']['carry']['frames']
  held=tile(row,meta['clips']['pickup']['frames'][-1]).tobytes()
  assert tile(row,carried[0]).tobytes()==held and tile(row,carried[-1]).tobytes()==held,(meta['id'],row,'cargo lost on hit')
  assert all(meta['rigAudit'][row][frame]['carried'] for frame in carried)
  assert len(meta['clips']['work']['frames'])==(8 if meta['id']=='bron' else 20)
  for action,count in [('idle',8),('greet',12),('hurt',8),('defeat',16),('turn',8),('attack',12)]:
   if meta['id']=='bron' and action=='attack':continue
   frames=meta['clips'][action]['frames'];assert len(frames)==count,(meta['id'],action)
   if action!='idle':assert tile(row,frames[0]).tobytes()==idle,(meta['id'],row,action,'entry jumps')
   if action in ['greet','hurt','turn','attack']:assert tile(row,frames[-1]).tobytes()==idle,(meta['id'],row,action,'recovery jumps')
   unique=len({tile(row,f).tobytes() for f in frames});counts[action]=unique
   if action in ['hurt','defeat','attack','greet']:assert unique>=count//2,(meta['id'],row,action,'duplicated exposures',unique)
   for frame in frames:
    target=tile(row,frame);bbox=target.getbbox()
    assert bbox and min(bbox[:2])>0 and max(bbox[2:])<128,(meta['id'],row,action,frame,'clipped')
    mirror=3-row
    assert ImageOps.mirror(target).tobytes()==tile(mirror,frame).tobytes(),(meta['id'],row,frame,'wrong mirror')
  if meta.get('locomotionMode')!='biped' or meta['id']=='bron':continue
  for action in ['walk','carry']:
   frames=meta['clips'][action]['frames']
   if any(meta['rigAudit'][row][f].get('authored') for f in frames):continue  # drawn walk: tests/mira-authored-walk.py
   feet=[meta['rigAudit'][row][f]['feet'] for f in frames]
   for index in [0,1]:
    states={p[index]['supportPart'] for p in feet}
    assert states=={'heel','flat','toe','swing'},(meta['id'],row,states)
   for frame,pose in zip(frames,feet):
    ys,xs=np.where(np.asarray(tile(row,frame))[:,:,3]>0)
    errors=[]
    for foot in pose:
     if not foot['contact']:continue
     support=np.array(foot['supportPoint'])
     assert np.allclose(support,np.array(foot['sole'])+foot['supportOffset']),(meta['id'],row,'mirrored support vector')
     errors.append(float(np.min(np.hypot(xs+.5-support[0],ys+1-support[1]))))
    error=min(errors);max_support=max(max_support,error)
    assert error<2.25,(meta['id'],row,frame,'support misses visible boot',error)
 reports.append({'id':meta['id'],'views':4,'uniquePosesLastView':counts,'maximumSupportPixelError':max_support})
assert len(reports)==51,len(reports)
out=Path(args.report);out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(reports,indent=2)+'\n',encoding='utf-8')
print('51 characters: entry/recovery continuity, 4 views, dedicated poses and visible heel/toe support PASS')
