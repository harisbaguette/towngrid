# 타운그리드 · TownGrid

홈과 대기 화면의 물결·굴뚝 연기·등불이 반복해서 움직입니다. 오른쪽 아래의 **배경 움직임 멈추기**로 정지할 수 있으며, 기기의 동작 줄이기 설정도 따릅니다. 소리는 첫 클릭이나 키보드 조작 뒤에 켜지고, 설정에서 음악·효과음·환경음 음량을 각각 조절할 수 있습니다.

홈의 **마을의 하루**에서 기존 캐릭터 27명이 등장하는 일상 그림 24장과 화면 전환 그림 4장을 볼 수 있습니다. 홈에 들어올 때 35% 확률로 일상 그림이 배경에 나타납니다. 생활·자연·산업별 분류와 미리보기로 그림을 고를 수 있습니다. [픽셀 적용 현황과 남은 작화](docs/PIXEL_ART_AUDIT.md)를 참고하세요.

[화면 미리보기](http://localhost:5173/screen-preview)에서는 게임을 초기화하거나 저장하지 않고 일상 그림·홈·대기·로딩·전환 화면을 확인할 수 있습니다.

타운스타식 타일 생산·물류를 바탕으로, 판타지와 현대 산업을 결합한 국가 성장 게임의 개발 프로젝트입니다. 최신 배포본 v13의 소스와 에셋을 로컬 개발용으로 묶었습니다. 현재는 개발 중인 프로토타입이며, 출시 완료본을 의미하지 않습니다.

## 바로 실행

Windows에서는 프로젝트 폴더의 **`TownGrid.exe`를 두 번 누르면** 게임이 열립니다. 실행기는 필요하면 의존성을 설치하고, 게임 서버를 켠 뒤 평소 쓰는 브라우저에서 게임을 엽니다. 작은 타운그리드 실행기 창을 닫으면 서버도 함께 꺼집니다. Node.js 24 LTS가 먼저 설치되어 있어야 하며, 최초 실행에는 인터넷이 필요합니다.

실행 기록은 `%LOCALAPPDATA%\TownGrid\launcher.log`에 남습니다.

개발 서버를 직접 켜려면 다음 순서를 따릅니다.

1. Node.js 24 LTS와 VS Code를 설치합니다. 최초 의존성 설치에는 인터넷이 필요합니다.
2. ZIP을 **전부 압축 해제**하고 프로젝트 폴더를 VS Code로 엽니다. Windows에서는 `C:\dev\TownGrid`처럼 짧은 경로를 권장합니다.
3. VS Code 터미널에서 아래 두 명령을 순서대로 실행합니다.

```sh
npm run setup
npm run dev
```

브라우저에서 **http://localhost:5173**에 접속합니다. 서버 종료는 터미널에서 `Ctrl+C`입니다. 설치를 마친 뒤에는 `npm run dev`만 실행하면 됩니다. 서버 로그에 다른 주소가 표시되면 그 주소를 사용하세요.

마을 화면은 **90도 간격 네 방향 쿼터뷰**입니다. Q/E 또는 회전 버튼으로 시점을 바꾸고, 마우스 드래그로 이동하며 휠로 확대합니다. 캐릭터 실행 자산도 네 대각선 방향을 사용합니다.

기본 1배속에서는 하루가 **2분 40초**입니다. 생산·운송·성장과 함께 세금·질병·재해도 느긋하게 진행합니다. 시간 버튼에서 일시정지하거나 2·4배속으로 바꿀 수 있습니다.

홈의 **일러스트 테스트**에서 운송 수단 10종·파손/수리·자원과 지원 아이콘 86종·전체 건물 106종을 확인할 수 있습니다. [테스트 열기](http://localhost:5173/art-preview.html). 네 방향의 이동·적재, 실제 배송에 연결한 항구 상하차, 건물 붕괴·수리 복구를 비교하며 저장하지 않습니다. [동작 검증 기록](docs/verification/environment-motion-20260929/README.md).

홈의 **지형 8종 테스트**에서 설원·평야·숲·광산 분지·사막과 유전·해안·습지·화산 고원을 비교할 수 있습니다. [테스트 열기](http://localhost:5173/biome-preview.html). 실제 지역의 지면·자원과 생산 규칙을 사용하며 저장하지 않습니다. Q/E로 회전하고 **생산 시작**을 누르세요. 새 게임과 새 거점에도 적용되며, 기존 저장의 지형은 유지합니다.

맵의 네 변은 주변의 산·숲·바다·강 같은 지형과 연결됩니다. **주변 지형**에서 방향별 자원과 이용 시설을 확인하세요. 산 쪽은 채석·광산, 숲 쪽은 벌목, 물가는 어업·항만과 담수 관개에 쓰입니다. [네 방향 지형 테스트](http://localhost:5173/map-edges-preview.html)에서 실제 생산을 켜고 네 시점으로 확인할 수 있습니다. 테스트는 저장하지 않습니다.

[주민·건물 전용 인력 비교](http://localhost:5173/character-preview/)에서 51종의 체형, 네 방향 동작과 숨쉬는 일러스트를 확인할 수 있습니다. 인간 주택은 여성, 드워프 주택은 남성, 티탄 주택은 큰 근육질 남성 일꾼을 배출합니다. 광부·제빵사·재봉사·유리공·마법사·상인·운송원·선원·철도원·조종사·경비대원 등 19개 직업군이 77개 시설 유형에 자동 배치됩니다. 게임의 주민 목록과 건물 정보에서도 확인할 수 있습니다.

초반 픽셀 건물은 시작 화면의 **초반 마을 테스트**에서 바로 확인할 수 있습니다. 창고·주민 주택·우물·밀밭·벌목장과 기존 제재소를 배치했고, 주민 6명이 실제로 생산물을 운반합니다. Q·E로 네 방향을 돌려 보고 건물을 눌러 가동을 바꿀 수 있습니다. 테스트는 자동 저장하지 않아 기존 진행을 유지합니다. 최초 제재소·참나무·물 샘플 비교 페이지는 **http://localhost:5173/pixel-environment-preview.html**입니다.

생산 시설은 본체를 고정하고 작업 부품만 움직입니다. 완성된 물·목재·판재·밀은 실제 재고가 있을 때 보이며 운반 후 줄어듭니다. **http://localhost:5173/production-preview.html**에서 재고 없음·생산 중·완료·재료 부족·중지를 네 방향으로 비교할 수 있습니다.

현재 **건물 106종 전체**에 네 방향 픽셀 작화를 적용했습니다. 확장·2차 보완 시설 24종과 상품 44종, 작물 성장 9종은 이미지 모델 원화를 사용합니다. [농장 성장](http://localhost:5173/production-preview.html?group=farmcrops), [목축 동작](http://localhost:5173/production-preview.html?group=ranch), [얕은 광산·풍력 양수기](http://localhost:5173/production-preview.html?group=farmsupport)에서 본체·작업 부품·실제 재고를 비교할 수 있습니다. [적용 현황과 한계](docs/PIXEL_ART_AUDIT.md), [지형·도로 테스트](http://localhost:5173/environment-preview.html)를 참고하세요. 테스트는 저장하지 않습니다.

타일 생산 사슬은 **자원 80종·시설 111종**입니다. 2026-09-29 확장으로 포도주·초콜릿·설탕 과자, 양모·우유·꿀·오리알 목축, 점토·모래·석회암·청강, 나무 상자·천 상자·소포 사슬과 태양광 패널, 지형 시설(연못·목초지·야생 클로버)을 더했습니다. 2026-09-30 보완으로 바게트·고급/장식 케이크·상그리아·벌집·항공유와 얕은 광산·풍력 양수기를 더했습니다. 새 사슬은 승급에 필요하지 않은 선택 콘텐츠입니다. 수치는 `docs/BALANCE_PATCH_20260928.md` 13절과 17절에 있습니다.

`setup`은 **pnpm 11.25.0**을 사용하여 동봉한 `pnpm-lock.yaml` 그대로 설치합니다. 전역 pnpm 설치는 필요하지 않습니다. `npm install`로 별도의 잠금 파일을 만들지 마세요. 게임 로컬 실행에는 ChatGPT 로그인, OpenAI API 키, Cloudflare 계정 또는 별도 데이터베이스가 필요하지 않습니다.

Windows PowerShell에서 `npm.ps1` 실행이 막히면 실행 정책을 바꾸는 대신 아래처럼 실행하거나 VS Code 터미널을 Command Prompt로 선택합니다.

```powershell
npm.cmd run setup
npm.cmd run dev
```

## Codex에서 이어서 개발

VS Code의 OpenAI 공식 Codex 확장을 설치하고 확장 안에서 로그인합니다. 명령 팔레트에서 `Codex: Open Codex Sidebar`를 실행한 뒤 **이 프로젝트 루트**를 작업 폴더로 사용합니다. 프로젝트 추천 확장에도 등록되어 있습니다.

처음에는 다음 내용을 전달하면 됩니다.

```text
AGENTS.md, docs/LOCAL_HANDOFF.md, docs/LOCAL_VERIFICATION.md를 먼저 읽고
현재 코드와 대조해 작업 상태를 파악해줘.
타운그리드의 확정된 브랜딩과 기획을 유지하고, 이전 작업인 픽셀 캐릭터를 이어서 개발하자.
우선 실행해 캐릭터 방향·동작·일러스트 연결 상태를 확인해줘.
```

`AGENTS.md`에 결정 사항과 작업 규칙, `LOCAL_HANDOFF.md`에 구현 위치와 남은 문제를 정리했습니다. 과거 대화가 새 확장으로 자동 이전되는 것은 아니므로 이 문서와 동봉한 참고 이미지를 기준으로 이어가면 됩니다. 새 Git 저장소를 만들려면 프로젝트에서 `git init`을 실행하세요. 기존 원격 저장소 인증 정보와 `.git` 이력은 들어 있지 않습니다.

## 개발 명령

| 명령 | 용도 |
| --- | --- |
| `npm run setup` | 고정된 pnpm과 잠금 파일로 의존성 설치 |
| `npm run dev` | 로컬 개발 서버, 기본 포트 5173 |
| `npm run typecheck` | TypeScript 검사 |
| `npm test` | 기존 시뮬레이션·캠페인·저장/오디오·픽셀 캐릭터 회귀 검사 |
| `npm run check:characters` | 캐릭터 51종의 방향/동작/PNG/메타데이터 검사 |
| `npm run build` | 배포 가능한 산출물 빌드; 외부 업로드 없음 |
| `npm start` | 빌드 후 Wrangler 로컬 실행; 실제 주소는 로그 확인 |
| `npm run lint` | 기존 ESLint 규칙 검사; 전체 기존 코드의 무경고를 보장하지 않음 |
| `npm run build:launcher` | `scripts/launcher/TownGrid.cs`로 루트의 `TownGrid.exe`를 다시 만듦; Windows 전용 |

VS Code의 `Terminal → Run Task`에서도 위 작업을 실행할 수 있습니다. 추가 회귀 검사는 `tests/`에 보존했습니다. `tests/render-*.mjs`는 이전 제작 환경 전용 시각 자료 생성기이며 기본 로컬 검사에 포함되지 않습니다.

## 들어 있는 것

| 경로 | 내용 |
| --- | --- |
| `TownGrid.exe` | Windows 실행기; 아이콘은 브랜드 심볼 |
| `src/app/game/` | 게임 UI, 시뮬레이션, 세계 지도, 경제, 물류, 렌더러, 캐릭터 |
| `src/components/`, `src/hooks/`, `src/lib/`, `src/vendor/` | 공용 UI 부품과 보조 코드 |
| `public/assets/` | 픽셀 캐릭터, 3D 건물/소품, 사운드, 로고/심볼과 기존 자산 |
| `art-source/pixel-characters/` | 캐릭터 원본·보관 시안·프롬프트·관절과 패킹 명세 |
| `art-source/references/` | 회수한 사용자 제공 시각 참고 자료; 런타임 자산과 구별 |
| `scripts/` | 설치/빌드 보조 코드, 에셋 제작/패킹 코드, 검사 코드 |
| `scripts/launcher/` | 실행기 원본(`TownGrid.cs`)과 빌드 스크립트 |
| `tests/` | 기존 자동 검사 |
| `docs/` | 최신 인수인계, 기존 기획·룰 분석·작업 기록·스크린샷 |
| `docs/EXPORT_MANIFEST.json` | ZIP 내부 파일 목록·크기·SHA-256 및 원본 커밋 |

실행용 캐릭터 PNG는 이미 만들어져 있습니다. 원본을 다시 패킹할 때만 Python 3.11 이상과 아래 라이브러리가 필요합니다.

```sh
python -m pip install -r scripts/requirements-art.txt
python scripts/pack-pixel-characters.py art-source/pixel-characters/pack-manifest.json
npm run check:characters
```

macOS/Linux에서 `python`이 없으면 `python3`를 사용하세요. 자세한 포맷과 애니메이션 한계는 `art-source/pixel-characters/README.md`에 있습니다.

## 기존 세이브 가져오기

게임 저장은 브라우저의 localStorage에 있습니다. 기존 사이트와 localhost는 주소가 달라 저장 공간도 다릅니다. **기존 사이트의 설정에서 저장 JSON을 내보내고, 로컬 게임의 설정에서 불러오세요.** 저장 파일은 ZIP에 자동 포함되지 않습니다. 기존 저장 키와 마이그레이션 코드는 보존했습니다. 테스트용 샘플 도시를 둘러보는 것과 실제 세이브를 구별하세요.

소리는 브라우저에서 게임 시작 등 첫 사용자 입력 후 활성화됩니다. 무음이면 게임 음량, 탭 음소거와 운영체제 출력을 확인합니다.

## 작업 기준과 출처

- 로컬 인수인계 기준: **2026-09-27 / 배포 v13 / 커밋 `9f34ab4e9a082ad8aaa3dd906f646932d49f69e1`**.
- 기존 게임 코드와 아트를 유지하고, 로컬 실행 스크립트·설정·문서를 추가했습니다. 검증 결과와 제외 항목은 `docs/LOCAL_VERIFICATION.md`에 기록합니다.
- 구 명칭이나 과거 사양이 남은 문서/스크린샷은 기록입니다. **현재 요구사항은 `AGENTS.md`와 `docs/LOCAL_HANDOFF.md`를 우선**합니다. 이전 README는 `docs/history/README-hosted-v13.md`에 보존했습니다.
- 외부 에셋 출처/라이선스는 `public/assets/ATTRIBUTION.md`, `public/assets/REFRESH_CREDITS.md`, 각 자산 폴더의 `LICENSE*`와 `public/assets/licenses/`를 유지합니다. 전체 묶음에 일괄적으로 새로운 오픈소스 라이선스를 부여하지 않았습니다.
- 공식 Codex 안내: https://developers.openai.com/codex/ide / https://developers.openai.com/codex/guides/agents-md
