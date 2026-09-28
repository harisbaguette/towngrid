# 픽셀 환경 자산

네 방향 지형용 산악 능선은 `map-edges-v6/mountain-source.png`다. 최초 흰 배경 시안과 투명 배경 수정본, 생성 기록을 함께 보관했다. `pack-manifest.json`의 `mountain` 항목으로 192×768의 네 방향 아틀라스를 만든다. `node scripts/pack-pixel-environment.mjs --only=mountain`은 산악 자산만 갱신한다. 배치 규칙은 `src/app/game/map-edges.js`, 비교 화면은 `/map-edges-preview.html`이다.

현재 건물은 네 방향 고정 본체에 작업 부품·작물·완성품을 합성한다. 건물 전체 그림을 프레임마다 바꾸지 않는다. 픽셀 화풍, 1×1 정방형 바닥, 90° 간격 네 방향 카메라를 유지한다.

## 원본과 패킹

- `biomes-v7/`: 8개 지면 텍스처, 눈 덮인 침엽수·활엽수·선인장·원유 노출지·설산·화산 능선의 네 방향 원화. 지면의 최종 원본은 반복 무늬를 줄인 `ground-quiet-source.png`다. `ground-source.png`는 보정 전 비교용으로 보존한다. 새 자산만 재패킹하려면 `node scripts/pack-pixel-environment.mjs --only=biomeGround,snowPine,forestTree,cactus,oilSeep,snowMountain,volcanicMountain`을 실행한다.

- `production-v3/bases-source.png`: 정사각형 창고, 우물, 빈 벌목 적재대와 그루터기, 빈 제재 작업대. 각 네 방향.
- `production-v3/parts-source.png`: 물통·목재·판재·밀 묶음·빈 물통·도끼·톱날·흙.
- `production-v3/crops-source.png`: 같은 밀의 네 성장 단계. 공통 배율과 뿌리 기준선을 사용한다.
- `production-v3/prompts.json`, `crops-prompt.txt`: 생성 지시. 주택은 `simplified-v2/house-source.png`의 방향별 첫 그림을 재사용한다.
- `industry-v4/`: 추가 건물 35종의 네 방향 본체 9장, 상품·부품 원본 2장, 프롬프트와 자르기 경계를 기록한 `generation.json`. 새 원본을 등록할 때 `scripts/register-industry-art.mjs`를 사용한다. 보관한 원본으로 재등록할 수 있으며 생성 도구의 임시 폴더는 필요 없다.
- `world-v5/`: 신규 생산·공공 26종과 기반시설 15종, 작물·상품·닭 동작, 지면·수면·물가·바위·수목·배경·차량 원본. `generation.json`에 생성 지시와 수정 이력을 보존한다. `scripts/register-world-art.mjs`로 패킹 명세를 등록한다. `*-initial.png`는 보정 전 비교용이다.
- `pack-manifest.json`: 원본 자르기 영역, 출력 셀, 배율, 바닥선, 앵커. 실행용 PNG와 `frames.json`은 `public/assets/pixel-environment/`에 있다.
- 최초 상세 원본과 `simplified-v2/`는 비교·복원을 위해 보존한다. 나무·물·판재 아이콘은 기존 원본을 유지한다.

프로젝트 루트에서 `node scripts/pack-pixel-environment.mjs`를 실행한다. 기존 Wrangler → Miniflare의 sharp를 사용한다. 패킹 후 개발 서버를 실행하고 `node scripts/render-pixel-environment-icons.mjs <playwright/index.mjs> <chrome.exe>`로 부품까지 포함한 시설 아이콘을 만든다.

