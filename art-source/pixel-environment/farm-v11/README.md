# 시설·목축 그림

`*-generated.png`는 이미지 모델 원화다. 나머지 PNG는 이를 잘라 정렬한 게임용 아틀라스다. 건물은 192px 셀의 SE·NE·NW·SW 네 행이며 바닥선은 181px다. 가축은 네 행 × 여덟 열, 벌은 네 열이다.

```sh
node scripts/pack-farm-refresh.mjs
node scripts/pack-resource-icons.mjs
```

이전 `farm-v9/build.py`로 농장 전체를 다시 만들었다면 위 명령을 마지막에 실행한다. 상품 슬롯은 밀랍 23번·양모 18번만 교체하며 나머지 순서는 유지한다.

가축 열은 서기, 걷기 네 자세, 먹기 세 자세 순서다. 재생과 발 위치는 `src/app/game/pixel-farm-motion.js`, 공방 작업 위치는 `pixel-farm-data.js`의 `REFRESH_SOCKETS`를 수정한다. 가축 수는 생산 수치와 연결되지 않는 장식이다.

미리보기: `/production-preview.html?group=ranch`, `?group=farmworks`, `?group=farmland`.
