"""Pack paired imagegen sheets into reviewable, normalized character sources."""
import argparse,json
from pathlib import Path
from PIL import Image, ImageOps
import roster_sources

ROOT=Path('art-source/pixel-characters/professions-v5')
CAST=json.loads((ROOT/'cast.json').read_text(encoding='utf-8'))['characters']

def extract_pair(index):
    source=ROOT/f'pair-{index:02d}.png'
    image=Image.open(source).convert('RGBA')
    for row,entry in enumerate(CAST[index:index+2]):
        piece=image.crop((0,round(image.height*row/2),image.width,round(image.height*(row+1)/2)))
        piece.save(ROOT/(entry[0]+'.png'))
        roster_sources.ROOT=ROOT
        roster_sources.extract(entry[0])
        if entry[0] in ['oswin','dax','norin']:
            rear=ROOT/entry[0]/'NW.png'
            ImageOps.mirror(Image.open(rear)).save(rear)
            metadata=ROOT/entry[0]/'extraction.json'
            data=json.loads(metadata.read_text(encoding='utf-8'))
            data['views'][1].update(mirror=True,mirrorAfterNormalization=True)
            metadata.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('pairs',type=int,nargs='+');args=parser.parse_args()
    for index in args.pairs:extract_pair(index)
