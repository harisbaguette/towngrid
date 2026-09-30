# 건물 직업 인물 27종

`cast.json`에 인물·성별·종족·직업·생성 설명을 기록했다. `pair-00.png`부터 `pair-24.png`까지 두 인물씩, `terin.png`에 마지막 인물의 큰 일러스트·앞쪽 SW·뒤쪽 NW 원화가 있다. 원본 생성 파일은 `generation-record.json`에 기록했다.

각 인물 폴더의 `portrait.png`, `SW.png`, `NW.png`, `rig.json`을 실행 자산으로 패킹한다. 128px 셀에서 머리와 몸통 크기를 유지하고 발 접지와 이동 거리를 맞춘다. 반대편 NE/SE는 반전이다. `professions-v5/tools/`에는 전용 도구가 있다.

재생성:

```powershell
.\work\quarter-art-venv\Scripts\python.exe scripts/profession_sources.py 0 2 4 6 8 10 12 14 16 18 20 22 24
python scripts/profession_specs.py
.\work\quarter-art-venv\Scripts\python.exe scripts/pack-pixel-characters.py art-source/pixel-characters/pack-manifest.json
python scripts/verify-roster-art.py
python tests/character-skinning.py
python tests/character-finish.py
node scripts/check-pixel-characters.mjs
```

추출은 Pillow·NumPy·SciPy를 사용한다. `terin.png`는 단일 인물 시트이므로 `roster_sources.ROOT`를 이 폴더로 설정한 뒤 `roster_sources.extract('terin')`로 추출한다. 오스윈·닥스·노린의 뒤쪽 원화는 추출 시 반전해 NW를 맞춘다. 기존 24종의 걷기·운반 픽셀은 그대로 보존했다.

아틀라스는 64열 × 4행이다. 첫 48열은 대기 4·걷기 12·운반 12·작업 8·들기 6·인사 6이다. 뒤의 16열은 공격 6·피격 2·쓰러짐 4·회전 4이며 놓기는 들기를 역재생한다. `character_actions.py`가 원화 부위에 관절 포즈를 적용하고, `profession_motion.py`가 직업별 손과 도구 움직임을 지정한다. `rig_skinning.py`의 `continuous-joints-1`로 팔꿈치·무릎·발목 연결을 함께 변형하며, 쓰러짐 무릎은 몸 쪽으로 접힌다. 원본 PNG·초상화·보폭·발 기준점은 유지했다. 검증은 `docs/verification/character-finish-20260929/`에 있다. 손으로 전 프레임을 다시 그린 작화는 아니며 회전은 발 디딤 후 네 시점 간 전환이다.

`facility-staff.js`의 19개 직업군은 양 진영에서 서로 다른 인물 19명씩을 사용한다. 일반 일꾼 7명과 적대 인물 6명을 합쳐 총 51명이다. 전문 인력은 자동 표시되며 생산량·인구·운송 슬롯을 늘리지 않는다. 실제 경비대도 가렌/아스테르 외형을 사용하며 기존 저장의 HP·이름·경로를 유지한다.
