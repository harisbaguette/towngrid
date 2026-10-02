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
manifest={'origin':'Original deterministic synthesis; no external recordings.','generator':'scripts/build-presentation-audio.py','sampleRate':RATE,'files':BUILT}
(OUT/'presentation-sounds.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Built {len(BUILT)} original sounds (OGG + MP3).')
