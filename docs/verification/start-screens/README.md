# 대기·홈·로딩 화면 검증

2026-09-27, Windows / Node 22.18.0, 기존 pnpm 잠금 파일과 설치된 Playwright / Chromium 사용.

- `npm run typecheck`, `npm test`, `npm run build` 실행.
- `tests/screen-art.mjs`: 6장씩 중복 없는 선택, 묶음 경계 반복 방지, 새로고침 후 순서 유지, 손상/사용 불가 저장소, WebP 9개 검사.
- `tests/start-screens-browser.mjs`: 실제 대기 화면 키보드 진입, 홈/설정/국가 선택/갤러리 이동, 6장 확인, 저장 파일 불러오기, 실제 이미지 응답을 지연시킨 긴 로딩의 그림 교체, 시연 진입과 기존 저장 유지.
- 데스크톱 1440×900, 모바일 390×844, 가로 화면 844×390과 동작 줄이기 설정 확인.
- 최종 결과는 `results.json`, 실제 캡처는 같은 폴더의 PNG.

재실행:

```text
node tests/start-screens-browser.mjs <playwright/index.mjs> <chrome.exe>
```

사용자 브라우저와 분리된 임시 테스트 컨텍스트에만 테스트 저장 파일을 넣는다.
최초 Chromium 1234 실행은 첫 화면 캡처에서 실패했다. 설치된 Chromium 1217로 실제 화면을 캡처하고 검증했다.
기존 500KB 초과 청크와 정적 경로 분류 안내는 남아 있다. 자동 검사는 일러스트 작화 전체나 게임 출시 품질을 보증하지 않는다.