| 자산 | 실행용 구성 | 동작 |
| --- | --- | --- |
| 건물 82종 | 각 192×768, 1열×4방향 | 본체 고정. 행 SE → NE → NW → SW |
| expansionGoods | 3840×192, 20칸 | 신규 상품 17종과 직조·재봉·물레방아 부품 |
| cottonGrowth · herbGrowth · henPeck | 각 768×192, 4칸 | 목화·약초 성장, 닭 모이 쪼기 |
| creek · river · sea · lake | 각 768×192, 4칸 | 지역에 맞는 수면, 게임 시간에 따른 3fps |
| ground · infrastructureGround · networks | 각 1536×192, 8칸 | 지면·흙길·포장·철로·관·컨베이어·물가·흙 단면 |
| 바위·수목·갈대·폐허·등대·관문·차량 | 각 192×768, 4방향 | 고정 배경과 운송 방향 |
| clouds · birds | 각 768×192, 4칸 | 구름 변형 4개, 새 날갯짓 4포즈 |
| productionParts | 1536×192, 8칸 | 작업 도구와 출력 재고 |
| industrialTools | 3072×192, 16칸 | 바퀴·날개·화염·프레스·펌프·로봇 팔·결정·물줄기·그물·증기·방전·밸브·기포·표시등 |
| industrialGoods | 3072×192, 16칸 | 석재부터 의약품까지 상품 15종과 운반 상자 |
| wheatGrowth | 768×192, 4칸 | 실제 진행률에 따른 새싹·생장·녹색 이삭·황금 이삭 |
| 참나무 | 1344×192, 7칸 | 바람·채집·그루터기·묘목·어린 나무 |
| 물 | 768×192, 4칸 | 수면 3fps, 게임 시간에 종속 |
| 판재 | 192×192 | 자원 아이콘 |

## 상태 연결

`src/app/game/production-visuals.js`가 실제 가동 여부, 진행률, 재료, 자연 자원, 시설 출력 재고를 읽는다. 렌더링은 시뮬레이션이나 저장 내용을 변경하지 않는다.

- 우물: 빈 물통이 내려가고 채워진 물통이 올라온다. 완료된 물은 바닥에 별도 물통으로 보인다.
- 벌목장: 도끼만 들어 올렸다 내려치며, 완료 목재는 적재대에 쌓인다. 자연 자원이 고갈되면 도구가 멈춰도 남은 출력 재고는 보인다.
- 제재소: 작업대는 고정, 톱날 상반부가 고정 슬롯에서 회전하고 원목만 이동한다. 판재는 별도 출력 더미다.
- 밀밭: 같은 네 뿌리 위치에서 성장한다. 수확한 밀 묶음과 다음 생산 중인 작물은 함께 보일 수 있다.
- 창고·주택: 전체 그림 교체 동작 없이 고정한다.
- 추가 생산 시설: 날개·바퀴·프레스·채굴 도구·펌프·로봇 팔 등 해당 부품만 움직인다. 부두와 탄광의 매달린 부품에는 고정점과 연결된 줄을 그린다. 방향별 부품 위치와 뒤에서 가려지는 부분은 `pixel-industry-data.js`, 상태 동작은 `pixel-industry.js`에서 관리한다.
- 공급 시설: 실제 `activeUntil`을 읽어 공급 중 표시와 남은 초를 보여 준다. 중지·파손·만료·전력 단절 시 공급 표시가 꺼진다. 발전 시설은 정전 상태도 반영한다. 축전 시설의 세 칸 표시는 실제 `batteryCharge`, 진료소 표시는 실제 돌봄 주기에 연결한다.

작업과 완료 재고는 독립 상태다. 재료는 생산 시작 시 소비하므로 진행률이 남은 시설에 재료가 없다고 작업물을 숨기지 않는다. 출력 더미는 재고량 구간을 표시하고, 지도 수량 표시가 정확한 개수를 알려 준다. 운반자가 실제로 집어 갈 때 감소한다. 멈춘 게임은 같은 작업 포즈를 유지한다.

작업 부품 위치·회전 중심·레이어 순서는 `pixel-environment.js`에 있다. WebGL과 `software-renderer.js`가 같은 위치·투명 배경·회전을 사용한다. 건물과 부품의 투명 부분은 클릭에서 제외한다.

