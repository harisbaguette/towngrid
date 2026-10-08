"""개별 작화 검토용 패킹. 전신 균등 축척과 위치만 맞추며 게임에 설치하지 않는다."""
import hashlib
import importlib.util
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OLD = ROOT/'art-source/pixel-characters/authored-actions-v13/mira'
SOURCE = ROOT/'art-source/pixel-characters/authored-actions-v14/mira'
OUT = ROOT/'public/character-preview/slow-walk/individual'
spec = importlib.util.spec_from_file_location('previous_pack', ROOT/'scripts/pack-mira-slow-walk.py')
previous = importlib.util.module_from_spec(spec)
spec.loader.exec_module(previous)

# 파일 번호가 아니라 눈으로 확인한 자세 순서와 노출 시점이다.
POSES = [(0, 'old', 0), (1, 'old', 1), (2, 'old', 2), (3, 'old', 3),
         (4, 'old', 5), (5, 'old', 6), (6, 'new', 7), (7, 'old', 7),
         (8, 'old', 8), (10, 'old', 9), (11, 'old', 10), (12, 'old', 11),
         (14, 'new', 14), (16, 'old', 16), (18, 'new', 18), (20, 'new', 20),
         (22, 'new', 22), (24, 'new', 24), (26, 'new', 26), (28, 'new', 28),
         (30, 'new', 30)]


def main():
    master = previous.clean(np.array(Image.open(OLD/previous.source_name(0)).convert('RGBA')))
    atlas = Image.new('RGBA', (256*len(POSES), 512))
    records = []
    for column, (phase, origin, index) in enumerate(POSES):
        path = OLD/previous.source_name(index) if origin == 'old' else SOURCE/f'walk-SW-{index:02d}.png'
        cel = previous.clean(np.array(Image.open(path).convert('RGBA')))
        reg = previous.register(master, cel)
        scale, (hx, hy), (mx, _) = reg['scale'], reg['head'], reg['masterHead']
        # 얼굴 등록만 적용. 다리 늘이기·기울이기·관절 변형은 하지 않는다.
        matrix = np.float32([[1/scale, 0, 650-612+mx-hx/scale], [0, 1/scale, 100-hy/scale]])
        registered = cv2.warpAffine(cel, matrix, (1300, 1300), flags=cv2.INTER_NEAREST)
        small = Image.fromarray(previous.reduce(registered, .2))
        tile = Image.new('RGBA', (256, 256))
        tile.alpha_composite(small, (-2, 12))
        if tile.getbbox() is None:
            raise ValueError(path)
        atlas.paste(tile, (column*256, 0))
        atlas.paste(tile.transpose(Image.Transpose.FLIP_LEFT_RIGHT), (column*256, 256))
        records.append({'column': column, 'phase': phase, 'source': path.relative_to(ROOT).as_posix(),
                        'new': origin == 'new', 'supportLeg': 'near' if phase < 14 else 'far',
                        'register': reg, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                        'packedHash': hashlib.sha256(tile.tobytes()).hexdigest()})
    sequence = [max(i for i, frame in enumerate(records) if frame['phase'] <= phase) for phase in range(32)]
    meta = {'revision': 'mira-individual-cels-v14-review', 'status': 'review-only',
            'continuityVerdict': 'rejected', 'runtimeEligible': False,
            'cell': 256, 'atlasColumns': len(records), 'atlasRows': 2,
            'directions': ['SW', 'SE'], 'mirroredDirections': {'SE': 'SW'},
            'anchor': [128, 232], 'strideLength': .41, 'sequence': sequence,
            'usedDrawings': len(records), 'newDrawings': sum(f['new'] for f in records),
            'frames': records, 'remaining': ['디딘 발·손·골반의 연속 궤적', '좌우 걸음의 노출 시간', '마지막→처음 착지 연결', 'NW/NE와 다른 동작']}
    OUT.mkdir(parents=True, exist_ok=True)
    atlas.save(OUT/'sprites.png', optimize=True)
    text = json.dumps(meta, ensure_ascii=False, indent=2)+'\n'
    (OUT/'frames.json').write_text(text, encoding='utf-8')
    (SOURCE/'pack.json').write_text(text, encoding='utf-8')
    print(f"Individual cel review: {len(records)} drawings, {meta['newDrawings']} new; no game mutation")


if __name__ == '__main__':
    main()
