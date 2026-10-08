"""Rotate the original tool around its painted handle, fixed in the palm."""
import json,math
from functools import lru_cache
from pathlib import Path
import numpy as np
from PIL import Image

SOURCE=Path('art-source/pixel-characters/motion-v13/tool-grips.json')


@lru_cache(maxsize=1)
def configuration():
    return json.loads(SOURCE.read_text(encoding='utf-8'))


def source_grip(spec,tool,weapon=False):
    config=configuration();name=spec.get('weaponFile' if weapon else 'toolFile')
    if not name:return np.array(config['miraWrenchNormalized'])*tool.size
    source=Path(spec.get('toolRoot','art-source/pixel-characters/roster-v4'))/name
    key=source.relative_to('art-source/pixel-characters').as_posix()
    return np.array(config['grips'][key],dtype=float)


def tool_layer(tool,hand,angle,spec,weapon=False):
    grip=source_grip(spec,tool,weapon)
    radians=math.radians(angle)
    inverse=np.array([[math.cos(radians),-math.sin(radians)],[math.sin(radians),math.cos(radians)]])
    origin=grip-inverse@hand
    layer=tool.transform((128,128),Image.Transform.AFFINE,
        (*inverse[0],origin[0],*inverse[1],origin[1]),Image.Resampling.NEAREST)
    return layer,{'sourceGrip':grip.tolist(),'hand':np.asarray(hand).tolist(),
                  'angle':angle,'inverse':inverse.tolist(),'origin':origin.tolist()}
