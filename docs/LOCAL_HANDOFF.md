# TownGrid 로컬 개발 인수인계 — 2026-09-27

## 이 파일의 기준

배포 v13, 원본 커밋 `9f34ab4e9a082ad8aaa3dd906f646932d49f69e1`의 전체 소스/자산을 기준으로 한다. 로컬 패키지는 게임 기능을 재설계하지 않고 실행 명령, VS Code 설정, 인수인계 문서를 추가했다. 이전 이름, 3대륙, 과거 3D 캐릭터 설명이 있는 문서는 당시 작업 기록이다. 현재 기획과 충돌하면 이 문서와 `AGENTS.md`를 따른다.

## 최신 추가: 기본 수출길과 수출 관문

모든 지도는 서쪽 끝 관문 `EXPORT_GATE` (0,11)에서 시작 땅 (8,11)까지 이어지는 8칸 수출길을 기본으로 가진다. 규칙은 `src/app/game/export-route.js`에 모여 있다. 판매(`sell`)와 자동 판매는 창고에서 관문까지 길을 찾아 수출 마차를 보낸다. 재고는 실을 때 빠지고, 대금·판매 실적은 마차가 관문에 도착할 때 들어온다. 마차는 최대 3대이며 돌아와야 다음 마차를 보낼 수 있다. 수출길 타일은 아직 사지 않은 땅이어도 마차가 지나갈 수 있지만, 주민 이동 규칙은 그대로다.

저장 형식은 버전 8을 유지하고 `shipments`, `nextShipmentId`를 선택 필드로 추가했다. 기존 저장은 불러올 때 수출길을 다시 깔고, 그 위의 나무는 치운다. `persistence.js`는 마차 수, 품목, 수량, 경로, 진행 위치를 검사해 조작된 저장을 거부한다. 화면에는 `makeExportGate` 관문 모형과 이동하는 화물 마차가 보이고, 판매 패널에 연결 상태와 운행 중인 마차 수가 표시된다.

남은 한계: 계약 납품·수입·국가 교역은 아직 즉시 처리된다. 출발한 마차는 나중에 길 위에 지은 건물을 우회하지 않고 원래 경로로 움직인다. 마차 전용 픽셀 작화는 없고 기존 화물 차량 모형을 쓴다. 검증은 `tests/export-route.mjs`가 맡는다.

## 초반 건물 5종과 테스트 마을

시작 화면의 **초반 마을 테스트**로 창고·주민 주택·우물·밀밭·벌목장과 기존 제재소를 함께 확인한다. `starter-demo.js`가 9채와 주민 6명을 준비한다. `Campaign({starter:true})`와 `Game.tsx`의 `begin('starter')`로 진입하며, 기존 시연과 같은 `demoRef` 저장 차단을 사용한다. 보통 새 게임의 초기 조건과 저장 키·형식은 그대로다.

`pixel-environment-data.js`의 `pixelBuildingFrame`이 생산 가동, 입주, 창고 상하차, 작물 진행률을 화면에 연결한다. `makePixelBuilding`은 대상 6종에만 적용되고 종족별 특수 주택·나머지 건물은 기존 모델을 사용한다. 192px 셀의 4방향×4상태 PNG, 원본·프롬프트·패킹 경계를 함께 보존했다. 바닥에 가려지는 빌보드 기초는 화면 위치를 유지하는 시선 방향 보정으로 해결했다.

검증: `npm run typecheck`, `npm test`, `npm run build`, 기존 `tests/pixel-environment-browser.mjs`, 추가 `tests/starter-environment-browser.mjs` 통과. 화면과 JSON은 `docs/verification/starter-environment/`에 있다. 생성 아트의 프레임별 미세한 형태 차이와 방향별 건축 세부 차이는 남아 있어 테스트용 샘플로 다룬다.

## 현재 구조

