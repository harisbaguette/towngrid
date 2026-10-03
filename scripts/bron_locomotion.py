"""Bake reviewed gait cels with sole-space contacts and connected mesh inbetweens."""
import json
import math
from pathlib import Path
import numpy as np
from PIL import Image, ImageOps
from scipy.spatial import Delaunay
from mira_rig import clean, foot_phase

ROOT = Path('art-source/pixel-characters/bron-locomotion-v2')
CELL = 128
UP = math.sqrt(2/3)


def warp(image, source, target):
    """One connected UV mapping for the full drawing, never severed leg parts."""
    data=np.asarray(image); out=np.zeros_like(data)
    for ids in Delaunay(source).simplices:
        src,dst=source[ids],target[ids]
        matrix=np.column_stack((dst[1]-dst[0],dst[2]-dst[0]))
        if abs(np.linalg.det(matrix))<.0001: continue
        left,top=np.maximum(0,np.floor(dst.min(axis=0)).astype(int))
        right,bottom=np.minimum(CELL,np.ceil(dst.max(axis=0)).astype(int))
        if left>=right or top>=bottom: continue
        yy,xx=np.mgrid[top:bottom,left:right]
        uv=np.stack((xx+.5,yy+.5),axis=-1)
        weights=(uv-dst[0])@np.linalg.inv(matrix).T
        inside=(weights.min(axis=-1)>=-1e-6)&(weights.sum(axis=-1)<=1+1e-6)
        mapped=src[0]+weights@np.array([src[1]-src[0],src[2]-src[0]])
        sx,sy=np.floor(mapped).astype(int).transpose(2,0,1)
        valid=inside&(sx>=0)&(sy>=0)&(sx<CELL)&(sy<CELL)
        out[yy[valid],xx[valid]]=data[sy[valid],sx[valid]]
    return Image.fromarray(out)


def prepare(view,spec):
    source=clean(Image.open(ROOT/view['source']))
    scale=spec['scale']; anchor=np.array(spec['anchor'],float)
    poses=[]
    for cel in view['cels']:
        origin=np.array(cel['origin'],float)
        tile=source.transform((CELL,CELL),Image.Transform.AFFINE,
            (1/scale,0,origin[0]-anchor[0]/scale,0,1/scale,origin[1]-anchor[1]/scale),Image.Resampling.NEAREST)
        point=lambda p:(np.array(p,float)-origin)*scale+anchor
        poses.append({'image':tile,'feet':[point(p) for p in cel['feet']],
            'knees':[point(p) for p in cel['knees']], 'hands':[point(p) for p in cel['hands']]})
    return poses


def render(poses,view,phase,spec,carrying=False,settle=0):
    index=round((phase%1)*4)%4; pose=poses[index]
    anchor=np.array(spec['anchor'],float)
    forward=np.array([-.70710678,view['forwardY']])
    lateral=np.array([math.copysign(.70710678,forward[1]),.40824829])
    bob=(.5+.65*math.cos(phase*math.tau*2))*(1-settle)
    core=np.array([.6*math.sin(phase*math.tau)*(1-settle),bob])
    source=[[0,0],[127,0],[0,127],[127,127],[22,16],[106,16],[22,62],[106,62],[38,76],[89,76]]
    target=[np.array(p)+core for p in source]
    feet=[]
    for side in range(2):
        travel,lift,contact=foot_phase(phase+side*.5,spec['gait'])
        reach=spec['strideLength']*CELL/spec['worldHeight']*spec['gait']['stance']/2
        travel*=1-settle;lift*=1-settle
        destination=anchor+lateral*((side*2-1)*spec['footHalfWidth'])+forward*travel*reach-[0,lift*UP]
        sole=pose['feet'][side];delta=destination-sole
        # Carry each complete boot rigidly; the connected calf above absorbs
        # the movement. Eight landmarks keep its volume and toe silhouette.
        for shift in [[-8,0],[8,0],[-8,-10],[8,-10],[0,-10],[0,0]]:
            point=sole+shift;source.append(point);target.append(point+delta)
        knee=pose['knees'][side]
        source.extend([knee+[-5,0],knee+[5,0]])
        target.extend([knee+[-5,0]+delta*.55+core*.45,knee+[5,0]+delta*.55+core*.45])
        feet.append({'contact':contact or settle==1,'sole':destination.tolist(),'lift':lift})
    for side,hand in enumerate(pose['hands']):
        swing=forward*math.cos(math.tau*(phase+side*.5))*2.2*(1-settle)
        destination=np.array([45 if side==0 else 82,77.])+core if carrying else hand+core+swing
        for shift in [[-5,-7],[5,-7],[-5,7],[5,7]]:
            source.append(hand+shift);target.append(destination+shift)
    tile=warp(pose['image'],np.array(source,float),np.array(target,float))
    return tile,feet,index


def bake(output):
    spec=json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'))
    poses=[prepare(view,spec) for view in spec['views']]
    atlas=Image.new('RGBA',(128*48,128*8)); audits=[]
    for row in range(8):
        view_index=0 if row%4 in [0,3] else 1
        notes=[]
        for column in range(48):
            tile,feet,source=render(poses[view_index],spec['views'][view_index],column/48,spec,row>=4)
            if row%4 in [2,3]:
                tile=ImageOps.mirror(tile)
                for f in feet:f['sole'][0]=128-f['sole'][0]
            atlas.paste(tile,(column*128,row*128))
            notes.append({'feet':feet,'sourceCel':source})
        audits.append(notes)
    output=Path(output);output.mkdir(parents=True,exist_ok=True)
    atlas.save(output/'locomotion.png',optimize=True)
    meta={**{k:spec[k] for k in ['anchor','strideLength','worldHeight']},'revision':'authored-sole-walk-2','file':'locomotion.png','columns':48,'rows':8,'fps':36,'audit':audits}
    (output/'locomotion.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    preview=Image.new('RGBA',(128*6,256),'#dce9e6')
    for r in range(2):
        for j,c in enumerate([0,8,16,24,32,40]):preview.alpha_composite(atlas.crop((c*128,r*128,(c+1)*128,(r+1)*128)),(j*128,r*128))
    preview.resize((1536,512),Image.Resampling.NEAREST).save(output/'poses.png')
    return meta


if __name__=='__main__':
    import sys
    bake(sys.argv[1] if len(sys.argv)>1 else 'work/bron-authored-gait')
