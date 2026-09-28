"""Bake a subtle pixel breathing loop from the existing portrait texture.

Integer inverse skinning preserves the original pixels. The face translates
rigidly; chest/shoulder displacement fades to zero at the stationary belt.
"""
import math

import numpy as np
from PIL import Image


def smooth(value):
    value = np.clip(value, 0, 1)
    return value*value*(3-2*value)


def bake_portrait(portrait, settings, target):
    width,height=settings['size']
    image=np.array(portrait.resize((width,height),Image.Resampling.NEAREST))
    y,x=np.mgrid[:height,:width]
    head=settings['headRise'];shoulder=settings['shoulderRise']
    head_bottom=settings.get('headBottom',142);shoulder_bottom=settings.get('shoulderBottom',170);waist=settings.get('waistTop',250)
    rise=np.where(y<head_bottom,head,np.where(y<shoulder_bottom,head+(shoulder-head)*smooth((y-head_bottom)/(shoulder_bottom-head_bottom)),shoulder*(1-smooth((y-shoulder_bottom)/(waist-shoulder_bottom)))))
    chest=smooth((y-settings.get('chestTop',145))/30)*(1-smooth((y-settings.get('chestBottom',210))/40))
    tail=smooth((x-128)/18)*(1-smooth((y-142)/18))*smooth((y-18)/65)
    frames=[]
    for i in range(settings['samples']):
        phase=i/settings['samples']*math.tau
        breath=(1-math.cos(phase))/2
        # No scaling or redrawing of facial features. Waist and hand stay still.
        dy=np.rint(rise*breath).astype(int)
        dx=np.rint(chest*breath*(x-110)/110+tail*math.sin(phase-.35)*settings['tailSway']).astype(int)
        sx,sy=x-dx,y+dy
        valid=(sx>=0)&(sx<width)&(sy>=0)&(sy<height)
        result=np.zeros_like(image)
        result[valid]=image[sy[valid],sx[valid]]
        frames.append(Image.fromarray(result))
    path=target/'portrait-idle.png'
    frames[0].save(path,save_all=True,append_images=frames[1:],duration=settings['frameMs'],loop=0,disposal=0,blend=0,optimize=True)
    with Image.open(path) as encoded:
        count=encoded.n_frames
        duration=0
        for frame in range(count):
            encoded.seek(frame)
            duration+=encoded.info['duration']
    return {'file':path.name,'format':'apng','width':width,'height':height,'frames':count,'durationMs':duration,
            'faceMotion':'rigid translation, max 1 logical pixel','waistMotion':'fixed'}
