"""Lossless atlas packing for the Blender-rendered quarter-view review.

Pixel colors and geometry are not repainted, warped, or interpolated here.
"""
import hashlib
import json
import math
from pathlib import Path
import sys

from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from mira_volume_motion import sample

SOURCE=ROOT/'art-source/pixel-characters/volume-motion-v10/mira'
RENDER=ROOT/'work/mira-volume-render'
OUTPUT=ROOT/'public/character-preview/authored-motion/mira-volume'


def main():
    meta=json.loads((SOURCE/'motion.json').read_text(encoding='utf-8'))
    files=[]
    for action,clip in meta['clips'].items():
        clip['frames']={}
        for direction in meta['directions']:
            clip['frames'][direction]=[]
            for index,phase in enumerate(clip['phases']):
                path=RENDER/action/direction/f'{index:03}.png'
                image=Image.open(path).convert('RGBA')
                assert image.size==(128,128),path
                box=image.getbbox()
                assert box and min(box[:2])>1 and max(box[2:])<127,(path,box)
                # Keep the complete rendered cel byte-for-byte in the atlas.
                clip['frames'][direction].append(len(files))
                files.append((path,image))
        clip['variants']={}
        for n in ([16,24,32] if action in ['walk','carry'] else [24]):
            indices=[min(range(len(clip['phases'])),key=lambda j:abs(clip['phases'][j]-i/n))
                     for i in range(n)] if clip['loop'] else list(range(n))
            assert len(set(indices))==n,(action,n)
            clip['variants'][str(n)]={d:[clip['frames'][d][i] for i in indices] for d in meta['directions']}
        clip['audit']=[{
            'feet':{k:{'ankle':list(f['ankle']),'pitch':f['pitch'],'support':bool(f['support'])}
                    for k,f in sample(action,t)['feet'].items()},
            'hands':{k:list(b[1]) for k,b in sample(action,t)['bones'].items() if k.startswith('hand.')},
        } for t in clip['phases']]
    columns=24;rows=math.ceil(len(files)/columns)
    atlas=Image.new('RGBA',(128*columns,128*rows))
    for i,(_,image) in enumerate(files):atlas.paste(image,((i%columns)*128,(i//columns)*128))
    OUTPUT.mkdir(parents=True,exist_ok=True)
    atlas.save(OUTPUT/'sprites.png',optimize=True)
    meta.update(atlasColumns=columns,atlasRows=rows,frameCount=len(files),
        anchor=[64,64+.89*math.sqrt(2/3)/2.1*128],
        sourceHashes={p.relative_to(ROOT).as_posix():hashlib.sha256(p.read_bytes()).hexdigest()
                      for p in [SOURCE/'mira.blend',ROOT/'scripts/mira_volume_motion.py',ROOT/'scripts/build-mira-volume.py']})
    (OUTPUT/'frames.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8')
    # Contact sheet for inspection, preserving the atlas pixels.
    sheet=Image.new('RGBA',(128*8,128*4),'#e4eadd')
    for row,direction in enumerate(meta['directions']):
        frames=meta['clips']['walk']['variants']['32'][direction]
        for i,frame in enumerate(frames[::4]):
            sheet.alpha_composite(files[frame][1],(i*128,row*128))
            ImageDraw.Draw(sheet).text((i*128+3,row*128+2),f'{direction} {i*4}/32',fill='#253a31')
    sheet.save(OUTPUT/'poses.png')
    print(f'MIRA_VOLUME_PACK_OK: {len(files)} rendered cels, 4 views, {len(meta["clips"])} clips, 16/24/32 walk and carry')


if __name__=='__main__':main()
