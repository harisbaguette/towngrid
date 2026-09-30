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
| 건물 106종 | 각 192×768, 1열×4방향 | 본체 고정. 행 SE → NE → NW → SW |
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
- `resourceGoods`: 상품 80종을 `resource-art.js` 순서로 모은 15360×192 아틀라스. 앞 36칸은 기존 원화, 다음 35칸은 `farmGoods`, 마지막 9칸은 `farmGoods2`(2026-09-30 2차 보완)에서 가져온다. UI의 `resources/*.png` 86종은 상품 80종과 지원 6종을 추출한 96px 아이콘이다.

추출 좌표와 방향 행은 `pack-manifest.json`, 원본 배치 등록은 `scripts/register-completion-art.mjs`에 있다. `land-corrected.png`는 비행기 후면, `water-corrected.png`는 화물선·나룻배 방향을 보정했다. 증기선은 `steamer-source.png`가 최종본이다. 이전 생성본도 비교용 원본으로 보존한다.

재패킹:

```powershell
node scripts/register-completion-art.mjs
node scripts/pack-pixel-environment.mjs --only=cargoWagon,cargoSled,cargoPlane,cargoAirship,cargoRaft,cargoSteamer,cargoShip,cargoFerry,cargoTruckEmpty,cargoTrainEmpty,supportArt
node scripts/pack-resource-icons.mjs
```

`--only`는 기존 건물의 부품 합성 아이콘을 덮어쓰지 않도록 보완 자산만 패킹한다. 상품 변경 시 `resource-art.js`를 먼저 갱신한다. `/art-preview.html`에서 네 방향, 빈 적재함/적재, 손상 단계와 82개 건물을 확인할 수 있다.

계류 항공기 부품을 바꾸면 `scripts/render-pixel-environment-icons.mjs <playwright> <chrome> --only=airterminal,airdock,shipyard`로 해당 건물의 합성 아이콘도 갱신한다.


## 2026-09-29 확장 · farm-v9

`docs/EXPANSION_20260929.md`의 시설 24종(2절 22종 + 6절 2종)·상품 44종(1절 35종 + 6절 9종) 그림이다. 이미지 생성 도구 없이 **스크립트로 그린 픽셀 그림**이며 이미지 모델 원화가 아니다. 그중 `farm-v11/`·`farm-v12/`가 이미지 모델 원화로 교체한 항목은 그쪽이 게임에 쓰이며, `build.py`는 그 항목의 패킹 명세를 덮어쓰지 않는다.

- `farm-v9/pixel_kit.py`: 작은 입체 칸 모형을 게임과 같은 쿼터뷰(행 SE → NE → NW → SW)로 투영하는 그리기 도구와 음영·외곽선 처리, 작물·상품용 2D 음영 그리기.
- `farm-v9/buildings.py`: 시설 24종 모형. 바닥은 기존 밭 받침과 같은 1×1 정방형이며 정면은 남동·남서 시점에 보인다. 동물·오크통·벌통·패널 등 대표 설비는 본체에 들어 있다. 2026-09-30에 얕은 광산(산 없는 평지 갱구·나무 지지대·광석 수레)과 풍력 양수기(격자 탑·꼬리 날개·물통)를 더하고, 밭 표지판(2배 크기)·양봉장(상자 벌통과 짚 벌통)·사료 공장(사일로 높이)·와이너리(오크통과 압착기를 옆 모서리로)·목초지를 다시 그렸다.
- `farm-v9/sprites.py`: 작물 성장 4단계 9줄(포도는 붉은/흰 두 줄), 상품 35종(`goods-source.png`)과 6절 상품 9종(`goods2-source.png` → `farmGoods2`), 부품(벌 떼·양수기 바람개비).
- `farm-v9/build.py`: 원본 시트(`buildings-source.png`·`crops-source.png`·`goods-source.png`·`goods2-source.png`·`parts-source.png`), 패킹 명세 항목, 생성 기록(`generation.json`)과 부품 위치표 `src/app/game/pixel-farm-sockets.js`를 다시 만든다. 부품 위치가 시점에서 건물 뒤에 가려지면 그 시점은 `null`이 되어 그리지 않는다. 양수기 바람개비는 머리보다 훨씬 커서 네 시점 모두 그린다.

재생성:

```powershell
python art-source/pixel-environment/farm-v9/build.py
node scripts/pack-pixel-environment.mjs --only=<build.py가 출력한 목록>
node scripts/pack-farm-refresh.mjs   # farm-v11/v12 원화를 쓰는 항목이 있을 때
node scripts/pack-resource-icons.mjs
node scripts/render-pixel-environment-icons.mjs <playwright> <chrome> --only=<시설 id>
```

`build.py`는 `--only=` 목록과 이미지 모델 원화가 유지되는 항목을 출력한다. 패킹 명세의 이 항목은 `opaqueTile`로 자르기·확대 없이 192px 칸을 그대로 옮긴다. 상태 연결은 `pixel-farm-data.js`에 있다. 밭 8종은 빈 밭 본체 위에 실제 진행률로 작물 4단계를 올리고, 포도밭은 현재 제품(붉은/흰 포도)에 맞는 줄을 쓴다. 비교 화면은 `/production-preview.html?group=farmcrops`부터 `farmterrain`, `farmsupport`(얕은 광산·풍력 양수기)까지 일곱 묶음이다. 품질 한계와 다시 그릴 후보는 `docs/PIXEL_ART_AUDIT.md`에 있다.
