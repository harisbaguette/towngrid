# 생산 시설 상태 확인

개발 서버에서 `/production-preview.html`을 열고 상태·시점·크기를 바꿀 수 있다. 실제 생산/물류는 홈의 **초반 마을 테스트**에서 확인한다.

- `empty.png`: 완료 재고 없음. 빈 물통·빈 적재대·빈 출력 공간.
- `working.png`: 실제 작업 상태에 맞춘 도구 동작과 작물 생장.
- `ready.png`: 완료 재고 6, 작업은 멈춤.
- `working-ready.png`: 작업과 출력 재고가 동시에 존재.
- `blocked.png`: 재료/자원 부족. 우물은 입력 재료가 없으므로 재료 부족으로 표시하지 않음.
- `disabled.png`: 가동을 멈춰도 남은 출력 재고 유지.
- `quarter-0.png`~`quarter-3.png`: 네 방향. 흰 선은 실제 1×1 타일.
- `software.png`, `mobile.png`: CPU 렌더링과 390px 화면.
- `results.json`: 상태/출력/본체 프레임과 브라우저 오류 검사 결과.

재실행: `node tests/production-visuals-browser.mjs <playwright/index.mjs> <chrome.exe>`.

출력 더미는 재고 구간, 옆 수량은 정확한 개수다. 이 상태 비교는 연출을 분리해 확인하는 용도이며, 실제 생산·운반과 기존 저장 보존 결과는 `../starter-environment/`에 있다.
