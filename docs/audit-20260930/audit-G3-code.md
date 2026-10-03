# 감사 3차 G3 — 코드 수준 결함 (tg-audit2-G3-code)

- 대상: `git diff b3e4c33..HEAD -- src` (HEAD = 4b820dc, 563bcc9·a782923·4932f94·fc3dc7d 포함) + 작업트리 미커밋 변경(2026-09-30 21시대).
- 주의: 감사 중에도 다른 창이 작업트리의 `industry.js`·`proximity.js`·`economy.js`·`production-visuals.js`·`Game.tsx` 등을 계속 고쳤다. 결함마다 **HEAD 상태**와 **작업트리 상태**를 따로 적었다.
- 재현 탐침: `node tests/audit-3/code-run-all.mjs` (G3 탐침 6개 묶음). `--regression`을 붙이면 결함이 하나라도 재현될 때 종료 코드 1. 대조(control) 항목은 줄 앞에 `[control]`이 붙는다.
- 최종 실행 결과(작업트리 기준): 22개 검사 중 13개 재현, 탐침 오류 0. 대조 8개는 모두 정상(미재현), G3-07은 작업트리에서 고쳐져 미재현.

## 결함 표

| ID | 심각도 | 증상 | 재현 | 원인 file:line | 같은 뿌리 이웃 | 수리 방향 | 상태 |
|---|---|---|---|---|---|---|---|
| G3-01 | 높음 (손상·편집 저장에서만) | 출자 `investments[].stake` 형식을 검사하지 않는다. 문자열 stake가 든 저장을 받아들이고, 첫 월드데이에 자금이 `NaN`이 된 뒤 자동 저장·파일 내보내기가 모두 거부되어 그 뒤 진행을 잃는다. 음수 stake(−1e9)는 하루에 1억G를 뺀다. | `code-save.mjs` G3-01: `{accepted:true, moneyAfterDay:NaN, savedAfter:false}` / G3-01b: 5,011G → −99,998,189G | `persistence.js:71` (investments는 nation·day만 검사), `campaign.js:113` dividend `i.stake*COUNCIL.invest.yield` | G3-02, G3-03, G3-03b (validateSave가 이번에 추가된 캠페인 필드를 검사하지 않는 같은 뿌리) | `validateSave`에 `stake`: 없거나 `number(0,1e9)`, 나머지 이웃 필드도 같은 자리에서 형식 검사 | HEAD·작업트리 재현 |
| G3-03b | 높음 (손상·편집 저장에서만) | `battles`를 전혀 검사하지 않는다. `battles:{}`인 저장을 받아들이고, 첫 습격이 끝나는 순간 `Campaign.tick` 안에서 `this.battles.unshift is not a function`이 난다. `scene.js` 루프는 끝에서만 `requestAnimationFrame`을 다시 거므로 화면이 멈춘다. `battles`가 문자열이면 세계 창 전투 기록(563bcc9 신설)이 렌더 중 TypeError. | `code-save.mjs` G3-03b: `{accepted:true, tickError:"this.battles.unshift is not a function"}` | `persistence.js:60-83` validateSave에 battles 항목 없음, `campaign.js` recordBattle, `scene.js:163` loop(예외 보호 없음), `CampaignPanel.tsx:22` 전투 기록 | G3-01 | battles: 배열·길이 ≤20·항목(day, site, faction, damage, defeated) 형식 검사 | HEAD·작업트리 재현 |
| G3-12 | 중간 | 새 게임 기본 시작 지역(비수도권 `외곽 개척지`)을 신생국이 떼어 간다. 분리 규칙은 수도권만 빼므로, 수도권에 있던 옛 본거점과 달리 새 본거점은 분리 대상이다. 봇 캠페인 53일째(29위) 본거점 지방이 `하벤 신연방 34`로 넘어가 본거점 자치권이 풀리고, 본거점 판매가 ×0.93, 노선 통행세 12G가 붙었다. 화면 어디에도 "본거점이 신생국 영토"라는 표시가 없다. | `code-home-split.mjs` G3-12(자연 발생: rank26 소유 estern → rank29 new-34, market .93, toll 12), G3-12b(새 게임: 분리 2번 만에 본거점 지방 소유 new-2, 수도권 본거점은 6번에도 그대로) | `territory.js:48` `owned=…&&!p.capital`, `starting-sites.js`(비수도권 시작), `territory.js:54` 분리 때 `site.territory=false`, `living-economy.js` marketFactor가 tradeConditions market 적용 | G3-12c. `campaign.js:144` onPromotion이 stage 20에 본거점 자치권을 지방 주인과 무관하게 켬 | 분리 대상에서 플레이어 본거점 지방을 뺀다(시작 지역 도입 전과 같은 보호). 보호하지 않기로 하면 세계 창 거점 현황에 "신생국 영토 · 판매 −7% · 통행세"를 표시 | HEAD·작업트리 재현 |
| G3-12c | 중간 | 25~27위에서 위처럼 본거점 자치권이 풀리면 다시 협약할 수 없다. 자치권 협약이 "다른 거점" 수만 세는 승급 허용량으로 본거점까지 막고, 거절 문구도 "승인 독립국부터 다른 거점의 자치권 협약을 맺습니다"라서 본거점에 맞지 않는다. 그동안 본거점 불만이 하루 +1(자치권 없음)씩 오른다. | `code-home-split.mjs` G3-12c: rank 26, allowance 0, `{ok:false}` | `campaign.js:155` territory 분기의 `this.allowance('territory')`, `campaign.js:118` allowance(본거점 제외 집계) | G3-12 | `target===this.homeId`이면 허용량 검사를 건너뛴다 | HEAD·작업트리 재현 |
| G3-06 | 중간 | 장부(J8)가 캠페인 공유 값(자금·생산·판매)과 거점 한 곳의 값(재고·예산)을 섞는다. 거점이 둘 이상이면 화면에 띄운 거점 장부에 다른 거점의 생산이 "생산/사용"으로, 다른 거점의 수입이 "건설·수리·기타"로 나온다. 모든 시설을 끈 지점 장부: 생산 537, 사용 382, 기타 +13,970G. | `code-ledger.mjs` G3-06 | `campaign.js:10` SHARED(`money`,`produced`,`sold`)와 `campaign.js:60` attach getter, `ui-rules.js:260` ledgerSnapshot(공유 money·produced·sold + 거점 stock), `Game.tsx:121-122` trackLedger, 장부 화면 `Game.tsx:334` 부근 | Game.tsx `falling`(자금 추세)은 공유 자금 기준이라 결함 아님(확인) | 장부를 캠페인 단위(모든 거점 재고·예산 합)로 바꾸거나, 거점 단위로 쓰려면 Simulation에 거점별 생산·판매·돈 흐름 기록을 따로 둔다 | HEAD·작업트리 재현 |
| G3-13 | 중간 | 패권국 뒤 끝없는 목표(563bcc9 A2-E1, `LEGACY_GOALS`/`legacy()`)를 어느 화면도 부르지 않는다. 완주 로그는 "이제 대륙 기록에 도전합니다"라고 알리지만 목표 창은 "패권국에 도달했습니다. 신생 국가와의 경쟁은 계속됩니다." 한 줄뿐이다. | `code-wiring.mjs` G3-13: `src/app` 전수 검색에서 `legacy(`·`LEGACY_GOALS` 사용처 0, 32위 봇 저장의 legacy 목표 5개·점수 2 존재 | `campaign.js:148` legacy(), `campaign.js:144` 완주 로그, `Game.tsx:328` 목표 창의 `s.promotion()`이 null일 때 문구 | 목표 카드(objective-card) `rankProgress`도 완주 뒤 100 고정 | 목표 창(또는 세계 창)에 `legacy().goals`의 이름·현재/목표·단계를 보여 주고, 완주 뒤 목표 카드가 다음 기록을 가리키게 | HEAD·작업트리 재현 |
| G3-06b | 낮음 | 장부 "오늘 지금까지" 순이익이 그날 스냅숏 뒤 예산에 잡힌 지출(통상 협상)을 두 번 뺀다: 표시 −565G, 실제 −411G(협상비 154G 중복). | `code-ledger.mjs` G3-06b | 장부 화면 `Game.tsx:334` 부근 `today.money+(l.start.income)-(budget.expenses)` — 현재 expenses 전체를 뺌 | G3-06 | 스냅숏에 expenses를 함께 저장하고 `today.money + start.income − start.expenses` | HEAD·작업트리 재현 |
| G3-08 | 낮음 | 고갈된 벌목장 안내의 묘목 성장 시간. HEAD는 "160초 뒤 자람"(게임 초, 1배속 실제 320초). 작업트리는 실제 초로 바꿨지만 안내 함수가 시뮬레이션을 받지 못해 배속과 무관하게 항상 320초 — 2배속 160초·4배속 80초와 다르다. | `code-time.mjs` G3-08: speed 1/2/4에서 표시 320/320/320, 실제 320/160/80 | HEAD `proximity.js:83` 문구 / 작업트리 `proximity.js:92` `remainingSeconds(SAPLING_GROW,sim)` + `ui-rules.js:22` `blockHint(status)`가 `operationHint(status)`에 sim을 넘기지 않음 | Game.tsx의 `blockHint(b.status)` 호출부 전부 | `blockHint(status,sim)`으로 sim을 전달하고 Game.tsx 호출부에 `s`를 넘긴다 | HEAD 재현(문구), 작업트리 부분 수정 |
| G3-07 | 낮음 | HEAD: 풍력 양수기 설명 "60초간"은 게임 초다. 시설 카드는 실제 초(1배속 120초, 4배속 30초)로 센다. 563bcc9는 급수탑의 같은 문구를 지웠고, 다른 창이 넣은 양수기에는 남았다. | HEAD `industry.js:110` "바람으로 물을 길어 올려 60초간" | HEAD `industry.js:110` | 급수탑(reservoir) 문구 — 이미 수정됨 | 작업트리에서 `{supply}` 자리표시 + `production-visuals.js` describeFacility로 수정 중. 1·4배속 일치 확인 | HEAD 재현, 작업트리 수정됨(미커밋) |
| G3-11 | 낮음 | 개선 버튼이 원재고(`s.stock`)로 켜지고 "벽돌 3/3"을 보이는데, 실제 동작은 주민이 운반하려고 예약한 몫을 뺀 재고로 거절한다("22G와 벽돌 3개가 필요합니다"). 563bcc9가 동작만 예약 제외 재고로 바꾸고 버튼은 그대로 두었다. | `code-ui-gates.mjs` G3-11: stock 3, available 1, buttonEnabled true, `{ok:false}` | `simulation.js:325` upgrade `availableStock(item)<3` ↔ `Game.tsx:307` 버튼 `s.stock[item]<3`·라벨 `Math.floor(s.stock[item])` | 특화 버튼 `Game.tsx:306` `s.stock.plank<2` ↔ `simulation.js:394` specialize `availableStock('plank')` | 버튼 disabled와 라벨을 `s.availableStock(item)`로 | HEAD·작업트리 재현 |
| G3-02 | 낮음 (손상·편집 저장에서만) | `welfareDay`·`completion`을 형식 검사 없이 복원한다. welfareDay가 문자열이면 "복지 협약 하루 한 번" 제한이 풀리고, completion.day가 객체면 완주 창이 "NaN일"을 보인다. | `code-save.mjs` G3-02 | `persistence.js:60-83`(두 필드 없음), `campaign.js:159` restore | G3-01 | welfareDay `number`, completion은 null 또는 day·seconds·revenue·produced·sold·contracts 등 숫자 필드 객체 | HEAD·작업트리 재현 |
| G3-03 | 낮음 (손상·편집 저장에서만) | `sites[].provinceId`를 검사하지 않는다. 두 거점이 한 지방에 있어도 받아들이고, 원래 지방(estern-1)은 빈 부지로 보여 다시 진출할 수 있다. | `code-save.mjs` G3-03 | `persistence.js:77-78` 거점 루프에 provinceId 없음, `site-expansion.js:9-11` owned 판정 | G3-01 | provinceId: `PROVINCE_INDEX`에 있는 id·거점 nation과 같은 나라·중복 금지 | HEAD·작업트리 재현 |

