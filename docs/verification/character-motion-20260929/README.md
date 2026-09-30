# 캐릭터 동작 재점검 · 2026-09-29

[수정 전후 비교](before-after.png)에서 운반물이 사라지던 구간과 CPU 쓰러짐 방향을 비교할 수 있다. [일반 일꾼 7종의 보행](seven-walk-cycles.png)은 실제 아틀라스의 12프레임을 순서대로 표시한다.

## 바뀐 동작

| 상황 | 수정 전 | 수정 후 |
| --- | --- | --- |
| 이동 중 모서리 | 제자리 회전 프레임으로 미끄러짐, 운반 상자 사라짐 | 걷기·운반의 거리 기반 보행 유지 |
| 상자를 들고 잠시 대기 | 빈손 대기 자세 | 들기의 마지막 자세로 상자·접지 유지 |
| 시설을 바라보며 상하차 시작 | 회전이 앞부분을 가림 | 들기·놓기 동작 즉시 재생 |
| 연속 피해 | 피격 첫 프레임으로 계속 초기화 | 시작한 피격 동작 진행 |
| CPU 쓰러짐 | 이미 누운 그림을 추가 회전 | 같은 프레임·발 기준점으로 표시 |
| 쓰러짐 후 사라짐 | WebGL 그림자 잔류 | 몸과 그림자가 함께 사라짐 |

멈춘 빈손 캐릭터의 제자리 회전은 유지한다. 캐릭터 원화, 네 시점, 이동 속도, 운송 수량과 저장 형식은 변경하지 않았다.

## 확인 결과

- 51종 × 네 시점의 상태 전환 검사 통과.
- 실제 마을 게임 시간 90.002초 동안 운송량 190. 모서리 전환 315회, 이동 7,507건·상하차 2,798건·상자를 든 대기 88건의 관측에서 표시 상태 불일치 0건.
- 인간·엘프 진영, 카메라 네 시점, 주민 패널 동작 11종, 시설 작업/중지, 390px 모바일, CPU 표시, 호흡과 동작 줄이기 확인. 페이지 오류·캐릭터 이미지 실패 없음.
- 51종 자산 규격 검사와 50종 관절 리그의 12,800개 셀 검증 통과. 미라의 256개 셀·보행/운반 머리 픽셀 96개 비교는 실제 브라우저 검사에 포함한다.
- 타입 검사·빌드·수정한 캐릭터 모듈/테스트의 ESLint·최종 `npm test` 전체 통과. [전체 회귀 출력](regression.log)에서 시뮬레이션·밸런스·저장·환경·시작 화면과 회귀 9종의 결과를 확인할 수 있다.

상세 결과: [마을·주민 검사](runtime/browser-check.json), [전체 캐릭터·양 진영 검사](roster/browser-check.json), [동작 전후 프레임](comparison.json). [주민 패널](runtime/resident-mira.png)과 [엘프 진영](roster/elf-workforce.png)도 확인할 수 있다.

## 다시 검사하기

프로젝트 루트에서 실행한다. 브라우저 검사에는 로컬 서버와 이미 설치된 Playwright·Chromium의 경로가 필요하다.

```powershell
node tests/character-motion.mjs
node tests/character-movement.mjs
python scripts/verify-roster-art.py
npm.cmd run check:characters
$env:TOWNGRID_URL='http://localhost:5173'
$env:TOWNGRID_PROOF_DIR='../docs/verification/character-motion-20260929/runtime/'
node tests/mira-runtime-browser.mjs <playwright/index.mjs> <chrome.exe>
$env:TOWNGRID_PROOF_DIR='../docs/verification/character-motion-20260929/roster/'
node tests/roster-browser.mjs <playwright/index.mjs> <chrome.exe>
```

이번 브라우저 검사는 Windows / Node 22.18.0 / Chromium 1217 / 별도 검증 포트 5174에서 실행했다. 사용자 브라우저의 저장 데이터는 사용하지 않았다. 45도 중간 원화와 일부 관절 외곽선 보정은 포함하지 않는다.
