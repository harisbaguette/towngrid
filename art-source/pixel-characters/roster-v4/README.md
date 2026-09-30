# 주민과 건물 전용 인력

미라의 승인된 보행 방식을 다른 23종에 적용한 원화와 관절 명세다. 게임과 `/character-preview/`는 `public/assets/pixel-characters/`의 같은 파일을 읽는다.

## 배치

| 구분 | 일반 일꾼 | 전용 인력으로 재사용 |
| --- | --- | --- |
| 인간 | 미라 · 여성 | 하나: 제빵, 로웬: 설비, 에단: 재배, 베라: 의료/연구 |
| 드워프 | 브론 · 남성 | 마르나: 제련 |
| 티탄 | 타론 · 남성 | 베라의 은발·얼굴은 인간 의료 인력으로 재분류 |
| 엘프 | 실렌 · 여성 | 리엔: 제빵, 아엘: 목공, 엘리온: 재배 |
| 정령 | 이슬 · 중성 | 안개: 마력 기술 |
| 켄타로스 | 카이 · 남성 | 라나: 사육 |
| 요정 | 피아 · 여성 | 에일: 의료 |

엘프 계열 성별은 현재 적용 기본값이다. 타론은 회색 피부·굵은 팔·넓은 어깨와 큰 체형으로 인간과 구분한다. 실제 표시 높이는 인간 1.05, 드워프 0.84, 티탄 1.5다. 적대 인물 6종도 같은 방식으로 갱신했으며 플레이 가능 세력으로 바꾸지 않았다.

`src/app/game/facility-staff.js`가 건물별 직업과 세력별 인물을 결정한다. 고용 절차 없이 자동 표시하며, 실제 가동·공급·중지·파손 상태를 따른다. 주택 인원·운송 슬롯·생산 수치·저장 형식은 추가하지 않는다. 한 직업군을 여러 시설이 공유한다.

## 원본과 재생성

- `<id>.png`: 큰 일러스트 + 앞/뒤 대각선 기본 자세 원본.
- `<id>/portrait.png`, `SW.png`, `NW.png`: 투명 배경과 크기를 정리한 원화.
- `<id>/extraction.json`: 추출 경계와 크기. Rowan의 뒤 원화는 반전하여 NW로 맞췄다.
- `<id>/rig.json`: 눈으로 확인한 몸통 경계, 관절, 부속 부분, 보폭과 발 기준점.
- `tools.png`, `tools/`: 제빵 삽·괭이·도끼·망치·렌치·의료 서류·수정 등의 원본과 실행용 소품.
- `generation-record.json`: 생성 프롬프트와 최초 파일 경로. 예전 시안은 상위 폴더와 `*-general-archived.png`로 보존한다.

프로젝트 루트에서 실행한다. Python 의존성은 `scripts/requirements-art.txt`에 있다.

```sh
python scripts/roster_specs.py
python scripts/pack-pixel-characters.py art-source/pixel-characters/pack-manifest.json
python scripts/verify-roster-art.py
python tests/character-skinning.py
python tests/character-finish.py
npm run check:characters
```

일부만 패킹하려면 `python scripts/roster_rig.py taron hana`처럼 ID를 지정한다. 원본을 교체했을 때만 `scripts/roster_sources.py`를 다시 실행하고 관절 좌표를 재검토한다. Rowan 추출에는 `--flip rowan`이 필요하다. 미라는 `prototypes/mira-v3/`의 별도 정본을 유지한다.

## 동작과 한계

각 아틀라스는 RGBA 8192×512, 128px 셀, 64열 × 4행이다. 행은 SW/NW/NE/SE, 열은 대기 4·걷기 12·운반 12·작업 8·들기 6·인사 6·공격 6·피격 2·쓰러짐 4·회전 4다. 놓기는 들기의 역재생을 사용한다. 걷기/운반 위상은 게임에서 실제 이동 거리로 계산한다. 신규 직업 27종의 원본과 명세는 `../professions-v5/`에 있다.

이족 보행은 고정 길이의 3D 다리 관절을 쿼터뷰로 투영한다. 켄타로스는 네 발의 접지 시점, 정령은 부유와 꼬리 흐름을 별도로 계산한다. 얼굴은 같은 픽셀을 보존하며 큰 일러스트는 4초 APNG 호흡 루프다. 동작 줄이기 설정에서는 정지 일러스트를 보여준다.

반대편 두 방향은 좌우 반전이다. `rig_skinning.py`의 `continuous-joints-1`이 팔꿈치·무릎·발목의 연결을 함께 변형한다. 2026-09-29에 관절 겹침·틈과 이슬·카이의 손 조각, 소라의 꼬리와 피아의 날개 분리를 보완했다. 원본 PNG·초상화·보폭·발 기준점은 유지했다. 비교 화면과 검증은 `docs/verification/character-finish-20260929/`에 있다.

`profession_motion.py`가 직업별 손동작을, `character_actions.py`가 별도 공격·피격·쓰러짐·발 회전을 만든다. 회전은 발을 디딘 뒤 다음 쿼터뷰 그림으로 전환한다. 전 프레임을 손으로 다시 그린 작화는 아니며 자동 검사는 잘림·발 접지·얼굴 픽셀 보존을 확인한다.
