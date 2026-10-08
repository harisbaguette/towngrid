"""Put Mira's drawn SW walk (and its SE mirror) into the game atlas.

`pack-mira-slow-walk.py` prepares the strip; this pass only copies its cels
into the existing walk cells and records where each boot stands, so ground
contact and footstep effects follow the drawings. NW/NE keep the joint rig.
`mira_rig.pack_mira_rig` calls it last, so rebuilding the rig keeps the walk.
"""
import json
from pathlib import Path

from PIL import Image

SOURCE = Path('art-source/pixel-characters/authored-actions-v13/mira')
TARGET = Path('public/assets/pixel-characters/mira')


def install(atlas, metadata, source=SOURCE):
    strip_path, spec_path = source/'game-walk-SW.png', source/'game-walk-SW.json'
    if not strip_path.exists() or not spec_path.exists():
        return atlas, metadata
    strip = Image.open(strip_path).convert('RGBA')
    spec = json.loads(spec_path.read_text(encoding='utf-8'))
    cell, sequence, feet = spec['cell'], spec['sequence'], spec['feet']
    drawings = len(feet)
    frames = metadata['clips']['walk']['frames']
    columns = metadata['atlasColumns']
    directions = metadata['directions']
    anchor = spec['anchor']
    for view in ['SW', 'SE']:
        row = directions.index(view)
        mirrored = view != 'SW'
        for j, frame in enumerate(frames):
            slot = j*len(sequence)//len(frames)
            column = sequence[slot]
            step = slot*2//len(sequence)
            tile = strip.crop((column*cell, 0, column*cell+cell, cell))
            if mirrored:
                tile = tile.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            x, y = frame % columns*cell, (row+frame//columns*len(directions))*cell
            atlas.paste(Image.new('RGBA', (cell, cell)), (x, y))
            atlas.paste(tile, (x, y))
            ax = cell-anchor[0] if mirrored else anchor[0]
            metadata['anchors'][row][frame] = [ax/cell, anchor[1]/cell]
            # Boot order alternates with the step, so the leg that swings in
            # one step is the one that lands at the start of the next.
            boots = sorted(feet[column], key=lambda foot: (foot['role'] == 'swing') != (step % 2 == 1))
            audit = []
            for foot in boots:
                sx, sy = foot['sole']
                sole = [round(cell-sx if mirrored else sx, 2), sy]
                audit.append({'contact': foot['role'] == 'support', 'lift': foot['lift'], 'sole': sole,
                              'supportPoint': sole, 'role': foot['role']})
            metadata['rigAudit'][row][frame] = {'action': 'walk', 'phase': j/len(frames), 'authored': spec['revision'],
                                                'drawing': column, 'coreOffset': [0, 0], 'feet': audit}
    metadata['clips']['walk']['strideLengths'] = {'SW': spec['strideLength'], 'SE': spec['strideLength']}
    metadata['authoredWalk'] = {'revision': spec['revision'], 'source': str(source).replace('\\', '/'),
                                'directions': ['SW', 'SE'], 'mirroredDirections': {'SE': 'SW'},
                                'drawings': drawings, 'strideLength': spec['strideLength']}
    return atlas, metadata


def install_into_game(target=TARGET):
    atlas = Image.open(target/'sprites.png').convert('RGBA')
    metadata = json.loads((target/'frames.json').read_text(encoding='utf-8'))
    atlas, metadata = install(atlas, metadata)
    atlas.save(target/'sprites.png', optimize=True)
    (target/'frames.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    output = target.parent
    catalog = [json.loads(path.read_text(encoding='utf-8')) for path in sorted(output.glob('*/frames.json'))]
    (output/'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':'))+'\n', encoding='utf-8')
    return metadata


if __name__ == '__main__':
    meta = install_into_game()
    print(f"Mira: drawn walk {meta['authoredWalk']['revision']} in SW/SE, stride {meta['authoredWalk']['strideLength']}")
