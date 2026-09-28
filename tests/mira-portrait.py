"""Verify encoded portrait animation, including visual identity invariants."""
import json
from pathlib import Path

import numpy as np
from PIL import Image

root=Path(__file__).resolve().parents[1]
folder=root/'public/assets/pixel-characters/mira'
meta=json.loads((folder/'frames.json').read_text(encoding='utf-8'))['portraitAnimation']
original=np.array(Image.open(folder/'portrait.png').convert('RGBA').resize((220,314),Image.Resampling.NEAREST))
animation=Image.open(folder/meta['file'])
assert animation.is_animated and animation.info['loop']==0
duration=0
faces=[]
hashes=set()
for index in range(animation.n_frames):
    animation.seek(index)
    pixels=np.array(animation.convert('RGBA'))
    duration+=animation.info['duration']
    hashes.add(pixels.tobytes())
    assert np.array_equal(pixels[250:],original[250:]),'waist/hand must not bob with the head'
    matches=[shift for shift in [0,1] if np.array_equal(pixels[80-shift:130-shift,40:116],original[80:130,40:116])]
    assert matches,'face shape must stay identical; only a one-pixel translation is allowed'
    faces.extend(matches)
assert set(faces)=={0,1} and len(hashes)>8
assert duration==4000==meta['durationMs']
result={'frames':animation.n_frames,'uniqueFrames':len(hashes),'durationMs':duration,'faceShapePreserved':True,'waistFixed':True}
output=root/'docs/verification/mira-runtime/portrait-check.json'
output.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result))
