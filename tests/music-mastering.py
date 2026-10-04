"""Check every shipped score in both codecs. Requires ffmpeg on PATH."""
import concurrent.futures
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
entries = [e for e in json.loads((ROOT/'public/assets/audio/music-sources.json').read_text(encoding='utf-8')) if e.get('mastering') == 'lufs-20-tp-2-v1']
assert len(entries) == 102, '51 scores, each with OGG and MP3 fallback'


def measure(entry):
    result = subprocess.run(['ffmpeg','-hide_banner','-nostats','-i',str(ROOT/entry['path']),'-af','loudnorm=I=-20:TP=-2:LRA=20:print_format=json','-f','null','-'], capture_output=True, check=True, encoding='utf-8', errors='replace')
    stats = json.JSONDecoder().raw_decode(result.stderr[result.stderr.rfind('{'):])[0]
    loudness, peak = float(stats['input_i']), float(stats['input_tp'])
    assert -20.6 <= loudness <= -19.4, (entry['file'], 'loudness', loudness)
    assert peak <= -1.0, (entry['file'], 'true peak', peak)
    return loudness, peak


with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    measurements = list(pool.map(measure, entries))
levels, peaks = zip(*measurements)
print(f'PASS {len(entries)} encoded scores: {min(levels):.2f} to {max(levels):.2f} LUFS; highest true peak {max(peaks):.2f} dBTP')
