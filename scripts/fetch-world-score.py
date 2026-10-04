"""Recover licensed scores from pinned manifests, then run pack-town-music.py."""
import hashlib
import io
import json
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'art-source/audio'


def main():
    archives = {}
    for folder in ['bright-town', 'world-score']:
        directory = BASE / folder
        tracks = json.loads((directory / 'manifest.json').read_text(encoding='utf-8'))['tracks']
        for track in tracks:
            path = directory / track['original']
            if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest() == track['sha256']:
                continue
            url = track['download']
            if track.get('archive_member'):
                if url not in archives:
                    cached = next((p for p in (BASE/'world-score').glob('*.zip') if hashlib.sha256(p.read_bytes()).hexdigest() == track['archive_sha256']), None)
                    data = cached.read_bytes() if cached else urllib.request.urlopen(url, timeout=90).read()
                    if hashlib.sha256(data).hexdigest() != track['archive_sha256']:
                        raise ValueError('Archive hash mismatch: ' + url)
                    archives[url] = data
                with zipfile.ZipFile(io.BytesIO(archives[url])) as archive:
                    data = archive.read(track['archive_member'])
            else:
                data = urllib.request.urlopen(url, timeout=90).read()
            if hashlib.sha256(data).hexdigest() != track['sha256']:
                raise ValueError('Source hash mismatch: ' + track['id'])
            path.write_bytes(data)
            print('Recovered', track['id'], flush=True)


if __name__ == '__main__':
    main()