ID 사이의 빈 번호(G3-04, 05, 05b, 05c, 09, 10)는 대조 검사다(아래).

## 확인했지만 결함이 아닌 것 (요청받은 시간 기준·저장 형식 포함)

- **30초 안 철거 전액 환불**: `REFUND_GRACE=30`은 게임 초이고, 시설 카드 철거 버튼이 `remainingSeconds(b.refundUntil-s.time,s)`로 실제 남은 초를 보여 준다(1배속 60초, 4배속 15초). 배치 안내 문구에는 숫자가 없어 어긋나지 않는다.
- **폭풍·좋은 사건 예고**: `at=time+20×배속`(게임 초)이라 예고 순간 기준 모든 배속에서 실제 40초. 알림·HUD 모두 `remainingSeconds` 사용.
- **하루 한 번 복지 협약**: `welfareDay===lastWorldDay`로 막고, 저장·복원된다. 버튼 disabled도 같은 조건.
- **화면 밖 거점 0.25초 묶음 계산**(G3-09 대조): 200 게임초 동안 화면 밖 거점 시계 차이 0, 본거점 생산 주기 화면 위 1,021 / 화면 밖 1,019.
- **월드데이 배당·운영비의 장부 날짜**(G3-10 대조): 다른 거점을 띄워도 본거점이 같은 날로 넘어간 뒤 기록된다.
- **저장 지연 병합**: 버튼 동작 뒤 0.8초에 한 번 저장, 6초 주기·`pagehide`·`visibilitychange`·거점 이동·시작 화면 이동에서도 즉시 저장. 손실 창은 최대 0.8초.
- **새 시뮬레이션 필드 검사**(G3-04 대조): 손상된 `tileState`(형식·길이), `refundUntil` 문자열, 음수 `harvestUntil`, 문자열 `merchantUntil`, 모르는 사건 예고를 모두 거부.
- **옛 저장 왕복**(G3-05 대조): `save-before-20260928.json`(demo·early), `browser-roundtrip.json`(v5) 모두 타일 손실 없음. 수출길 타일의 나무가 사라지는 것은 `layExportRoad`의 의도된 이관.
- **타일 압축 정밀도**(G3-05b 대조): 0.1+0.2, 음수, growAt 소수, 1e-7 모두 그대로 복원.
- **캠페인 저장 왕복**(G3-05c 대조): 봇 저장 8·13·22·31·32위 모두 encode→decode→restore→save 결과가 원본과 같다.
- **직전 감사 코드 결함 재발 여부**: `node tests/audit-2/code-run-all.mjs` → 10개 중 0개 재현.
- 투자 문자열 `'2500'`처럼 숫자로 바뀌는 값은 NaN이 되지 않는다(G3-01 재현은 `'abc'`로 했다).

