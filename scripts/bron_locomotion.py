"""Pack authored gait poses, keeping soles registered to travelled distance."""
import json
import math
import hashlib
from pathlib import Path
import numpy as np
from PIL import Image, ImageOps
from scipy.ndimage import label
from mira_rig import clean

ROOT = Path('art-source/pixel-characters/bron-locomotion-v2')
CELL = 128


def prepare(view, spec, action):
    source = clean(Image.open(ROOT / view[action]))
    scale = spec['scale']
    anchor = np.array(spec['anchor'], float)
    poses = []
    for index, origin in enumerate(view['origins']):
        x, y = index % 4, index // 4
        box = (round(x*source.width/4), round(y*source.height/2),
               round((x+1)*source.width/4), round((y+1)*source.height/2))
        cut = source.crop(box)
        rgba = np.array(cut)
        labels, _ = label(rgba[:, :, 3] > 0, structure=np.ones((3, 3)))
        areas = np.bincount(labels.ravel()); areas[0] = 0
        rgba[labels != int(areas.argmax())] = 0
        cut = Image.fromarray(rgba)
        origin = np.array(origin, float)-box[:2]
        tile = cut.transform((CELL, CELL), Image.Transform.AFFINE,
            (1/scale, 0, origin[0]-anchor[0]/scale,
             0, 1/scale, origin[1]-anchor[1]/scale), Image.Resampling.NEAREST)
        sole = (np.array(view['support'][index])-box[:2]-origin)*scale+anchor
        # Landmarks name a boot, then its visible lower contour supplies the
        # exact sole edge. Walk and carry art can differ by a source pixel.
        alpha=np.asarray(tile)[:,:,3]>0
        lower=np.zeros_like(alpha);lower[:-1]=alpha[1:]
        ys,xs=np.where(alpha&~lower&(np.indices(alpha.shape)[0]>=90))
        distances=np.hypot(xs+.5-sole[0],ys+1-sole[1])
        nearest=int(distances.argmin())
        if distances[nearest]>10: raise ValueError(f'{action} {index}: sole landmark misses the boot')
        sole=np.array([xs[nearest]+.5,ys[nearest]+1.])
        poses.append((tile, sole))
    return poses


def standing(spec,view_index,carrying):
    rest=spec['rest'];view=rest['views'][view_index]
    box=view['carryBox' if carrying else 'box']
    origin=np.array(view['carryOrigin' if carrying else 'origin'])-box[:2]
    anchor=np.array(rest['anchor']);scale=rest['scale']
    source=clean(Image.open(ROOT/rest['source'])).crop(box)
    return source.transform((CELL,CELL),Image.Transform.AFFINE,
        (1/scale,0,origin[0]-anchor[0]/scale,0,1/scale,origin[1]-anchor[1]/scale),Image.Resampling.NEAREST)


def shift_legs(image, delta):
    """Bend calves between exposures, translating each sole rigidly.

    This inverse row mapping cannot fold or overlap a triangular mesh. The
    upper body is stationary and the lower 32 pixels follow the planted sole.
    """
    rgba = np.asarray(image)
    yy, xx = np.mgrid[:CELL, :CELL]
    sy = yy.astype(float)
    for _ in range(8):
        weight = np.clip((sy-76)/20, 0, 1)
        sy = yy-delta[1]*weight
    weight = np.clip((sy-76)/20, 0, 1)
    sx = np.rint(xx-delta[0]*weight).astype(int)
    sy = np.rint(sy).astype(int)
    valid = (sx>=0)&(sx<CELL)&(sy>=0)&(sy<CELL)
    out = np.zeros_like(rgba)
    out[valid] = rgba[sy[valid], sx[valid]]
    return Image.fromarray(out)


def align_body(image, delta):
    """Keep the head and torso rigid; let the waist absorb registration drift."""
    rgba = np.asarray(image)
    rows = np.arange(CELL, dtype=float)
    weights = np.clip((94-rows)/24,0,1)
    target_rows = rows+delta[1]*weights
    if np.any(np.diff(target_rows)<=0): raise ValueError('Body registration would fold the knees')
    yy,xx = np.mgrid[:CELL,:CELL]
    sy = np.interp(yy,target_rows,rows,left=-1,right=CELL)
    sx = np.rint(xx-delta[0]*np.clip((94-sy)/24,0,1)).astype(int)
    sy = np.rint(sy).astype(int)
    valid=(sx>=0)&(sx<CELL)&(sy>=0)&(sy<CELL)
    out=np.zeros_like(rgba);out[valid]=rgba[sy[valid],sx[valid]]
    return Image.fromarray(out)