React 19 / TypeScript / Vinext / Vite / Three.js 기반 웹 게임이다. Next 호환 App Router 구조와 기존 Cloudflare 로컬 실행 도구가 들어 있다. 데스크톱 앱이나 Unity/Godot 프로젝트는 아니다. 로컬 실행에 외부 서버나 AI API 연결이 필요하지 않다. 저장은 브라우저 localStorage 및 JSON 파일이다.

WebGL은 기존 3D 환경과 픽셀 캐릭터를 합성한다. 제재소·창고·주민 주택·우물·밀밭·벌목장·참나무·맵 내부 물 타일은 픽셀 샘플로 교체했다. CPU 렌더러도 같은 환경 아틀라스를 읽는다. 카메라는 90° 간격 네 방향, 고도각 약 35.264°로 고정했다. 전체 환경의 픽셀 전환이 끝난 것은 아니다.

| 기능 | 주요 파일 |
| --- | --- |
| 게임 화면/입력/전체 연결 | `src/app/game/Game.tsx` |
| 시작 국가 선택·세계 지도 | `WorldMap.tsx`, `WorldAtlas.tsx`, `world.js`, `territory.js` |
| 주민 목록·일러스트·미리보기 | `ResidentRoster.tsx`, `CharacterSprite.tsx`, `resident-roster.js` |
| 캐릭터 ID/방향/행동/앵커 | `pixel-character-data.js`, `pixel-character-meta.js`, `pixel-characters.js` |
| 렌더링·건물·배경·쿼터뷰 | `scene.js`, `quarter-camera.js`, `software-renderer.js`, `models.js`, `assets.js`, `scenery.js` |
| 타일 생산과 경제 | `simulation.js`, `industry.js`, `economy.js`, `living-economy.js`, `proximity.js` |
| 이동/운송 | `logistics.js` 및 `simulation.js` |
| 캠페인·승급·외부 변수 | `campaign.js`, `progression.js`, `encounters.js`, `world.js` |
| 저장/복구/이전 형식 | `persistence.js` |
| 사운드 | `audio.js`, `public/assets/audio/` |
| 게임 UI 스타일 | `src/app/game-ui.css`, `src/app/globals.css` |

표의 파일명만 적힌 경로는 `src/app/game/` 기준이다. 기존 `docs/TOWNSTAR_RULES.md`와 `docs/GAME_DESIGN.md`도 참고하되, 모든 계획이 구현된 것으로 간주하지 않는다.

## 실제 구현된 범위

- 1대륙과 30개 국가 데이터, 두 플레이 가능 상위 종족군 및 적대 세력.
- 24×24 로컬 타일 맵, 초기 구역과 확장, 건설·철거, 생산·판매·운송과 주변 효과.
- 33개 성장 단계 데이터, 빚·가족 구출·독립·외교·여러 거점과 신생 국가의 기초 로직.
- 카메라 이동/확대와 90도 간격 네 방향 쿼터뷰, 건물과 차량, 배경 경관, 사운드 설정, 저장/복구. 카메라 높이 각도는 약 35.264도로 고정되고 Q/E·버튼으로 전환한다. 좌우 마우스 드래그는 이동, 터치 두 손가락은 확대/이동이다.
- 승인된 TownGrid 타이틀/심볼 적용.
- 픽셀 캐릭터 24종의 일러스트·방향·동작을 주민 화면, 맵 위 주민, 습격 적에 연결.

위 항목은 코드가 존재하고 연결된 범위다. 반복 플레이의 재미, 장기 경제 균형, 모바일 사용성, 아트 일관성까지 출시 수준으로 검증됐다는 뜻은 아니다.

## 캐릭터 작업 현황

### 미라 1명 검토용 시안 (2026-09-27, 미승인)

