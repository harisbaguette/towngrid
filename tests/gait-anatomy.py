"""Catch the visible one-leg collapse that contact-only checks missed."""
import argparse,json
from pathlib import Path
import numpy as np

parser=argparse.ArgumentParser()
parser.add_argument('--output',default='public/assets/pixel-characters')
parser.add_argument('--before',default='work/pre-balanced-step')
parser.add_argument('--report',default='docs/verification/balanced-step-20261003/anatomy.json')
args=parser.parse_args()

def measure(meta):
 minimum=1.;worst=None;ratios=[]
 for row in range(4):
  for action in ['walk','carry']:
   for col in meta['clips'][action]['frames']:
    for leg,foot in enumerate(meta['rigAudit'][row][col]['feet']):
     a,b,c=[np.array(foot[key]) for key in ['hip','knee','ankle']]
     for segment,(start,end,length) in enumerate(zip([a,b],[b,c],foot['lengths'])):
      ratio=float(np.linalg.norm(end-start)/length);ratios.append(ratio)
      if ratio<minimum:minimum=ratio;worst={'view':row,'action':action,'frame':col,'leg':leg,'segment':segment}
 return {'minimumProjectedLengthRatio':minimum,'tenthPercentile':float(np.percentile(ratios,10)),'worst':worst}

results=[]
for path in sorted(Path(args.output).glob('*/frames.json')):
 meta=json.loads(path.read_text(encoding='utf-8'))
 if meta.get('locomotionMode')!='biped':continue
 current=measure(meta)
 previous=Path(args.before)/meta['id']/'frames.json'
 before=measure(json.loads(previous.read_text(encoding='utf-8'))) if previous.exists() else None
 results.append({'id':meta['id'],'before':before,'after':current})
 # Orthographic foreshortening is expected, collapsing a thigh or calf into
 # a few pixels while its counterpart stays full length is not.
 assert current['minimumProjectedLengthRatio']>.40,(meta['id'],current)
 for row in range(4):
  cycle=[meta['rigAudit'][row][frame]['feet'] for frame in meta['clips']['walk']['frames']]
  assert all(cycle[i][0]['contact']==cycle[(i+16)%32][1]['contact'] for i in range(32)),(meta['id'],'unequal contact timing')
  assert all(abs(cycle[i][0]['lift']-cycle[(i+16)%32][1]['lift'])<1e-6 for i in range(32)),(meta['id'],'unequal swing height')
assert len(results)==44,len(results)
out=Path(args.report);out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(results,indent=2)+'\n',encoding='utf-8')
print(f"44 biped characters: no projected leg segment below 40%, equal left/right contact timing and swing height PASS")
