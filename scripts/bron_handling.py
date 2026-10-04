"""Articulated handling using the same standing artwork as Bron's gait pack."""
import hashlib,json
from pathlib import Path
import numpy as np
from PIL import ImageOps


def apply_handling(atlas,meta,path,crate,tool):
    from roster_rig import prepare,render
    from cast_locomotion import bind_rigs
    from character_body_motion import install_handling
    path=Path(path);spec=json.loads(path.read_text(encoding='utf-8'))
    rigs=[prepare(path.parent,view,spec) for view in spec['views']]
    bind_rigs(rigs,spec['contactMotion'])
    for row in range(4):
        rig=rigs[0 if row in [0,3] else 1]
        origin=np.array(rig['contactView']['origin'])/128
        if row in [2,3]:origin[0]=1-origin[0]
        for index,col in enumerate(meta['clips']['idle']['frames']):
            tile,audit=render(rig,'idle',index/4,spec,crate,tool)
            if row in [2,3]:
                tile=ImageOps.mirror(tile)
                from character_arm_motion import mirror_arms
                mirror_arms(audit)
                for foot in audit['feet']:
                    for key in ['ankle','sole','hip','knee']:
                        if key in foot:foot[key][0]=128-foot[key][0]
            atlas.paste(tile,(col*128,row*128))
            meta['anchors'][row][col]=origin.tolist()
            meta['rigAudit'][row][col]={'action':'idle','phase':index/4,**audit}
    atlas,meta=install_handling(atlas,meta,rigs,spec,render,crate,tool)
    meta['handlingSource']=path.as_posix()
    meta['handlingMode']='biped'
    meta['handlingSourceHashes']={p.as_posix():hashlib.sha256(p.read_bytes()).hexdigest()
        for p in [path]+[path.parent/view['image'] for view in spec['views']]}
    return atlas,meta
