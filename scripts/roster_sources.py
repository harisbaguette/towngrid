"""Extract imagegen-authored portraits and two rest views; retain source pixels.

This preprocessing is deterministic packing, not drawing replacement artwork.
The source sheets and reviewed rig landmarks remain versioned alongside it.
"""
import argparse
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageOps, ImageDraw
from scipy.ndimage import label, find_objects
from mira_rig import clean

ROOT = Path('art-source/pixel-characters/roster-v4')


def extract(identity, flip=False, height=100):
    path = ROOT/f'{identity}.png'
    image = clean(Image.open(path))
    pixels = np.array(image)
    labels, _ = label(pixels[:, :, 3] > 0, structure=np.ones((3,3)))
    objects = []
    for number, slices in enumerate(find_objects(labels), 1):
        if not slices: continue
        ys, xs = slices
        area = int((labels[slices] == number).sum())
        if area > 10000:
            objects.append((area, [xs.start,ys.start,xs.stop,ys.stop],number))
    main = sorted(sorted(objects, reverse=True)[:3], key=lambda item:item[1][0])
    if len(main) != 3: raise ValueError(f'{identity}: expected three separate figures: {objects}')
    boxes = [item[1] for item in main]
    # Empty gaps between connected figures give each figure its own region,
    # retaining disconnected wing tips, hair pixels and clothing details.
    cuts = [0, (boxes[0][2]+boxes[1][0])//2, (boxes[1][2]+boxes[2][0])//2, image.width]
    dest = ROOT/identity
    dest.mkdir(exist_ok=True)
    def figure(index):
        chosen=main[index]
        a=pixels.copy();a[labels!=chosen[2]]=0
        piece=Image.fromarray(a)
        return piece.crop(piece.getbbox())
    portrait = figure(0)
    portrait = portrait.crop(portrait.getbbox())
    portrait.thumbnail((212,306),Image.Resampling.NEAREST)
    panel = Image.new('RGBA',(220,314))
    panel.alpha_composite(portrait,((220-portrait.width)//2,314-portrait.height))
    panel.save(dest/'portrait.png')
    transforms=[]
    for index, name in enumerate(['SW','NW'],1):
        piece=figure(index)
        bbox=boxes[index]
        scale=min(height/piece.height,104/piece.width)
        piece=piece.resize((round(piece.width*scale),round(piece.height*scale)),Image.Resampling.NEAREST)
        if index==2 and flip: piece=ImageOps.mirror(piece)
        panel=Image.new('RGBA',(128,128))
        offset=((128-piece.width)//2,115-piece.height)
        panel.alpha_composite(piece,offset)
        panel.save(dest/f'{name}.png')
        transforms.append({'region':[cuts[index],0,cuts[index+1],image.height], 'bbox':bbox,'scale':scale,'offset':offset,'mirror':index==2 and flip})
    (dest/'extraction.json').write_text(json.dumps({'source':path.as_posix(),'portraitRegion':[0,0,cuts[1],image.height],'views':transforms},indent=2)+'\n')


def contact(ids):
    rows=(len(ids)+3)//4
    panel=Image.new('RGB',(1536,rows*310),'#dce9e6')
    draw=ImageDraw.Draw(panel)
    for index,identity in enumerate(ids):
        x=index%4*384;y=index//4*310
        draw.text((x+5,y+2),identity,fill='black')
        for i,name in enumerate(['SW','NW']):
            tile=Image.open(ROOT/identity/f'{name}.png').resize((192,192),Image.Resampling.NEAREST)
            panel.paste(tile,(x+i*192,y+30),tile)
        # Full-size technical grid makes source landmark review reproducible.
        for i,name in enumerate(['SW','NW']):
            tile=Image.open(ROOT/identity/f'{name}.png')
            grid=Image.new('RGBA',(128,128),'#dce9e6');grid.alpha_composite(tile)
            gd=ImageDraw.Draw(grid)
            for p in range(16,128,16):
                gd.line((p,0,p,127),fill=(40,90,100,70));gd.line((0,p,127,p),fill=(40,90,100,70))
            grid.resize((512,512),Image.Resampling.NEAREST).save(ROOT/identity/f'{name}-grid.png')
    panel.save('work/roster-art/base-views.png')


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('ids',nargs='+');parser.add_argument('--flip',action='store_true')
    args=parser.parse_args()
    for identity in args.ids: extract(identity,args.flip)
    contact(args.ids)
