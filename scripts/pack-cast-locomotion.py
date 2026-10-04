"""Rebuild the 50 contact rigs; Bron retains its authored pose pack."""
import argparse
import json
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from PIL import Image
from cast_locomotion import make_profile,calibrate_landmarks
from mira_rig import clean, prepare, pack_mira_rig
from roster_rig import prepare as prepare_roster, pack_roster_rig

def pack_one(task):
    path,calibrate,output=task
    spec=json.loads(path.read_text(encoding='utf-8'))
    if calibrate:
        if spec['id']=='mira':
            art=clean(Image.open(path.parent/spec['source']))
            rigs=[prepare(spec,art,view) for view in spec['views']]
        else:
            calibrate_landmarks(spec,path.parent)
            rigs=[prepare_roster(path.parent,view,spec) for view in spec['views']]
        spec['contactMotion']=make_profile(rigs,spec)
        path.write_text(json.dumps(spec,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    pack=pack_mira_rig if spec['id']=='mira' else pack_roster_rig
    meta=pack(path,output)
    return f"{spec['id']}: {meta['frames']} cells, {meta['locomotionMode']}"


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('ids',nargs='*')
    parser.add_argument('--calibrate',action='store_true',help='Refresh sole landmarks after editing the source rig/art')
    parser.add_argument('--output',default='public/assets/pixel-characters')
    parser.add_argument('--jobs',type=int,default=4)
    args=parser.parse_args()
    paths=sorted(list(Path('art-source/pixel-characters/roster-v4').glob('*/rig.json'))+list(Path('art-source/pixel-characters/professions-v5').glob('*/rig.json')))
    paths.append(Path('art-source/pixel-characters/prototypes/mira-v3/runtime-pack.json'))
    paths=[p for p in paths if (identity:=json.loads(p.read_text(encoding='utf-8'))['id'])!='bron' and (not args.ids or identity in args.ids)]
    with ProcessPoolExecutor(max_workers=max(1,args.jobs)) as pool:
        for result in pool.map(pack_one,[(p,args.calibrate,args.output) for p in paths]):print(result,flush=True)
    output=Path(args.output)
    catalog=[json.loads(path.read_text(encoding='utf-8')) for path in sorted(output.glob('*/frames.json'))]
    (output/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
