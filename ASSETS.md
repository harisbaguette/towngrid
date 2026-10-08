# 에셋 출처

| 파일 | 제작·출처 | 사용 범위 |
|---|---|---|
| `art-source/pixel-characters/authored-actions-v13/mira/*.png` | 프로젝트의 기존 미라 원화를 참조해 `image_gen`으로 제작. 입력·프롬프트·생성 파일은 같은 폴더의 `generation.json`과 `proportions-revision.json` | 생성 원본 32장 중 12장이 v13c 게임 SW/SE 걷기에 사용됨 |
| `public/character-preview/slow-walk/mira/` | `scripts/pack-mira-slow-walk.py`가 v13c 원화 12장을 패킹. 원본 연결은 `pack.json` | 현재 게임 보행의 비교 표시 |
| `art-source/pixel-characters/authored-actions-v14/mira/` | 기존 미라 v13 원본과 직전 개별 작화를 입력해 내장 `image_gen`으로 한 장씩 제작. 입력·프롬프트·생성 파일·제외 사유는 `generation.json` | 반대 발·팔 교대와 발 통과 자세 검토. 새 후보 9장, 제외 2장 |
| `public/character-preview/slow-walk/individual/` | `scripts/pack-mira-single-cels.py`가 기존 12장과 새 9장을 전신 균등 축척·위치 정렬로 패킹 | 비교 화면 전용. 게임 미적용. 접지·착지 전환 미완료 |
| `art-source/pixel-characters/authored-actions-v14/mira/continuity/` | 기존 개별 원화를 입력해 내장 `image_gen`으로 한 장씩 수정. 입력·프롬프트는 `generation.json` | 연결 수정 시도. 전체 연속 재생 미해결로 미적용. 의상·접지가 깨진 결과는 제외 |
