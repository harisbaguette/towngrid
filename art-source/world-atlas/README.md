# 세계 지도 픽셀 원화

2026-09-29 OpenAI 이미지 생성 도구로 만든 TownGrid 전용 원본이다. 캐릭터 UI의 크림·짙은 녹색·황동 팔레트에 맞춘 픽셀 미니어처를 요청했다. 외부 게임의 이미지는 포함하지 않는다.

- `atlas-source.png`: 4×4 원화. 숲 4종, 산 4종, 사구·오아시스·갈대·화산, 초기 표식 4종.
- `markers-source.png`: 2×2 단순화한 표식. 왼쪽 위부터 수도 성·개척 깃발·보유 마을·적대 요새. 실행용 표식은 이 원본을 사용한다.
- `pack-manifest.json`: 원본 해시, 세계 데이터 해시, 출력 크기와 목록.

`node scripts/pack-world-atlas.mjs`로 `public/assets/world-atlas/`의 PNG 16개와 지형 WebP를 갱신한다. 작은 원화는 nearest 방식으로 줄이고, 물길·해안·지면 연결은 `WORLD_CELLS`의 네 이웃으로 계산한다. 지형 WebP는 지형 데이터의 시각화이며 게임 규칙을 정의하지 않는다.

정확한 24×24 지역 미리보기는 이 원화를 확대해서 만들지 않는다. `LocalMapPreview.tsx`가 실제 시뮬레이션의 타일을 별도로 그린다.
