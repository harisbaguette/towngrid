"""Original TownGrid sound design. Rebuild with Python/numpy and ffmpeg on PATH.

No downloaded recordings or model/API keys. Deterministic synthesis, OGG/MP3 pairs.
The seamless beds use periodic Fourier noise and whole-cycle modulation.
"""
import json
import subprocess
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/audio'
RATE = 44100
RNG = np.random.default_rng(930)
BUILT = []


def clock(seconds):
    return np.arange(round(seconds * RATE)) / RATE


def noise(seconds, low=100, high=3000):
    t = clock(seconds)
    f = np.fft.rfftfreq(len(t), 1 / RATE)
    spectrum = RNG.normal(size=len(f)) + 1j * RNG.normal(size=len(f))
    spectrum *= (1 - np.exp(-(f / low) ** 4)) * np.exp(-(f / high) ** 4)
    x = np.fft.irfft(spectrum, n=len(t))
    return x / max(np.sqrt(np.mean(x*x)), 1e-8)


def envelope(x, attack=.008, release=.06):
    x = x.copy()
    a, b = min(len(x), round(attack*RATE)), min(len(x), round(release*RATE))
    x[:a] *= np.linspace(0, 1, a)
    x[-b:] *= np.linspace(1, 0, b)
    return x


def bell(freq, seconds=.42):
    t = clock(seconds)
    x = sum(g*np.sin(2*np.pi*freq*r*t)*np.exp(-t*d) for r,g,d in [(1,1,9),(2.01,.18,16),(3.98,.05,24)])
    return envelope(x)


def notes(pitches, gap=.075, duration=.5):
    x = np.zeros(round(duration*RATE)+round(gap*(len(pitches)-1)*RATE))
    for i,f in enumerate(pitches):
        b=bell(f,duration);start=round(i*gap*RATE);x[start:start+len(b)] += b
    return x


def write(name, x, loop=False, db=-23):
    x = x - np.mean(x)
    x *= 10**(db/20) / max(np.sqrt(np.mean(x*x)), 1e-8)
    x *= min(1, .75/max(np.abs(x)))
    if not loop:
        x = envelope(x,.004,.045)
    pcm=x.astype('<f4').tobytes()
    command=['ffmpeg','-v','error','-y','-f','f32le','-ar',str(RATE),'-ac','1','-i','-']
    for ext, codec in [('ogg',['-c:a','libvorbis','-q:a','3']),('mp3',['-c:a','libmp3lame','-b:a','96k'])]:
        subprocess.run(command+codec+[str(OUT/f'{name}.{ext}')],input=pcm,check=True)
    BUILT.append({'name':name,'seconds':round(len(x)/RATE,3),'loop':loop,'rmsDb':round(float(20*np.log10(np.sqrt(np.mean(x*x)))),2),'peak':round(float(max(np.abs(x))),4)})


for name,pitches in {
    'ui-open':[392,587.33], 'ui-close':[440,293.66], 'ui-tab':[523.25,659.25],
    'ui-select':[659.25], 'ui-hover':[880], 'ui-pause':[329.63,261.63],
    'ui-resume':[261.63,392], 'ui-save':[392,523.25,659.25],
    'ui-load':[293.66,392,587.33], 'ui-notice':[523.25,783.99],
    'contract-complete':[392,493.88,587.33,783.99],
}.items():
    write(name,notes(pitches,duration=.22 if name in ['ui-hover','ui-select','ui-tab'] else .48),db=-28 if name=='ui-hover' else -23)
for name,up in [('ui-rotate',True),('ui-zoom',False)]:
    t=clock(.22)
    x=noise(.22,500,2100)*np.sin(np.pi*t/.22)**2*.12+np.sin(2*np.pi*(330*t+(120 if up else -70)*t*t))*np.exp(-t*20)*.3
    write(name,x,db=-27)
write('transport-depart', notes([196,261.63],.13,.8),db=-24)
write('transport-arrive', notes([392,523.25,659.25],.09,.48),db=-24)

# Stylised animal calls: voiced harmonics with breath and formant envelopes, quieter in-world.
for name,base,seconds,vibrato in [('sheep-bleat',310,1.05,8),('cow-low',105,1.65,3),('hen-cluck',590,.55,16),('duck-quack',260,.7,18)]:
    t=clock(seconds);p=t/seconds
    freq=base*(1+.10*np.sin(2*np.pi*vibrato*t)-.2*p)
    phase=2*np.pi*np.cumsum(freq)/RATE
    x=sum(np.sin(phase*k)/(k**1.35) for k in range(1,8))
    x=(x+.07*noise(seconds,500,2200))*np.sin(np.pi*p)**1.5
    if name in ['duck-quack','hen-cluck']:
        x*= (.25+.75*np.maximum(0,np.sin(2*np.pi*4*t)))
    write(name,x,db=-24)
