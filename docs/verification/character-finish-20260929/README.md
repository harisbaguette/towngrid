# 캐릭터 관절·부속 작화 보완 — 2026-09-29

[수정 전후 비교](before-after.png)에서 발목·팔꿈치 연결, 분리된 손·장갑·꼬리·날개와 쓰러짐 무릎을 비교할 수 있다. 게임과 `/character-preview/`에 51종의 보정 팩을 반영했다.

## 바뀐 부분

- 팔꿈치·무릎·발목의 원화 조각이 공통 경계와 텍스처 좌표로 변형된다. 관절을 접을 때 잘린 끝이 겹치거나 뾰족하게 튀는 현상과 발목 틈을 줄였다.
- 카이의 인사 장갑과 이슬의 운반 손은 팔과 함께 움직인다. 원화의 머리카락 조각과 허리띠는 원래 부위에 남긴다.
- 소라의 꼬리는 뿌리부터 한 부위로 움직이며 작업·쓰러짐에도 몸에서 분리되지 않는다. 피아의 날개도 쓰러지는 몸을 따라간다.
- 이족 캐릭터의 쓰러짐 무릎은 몸 쪽으로 접힌다. 짧은 드워프 다리가 바닥 아래로 꺾이는 현상을 보완했다.

원본 PNG·초상화는 유지했다. `scripts/rig_skinning.py`, 원본 관절 명세, 상위 패킹 목록과 실행용 팩의 `rigFinish`는 `continuous-joints-1`이다. 반대편 두 방향은 좌우 반전이고 회전은 네 시점 간 전환이다. 원화 부위를 변형한 동작이며 전 프레임 손작화나 45도 중간 원화는 아니다.

## 확인 결과

| 검사 | 결과 |
|---|---|
| 원화 팔다리 408개 | 무변형 픽셀·정수 이동·접힌 관절의 텍스처 연결 통과 |
| 51종·13,056셀 | 크기·투명 배경·잘림·반전 관절 좌표 통과 |
| 변경 전과 대조 | 초상화 102개, 51종 보폭·발 기준점·기존 동작 구간 유지 |
| 확인된 부속 분리 5곳 | 모든 사례에서 분리된 조각 해소 |
| 원본 재패킹 | 미라·소라·카이·보리크의 각 5개 파일이 게임 반영본과 정확히 일치 |
| 실제 마을 90.002초 | 이동 7,250건·상하차 2,839건·상자를 든 대기 90건·모서리 전환 307회, 상태 불일치 0건 |
| 브라우저 | 51종, 두 진영, 네 카메라, 11개 주민 동작, 호흡·동작 줄이기·모바일·CPU 표시 통과 |
| 실제 전투 표시 | 공격→피격→공격→쓰러짐→페이드 통과. 페이지 오류·캐릭터 요청 실패 0건 |

파일 검사는 [art-check.json](art-check.json), 재패킹 대조는 [repack-check.json](repack-check.json)에 있다. 실제 화면과 상태 기록은 [runtime](runtime/browser-check.json), [roster](roster/browser-check.json), [specialists](specialists/specialists-browser.json)에 있다.

타입 검사·프로덕션 빌드·변경한 JavaScript 검사의 ESLint는 통과했다. 빌드의 기존 청크 크기·정적 경로 분류 안내는 남는다.

전체 `npm test`는 캐릭터·시뮬레이션·밸런스·저장·환경·카메라 검사까지 통과했으나, 별도 추가 중인 `public/assets/screens/daily-v3/dawn-bakery.webp`가 없어 `tests/screen-art.mjs`에서 중단됐다. 그림 개수 증가에 맞춰 덱 검사의 표본 수는 `WORK_ART.length * 10`으로 수정했다. 파일 누락 검사는 유지했다. 그 뒤의 캐릭터 팩 검사와 감사 회귀 9종은 별도로 모두 통과했다. 출력은 [regression.log](regression.log)와 [audit-regression.log](audit-regression.log)에 있다.

## 재실행

프로젝트 루트에서 `scripts/requirements-art.txt`의 Python 의존성을 설치한 환경을 사용한다. 로컬 환경은 `work/quarter-art-venv`다.

```powershell
.\work\quarter-art-venv\Scripts\python.exe tests/character-skinning.py
.\work\quarter-art-venv\Scripts\python.exe tests/character-finish.py
.\work\quarter-art-venv\Scripts\python.exe scripts/verify-roster-art.py
npm run check:characters
```

게임을 실행한 뒤 Playwright와 Chromium의 설치 경로를 넣는다.

```powershell
$env:TOWNGRID_URL='http://localhost:5173'
$env:TOWNGRID_PROOF_DIR='../docs/verification/character-finish-20260929/runtime/'
node tests/mira-runtime-browser.mjs <playwright/index.mjs> <chrome.exe>
$env:TOWNGRID_PROOF_DIR='../docs/verification/character-finish-20260929/roster/'
node tests/roster-browser.mjs <playwright/index.mjs> <chrome.exe>
$env:TOWNGRID_PROOF_DIR='../docs/verification/character-finish-20260929/specialists/'
node tests/specialists-browser.mjs <playwright/index.mjs> <chrome.exe>
```

원화 팩을 다시 만들 때는 `python scripts/pack-pixel-characters.py art-source/pixel-characters/pack-manifest.json`을 실행한다. 변경 전 파일을 보존한 폴더가 있으면 `tests/character-finish.py --before <폴더> --report <결과.json>`으로 초상화와 보행 좌표의 보존까지 대조할 수 있다.