## 의심 (재현 경로 미확정, 결함 목록에 넣지 않음)

- `CampaignPanel.tsx:1` — 563bcc9가 `'use client'` 지시어 앞에 import를 넣어 지시어가 무효가 됐다. 지금은 클라이언트 컴포넌트(Game.tsx)만 가져와 동작 영향이 없다. 빌드는 돌리지 않았다.
- 예고 뒤 배속을 바꾸면 남은 실제 초가 바뀐다(1배속 예고 뒤 4배속 → 40초가 10초). 예고 시각을 게임 초로 저장하는 설계의 결과.
- `scene.js` 아이콘을 `URL.createObjectURL`로 만들고 해제하지 않는다. 에셋 재시도 버튼으로 캐시를 비울 때만 쌓인다(회당 수 MB 이하).
- 운영비(`campaign.js` upkeep)는 `BUILDINGS.cost`(국가 배율 전), 철거 전액 환불은 `buildCost`(배율 후) 기준. 설계 의도 확인 필요.
- `tests/fixtures`가 아닌 `work/audit3-sandbox/`(다른 에이전트 작업 사본)가 tsc 대상에 잡혀 `npm run typecheck`가 1건 실패한다. 제품 결함은 아니고, 사본을 치우거나 tsconfig에서 제외하면 된다.

