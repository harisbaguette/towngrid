# 생성 기록

도구: `image_gen.imagegen`. 이미지 생성 원본을 수정 없이 보관하고, 런타임 파일은 `pack-manifest.json`과 패킹 스크립트로 추출한다.

## 최초 3종 아틀라스

새 이미지로 제작. 4열 × 4행 투명 배경 스프라이트 시트. 한 타일 크기의 개방형 제재소는 낮은 청록 지붕, 목재 기둥, 강철 원형 톱, 왼쪽 투입 통나무, 오른쪽 판재 더미와 측면 구동 기어로 용도를 드러내도록 요청했다. 첫 행은 대기와 절삭 3상태, 둘째 행은 참나무의 바람 3상태와 벌목 흔적, 셋째 행은 그루터기·묘목·어린 나무·판재 아이콘, 마지막 행은 지면에 매핑할 평면 수면 4프레임이다.

공통 요구: warm fantasy-industrial pixel art; crisp visible square pixel clusters; dark teal outlines; honey timber; desaturated teal roof; olive/forest foliage; turquoise water; upper-left light; transparent background; no labels, UI, watermark, grid lines, 3D plastic shading or landscape poster. 같은 행의 외형과 바닥 앵커 유지. 물은 정사각형 평면 텍스처이며 다른 스프라이트는 내려다보는 3/4 시점.

## 제재소 4방향

참고 파일: 최초 런타임 `sawmill.png` 4칸 스트립. 동일 디자인으로 4열 × 4행을 요청했다. 행은 SE 정면+오른쪽, NE 뒷면+오른쪽, NW 뒷면+왼쪽, SW 정면+왼쪽. 카메라 고도 약 35°, 각 방향은 90° 간격. 굴뚝은 같은 뒤쪽 모서리에 유지하고 뒷면은 목재 벽과 환기 틈으로 막으며, 전면 톱 작업대는 건물 뒤에서 가려져야 한다. 각 행은 대기 1칸과 생산 3칸, 고정된 지붕과 벽, 이동하는 통나무·회전 톱·절삭 조각, 뒤에서는 보이는 구동부만 움직이도록 요청했다. 단순 좌우 반전 대신 방향별로 새로 그리도록 명시했다.

두 생성 원본 모두 1254×1254 RGBA이다. 원본의 편차는 README의 한계 항목에 기록했다.
