"""Hand paths and prop orientation for visually distinct occupational actions."""
import math
import numpy as np
from character_body_motion import ease


def work_stroke(phase):
    # Neutral -> anticipation -> effort -> settle -> neutral. A hammer or hoe
    # accelerates into contact; its recovery is not an equally fast reverse.
    keys=[(0.,.5),(.28,0.),(.44,1.),(.57,1.),(1.,.5)]
    for (start,a),(end,b) in zip(keys,keys[1:]):
        if phase<=end:return a+(b-a)*ease((phase-start)/(end-start))
    return .5


def body_offset(style,phase,forward):
    if style not in ['miner','smith','lumber','farmer','labor','baker','sailor']:return np.zeros(2)
    effort=ease((phase-.28)/.16)*(1-ease((phase-.57)/.43))
    return forward*(1.8*effort)+[0,1.5*effort]

def hand_pose(style,index,root,shoulders,forward,phase,default):
    t=phase*math.tau;wave=work_stroke(phase);center=np.mean(shoulders,axis=0)
    if style in ['textile','merchant','administrator','medic','aviator','glass']:
        if style=='glass':return center+forward*(13+index*3)+[0,-5+math.sin(t)*.5]
        return center+[-5 if index==0 else 6,17]+forward*(math.sin(t)*2 if index else 0)
    if index==0:
        if style in ['sailor','fisher','baker','rancher']:return center+forward*7+[0,15]
        return default
    if style in ['miner','smith','lumber','farmer']:
        strength={'miner':1,'smith':.72,'lumber':1.2,'farmer':.7}[style]
        return root+forward*(6+15*wave*strength)+[0,-13*strength+29*wave*strength]
    if style in ['mage','magic']:return root+forward*9+[0,-9+math.sin(t)*3]
    if style=='engineer':return root+forward*9+[math.sin(t)*3,12+math.cos(t)*2]
    if style=='baker':return center+forward*(13+9*wave)+[0,13]
    if style=='fisher':return root+forward*(8+18*wave)+[0,-7+15*wave]
    if style=='rancher':return root+forward*9+[math.sin(t)*5,6+math.cos(t)*3]
    if style=='sailor':return root+forward*(12-6*wave)+[0,1+16*wave]
    if style=='rail':return root+forward*9+[0,-13+4*math.sin(t)]
    if style=='guard':return root+forward*8+[0,12+math.sin(t)]
    return root+forward*(7+8*wave)+[0,-11+24*wave]

def tool_angle(style,phase):
    wave=work_stroke(phase)
    if style in ['textile','merchant','administrator','medic','aviator']:return -5+10*wave
    if style=='glass':return 75
    if style in ['mage','magic']:return -5+10*wave
    if style=='baker':return 55
    if style=='engineer':return -30+60*wave
    if style=='rail':return -15+30*wave
    if style=='rancher':return -20+40*wave
    if style=='sailor':return 15
    if style=='guard':return -10
    return -20+70*wave
