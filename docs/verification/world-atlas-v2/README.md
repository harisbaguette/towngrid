# 세계 지도 개선 검증 — 2026-09-29

전용 픽셀 지형, 이어지는 해안·물길, 거점 표식, 확대별 지명, 실제 지역 미리보기와 부지 선택 진출을 확인했다.

## 실제 화면

- [대륙 전체](01-continent.png): 수도·시작 후보·적대 지역, 국경과 물길.
- [거점 주변과 실제 지형](02-region-and-real-preview.png): 확대해도 유지되는 글자 크기, 24×24 지역 미리보기.
- [모바일 두 손가락 확대](03-mobile-pinch.png): 선택 부지 유지, 가로 넘침 없음.
- [진출 부지와 비용](04-expansion-offer.png): 선택한 부지의 자금·자재·승급 조건.
- [실제 거점 생성 후](05-owned-settlement.png): 같은 칸의 보유 표식과 이동 버튼.
- [해외 진출 잠금](06-foreign-locked.png): 부족한 승급 조건과 비활성 버튼.
- [모바일 거점 이동](07-mobile-campaign.png): 보유 거점의 실제 저장 지도와 이동.

## 검사

- `npm run typecheck`: 통과.
- `npm test`: 전체 통과. `regression.log`, `regression-result.json` 참조.
- `npm run build`: 통과. 큰 청크와 빌드 플러그인 소요 시간 안내는 남아 있다. `build.log`, `build-result.json` 참조.
- `tests/world-atlas.mjs`: 1,550칸 이웃 연결·원본/세계 데이터 해시·지명 겹침·고정 글자 크기·승급과 자재 제한·정확한 부지와 비용·미리보기/실제 생성 타일 일치·저장 복원 통과.
- `tests/world-atlas-browser.mjs`: 실제 게임에서 1440×900·390×844 화면, 새 이미지, 두 손가락 확대, 자원 레이어, 실제 진출과 이동 통과. 페이지 오류와 세계 지도 이미지 HTTP 오류 없음. `browser-results.json` 참조.
- `tests/starting-sites-browser.mjs`: 실제 게임에서 국가 30곳 선택, 플레이 가능 국가별 비수도권 5곳, 수도·산·수역 시작 차단, 모바일 새 게임과 실제 저장 위치 일치 통과. 결과는 `../starting-sites/`에 있다.

브라우저 재실행: `node tests/world-atlas-browser.mjs <playwright/index.mjs> <chrome.exe>`. 사용자 저장과 분리된 일회용 브라우저를 사용한다.

지형 그룹은 기존 36개에서 5개 SVG 하위 요소로 줄었다. 대신 3200×1984 lossless WebP 1,308,408 bytes를 읽는다. 지형은 한 번 합성하고 정적 레이어를 재사용한다. 이 수치는 FPS 개선율이 아니며 저사양 실기기 성능은 측정하지 않았다. 지도는 한 칸이 한 거점인 격자 표현을 유지한다.
