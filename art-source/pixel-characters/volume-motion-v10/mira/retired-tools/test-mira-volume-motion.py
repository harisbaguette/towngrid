"""Motion invariants catch broken joints/contact before baking sprite frames."""
from pathlib import Path
import sys
import numpy as np

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from mira_volume_motion import sample, pose, foot, rx, HEEL, TOE, THIGH, SHIN, UPPER_ARM, FOREARM, STANCE, STRIDE


def close(a,b,tolerance=1e-7):
    assert np.linalg.norm(np.asarray(a)-np.asarray(b))<tolerance,(a,b)


max_slide=0.
for action in ['idle','walk','carry','start','stop','hold','carryStart','carryStop']:
    for i in range(241):
        p=i/240
        data=sample(action,p)
        for label in ['L','R']:
            for stem,length in [('thigh',THIGH),('shin',SHIN),('upper',UPPER_ARM),('fore',FOREARM)]:
                a,b=data['bones'][stem+'.'+label]
                close(np.linalg.norm(b-a),length)
            close(data['bones']['thigh.'+label][1],data['bones']['shin.'+label][0])
            close(data['bones']['upper.'+label][1],data['bones']['fore.'+label][0])
            close(data['bones']['fore.'+label][1],data['bones']['hand.'+label][0])
            footdata=data['feet'][label]
            sole=[footdata['ankle']+rx(footdata['pitch'])@point for point in [HEEL,TOE]]
            assert min(point[2] for point in sole)>-1e-6,(action,p,label,sole)
    if action in ['walk','carry','idle','hold']:
        for name,bone in sample(action,0.)['bones'].items():
            close(bone,sample(action,1.)['bones'][name])

# Each stance phase is world-space locked including heel/toe rolling.
for lower,upper,pivot in [(0.,.13,HEEL),(.13,.43,HEEL),(.43,STANCE,TOE)]:
    positions=[]
    for p in np.linspace(lower,upper,100):
        ankle,pitch=foot(float(p),-1)
        contact=ankle+rx(pitch)@pivot-np.array([0.,STRIDE*p,0.])
        positions.append(contact)
    error=float(np.max(np.linalg.norm(np.array(positions)-positions[0],axis=1)))
    max_slide=max(error,max_slide)
    assert error<1e-7,error

for action,label,pivot in [('start','R',TOE),('stop','L',HEEL),('carryStart','R',TOE),('carryStop','L',HEEL)]:
    contacts=[]
    for p in np.linspace(0,1,100):
        data=sample(action,p);f=data['feet'][label]
        contact=f['ankle']+rx(f['pitch'])@pivot-np.array([0.,data['rootDistance'],0.])
        contacts.append(contact)
    assert np.max(np.linalg.norm(np.array(contacts)-contacts[0],axis=1))<1e-7

# Start/stop must meet the exact idle and contact poses, not approximate ones.
for action,first,last in [('start','idle','walk'),('stop','walk','idle'),('carryStart','hold','carry'),('carryStop','carry','hold')]:
    for endpoint,target in [(0.,first),(1.,last)]:
        actual=sample(action,endpoint);expected=pose(0.,target)
        for label in ['L','R']:
            close(actual['feet'][label]['ankle'],expected['feet'][label]['ankle'])
            close(actual['feet'][label]['pitch'],expected['feet'][label]['pitch'])
        for stem in expected['bones']:
            close(actual['bones'][stem],expected['bones'][stem])

# Arms actually alternate, include elbow motion and remain clear of the body.
left=[pose(p)['arms']['L']['wrist'][1] for p in np.linspace(0,1,96,endpoint=False)]
right=[pose(p)['arms']['R']['wrist'][1] for p in np.linspace(0,1,96,endpoint=False)]
assert max(left)-min(left)>.25
assert np.corrcoef(left,right)[0,1]<-.95

print(f'MIRA_VOLUME_MOTION_OK: fixed limb lengths, cyclic poses, ground clearance, stance drift {max_slide:.3g}, planted transitions, alternating arms')