사용자의 전체 작업 전 1명 확인 요청에 따라 별도 시안을 추가했다. `/character-preview/mira/index.html`에서 고유 일러스트와 68개 방향/행동 포즈를 볼 수 있다. 걷기는 SW/NW/NE/SE 각 8프레임 초안이며 나란히 비교할 수 있다. 방향 보기는 대각선 4개다. 대기·작업·인사·상자는 이전 E 방향 시안을 유지한다. 원본·제약·재패킹 명령은 `art-source/pixel-characters/prototypes/mira-v2/README.md`, 최신 스크린샷·영상·검증은 `docs/character-preview/mira-v2/quarter-walk/`, 쿼터뷰 전환 검증은 `docs/quarter-view/`에 있다. 새 걷기의 반대쪽 발 접지와 실루엣은 추가 정리가 필요하다. 새 화풍 시안은 게임에 적용하지 않았다. 모든 행동의 네 대각선 작화와 투명 아틀라스는 아직 없다.

게임의 타일 경계 이동량 손실은 `character-movement.js`를 주민·경비·습격자 이동에 연결해 수정했다. `pixel-characters.js`의 보행 위상은 실제 누적 이동 거리로 계산하므로 속도를 바꿔도 지난 시간 전체에 새 속도를 곱하지 않는다. 거리는 WeakMap에만 보관하며 기존 저장 형식과 이동 속도 상수를 유지한다. `tests/character-movement.mjs`와 실제 게임 검증을 통과했다. 원래 아트의 제한된 포즈 수와 기기별 렌더링 성능은 별도 한계다.

| 상위 분류 | 세부형 | 캐릭터 ID |
| --- | --- | --- |
| 인족 | 인간 | mira, rowan, hana, ethan |
| 인족 | 드워프 | marna, bron |
| 인족 | 티탄 | vera, taron |
| 엘프족 | 엘프 | silen, ael, lien, elion |
| 엘프족 | 정령 | dew, mist |
| 엘프족 | 켄타로스 | lana, kai |
| 엘프족 | 요정 | fia, eil |
| 적대 세력 | 마족/오크/고블린/수인/용인/수생 | ravik, grum, niki, sora, kael, neris |

실행용 캐릭터마다 `portrait.png`, `sprites.png`, `frames.json`, `walk-preview.gif`가 있다. 원본과 보정 스트립 PNG 35개 및 생성 프롬프트를 `art-source/pixel-characters/`에 보존했다.

- 아틀라스: 1024×512 RGBA, 128×128 셀, 총 32칸.
- 행: SW → NW → NE → SE. 이전 8방향 원본과 보정 명세는 보존했고, 재패킹 시 네 대각선 행만 추출한다. 24종 모두 기존 해당 행의 픽셀과 발 기준점이 정확히 보존됨을 대조했다.
- 열: idle, walk-left, walk-pass, walk-right, carry-left, carry-right, work-windup, work-contact.
- 걷기는 1→2→3→2 열 반복, 운반은 2포즈, 작업/공격은 2포즈다. 줍기/내려놓기는 기존 포즈를 조합한다.
- 사망은 회전/페이드 처리다. 별도 피격·사망·긴 공격 콤보를 새로 그린 상태가 아니다.
- 카메라 방위에 따라 표시 방향이 바뀌며 각 셀의 발 앵커를 적용한다.
- 생성 원본에서 잘라 정렬한 자산이다. 프레임별 체형/외곽선 차이가 남아 있다. 픽셀 단위 수작업 정리와 더 풍부한 프레임은 후속 과제다.
- 네 번째 사용자 액션 참고 자료로 회수된 파일은 단일 PNG다. 원래 의도한 움짤의 전체 프레임을 확보한 것으로 가정하지 않는다.

재패킹: `python scripts/pack-pixel-characters.py art-source/pixel-characters/pack-manifest.json`. 실행 위치는 프로젝트 루트다. 원본을 보존한 채 명세의 행/열 선택과 보정 스트립을 관리한다.

## 다음 개발에서 우선 확인할 것

