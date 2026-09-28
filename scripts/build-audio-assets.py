"""Rebuild the background loops and extra effect samples in public/assets/audio/.

Sources are the CC0 downloads recorded in public/assets/audio/music-sources.json.
Download them into one folder (zip packs extracted next to the zips), then run:

    python scripts/build-audio-assets.py <download-dir>

Needs ffmpeg (libvorbis + libmp3lame) on PATH and numpy.
Every output is written as an OGG + MP3 pair; the game tries OGG first.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

RATE = 44100
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'assets' / 'audio'


def load(path, start=None, duration=None, filters=None):
    cmd = ['ffmpeg', '-v', 'error']
    if start is not None:
        cmd += ['-ss', str(start)]
    if duration is not None:
        cmd += ['-t', str(duration)]
    cmd += ['-i', str(path)]
    if filters:
        cmd += ['-af', filters]
    cmd += ['-f', 'f32le', '-ac', '2', '-ar', str(RATE), '-']
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)


def normalise(x, target_db, peak_db=-1.0):
    x = x * 10 ** ((target_db - rms_db(x)) / 20)
    peak = np.max(np.abs(x))
    limit = 10 ** (peak_db / 20)
    return x * (limit / peak) if peak > limit else x


def seamless(x, fade_seconds):
    """Fold the tail into the head so sample N-1 flows into sample 0."""
    f = int(fade_seconds * RATE)
    body, tail = x[:-f].copy(), x[-f:]
    ramp = np.linspace(0, 1, f, dtype=np.float32)[:, None]
    body[:f] = body[:f] * ramp + tail * (1 - ramp)
    return body


def fade(x, fade_in=0.01, fade_out=0.08):
    x = x.copy()
    a, b = int(fade_in * RATE), int(fade_out * RATE)
    if a:
        x[:a] *= np.linspace(0, 1, a, dtype=np.float32)[:, None]
    if b:
        x[-b:] *= np.linspace(1, 0, b, dtype=np.float32)[:, None]
    return x


def write(name, x, kbps):
    pcm = np.clip(x, -1, 1).astype(np.float32).tobytes()
    base = ['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ac', '2', '-ar', str(RATE), '-i', '-']
    quality = {64: '0', 80: '1', 96: '2', 112: '3'}[kbps]
    subprocess.run(base + ['-c:a', 'libvorbis', '-q:a', quality, str(OUT / f'{name}.ogg')], input=pcm, check=True)
    subprocess.run(base + ['-c:a', 'libmp3lame', '-b:a', f'{kbps}k', str(OUT / f'{name}.mp3')], input=pcm, check=True)
    return {'name': name, 'seconds': round(len(x) / RATE, 3), 'rms_db': round(float(rms_db(x)), 1)}


def main(src):
    src = Path(src)
    built = []
    # Music: whole tracks, levelled so the playlist does not jump in loudness.
    built.append(write('music-town', normalise(load(src / 'Town_3.mp3'), -20), 80))
    built.append(write('music-harp', normalise(load(src / '025_A_New_Town.mp3'), -20), 80))
    # River bank: calm 55 s stretch of the Vistula recording, folded into a seamless loop.
    river = load(src / 'VistulaShort_0.mp3', 60, 55)
    built.append(write('amb-river', normalise(seamless(river, 3), -24), 80))
    # Coast: the four recorded beach waves scattered over a soft low-passed water wash.
    rng = np.random.default_rng(7)
    waves = [load(src / f'wave_0{i}.flac') for i in range(1, 5)]
    length = int(47 * RATE)
    coast = normalise(load(src / 'VistulaShort_0.mp3', 150, 47, 'lowpass=f=700'), -34)[:length].copy()
    t = 0.2
    while t < 44:
        wave = waves[int(rng.integers(0, 4))] * float(rng.uniform(.7, 1))
        i = int(t * RATE)
        n = min(len(wave), length - i)
        coast[i:i + n] += wave[:n]
        t += float(rng.uniform(3.0, 4.6))
    built.append(write('amb-coast', normalise(seamless(coast, 3), -24), 80))
    # Highland wind and evening crickets are published as loops already.
    built.append(write('amb-wind', normalise(load(src / 'wind_woosh_loop.ogg'), -24), 80))
    built.append(write('amb-crickets', normalise(load(src / 'crickets_1.mp3'), -24), 80))
    # One-shot effect samples: trimmed with short fades and levelled (RMS -20 dB, peak -1.5 dB).
    k = src / 'kenney_impact-sounds'
    kenney = next(k.rglob('impactMining_000.ogg')).parent
    loops = src / 'sfx_loops'
    loops = next(loops.rglob('saw.ogg')).parent
    extra = next((src / 'sfx_100_v2').rglob('sfx100v2_switch_01.ogg')).parent
    shots = {
        'impactMining_000': (kenney / 'impactMining_000.ogg', None),
        'impactMining_003': (kenney / 'impactMining_003.ogg', None),
        'impactWood_medium_001': (kenney / 'impactWood_medium_001.ogg', None),
        'impactPlank_medium_002': (kenney / 'impactPlank_medium_002.ogg', None),
        'impactMetal_medium_001': (kenney / 'impactMetal_medium_001.ogg', None),
        'impactMetal_heavy_002': (kenney / 'impactMetal_heavy_002.ogg', None),
        'impactPlate_light_001': (kenney / 'impactPlate_light_001.ogg', None),
        'impactGlass_light_001': (kenney / 'impactGlass_light_001.ogg', None),
        'impactBell_heavy_001': (kenney / 'impactBell_heavy_001.ogg', None),
        'impactSoft_medium_002': (kenney / 'impactSoft_medium_002.ogg', None),
        'impactTin_medium_000': (kenney / 'impactTin_medium_000.ogg', None),
        'footstep_grass_002': (kenney / 'footstep_grass_002.ogg', None),
        'footstep_wood_001': (kenney / 'footstep_wood_001.ogg', None),
        'saw-stroke': (loops / 'saw.ogg', 1.4),
        'machine-chug': (loops / 'machine_01.ogg', None),
        'machine-press': (loops / 'machine_05.ogg', None),
        'machine-whirr': (loops / 'machine_03.ogg', None),
        'pump-stroke': (loops / 'pump_01.ogg', 1.6),
        'water-pour': (loops / 'water_flowing.ogg', None),
        'boil-bubble': (loops / 'water_boiling.ogg', 1.8),
        'cart-roll': (loops / 'rolling.ogg', None),
        'switch-click': (extra / 'sfx100v2_switch_01.ogg', None),
    }
    for name, (path, seconds) in shots.items():
        x = load(path, 0, seconds)
        built.append(write(name, normalise(fade(x, 0.004, 0.12 if seconds else 0.02), -20, -1.5), 96))
    print(json.dumps(built, indent=1))


if __name__ == '__main__':
    main(sys.argv[1])
