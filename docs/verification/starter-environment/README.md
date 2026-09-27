# 초반 마을 화면 검증

2026-09-27, 로컬 개발 서버와 Playwright Chromium. `tests/starter-environment-browser.mjs`가 생성했다. `browser-results.json`에 상태·방향·생산·운반·저장 보존 결과가 있다.

- `start-screen.png`: 초반 마을 테스트 진입 버튼.
- `village-quarter-0~3.png`: 정지 상태의 네 방향. 건물 9채, 주민 6명.
- `well-stopped.png`: 실제 우물 선택과 가동 중지 패널.
- `village-produced.png`: 120초 시뮬레이션 후 생산·물류 상태.
- `village-software.png`: 같은 마을의 CPU 렌더러 화면.
- `village-mobile.png`: 390×844 화면과 회전 상태.

실제 게임은 `http://localhost:5173` → **초반 마을 테스트**. Q·E 또는 회전 버튼으로 90°씩 전환한다. 마우스 드래그와 휠로 이동·확대할 수 있다. 테스트의 자동 저장은 차단되며 설정에서 파일 내보내기는 가능하다.

아트는 시험 적용본이다. 건물의 방향별 세부 구조·프레임 윤곽에는 차이가 남아 있고, 캐릭터 크기나 나머지 환경 아트는 이번 초반 건물 작업에서 재설계하지 않았다.