## 확인

`/production-preview.html`에서 건물 묶음·여섯 상태·네 방향·작은 표시·CPU 표시를 비교한다. `?group=food`부터 추가 건물을 볼 수 있다. 한 번에 최대 여섯 카드를 표시해 WebGL 컨텍스트 제한을 피한다. 흰 선은 실제 정방형 타일이다. 실제 생산과 운반은 홈의 **초반 마을 테스트**와 **산업도시 둘러보기**에서 확인한다. 테스트 마을은 기존 자동 저장을 덮어쓰지 않는다. `scripts/review-industry-art.mjs <playwright/index.mjs> <chrome.exe>`로 네 방향 비교표를 다시 캡처한다.

`/environment-preview.html`에서 강·바다·하천, 생산 시설과 항구, 네 시점·상태·CPU 표시를 함께 비교한다. `pixel-terrain.js`는 실제 지형·포장 여부·연결 좌표를 읽고, `pixel-network.js`는 원화의 직선 철로·관·벨트를 연결 모양에 맞춰 투영한다. 철로는 곡선에서도 두 레일의 간격을 유지한다. `software-renderer.js`도 같은 투영을 사용한다. `scripts/review-industry-art.mjs`에 `--expansion`을 붙이면 신규 41종의 네 시점 비교표가 나온다.

시점별 건축 세부 차이와 원거리 안개는 남아 있다. 손상은 공통 균열·잔해 레이어이며 건물마다 별도로 그린 붕괴 본체는 아니다. 관·컨베이어에는 별도 운송 화물 동작이 없고 항구의 크레인은 고정 원화다. 이 아트 작업은 세계 지도·저장 형식·게임 규칙·의존성을 변경하지 않는다.


## 누락 보완 · completion-v8

- `cargoWagon`, `cargoRaft`, `cargoSteamer`, `cargoShip`, `cargoFerry`, `cargoSled`, `cargoPlane`, `cargoAirship`: 새 운송 그림 8종, 각 192×768(네 방향).
- `cargoTruckEmpty`, `cargoTrainEmpty`: 기존 운송체의 빈 적재함 그림. 실제 출고·귀환에 따라 상품을 별도 레이어로 올린다.
- `supportArt`: 전력·말·관개·결계·운송·의료 6종, 경미/심한 균열·잔해·수리 표지·충격·수리 반짝임 6종. 2304×192.
- `resourceGoods`: 기존 상품 원화 36종을 같은 순서로 모은 6912×192 아틀라스. UI의 `resources/*.png` 42종은 상품 36종과 지원 6종을 추출한 96px 아이콘이다.

추출 좌표와 방향 행은 `pack-manifest.json`, 원본 배치 등록은 `scripts/register-completion-art.mjs`에 있다. `land-corrected.png`는 비행기 후면, `water-corrected.png`는 화물선·나룻배 방향을 보정했다. 증기선은 `steamer-source.png`가 최종본이다. 이전 생성본도 비교용 원본으로 보존한다.

재패킹:

```powershell
node scripts/register-completion-art.mjs
node scripts/pack-pixel-environment.mjs --only=cargoWagon,cargoSled,cargoPlane,cargoAirship,cargoRaft,cargoSteamer,cargoShip,cargoFerry,cargoTruckEmpty,cargoTrainEmpty,supportArt
node scripts/pack-resource-icons.mjs
```

`--only`는 기존 건물의 부품 합성 아이콘을 덮어쓰지 않도록 보완 자산만 패킹한다. 상품 변경 시 `resource-art.js`를 먼저 갱신한다. `/art-preview.html`에서 네 방향, 빈 적재함/적재, 손상 단계와 82개 건물을 확인할 수 있다.

계류 항공기 부품을 바꾸면 `scripts/render-pixel-environment-icons.mjs <playwright> <chrome> --only=airterminal,airdock,shipyard`로 해당 건물의 합성 아이콘도 갱신한다.