## 검토 범위

- N = 67개 파일: HEAD diff 61개 + 작업트리 신규 5개(`ScreenMotion.tsx`, `freight-path.js`, `interface-audio.ts`, `screen-motion.js`, `sprite-grounding.js`) + 작업트리 수정 `vehicle-art.js` 1개.
- 67개 중 61개 검토: JS/TS/TSX 61개 전부. CSS 6개(`design-tokens.css`, `game-panels.css`, `game-ui.css`, `globals.css`, `start-screens.css`, `world-atlas.css`)는 스타일이라 코드 결함 범위에서 뺐다(화면 담당 감사 몫).
- 부르는 쪽·불리는 쪽까지 읽은 곳: `territory.js`(splitTerritory·tradeConditions), `logistics.js`(reserved·pickup), `trade-terminals.js`(networks·goals), `infrastructure.js`(groundFactor), `living-economy.js`(marketFactor·advanceRescue), `scene.js` loop.

## 돌린 명령과 결과

- `node scripts/test-local.mjs` (npm test) → `TownGrid local regression checks passed.` EXIT 0 (감사 시작 시점 작업트리).
- `node tests/audit-2/code-run-all.mjs` → `code audit probes: 0 of 10 checks reproduce a defect; 0 probe errors`.
- `npx tsc --noEmit --incremental false` → src 오류 0, `work/audit3-sandbox/tests/fixtures/starting-map.tsx` 1건(위 의심 항목).
- `node tests/audit-3/code-run-all.mjs` → `G3 code probes: 13 of 22 checks reproduce; 0 probe errors` (재현 13 = G3-01, 01b, 02, 03, 03b, 06, 06b, 08, 11, 12, 12b, 12c, 13. G3-07은 작업트리에서 고쳐져 미재현이고, HEAD 문구는 `git show HEAD:src/app/game/industry.js`로 확인).

## 만든 파일

- `tests/audit-3/code-run-all.mjs` — G3 탐침 묶음 실행기
- `tests/audit-3/code-save.mjs` — G3-01·01b·02·03·03b, 대조 04·05·05b·05c
- `tests/audit-3/code-ledger.mjs` — G3-06·06b
- `tests/audit-3/code-time.mjs` — G3-07·08, 대조 09·10
- `tests/audit-3/code-ui-gates.mjs` — G3-11
- `tests/audit-3/code-home-split.mjs` — G3-12·12b·12c
- `tests/audit-3/code-wiring.mjs` — G3-13

소스 파일은 고치지 않았다.
