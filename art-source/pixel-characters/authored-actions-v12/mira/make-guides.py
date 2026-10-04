"""Technical pose diagrams for authored 2D cels, never game character artwork."""
import json, math
from pathlib import Path
import numpy as np

OUT=Path(__file__).resolve().parent
OUT.mkdir(parents=True,exist_ok=True)
TAU=math.tau
def ease(t):
 t=max(0.,min(1.,t));return t*t*(3-2*t)
def bob(p):
 t=p*2%1
 keys=[(0,0),(.2,-1.2),(.6,1.3),(.83,1.8),(1,0)]
 for (a,x),(b,y) in zip(keys,keys[1:]):
  if t<=b:return x+(y-x)*ease((t-a)/(b-a))
 return 0
def project(p,back=False):
 x,y,z=p
 return np.array([64+((x if not back else -x)-z)*math.sqrt(.5),111-y*math.sqrt(2/3)+(x+(-z if back else z))*math.sqrt(1/6)])
def joints(p,carry=False):
 hipHeight=43+bob(p)-(1.3 if carry else 0)
 pelvisYaw=math.radians(6)*math.cos(p*TAU)
 chestYaw=-math.radians(8)*math.cos(p*TAU-.15)
 def transverse(side,width,height,yaw,z=0):return np.array([side*width*math.cos(yaw),height,z-side*width*math.sin(yaw)])
 hips=[transverse(s,5.8,hipHeight,pelvisYaw) for s in [-1,1]]
 shoulders=[transverse(s,10,hipHeight+23,chestYaw,1.5 if carry else 0) for s in [-1,1]]
 legs=[];arms=[];feet=[]
 for i,s in enumerate([-1,1]):
  phase=(p+i*.5)%1;stance=.60;step=128/1.05*.5
  if phase<stance:
   z=step*(stance/2-phase);lift=0
  else:
   t=(phase-stance)/(1-stance);v=-step*(1-stance)
   a=-step*stance/2;b=step*stance/2
   z=(2*t**3-3*t*t+1)*a+(t**3-2*t*t+t)*v+(-2*t**3+3*t*t)*b+(t**3-t*t)*v
   lift=7*math.sin(math.pi*t)**2
  sole=np.array([s*5.5,lift,z]);ankle=sole+[0,5,1]
  delta=ankle-hips[i];dist=np.linalg.norm(delta);unit=delta/dist
  first=22.;second=22.;along=(first*first-second*second+dist*dist)/(2*dist)
  if dist>=first+second:raise ValueError(f'unreachable {p} {i} {dist}')
  pole=np.array([0.,0.,1.]);bend=pole-unit*np.dot(pole,unit);bend/=np.linalg.norm(bend)
  knee=hips[i]+unit*along+bend*math.sqrt(max(0,first*first-along*along))
  legs.append([hips[i],knee,ankle]);feet.append(dict(sole=sole.tolist(),contact=phase<stance))
  swing=-math.radians(25)*math.cos((p+i*.5)*TAU-.1)
  flex=math.radians(13)+math.radians(12)*(1+math.cos((p+i*.5)*TAU))*.5
  elbow=shoulders[i]+[0,-16*math.cos(swing),16*math.sin(swing)]
  wrist=elbow+[0,-14*math.cos(swing+flex),14*math.sin(swing+flex)]
  if carry:
   elbow=shoulders[i]+[s*1,-16,4]
   wrist=np.array([s*11,hipHeight+8,15])
  arms.append([shoulders[i],elbow,wrist])
 return dict(hips=hips,shoulders=shoulders,legs=legs,arms=arms,feet=feet,head=np.array([0,hipHeight+46,1.5 if carry else 0]),pelvisYaw=pelvisYaw,chestYaw=chestYaw)
def svg_pose(p,back=False,carry=False):
 j=joints(p,carry);parts=[]
 def line(points,color,width):
  pts=' '.join(','.join(f'{v:.2f}' for v in project(a,back)) for a in points)
  parts.append(f'<polyline points="{pts}" stroke="{color}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>')
 def polygon(points,color):
  pts=' '.join(','.join(f'{v:.2f}' for v in project(a,back)) for a in points)
  parts.append(f'<polygon points="{pts}" fill="{color}" stroke="#36414a" stroke-width=".5"/>')
 colors=['#287bc1','#d54f4f'];far=0 if not back else 1;near=1-far
 line(j['arms'][far],colors[far],7)
 for i in [far,near]:
  line(j['legs'][i],colors[i],8)
  sole=np.array(j['feet'][i]['sole']);line([sole+[0,3,-3],sole+[0,3,7]],colors[i],9)
  if j['feet'][i]['contact']:
   pt=project(sole,back);parts.append(f'<circle cx="{pt[0]:.2f}" cy="{pt[1]:.2f}" r="1.5" fill="#142222"/>')
 polygon([j['shoulders'][0],j['shoulders'][1],j['hips'][1],j['hips'][0]],'#bcc4c8')
 if carry:
  y=j['hips'][0][1];polygon([[-12,y+7,10],[12,y+7,10],[12,y+24,10],[-12,y+24,10]],'#b28e58')
 line(j['arms'][near],colors[near],7)
 pt=project(j['head'],back);parts.append(f'<ellipse cx="{pt[0]:.2f}" cy="{pt[1]:.2f}" rx="16" ry="18" fill="#c5c9c8" stroke="#36414a" stroke-width=".7"/>')
 if not back:parts.append(f'<path d="M{pt[0]-11},{pt[1]+3} l-7,3 l7,2" fill="#858d8e"/>')
 return ''.join(parts),j

records=[]
for action in ['walk','carry']:
 for direction in ['SW','NW']:
  back=direction=='NW';carry=action=='carry'
  for group in range(4):
   elements=[]
   for cell in range(8):
    index=group*8+cell;pose,j=svg_pose(index/32,back,carry)
    elements.append(f'<g transform="translate({(cell%4)*128},{(cell//4)*128})">{pose}</g>')
    records.append(dict(action=action,direction=direction,frame=index,phase=index/32,feet=j['feet'],screenFeet=[project(f['sole'],back).tolist() for f in j['feet']]))
   svg='<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="768" viewBox="0 0 512 256"><rect width="512" height="256" fill="#fff"/>'+''.join(elements)+'</svg>'
   (OUT/f'{action}-{direction}-guide-{group+1}.svg').write_text(svg,encoding='utf-8')
 # Coarse complete loop shows both legs changing support.
 for direction in ['SW','NW']:
  elements=[]
  for i in range(8):
   pose,_=svg_pose(i/8,direction=='NW',action=='carry');elements.append(f'<g transform="translate({i%4*128},{i//4*128})">{pose}</g>')
  (OUT/f'{action}-{direction}-key-guide.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="768" viewBox="0 0 512 256"><rect width="512" height="256" fill="#fff"/>'+''.join(elements)+'</svg>',encoding='utf-8')
(OUT/'pose-plan.json').write_text(json.dumps(dict(status='technical-reference-not-character-art',frames=records),indent=2)+'\n',encoding='utf-8')
print('32 phases x walk/carry x SW/NW pose diagrams')
