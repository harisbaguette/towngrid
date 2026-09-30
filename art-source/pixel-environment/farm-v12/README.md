# 확장 시설·상품 원화

확장 시설 18종, 상품 42종, 작물 성장 9종과 양수기 회전자·압착기·도르래 원화다. `farm-v11/`의 시설 6종·상품 2종·목축 동작과 함께 사용한다.

`manifest.json`에 원화의 행·열과 상품 순서, `prompts.json`에 생성·수정 요청이 있다. `*-generated.png`는 이미지 모델 원본이며, 나머지 PNG는 실행 규격으로 패킹한 그림이다.

```sh
node scripts/pack-farm-refresh.mjs
node scripts/pack-resource-icons.mjs
```

시설은 SE·NE·NW·SW 순서의 192×768 아틀라스다. 바닥 앞 꼭짓점은 (96,181)에 맞춘다. 밭의 고정 본체와 네 단계 성장 그림은 분리하며, 건설 메뉴 아이콘에는 다 자란 작물을 합성한다. 상품은 기존 35칸과 추가 9칸의 순서를 유지한다.

부품·작물 좌표와 크기는 `src/app/game/pixel-farm-data.js`, 가축 동작은 `pixel-farm-motion.js`에서 관리한다. `farmWorkParts`는 회전자·압착기·도르래 순서다. 양수기 회전자는 기존 `farmParts`의 1번 슬롯에도 넣는다.

`/production-preview.html`의 확장 농장·가공·목축·지형·얕은 광산/풍력 양수기에서 방향과 생산 상태를 비교한다. 상품은 `/art-preview.html`의 자원 보기에서 확인한다.