1. 로컬 게임 실행 후 인족/엘프족 시작 선택, 주민 패널, 포트레이트와 필드 캐릭터의 동일 인물 연결을 확인한다.
2. 네 방향·걷기·운반·작업·습격에서 몸 크기, 발 위치, 동작 튐, 90도 카메라 전환 시 방향 매칭을 실제 화면으로 비교한다. 캐릭터 방향 선택은 카메라 상대 방향을 사용하며 임의 각도의 전투 목표도 네 모습 중 하나로 표시한다.
3. 아트 보완은 대표 캐릭터를 사용자에게 확인받으며 전개한다. 기존에 반려된 스타일로 전체를 다시 바꾸지 않는다.
4. 전용 피격/사망 동작, 작업별 도구/행동과 더 자연스러운 전환은 아직 남은 작업으로 다룬다.
5. 별도 기능 지시가 있을 때 게임 밸런스·세계 확장·UI 가독성·사운드 커버리지를 이어서 개선한다. 캐릭터 작업 도중 범위를 임의로 확장하지 않는다.

## 로컬화 변경 및 운영 정보

- Bash 전용 설치 명령 대신 Windows/macOS/Linux에서 호출할 수 있는 `npm run setup`을 추가했다. 패키지 버전과 잠금 파일은 유지했다.
- `npm test`는 기존 `simulation`, `campaign`, `release`, 픽셀 캐릭터 검사를 묶는다. 새로운 게임 규칙을 만들지 않는다.
- `.sites-runtime/execution-profile.json`이 없는 압축 해제 상태는 기존 런처의 `portable` 경로로 실행한다. 호스팅 전용 프로필이나 토큰을 복사할 필요가 없다.
- Windows 실행기 `TownGrid.exe`(원본 `scripts/launcher/TownGrid.cs`, 빌드 `npm run build:launcher`)는 `node scripts/run-framework.mjs dev`를 숨김으로 켜고, 서버 로그의 주소를 읽어 Chrome/Edge `--app` 창을 전용 프로필 `%LOCALAPPDATA%\TownGrid\browser`로 연다. 창이 닫히면 서버 프로세스 트리를 끈다. 이미 5173에 타운그리드가 떠 있으면 새 서버 없이 창만 연다. 기록은 `%LOCALAPPDATA%\TownGrid\launcher.log`.
- 2026-09-28 루트 정리: 소스를 `src/`로, Vite 보조 플러그인을 `scripts/vite/`로, 참고 자료를 `art-source/references/`로 옮겼다. 쓰이지 않던 D1 예제·Drizzle 설정·빈 `next.config.ts`·워크스페이스 파일을 지우고 PostCSS 설정은 `vite.config.ts`에 넣었다.
- `.openai/hosting.json`, `scripts/vite/sites-vite-plugin.ts` 등은 Vite 설정이 참조하므로 보존했다. 기존 프로젝트 ID는 비밀 키가 아니며 로컬 실행 권한을 대신하지도 않는다. `build`는 외부 배포를 수행하지 않는다.
- 이전 서버의 Git 이력/자격 증명은 제외하고 원본 커밋 번호를 기록했다. 전체 원본 소스와 자산은 유지했다.
- 다른 주소에서의 세이브는 자동 이전되지 않는다. 원래 게임 설정에서 JSON 내보내기 → 로컬 설정에서 불러오기 순서로 옮긴다.
- `docs/LOCAL_VERIFICATION.md`는 이번 ZIP 기준의 검증 결과다. 과거 `RELEASE_QA.md` 등의 완료 표시와 혼동하지 않는다.

## 2026-09-27 추가 작업 — 환경 샘플과 네 방향 카메라

