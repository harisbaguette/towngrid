# 미라 v3 — 게임 시험 적용

현재 동작 개정은 `mira-quarter-rig-4`다. 화면상의 두 다리를 별도로 꺾던 보행을, 같은 길이의 3D 다리 관절을 쿼터뷰로 투영하는 방식으로 교체했다. 발은 폭이 좁은 평행 경로를 따르고 접지/이탈 구간의 속도가 이어진다. 대기 시에는 무릎을 펴고, 보행 중에는 지지 발 위를 지날 때 골반이 올라온다.

큰 일러스트는 `scripts/mira_portrait.py`로 굽는 4초 APNG 호흡 루프다. 어깨·상의·머리카락이 움직이며 얼굴은 최대 한 논리 픽셀만 이동하고 허리 아래는 고정된다. 주민 목록의 작은 사진은 정지 상태를 유지한다. OS의 동작 줄이기 설정에서는 큰 일러스트도 정지 그림을 사용한다.

`http://localhost:5173/character-preview/mira/`에서 네 방향과 동작을 비교한다. 게임에서는 새로고침 후 **초반 마을 테스트 → 주민 → 미라**로 확인한다. 이 폴더는 미라의 정본이며 다른 인물은 `roster-v4/`, `professions-v5/`에서 관리한다.

`turnaround.png`와 `portrait-props.png`는 이미지 생성 도구로 제작한 원본이다. `runtime-pack.json`에 원본 좌표, 부위 마스크, 관절, 발 기준점, 한 보행 주기의 이동 거리를 보존한다. `scripts/mira_rig.py`가 원화의 팔·다리 부위를 관절에 맞춰 변환하고 발을 별도로 정렬해 프레임으로 굽는다. 머리·몸통은 확대·축소하지 않는다. 256칸은 독립적으로 그린 256장의 원화가 아니다.

재생성(Python + Pillow + NumPy):

```powershell
python scripts/mira_rig.py art-source/pixel-characters/prototypes/mira-v3/runtime-pack.json
```

실행용은 `public/assets/pixel-characters/mira/`의 `sprites.png`, `portrait.png`, `portrait-idle.png`, `frames.json`, `walk-preview.gif`다. 상위 `pack-manifest.json`과 `mira_runtime.py`도 이 명세를 호출한다. 기존 v2 원본은 비교용으로 남겼다.

128px 셀, 64열 × 4방향(SW/NW/NE/SE), 8192×512 RGBA, 공통 앵커 `(64,108)`. 기존 대기 4·걷기 12·운반 12·작업 8·들기 6·인사 6칸 뒤에 공격 6·피격 2·쓰러짐 4·발 회전 4칸을 추가했다. 놓기는 들기를 역순 재생한 뒤 대기로 돌아온다. 실제 이동 거리가 0.5월드 단위 진행할 때 한 보행 주기가 돈다.

반대편 NE/SE는 NW/SW를 좌우 반전하므로 비대칭 장식·공구 손도 반전된다. `character_actions.py`의 별도 관절 포즈로 공격·피격·쓰러짐·발 회전을 만든다. 회전은 발을 디딘 뒤 네 방향 중 다음 그림으로 바뀌며 중간 각도 원화는 없다. 관절 기반 시안으로, 최종 아트 승인과 개별 작화의 다듬기는 별도다.

검증 결과와 실제 게임·미리보기 화면: `docs/verification/mira-runtime/`. 보행/운반 96개 방향별 프레임의 머리 픽셀 일치, 좌우 발 교대, 지지 발의 이동 상쇄, 투명 셀 경계, 게임 네 시점, 주민 패널, 실제 운송을 검사했다.
