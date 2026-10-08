"""The visible handle pixel, not a rotated bounding-box fraction, stays in hand."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import numpy as np
from PIL import Image,ImageOps
from character_tool_motion import configuration,tool_layer
from mira_rig import clean,prop_image

sources=[]
for name,grip in configuration()['grips'].items():
    path=Path('art-source/pixel-characters')/name
    tool=clean(Image.open(path))
    assert tool.getpixel((int(grip[0]),int(grip[1])))[3]==255,(name,'grip lies in transparent space')
    sources.append((name,tool,{'toolRoot':'art-source/pixel-characters','toolFile':name}))
props=Image.open('art-source/pixel-characters/prototypes/mira-v3/portrait-props.png')
sources.append(('mira',prop_image(props,[978,704,1168,1225],(8,24)),{}))
count=0;worst=0.
for name,tool,spec in sources:
    for angle in [-110,-90,-70,-45,-20,0,15,35,55,75,90]:
        for hand in [np.array([64.,80.]),np.array([40.25,40.75])]:
            image,audit=tool_layer(tool,hand,angle,spec)
            for mirrored in [False,True]:
                actual=ImageOps.mirror(image) if mirrored else image
                point=np.array([128-hand[0],hand[1]]) if mirrored else hand
                ys,xs=np.where(np.asarray(actual)[:,:,3]>0)
                error=float(np.min(np.hypot(xs+.5-point[0],ys+.5-point[1])))
                worst=max(worst,error);count+=1
                assert error<=1.6,(name,angle,mirrored,'painted handle leaves palm',error)
print(f'{len(sources)} original tools, {count} rotations/mirrors: maximum painted handle gap {worst:.3f}px PASS')