- 사용자의 최신 지시로 자유 회전을 없앴다. `quarter-camera.js`에서 고도각과 4개 수평각을 고정한다. `scene.js`의 `rotate(-1/1)`은 한 방향씩 이동한다. Q·E, UI 버튼, 기본 시점 복귀, 거점 변경에 같은 규칙을 쓴다. 왼쪽/오른쪽 드래그는 이동이고 휠·두 손가락은 확대/축소다.
- `pixel-environment.js`, `pixel-environment-data.js`가 제재소·참나무·물 타일의 로딩, 상태, 방향을 관리한다. 제재소의 4방향 이미지는 `models.js`의 기존 제재소 생성 경로에 연결했다. 건설 미리보기와 시설 아이콘에도 적용된다. `Game.tsx`의 판재 아이콘도 교체했다.
- 나무 채집 프레임은 실제 가동 중인 벌목장의 자원 타일에만 표시한다. 고갈하면 2.4초 그루터기를 보여주고, 기존 조림의 `growAt`에 맞춰 묘목/어린 나무/성목을 표시한다. 저장 형식이나 무료 재생 규칙을 추가하지 않았다.
- 맵 물 표면은 기존 배경 수면보다 위에 배치해 픽셀 텍스처가 가려지지 않도록 했다. 지도 밖 수면은 기존 표현이다. 물은 4프레임 루프이며 시간 정지를 따른다.
- 환경 스프라이트는 프레임 UV를 개별 관리하면서 GPU 이미지 소스를 공유한다. 투명한 제재소 모서리는 클릭 판정에서 제외한다. CPU 폴백도 같은 방향 행과 프레임을 읽는다.
- 원본·프롬프트·패킹 명세·한계: `art-source/pixel-environment/README.md`. 샘플 비교: `/pixel-environment-preview.html`. 실제 지도: `/` → 산업도시 둘러보기. 화면 증거: `docs/verification/pixel-environment/`.
- 기존 나머지 건물/암석/지형, 전체 화풍 통일, 원거리 안개, 나무가 쓰러지는 추가 중간 프레임은 이번 시험 교체에 포함되지 않는다. 캐릭터 파일은 이 환경/카메라 작업에서 직접 수정하지 않았다.

## 2026-09-27 추가 작업 — 대기·홈·로딩 화면과 주민 일러스트

- 승인된 첫 픽셀 시안 3장을 바탕으로 대기 → 홈 → 새 게임 국가 선택 흐름을 적용했다. 홈에서 이어하기, 파일 불러오기, 설정, 초반 마을 테스트와 산업도시 시연을 연다. 승인 로고와 실제 HTML 버튼을 사용한다.
- 기존 미라·마르나·실렌 작업 장면에 로웬·하나·브론 3장을 추가했다. 시작/저장 불러오기/거점 이동 로딩에 6장을 섞어 사용한다. 같은 묶음 안에서 중복하지 않고, 묶음 경계에서도 연속 반복하지 않는다. 오래 걸리는 로딩은 8초마다 교체하며 준비가 끝나면 즉시 종료한다.
- 홈의 **마을의 하루**에서 6장을 직접 감상한다. 플레이 도중 강제로 등장하는 팝업은 없다.
- 코드: `src/app/game/StartScreens.tsx`, `src/app/game/screen-art.js`, `src/app/start-screens.css`, 연결은 `Game.tsx`. 실행용 9개 WebP는 `public/assets/screens/`, 원본·프롬프트·명세는 `art-source/screen-concepts/2026-09-27/`에 있다. 첫 시안 3장은 그대로 보존했다.
- `node scripts/pack-screen-art.mjs`로 다시 변환한다. 해상도를 유지한 실행용 9장은 합계 약 3.73MB로 원본보다 84% 작다. 그림 표시 이력 키 `towngrid-screen-art-v1`은 게임 저장 형식/키와 별개다.
- 검증: `tests/screen-art.mjs`, `tests/start-screens-browser.mjs`, `docs/verification/start-screens/`. 빠른 로딩은 그림이 짧게 보일 수 있으며, 배경은 정지 일러스트다.