t=clock(.9)
write('bee-buzz',sum(np.sin(2*np.pi*(190*k*t+.35*np.sin(2*np.pi*5*t)))/k**1.6 for k in range(1,6))*np.sin(np.pi*t/.9),db=-29)

# Exact periodic ambience: spectrum wraps without a cut and frequencies fit the 16 s loop.
t=clock(16)
write('amb-hearth',noise(16,70,2100)*(.34+.10*np.sin(2*np.pi*t/8))+.09*noise(16,1900,6000)*np.maximum(0,np.sin(2*np.pi*5*t))**26,True,-30)
write('amb-workshop',noise(16,80,900)*.12+sum(np.sin(2*np.pi*f*t)*g for f,g in [(55,.15),(110,.05),(165,.015)])*(.8+.2*np.sin(2*np.pi*t/4)),True,-32)
write('amb-room',noise(16,70,450)*.1,True,-35)
write('amb-arcane',sum(np.sin(2*np.pi*f*t)*(.6+.4*np.sin(2*np.pi*t/8+i)) for i,f in enumerate([196,294,392]))*.1+noise(16,300,1600)*.02,True,-33)

# Short, distinct cues for real actions; world work keeps its quieter recorded samples.
def hits(count, gap, low, high, seconds=.65):
    t=clock(seconds)
    pulse=sum(np.exp(-np.maximum(0,t-i*gap)*45)*(t>=i*gap) for i in range(count))
    return noise(seconds,low,high)*pulse

write('action-build',hits(3,.14,160,2600),db=-23)
write('action-repair',hits(2,.17,550,4200),db=-24)
write('action-demolish',hits(3,.18,45,900,.95),db=-23)
write('action-plant',hits(2,.14,1100,5500,.5),db=-26)
for name,pitches in {
    'action-upgrade':[330,440,660], 'action-expand':[262,392,523,784],
    'action-heal':[523,659,784], 'action-invalid':[185,147],
    'event-defend':[196,294,392], 'event-retreat':[294,220,147],
    'event-victory':[392,494,587,784], 'event-illness':[294,277],
    'event-strike':[220,220,196], 'event-sanction':[330,247,165],
    'map-world':[262,392,659], 'map-plot':[523,784], 'map-enter':[330,440,659,880],
}.items():
    write(name,notes(pitches,.10,.45),db=-24)
t=clock(1.5)
horn=sum(np.sin(2*np.pi*196*k*t)/k**1.7 for k in range(1,7))
write('event-raid',horn*np.sin(np.pi*t/1.5)**2*(.3+.7*(np.sin(2*np.pi*2*t)>0)),db=-24)
write('event-impact',hits(1,.1,100,3400,.28),db=-25)
write('event-defeat',hits(2,.1,65,650,.4),db=-25)
t=clock(2.4)
write('event-thunder',noise(2.4,35,600)*np.exp(-t*1.8)*(1+.3*np.sin(2*np.pi*3*t)),db=-25)
t=clock(1.2)
write('event-mana',(np.sin(2*np.pi*(130*t+180*t*t))+noise(1.2,900,3800)*.12)*np.sin(np.pi*t/1.2)**2,db=-26)
t=clock(.4)
write('ui-transition',noise(.4,700,3200)*np.sin(np.pi*t/.4)**2,db=-29)
t=clock(1.25)
write('vehicle-ship',(np.sin(2*np.pi*55*t)*.5+noise(1.25,60,420))*(.7+.3*np.cos(2*np.pi*5*t)),db=-28)
write('vehicle-train',noise(1.25,180,2400)*(.2+.8*np.maximum(0,np.cos(2*np.pi*7*t))**12),db=-28)
write('vehicle-air',noise(1.25,100,1300)*(.7+.3*np.sin(2*np.pi*23*t)),db=-29)
t=clock(16)
write('amb-rain',noise(16,450,6500)*(.8+.2*np.sin(2*np.pi*t/8)),True,-29)
manifest={'origin':'Original deterministic synthesis; no external recordings.','generator':'scripts/build-presentation-audio.py','sampleRate':RATE,'files':BUILT}
(OUT/'presentation-sounds.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Built {len(BUILT)} original sounds (OGG + MP3).')
