"""Inventory every runtime identity/action/view without treating files as art approval."""
import hashlib
import json
import subprocess
from collections import Counter
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'docs/verification/character-coverage-20261003'
ACTIONS = ['idle', 'walk', 'carry', 'work', 'pickup', 'drop', 'greet', 'attack', 'hurt', 'defeat', 'turn']
DIRECTIONS = ['SW', 'NW', 'NE', 'SE']


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def main():
    # Import the runtime roster rather than maintaining a second list of names.
    code = """
      import {pixelRoster,PIXEL_HEIGHT,PIXEL_ENEMIES} from './src/app/game/pixel-character-data.js';
      import {HOME_LOOKS} from './src/app/game/resident-roster.js';
      import {PROFESSIONS} from './src/app/game/facility-staff.js';
      const people=Object.keys(PIXEL_HEIGHT).flatMap(pixelRoster);
      console.log(JSON.stringify({people,homes:HOME_LOOKS,enemies:PIXEL_ENEMIES,professions:PROFESSIONS}));
    """
    runtime=json.loads(subprocess.check_output(['node', '--input-type=module', '-e', code],cwd=ROOT,text=True,encoding='utf-8'))
    people=runtime['people']; ids=[p['id'] for p in people]
    homes=set(runtime['homes'].values()); enemies={p['id'] for p in runtime['enemies'].values()}
    roles={pair[1]:job['name'] for job in runtime['professions'].values() for pair in [job['human'],job['elf']]}
    asset_root=ROOT/'public/assets/pixel-characters'
    catalog=read(asset_root/'catalog.json'); catalog_by_id={m['id']:m for m in catalog}
    findings=[]; characters=[]
    for identity in people:
        name=identity['id']; folder=asset_root/name
        record={**identity,'group':'home' if name in homes else 'enemy' if name in enemies else 'profession',
                'role':'일반 일꾼' if name in homes else '적대 세력' if name in enemies else roles.get(name,'직업 미등록'),
                'actions':{},'issues':[],'qualityComplete':False}
        for filename in ['frames.json','sprites.png','portrait.png','portrait-idle.png']:
            if not (folder/filename).is_file():record['issues'].append('Missing '+filename)
        if not (folder/'frames.json').is_file():
            characters.append(record);continue
        meta=read(folder/'frames.json')
        record.update(source=meta['source'],animationMethod=meta.get('animationMethod'),
                      revision=meta.get('locomotionRevision',meta.get('motionRevision',meta.get('revision'))),
                      mode=meta.get('locomotionMode',meta.get('locomotion')),
                      declaredMirrors=meta.get('mirroredDirections',{}),
                      directions=meta['directions'],sourceFiles=[],drafts=[])
        source=ROOT/meta['source']
        if not source.is_file():record['issues'].append('Missing source manifest')
        else:
            spec=read(source)
            paths=[source]
            if spec.get('source'):paths.append(source.parent/spec['source'])
            paths.append(source.parent/spec['portraitSource'] if spec.get('portraitSource') else source.parent/'portrait.png')
            if name!='mira':paths.append(ROOT/'art-source/pixel-characters/prototypes/mira-v3/portrait-props.png')
            for key in ['toolFile','weaponFile']:
                if spec.get(key):paths.append(ROOT/Path(spec.get('toolRoot','art-source/pixel-characters/roster-v4'))/spec[key])
            paths += [source.parent/v['image'] for v in spec.get('views',[]) if 'image' in v]
            for key in ['authoredLocomotion','authoredMotion','handlingMotion']:
                if spec.get(key):
                    manifest=ROOT/spec[key];paths.append(manifest)
                    if manifest.is_file():
                        authored=read(manifest)
                        if authored.get('source'):paths.append(manifest.parent/authored['source'])
                        if authored.get('rest'):paths.append(manifest.parent/authored['rest']['source'])
                        paths += [manifest.parent/v[action] for v in authored.get('views',[]) for action in ['walk','carry'] if action in v]
                        paths += [manifest.parent/v['image'] for v in authored.get('views',[]) if 'image' in v]
            for path in dict.fromkeys(paths):
                record['sourceFiles'].append(path.relative_to(ROOT).as_posix())
                if not path.is_file():record['issues'].append('Missing '+path.relative_to(ROOT).as_posix())
        source_hashes={**meta.get('locomotionSourceHashes',{}),**meta.get('handlingSourceHashes',{})}
        if meta.get('actionSource'):source_hashes[meta['actionSource']]=meta['actionSourceHash']
        for path,expected in source_hashes.items():
            file=ROOT/path
            if not file.is_file() or hashlib.sha256(file.read_bytes()).hexdigest()!=expected:
                record['issues'].append('Stale source hash: '+path)
        record['sourceHashEntries']=len(source_hashes)
        record['handlingRevision']=meta.get('handlingRevision')
        record['bodyMotionRevision']=meta.get('bodyMotionRevision')
        record['actionRevision']=meta.get('actionRevision')
        registered=catalog_by_id.get(name)
        record['catalogMatches']=registered==meta
        if not record['catalogMatches']:record['issues'].append('Catalog does not match frames.json')
        if meta['directions']!=DIRECTIONS:record['issues'].append('Missing or wrong facing order')
        draft=ROOT/'art-source/pixel-characters/authored-actions-v6'/name/'review.json'
        if draft.is_file():record['drafts']=read(draft)
        review=ROOT/'art-source/pixel-characters/authored-actions-v7'/name/'review.json'
        if review.is_file():record['candidateReview']=read(review)
        portrait=Image.open(folder/'portrait.png')
        breathing=Image.open(folder/'portrait-idle.png')
        record['portrait']={'size':list(portrait.size),'breathingFrames':getattr(breathing,'n_frames',1),
                            'file':meta.get('portraitAnimation',{}).get('file'),'review':'File presence and animation structure only; no new portrait art approval.'}
        if record['portrait']['breathingFrames']<=1:record['issues'].append('No animated portrait frames')
        atlas=Image.open(folder/'sprites.png').convert('RGBA')
        columns=meta.get('atlasColumns',len(meta['columns'])); rows=meta.get('atlasRows',4)
        record['atlas']={'size':list(atlas.size),'logicalFramesPerDirection':len(meta['columns'])}
        if atlas.size!=(columns*128,rows*128):record['issues'].append('Wrong atlas dimensions')
        def tile(view,frame):
            x=frame%columns*128;y=(view+frame//columns*4)*128
            return atlas.crop((x,y,x+128,y+128))
        hashes={};blank=[];clipped=[];invalid=[]
        for view in range(4):
            for frame in range(len(meta['columns'])):
                image=tile(view,frame);alpha=image.getchannel('A');bbox=alpha.getbbox()
                hashes[view,frame]=hashlib.sha256(image.tobytes()).hexdigest()
                if bbox is None:blank.append([view,frame])
                elif bbox[0]==0 or bbox[1]==0 or bbox[2]==128 or bbox[3]==128:clipped.append([view,frame])
                try:
                    x,y=meta['anchors'][view][frame]
                    if not 0<=x<=1 or not 0<y<=1:invalid.append([view,frame])
                except (IndexError,KeyError,TypeError):invalid.append([view,frame])
        record['blankCells']=blank;record['edgeTouchingCells']=clipped;record['invalidAnchors']=invalid
        for label,items in [('Blank atlas cells',blank),('Atlas edge touching cells',clipped),('Invalid anchors',invalid)]:
            if items:record['issues'].append(f'{label}: {len(items)}')
        mirror_errors=[]
        for left,right in [(0,3),(1,2)]:
            for frame in range(len(meta['columns'])):
                if ImageOps.mirror(tile(left,frame)).tobytes()!=tile(right,frame).tobytes():mirror_errors.append([left,right,frame])
        record['exactMirrors']={'SE':'SW','NE':'NW'} if not mirror_errors else {}
        record['nonIdenticalMirrorCells']=len(mirror_errors)
        for action in ACTIONS:
            clip=meta.get('clips',{}).get(action)
            if not clip or not clip.get('frames'):
                record['actions'][action]={'present':False,'qualityComplete':False}
                record['issues'].append('Missing action: '+action);continue
            frames=clip['frames']; valid=all(isinstance(f,int) and 0<=f<len(meta['columns']) for f in frames)
            if not valid:record['issues'].append('Invalid action indices: '+action)
            methods=Counter()
            for f in set(frames):
                audit=meta.get('rigAudit',[[]])[0][f]
                method='authored-key-pose-contact-adjusted' if 'sourceCel' in audit else 'authored-hammer-pose' if 'authoredCel' in audit else 'authored-rest-transformed' if 'authoredRest' in audit else 'original-texture-joint-rig'
                methods[method]+=1
            record['actions'][action]={
                'present':valid,'playbackFrames':len(frames),'uniqueFrameIndices':len(set(frames)),
                'fps':clip['fps'],'once':bool(clip.get('once')),'frames':frames,
                'methods':dict(methods),'views':{
                    facing:{'present':valid and all([view,f] not in blank for f in frames),
                            'uniquePixelFrames':len({hashes[view,f] for f in frames}),
                            'qualityComplete':False}
                    for view,facing in enumerate(DIRECTIONS)},
                'qualityComplete':False}
        record['extraActions']=sorted(set(meta['clips'])-set(ACTIONS))
        characters.append(record)
    for record in characters:
        findings += [record['id']+': '+issue for issue in record['issues']]
    assets={p.parent.name for p in asset_root.glob('*/frames.json')}
    source_ids=[]
    for pattern in ['roster-v4/*/rig.json','professions-v5/*/rig.json','prototypes/mira-v3/runtime-pack.json']:
        source_ids += [read(p)['id'] for p in (ROOT/'art-source/pixel-characters').glob(pattern)]
    coverage={
        'duplicateRuntimeIds':[name for name,n in Counter(ids).items() if n>1],
        'missingRuntimePacks':sorted(set(ids)-assets),'unregisteredRuntimePacks':sorted(assets-set(ids)),
        'missingSourceIds':sorted(set(ids)-set(source_ids)),'unregisteredSourceIds':sorted(set(source_ids)-set(ids)),
        'duplicateSourceIds':[name for name,n in Counter(source_ids).items() if n>1],
        'missingCatalogIds':sorted(set(ids)-set(catalog_by_id)),
        'unregisteredCatalogIds':sorted(set(catalog_by_id)-set(ids)),
        'duplicateCatalogIds':[name for name,n in Counter(m['id'] for m in catalog).items() if n>1]}
    report={'scope':'All runtime characters, all 11 action clips, all four facings, source files and portraits.',
            'qualityMeaning':'No character/action has been signed off as meeting the requested full-motion artwork quality. File presence is checked separately.',
            'summary':{'characters':len(characters),'groups':dict(Counter(c['group'] for c in characters)),
                       'expectedCharacterActions':len(characters)*len(ACTIONS),
                       'presentCharacterActions':sum(a['present'] for c in characters for a in c['actions'].values()),
                       'expectedActionDirections':len(characters)*len(ACTIONS)*4,
                       'presentActionDirections':sum(v['present'] for c in characters for a in c['actions'].values() for v in a.get('views',{}).values()),
                       'fullyQualityApprovedCharacters':0,'fullyQualityApprovedActions':0},
            'rosterCoverage':coverage,'structuralIssues':findings,'characters':characters}
    OUTPUT.mkdir(parents=True,exist_ok=True)
    (OUTPUT/'coverage.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:report[k] for k in ['summary','rosterCoverage','structuralIssues']},ensure_ascii=False,indent=2))
    for c in characters:
        if c['id'] in ['mira','bron','kai','fia','dew']:
            print(c['id'],json.dumps({a:{'frames':d['playbackFrames'],'methods':d['methods'],'uniqueSW':d['views']['SW']['uniquePixelFrames']} for a,d in c['actions'].items()}))


if __name__=='__main__':
    main()