def bake(output, proof=True):
    spec = json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'))
    count = spec['samples']; step = spec['strideLength']*CELL/spec['worldHeight']
    atlas = Image.new('RGBA', (CELL*count, CELL*8))
    anchors, audit, rests = [], [], []
    for row in range(8):
        direction = row % 4; mirrored = direction in [2, 3]
        view = spec['views'][0 if direction in [0, 3] else 1]
        action = 'walk' if row < 4 else 'carry'
        poses = prepare(view, spec, action)
        forward = np.array(view['forward'])
        lateral = np.array([np.copysign(2**-.5, forward[1]), 6**-.5])
        row_anchors, row_audit = [], []
        for index in range(count):
            phase = index/count; cel = int(phase*8)
            tile, sole = poses[cel]
            side = -1 if cel < 4 else 1
            contact = lateral*side*10+forward*(.25-(cel%4)/8)*step
            anchor = sole-contact
            body_delta = anchor-np.array(view['bodyAnchor'])+[0,-math.sin(phase*math.tau*2)*1.2]
            tile = align_body(tile,body_delta)
            delta = -forward*(phase-cel/8)*step
            tile = shift_legs(tile, delta)
            point = sole+delta
            if mirrored:
                tile = ImageOps.mirror(tile)
                anchor = np.array([CELL-anchor[0], anchor[1]])
                point[0] = CELL-point[0]
            atlas.paste(tile, (index*CELL, row*CELL))
            row_anchors.append((anchor/CELL).tolist())
            row_audit.append({'sourceCel':cel, 'support':side, 'sole':point.tolist(), 'phase':phase})
        rest = standing(spec,0 if direction in [0,3] else 1,row>=4)
        if mirrored: rest = ImageOps.mirror(rest)
        rests.append(rest)
        anchors.append(row_anchors); audit.append(row_audit)
    meta = {'revision':spec['revision'], 'columns':count, 'rows':8,
            'strideLength':spec['strideLength'], 'anchors':anchors, 'audit':audit,
            'source':(ROOT/'manifest.json').as_posix()}
    if proof:
        output = Path(output); output.mkdir(parents=True, exist_ok=True)
        atlas.save(output/'locomotion.png', optimize=True)
        # Register each key pose on the same ground origin for visual inspection.
        preview = Image.new('RGBA', (CELL*8, CELL*2), '#dce9e6')
        for row in range(2):
            for cel in range(8):
                index = cel*(count//8)
                tile = atlas.crop((index*CELL,row*CELL,(index+1)*CELL,(row+1)*CELL))
                offset = np.rint(np.array([64,112])-np.array(anchors[row][index])*CELL).astype(int)
                preview.alpha_composite(tile, (cel*CELL+int(offset[0]),row*CELL+int(offset[1])))
        preview.resize((2048,512), Image.Resampling.NEAREST).save(output/'poses.png')
        (output/'locomotion.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8')
    return meta, atlas, rests


def apply_locomotion(atlas, meta, target):
    motion, dense, rests = bake(target, proof=False)
    count = motion['columns']
    if count != 32: raise ValueError('Bron atlas has 32 distance samples per action')
    combined = Image.new('RGBA', (CELL*64,CELL*8)); combined.paste(atlas,(0,0))
    spec = json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'))
    for action, offset in [('walk',0),('carry',4)]:
        start = 64 if action=='walk' else 96
        meta['clips'][action] = {'frames':list(range(start,start+count)), 'fps':40,
                                'strideLength':motion['strideLength']}
        meta['columns'].extend(f'{action}-contact-{i+1}' for i in range(count))
        meta['frameScales'].extend([1.]*count)
        for direction in range(4):
            row = direction+offset
            legacy = [i for i,name in enumerate(meta['columns'][:64]) if name.startswith(action+'-')]
            for i,col in enumerate(legacy):
                sample = round(i/len(legacy)*count)%count
                tile = dense.crop((sample*CELL,row*CELL,(sample+1)*CELL,(row+1)*CELL))
                combined.paste(tile,(col*CELL,direction*CELL))
                meta['anchors'][direction][col] = motion['anchors'][row][sample]
                meta['rigAudit'][direction][col] = {'action':action,**motion['audit'][row][sample]}
            for i in range(count):
                tile = dense.crop((i*CELL,row*CELL,(i+1)*CELL,(row+1)*CELL))
                combined.paste(tile, ((start%64+i)*CELL,(direction+4)*CELL))
            meta['anchors'][direction].extend(motion['anchors'][row])
            meta['rigAudit'][direction].extend({'action':action, **entry} for entry in motion['audit'][row])
    for direction in range(4):
        rest_view = 0 if direction in [0,3] else 1
        anchor = np.array(spec['rest']['anchor'],float)/CELL
        if direction in [2,3]: anchor[0]=1-anchor[0]
        for action in ['idle','pickup','turn']:
            columns=[i for i,name in enumerate(meta['columns'][:64]) if name.startswith(action+'-')]
            for i,col in enumerate(columns):
                carrying = action=='pickup' and i>0
                tile=rests[direction+(4 if carrying else 0)]
                if action=='idle':delta=[0,math.sin(i/4*math.tau)*.65]
                elif action=='pickup':delta=[0,[0,7,9,6,3,0][i]]
                else:delta=[(-1 if i<2 else 1)*.6,-math.sin(i/3*math.pi)*1.2]
                tile=align_body(tile,delta)
                combined.paste(tile,(col*CELL,direction*CELL))
                meta['anchors'][direction][col]=anchor.tolist()
                meta['rigAudit'][direction][col]={'action':action,'authoredRest':rest_view,'feet':[]}
    meta.update(atlasColumns=64, atlasRows=8, frames=512, motionRevision=motion['revision'],
                authoredLocomotion=motion['source'], animationMethod='authored-gait-with-distance-contact-samples',
                groundContactActions=['idle','walk','carry','pickup','drop','turn','work','attack'])
    sources=['manifest.json',spec['rest']['source']]+[view[action] for view in spec['views'] for action in ['walk','carry']]
    meta['locomotionSourceHashes']={(ROOT/name).as_posix():hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in sources}
    meta['limitations']=['Opposite views mirrored',
        'Eight image-model gait poses per view with four contact samples per pose',
        'Work and attack reuse the hammer pose set with different ranges and timing']
    return combined, meta


if __name__=='__main__':
    import sys
    bake(sys.argv[1] if len(sys.argv)>1 else 'work/bron-authored-gait')
